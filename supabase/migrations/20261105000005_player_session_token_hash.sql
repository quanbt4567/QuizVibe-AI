-- ============================================================================
-- Migration: 20261105000005_player_session_token_hash.sql
-- Project:   QuizVibe AI — Phase 4.3 Expand Phase (True Bidirectional Compatibility)
-- Purpose:   1. Ensures pgcrypto is loaded.
--            2. Adds session_token_hash column to public.quiz_sessions.
--            3. Backfills existing plaintext session_token values to SHA-256 hashes.
--            4. Enforces unique constraint and btree index on session_token_hash.
--            5. Installs trigger trg_sync_quiz_sessions_token_hash with full update
--               recalculation, inconsistency correction, and insert synchronization.
--            6. Relaxes voucher_code NOT NULL on public.leads.
-- Note:      DOES NOT DROP session_token. Preserves full zero-downtime bidirectional
--            coexistence between old and new application instances during deployment overlap.
--
-- ============================================================================
-- OPERATIONAL ROLLBACK PROTOCOL & DESTRUCTIVE ACTION WARNING (MANUAL APPROVAL ONLY)
-- ============================================================================
-- CRITICAL WARNING — POTENTIALLY DESTRUCTIVE OPERATION:
-- Dropping session_token_hash is NOT fully lossless once the application layer
-- begins writing hash-only sessions (session_token IS NULL AND session_token_hash IS NOT NULL).
-- In Phase 4.3 Expand mode, pre-existing sessions retain plaintext session_token values, but
-- newer application instances or future contract phases may write sessions with session_token = NULL.
-- Dropping session_token_hash will permanently and irrevocably destroy authentication credentials
-- for any active or completed hash-only sessions!
--
-- MANDATORY PRE-ROLLBACK DIAGNOSTIC QUERY (MUST RUN BEFORE ANY REVERT ACTION):
-- Execute the following query in Supabase SQL Editor:
--
--   SELECT 
--     count(*) AS total_sessions,
--     count(*) FILTER (WHERE session_token IS NOT NULL AND session_token_hash IS NOT NULL) AS dual_token_sessions,
--     count(*) FILTER (WHERE session_token IS NULL AND session_token_hash IS NOT NULL) AS hash_only_sessions,
--     count(*) FILTER (WHERE session_token IS NULL AND session_token_hash IS NULL) AS orphan_sessions
--   FROM public.quiz_sessions;
--
-- OPERATIONAL TRIAGE PROTOCOL:
-- Case A: hash_only_sessions = 0
--   All active and historical sessions possess a plaintext session_token. Reverting to
--   pre-migration session_token authentication is non-destructive for session credentials.
--
-- Case B: hash_only_sessions > 0
--   STOP! DO NOT DROP session_token_hash IMMEDIATELY.
--   Dropping the column will permanently break active gameplay and authentication for players
--   in those hash-only sessions.
--   Required triage steps before column drop:
--     1. Session Draining: Wait for active hash-only sessions to finish or expire naturally
--        (quiz sessions have a configured TTL, typically 300 seconds / 5 minutes).
--     2. Forced Expiration: If immediate emergency rollback is mandated, explicitly expire
--        hash-only sessions so clients are redirected to restart rather than left in an
--        unrecoverable state:
--          UPDATE public.quiz_sessions
--          SET status = 'expired'
--          WHERE session_token IS NULL AND session_token_hash IS NOT NULL;
--     3. Stakeholder Approval: An authorized engineering lead must explicitly review the count
--        of affected players and provide written approval before executing reverse DDL.
--
-- STEP-BY-STEP REVERSE DDL (MANUALLY EXECUTED ONLY WITH WRITTEN APPROVAL):
--   BEGIN;
--     -- Step 1: Remove coexistence trigger & trigger function
--     DROP TRIGGER IF EXISTS trg_sync_quiz_sessions_token_hash ON public.quiz_sessions;
--     DROP FUNCTION IF EXISTS public.sync_quiz_sessions_token_hash();
--
--     -- Step 2: Remove dedicated index and unique constraint
--     DROP INDEX IF EXISTS public.idx_quiz_sessions_token_hash;
--     ALTER TABLE public.quiz_sessions DROP CONSTRAINT IF EXISTS quiz_sessions_token_hash_unique;
--
--     -- Step 3: POTENTIALLY DESTRUCTIVE — drop column only after Step B triage & approval
--     ALTER TABLE public.quiz_sessions DROP COLUMN IF EXISTS session_token_hash;
--
--     -- Step 4: leads.voucher_code note
--     -- Restoring NOT NULL requires backfilling any leads created with NULL voucher_code:
--     -- UPDATE public.leads SET voucher_code = 'DEFAULT' WHERE voucher_code IS NULL;
--     -- ALTER TABLE public.leads ALTER COLUMN voucher_code SET NOT NULL;
--   COMMIT;
-- ============================================================================

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 1. Add session_token_hash column to public.quiz_sessions
ALTER TABLE public.quiz_sessions
  ADD COLUMN IF NOT EXISTS session_token_hash TEXT;

