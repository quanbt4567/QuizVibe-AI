-- ============================================================================
-- Migration: 20261105000001_initial_quizvibe_schema.sql
-- Project:   QuizVibe AI — Phase 1 Backend Foundation & Database
-- Target:    Supabase PostgreSQL (PostgreSQL 15+)
-- Purpose:   Minimal relational schema for multi-device campaigns, questions,
--            vouchers, quiz sessions, and lead capture/leaderboard ranking.
-- Security:  Row Level Security (RLS) enabled on all tables (default-deny for
--            browser anon role; all queries execute server-side via Vercel API
--            using SUPABASE_SERVICE_ROLE_KEY).
-- ============================================================================

BEGIN;

-- Ensure pgcrypto is available for gen_random_uuid()
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ----------------------------------------------------------------------------
-- Helper Trigger Function: Automatically maintain updated_at timestamps
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.set_updated_at_timestamp()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- ----------------------------------------------------------------------------
-- 1. Table: public.campaigns
-- Supports multiple campaigns and lifecycle states: draft, published, archived
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE CHECK (
    char_length(btrim(slug)) >= 3
    AND slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'
  ),
  legacy_id TEXT UNIQUE,
  title TEXT NOT NULL CHECK (char_length(btrim(title)) >= 3),
  description TEXT NOT NULL DEFAULT '',
  industry TEXT NOT NULL CHECK (char_length(btrim(industry)) >= 1),
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'archived')),
  is_ai_generated BOOLEAN NOT NULL DEFAULT false,
  is_mock BOOLEAN NOT NULL DEFAULT false,
  mock_label TEXT,
  published_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_campaigns_status_published_at
  ON public.campaigns (status, published_at DESC);

DROP TRIGGER IF EXISTS trg_campaigns_set_updated_at ON public.campaigns;
CREATE TRIGGER trg_campaigns_set_updated_at
  BEFORE UPDATE ON public.campaigns
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at_timestamp();

-- ----------------------------------------------------------------------------
-- 2. Table: public.campaign_questions
-- Stores the 5 multiple-choice questions belonging to a campaign (order 0..4)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.campaign_questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE,
  question_order SMALLINT NOT NULL CHECK (question_order BETWEEN 0 AND 4),
  question_text TEXT NOT NULL CHECK (char_length(btrim(question_text)) >= 5),
  options JSONB NOT NULL CHECK (
    jsonb_typeof(options) = 'array'
    AND jsonb_array_length(options) = 4
  ),
  correct_index SMALLINT NOT NULL CHECK (correct_index BETWEEN 0 AND 3),
  explanation TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_campaign_questions_order UNIQUE (campaign_id, question_order)
);

CREATE INDEX IF NOT EXISTS idx_campaign_questions_campaign_order
  ON public.campaign_questions (campaign_id, question_order ASC);

DROP TRIGGER IF EXISTS trg_campaign_questions_set_updated_at ON public.campaign_questions;
CREATE TRIGGER trg_campaign_questions_set_updated_at
  BEFORE UPDATE ON public.campaign_questions
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at_timestamp();

-- ----------------------------------------------------------------------------
-- 3. Table: public.vouchers
-- One-to-one reward voucher configuration associated with a campaign
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.vouchers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL UNIQUE REFERENCES public.campaigns(id) ON DELETE CASCADE,
  code TEXT NOT NULL CHECK (
    char_length(btrim(code)) >= 2
    AND code !~ '\s'
  ),
  discount TEXT NOT NULL CHECK (char_length(btrim(discount)) >= 1),
  description TEXT NOT NULL DEFAULT '',
  expiry_date TEXT,
  terms TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_vouchers_campaign_id
  ON public.vouchers (campaign_id);

DROP TRIGGER IF EXISTS trg_vouchers_set_updated_at ON public.vouchers;
CREATE TRIGGER trg_vouchers_set_updated_at
  BEFORE UPDATE ON public.vouchers
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at_timestamp();

-- ----------------------------------------------------------------------------
-- 4. Table: public.quiz_sessions
-- Stores anonymous quiz gameplay sessions scoped to a specific campaign.
-- Avoids storing unnecessary PII (no IP, user-agent, or device fingerprint).
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.quiz_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'completed' CHECK (status IN ('in_progress', 'completed', 'expired')),
  total_score INTEGER NOT NULL DEFAULT 0 CHECK (total_score BETWEEN 0 AND 2000),
  correct_count SMALLINT NOT NULL DEFAULT 0 CHECK (correct_count BETWEEN 0 AND 5),
  total_questions SMALLINT NOT NULL DEFAULT 5 CHECK (total_questions = 5),
  time_taken_seconds INTEGER NOT NULL DEFAULT 0 CHECK (time_taken_seconds BETWEEN 0 AND 300),
  answers_snapshot JSONB NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(answers_snapshot) = 'array'),
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_quiz_sessions_campaign_created
  ON public.quiz_sessions (campaign_id, created_at DESC);

-- ----------------------------------------------------------------------------
-- 5. Table: public.leads
-- Stores verified participant lead captures scoped to a specific campaign.
-- Minimal PII: only full_name and validated 10-digit Vietnamese phone_number
-- plus pre-computed masked_phone (e.g., 098***5678) for public leaderboards.
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES public.campaigns(id) ON DELETE RESTRICT,
  quiz_session_id UUID UNIQUE REFERENCES public.quiz_sessions(id) ON DELETE SET NULL,
  full_name TEXT NOT NULL CHECK (char_length(btrim(full_name)) >= 2),
  phone_number TEXT NOT NULL CHECK (phone_number ~ '^(03|05|07|08|09)[0-9]{8}$'),
  masked_phone TEXT NOT NULL CHECK (masked_phone ~ '^(03|05|07|08|09)\*{3}[0-9]{4}$'),
  score INTEGER NOT NULL CHECK (score BETWEEN 0 AND 2000),
  time_taken_seconds INTEGER NOT NULL DEFAULT 0 CHECK (time_taken_seconds >= 0),
  voucher_code TEXT NOT NULL CHECK (char_length(btrim(voucher_code)) >= 1),
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Composite index matching canonical Top 10 Leaderboard sort order:
-- 1. score DESC, 2. time_taken_seconds ASC, 3. submitted_at ASC
CREATE INDEX IF NOT EXISTS idx_leads_campaign_leaderboard
  ON public.leads (campaign_id, score DESC, time_taken_seconds ASC, submitted_at ASC);

CREATE INDEX IF NOT EXISTS idx_leads_campaign_submitted
  ON public.leads (campaign_id, submitted_at DESC);

CREATE INDEX IF NOT EXISTS idx_leads_campaign_phone
  ON public.leads (campaign_id, phone_number);

-- ----------------------------------------------------------------------------
-- Row Level Security (RLS) Enforcement
-- All 5 tables enable RLS with no public/anon policies so browser clients
-- cannot query raw tables directly. Server-side Vercel API routes connect
-- using SUPABASE_SERVICE_ROLE_KEY.
-- ----------------------------------------------------------------------------
ALTER TABLE public.campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.campaign_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vouchers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quiz_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;

COMMIT;

