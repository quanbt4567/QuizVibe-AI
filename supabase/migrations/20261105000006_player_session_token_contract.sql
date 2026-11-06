-- ============================================================================
-- Migration: 20261105000006_player_session_token_contract.sql
-- Project:   QuizVibe AI — Phase 4.4 Contract Phase (Cleanup Migration)
-- Purpose:   1. Enforces complete cryptographic hash coverage and SHA-256 format integrity on public.quiz_sessions.
--            2. Verifies catalog integrity of hash constraint, B-tree index, and trigger.
--            3. Safely drops coexistence trigger and synchronization function.
--            4. Drops legacy index idx_quiz_sessions_token and unique constraints.
--            5. Drops legacy plaintext session_token column to achieve token-at-rest protection.
-- Security:  SECURITY DEFINER and trusted search_path verified before trigger removal.
-- Compatibility: Run ONLY after Vercel instances have drained, new application version
--            with ENABLE_LEGACY_SESSION_TOKEN_WRITE=false is confirmed by write telemetry,
--            and baking period has elapsed with zero rollbacks.
-- ============================================================================
-- AUDIT & APPROVAL STATUS:
-- STATUS: DRAFT / PENDING OPERATIONAL DRAINING GATE VERIFICATION.
-- DO NOT MARK APPROVED OR PRODUCTION-READY UNTIL ALL FOUR INDEPENDENT GATES ARE SATISFIED.
-- ============================================================================
-- CRITICAL DATA-INTEGRITY & ROLLBACK WARNING (MANUAL APPROVAL ONLY):
-- Dropping session_token is an IRREVERSIBLE, ONE-WAY cryptographic transition.
-- Original plaintext session tokens CANNOT be reconstructed from SHA-256 hashes.
-- After this migration executes:
-- 1. Rolling back application code to a legacy version that requires plaintext
--    session_token will FAIL IMMEDIATELY.
-- 2. Any subsequent manual attempt to drop session_token_hash will permanently destroy
--    all session credentials for both active and historical quiz players.
-- ============================================================================
-- FOUR INDEPENDENT OPERATIONAL DIMENSIONS (DO NOT CONFUSE OR SUBSTITUTE):
-- 1. Hash Completeness: Verifies data at rest in public.quiz_sessions has 100% valid SHA-256 hashes.
--    (Does NOT prove application instances have stopped writing plaintext tokens).
-- 2. Plaintext-Write Draining: Verifies absence of observable legacy writes in available logs and metrics.
--    NOTE ON SQL TELEMETRY LIMITATION: The multi-timestamp SQL query across created_at, started_at,
--    current_question_started_at, and completed_at ONLY observes specific session lifecycle events.
--    It does NOT prove that no legacy runtime has written or updated session_token during the observation window.
--    Without an engine-level audit log or an auto-updating updated_at trigger on public.quiz_sessions,
--    comprehensive database-level write telemetry cannot be obtained by SQL alone.
-- 3. Vercel Deployment Routing: Verifies edge traffic routing assigns 100% of production traffic
--    to the deployment ID configured with ENABLE_LEGACY_SESSION_TOKEN_WRITE=false.
--    (Does NOT prove in-flight requests or cold lambdas cannot execute).
-- 4. Expiration of In-Flight Requests & Old Serverless Instances: Allowing max execution timeouts
--    and cloud container recycling intervals (10-30m) to elapse without legacy invocations.
--    (Operational evidence, NOT mathematical proof that every micro-VM container has vanished).
-- ============================================================================
-- CONSERVATIVE STOP CONDITION:
-- If any write with session_token IS NOT NULL is observed, or Vercel routing telemetry shows any
-- traffic to older deployments, or evidence of draining is inconclusive or ambiguous:
-- STOP IMMEDIATELY. DO NOT EXECUTE THIS MIGRATION.
-- Keep the database in STATE B (Expand Mode), the current Expand Mode compatibility state.
-- ============================================================================

