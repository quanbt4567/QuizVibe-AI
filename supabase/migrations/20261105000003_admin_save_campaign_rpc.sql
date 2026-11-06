-- ============================================================================
-- Migration: 20261105000003_admin_save_campaign_rpc.sql
-- Project:   QuizVibe AI — Phase 3 Multi-Campaign Management & Publishing
-- Purpose:   Atomic create/update of a campaign together with its 5 questions
--            and its voucher in ONE database transaction.
--
-- Why an RPC is genuinely required:
--   A campaign is stored across three tables (campaigns, campaign_questions,
--   vouchers). PostgREST cannot span a transaction across separate REST calls,
--   so doing three writes from the API layer could leave an incomplete campaign
--   (for example, campaign saved but questions not) if the second or third call
--   fails. A plpgsql function body always runs inside a single transaction, so
--   any failure rolls back everything.
--
-- Scope / safety:
--   * Non-destructive: only CREATE OR REPLACE FUNCTION. No table, column,
--     constraint, index, or policy is altered.
--   * New campaigns are ALWAYS created as 'draft'. Lifecycle changes
--     (publish / unpublish / archive / restore) never go through this function.
--   * The slug is accepted on INSERT only and is never modified on UPDATE
--     (stable public URLs). Slug collisions surface as SQLSTATE 23505, which the
--     API layer resolves by retrying with a different suffix.
--   * Question rows are upserted by (campaign_id, question_order) so question ids
--     stay stable across edits (needed by Phase 4 sessions).
--   * SECURITY INVOKER + EXECUTE granted to service_role only: anon and
--     authenticated browser roles cannot call it. RLS stays enabled with zero
--     public policies.
-- ============================================================================

BEGIN;

CREATE OR REPLACE FUNCTION public.admin_save_campaign(
  p_campaign_id UUID,
  p_payload JSONB
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_id UUID;
  v_question JSONB;
  v_index INT;
BEGIN
  IF p_payload IS NULL OR jsonb_typeof(p_payload) <> 'object' THEN
    RAISE EXCEPTION 'invalid_payload' USING ERRCODE = '22023';
  END IF;

  IF COALESCE(jsonb_typeof(p_payload -> 'questions'), '') <> 'array'
     OR jsonb_array_length(p_payload -> 'questions') <> 5 THEN
    RAISE EXCEPTION 'a campaign must contain exactly 5 questions' USING ERRCODE = '22023';
  END IF;

  IF COALESCE(jsonb_typeof(p_payload -> 'voucher'), '') <> 'object' THEN
    RAISE EXCEPTION 'voucher is required' USING ERRCODE = '22023';
  END IF;

  IF p_campaign_id IS NULL THEN
    INSERT INTO public.campaigns (
      slug, title, description, industry, status,
      is_ai_generated, is_mock, mock_label
    )
    VALUES (
      p_payload ->> 'slug',
      p_payload ->> 'title',
      COALESCE(p_payload ->> 'description', ''),
      p_payload ->> 'industry',
      'draft',
      COALESCE((p_payload ->> 'is_ai_generated')::BOOLEAN, FALSE),
      COALESCE((p_payload ->> 'is_mock')::BOOLEAN, FALSE),
      NULLIF(p_payload ->> 'mock_label', '')
    )
    RETURNING id INTO v_id;
  ELSE
    UPDATE public.campaigns
       SET title = p_payload ->> 'title',
           description = COALESCE(p_payload ->> 'description', ''),
           industry = p_payload ->> 'industry',
           is_ai_generated = COALESCE((p_payload ->> 'is_ai_generated')::BOOLEAN, FALSE),
           is_mock = COALESCE((p_payload ->> 'is_mock')::BOOLEAN, FALSE),
           mock_label = NULLIF(p_payload ->> 'mock_label', '')
     WHERE id = p_campaign_id
       AND status <> 'archived'
    RETURNING id INTO v_id;

    IF v_id IS NULL THEN
      RAISE EXCEPTION 'campaign_not_found_or_archived' USING ERRCODE = 'P0002';
    END IF;
  END IF;

  FOR v_index IN 0..4 LOOP
    v_question := (p_payload -> 'questions') -> v_index;

    INSERT INTO public.campaign_questions (
      campaign_id, question_order, question_text, options, correct_index, explanation
    )
    VALUES (
      v_id,
      v_index,
      v_question ->> 'question_text',
      v_question -> 'options',
      (v_question ->> 'correct_index')::SMALLINT,
      NULLIF(v_question ->> 'explanation', '')
    )
    ON CONFLICT (campaign_id, question_order) DO UPDATE
      SET question_text = EXCLUDED.question_text,
          options = EXCLUDED.options,
          correct_index = EXCLUDED.correct_index,
          explanation = EXCLUDED.explanation;
  END LOOP;

  INSERT INTO public.vouchers (
    campaign_id, code, discount, description, expiry_date, terms
  )
  VALUES (
    v_id,
    p_payload -> 'voucher' ->> 'code',
    p_payload -> 'voucher' ->> 'discount',
    COALESCE(p_payload -> 'voucher' ->> 'description', ''),
    NULLIF(p_payload -> 'voucher' ->> 'expiry_date', ''),
    NULLIF(p_payload -> 'voucher' ->> 'terms', '')
  )
  ON CONFLICT (campaign_id) DO UPDATE
    SET code = EXCLUDED.code,
        discount = EXCLUDED.discount,
        description = EXCLUDED.description,
        expiry_date = EXCLUDED.expiry_date,
        terms = EXCLUDED.terms;

  RETURN v_id;
END;
$$;

-- Browser roles must never call this function; only the server (service_role) may.
REVOKE ALL ON FUNCTION public.admin_save_campaign(UUID, JSONB) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_save_campaign(UUID, JSONB) FROM anon;
REVOKE ALL ON FUNCTION public.admin_save_campaign(UUID, JSONB) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.admin_save_campaign(UUID, JSONB) TO service_role;

COMMIT;

