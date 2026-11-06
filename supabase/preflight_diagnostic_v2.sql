-- ============================================================================
-- QuizVibe AI: Hardened Supabase Migration Preflight Diagnostic (v2 - Phase 5.2.5)
-- Phase: 5.2.5 — Expand/Contract Semantic Correction & Final PostgreSQL Preflight
-- Mode:  STRICT READ-ONLY (Safe to execute at any time in Supabase SQL Editor)
-- Purpose: Fail-closed PostgreSQL catalog integrity verification covering exact
--          relation scoping, trigger timing/events/definitions, exact function
--          search_path ("public, extensions"), index access methods/validity/readiness/
--          predicates, constraint validation, safe pgcrypto digest execution, and
--          legitimate hash-only row semantics in Expand compatibility mode.
-- Safety:  Guaranteed read-only (zero DDL/DML mutations). All INTO targets and
--          variables verified. Explicit casting (a.attname::text) and typed array
--          literals (::text[]) prevent PostgreSQL operator 42883 (name[] = text[]).
--          Clean pre-migration STATE A strictly distinguishes between absent indexes
--          versus invalid or malformed indexes and enforces digest resolution.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. pgcrypto Extension & Schema Compatibility Inspection
-- ----------------------------------------------------------------------------
SELECT 
  e.extname AS extension_name,
  n.nspname AS extension_schema,
  e.extversion AS extension_version,
  CASE 
    WHEN n.nspname IN ('public', 'extensions') THEN 'COMPATIBLE (Resolvable by trigger search_path = public, extensions)'
    ELSE 'INCOMPATIBLE (Trigger search_path cannot resolve unqualified digest())'
  END AS search_path_compatibility
FROM pg_extension e
JOIN pg_namespace n ON n.oid = e.extnamespace
WHERE e.extname = 'pgcrypto';

-- ----------------------------------------------------------------------------
-- 2. Required Core Tables Inspection (Exact Schema: public)
-- ----------------------------------------------------------------------------
SELECT 
  t.expected_table,
  CASE WHEN it.table_name IS NOT NULL THEN 'PRESENT' ELSE 'MISSING' END AS presence_status
FROM (
  VALUES 
    ('campaigns'),
    ('campaign_questions'),
    ('vouchers'),
    ('admin_sessions'),
    ('quiz_sessions'),
    ('leads')
) AS t(expected_table)
LEFT JOIN information_schema.tables it 
  ON it.table_schema = 'public' AND it.table_name = t.expected_table
ORDER BY t.expected_table;

-- ----------------------------------------------------------------------------
-- 3. public.quiz_sessions Columns Inspection
-- ----------------------------------------------------------------------------
SELECT 
  column_name,
  data_type,
  is_nullable,
  column_default,
  CASE 
    WHEN column_name IN ('session_token', 'current_question_index', 'current_question_started_at') THEN 'PHASE_4_COLUMN'
    WHEN column_name = 'session_token_hash' THEN 'PHASE_5_HASH_COLUMN'
    ELSE 'BASE_COLUMN'
  END AS classification
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'quiz_sessions'
ORDER BY ordinal_position;

-- ----------------------------------------------------------------------------
-- 4. public.leads.voucher_code Nullability Inspection
-- ----------------------------------------------------------------------------
SELECT 
  column_name,
  data_type,
  is_nullable,
  CASE 
    WHEN is_nullable = 'NO' THEN 'ORIGINAL PRE-MIGRATION (NOT NULL - Migration 000001)'
    WHEN is_nullable = 'YES' THEN 'EXPANDED POST-MIGRATION (NULLABLE - Migration 000005)'
    ELSE 'UNKNOWN'
  END AS nullability_contract
FROM information_schema.columns
WHERE table_schema = 'public' 
  AND table_name = 'leads' 
  AND column_name = 'voucher_code';

-- ----------------------------------------------------------------------------
-- 5. Catalog-Level Constraint Validation on public.quiz_sessions
-- ----------------------------------------------------------------------------
SELECT 
  c.conname AS constraint_name,
  c.contype AS constraint_type,
  c.convalidated AS is_validated,
  ARRAY(
    SELECT a.attname::text 
    FROM unnest(c.conkey) WITH ORDINALITY AS k(attnum, ord)
    JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = k.attnum
    ORDER BY k.ord
  ) AS constrained_columns,
  pg_get_constraintdef(c.oid) AS constraint_definition
FROM pg_constraint c
JOIN pg_class t ON c.conrelid = t.oid
JOIN pg_namespace n ON t.relnamespace = n.oid
WHERE n.nspname = 'public' 
  AND t.relname = 'quiz_sessions'
ORDER BY c.conname;

-- ----------------------------------------------------------------------------
-- 6. Catalog-Level Index State & Definition on public.quiz_sessions
-- ----------------------------------------------------------------------------
SELECT 
  ic.relname AS index_name,
  (SELECT amname FROM pg_am WHERE oid = ic.relam) AS access_method,
  i.indisvalid AS is_valid,
  i.indisready AS is_ready,
  i.indisunique AS is_unique,
  i.indnkeyatts AS key_column_count,
  i.indnatts AS total_column_count,
  ARRAY(
    SELECT a.attname::text 
    FROM unnest(i.indkey) WITH ORDINALITY AS k(attnum, ord)
    JOIN pg_attribute a ON a.attrelid = tc.oid AND a.attnum = k.attnum
    ORDER BY k.ord
  ) AS indexed_columns,
  pg_get_expr(i.indpred, i.indrelid) AS predicate,
  pg_get_indexdef(ic.oid) AS full_index_definition
FROM pg_index i
JOIN pg_class ic ON i.indexrelid = ic.oid
JOIN pg_class tc ON i.indrelid = tc.oid
JOIN pg_namespace tn ON tc.relnamespace = tn.oid
WHERE tn.nspname = 'public'
  AND tc.relname = 'quiz_sessions'
  AND ic.relname IN ('idx_quiz_sessions_token', 'idx_quiz_sessions_token_hash', 'idx_quiz_sessions_campaign_status')
ORDER BY ic.relname;

-- ----------------------------------------------------------------------------
-- 7. Trigger & Trigger-to-Function Linkage on public.quiz_sessions
-- ----------------------------------------------------------------------------
SELECT 
  tg.tgname AS trigger_name,
  tn.nspname AS table_schema,
  tc.relname AS table_name,
  tg.tgenabled AS trigger_enabled_code,
  NOT tg.tgisinternal AS is_not_internal,
  ((tg.tgtype & 1) = 1) AS is_row_level,
  ((tg.tgtype & 2) = 2) AS is_before,
  ((tg.tgtype & 4) = 4) AS is_insert,
  ((tg.tgtype & 16) = 16) AS is_update,
  fn.nspname AS function_schema,
  p.proname AS function_name,
  p.prosecdef AS is_security_definer,
  p.proconfig AS function_configs,
  pg_get_triggerdef(tg.oid) AS full_trigger_definition,
  CASE 
    WHEN (p.proconfig IS NOT NULL AND EXISTS (SELECT 1 FROM unnest(p.proconfig) cfg WHERE cfg ~* '^search_path\s*=\s*public\s*,\s*extensions$'))
      THEN 'VALID (Exact trusted: public, extensions)'
    ELSE 'INVALID search_path'
  END AS search_path_status
FROM pg_trigger tg
JOIN pg_class tc ON tg.tgrelid = tc.oid
JOIN pg_namespace tn ON tc.relnamespace = tn.oid
JOIN pg_proc p ON tg.tgfoid = p.oid
JOIN pg_namespace fn ON p.pronamespace = fn.oid
WHERE tn.nspname = 'public' 
  AND tc.relname = 'quiz_sessions'
  AND tg.tgname = 'trg_sync_quiz_sessions_token_hash';

-- ----------------------------------------------------------------------------
-- 8. Schema Privilege Audit (SECURITY DEFINER search_path safety check)
-- Inspects pg_namespace.nspacl via aclexplode() accounting for PUBLIC grantee OID (0).
-- Separately evaluates:
--   a) Explicit CREATE granted directly to pseudo-role PUBLIC (grantee = 0).
--   b) Explicit CREATE granted directly to role anon.
--   c) Explicit CREATE granted directly to role authenticated.
--   d) Effective CREATE privileges for roles anon and authenticated (inheriting from PUBLIC/roles).
-- Note on ACL Semantics:
--   - When nspacl IS NULL, acldefault('n', n.nspowner) evaluates PostgreSQL baseline defaults.
--   - In PostgreSQL 15+, default schema ACL grants ALL to owner and NO privileges to PUBLIC.
--   - A false result here confirms no explicit or effective CREATE grant is present, but true
--     SECURITY DEFINER hygiene additionally requires qualified function calls (extensions.digest).
-- ----------------------------------------------------------------------------
SELECT 
  n.nspname AS schema_name,
  -- 1. Explicit CREATE granted to pseudo-role PUBLIC (grantee OID 0 in pg_shdescription/aclexplode)
  EXISTS (
    SELECT 1 
    FROM aclexplode(COALESCE(n.nspacl, acldefault('n', n.nspowner))) a
    WHERE a.grantee = 0 AND a.privilege_type = 'CREATE'
  ) AS public_pseudo_role_has_explicit_create,
  -- 2. Explicit CREATE granted directly to role anon
  EXISTS (
    SELECT 1 
    FROM aclexplode(COALESCE(n.nspacl, acldefault('n', n.nspowner))) a
    JOIN pg_roles r ON a.grantee = r.oid
    WHERE r.rolname = 'anon' AND a.privilege_type = 'CREATE'
  ) AS anon_has_explicit_create,
  -- 3. Explicit CREATE granted directly to role authenticated
  EXISTS (
    SELECT 1 
    FROM aclexplode(COALESCE(n.nspacl, acldefault('n', n.nspowner))) a
    JOIN pg_roles r ON a.grantee = r.oid
    WHERE r.rolname = 'authenticated' AND a.privilege_type = 'CREATE'
  ) AS authenticated_has_explicit_create,
  -- 4. Effective CREATE privilege for role anon (evaluates role existence before checking)
  COALESCE((
    SELECT has_schema_privilege(r.oid, n.oid, 'CREATE')
    FROM pg_roles r
    WHERE r.rolname = 'anon'
  ), FALSE) AS anon_has_effective_create,
  -- 5. Effective CREATE privilege for role authenticated (evaluates role existence before checking)
  COALESCE((
    SELECT has_schema_privilege(r.oid, n.oid, 'CREATE')
    FROM pg_roles r
    WHERE r.rolname = 'authenticated'
  ), FALSE) AS authenticated_has_effective_create,
  -- 6. Exploded ACL summary of all grantees on public schema
  COALESCE(
    (
      SELECT string_agg(
        format('grantee=%s,priv=%s,grantable=%s', 
          CASE WHEN a.grantee = 0 THEN 'PUBLIC' ELSE COALESCE(gr.rolname, a.grantee::text) END,
          a.privilege_type,
          a.is_grantable
        ), '; '
      )
      FROM aclexplode(COALESCE(n.nspacl, acldefault('n', n.nspowner))) a
      LEFT JOIN pg_roles gr ON a.grantee = gr.oid
    ),
    'DEFAULT_OWNER_ONLY'
  ) AS schema_acl_summary