-- 2. Populate and reconcile SHA-256 hash for any existing rows that possess a plaintext session_token
-- Reconciles NULL hashes, empty hashes, and any mismatched hashes to encode(<schema>.digest(session_token, 'sha256'), 'hex').
-- Preserves legitimate hash-only rows (session_token IS NULL AND session_token_hash IS NOT NULL).
-- Fails transaction if empty or whitespace session_tokens are detected, enforcing the data-integrity contract.
-- Inspects pgcrypto schema ('public' or 'extensions') and executes a schema-qualified UPDATE avoiding migration search_path reliance.
DO $$
DECLARE
  v_empty_token_count INT;
  v_pgcrypto_schema TEXT;
BEGIN
  -- Check data integrity: reject whitespace/empty tokens
  SELECT count(*) INTO v_empty_token_count
  FROM public.quiz_sessions
  WHERE session_token IS NOT NULL AND length(trim(session_token)) = 0;

  IF v_empty_token_count > 0 THEN
    RAISE EXCEPTION 'Cannot migrate: found % row(s) with empty or whitespace session_token violating data-integrity contract', v_empty_token_count;
  END IF;

  -- Determine pgcrypto extension schema and fail closed if missing or unsupported
  SELECT n.nspname INTO v_pgcrypto_schema
  FROM pg_extension e
  JOIN pg_namespace n ON e.extnamespace = n.oid
  WHERE e.extname = 'pgcrypto';

  IF v_pgcrypto_schema IS NULL THEN
    RAISE EXCEPTION 'Cannot migrate: pgcrypto extension is not installed; cannot proceed with Migration 000005.';
  END IF;

  IF v_pgcrypto_schema NOT IN ('public', 'extensions') THEN
    RAISE EXCEPTION 'Cannot migrate: pgcrypto is installed in unsupported schema "%". Expected "public" or "extensions".', v_pgcrypto_schema;
  END IF;

  -- Execute schema-qualified backfill UPDATE avoiding migration session search_path ambiguity
  EXECUTE format(
    $query$
    UPDATE public.quiz_sessions
    SET session_token_hash = encode(%I.digest(session_token, 'sha256'), 'hex')
    WHERE session_token IS NOT NULL 
      AND length(trim(session_token)) > 0
      AND (
        session_token_hash IS NULL 
        OR length(trim(session_token_hash)) = 0
        OR session_token_hash <> encode(%I.digest(session_token, 'sha256'), 'hex')
      )
    $query$,
    v_pgcrypto_schema,
    v_pgcrypto_schema
  );
END $$;

-- 3. Enforce uniqueness on session_token_hash (scoped strictly to public.quiz_sessions)
DO $$
DECLARE
  v_existing_con RECORD;
  v_cols text[];
BEGIN
  -- Look specifically for constraint named 'quiz_sessions_token_hash_unique' on public.quiz_sessions
  SELECT c.oid, c.contype, c.conrelid, c.conkey
  INTO v_existing_con
  FROM pg_constraint c
  JOIN pg_class t ON c.conrelid = t.oid
  JOIN pg_namespace n ON t.relnamespace = n.oid
  WHERE n.nspname = 'public' 
    AND t.relname = 'quiz_sessions'
    AND c.conname = 'quiz_sessions_token_hash_unique';

  IF FOUND THEN
    -- Check if it is a UNIQUE constraint (contype = 'u') on exactly session_token_hash
    SELECT ARRAY(
      SELECT a.attname::text
      FROM unnest(v_existing_con.conkey) WITH ORDINALITY AS k(attnum, ord)
      JOIN pg_attribute a ON a.attrelid = v_existing_con.conrelid AND a.attnum = k.attnum
      ORDER BY k.ord
    ) INTO v_cols;

    IF v_existing_con.contype <> 'u' OR v_cols <> ARRAY['session_token_hash']::text[] THEN
      RAISE EXCEPTION 'Incompatible constraint quiz_sessions_token_hash_unique already exists on public.quiz_sessions (type: %, columns: %). Cannot proceed with migration.', 
        v_existing_con.contype, v_cols;
    END IF;
    -- Otherwise, exact matching constraint already exists; do nothing.
  ELSE
    -- Constraint does not exist on public.quiz_sessions; add it
    ALTER TABLE public.quiz_sessions
      ADD CONSTRAINT quiz_sessions_token_hash_unique UNIQUE (session_token_hash);
  END IF;
