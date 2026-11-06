-- ============================================================================
-- Migration: 20261106000007_enforce_session_token_hash_not_null.sql
-- Project:   QuizVibe AI — Phase 7.5.2 Token Contract NOT NULL Finalization
-- Purpose:   1. Verify that all existing player session rows have valid, non-null,
--               canonical 64-character lowercase hexadecimal SHA-256 token hashes.
--            2. Enforce NOT NULL constraint on public.quiz_sessions.session_token_hash.
--            3. Verify catalog metadata confirms is_nullable = 'NO' post-DDL.
--            4. Preserve existing unique constraints and indexes.
--            5. Notify PostgREST to reload schema cache.
-- Invariants: Atomic transaction (BEGIN ... COMMIT). Any failure aborts with rollback.
-- ============================================================================

BEGIN;

-- ============================================================================
-- 1. Preflight Invariant Assertions (Fail-Closed Gates)
-- ============================================================================
DO $$
DECLARE
  v_col_exists BOOLEAN;
  v_null_hash_count INT;
  v_malformed_hash_count INT;
  v_total_rows INT;
  v_distinct_hashes INT;
BEGIN
  -- Gate A: Confirm column session_token_hash exists
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'quiz_sessions'
      AND column_name = 'session_token_hash'
  ) INTO v_col_exists;

  IF NOT v_col_exists THEN
    RAISE EXCEPTION 'MIGRATION 000007 ABORTED: Column public.quiz_sessions.session_token_hash does not exist.';
  END IF;

  -- Gate B: Confirm plaintext session_token column remains absent
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'quiz_sessions'
      AND column_name = 'session_token'
  ) THEN
    RAISE EXCEPTION 'MIGRATION 000007 ABORTED: Legacy column session_token still exists in public.quiz_sessions.';
  END IF;

  -- Gate C: Confirm zero NULL hashes
  SELECT count(*) INTO v_null_hash_count
  FROM public.quiz_sessions
  WHERE session_token_hash IS NULL;

  IF v_null_hash_count > 0 THEN
    RAISE EXCEPTION 'MIGRATION 000007 ABORTED: Found % row(s) with NULL session_token_hash.', v_null_hash_count;
  END IF;

  -- Gate D: Confirm zero malformed hashes (must be exact 64 lowercase hex chars)
  SELECT count(*) INTO v_malformed_hash_count
  FROM public.quiz_sessions
  WHERE session_token_hash !~ '^[0-9a-f]{64}$';

  IF v_malformed_hash_count > 0 THEN
    RAISE EXCEPTION 'MIGRATION 000007 ABORTED: Found % row(s) with malformed session_token_hash.', v_malformed_hash_count;
  END IF;

  -- Gate E: Confirm uniqueness across all rows
  SELECT count(*), count(DISTINCT session_token_hash)
  INTO v_total_rows, v_distinct_hashes
  FROM public.quiz_sessions;

  IF v_total_rows <> v_distinct_hashes THEN
    RAISE EXCEPTION 'MIGRATION 000007 ABORTED: Duplicate session_token_hash values detected (% total vs % distinct).',
      v_total_rows, v_distinct_hashes;
  END IF;

  RAISE NOTICE 'PREFLIGHT PASSED: % rows inspected. All hashes valid, non-null, and unique.', v_total_rows;
END $$;

-- ============================================================================
-- 2. DDL: Enforce NOT NULL on session_token_hash
-- ============================================================================
ALTER TABLE public.quiz_sessions
  ALTER COLUMN session_token_hash SET NOT NULL;

-- ============================================================================
-- 3. Post-DDL Invariant Verification
-- ============================================================================
DO $$
DECLARE
  v_is_nullable TEXT;
  v_attnotnull BOOLEAN;
  v_unique_valid BOOLEAN;
  v_index_valid BOOLEAN;
BEGIN
  -- Verify information_schema reflects is_nullable = 'NO'
  SELECT is_nullable INTO v_is_nullable
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND table_name = 'quiz_sessions'
    AND column_name = 'session_token_hash';

  IF v_is_nullable IS DISTINCT FROM 'NO' THEN
    RAISE EXCEPTION 'POST-MIGRATION VERIFICATION FAILED: session_token_hash is_nullable is %, expected NO.', v_is_nullable;
  END IF;

  -- Verify pg_attribute catalog attnotnull = true
  SELECT a.attnotnull INTO v_attnotnull
  FROM pg_attribute a
  JOIN pg_class c ON a.attrelid = c.oid
  JOIN pg_namespace n ON c.relnamespace = n.oid
  WHERE n.nspname = 'public'
    AND c.relname = 'quiz_sessions'
    AND a.attname = 'session_token_hash';

  IF v_attnotnull IS NOT TRUE THEN
    RAISE EXCEPTION 'POST-MIGRATION VERIFICATION FAILED: pg_attribute.attnotnull is NOT true for session_token_hash.';
  END IF;

  -- Verify unique constraint remains intact and validated
  SELECT c.convalidated INTO v_unique_valid
  FROM pg_constraint c
  JOIN pg_class t ON c.conrelid = t.oid
  JOIN pg_namespace n ON t.relnamespace = n.oid
  WHERE n.nspname = 'public'
    AND t.relname = 'quiz_sessions'
    AND c.conname = 'quiz_sessions_token_hash_unique'
    AND c.contype = 'u';

  IF v_unique_valid IS NOT TRUE THEN
    RAISE EXCEPTION 'POST-MIGRATION VERIFICATION FAILED: quiz_sessions_token_hash_unique constraint missing or invalid.';
  END IF;

  -- Verify index idx_quiz_sessions_token_hash remains valid and ready
  SELECT (i.indisvalid AND i.indisready) INTO v_index_valid
  FROM pg_index i
  JOIN pg_class ic ON i.indexrelid = ic.oid
  JOIN pg_namespace n ON ic.relnamespace = n.oid
  WHERE n.nspname = 'public'
    AND ic.relname = 'idx_quiz_sessions_token_hash';

  IF v_index_valid IS NOT TRUE THEN
    RAISE EXCEPTION 'POST-MIGRATION VERIFICATION FAILED: idx_quiz_sessions_token_hash index missing or invalid.';
  END IF;

  RAISE NOTICE 'POST-MIGRATION VERIFICATION PASSED: session_token_hash is NOT NULL; indexes and constraints verified.';
END $$;

-- ============================================================================
-- 4. Reload PostgREST Schema Cache
-- ============================================================================
NOTIFY pgrst, 'reload schema';

COMMIT;

