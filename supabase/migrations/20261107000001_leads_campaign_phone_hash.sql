-- ============================================================================
-- Migration: 20261107000001_leads_campaign_phone_hash.sql
-- Purpose: Enforce one registration per phone number per campaign via dedicated
--          public.campaign_phone_registrations claim table and atomic RPC.
--
-- Preserves ALL historical leads (including duplicates) untouched:
-- 1. Does NOT alter, update, or delete existing rows in public.leads.
-- 2. Preserves all lead IDs, scores, times, vouchers, submitted_at, and rankings.
-- 3. Backfills exactly one claim per distinct (campaign_id, phone_hash) pair,
--    associating it with the earliest historical submission (first_lead_id).
-- 4. Ensures race-safe, atomic registration of new leads via register_quiz_lead() RPC.
-- 5. Safe for migration retry (idempotent with IF NOT EXISTS and ON CONFLICT DO NOTHING).
-- ============================================================================

BEGIN;

-- 1. Ensure cryptographic hashing extension
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 2. Canonical phone normalizer function (immutable, safe for indexing/digests)
CREATE OR REPLACE FUNCTION public.normalize_vietnamese_phone(input_phone TEXT)
RETURNS TEXT
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  compact TEXT;
BEGIN
  compact := regexp_replace(btrim(COALESCE(input_phone, '')), '[[:space:]().-]+', '', 'g');
  IF compact LIKE '+84%' THEN
    RETURN '0' || substring(compact FROM 4);
  ELSIF compact LIKE '84%' AND length(compact) = 11 THEN
    RETURN '0' || substring(compact FROM 3);
  END IF;
  RETURN compact;
END;
$$;

-- 3. Dedicated registration-claim table
CREATE TABLE IF NOT EXISTS public.campaign_phone_registrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE,
  phone_hash TEXT NOT NULL CHECK (char_length(phone_hash) = 64),
  first_lead_id UUID REFERENCES public.leads(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_campaign_phone_registrations UNIQUE (campaign_id, phone_hash)
);

CREATE INDEX IF NOT EXISTS idx_campaign_phone_reg_lookup
  ON public.campaign_phone_registrations (campaign_id, phone_hash);

CREATE INDEX IF NOT EXISTS idx_campaign_phone_reg_lead
  ON public.campaign_phone_registrations (first_lead_id);

-- Enforce strict default-deny Row Level Security (RLS)
ALTER TABLE public.campaign_phone_registrations ENABLE ROW LEVEL SECURITY;

-- 4. Backfill one registration claim for each distinct (campaign_id, phone_hash)
--    from existing historical leads.
--    When duplicate leads exist for the same phone in a campaign:
--    - ZERO leads are modified or deleted from public.leads.
--    - The earliest submission (ORDER BY submitted_at ASC, id ASC) is chosen as first_lead_id.
--    - ON CONFLICT DO NOTHING ensures complete idempotency on migration retries.
INSERT INTO public.campaign_phone_registrations (
  campaign_id,
  phone_hash,
  first_lead_id,
  created_at
)
SELECT DISTINCT ON (
  l.campaign_id,
  encode(digest(public.normalize_vietnamese_phone(l.phone_number), 'sha256'), 'hex')
)
  l.campaign_id,
  encode(digest(public.normalize_vietnamese_phone(l.phone_number), 'sha256'), 'hex') AS phone_hash,
  l.id AS first_lead_id,
  l.submitted_at AS created_at
FROM public.leads l
ORDER BY
  l.campaign_id,
  encode(digest(public.normalize_vietnamese_phone(l.phone_number), 'sha256'), 'hex'),
  l.submitted_at ASC,
  l.id ASC
ON CONFLICT (campaign_id, phone_hash) DO NOTHING;

