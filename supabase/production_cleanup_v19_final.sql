-- ============================================================================
-- QUIZVIBE AI - PRODUCTION CLEANUP TRANSACTION (V19 FINAL PRODUCTION SPEC)
-- TARGET: Disassociate Test Claim, Delete Smoke Test Lead & Session, Preserve All History
-- SAFETY: Zero data loss. Exact schema-qualified regtype assertions ('pg_catalog.<type>'::regtype),
--         Dual column counters (total active vs matching cols), User-Defined Trigger assertions
--         (Confirms exactly 0 user triggers on all 3 tables; reflects Phase 7.5 Contract Mode),
--         Primary Key assertions, FK referential action assertions (SET NULL via confrelid),
--         Pre-mutation FK referencing assertions (Zero cascading side-effects), Minimal Lock
--         Footprint (FOR UPDATE on targets, FOR SHARE on history), ROW_COUNT assertions,
--         Strict NULL-Safe (IS DISTINCT FROM) checks, Full 14-column Session verification
--         including exact semantic JSONB answers_snapshot comparisons aligned with live Production.
--
-- TARGET RECORDS:
--   - Smoke Test Claim:   '33581da6-24ac-482b-b37d-7bacc53be80d' (first_lead_id -> NULL)
--   - Smoke Test Lead:    '2eee5fc6-ea40-4aff-9cad-15f6e756555d' (DELETE)
--   - Smoke Test Session: 'e1d59ea1-5ea2-4ea7-b1ed-e1ec44ca9453' (DELETE)
--
-- PRESERVED HISTORICAL RECORDS:
--   - Historical Lead #1:    '819a82dd-aae3-4bf6-a850-e0db78b77cfb' (CANONICAL UUID, score 1840)
--   - Historical Lead #2:    'a9eb7f01-2817-4476-a404-613d92601ef2' (score 1470)
--   - Historical Session #1: '5438e9fe-b41d-4775-8b75-6c299b5e544b' (score 1840, token hash 46c18925...)
--   - Historical Session #2: '70e06057-343f-4ab1-8ebb-37199f902ac5' (score 1470, token hash b0a10596...)
--   - Historical Claim:      '99bc1e11-05a0-4ce2-9305-e3ccdd0022ff'
-- ============================================================================

BEGIN;

-- Khóa bảo vệ chống chạy đồng thời nhiều session cleanup
SELECT pg_advisory_xact_lock(hashtext('quizvibe_production_cleanup_lock'));

DO $$
DECLARE
  -- Target ID constants
  v_smoke_claim_id    UUID := '33581da6-24ac-482b-b37d-7bacc53be80d';
  v_smoke_lead_id     UUID := '2eee5fc6-ea40-4aff-9cad-15f6e756555d';
  v_smoke_session_id  UUID := 'e1d59ea1-5ea2-4ea7-b1ed-e1ec44ca9453';

  -- Preserved Historical ID constants
  v_hist_lead_1_id    UUID := '819a82dd-aae3-4bf6-a850-e0db78b77cfb';
  v_hist_lead_2_id    UUID := 'a9eb7f01-2817-4476-a404-613d92601ef2';
  v_hist_session_1_id UUID := '5438e9fe-b41d-4775-8b75-6c299b5e544b';
  v_hist_session_2_id UUID := '70e06057-343f-4ab1-8ebb-37199f902ac5';
  v_hist_claim_id     UUID := '99bc1e11-05a0-4ce2-9305-e3ccdd0022ff';

  -- Diagnostic & assertion counters
  v_rows_affected     INT;
  v_check_count       INT;
  v_col_count         INT;
  v_catalog_cols_total    INT;
  v_catalog_cols_matching INT;
  v_trigger_count     INT;
  v_referencing_count INT;

  -- Lock buffer variables
  v_locked_claim_id   UUID;
  v_locked_lead_id    UUID;
  v_locked_session_id UUID;

  -- Historical session snapshot variables for Phase 2 & Phase 4 verification
  v_h1_id                         UUID;
  v_h1_campaign_id                UUID;
  v_h1_status                     TEXT;
  v_h1_total_score                INT;
  v_h1_correct_count              INT;
  v_h1_total_questions            INT;
  v_h1_time_taken_seconds         INT;
  v_h1_answers_snapshot           JSONB;
  v_h1_started_at                 TIMESTAMPTZ;
  v_h1_completed_at               TIMESTAMPTZ;
  v_h1_created_at                 TIMESTAMPTZ;
  v_h1_current_question_index     INT;
  v_h1_current_question_started_at TIMESTAMPTZ;
  v_h1_session_token_hash         TEXT;

  v_h2_id                         UUID;
  v_h2_campaign_id                UUID;
  v_h2_status                     TEXT;
  v_h2_total_score                INT;
  v_h2_correct_count              INT;
  v_h2_total_questions            INT;
  v_h2_time_taken_seconds         INT;
  v_h2_answers_snapshot           JSONB;
  v_h2_started_at                 TIMESTAMPTZ;
  v_h2_completed_at               TIMESTAMPTZ;
  v_h2_created_at                 TIMESTAMPTZ;
  v_h2_current_question_index     INT;
  v_h2_current_question_started_at TIMESTAMPTZ;
  v_h2_session_token_hash         TEXT;
