-- ============================================================================
-- Migration: 20261105000004_quiz_sessions_phase4.sql
-- Project:   QuizVibe AI — Phase 4 Player Sessions & Server-Side Scoring
-- Purpose:   Adds session token and question tracking columns to public.quiz_sessions.
-- Security:  Preserves RLS on all tables (server-role access only).
-- ============================================================================

BEGIN;

ALTER TABLE public.quiz_sessions
  ADD COLUMN IF NOT EXISTS session_token TEXT UNIQUE,
  ADD COLUMN IF NOT EXISTS current_question_index SMALLINT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS current_question_started_at TIMESTAMPTZ NOT NULL DEFAULT now();

CREATE INDEX IF NOT EXISTS idx_quiz_sessions_token
  ON public.quiz_sessions (session_token)
  WHERE session_token IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_quiz_sessions_campaign_status
  ON public.quiz_sessions (campaign_id, status);

COMMIT;