-- 5. Atomic RPC for claiming phone registration and inserting lead
CREATE OR REPLACE FUNCTION public.register_quiz_lead(
  p_payload JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_campaign_id UUID;
  v_quiz_session_id UUID;
  v_full_name TEXT;
  v_phone_number TEXT;
  v_phone_hash TEXT;
  v_masked_phone TEXT;
  v_score INTEGER;
  v_time_taken_seconds INTEGER;
  v_voucher_code TEXT;
  v_submitted_at TIMESTAMPTZ;
  v_lead public.leads;
  v_claim_id UUID;
BEGIN
  IF p_payload IS NULL OR jsonb_typeof(p_payload) <> 'object' THEN
    RAISE EXCEPTION 'invalid_payload: payload must be a JSON object' USING ERRCODE = '22023';
  END IF;

  v_campaign_id := (p_payload ->> 'campaign_id')::UUID;
  v_quiz_session_id := NULLIF(p_payload ->> 'quiz_session_id', '')::UUID;
  v_full_name := btrim(COALESCE(p_payload ->> 'full_name', ''));
  v_phone_number := btrim(COALESCE(p_payload ->> 'phone_number', ''));
  v_phone_hash := btrim(COALESCE(p_payload ->> 'phone_hash', ''));
  v_masked_phone := btrim(COALESCE(p_payload ->> 'masked_phone', ''));
  v_score := (p_payload ->> 'score')::INTEGER;
  v_time_taken_seconds := COALESCE((p_payload ->> 'time_taken_seconds')::INTEGER, 0);
  v_voucher_code := NULLIF(btrim(COALESCE(p_payload ->> 'voucher_code', '')), '');
  v_submitted_at := COALESCE((p_payload ->> 'submitted_at')::TIMESTAMPTZ, now());

  IF v_campaign_id IS NULL THEN
    RAISE EXCEPTION 'campaign_id is required' USING ERRCODE = '22023';
  END IF;

  IF char_length(v_full_name) < 2 THEN
    RAISE EXCEPTION 'full_name must be at least 2 characters' USING ERRCODE = '22023';
  END IF;

  IF v_phone_hash IS NULL OR char_length(v_phone_hash) <> 64 THEN
    v_phone_hash := encode(digest(public.normalize_vietnamese_phone(v_phone_number), 'sha256'), 'hex');
  END IF;

  -- Step A: Claim phone registration atomically
  -- If this phone was already claimed (including historically backfilled),
  -- this raises unique_violation (23505) and rolls back the transaction.
  BEGIN
    INSERT INTO public.campaign_phone_registrations (
      campaign_id,
      phone_hash,
      created_at
    )
    VALUES (
      v_campaign_id,
      v_phone_hash,
      v_submitted_at
    )
    RETURNING id INTO v_claim_id;
  EXCEPTION
    WHEN unique_violation THEN
      RAISE EXCEPTION 'PHONE_ALREADY_REGISTERED: This phone number has already registered for this campaign'
        USING ERRCODE = '23505',
              DETAIL = 'uq_campaign_phone_registrations';
  END;

  -- Step B: Insert lead row
  BEGIN
    INSERT INTO public.leads (
      campaign_id,
      quiz_session_id,
      full_name,
      phone_number,
      masked_phone,
      score,
      time_taken_seconds,
      voucher_code,
      submitted_at
    )
    VALUES (
      v_campaign_id,
      v_quiz_session_id,
      v_full_name,
      v_phone_number,
      v_masked_phone,
      v_score,
      v_time_taken_seconds,
      COALESCE(v_voucher_code, ''),
      v_submitted_at
    )
    RETURNING * INTO v_lead;
  EXCEPTION
    WHEN check_violation THEN
      IF SQLERRM LIKE '%leads_masked_phone_check%' THEN
        INSERT INTO public.leads (
          campaign_id,
          quiz_session_id,
          full_name,
          phone_number,
          masked_phone,
          score,
          time_taken_seconds,
          voucher_code,
          submitted_at
        )
        VALUES (
          v_campaign_id,
          v_quiz_session_id,
          v_full_name,
          v_phone_number,
          substring(v_phone_number from 1 for 2) || '***' || substring(v_phone_number from char_length(v_phone_number)-3),
          v_score,
          v_time_taken_seconds,
          COALESCE(v_voucher_code, ''),
          v_submitted_at
        )
        RETURNING * INTO v_lead;
      ELSE
        RAISE;
      END IF;
  END;

  -- Step C: Associate created lead ID with the registration claim
  UPDATE public.campaign_phone_registrations
  SET first_lead_id = v_lead.id
  WHERE id = v_claim_id;

  RETURN to_jsonb(v_lead);
END;
$$;

-- Secure execution permissions
REVOKE EXECUTE ON FUNCTION public.register_quiz_lead FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.register_quiz_lead TO service_role;

COMMIT;