BEGIN;

DO $$
DECLARE
  v_pgcrypto_schema TEXT;
  v_invalid_hash_count INT;
  v_inconsistent_hash_count INT;
  v_empty_token_count INT;
  v_duplicate_hash_count INT;
  v_malformed_hash_count INT;
  v_existing_con RECORD;
  v_existing_idx RECORD;
  v_existing_tg RECORD;
  v_existing_fn RECORD;
  v_cols text[];
BEGIN
  -- =========================================================================
  -- 1. Detect and Verify pgcrypto Extension Schema
  -- =========================================================================
  SELECT n.nspname INTO v_pgcrypto_schema
  FROM pg_extension e
  JOIN pg_namespace n ON e.extnamespace = n.oid
  WHERE e.extname = 'pgcrypto';

  IF v_pgcrypto_schema IS NULL THEN
    RAISE EXCEPTION 'CONTRACT MIGRATION ABORTED: pgcrypto extension is not installed; cannot verify cryptographic consistency.';
  END IF;

  IF v_pgcrypto_schema NOT IN ('public', 'extensions') THEN
    RAISE EXCEPTION 'CONTRACT MIGRATION ABORTED: pgcrypto is installed in unsupported schema "%". Expected "public" or "extensions".', v_pgcrypto_schema;
  END IF;

  -- =========================================================================
  -- 2. Complete Hash Coverage & Data Anomaly Checks
  -- =========================================================================
  -- Check 2a: Require EVERY row in public.quiz_sessions (regardless of status or plaintext presence)
  -- to possess a valid, non-null, non-empty session_token_hash.
  SELECT count(*) INTO v_invalid_hash_count
  FROM public.quiz_sessions
  WHERE session_token_hash IS NULL OR length(trim(session_token_hash)) = 0;

  IF v_invalid_hash_count > 0 THEN
    RAISE EXCEPTION 'CONTRACT MIGRATION ABORTED: Found % row(s) with NULL, empty, or whitespace session_token_hash. Every session row must possess a valid hash before dropping session_token.', v_invalid_hash_count;
  END IF;

  -- Check 2b: Fail closed if corrupt empty or whitespace plaintext session_tokens exist
  SELECT count(*) INTO v_empty_token_count
  FROM public.quiz_sessions
  WHERE session_token IS NOT NULL AND length(trim(session_token)) = 0;

  IF v_empty_token_count > 0 THEN
    RAISE EXCEPTION 'CONTRACT MIGRATION ABORTED: Found % row(s) with empty or whitespace session_token violating data integrity contract.', v_empty_token_count;
  END IF;

  -- Check 2c: Cryptographic consistency between plaintext session_token and session_token_hash
  -- Dynamic SQL qualified with detected pgcrypto schema (avoids search_path reliance)
  EXECUTE format(
    $query$
    SELECT count(*)
    FROM public.quiz_sessions
    WHERE session_token IS NOT NULL 
      AND length(trim(session_token)) > 0
      AND session_token_hash <> encode(%I.digest(session_token, 'sha256'), 'hex')
    $query$,
    v_pgcrypto_schema
  ) INTO v_inconsistent_hash_count;

  IF v_inconsistent_hash_count > 0 THEN
    RAISE EXCEPTION 'CONTRACT MIGRATION ABORTED: Found % row(s) where session_token_hash does not match %.digest(session_token, ''sha256'').', v_inconsistent_hash_count, v_pgcrypto_schema;
  END IF;

  -- Check 2d: Assert zero duplicate non-null session_token_hash values exist
  SELECT count(*) INTO v_duplicate_hash_count
  FROM (
    SELECT session_token_hash
    FROM public.quiz_sessions
    WHERE session_token_hash IS NOT NULL
    GROUP BY session_token_hash
    HAVING count(*) > 1
  ) dups;

  IF v_duplicate_hash_count > 0 THEN
    RAISE EXCEPTION 'CONTRACT MIGRATION ABORTED: Found % duplicate session_token_hash value(s) in public.quiz_sessions.', v_duplicate_hash_count;
  END IF;

  -- Check 2e: SHA-256 Hash Format Integrity Gate across ALL rows
  -- Verifies every session_token_hash conforms to exactly 64 lowercase hexadecimal characters,
  -- matching canonical SHA-256 hex encoding produced by encode(digest(..., 'sha256'), 'hex').
  -- Applies to ALL rows regardless of session status (in_progress, completed, expired) and
  -- regardless of whether session_token is NULL (protecting hash-only rows) or present.
  SELECT count(*) INTO v_malformed_hash_count
  FROM public.quiz_sessions
  WHERE session_token_hash !~ '^[0-9a-f]{64}$';

  IF v_malformed_hash_count > 0 THEN
    RAISE EXCEPTION 'CONTRACT MIGRATION ABORTED: Found % row(s) with malformed session_token_hash. Every session_token_hash must be exactly 64 lowercase hexadecimal characters matching canonical SHA-256 format (^[0-9a-f]{64}$).', v_malformed_hash_count;
  END IF;

  -- =========================================================================
  -- 3. Constraint and Index Integrity Preconditions
  -- =========================================================================
  -- Check 3a: Verify quiz_sessions_token_hash_unique constraint
  SELECT c.oid, c.contype, c.convalidated, c.conrelid, c.conkey
  INTO v_existing_con
  FROM pg_constraint c
  JOIN pg_class t ON c.conrelid = t.oid
  JOIN pg_namespace n ON t.relnamespace = n.oid
  WHERE n.nspname = 'public'
    AND t.relname = 'quiz_sessions'
    AND c.conname = 'quiz_sessions_token_hash_unique';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'CONTRACT MIGRATION ABORTED: Unique constraint quiz_sessions_token_hash_unique is missing on public.quiz_sessions.';
  END IF;

  SELECT ARRAY(
    SELECT a.attname::text
    FROM unnest(v_existing_con.conkey) WITH ORDINALITY AS k(attnum, ord)
    JOIN pg_attribute a ON a.attrelid = v_existing_con.conrelid AND a.attnum = k.attnum
    ORDER BY k.ord
  ) INTO v_cols;

  IF v_existing_con.contype <> 'u' 
     OR NOT v_existing_con.convalidated 
     OR v_cols <> ARRAY['session_token_hash']::text[] THEN
    RAISE EXCEPTION 'CONTRACT MIGRATION ABORTED: Incompatible or unvalidated constraint quiz_sessions_token_hash_unique on public.quiz_sessions (contype: %, validated: %, cols: %).',
      v_existing_con.contype, v_existing_con.convalidated, v_cols;
  END IF;

  -- Check 3b: Verify partial B-tree index idx_quiz_sessions_token_hash
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
  JOIN pg_namespace in_ns ON ic.relnamespace = in_ns.oid
  WHERE tn.nspname = 'public' 
    AND in_ns.nspname = 'public'
    AND ic.relname = 'idx_quiz_sessions_token_hash';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'CONTRACT MIGRATION ABORTED: Index idx_quiz_sessions_token_hash is missing on public.quiz_sessions.';
  END IF;

  IF v_existing_idx.tablename <> 'quiz_sessions' THEN
    RAISE EXCEPTION 'CONTRACT MIGRATION ABORTED: Index idx_quiz_sessions_token_hash belongs to public.% instead of public.quiz_sessions.', v_existing_idx.tablename;
  END IF;

  SELECT ARRAY(
    SELECT a.attname::text
    FROM unnest(v_existing_idx.indkey) WITH ORDINALITY AS k(attnum, ord)
    JOIN pg_attribute a ON a.attrelid = v_existing_idx.indrelid AND a.attnum = k.attnum
    ORDER BY k.ord
  ) INTO v_cols;

  IF v_existing_idx.amname <> 'btree'
     OR NOT v_existing_idx.indisvalid
     OR NOT v_existing_idx.indisready
     OR v_existing_idx.indisunique
     OR v_existing_idx.indnkeyatts <> 1
     OR v_existing_idx.indnatts <> 1
     OR v_cols <> ARRAY['session_token_hash']::text[]
     OR v_existing_idx.pred_expr IS NULL
     OR v_existing_idx.pred_expr !~* '^\s*\(+\s*session_token_hash\s+IS\s+NOT\s+NULL\s*\)+\s*$' THEN
    RAISE EXCEPTION 'CONTRACT MIGRATION ABORTED: Incompatible or invalid index idx_quiz_sessions_token_hash on public.quiz_sessions (am: %, valid: %, ready: %, unique: %, keyatts: %, natts: %, cols: %, pred: %).',
      v_existing_idx.amname, v_existing_idx.indisvalid, v_existing_idx.indisready, v_existing_idx.indisunique,
      v_existing_idx.indnkeyatts, v_existing_idx.indnatts, v_cols, v_existing_idx.pred_expr;
  END IF;

  -- =========================================================================
  -- 4. Trigger & Trigger Function Preconditions
  -- =========================================================================
  -- Check 4a: Inspect trigger trg_sync_quiz_sessions_token_hash
  SELECT 
    tg.oid,
    tg.tgenabled,
    tg.tgisinternal,
    tg.tgtype,
    p.proname,
    fn.nspname AS fn_schema,
    pg_get_triggerdef(tg.oid) AS triggerdef
  INTO v_existing_tg
  FROM pg_trigger tg
  JOIN pg_class tc ON tg.tgrelid = tc.oid
  JOIN pg_namespace tn ON tc.relnamespace = tn.oid
  LEFT JOIN pg_proc p ON tg.tgfoid = p.oid
  LEFT JOIN pg_namespace fn ON p.pronamespace = fn.oid
  WHERE tn.nspname = 'public' 
    AND tc.relname = 'quiz_sessions'
    AND tg.tgname = 'trg_sync_quiz_sessions_token_hash';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'CONTRACT MIGRATION ABORTED: Trigger trg_sync_quiz_sessions_token_hash is missing on public.quiz_sessions.';
  END IF;

  IF v_existing_tg.tgenabled NOT IN ('O', 'A')
     OR v_existing_tg.tgisinternal
     OR v_existing_tg.fn_schema <> 'public'
     OR v_existing_tg.proname <> 'sync_quiz_sessions_token_hash'
     OR v_existing_tg.tgtype <> 23
     OR v_existing_tg.triggerdef !~* 'BEFORE\s+INSERT\s+OR\s+UPDATE\s+ON\s+public\.quiz_sessions\s+FOR\s+EACH\s+ROW\s+EXECUTE\s+(FUNCTION|PROCEDURE)\s+(public\.)?sync_quiz_sessions_token_hash\(\)' THEN
    RAISE EXCEPTION 'CONTRACT MIGRATION ABORTED: Trigger trg_sync_quiz_sessions_token_hash has unexpected state or linkage (enabled: %, internal: %, func: %.%, type: %, def: %).',
      v_existing_tg.tgenabled, v_existing_tg.tgisinternal, v_existing_tg.fn_schema, v_existing_tg.proname, v_existing_tg.tgtype, v_existing_tg.triggerdef;
  END IF;

  -- Check 4b: Inspect function public.sync_quiz_sessions_token_hash()
  SELECT 
    p.oid,
    p.prosecdef,
    EXISTS (
      SELECT 1 FROM unnest(p.proconfig) AS cfg
      WHERE cfg ~* '^search_path\s*=\s*public\s*,\s*extensions$'
    ) AS search_path_correct
  INTO v_existing_fn
  FROM pg_proc p
  JOIN pg_namespace n ON p.pronamespace = n.oid
  WHERE n.nspname = 'public' 
    AND p.proname = 'sync_quiz_sessions_token_hash';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'CONTRACT MIGRATION ABORTED: Trigger function public.sync_quiz_sessions_token_hash() is missing.';
  END IF;

  IF NOT v_existing_fn.prosecdef OR NOT v_existing_fn.search_path_correct THEN
    RAISE EXCEPTION 'CONTRACT MIGRATION ABORTED: Function public.sync_quiz_sessions_token_hash has invalid security configuration (prosecdef: %, search_path_correct: %).',
      v_existing_fn.prosecdef, v_existing_fn.search_path_correct;
  END IF;
