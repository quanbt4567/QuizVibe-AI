-- ============================================================================
-- Migration: 20261105000002_admin_sessions.sql
-- Project:   QuizVibe AI — Phase 2 Authentication & Admin/Player Separation
-- Target:    Supabase PostgreSQL (PostgreSQL 15+)
-- Purpose:   Minimal server-side Admin session table supporting stateful
--            session verification and immediate server-side session revocation
--            on logout across stateless Vercel Serverless Function instances.
-- Security:  Stores only SHA-256 token_hash (never plaintext session tokens).
--            Row Level Security (RLS) enabled with zero public/anon policies.
-- ============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS public.admin_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  token_hash TEXT NOT NULL UNIQUE CHECK (char_length(token_hash) = 64),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL,
  revoked_at TIMESTAMPTZ,
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_admin_sessions_token_hash
  ON public.admin_sessions (token_hash);

CREATE INDEX IF NOT EXISTS idx_admin_sessions_expires_at
  ON public.admin_sessions (expires_at);

-- Enforce strict default-deny RLS (no public/anon access policies)
ALTER TABLE public.admin_sessions ENABLE ROW LEVEL SECURITY;

COMMIT;