END $$;

-- 4. Create dedicated B-tree index for constant-time hash lookups (strictly scoped and verified)
DO $$
DECLARE
  v_existing_idx RECORD;
  v_cols text[];
  v_verified boolean;
BEGIN
  -- Check if index named 'idx_quiz_sessions_token_hash' exists in public schema
  SELECT 
    ic.oid,
    ic.relname,
    tc.relname AS tablename,
    i.indisvalid,
    i.indisready,
    i.indisunique,
    i.indnkeyatts,
    i.indnatts,
    (SELECT amname FROM pg_am WHERE oid = ic.relam) AS amname,
    pg_get_expr(i.indpred, i.indrelid) AS pred_expr,
    i.indkey,
    i.indrelid
  INTO v_existing_idx
  FROM pg_index i
  JOIN pg_class ic ON i.indexrelid = ic.oid
  JOIN pg_class tc ON i.indrelid = tc.oid
  JOIN pg_namespace tn ON tc.relnamespace = tn.oid
  WHERE tn.nspname = 'public' 
    AND ic.relname = 'idx_quiz_sessions_token_hash';

  IF FOUND THEN
    -- If it belongs to another table, raise clear exception and roll back
    IF v_existing_idx.tablename <> 'quiz_sessions' THEN
      RAISE EXCEPTION 'Index idx_quiz_sessions_token_hash already exists on public.% instead of public.quiz_sessions. Cannot proceed with migration.',
        v_existing_idx.tablename;
    END IF;

    -- Extract ordered key columns
    SELECT ARRAY(
      SELECT a.attname::text
      FROM unnest(v_existing_idx.indkey) WITH ORDINALITY AS k(attnum, ord)
      JOIN pg_attribute a ON a.attrelid = v_existing_idx.indrelid AND a.attnum = k.attnum
      ORDER BY k.ord
    ) INTO v_cols;

    -- Verify catalog state
    IF v_existing_idx.amname <> 'btree'
       OR NOT v_existing_idx.indisvalid
       OR NOT v_existing_idx.indisready
       OR v_existing_idx.indisunique
       OR v_existing_idx.indnkeyatts <> 1
       OR v_existing_idx.indnatts <> 1
       OR v_cols <> ARRAY['session_token_hash']::text[]
       OR v_existing_idx.pred_expr IS NULL
       OR v_existing_idx.pred_expr !~* '^\s*\(+\s*session_token_hash\s+IS\s+NOT\s+NULL\s*\)+\s*$' THEN
      RAISE EXCEPTION 'Incompatible or invalid index idx_quiz_sessions_token_hash exists on public.quiz_sessions (am: %, valid: %, ready: %, unique: %, keyatts: %, natts: %, cols: %, pred: %). Cannot proceed with migration.',
        v_existing_idx.amname, v_existing_idx.indisvalid, v_existing_idx.indisready, v_existing_idx.indisunique,
        v_existing_idx.indnkeyatts, v_existing_idx.indnatts, v_cols, v_existing_idx.pred_expr;
    END IF;
    -- Otherwise, existing index is completely valid and verified; do nothing.
  ELSE
    -- Create index
    CREATE INDEX idx_quiz_sessions_token_hash
      ON public.quiz_sessions (session_token_hash)
      WHERE session_token_hash IS NOT NULL;

    -- Verify the newly created index state immediately
    SELECT (
      i.indisvalid 
      AND i.indisready 
      AND NOT i.indisunique 
      AND i.indnkeyatts = 1 
      AND i.indnatts = 1
      AND (SELECT amname FROM pg_am WHERE oid = ic.relam) = 'btree'
      AND pg_get_expr(i.indpred, i.indrelid) ~* '^\s*\(+\s*session_token_hash\s+IS\s+NOT\s+NULL\s*\)+\s*$'
      AND ARRAY(
        SELECT a.attname::text
        FROM unnest(i.indkey) WITH ORDINALITY AS k(attnum, ord)
        JOIN pg_attribute a ON a.attrelid = tc.oid AND a.attnum = k.attnum
        ORDER BY k.ord
      ) = ARRAY['session_token_hash']::text[]
    )
    INTO v_verified
    FROM pg_index i
    JOIN pg_class ic ON i.indexrelid = ic.oid
    JOIN pg_class tc ON i.indrelid = tc.oid
    JOIN pg_namespace tn ON tc.relnamespace = tn.oid
    WHERE tn.nspname = 'public' 
      AND tc.relname = 'quiz_sessions' 
      AND ic.relname = 'idx_quiz_sessions_token_hash';

    IF NOT COALESCE(v_verified, FALSE) THEN
      RAISE EXCEPTION 'Failed to verify index idx_quiz_sessions_token_hash after creation on public.quiz_sessions.';
    END IF;
  END IF;