FROM pg_namespace n
WHERE n.nspname = 'public';

-- ----------------------------------------------------------------------------
-- 9. Hardened Fail-Closed State Classifier (PL/pgSQL Block)
-- ----------------------------------------------------------------------------
DO $$
DECLARE
  -- Table checks
  v_missing_table_count INT := 0;
  v_missing_tables TEXT;

  -- Column checks on public.quiz_sessions
  v_missing_base_col_count INT := 0;
  v_missing_base_cols TEXT;
  v_phase4_col_count INT := 0;
  v_phase4_session_token_def_correct BOOLEAN := FALSE;
  v_phase4_question_index_def_correct BOOLEAN := FALSE;
  v_phase4_started_at_def_correct BOOLEAN := FALSE;
  v_phase4_defs_correct BOOLEAN := FALSE;
  v_has_hash_col BOOLEAN := FALSE;

  -- Nullability on public.leads.voucher_code
  v_has_voucher_code_col BOOLEAN := FALSE;
  v_voucher_code_nullable TEXT;

  -- pgcrypto extension & digest resolution
  v_pgcrypto_installed BOOLEAN := FALSE;
  v_pgcrypto_schema TEXT;
  v_pgcrypto_compatible BOOLEAN := FALSE;
  v_digest_resolvable BOOLEAN := FALSE;
  v_dummy_digest TEXT;

  -- Constraints on public.quiz_sessions
  v_token_con_exists BOOLEAN := FALSE;
  v_token_con_validated BOOLEAN := FALSE;
  v_hash_con_exists BOOLEAN := FALSE;
  v_hash_con_validated BOOLEAN := FALSE;
  v_hash_con_cols_correct BOOLEAN := FALSE;

  -- Indexes on public.quiz_sessions
  v_token_idx_exists BOOLEAN := FALSE;
  v_token_idx_valid BOOLEAN := FALSE;
  v_token_idx_ready BOOLEAN := FALSE;
  v_token_idx_cols_correct BOOLEAN := FALSE;
  v_token_idx_pred_correct BOOLEAN := FALSE;

  v_hash_idx_exists BOOLEAN := FALSE;
  v_hash_idx_valid BOOLEAN := FALSE;
  v_hash_idx_ready BOOLEAN := FALSE;
  v_hash_idx_cols_correct BOOLEAN := FALSE;
  v_hash_idx_pred_correct BOOLEAN := FALSE;

  v_campaign_status_idx_exists BOOLEAN := FALSE;
  v_campaign_status_idx_valid BOOLEAN := FALSE;
  v_campaign_status_idx_ready BOOLEAN := FALSE;
  v_campaign_status_idx_cols_correct BOOLEAN := FALSE;

  -- Trigger & Function linkage
  v_trigger_exists BOOLEAN := FALSE;
  v_trigger_enabled BOOLEAN := FALSE;
  v_trigger_not_internal BOOLEAN := FALSE;
  v_trigger_links_correct_func BOOLEAN := FALSE;
  v_trigger_timing_event_correct BOOLEAN := FALSE;
  v_trigger_def_correct BOOLEAN := FALSE;

  v_func_exists BOOLEAN := FALSE;
  v_func_is_secdef BOOLEAN := FALSE;
  v_func_has_searchpath BOOLEAN := FALSE;

  -- Data consistency counts
  v_null_hash_count INT := 0;
  v_empty_hash_count INT := 0;
  v_mismatch_hash_count INT := 0;
  v_empty_token_count INT := 0;
  v_hash_only_count INT := 0;
  v_mismatch_check_available BOOLEAN := FALSE;

  -- Verdict and summary reporting
  v_is_state_a BOOLEAN := FALSE;
  v_is_state_a4 BOOLEAN := FALSE;
  v_is_state_b BOOLEAN := FALSE;
  v_verdict TEXT := 'STATE C';
  v_verdict_description TEXT := '';
  v_pgcrypto_status TEXT := '';
  v_base_schema_status TEXT := '';
  v_session_token_status TEXT := '';
  v_session_token_hash_status TEXT := '';
  v_index_status TEXT := '';
  v_trigger_status TEXT := '';
  v_hash_anomaly_status TEXT := '';
  v_blocking_reasons TEXT := '';