END $$;

-- ============================================================================
-- 5. Destructive Cleanup: Remove Trigger, Function, Index, and Plaintext Column
-- ============================================================================
-- All preconditions verified. Safely retire coexistence synchronization:
DROP TRIGGER trg_sync_quiz_sessions_token_hash ON public.quiz_sessions;
DROP FUNCTION public.sync_quiz_sessions_token_hash();

-- Drop legacy plaintext partial index
DROP INDEX IF EXISTS public.idx_quiz_sessions_token;

-- Drop legacy plaintext unique constraint if present
ALTER TABLE public.quiz_sessions DROP CONSTRAINT IF EXISTS quiz_sessions_session_token_key;
ALTER TABLE public.quiz_sessions DROP CONSTRAINT IF EXISTS quiz_sessions_token_key;

-- Complete token-at-rest protection: drop plaintext column
ALTER TABLE public.quiz_sessions
  DROP COLUMN IF EXISTS session_token;

-- ============================================================================
-- 6. Post-DDL Invariant Verification (Pre-Commit Fail-Closed Gate)
-- ============================================================================
DO $$
BEGIN
  -- Verify session_token column was dropped
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'quiz_sessions'
      AND column_name = 'session_token'
  ) THEN
    RAISE EXCEPTION 'POST-MIGRATION VERIFICATION FAILED: session_token column still exists in public.quiz_sessions.';
  END IF;

  -- Verify session_token_hash column is intact
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'quiz_sessions'
      AND column_name = 'session_token_hash'
  ) THEN
    RAISE EXCEPTION 'POST-MIGRATION VERIFICATION FAILED: session_token_hash column is missing from public.quiz_sessions.';
  END IF;

  -- Verify unique constraint remains intact
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint c
    JOIN pg_class t ON c.conrelid = t.oid
    JOIN pg_namespace n ON t.relnamespace = n.oid
    WHERE n.nspname = 'public'
      AND t.relname = 'quiz_sessions'
      AND c.conname = 'quiz_sessions_token_hash_unique'
      AND c.contype = 'u'
      AND c.convalidated
  ) THEN
    RAISE EXCEPTION 'POST-MIGRATION VERIFICATION FAILED: quiz_sessions_token_hash_unique constraint is missing or invalid.';
  END IF;

  -- Verify index remains intact
  IF NOT EXISTS (
    SELECT 1 FROM pg_index i
    JOIN pg_class ic ON i.indexrelid = ic.oid
    JOIN pg_class tc ON i.indrelid = tc.oid
    JOIN pg_namespace tn ON tc.relnamespace = tn.oid
    JOIN pg_namespace in_ns ON ic.relnamespace = in_ns.oid
    WHERE tn.nspname = 'public'
      AND tc.relname = 'quiz_sessions'
      AND in_ns.nspname = 'public'
      AND ic.relname = 'idx_quiz_sessions_token_hash'
      AND i.indisvalid
      AND i.indisready
  ) THEN
    RAISE EXCEPTION 'POST-MIGRATION VERIFICATION FAILED: idx_quiz_sessions_token_hash index is missing or invalid.';
  END IF;

  RAISE NOTICE 'MIGRATION 000006 SUCCESS: session_token dropped; hash column, index, and constraint verified.';
END $$;

COMMIT;