END $$;

-- 5. Install database-level synchronization trigger for bidirectional coexistence
-- Synchronizes session_token_hash whenever session_token is inserted or updated.
-- Guarantees cryptographic consistency: recalculates hash if token changes or if an
-- inconsistent hash was supplied, while preserving hash-only rows when session_token is NULL.
-- Uses schema-qualified digest call (extensions.digest or public.digest) based on installed
-- pgcrypto schema to prevent search_path shadowing, while keeping exact search_path contract.
DO $$
DECLARE
  v_pgcrypto_schema text;
BEGIN
  SELECT n.nspname INTO v_pgcrypto_schema
  FROM pg_extension e
  JOIN pg_namespace n ON e.extnamespace = n.oid
  WHERE e.extname = 'pgcrypto';

  IF v_pgcrypto_schema = 'extensions' THEN
    EXECUTE $func$
      CREATE OR REPLACE FUNCTION public.sync_quiz_sessions_token_hash()
      RETURNS TRIGGER
      LANGUAGE plpgsql
      SECURITY DEFINER
      SET search_path = public, extensions
      AS $body$
      DECLARE
        v_computed_hash TEXT;
      BEGIN
        IF NEW.session_token IS NOT NULL THEN
          IF length(trim(NEW.session_token)) = 0 THEN
            RAISE EXCEPTION 'session_token cannot be empty or whitespace';
          END IF;

          v_computed_hash := encode(extensions.digest(NEW.session_token, 'sha256'), 'hex');

          IF NEW.session_token_hash IS NULL 
             OR length(trim(NEW.session_token_hash)) = 0 
             OR (TG_OP = 'UPDATE' AND OLD.session_token IS DISTINCT FROM NEW.session_token)
             OR (NEW.session_token_hash <> v_computed_hash) THEN
            NEW.session_token_hash := v_computed_hash;
          END IF;
        END IF;

        RETURN NEW;
      END;
      $body$;
    $func$;
  ELSIF v_pgcrypto_schema = 'public' THEN
    EXECUTE $func$
      CREATE OR REPLACE FUNCTION public.sync_quiz_sessions_token_hash()
      RETURNS TRIGGER
      LANGUAGE plpgsql
      SECURITY DEFINER
      SET search_path = public, extensions
      AS $body$
      DECLARE
        v_computed_hash TEXT;
      BEGIN
        IF NEW.session_token IS NOT NULL THEN
          IF length(trim(NEW.session_token)) = 0 THEN
            RAISE EXCEPTION 'session_token cannot be empty or whitespace';
          END IF;

          v_computed_hash := encode(public.digest(NEW.session_token, 'sha256'), 'hex');

          IF NEW.session_token_hash IS NULL 
             OR length(trim(NEW.session_token_hash)) = 0 
             OR (TG_OP = 'UPDATE' AND OLD.session_token IS DISTINCT FROM NEW.session_token)
             OR (NEW.session_token_hash <> v_computed_hash) THEN
            NEW.session_token_hash := v_computed_hash;
          END IF;
        END IF;

        RETURN NEW;
      END;
      $body$;
    $func$;
  ELSE
    RAISE EXCEPTION 'Cannot configure trigger: pgcrypto is installed in unsupported schema "%". Expected "public" or "extensions".', v_pgcrypto_schema;
  END IF;
END $$;

DROP TRIGGER IF EXISTS trg_sync_quiz_sessions_token_hash ON public.quiz_sessions;
CREATE TRIGGER trg_sync_quiz_sessions_token_hash
  BEFORE INSERT OR UPDATE ON public.quiz_sessions
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_quiz_sessions_token_hash();

-- 6. Support campaigns without configured vouchers by making leads.voucher_code nullable
ALTER TABLE public.leads
  ALTER COLUMN voucher_code DROP NOT NULL;

COMMIT;