BEGIN
  -- Pre-initialize session settings to fail-closed defaults
  PERFORM set_config('quizvibe.preflight_verdict', 'STATE C', false);
  PERFORM set_config('quizvibe.preflight_verdict_description', 'STATE C: INCONSISTENT OR INCOMPLETE EXECUTION.', false);
  PERFORM set_config('quizvibe.preflight_pgcrypto_status', 'UNKNOWN', false);
  PERFORM set_config('quizvibe.preflight_base_schema_status', 'UNKNOWN', false);
  PERFORM set_config('quizvibe.preflight_session_token_status', 'UNKNOWN', false);
  PERFORM set_config('quizvibe.preflight_session_token_hash_status', 'UNKNOWN', false);
  PERFORM set_config('quizvibe.preflight_index_status', 'UNKNOWN', false);
  PERFORM set_config('quizvibe.preflight_trigger_status', 'UNKNOWN', false);
  PERFORM set_config('quizvibe.preflight_hash_anomaly_status', 'UNKNOWN', false);
  PERFORM set_config('quizvibe.preflight_blocking_reasons', 'Diagnostic did not complete successfully', false);
  -- =========================================================================
  -- 1. Check required base tables in public schema
  -- =========================================================================
  WITH required AS (
    SELECT unnest(ARRAY['campaigns', 'campaign_questions', 'vouchers', 'admin_sessions', 'quiz_sessions', 'leads']::text[]) AS tbl
  ),
  missing AS (
    SELECT r.tbl 
    FROM required r
    LEFT JOIN information_schema.tables t 
      ON t.table_schema = 'public' AND t.table_name = r.tbl
    WHERE t.table_name IS NULL
  )
  SELECT count(*), string_agg(tbl, ', ') 
  INTO v_missing_table_count, v_missing_tables 
  FROM missing;

  -- =========================================================================
  -- 2. Check public.quiz_sessions base columns
  -- =========================================================================
  WITH required_base_cols AS (
    SELECT unnest(ARRAY[
      'id', 'campaign_id', 'status', 'total_score', 'correct_count', 
      'total_questions', 'time_taken_seconds', 'answers_snapshot', 
      'started_at', 'completed_at', 'created_at'
    ]::text[]) AS col
  ),
  missing_cols AS (
    SELECT r.col
    FROM required_base_cols r
    LEFT JOIN information_schema.columns c
      ON c.table_schema = 'public' AND c.table_name = 'quiz_sessions' AND c.column_name = r.col
    WHERE c.column_name IS NULL
  )
  SELECT count(*), string_agg(col, ', ')
  INTO v_missing_base_col_count, v_missing_base_cols
  FROM missing_cols;

  -- =========================================================================
  -- 3. Check Phase 4 columns and definitions on public.quiz_sessions
  -- =========================================================================
  SELECT count(*) INTO v_phase4_col_count
  FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = 'quiz_sessions'
    AND column_name IN ('session_token', 'current_question_index', 'current_question_started_at');

  -- 3a. session_token: text, nullable YES, no default
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'quiz_sessions'
      AND column_name = 'session_token'
      AND lower(data_type) = 'text'
      AND is_nullable = 'YES'
      AND column_default IS NULL
  ) INTO v_phase4_session_token_def_correct;

  -- 3b. current_question_index: smallint / int2, nullable NO, default 0
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'quiz_sessions'
      AND column_name = 'current_question_index'
      AND (lower(data_type) = 'smallint' OR lower(udt_name) = 'int2')
      AND is_nullable = 'NO'
      AND column_default IS NOT NULL
      AND column_default ~ '^\s*0(\s*::\s*(smallint|int2|integer))?\s*$'
  ) INTO v_phase4_question_index_def_correct;

  -- 3c. current_question_started_at: timestamptz / timestamp with time zone, nullable NO, default now()
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'quiz_sessions'
      AND column_name = 'current_question_started_at'
      AND (lower(data_type) = 'timestamp with time zone' OR lower(udt_name) = 'timestamptz')
      AND is_nullable = 'NO'
      AND column_default IS NOT NULL
      AND column_default ~* '^\s*(now\(\)|CURRENT_TIMESTAMP|pg_catalog\.now\(\))(\s*::\s*(timestamp with time zone|timestamptz))?\s*$'
  ) INTO v_phase4_started_at_def_correct;

  v_phase4_defs_correct := (v_phase4_col_count = 3)
    AND v_phase4_session_token_def_correct
    AND v_phase4_question_index_def_correct
    AND v_phase4_started_at_def_correct;

  -- =========================================================================
  -- 4. Check Phase 5 session_token_hash on public.quiz_sessions
  -- =========================================================================
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'quiz_sessions' AND column_name = 'session_token_hash'
  ) INTO v_has_hash_col;

  -- =========================================================================
  -- 5. Check public.leads.voucher_code
  -- =========================================================================
  SELECT 
    EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'leads' AND column_name = 'voucher_code'),
    COALESCE((SELECT is_nullable FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'leads' AND column_name = 'voucher_code'), 'MISSING')
  INTO v_has_voucher_code_col, v_voucher_code_nullable;

  -- =========================================================================
  -- 6. Check pgcrypto Extension & Safe Function Resolution
  -- =========================================================================
  SELECT 
    EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pgcrypto'),
    (SELECT n.nspname FROM pg_extension e JOIN pg_namespace n ON n.oid = e.extnamespace WHERE e.extname = 'pgcrypto')
  INTO v_pgcrypto_installed, v_pgcrypto_schema;

  IF v_pgcrypto_installed AND (v_pgcrypto_schema IN ('public', 'extensions')) THEN
    v_pgcrypto_compatible := TRUE;
    -- Safely probe digest() resolution inside an isolated sub-block using dollar-quoting
    BEGIN
      IF v_pgcrypto_schema = 'public' THEN
        EXECUTE $dyn$SELECT public.digest('probe', 'sha256')$dyn$ INTO v_dummy_digest;
        v_digest_resolvable := TRUE;
      ELSIF v_pgcrypto_schema = 'extensions' THEN
        EXECUTE $dyn$SELECT extensions.digest('probe', 'sha256')$dyn$ INTO v_dummy_digest;
        v_digest_resolvable := TRUE;
      END IF;
    EXCEPTION WHEN OTHERS THEN
      v_digest_resolvable := FALSE;
    END;
  ELSE
    v_pgcrypto_compatible := FALSE;
    v_digest_resolvable := FALSE;
  END IF;

  -- =========================================================================
  -- 7. Validate Constraints (Catalog-level on public.quiz_sessions)
  -- =========================================================================
  -- 7a. Phase 4 session_token uniqueness invariant
  SELECT 
    EXISTS (
      SELECT 1 
      FROM pg_constraint c
      JOIN pg_class t ON c.conrelid = t.oid
      JOIN pg_namespace n ON t.relnamespace = n.oid
      WHERE n.nspname = 'public' 
        AND t.relname = 'quiz_sessions'
        AND c.contype = 'u'
        AND ARRAY(
          SELECT a.attname::text 
          FROM unnest(c.conkey) WITH ORDINALITY AS k(attnum, ord)
          JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = k.attnum
          ORDER BY k.ord
        ) = ARRAY['session_token']::text[]
    ),
    COALESCE((
      SELECT c.convalidated
      FROM pg_constraint c
      JOIN pg_class t ON c.conrelid = t.oid
      JOIN pg_namespace n ON t.relnamespace = n.oid
      WHERE n.nspname = 'public' 
        AND t.relname = 'quiz_sessions'
        AND c.contype = 'u'
        AND ARRAY(
          SELECT a.attname::text 
          FROM unnest(c.conkey) WITH ORDINALITY AS k(attnum, ord)
          JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = k.attnum
          ORDER BY k.ord
        ) = ARRAY['session_token']::text[]
    ), FALSE)
  INTO v_token_con_exists, v_token_con_validated;

  -- 7b. Phase 5 session_token_hash unique constraint
  SELECT 
    EXISTS (
      SELECT 1 FROM pg_constraint c
      JOIN pg_class t ON c.conrelid = t.oid
      JOIN pg_namespace n ON t.relnamespace = n.oid
      WHERE n.nspname = 'public' AND t.relname = 'quiz_sessions'
        AND c.conname = 'quiz_sessions_token_hash_unique' AND c.contype = 'u'
    ),
    COALESCE((
      SELECT c.convalidated FROM pg_constraint c
      JOIN pg_class t ON c.conrelid = t.oid
      JOIN pg_namespace n ON t.relnamespace = n.oid
      WHERE n.nspname = 'public' AND t.relname = 'quiz_sessions'
        AND c.conname = 'quiz_sessions_token_hash_unique' AND c.contype = 'u'
    ), FALSE),
    COALESCE((
      SELECT ARRAY(
        SELECT a.attname::text 
        FROM unnest(c.conkey) WITH ORDINALITY AS k(attnum, ord)
        JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = k.attnum
        ORDER BY k.ord
      ) = ARRAY['session_token_hash']::text[]
      FROM pg_constraint c
      JOIN pg_class t ON c.conrelid = t.oid
      JOIN pg_namespace n ON t.relnamespace = n.oid
      WHERE n.nspname = 'public' AND t.relname = 'quiz_sessions'
        AND c.conname = 'quiz_sessions_token_hash_unique' AND c.contype = 'u'
    ), FALSE)
  INTO v_hash_con_exists, v_hash_con_validated, v_hash_con_cols_correct;

  -- =========================================================================
  -- 8. Validate Indexes (Catalog-level on public.quiz_sessions)
  -- Uses scalar subqueries with outer SELECT without FROM to guarantee exact 1-row evaluation
  -- =========================================================================
  -- 8a. idx_quiz_sessions_token
  SELECT 
    EXISTS (
      SELECT 1 FROM pg_index i
      JOIN pg_class ic ON i.indexrelid = ic.oid
      JOIN pg_class tc ON i.indrelid = tc.oid
      JOIN pg_namespace tn ON tc.relnamespace = tn.oid
      WHERE tn.nspname = 'public' AND tc.relname = 'quiz_sessions' AND ic.relname = 'idx_quiz_sessions_token'
    ),
    COALESCE((
      SELECT i.indisvalid 
      FROM pg_index i
      JOIN pg_class ic ON i.indexrelid = ic.oid
      JOIN pg_class tc ON i.indrelid = tc.oid
      JOIN pg_namespace tn ON tc.relnamespace = tn.oid
      WHERE tn.nspname = 'public' AND tc.relname = 'quiz_sessions' AND ic.relname = 'idx_quiz_sessions_token'
    ), FALSE),
    COALESCE((
      SELECT (
        i.indisready 
        AND NOT i.indisunique 
        AND i.indnkeyatts = 1 
        AND i.indnatts = 1
        AND (SELECT amname FROM pg_am WHERE oid = ic.relam) = 'btree'
      )
      FROM pg_index i
      JOIN pg_class ic ON i.indexrelid = ic.oid
      JOIN pg_class tc ON i.indrelid = tc.oid
      JOIN pg_namespace tn ON tc.relnamespace = tn.oid
      WHERE tn.nspname = 'public' AND tc.relname = 'quiz_sessions' AND ic.relname = 'idx_quiz_sessions_token'
    ), FALSE),
    COALESCE((
      SELECT ARRAY(
        SELECT a.attname::text 
        FROM unnest(i.indkey) WITH ORDINALITY AS k(attnum, ord)
        JOIN pg_attribute a ON a.attrelid = tc.oid AND a.attnum = k.attnum
        ORDER BY k.ord
      ) = ARRAY['session_token']::text[]
      FROM pg_index i
      JOIN pg_class ic ON i.indexrelid = ic.oid
      JOIN pg_class tc ON i.indrelid = tc.oid
      JOIN pg_namespace tn ON tc.relnamespace = tn.oid
      WHERE tn.nspname = 'public' AND tc.relname = 'quiz_sessions' AND ic.relname = 'idx_quiz_sessions_token'
    ), FALSE),
    COALESCE((
      SELECT pg_get_expr(i.indpred, i.indrelid) ~* '^\s*\(+\s*session_token\s+IS\s+NOT\s+NULL\s*\)+\s*$'
      FROM pg_index i
      JOIN pg_class ic ON i.indexrelid = ic.oid
      JOIN pg_class tc ON i.indrelid = tc.oid
      JOIN pg_namespace tn ON tc.relnamespace = tn.oid
      WHERE tn.nspname = 'public' AND tc.relname = 'quiz_sessions' AND ic.relname = 'idx_quiz_sessions_token'
    ), FALSE)
  INTO v_token_idx_exists, v_token_idx_valid, v_token_idx_ready, v_token_idx_cols_correct, v_token_idx_pred_correct;

  -- 8b. idx_quiz_sessions_token_hash
  SELECT 
    EXISTS (
      SELECT 1 FROM pg_index i
      JOIN pg_class ic ON i.indexrelid = ic.oid
      JOIN pg_class tc ON i.indrelid = tc.oid
      JOIN pg_namespace tn ON tc.relnamespace = tn.oid
      WHERE tn.nspname = 'public' AND tc.relname = 'quiz_sessions' AND ic.relname = 'idx_quiz_sessions_token_hash'
    ),
    COALESCE((
      SELECT i.indisvalid 
      FROM pg_index i
      JOIN pg_class ic ON i.indexrelid = ic.oid
      JOIN pg_class tc ON i.indrelid = tc.oid
      JOIN pg_namespace tn ON tc.relnamespace = tn.oid
      WHERE tn.nspname = 'public' AND tc.relname = 'quiz_sessions' AND ic.relname = 'idx_quiz_sessions_token_hash'
    ), FALSE),
    COALESCE((
      SELECT (
        i.indisready 
        AND NOT i.indisunique 
        AND i.indnkeyatts = 1 
        AND i.indnatts = 1
        AND (SELECT amname FROM pg_am WHERE oid = ic.relam) = 'btree'
      )
      FROM pg_index i
      JOIN pg_class ic ON i.indexrelid = ic.oid
      JOIN pg_class tc ON i.indrelid = tc.oid
      JOIN pg_namespace tn ON tc.relnamespace = tn.oid
      WHERE tn.nspname = 'public' AND tc.relname = 'quiz_sessions' AND ic.relname = 'idx_quiz_sessions_token_hash'
    ), FALSE),
    COALESCE((
      SELECT ARRAY(
        SELECT a.attname::text 
        FROM unnest(i.indkey) WITH ORDINALITY AS k(attnum, ord)
        JOIN pg_attribute a ON a.attrelid = tc.oid AND a.attnum = k.attnum
        ORDER BY k.ord
      ) = ARRAY['session_token_hash']::text[]
      FROM pg_index i
      JOIN pg_class ic ON i.indexrelid = ic.oid
      JOIN pg_class tc ON i.indrelid = tc.oid
      JOIN pg_namespace tn ON tc.relnamespace = tn.oid
      WHERE tn.nspname = 'public' AND tc.relname = 'quiz_sessions' AND ic.relname = 'idx_quiz_sessions_token_hash'
    ), FALSE),
    COALESCE((
      SELECT pg_get_expr(i.indpred, i.indrelid) ~* '^\s*\(+\s*session_token_hash\s+IS\s+NOT\s+NULL\s*\)+\s*$'
      FROM pg_index i
      JOIN pg_class ic ON i.indexrelid = ic.oid
      JOIN pg_class tc ON i.indrelid = tc.oid
      JOIN pg_namespace tn ON tc.relnamespace = tn.oid
      WHERE tn.nspname = 'public' AND tc.relname = 'quiz_sessions' AND ic.relname = 'idx_quiz_sessions_token_hash'
    ), FALSE)
  INTO v_hash_idx_exists, v_hash_idx_valid, v_hash_idx_ready, v_hash_idx_cols_correct, v_hash_idx_pred_correct;

  -- 8c. idx_quiz_sessions_campaign_status
  SELECT 
    EXISTS (
      SELECT 1 FROM pg_index i
      JOIN pg_class ic ON i.indexrelid = ic.oid
      JOIN pg_class tc ON i.indrelid = tc.oid
      JOIN pg_namespace tn ON tc.relnamespace = tn.oid
      WHERE tn.nspname = 'public' AND tc.relname = 'quiz_sessions' AND ic.relname = 'idx_quiz_sessions_campaign_status'
    ),
    COALESCE((
      SELECT i.indisvalid 
      FROM pg_index i
      JOIN pg_class ic ON i.indexrelid = ic.oid
      JOIN pg_class tc ON i.indrelid = tc.oid
      JOIN pg_namespace tn ON tc.relnamespace = tn.oid
      WHERE tn.nspname = 'public' AND tc.relname = 'quiz_sessions' AND ic.relname = 'idx_quiz_sessions_campaign_status'
    ), FALSE),
    COALESCE((
      SELECT (
        i.indisready 
        AND NOT i.indisunique 
        AND i.indnkeyatts = 2 
        AND i.indnatts = 2
        AND i.indpred IS NULL
        AND (SELECT amname FROM pg_am WHERE oid = ic.relam) = 'btree'
      )
      FROM pg_index i
      JOIN pg_class ic ON i.indexrelid = ic.oid
      JOIN pg_class tc ON i.indrelid = tc.oid
      JOIN pg_namespace tn ON tc.relnamespace = tn.oid
      WHERE tn.nspname = 'public' AND tc.relname = 'quiz_sessions' AND ic.relname = 'idx_quiz_sessions_campaign_status'
    ), FALSE),
    COALESCE((
      SELECT ARRAY(
        SELECT a.attname::text 
        FROM unnest(i.indkey) WITH ORDINALITY AS k(attnum, ord)
        JOIN pg_attribute a ON a.attrelid = tc.oid AND a.attnum = k.attnum
        ORDER BY k.ord
      ) = ARRAY['campaign_id', 'status']::text[]
      FROM pg_index i
      JOIN pg_class ic ON i.indexrelid = ic.oid
      JOIN pg_class tc ON i.indrelid = tc.oid
      JOIN pg_namespace tn ON tc.relnamespace = tn.oid
      WHERE tn.nspname = 'public' AND tc.relname = 'quiz_sessions' AND ic.relname = 'idx_quiz_sessions_campaign_status'
    ), FALSE)
  INTO v_campaign_status_idx_exists, v_campaign_status_idx_valid, v_campaign_status_idx_ready, v_campaign_status_idx_cols_correct;

  -- =========================================================================
  -- 9. Validate Trigger & Trigger-to-Function Linkage
  -- =========================================================================
  SELECT 
    EXISTS (
      SELECT 1 FROM pg_trigger tg
      JOIN pg_class tc ON tg.tgrelid = tc.oid
      JOIN pg_namespace tn ON tc.relnamespace = tn.oid
      WHERE tn.nspname = 'public' AND tc.relname = 'quiz_sessions'
        AND tg.tgname = 'trg_sync_quiz_sessions_token_hash'
    ),
    COALESCE((
      SELECT tg.tgenabled IN ('O', 'A') FROM pg_trigger tg
      JOIN pg_class tc ON tg.tgrelid = tc.oid
      JOIN pg_namespace tn ON tc.relnamespace = tn.oid
      WHERE tn.nspname = 'public' AND tc.relname = 'quiz_sessions'
        AND tg.tgname = 'trg_sync_quiz_sessions_token_hash'
    ), FALSE),
    COALESCE((
      SELECT NOT tg.tgisinternal FROM pg_trigger tg
      JOIN pg_class tc ON tg.tgrelid = tc.oid
      JOIN pg_namespace tn ON tc.relnamespace = tn.oid
      WHERE tn.nspname = 'public' AND tc.relname = 'quiz_sessions'
        AND tg.tgname = 'trg_sync_quiz_sessions_token_hash'
    ), FALSE),
    COALESCE((
      SELECT (fn.nspname = 'public' AND p.proname = 'sync_quiz_sessions_token_hash')
      FROM pg_trigger tg
      JOIN pg_class tc ON tg.tgrelid = tc.oid
      JOIN pg_namespace tn ON tc.relnamespace = tn.oid
      JOIN pg_proc p ON tg.tgfoid = p.oid
      JOIN pg_namespace fn ON p.pronamespace = fn.oid
      WHERE tn.nspname = 'public' AND tc.relname = 'quiz_sessions'
        AND tg.tgname = 'trg_sync_quiz_sessions_token_hash'
    ), FALSE),
    COALESCE((
      SELECT (tg.tgtype = 23)
      FROM pg_trigger tg
      JOIN pg_class tc ON tg.tgrelid = tc.oid
      JOIN pg_namespace tn ON tc.relnamespace = tn.oid
      WHERE tn.nspname = 'public' AND tc.relname = 'quiz_sessions'
        AND tg.tgname = 'trg_sync_quiz_sessions_token_hash'
    ), FALSE),
    COALESCE((
      SELECT pg_get_triggerdef(tg.oid) ~* 'BEFORE\s+INSERT\s+OR\s+UPDATE\s+ON\s+public\.quiz_sessions\s+FOR\s+EACH\s+ROW\s+EXECUTE\s+(FUNCTION|PROCEDURE)\s+(public\.)?sync_quiz_sessions_token_hash\(\)'
      FROM pg_trigger tg
      JOIN pg_class tc ON tg.tgrelid = tc.oid
      JOIN pg_namespace tn ON tc.relnamespace = tn.oid
      WHERE tn.nspname = 'public' AND tc.relname = 'quiz_sessions'
        AND tg.tgname = 'trg_sync_quiz_sessions_token_hash'
    ), FALSE)
  INTO v_trigger_exists, v_trigger_enabled, v_trigger_not_internal, 
       v_trigger_links_correct_func, v_trigger_timing_event_correct, v_trigger_def_correct;

  -- Validate Function (Exact trusted contract: search_path = public, extensions)
  SELECT 
    EXISTS (
      SELECT 1 FROM pg_proc p
      JOIN pg_namespace n ON p.pronamespace = n.oid
      WHERE n.nspname = 'public' AND p.proname = 'sync_quiz_sessions_token_hash'
    ),
    COALESCE((
      SELECT p.prosecdef FROM pg_proc p
      JOIN pg_namespace n ON p.pronamespace = n.oid
      WHERE n.nspname = 'public' AND p.proname = 'sync_quiz_sessions_token_hash'
    ), FALSE),
    COALESCE((
      SELECT EXISTS (
        SELECT 1 FROM pg_proc p
        JOIN pg_namespace n ON p.pronamespace = n.oid
        WHERE n.nspname = 'public' AND p.proname = 'sync_quiz_sessions_token_hash'
          AND p.proconfig IS NOT NULL
          AND EXISTS (
            SELECT 1 FROM unnest(p.proconfig) AS cfg
            WHERE cfg ~* '^search_path\s*=\s*public\s*,\s*extensions$'
          )
      )
    ), FALSE)
  INTO v_func_exists, v_func_is_secdef, v_func_has_searchpath;

  -- =========================================================================
  -- 10. Dynamic Consistency Checks (Safe, Guarded Execution via Dollar Quoting)
  -- =========================================================================
  IF v_missing_table_count = 0 AND v_phase4_col_count = 3 AND v_has_hash_col THEN
    -- Queries that do not depend on digest()
    EXECUTE $dyn$SELECT count(*) FROM public.quiz_sessions WHERE session_token IS NOT NULL AND session_token_hash IS NULL$dyn$ INTO v_null_hash_count;
    EXECUTE $dyn$SELECT count(*) FROM public.quiz_sessions WHERE session_token_hash IS NOT NULL AND trim(session_token_hash) = ''$dyn$ INTO v_empty_hash_count;
    EXECUTE $dyn$SELECT count(*) FROM public.quiz_sessions WHERE session_token IS NOT NULL AND trim(session_token) = ''$dyn$ INTO v_empty_token_count;
    EXECUTE $dyn$SELECT count(*) FROM public.quiz_sessions WHERE session_token IS NULL AND session_token_hash IS NOT NULL AND trim(session_token_hash) <> ''$dyn$ INTO v_hash_only_count;

    -- Hash-mismatch query: ONLY executed if pgcrypto is verified and digest is resolvable
    IF v_pgcrypto_compatible AND v_digest_resolvable THEN
      IF v_pgcrypto_schema = 'public' THEN
        EXECUTE $dyn$SELECT count(*) FROM public.quiz_sessions WHERE session_token IS NOT NULL AND session_token_hash IS NOT NULL AND trim(session_token_hash) <> '' AND session_token_hash <> encode(public.digest(session_token, 'sha256'), 'hex')$dyn$ INTO v_mismatch_hash_count;
      ELSE
        EXECUTE $dyn$SELECT count(*) FROM public.quiz_sessions WHERE session_token IS NOT NULL AND session_token_hash IS NOT NULL AND trim(session_token_hash) <> '' AND session_token_hash <> encode(extensions.digest(session_token, 'sha256'), 'hex')$dyn$ INTO v_mismatch_hash_count;
      END IF;
      v_mismatch_check_available := TRUE;
    ELSE
      v_mismatch_check_available := FALSE;
    END IF;
  END IF;

  -- =========================================================================
  -- 11. Strict Classification (Fail-Closed, Defensive Boolean Logic)
  -- =========================================================================
  -- Strict STATE A: Only genuine clean pre-migration state (enforces digest capability)
  IF v_missing_table_count = 0 
     AND v_missing_base_col_count = 0 
     AND v_pgcrypto_compatible 
     AND v_digest_resolvable
     AND v_phase4_col_count = 0 
     AND NOT v_has_hash_col 
     AND NOT v_token_idx_exists 
     AND NOT v_hash_idx_exists 
     AND NOT v_campaign_status_idx_exists
     AND NOT v_token_con_exists 
     AND NOT v_hash_con_exists 
     AND NOT v_trigger_exists 
     AND NOT v_func_exists 
     AND v_voucher_code_nullable = 'NO' THEN
    v_is_state_a := TRUE;
  END IF;

  -- Strict STATE A4: Migration 000004 fully applied, Migration 000005 not applied
  -- All Phase 4 artifacts must be present and valid; all Phase 5 artifacts must be absent.
  IF v_missing_table_count = 0 
     AND v_missing_base_col_count = 0 
     AND v_pgcrypto_compatible 
     AND v_digest_resolvable
     AND v_phase4_col_count = 3
     AND v_phase4_defs_correct
     AND v_token_con_exists AND v_token_con_validated
     AND v_token_idx_exists AND v_token_idx_valid AND v_token_idx_ready AND v_token_idx_cols_correct AND v_token_idx_pred_correct
     AND v_campaign_status_idx_exists AND v_campaign_status_idx_valid AND v_campaign_status_idx_ready AND v_campaign_status_idx_cols_correct
     AND NOT v_has_hash_col 
     AND NOT v_hash_con_exists 
     AND NOT v_hash_idx_exists 
     AND NOT v_trigger_exists 
     AND NOT v_func_exists 
     AND v_voucher_code_nullable = 'NO' THEN
    v_is_state_a4 := TRUE;
  END IF;

  -- Strict STATE B: Genuinely applied Expand state
  -- NOTE: Hash-only rows (session_token IS NULL AND session_token_hash IS NOT NULL)
  -- are legitimate during Expand phase when ENABLE_LEGACY_SESSION_TOKEN_WRITE=false.
  -- Genuinely invalid rows (null hashes for plaintext tokens, empty hashes, mismatches) are strictly forbidden.
  IF v_missing_table_count = 0 
     AND v_missing_base_col_count = 0 
     AND v_phase4_col_count = 3 
     AND v_phase4_defs_correct
     AND v_has_hash_col 
     AND v_pgcrypto_compatible 
     AND v_digest_resolvable
     AND v_token_con_exists AND v_token_con_validated
     AND v_hash_con_exists AND v_hash_con_validated AND v_hash_con_cols_correct
     AND v_token_idx_exists AND v_token_idx_valid AND v_token_idx_ready AND v_token_idx_cols_correct AND v_token_idx_pred_correct
     AND v_hash_idx_exists AND v_hash_idx_valid AND v_hash_idx_ready AND v_hash_idx_cols_correct AND v_hash_idx_pred_correct
     AND v_campaign_status_idx_exists AND v_campaign_status_idx_valid AND v_campaign_status_idx_ready AND v_campaign_status_idx_cols_correct
     AND v_trigger_exists AND v_trigger_enabled AND v_trigger_not_internal AND v_trigger_links_correct_func AND v_trigger_timing_event_correct AND v_trigger_def_correct
     AND v_func_exists AND v_func_is_secdef AND v_func_has_searchpath
     AND v_voucher_code_nullable = 'YES'
     AND v_mismatch_check_available
     AND v_null_hash_count = 0 
     AND v_empty_hash_count = 0 
     AND v_mismatch_hash_count = 0 
     AND v_empty_token_count = 0 THEN
    v_is_state_b := TRUE;
  END IF;

  -- =========================================================================
  -- 12. Structured Report Output
  -- =========================================================================
  RAISE NOTICE '=======================================================';
  RAISE NOTICE 'QUIZVIBE AI MIGRATION PREFLIGHT DIAGNOSTIC REPORT (v2)';
  RAISE NOTICE '=======================================================';
  RAISE NOTICE 'Base Tables Present: % / 6 (Missing: %)', (6 - v_missing_table_count), COALESCE(v_missing_tables, 'None');
  RAISE NOTICE 'Base quiz_sessions Columns: % / 11 (Missing: %)', (11 - v_missing_base_col_count), COALESCE(v_missing_base_cols, 'None');
  RAISE NOTICE 'pgcrypto Extension: installed=%, schema=%, compatible=%, digest_resolvable=%', 
    v_pgcrypto_installed, COALESCE(v_pgcrypto_schema, 'none'), v_pgcrypto_compatible, v_digest_resolvable;
  RAISE NOTICE 'Phase 4 Columns: % / 3 (definitions_correct=%)', v_phase4_col_count, v_phase4_defs_correct;
  RAISE NOTICE '         token_col: type=text, nullable=YES, default=none -> %', v_phase4_session_token_def_correct;
  RAISE NOTICE '         q_idx_col: type=smallint, nullable=NO, default=0 -> %', v_phase4_question_index_def_correct;
  RAISE NOTICE '         started_at_col: type=timestamptz, nullable=NO, default=now() -> %', v_phase4_started_at_def_correct;
  RAISE NOTICE 'Phase 5 Hash Column: %', v_has_hash_col;
  RAISE NOTICE 'leads.voucher_code is_nullable: %', v_voucher_code_nullable;
  RAISE NOTICE 'Constraints: token_unique=(exists=%, valid=%), hash_unique=(exists=%, valid=%, cols=%)',
    v_token_con_exists, v_token_con_validated, v_hash_con_exists, v_hash_con_validated, v_hash_con_cols_correct;
  RAISE NOTICE 'Indexes: token_idx(exists=%, valid=%, ready=%, cols=%, pred=%)',
    v_token_idx_exists, v_token_idx_valid, v_token_idx_ready, v_token_idx_cols_correct, v_token_idx_pred_correct;
  RAISE NOTICE '         hash_idx(exists=%, valid=%, ready=%, cols=%, pred=%)',
    v_hash_idx_exists, v_hash_idx_valid, v_hash_idx_ready, v_hash_idx_cols_correct, v_hash_idx_pred_correct;
  RAISE NOTICE '         camp_idx(exists=%, valid=%, ready=%, cols=%)',
    v_campaign_status_idx_exists, v_campaign_status_idx_valid, v_campaign_status_idx_ready, v_campaign_status_idx_cols_correct;
  RAISE NOTICE 'Trigger: exists=%, enabled=%, non_internal=%, links_correct_func=%, timing_event=%, def_correct=%',
    v_trigger_exists, v_trigger_enabled, v_trigger_not_internal, v_trigger_links_correct_func, v_trigger_timing_event_correct, v_trigger_def_correct;
  RAISE NOTICE 'Trigger Function: exists=%, secdef=%, search_path_valid=%',
    v_func_exists, v_func_is_secdef, v_func_has_searchpath;
  
  IF v_phase4_col_count = 3 AND v_has_hash_col THEN
    IF v_mismatch_check_available THEN
      RAISE NOTICE 'Data Consistency: null_hashes=%, empty_hashes=%, mismatches=%, empty_tokens=%, hash_only_rows=%',
        v_null_hash_count, v_empty_hash_count, v_mismatch_hash_count, v_empty_token_count, v_hash_only_count;
    ELSE
      RAISE NOTICE 'Data Consistency: null_hashes=%, empty_hashes=%, empty_tokens=%, hash_only_rows=%, mismatches=UNAVAILABLE (digest not resolvable)',
        v_null_hash_count, v_empty_hash_count, v_empty_token_count, v_hash_only_count;
    END IF;
  END IF;

  RAISE NOTICE '-------------------------------------------------------';
  IF v_is_state_a THEN
    v_verdict := 'STATE A';
    v_verdict_description := 'STATE A: CLEAN PRE-MIGRATION STATE. Safe to proceed with Migration 000004 followed by 000005.';
    v_blocking_reasons := 'NONE: Schema is clean and ready for Migration 000004.';
    RAISE NOTICE 'VERDICT: STATE A: CLEAN PRE-MIGRATION STATE.';
    RAISE NOTICE 'Safe to proceed with Migration 000004 followed by 000005.';
  ELSIF v_is_state_a4 THEN
    v_verdict := 'STATE A4';
    v_verdict_description := 'STATE A4: PHASE 4 APPLIED (READY FOR MIGRATION 000005). Safe to proceed with Migration 000005.';
    v_blocking_reasons := 'NONE: Phase 4 is fully applied and verified; schema is ready for Migration 000005.';
    RAISE NOTICE 'VERDICT: STATE A4: PHASE 4 APPLIED (READY FOR MIGRATION 000005).';
    RAISE NOTICE 'Safe to proceed with Migration 000005.';
  ELSIF v_is_state_b THEN
    v_verdict := 'STATE B';
    v_verdict_description := 'STATE B: MIGRATIONS ALREADY APPLIED. Database is in Expand Compatibility Mode with bidirectional sync.';
    IF v_hash_only_count > 0 THEN
      v_verdict_description := v_verdict_description || format(' Note: Detected %s hash-only row(s) (legitimate under ENABLE_LEGACY_SESSION_TOKEN_WRITE=false).', v_hash_only_count);
    END IF;
    v_blocking_reasons := 'NONE: Migration already fully applied in Expand compatibility mode.';
    RAISE NOTICE 'VERDICT: STATE B: MIGRATIONS ALREADY APPLIED.';
    RAISE NOTICE 'Database is in Expand Compatibility Mode with bidirectional sync.';
    IF v_hash_only_count > 0 THEN
      RAISE NOTICE 'Note: Detected % hash-only row(s) (legitimate under ENABLE_LEGACY_SESSION_TOKEN_WRITE=false).', v_hash_only_count;
    END IF;
  ELSE
    v_verdict := 'STATE C';
    v_verdict_description := 'STATE C: INCONSISTENT OR PARTIALLY APPLIED STATE. STOP! DO NOT execute migrations. Triage the failures reported below:';
    RAISE NOTICE 'VERDICT: STATE C: INCONSISTENT OR PARTIALLY APPLIED STATE. STOP!';
    RAISE NOTICE 'DO NOT execute migrations. Triage the failures reported below:';
    
    -- Table & Column triage
    IF v_missing_table_count > 0 THEN 
      RAISE NOTICE '-> FAILURE: Missing base tables: %', v_missing_tables; 
      v_blocking_reasons := v_blocking_reasons || CASE WHEN v_blocking_reasons <> '' THEN '; ' ELSE '' END || format('Missing base tables: %s', v_missing_tables);
    END IF;
    IF v_missing_base_col_count > 0 THEN 
      RAISE NOTICE '-> FAILURE: Missing base quiz_sessions columns: %', v_missing_base_cols; 
      v_blocking_reasons := v_blocking_reasons || CASE WHEN v_blocking_reasons <> '' THEN '; ' ELSE '' END || format('Missing base quiz_sessions columns: %s', v_missing_base_cols);
    END IF;

    -- pgcrypto triage
    IF NOT v_pgcrypto_installed THEN 
      RAISE NOTICE '-> FAILURE: pgcrypto extension is not installed'; 
      v_blocking_reasons := v_blocking_reasons || CASE WHEN v_blocking_reasons <> '' THEN '; ' ELSE '' END || 'pgcrypto extension is not installed';
    ELSIF NOT v_pgcrypto_compatible THEN 
      RAISE NOTICE '-> FAILURE: pgcrypto is installed in incompatible schema (%); must be public or extensions', COALESCE(v_pgcrypto_schema, 'none'); 
      v_blocking_reasons := v_blocking_reasons || CASE WHEN v_blocking_reasons <> '' THEN '; ' ELSE '' END || format('pgcrypto is installed in incompatible schema (%s); must be public or extensions', COALESCE(v_pgcrypto_schema, 'none'));
    ELSIF NOT v_digest_resolvable THEN 
      RAISE NOTICE '-> FAILURE: pgcrypto digest() function failed test execution probe'; 
      v_blocking_reasons := v_blocking_reasons || CASE WHEN v_blocking_reasons <> '' THEN '; ' ELSE '' END || 'pgcrypto digest() function failed test execution probe';
    END IF;

    -- Phase 4/5 column sequence triage
    IF v_phase4_col_count > 0 AND v_phase4_col_count < 3 THEN 
      RAISE NOTICE '-> FAILURE: Partial Phase 4 columns present (found % of 3)', v_phase4_col_count; 
      v_blocking_reasons := v_blocking_reasons || CASE WHEN v_blocking_reasons <> '' THEN '; ' ELSE '' END || format('Partial Phase 4 columns present (found %s of 3)', v_phase4_col_count);
    END IF;
    IF v_phase4_col_count = 3 AND NOT v_has_hash_col AND (
      v_hash_con_exists OR v_hash_idx_exists OR v_trigger_exists OR v_func_exists
    ) THEN 
      RAISE NOTICE '-> FAILURE: Premature Phase 5 artifacts exist on intermediate Phase 4 database (hash_con=%, hash_idx=%, trigger=%, func=%)', 
        v_hash_con_exists, v_hash_idx_exists, v_trigger_exists, v_func_exists; 
      v_blocking_reasons := v_blocking_reasons || CASE WHEN v_blocking_reasons <> '' THEN '; ' ELSE '' END || format('Premature Phase 5 artifacts exist on intermediate Phase 4 database (hash_con=%s, hash_idx=%s, trigger=%s, func=%s)', v_hash_con_exists, v_hash_idx_exists, v_trigger_exists, v_func_exists);
    END IF;
    IF v_phase4_col_count < 3 AND v_has_hash_col THEN 
      RAISE NOTICE '-> FAILURE: Phase 5 session_token_hash exists without full Phase 4 columns (out-of-order migration)'; 
      v_blocking_reasons := v_blocking_reasons || CASE WHEN v_blocking_reasons <> '' THEN '; ' ELSE '' END || 'Phase 5 session_token_hash exists without full Phase 4 columns (out-of-order migration)';
    END IF;

    -- Phase 4 column definitions contract triage
    IF v_phase4_col_count = 3 AND NOT v_phase4_defs_correct THEN
      IF NOT v_phase4_session_token_def_correct THEN
        RAISE NOTICE '-> FAILURE: Column quiz_sessions.session_token definition does not match contract (expected text, nullable YES, no default)';
        v_blocking_reasons := v_blocking_reasons || CASE WHEN v_blocking_reasons <> '' THEN '; ' ELSE '' END || 'Column quiz_sessions.session_token definition does not match contract (expected text, nullable YES, no default)';
      END IF;
      IF NOT v_phase4_question_index_def_correct THEN
        RAISE NOTICE '-> FAILURE: Column quiz_sessions.current_question_index definition does not match contract (expected smallint, nullable NO, default 0)';
        v_blocking_reasons := v_blocking_reasons || CASE WHEN v_blocking_reasons <> '' THEN '; ' ELSE '' END || 'Column quiz_sessions.current_question_index definition does not match contract (expected smallint, nullable NO, default 0)';
      END IF;
      IF NOT v_phase4_started_at_def_correct THEN
        RAISE NOTICE '-> FAILURE: Column quiz_sessions.current_question_started_at definition does not match contract (expected timestamptz, nullable NO, default now())';
        v_blocking_reasons := v_blocking_reasons || CASE WHEN v_blocking_reasons <> '' THEN '; ' ELSE '' END || 'Column quiz_sessions.current_question_started_at definition does not match contract (expected timestamptz, nullable NO, default now())';
      END IF;
    END IF;

    -- leads.voucher_code nullability contract triage
    IF v_voucher_code_nullable NOT IN ('NO', 'YES') THEN 
      RAISE NOTICE '-> FAILURE: leads.voucher_code column is missing'; 
      v_blocking_reasons := v_blocking_reasons || CASE WHEN v_blocking_reasons <> '' THEN '; ' ELSE '' END || 'leads.voucher_code column is missing';
    ELSIF NOT v_has_hash_col AND v_voucher_code_nullable = 'YES' THEN 
      RAISE NOTICE '-> FAILURE: leads.voucher_code is NULLABLE before Phase 5 is applied (premature nullability relaxation)'; 
      v_blocking_reasons := v_blocking_reasons || CASE WHEN v_blocking_reasons <> '' THEN '; ' ELSE '' END || 'leads.voucher_code is NULLABLE before Phase 5 is applied (premature nullability relaxation)';
    ELSIF v_phase4_col_count = 3 AND v_has_hash_col AND v_voucher_code_nullable = 'NO' THEN 
      RAISE NOTICE '-> FAILURE: leads.voucher_code is NOT NULL in applied Expand state (Migration 000005 relaxation missing)'; 
      v_blocking_reasons := v_blocking_reasons || CASE WHEN v_blocking_reasons <> '' THEN '; ' ELSE '' END || 'leads.voucher_code is NOT NULL in applied Expand state (Migration 000005 relaxation missing)';
    END IF;

    -- Pre-migration partial artifact detection
    IF v_phase4_col_count = 0 AND NOT v_has_hash_col AND (
      v_token_idx_exists OR v_hash_idx_exists OR v_campaign_status_idx_exists OR 
      v_token_con_exists OR v_hash_con_exists OR v_trigger_exists OR v_func_exists
    ) THEN 
      RAISE NOTICE '-> FAILURE: Premature migration artifacts exist on pre-migration database (token_idx=%, hash_idx=%, camp_idx=%, token_con=%, hash_con=%, trigger=%, func=%)', 
        v_token_idx_exists, v_hash_idx_exists, v_campaign_status_idx_exists, 
        v_token_con_exists, v_hash_con_exists, v_trigger_exists, v_func_exists; 
      v_blocking_reasons := v_blocking_reasons || CASE WHEN v_blocking_reasons <> '' THEN '; ' ELSE '' END || format('Premature migration artifacts exist on pre-migration database (token_idx=%s, hash_idx=%s, camp_idx=%s, token_con=%s, hash_con=%s, trigger=%s, func=%s)', v_token_idx_exists, v_hash_idx_exists, v_campaign_status_idx_exists, v_token_con_exists, v_hash_con_exists, v_trigger_exists, v_func_exists);
    END IF;

    -- Constraints triage
    IF v_token_con_exists AND NOT v_token_con_validated THEN 
      RAISE NOTICE '-> FAILURE: Phase 4 session_token unique constraint exists but is NOT validated'; 
      v_blocking_reasons := v_blocking_reasons || CASE WHEN v_blocking_reasons <> '' THEN '; ' ELSE '' END || 'Phase 4 session_token unique constraint exists but is NOT validated';
    ELSIF v_phase4_col_count = 3 AND NOT v_token_con_exists THEN 
      RAISE NOTICE '-> FAILURE: Missing Phase 4 session_token unique constraint'; 
      v_blocking_reasons := v_blocking_reasons || CASE WHEN v_blocking_reasons <> '' THEN '; ' ELSE '' END || 'Missing Phase 4 session_token unique constraint';
    END IF;

    IF v_hash_con_exists AND NOT (v_hash_con_validated AND v_hash_con_cols_correct) THEN 
      RAISE NOTICE '-> FAILURE: Constraint quiz_sessions_token_hash_unique exists but is not validated or constrains wrong columns'; 
      v_blocking_reasons := v_blocking_reasons || CASE WHEN v_blocking_reasons <> '' THEN '; ' ELSE '' END || 'Constraint quiz_sessions_token_hash_unique exists but is not validated or constrains wrong columns';
    ELSIF v_has_hash_col AND NOT v_hash_con_exists THEN 
      RAISE NOTICE '-> FAILURE: Missing constraint quiz_sessions_token_hash_unique on session_token_hash'; 
      v_blocking_reasons := v_blocking_reasons || CASE WHEN v_blocking_reasons <> '' THEN '; ' ELSE '' END || 'Missing constraint quiz_sessions_token_hash_unique on session_token_hash';
    END IF;

    -- Indexes triage
    IF v_token_idx_exists AND NOT (v_token_idx_valid AND v_token_idx_ready AND v_token_idx_cols_correct AND v_token_idx_pred_correct) THEN 
      RAISE NOTICE '-> FAILURE: Index idx_quiz_sessions_token is invalid or malformed (valid=%, ready=%, cols_correct=%, pred_correct=%)', 
        v_token_idx_valid, v_token_idx_ready, v_token_idx_cols_correct, v_token_idx_pred_correct; 
      v_blocking_reasons := v_blocking_reasons || CASE WHEN v_blocking_reasons <> '' THEN '; ' ELSE '' END || format('Index idx_quiz_sessions_token is invalid or malformed (valid=%s, ready=%s, cols_correct=%s, pred_correct=%s)', v_token_idx_valid, v_token_idx_ready, v_token_idx_cols_correct, v_token_idx_pred_correct);
    ELSIF v_phase4_col_count = 3 AND NOT v_token_idx_exists THEN 
      RAISE NOTICE '-> FAILURE: Missing index idx_quiz_sessions_token'; 
      v_blocking_reasons := v_blocking_reasons || CASE WHEN v_blocking_reasons <> '' THEN '; ' ELSE '' END || 'Missing index idx_quiz_sessions_token';
    END IF;

    IF v_hash_idx_exists AND NOT (v_hash_idx_valid AND v_hash_idx_ready AND v_hash_idx_cols_correct AND v_hash_idx_pred_correct) THEN 
      RAISE NOTICE '-> FAILURE: Index idx_quiz_sessions_token_hash is invalid or malformed (valid=%, ready=%, cols_correct=%, pred_correct=%)', 
        v_hash_idx_valid, v_hash_idx_ready, v_hash_idx_cols_correct, v_hash_idx_pred_correct; 
      v_blocking_reasons := v_blocking_reasons || CASE WHEN v_blocking_reasons <> '' THEN '; ' ELSE '' END || format('Index idx_quiz_sessions_token_hash is invalid or malformed (valid=%s, ready=%s, cols_correct=%s, pred_correct=%s)', v_hash_idx_valid, v_hash_idx_ready, v_hash_idx_cols_correct, v_hash_idx_pred_correct);
    ELSIF v_has_hash_col AND NOT v_hash_idx_exists THEN 
      RAISE NOTICE '-> FAILURE: Missing index idx_quiz_sessions_token_hash'; 
      v_blocking_reasons := v_blocking_reasons || CASE WHEN v_blocking_reasons <> '' THEN '; ' ELSE '' END || 'Missing index idx_quiz_sessions_token_hash';
    END IF;

    IF v_campaign_status_idx_exists AND NOT (v_campaign_status_idx_valid AND v_campaign_status_idx_ready AND v_campaign_status_idx_cols_correct) THEN 
      RAISE NOTICE '-> FAILURE: Index idx_quiz_sessions_campaign_status is invalid or malformed (valid=%, ready=%, cols_correct=%)', 
        v_campaign_status_idx_valid, v_campaign_status_idx_ready, v_campaign_status_idx_cols_correct; 
      v_blocking_reasons := v_blocking_reasons || CASE WHEN v_blocking_reasons <> '' THEN '; ' ELSE '' END || format('Index idx_quiz_sessions_campaign_status is invalid or malformed (valid=%s, ready=%s, cols_correct=%s)', v_campaign_status_idx_valid, v_campaign_status_idx_ready, v_campaign_status_idx_cols_correct);
    ELSIF v_phase4_col_count = 3 AND NOT v_campaign_status_idx_exists THEN 
      RAISE NOTICE '-> FAILURE: Missing index idx_quiz_sessions_campaign_status'; 
      v_blocking_reasons := v_blocking_reasons || CASE WHEN v_blocking_reasons <> '' THEN '; ' ELSE '' END || 'Missing index idx_quiz_sessions_campaign_status';
    END IF;

    -- Trigger triage
    IF v_trigger_exists AND NOT v_trigger_enabled THEN 
      RAISE NOTICE '-> FAILURE: Trigger trg_sync_quiz_sessions_token_hash is DISABLED'; 
      v_blocking_reasons := v_blocking_reasons || CASE WHEN v_blocking_reasons <> '' THEN '; ' ELSE '' END || 'Trigger trg_sync_quiz_sessions_token_hash is DISABLED';
    END IF;
    IF v_trigger_exists AND NOT v_trigger_not_internal THEN 
      RAISE NOTICE '-> FAILURE: Trigger trg_sync_quiz_sessions_token_hash is internal'; 
      v_blocking_reasons := v_blocking_reasons || CASE WHEN v_blocking_reasons <> '' THEN '; ' ELSE '' END || 'Trigger trg_sync_quiz_sessions_token_hash is internal';
    END IF;
    IF v_trigger_exists AND NOT v_trigger_links_correct_func THEN 
      RAISE NOTICE '-> FAILURE: Trigger trg_sync_quiz_sessions_token_hash is linked to incorrect function'; 
      v_blocking_reasons := v_blocking_reasons || CASE WHEN v_blocking_reasons <> '' THEN '; ' ELSE '' END || 'Trigger trg_sync_quiz_sessions_token_hash is linked to incorrect function';
    END IF;
    IF v_trigger_exists AND NOT v_trigger_timing_event_correct THEN 
      RAISE NOTICE '-> FAILURE: Trigger trg_sync_quiz_sessions_token_hash has incorrect timing/event (expected BEFORE INSERT OR UPDATE FOR EACH ROW)'; 
      v_blocking_reasons := v_blocking_reasons || CASE WHEN v_blocking_reasons <> '' THEN '; ' ELSE '' END || 'Trigger trg_sync_quiz_sessions_token_hash has incorrect timing/event (expected BEFORE INSERT OR UPDATE FOR EACH ROW)';
    END IF;
    IF v_trigger_exists AND NOT v_trigger_def_correct THEN 
      RAISE NOTICE '-> FAILURE: Trigger definition mismatch in pg_get_triggerdef'; 
      v_blocking_reasons := v_blocking_reasons || CASE WHEN v_blocking_reasons <> '' THEN '; ' ELSE '' END || 'Trigger definition mismatch in pg_get_triggerdef';
    END IF;
    IF v_has_hash_col AND NOT v_trigger_exists THEN 
      RAISE NOTICE '-> FAILURE: Missing trigger trg_sync_quiz_sessions_token_hash'; 
      v_blocking_reasons := v_blocking_reasons || CASE WHEN v_blocking_reasons <> '' THEN '; ' ELSE '' END || 'Missing trigger trg_sync_quiz_sessions_token_hash';
    END IF;

    -- Function triage
    IF v_func_exists AND NOT v_func_is_secdef THEN 
      RAISE NOTICE '-> FAILURE: Function sync_quiz_sessions_token_hash is NOT SECURITY DEFINER'; 
      v_blocking_reasons := v_blocking_reasons || CASE WHEN v_blocking_reasons <> '' THEN '; ' ELSE '' END || 'Function sync_quiz_sessions_token_hash is NOT SECURITY DEFINER';
    END IF;
    IF v_func_exists AND NOT v_func_has_searchpath THEN 
      RAISE NOTICE '-> FAILURE: Function sync_quiz_sessions_token_hash is missing exact trusted search_path (public, extensions)'; 
      v_blocking_reasons := v_blocking_reasons || CASE WHEN v_blocking_reasons <> '' THEN '; ' ELSE '' END || 'Function sync_quiz_sessions_token_hash is missing exact trusted search_path (public, extensions)';
    END IF;
    IF v_has_hash_col AND NOT v_func_exists THEN 
      RAISE NOTICE '-> FAILURE: Missing function public.sync_quiz_sessions_token_hash'; 
      v_blocking_reasons := v_blocking_reasons || CASE WHEN v_blocking_reasons <> '' THEN '; ' ELSE '' END || 'Missing function public.sync_quiz_sessions_token_hash';
    END IF;

    -- Consistency triage
    IF v_phase4_col_count = 3 AND v_has_hash_col AND NOT v_mismatch_check_available THEN 
      RAISE NOTICE '-> FAILURE: Cryptographic hash consistency check could not be run safely'; 
      v_blocking_reasons := v_blocking_reasons || CASE WHEN v_blocking_reasons <> '' THEN '; ' ELSE '' END || 'Cryptographic hash consistency check could not be run safely';
    END IF;
    IF v_null_hash_count > 0 THEN 
      RAISE NOTICE '-> FAILURE: % rows with session_token have NULL session_token_hash', v_null_hash_count; 
      v_blocking_reasons := v_blocking_reasons || CASE WHEN v_blocking_reasons <> '' THEN '; ' ELSE '' END || format('%s rows with session_token have NULL session_token_hash', v_null_hash_count);
    END IF;
    IF v_empty_hash_count > 0 THEN 
      RAISE NOTICE '-> FAILURE: % rows have empty string session_token_hash', v_empty_hash_count; 
      v_blocking_reasons := v_blocking_reasons || CASE WHEN v_blocking_reasons <> '' THEN '; ' ELSE '' END || format('%s rows have empty string session_token_hash', v_empty_hash_count);
    END IF;
    IF v_empty_token_count > 0 THEN 
      RAISE NOTICE '-> FAILURE: % rows have empty string session_token', v_empty_token_count; 
      v_blocking_reasons := v_blocking_reasons || CASE WHEN v_blocking_reasons <> '' THEN '; ' ELSE '' END || format('%s rows have empty string session_token', v_empty_token_count);
    END IF;
    IF v_mismatch_hash_count > 0 THEN 
      RAISE NOTICE '-> FAILURE: % rows have hash mismatch against sha256(session_token)', v_mismatch_hash_count; 
      v_blocking_reasons := v_blocking_reasons || CASE WHEN v_blocking_reasons <> '' THEN '; ' ELSE '' END || format('%s rows have hash mismatch against sha256(session_token)', v_mismatch_hash_count);
    END IF;

    IF v_blocking_reasons = '' THEN
      v_blocking_reasons := 'Inconsistent or partially applied state. Check diagnostic notices for details.';
    END IF;
  END IF;

  -- Set final session settings for Section 10 result set output
  v_pgcrypto_status := format('installed=%s, schema=%s, compatible=%s, digest_resolvable=%s', 
    v_pgcrypto_installed, COALESCE(v_pgcrypto_schema, 'none'), v_pgcrypto_compatible, v_digest_resolvable);

  v_base_schema_status := format('tables=%s/6 (missing: %s), base_columns=%s/11 (missing: %s)', 
    (6 - v_missing_table_count), COALESCE(v_missing_tables, 'none'), 
    (11 - v_missing_base_col_count), COALESCE(v_missing_base_cols, 'none'));

  v_session_token_status := format('phase4_cols=%s/3, defs_correct=%s (token=%s, q_idx=%s, started_at=%s), unique_con=%s (valid=%s), idx_token=%s (valid=%s, ready=%s, cols=%s, pred=%s)', 
    v_phase4_col_count, v_phase4_defs_correct, v_phase4_session_token_def_correct, v_phase4_question_index_def_correct, v_phase4_started_at_def_correct,
    v_token_con_exists, v_token_con_validated, 
    v_token_idx_exists, v_token_idx_valid, v_token_idx_ready, v_token_idx_cols_correct, v_token_idx_pred_correct);

  v_session_token_hash_status := format('hash_col=%s, unique_con=%s (valid=%s, cols=%s), idx_hash=%s (valid=%s, ready=%s, cols=%s, pred=%s), voucher_nullable=%s', 
    v_has_hash_col, v_hash_con_exists, v_hash_con_validated, v_hash_con_cols_correct, 
    v_hash_idx_exists, v_hash_idx_valid, v_hash_idx_ready, v_hash_idx_cols_correct, v_hash_idx_pred_correct, 
    v_voucher_code_nullable);

  v_index_status := format('token_idx=(exists=%s, valid=%s, ready=%s, cols=%s, pred=%s), hash_idx=(exists=%s, valid=%s, ready=%s, cols=%s, pred=%s), camp_idx=(exists=%s, valid=%s, ready=%s, cols=%s)', 
    v_token_idx_exists, v_token_idx_valid, v_token_idx_ready, v_token_idx_cols_correct, v_token_idx_pred_correct, 
    v_hash_idx_exists, v_hash_idx_valid, v_hash_idx_ready, v_hash_idx_cols_correct, v_hash_idx_pred_correct, 
    v_campaign_status_idx_exists, v_campaign_status_idx_valid, v_campaign_status_idx_ready, v_campaign_status_idx_cols_correct);

  v_trigger_status := format('trigger=(exists=%s, enabled=%s, non_internal=%s, links_func=%s, timing=%s, def=%s), func=(exists=%s, secdef=%s, search_path=%s)', 
    v_trigger_exists, v_trigger_enabled, v_trigger_not_internal, v_trigger_links_correct_func, v_trigger_timing_event_correct, v_trigger_def_correct, 
    v_func_exists, v_func_is_secdef, v_func_has_searchpath);

  IF v_phase4_col_count = 3 AND v_has_hash_col THEN
    IF v_mismatch_check_available THEN
      v_hash_anomaly_status := format('null_hashes=%s, empty_hashes=%s, mismatches=%s, empty_tokens=%s, hash_only_rows=%s', 
        v_null_hash_count, v_empty_hash_count, v_mismatch_hash_count, v_empty_token_count, v_hash_only_count);
    ELSE
      v_hash_anomaly_status := format('null_hashes=%s, empty_hashes=%s, empty_tokens=%s, hash_only_rows=%s, mismatches=UNAVAILABLE', 
        v_null_hash_count, v_empty_hash_count, v_empty_token_count, v_hash_only_count);
    END IF;
  ELSE
    v_hash_anomaly_status := 'N/A (hash column not present)';
  END IF;

  PERFORM set_config('quizvibe.preflight_verdict', v_verdict, false);
  PERFORM set_config('quizvibe.preflight_verdict_description', v_verdict_description, false);
  PERFORM set_config('quizvibe.preflight_pgcrypto_status', v_pgcrypto_status, false);
  PERFORM set_config('quizvibe.preflight_base_schema_status', v_base_schema_status, false);
  PERFORM set_config('quizvibe.preflight_session_token_status', v_session_token_status, false);
  PERFORM set_config('quizvibe.preflight_session_token_hash_status', v_session_token_hash_status, false);
  PERFORM set_config('quizvibe.preflight_index_status', v_index_status, false);
  PERFORM set_config('quizvibe.preflight_trigger_status', v_trigger_status, false);
  PERFORM set_config('quizvibe.preflight_hash_anomaly_status', v_hash_anomaly_status, false);
  PERFORM set_config('quizvibe.preflight_blocking_reasons', v_blocking_reasons, false);

  RAISE NOTICE '=======================================================';