BEGIN

  -- ==========================================================================
  -- PHASE 0: DEEP CATALOG & SCHEMA INTEGRITY ASSERTIONS
  -- ==========================================================================

  -- --------------------------------------------------------------------------
  -- 0.1 Check Unique Constraint on campaign_phone_registrations (campaign_id, phone_hash)
  -- --------------------------------------------------------------------------
  SELECT COUNT(*) INTO v_check_count
  FROM pg_catalog.pg_constraint con
  JOIN pg_catalog.pg_class tbl ON con.conrelid = tbl.oid
  JOIN pg_catalog.pg_namespace ns ON tbl.relnamespace = ns.oid
  JOIN pg_catalog.pg_index idx ON con.conindid = idx.indexrelid
  WHERE ns.nspname = 'public'
    AND tbl.relname = 'campaign_phone_registrations'
    AND con.conname = 'uq_campaign_phone_registrations'
    AND con.contype = 'u'
    AND con.convalidated = true
    AND idx.indisunique = true
    AND idx.indisvalid = true
    AND idx.indisready = true;

  IF v_check_count IS DISTINCT FROM 1 THEN
    RAISE EXCEPTION 'CATALOG_ASSERTION_FAILED: uq_campaign_phone_registrations unique constraint missing, unvalidated, or invalid!';
  END IF;

  SELECT COUNT(*) INTO v_col_count
  FROM (
    SELECT a.attname, ord.n
    FROM pg_catalog.pg_constraint con
    JOIN pg_catalog.pg_class tbl ON con.conrelid = tbl.oid
    JOIN pg_catalog.pg_namespace ns ON tbl.relnamespace = ns.oid
    CROSS JOIN LATERAL unnest(con.conkey) WITH ORDINALITY AS ord(attnum, n)
    JOIN pg_catalog.pg_attribute a ON a.attrelid = tbl.oid AND a.attnum = ord.attnum
    WHERE ns.nspname = 'public'
      AND tbl.relname = 'campaign_phone_registrations'
      AND con.conname = 'uq_campaign_phone_registrations'
      AND (
        (ord.n = 1 AND a.attname = 'campaign_id') OR
        (ord.n = 2 AND a.attname = 'phone_hash')
      )
  ) cols;

  IF v_col_count IS DISTINCT FROM 2 THEN
    RAISE EXCEPTION 'CATALOG_ASSERTION_FAILED: uq_campaign_phone_registrations columns do not exactly match (campaign_id, phone_hash)!';
  END IF;

  -- --------------------------------------------------------------------------
  -- 0.2 Check Primary Keys on all 3 tables
  -- --------------------------------------------------------------------------
  SELECT COUNT(*) INTO v_check_count
  FROM pg_catalog.pg_constraint con
  JOIN pg_catalog.pg_class tbl ON con.conrelid = tbl.oid
  JOIN pg_catalog.pg_namespace ns ON tbl.relnamespace = ns.oid
  WHERE ns.nspname = 'public'
    AND con.contype = 'p'
    AND (
      (tbl.relname = 'leads' AND con.conname = 'leads_pkey') OR
      (tbl.relname = 'quiz_sessions' AND con.conname = 'quiz_sessions_pkey') OR
      (tbl.relname = 'campaign_phone_registrations' AND con.conname = 'campaign_phone_registrations_pkey')
    );

  IF v_check_count IS DISTINCT FROM 3 THEN
    RAISE EXCEPTION 'CATALOG_ASSERTION_FAILED: One or more Primary Key constraints are missing!';
  END IF;

  -- --------------------------------------------------------------------------
  -- 0.3 Check Foreign Key Referential Actions (confdeltype = 'n' -> ON DELETE SET NULL)
  -- --------------------------------------------------------------------------
  SELECT COUNT(*) INTO v_check_count
  FROM pg_catalog.pg_constraint con
  JOIN pg_catalog.pg_class tbl ON con.conrelid = tbl.oid
  JOIN pg_catalog.pg_namespace ns ON tbl.relnamespace = ns.oid
  WHERE ns.nspname = 'public'
    AND con.contype = 'f'
    AND con.confdeltype = 'n'
    AND (
      (tbl.relname = 'campaign_phone_registrations' AND con.confrelid = 'public.leads'::regclass) OR
      (tbl.relname = 'leads' AND con.confrelid = 'public.quiz_sessions'::regclass)
    );

  IF v_check_count IS DISTINCT FROM 2 THEN
    RAISE EXCEPTION 'CATALOG_ASSERTION_FAILED: Foreign Key referential action is NOT ON DELETE SET NULL!';
  END IF;

  -- --------------------------------------------------------------------------
  -- 0.4 Fail-Closed Catalog Column Assertions (V19: schema-qualified regtype & exact schema)
  -- --------------------------------------------------------------------------

  -- 0.4.1 Check public.leads (Exactly 11 columns)
  SELECT
    COUNT(*),
    COUNT(*) FILTER (
      WHERE (a.attname = 'id' AND a.atttypid = 'pg_catalog.uuid'::regtype)
         OR (a.attname = 'campaign_id' AND a.atttypid = 'pg_catalog.uuid'::regtype)
         OR (a.attname = 'quiz_session_id' AND a.atttypid = 'pg_catalog.uuid'::regtype)
         OR (a.attname = 'full_name' AND a.atttypid = 'pg_catalog.text'::regtype)
         OR (a.attname = 'phone_number' AND a.atttypid = 'pg_catalog.text'::regtype)
         OR (a.attname = 'masked_phone' AND a.atttypid = 'pg_catalog.text'::regtype)
         OR (a.attname = 'score' AND a.atttypid = 'pg_catalog.int4'::regtype)
         OR (a.attname = 'time_taken_seconds' AND a.atttypid = 'pg_catalog.int4'::regtype)
         OR (a.attname = 'voucher_code' AND a.atttypid = 'pg_catalog.text'::regtype)
         OR (a.attname = 'submitted_at' AND a.atttypid = 'pg_catalog.timestamptz'::regtype)
         OR (a.attname = 'created_at' AND a.atttypid = 'pg_catalog.timestamptz'::regtype)
    )
  INTO v_catalog_cols_total, v_catalog_cols_matching
  FROM pg_catalog.pg_attribute a
  JOIN pg_catalog.pg_class c ON a.attrelid = c.oid
  JOIN pg_catalog.pg_namespace n ON c.relnamespace = n.oid
  WHERE n.nspname = 'public'
    AND c.relname = 'leads'
    AND a.attnum > 0
    AND NOT a.attisdropped;

  IF v_catalog_cols_total IS DISTINCT FROM 11 OR v_catalog_cols_matching IS DISTINCT FROM 11 THEN
    RAISE EXCEPTION 'CATALOG_ASSERTION_FAILED: public.leads schema mismatch! Total cols: %, Matching cols: % (expected exactly 11)',
      v_catalog_cols_total, v_catalog_cols_matching;
  END IF;

  -- 0.4.2 Check public.quiz_sessions (Exactly 14 columns, Contract Mode Phase 7.5+)
  SELECT
    COUNT(*),
    COUNT(*) FILTER (
      WHERE (a.attname = 'id' AND a.atttypid = 'pg_catalog.uuid'::regtype)
         OR (a.attname = 'campaign_id' AND a.atttypid = 'pg_catalog.uuid'::regtype)
         OR (a.attname = 'status' AND a.atttypid = 'pg_catalog.text'::regtype)
         OR (a.attname = 'total_score' AND a.atttypid = 'pg_catalog.int4'::regtype)
         OR (a.attname = 'correct_count' AND a.atttypid = 'pg_catalog.int2'::regtype)
         OR (a.attname = 'total_questions' AND a.atttypid = 'pg_catalog.int2'::regtype)
         OR (a.attname = 'time_taken_seconds' AND a.atttypid = 'pg_catalog.int4'::regtype)
         OR (a.attname = 'answers_snapshot' AND a.atttypid = 'pg_catalog.jsonb'::regtype)
         OR (a.attname = 'started_at' AND a.atttypid = 'pg_catalog.timestamptz'::regtype)
         OR (a.attname = 'completed_at' AND a.atttypid = 'pg_catalog.timestamptz'::regtype)
         OR (a.attname = 'created_at' AND a.atttypid = 'pg_catalog.timestamptz'::regtype)
         OR (a.attname = 'current_question_index' AND a.atttypid = 'pg_catalog.int2'::regtype)
         OR (a.attname = 'current_question_started_at' AND a.atttypid = 'pg_catalog.timestamptz'::regtype)
         OR (a.attname = 'session_token_hash' AND a.atttypid = 'pg_catalog.text'::regtype)
    )
  INTO v_catalog_cols_total, v_catalog_cols_matching
  FROM pg_catalog.pg_attribute a
  JOIN pg_catalog.pg_class c ON a.attrelid = c.oid
  JOIN pg_catalog.pg_namespace n ON c.relnamespace = n.oid
  WHERE n.nspname = 'public'
    AND c.relname = 'quiz_sessions'
    AND a.attnum > 0
    AND NOT a.attisdropped;

  IF v_catalog_cols_total IS DISTINCT FROM 14 OR v_catalog_cols_matching IS DISTINCT FROM 14 THEN
    RAISE EXCEPTION 'CATALOG_ASSERTION_FAILED: public.quiz_sessions schema mismatch! Total cols: %, Matching cols: % (expected exactly 14)',
      v_catalog_cols_total, v_catalog_cols_matching;
  END IF;

  -- 0.4.3 Check public.campaign_phone_registrations (Exactly 5 columns)
  SELECT
    COUNT(*),
    COUNT(*) FILTER (
      WHERE (a.attname = 'id' AND a.atttypid = 'pg_catalog.uuid'::regtype)
         OR (a.attname = 'campaign_id' AND a.atttypid = 'pg_catalog.uuid'::regtype)
         OR (a.attname = 'phone_hash' AND a.atttypid = 'pg_catalog.text'::regtype)
         OR (a.attname = 'first_lead_id' AND a.atttypid = 'pg_catalog.uuid'::regtype)
         OR (a.attname = 'created_at' AND a.atttypid = 'pg_catalog.timestamptz'::regtype)
    )
  INTO v_catalog_cols_total, v_catalog_cols_matching
  FROM pg_catalog.pg_attribute a
  JOIN pg_catalog.pg_class c ON a.attrelid = c.oid
  JOIN pg_catalog.pg_namespace n ON c.relnamespace = n.oid
  WHERE n.nspname = 'public'
    AND c.relname = 'campaign_phone_registrations'
    AND a.attnum > 0
    AND NOT a.attisdropped;

  IF v_catalog_cols_total IS DISTINCT FROM 5 OR v_catalog_cols_matching IS DISTINCT FROM 5 THEN
    RAISE EXCEPTION 'CATALOG_ASSERTION_FAILED: public.campaign_phone_registrations schema mismatch! Total cols: %, Matching cols: % (expected exactly 5)',
      v_catalog_cols_total, v_catalog_cols_matching;
  END IF;

  -- --------------------------------------------------------------------------
  -- 0.5 User-Defined Triggers Assertions (Zero user triggers expected on all 3 tables)
  -- --------------------------------------------------------------------------
  SELECT COUNT(*) INTO v_trigger_count
  FROM pg_catalog.pg_trigger trg
  JOIN pg_catalog.pg_class tbl ON trg.tgrelid = tbl.oid
  JOIN pg_catalog.pg_namespace ns ON tbl.relnamespace = ns.oid
  WHERE ns.nspname = 'public'
    AND tbl.relname = 'leads'
    AND NOT trg.tgisinternal;

  IF v_trigger_count IS DISTINCT FROM 0 THEN
    RAISE EXCEPTION 'CATALOG_ASSERTION_FAILED: Unexpected user-defined triggers detected on public.leads! Count: %', v_trigger_count;
  END IF;

  SELECT COUNT(*) INTO v_trigger_count
  FROM pg_catalog.pg_trigger trg
  JOIN pg_catalog.pg_class tbl ON trg.tgrelid = tbl.oid
  JOIN pg_catalog.pg_namespace ns ON tbl.relnamespace = ns.oid
  WHERE ns.nspname = 'public'
    AND tbl.relname = 'campaign_phone_registrations'
    AND NOT trg.tgisinternal;

  IF v_trigger_count IS DISTINCT FROM 0 THEN
    RAISE EXCEPTION 'CATALOG_ASSERTION_FAILED: Unexpected user-defined triggers detected on public.campaign_phone_registrations! Count: %', v_trigger_count;
  END IF;

  SELECT COUNT(*) INTO v_trigger_count
  FROM pg_catalog.pg_trigger trg
  JOIN pg_catalog.pg_class tbl ON trg.tgrelid = tbl.oid
  JOIN pg_catalog.pg_namespace ns ON tbl.relnamespace = ns.oid
  WHERE ns.nspname = 'public'
    AND tbl.relname = 'quiz_sessions'
    AND NOT trg.tgisinternal;

  IF v_trigger_count IS DISTINCT FROM 0 THEN
    RAISE EXCEPTION 'CATALOG_ASSERTION_FAILED: Unexpected user-defined triggers detected on public.quiz_sessions! Count: %', v_trigger_count;
  END IF;

  -- ==========================================================================
  -- PHASE 1: ACQUIRE ROW LOCKS & BASELINE AUDIT
  -- ==========================================================================

  -- Khóa độc quyền (FOR UPDATE) trên 3 dòng mục tiêu
  SELECT id INTO v_locked_claim_id
  FROM public.campaign_phone_registrations
  WHERE id = v_smoke_claim_id
  FOR UPDATE;

  SELECT id INTO v_locked_lead_id
  FROM public.leads
  WHERE id = v_smoke_lead_id
  FOR UPDATE;

  SELECT id INTO v_locked_session_id
  FROM public.quiz_sessions
  WHERE id = v_smoke_session_id
  FOR UPDATE;

  IF v_locked_claim_id IS NULL OR v_locked_lead_id IS NULL OR v_locked_session_id IS NULL THEN
    RAISE EXCEPTION 'LOCK_FAILURE: Failed to acquire exclusive FOR UPDATE lock on target records!';
  END IF;

  -- Khóa bảo vệ dữ liệu (FOR SHARE) trên các dòng lịch sử
  PERFORM id FROM public.leads WHERE id IN (v_hist_lead_1_id, v_hist_lead_2_id) FOR SHARE;
  PERFORM id FROM public.quiz_sessions WHERE id IN (v_hist_session_1_id, v_hist_session_2_id) FOR SHARE;
  PERFORM id FROM public.campaign_phone_registrations WHERE id = v_hist_claim_id FOR SHARE;

  -- Kiểm tra baseline tổng quan
  SELECT COUNT(*) INTO v_check_count FROM public.leads;
  IF v_check_count IS DISTINCT FROM 3 THEN
    RAISE EXCEPTION 'BASELINE_PRECONDITION_FAILED: Expected exactly 3 leads, found %', v_check_count;
  END IF;

  SELECT COUNT(*) INTO v_check_count FROM public.campaign_phone_registrations;
  IF v_check_count IS DISTINCT FROM 2 THEN
    RAISE EXCEPTION 'BASELINE_PRECONDITION_FAILED: Expected exactly 2 claims, found %', v_check_count;
  END IF;

  SELECT COUNT(*) INTO v_check_count FROM public.quiz_sessions;
  IF v_check_count IS DISTINCT FROM 23 THEN
    RAISE EXCEPTION 'BASELINE_PRECONDITION_FAILED: Expected exactly 23 sessions, found %', v_check_count;
  END IF;

  -- ==========================================================================
  -- PHASE 2: PRECONDITIONS & FOREIGN KEY PRE-MUTATION AUDIT
  -- ==========================================================================

  -- 2.1 Smoke Test Target Record Preconditions
  SELECT COUNT(*) INTO v_check_count
  FROM public.campaign_phone_registrations
  WHERE id = v_smoke_claim_id
    AND campaign_id = 'a4720a44-f039-4f80-9f00-dfac138af21c'
    AND phone_hash = '1caad5df133efcd64a164b9b94e17d0cfce07abe7abb73416004c49db3737f99'
    AND first_lead_id = v_smoke_lead_id
    AND created_at = '2026-11-06 18:42:26.095+00'::TIMESTAMPTZ;
  IF v_check_count IS DISTINCT FROM 1 THEN
    RAISE EXCEPTION 'PRECONDITION_FAILED: Smoke Test Claim state invalid!';
  END IF;

  SELECT COUNT(*) INTO v_check_count
  FROM public.leads
  WHERE id = v_smoke_lead_id
    AND campaign_id = 'a4720a44-f039-4f80-9f00-dfac138af21c'
    AND quiz_session_id = v_smoke_session_id
    AND full_name = 'Smoke Test Participant'
    AND phone_number = '0944349166'
    AND masked_phone = '094***9166'
    AND score = 780
    AND time_taken_seconds = 8
    AND voucher_code = 'VIBE20'
    AND submitted_at = '2026-11-06 18:42:26.095+00'::TIMESTAMPTZ
    AND created_at = '2026-11-06 18:42:26.247837+00'::TIMESTAMPTZ;
  IF v_check_count IS DISTINCT FROM 1 THEN
    RAISE EXCEPTION 'PRECONDITION_FAILED: Smoke Test Lead state invalid!';
  END IF;

  SELECT COUNT(*) INTO v_check_count
  FROM public.quiz_sessions
  WHERE id = v_smoke_session_id
    AND campaign_id = 'a4720a44-f039-4f80-9f00-dfac138af21c'
    AND status = 'completed'
    AND total_score = 780
    AND correct_count = 2
    AND total_questions = 5
    AND time_taken_seconds = 8
    AND current_question_index = 5
    AND started_at = '2026-11-06 18:42:12.951+00'::TIMESTAMPTZ
    AND completed_at = '2026-11-06 18:42:20.933+00'::TIMESTAMPTZ
    AND created_at = '2026-11-06 18:42:13.4794+00'::TIMESTAMPTZ
    AND current_question_started_at = '2026-11-06 18:42:20.933+00'::TIMESTAMPTZ
    AND session_token_hash = '20e59e4ccdae237452958e56f9f414dccae3a0a81e877fd322c6ce9b39a44fb0'
    AND answers_snapshot = '[
      {"isCorrect": false, "pointsAwarded": 0, "questionOrder": 0, "selectedIndex": 0, "remainingSeconds": 29},
      {"isCorrect": true, "pointsAwarded": 390, "questionOrder": 1, "selectedIndex": 0, "remainingSeconds": 29},
      {"isCorrect": false, "pointsAwarded": 0, "questionOrder": 2, "selectedIndex": 0, "remainingSeconds": 29},
      {"isCorrect": true, "pointsAwarded": 390, "questionOrder": 3, "selectedIndex": 0, "remainingSeconds": 29},
      {"isCorrect": false, "pointsAwarded": 0, "questionOrder": 4, "selectedIndex": 0, "remainingSeconds": 29}
    ]'::JSONB;
  IF v_check_count IS DISTINCT FROM 1 THEN
    RAISE EXCEPTION 'PRECONDITION_FAILED: Smoke Test Session state invalid!';
  END IF;

  -- 2.2 Foreign Key Pre-Mutation Reference Invariance Assertions
  SELECT COUNT(*) INTO v_referencing_count
  FROM public.leads
  WHERE quiz_session_id = v_smoke_session_id;

  IF v_referencing_count IS DISTINCT FROM 1 THEN
    RAISE EXCEPTION 'PRECONDITION_FAILED: Expected exactly 1 lead referencing smoke session, found %', v_referencing_count;
  END IF;

  SELECT COUNT(*) INTO v_referencing_count
  FROM public.campaign_phone_registrations
  WHERE first_lead_id = v_smoke_lead_id;

  IF v_referencing_count IS DISTINCT FROM 1 THEN
    RAISE EXCEPTION 'PRECONDITION_FAILED: Expected exactly 1 claim referencing smoke lead, found %', v_referencing_count;
  END IF;

  -- 2.3 Historical Records Preconditions
  SELECT COUNT(*) INTO v_check_count
  FROM public.leads
  WHERE id = v_hist_lead_1_id
    AND campaign_id = 'a4720a44-f039-4f80-9f00-dfac138af21c'
    AND quiz_session_id = v_hist_session_1_id
    AND full_name = 'Nguyen Tran Minh Quan'
    AND phone_number = '0899067427'
    AND masked_phone = '089***7427'
    AND score = 1840
    AND time_taken_seconds = 18
    AND voucher_code = 'VIBE20'
    AND submitted_at = '2026-11-06 17:23:48.238+00'::TIMESTAMPTZ
    AND created_at = '2026-11-06 17:23:48.404002+00'::TIMESTAMPTZ;
  IF v_check_count IS DISTINCT FROM 1 THEN
    RAISE EXCEPTION 'PRECONDITION_FAILED: Historical Lead #1 state invalid!';
  END IF;

  SELECT COUNT(*) INTO v_check_count
  FROM public.leads
  WHERE id = v_hist_lead_2_id
    AND campaign_id = 'a4720a44-f039-4f80-9f00-dfac138af21c'
    AND quiz_session_id = v_hist_session_2_id
    AND full_name = 'Nguyen Tran Minh Quan'
    AND phone_number = '0899067427'
    AND masked_phone = '089***7427'
    AND score = 1470
    AND time_taken_seconds = 20
    AND voucher_code = 'VIBE20'
    AND submitted_at = '2026-11-06 17:27:20.06+00'::TIMESTAMPTZ
    AND created_at = '2026-11-06 17:27:20.218364+00'::TIMESTAMPTZ;
  IF v_check_count IS DISTINCT FROM 1 THEN
    RAISE EXCEPTION 'PRECONDITION_FAILED: Historical Lead #2 state invalid!';
  END IF;

  -- Capture and verify full 14 columns of Historical Session #1
  SELECT
    id, campaign_id, status, total_score, correct_count, total_questions, time_taken_seconds,
    answers_snapshot, started_at, completed_at, created_at, current_question_index,
    current_question_started_at, session_token_hash
  INTO
    v_h1_id, v_h1_campaign_id, v_h1_status, v_h1_total_score, v_h1_correct_count,
    v_h1_total_questions, v_h1_time_taken_seconds, v_h1_answers_snapshot,
    v_h1_started_at, v_h1_completed_at, v_h1_created_at, v_h1_current_question_index,
    v_h1_current_question_started_at, v_h1_session_token_hash
  FROM public.quiz_sessions
  WHERE id = v_hist_session_1_id;

  IF v_h1_campaign_id IS DISTINCT FROM 'a4720a44-f039-4f80-9f00-dfac138af21c'::UUID
     OR v_h1_status IS DISTINCT FROM 'completed'
     OR v_h1_total_score IS DISTINCT FROM 1840
     OR v_h1_correct_count IS DISTINCT FROM 5
     OR v_h1_total_questions IS DISTINCT FROM 5
     OR v_h1_time_taken_seconds IS DISTINCT FROM 18
     OR v_h1_started_at IS DISTINCT FROM '2026-11-06 17:23:14.751+00'::TIMESTAMPTZ
     OR v_h1_completed_at IS DISTINCT FROM '2026-11-06 17:23:33.145+00'::TIMESTAMPTZ
     OR v_h1_created_at IS DISTINCT FROM '2026-11-06 17:23:14.903166+00'::TIMESTAMPTZ
     OR v_h1_current_question_index IS DISTINCT FROM 5
     OR v_h1_current_question_started_at IS DISTINCT FROM '2026-11-06 17:23:33.145+00'::TIMESTAMPTZ
     OR v_h1_session_token_hash IS DISTINCT FROM '46c18925b5d882f96c69c9e3d9947cda00e07c8d6db90b41363be75281c76019'
     OR v_h1_answers_snapshot IS DISTINCT FROM '[
       {"isCorrect": true, "pointsAwarded": 360, "questionOrder": 0, "selectedIndex": 1, "remainingSeconds": 26},
       {"isCorrect": true, "pointsAwarded": 370, "questionOrder": 1, "selectedIndex": 0, "remainingSeconds": 27},
       {"isCorrect": true, "pointsAwarded": 360, "questionOrder": 2, "selectedIndex": 1, "remainingSeconds": 26},
       {"isCorrect": true, "pointsAwarded": 370, "questionOrder": 3, "selectedIndex": 0, "remainingSeconds": 27},
       {"isCorrect": true, "pointsAwarded": 380, "questionOrder": 4, "selectedIndex": 2, "remainingSeconds": 28}
     ]'::JSONB
  THEN
    RAISE EXCEPTION 'PRECONDITION_FAILED: Historical Session #1 has unexpected column values or corrupted answers_snapshot!';
  END IF;

  -- Capture and verify full 14 columns of Historical Session #2
  SELECT
    id, campaign_id, status, total_score, correct_count, total_questions, time_taken_seconds,
    answers_snapshot, started_at, completed_at, created_at, current_question_index,
    current_question_started_at, session_token_hash
  INTO
    v_h2_id, v_h2_campaign_id, v_h2_status, v_h2_total_score, v_h2_correct_count,
    v_h2_total_questions, v_h2_time_taken_seconds, v_h2_answers_snapshot,
    v_h2_started_at, v_h2_completed_at, v_h2_created_at, v_h2_current_question_index,
    v_h2_current_question_started_at, v_h2_session_token_hash
  FROM public.quiz_sessions
  WHERE id = v_hist_session_2_id;

  IF v_h2_campaign_id IS DISTINCT FROM 'a4720a44-f039-4f80-9f00-dfac138af21c'::UUID
     OR v_h2_status IS DISTINCT FROM 'completed'
     OR v_h2_total_score IS DISTINCT FROM 1470
     OR v_h2_correct_count IS DISTINCT FROM 4
     OR v_h2_total_questions IS DISTINCT FROM 5
     OR v_h2_time_taken_seconds IS DISTINCT FROM 20
     OR v_h2_started_at IS DISTINCT FROM '2026-11-06 17:26:24.983+00'::TIMESTAMPTZ
     OR v_h2_completed_at IS DISTINCT FROM '2026-11-06 17:26:45.469+00'::TIMESTAMPTZ
     OR v_h2_created_at IS DISTINCT FROM '2026-11-06 17:26:25.522607+00'::TIMESTAMPTZ
     OR v_h2_current_question_index IS DISTINCT FROM 5
     OR v_h2_current_question_started_at IS DISTINCT FROM '2026-11-06 17:26:45.469+00'::TIMESTAMPTZ
     OR v_h2_session_token_hash IS DISTINCT FROM 'b0a10596ec1889531f9e75ddee8cd6e2857dde329dbe5117072f81a3d6b455dc'
     OR v_h2_answers_snapshot IS DISTINCT FROM '[
       {"isCorrect": true, "pointsAwarded": 360, "questionOrder": 0, "selectedIndex": 1, "remainingSeconds": 26},
       {"isCorrect": false, "pointsAwarded": 0, "questionOrder": 1, "selectedIndex": 1, "remainingSeconds": 26},
       {"isCorrect": true, "pointsAwarded": 370, "questionOrder": 2, "selectedIndex": 1, "remainingSeconds": 27},
       {"isCorrect": true, "pointsAwarded": 370, "questionOrder": 3, "selectedIndex": 0, "remainingSeconds": 27},
       {"isCorrect": true, "pointsAwarded": 370, "questionOrder": 4, "selectedIndex": 2, "remainingSeconds": 27}
     ]'::JSONB
  THEN
    RAISE EXCEPTION 'PRECONDITION_FAILED: Historical Session #2 has unexpected column values or corrupted answers_snapshot!';
  END IF;

  SELECT COUNT(*) INTO v_check_count
  FROM public.campaign_phone_registrations
  WHERE id = v_hist_claim_id
    AND campaign_id = 'a4720a44-f039-4f80-9f00-dfac138af21c'
    AND phone_hash = 'bff5e75e3c334c172b456a34512c8d1f4223a2abd99d86e2bcb74728272e5eb4'
    AND created_at = '2026-11-06 17:23:48.238+00'::TIMESTAMPTZ
    AND first_lead_id = v_hist_lead_1_id;
  IF v_check_count IS DISTINCT FROM 1 THEN
    RAISE EXCEPTION 'PRECONDITION_FAILED: Historical Claim state invalid!';
  END IF;

  -- ==========================================================================
  -- PHASE 3: EXECUTE CLEANUP MUTATIONS (EXACTLY 3 DML STATEMENTS)
  -- ==========================================================================

  -- Mutation 1: Disassociate Smoke Test Claim
  UPDATE public.campaign_phone_registrations
  SET first_lead_id = NULL
  WHERE id = v_smoke_claim_id
    AND first_lead_id = v_smoke_lead_id;

  GET DIAGNOSTICS v_rows_affected = ROW_COUNT;
  IF v_rows_affected IS DISTINCT FROM 1 THEN
    RAISE EXCEPTION 'MUTATION_FAILED: Expected exactly 1 claim updated, got %', v_rows_affected;
  END IF;

  -- Mutation 2: Delete Smoke Test Lead
  DELETE FROM public.leads
  WHERE id = v_smoke_lead_id
    AND quiz_session_id = v_smoke_session_id;

  GET DIAGNOSTICS v_rows_affected = ROW_COUNT;
  IF v_rows_affected IS DISTINCT FROM 1 THEN
    RAISE EXCEPTION 'MUTATION_FAILED: Expected exactly 1 lead deleted, got %', v_rows_affected;
  END IF;

  -- Mutation 3: Delete Smoke Test Session
  DELETE FROM public.quiz_sessions
  WHERE id = v_smoke_session_id;

  GET DIAGNOSTICS v_rows_affected = ROW_COUNT;
  IF v_rows_affected IS DISTINCT FROM 1 THEN
    RAISE EXCEPTION 'MUTATION_FAILED: Expected exactly 1 session deleted, got %', v_rows_affected;
  END IF;

  -- ==========================================================================
  -- PHASE 4: POSTCONDITIONS & INVARIANCE VERIFICATION
  -- ==========================================================================

  -- Postcondition 1: Deleted rows do not exist
  SELECT COUNT(*) INTO v_check_count FROM public.leads WHERE id = v_smoke_lead_id;
  IF v_check_count IS DISTINCT FROM 0 THEN
    RAISE EXCEPTION 'POSTCONDITION_FAILED: Smoke Test Lead still exists!';
  END IF;

  SELECT COUNT(*) INTO v_check_count FROM public.quiz_sessions WHERE id = v_smoke_session_id;
  IF v_check_count IS DISTINCT FROM 0 THEN
    RAISE EXCEPTION 'POSTCONDITION_FAILED: Smoke Test Session still exists!';
  END IF;

  -- Postcondition 2: Total remaining leads is exactly 2
  SELECT COUNT(*) INTO v_check_count FROM public.leads;
  IF v_check_count IS DISTINCT FROM 2 THEN
    RAISE EXCEPTION 'POSTCONDITION_FAILED: Expected exactly 2 remaining leads, found %', v_check_count;
  END IF;

  -- Postcondition 3: Total remaining sessions is exactly 22
  SELECT COUNT(*) INTO v_check_count FROM public.quiz_sessions;
  IF v_check_count IS DISTINCT FROM 22 THEN
    RAISE EXCEPTION 'POSTCONDITION_FAILED: Expected exactly 22 remaining sessions, found %', v_check_count;
  END IF;

  -- Postcondition 4: Smoke Test Claim is disassociated but tuple preserved
  SELECT COUNT(*) INTO v_check_count
  FROM public.campaign_phone_registrations
  WHERE id = v_smoke_claim_id
    AND campaign_id = 'a4720a44-f039-4f80-9f00-dfac138af21c'
    AND phone_hash = '1caad5df133efcd64a164b9b94e17d0cfce07abe7abb73416004c49db3737f99'
    AND first_lead_id IS NULL;
  IF v_check_count IS DISTINCT FROM 1 THEN
    RAISE EXCEPTION 'POSTCONDITION_FAILED: Smoke Test Claim was deleted or tuple modified!';
  END IF;

  -- Postcondition 5: Zero orphan leads
  SELECT COUNT(*) INTO v_check_count
  FROM public.leads l
  LEFT JOIN public.quiz_sessions qs ON l.quiz_session_id = qs.id
  WHERE l.quiz_session_id IS NOT NULL AND qs.id IS NULL;
  IF v_check_count IS DISTINCT FROM 0 THEN
    RAISE EXCEPTION 'POSTCONDITION_FAILED: Orphan leads detected without valid quiz_session!';
  END IF;

  -- Postcondition 6: Zero orphan claims
  SELECT COUNT(*) INTO v_check_count
  FROM public.campaign_phone_registrations cpr
  LEFT JOIN public.leads l ON cpr.first_lead_id = l.id
  WHERE cpr.first_lead_id IS NOT NULL AND l.id IS NULL;
  IF v_check_count IS DISTINCT FROM 0 THEN
    RAISE EXCEPTION 'POSTCONDITION_FAILED: Orphan claims detected with invalid first_lead_id!';
  END IF;

  -- Postcondition 7: Historical Lead #1 completely unchanged
  SELECT COUNT(*) INTO v_check_count
  FROM public.leads
  WHERE id = v_hist_lead_1_id
    AND campaign_id = 'a4720a44-f039-4f80-9f00-dfac138af21c'
    AND quiz_session_id = v_hist_session_1_id
    AND full_name = 'Nguyen Tran Minh Quan'
    AND phone_number = '0899067427'
    AND masked_phone = '089***7427'
    AND score = 1840
    AND time_taken_seconds = 18
    AND voucher_code = 'VIBE20'
    AND submitted_at = '2026-11-06 17:23:48.238+00'::TIMESTAMPTZ
    AND created_at = '2026-11-06 17:23:48.404002+00'::TIMESTAMPTZ;
  IF v_check_count IS DISTINCT FROM 1 THEN
    RAISE EXCEPTION 'POSTCONDITION_FAILED: Historical Lead #1 was modified or deleted!';
  END IF;

  -- Postcondition 8: Historical Lead #2 completely unchanged
  SELECT COUNT(*) INTO v_check_count
  FROM public.leads
  WHERE id = v_hist_lead_2_id
    AND campaign_id = 'a4720a44-f039-4f80-9f00-dfac138af21c'
    AND quiz_session_id = v_hist_session_2_id
    AND full_name = 'Nguyen Tran Minh Quan'
    AND phone_number = '0899067427'
    AND masked_phone = '089***7427'
    AND score = 1470
    AND time_taken_seconds = 20
    AND voucher_code = 'VIBE20'
    AND submitted_at = '2026-11-06 17:27:20.06+00'::TIMESTAMPTZ
    AND created_at = '2026-11-06 17:27:20.218364+00'::TIMESTAMPTZ;
  IF v_check_count IS DISTINCT FROM 1 THEN
    RAISE EXCEPTION 'POSTCONDITION_FAILED: Historical Lead #2 was modified or deleted!';
  END IF;

  -- Postcondition 9: Full 14-column post-verification on Historical Sessions
  SELECT COUNT(*) INTO v_check_count
  FROM public.quiz_sessions
  WHERE id = v_hist_session_1_id
    AND campaign_id = v_h1_campaign_id
    AND status = v_h1_status
    AND total_score = v_h1_total_score
    AND correct_count = v_h1_correct_count
    AND total_questions = v_h1_total_questions
    AND time_taken_seconds = v_h1_time_taken_seconds
    AND started_at = v_h1_started_at
    AND completed_at = v_h1_completed_at
    AND created_at = v_h1_created_at
    AND current_question_index = v_h1_current_question_index
    AND current_question_started_at = v_h1_current_question_started_at
    AND session_token_hash = v_h1_session_token_hash
    AND answers_snapshot = v_h1_answers_snapshot;
  IF v_check_count IS DISTINCT FROM 1 THEN
    RAISE EXCEPTION 'POSTCONDITION_FAILED: Historical Session #1 post-state modified or corrupted!';
  END IF;

  SELECT COUNT(*) INTO v_check_count
  FROM public.quiz_sessions
  WHERE id = v_hist_session_2_id
    AND campaign_id = v_h2_campaign_id
    AND status = v_h2_status
    AND total_score = v_h2_total_score
    AND correct_count = v_h2_correct_count
    AND total_questions = v_h2_total_questions
    AND time_taken_seconds = v_h2_time_taken_seconds
    AND started_at = v_h2_started_at
    AND completed_at = v_h2_completed_at
    AND created_at = v_h2_created_at
    AND current_question_index = v_h2_current_question_index
    AND current_question_started_at = v_h2_current_question_started_at
    AND session_token_hash = v_h2_session_token_hash
    AND answers_snapshot = v_h2_answers_snapshot;
  IF v_check_count IS DISTINCT FROM 1 THEN
    RAISE EXCEPTION 'POSTCONDITION_FAILED: Historical Session #2 post-state modified or corrupted!';
  END IF;

  -- Postcondition 10: Historical Claim completely unchanged
  SELECT COUNT(*) INTO v_check_count
  FROM public.campaign_phone_registrations
  WHERE id = v_hist_claim_id
    AND campaign_id = 'a4720a44-f039-4f80-9f00-dfac138af21c'
    AND phone_hash = 'bff5e75e3c334c172b456a34512c8d1f4223a2abd99d86e2bcb74728272e5eb4'
    AND created_at = '2026-11-06 17:23:48.238+00'::TIMESTAMPTZ
    AND first_lead_id = v_hist_lead_1_id;
  IF v_check_count IS DISTINCT FROM 1 THEN
    RAISE EXCEPTION 'POSTCONDITION_FAILED: Historical Claim state invalid or modified!';
  END IF;

  -- Postcondition 11: Total Claims count is exactly 2 (macroscopic check)
  SELECT COUNT(*) INTO v_check_count FROM public.campaign_phone_registrations;
  IF v_check_count IS DISTINCT FROM 2 THEN
    RAISE EXCEPTION 'POSTCONDITION_FAILED: Total claims count is not 2 (found %)', v_check_count;
  END IF;

  RAISE NOTICE '>>> ALL PRECONDITIONS, MUTATIONS, AND POSTCONDITIONS VERIFIED SUCCESSFULLY (V19 FINAL) <<<';
END $$;

COMMIT;