END $$;

-- ----------------------------------------------------------------------------
-- 10. Final Migration-State Verdict Result Set (Supabase SQL Editor Output)
-- ----------------------------------------------------------------------------
-- Emits exactly one row containing the final migration-state verdict and detailed
-- diagnostics as a standard result set visible in Supabase SQL Editor Results tab.
SELECT 
  COALESCE(current_setting('quizvibe.preflight_verdict', true), 'STATE C: UNEXECUTED') AS verdict,
  COALESCE(current_setting('quizvibe.preflight_verdict_description', true), 'Diagnostic DO block has not been executed in this session.') AS verdict_description,
  COALESCE(current_setting('quizvibe.preflight_pgcrypto_status', true), 'UNKNOWN') AS pgcrypto_status,
  COALESCE(current_setting('quizvibe.preflight_base_schema_status', true), 'UNKNOWN') AS base_schema_status,
  COALESCE(current_setting('quizvibe.preflight_session_token_status', true), 'UNKNOWN') AS session_token_status,
  COALESCE(current_setting('quizvibe.preflight_session_token_hash_status', true), 'UNKNOWN') AS session_token_hash_status,
  COALESCE(current_setting('quizvibe.preflight_index_status', true), 'UNKNOWN') AS index_status,
  COALESCE(current_setting('quizvibe.preflight_trigger_status', true), 'UNKNOWN') AS trigger_status,
  COALESCE(current_setting('quizvibe.preflight_hash_anomaly_status', true), 'UNKNOWN') AS hash_anomaly_status,
  COALESCE(current_setting('quizvibe.preflight_blocking_reasons', true), 'Preflight diagnostic was not executed.') AS blocking_reasons;
