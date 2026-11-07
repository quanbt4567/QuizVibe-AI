-- ============================================================================
-- QUIZVIBE AI - PRODUCTION CLEANUP TRANSACTION (V18 FINAL PRODUCTION SPEC)
-- TARGET: Disassociate Test Claim, Delete Smoke Test Lead & Session, Preserve All History
-- SAFETY: Zero data loss. Exact schema-qualified regtype assertions ('pg_catalog.<type>'::regtype),
--         Dual column counters (total active vs matching cols), User-Defined Trigger assertions
--         (pg_trigger check, non-DELETE verification), Primary Key assertions, FK referential
--         action assertions (SET NULL), Pre-mutation FK referencing assertions (Zero cascading
--         side-effects), Minimal Lock Footprint (FOR UPDATE on targets, FOR SHARE on history),
--         ROW_COUNT assertions, Strict NULL-Safe (IS DISTINCT FROM) checks, Full 14-column
--         Session verification including exact semantic JSONB answers_snapshot comparisons.
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

DO $$
DECLARE
  -- Target entity identifiers
  v_test_lead_id        UUID := '2eee5fc6-ea40-4aff-9cad-15f6e756555d';
  v_test_session_id     UUID := 'e1d59ea1-5ea2-4ea7-b1ed-e1ec44ca9453';
  v_test_claim_id       UUID := '33581da6-24ac-482b-b37d-7bacc53be80d';

  -- Historical entity identifiers (Canonical verified UUIDs)
  v_hist_lead_1_id      UUID := '819a82dd-aae3-4bf6-a850-e0db78b77cfb';
  v_hist_lead_2_id      UUID := 'a9eb7f01-2817-4476-a404-613d92601ef2';
  v_hist_session_1_id   UUID := '5438e9fe-b41d-4775-8b75-6c299b5e544b';
  v_hist_session_2_id   UUID := '70e06057-343f-4ab1-8ebb-37199f902ac5';
  v_hist_claim_id       UUID := '99bc1e11-05a0-4ce2-9305-e3ccdd0022ff';

  -- Catalog assertion tracking variables (Fail-closed dual counters with schema-qualified regtype)
  v_catalog_leads_cols_total       INTEGER := 0;
  v_catalog_leads_cols_matching    INTEGER := 0;
  v_catalog_sessions_cols_total    INTEGER := 0;
  v_catalog_sessions_cols_matching INTEGER := 0;
  v_catalog_claims_cols_total      INTEGER := 0;
  v_catalog_claims_cols_matching   INTEGER := 0;
  v_catalog_pk_valid               INTEGER := 0;
  v_catalog_fk_quiz_sessions_total INTEGER := 0;
  v_catalog_fk_quiz_sessions_valid INTEGER := 0;
  v_catalog_fk_leads_total         INTEGER := 0;
  v_catalog_fk_leads_valid         INTEGER := 0;
  v_catalog_uq_count               INTEGER := 0;

  -- User-Defined Triggers tracking variables
  v_catalog_triggers_leads_count    INTEGER := 0;
  v_catalog_triggers_claims_count   INTEGER := 0;
  v_catalog_triggers_sessions_count INTEGER := 0;
  v_catalog_triggers_sessions_total INTEGER := 0;

  -- Pre-mutation Foreign Key referencing assertion variables
  v_referencing_leads_count        INTEGER := 0;
  v_single_referencing_lead_id     UUID;
  v_referencing_claims_count       INTEGER := 0;
  v_single_referencing_claim_id    UUID;

  -- Precondition row records
  v_hist1_record        public.leads%ROWTYPE;
  v_hist2_record        public.leads%ROWTYPE;
  v_test_lead_record    public.leads%ROWTYPE;
  v_hist_sess1_record   public.quiz_sessions%ROWTYPE;
  v_hist_sess2_record   public.quiz_sessions%ROWTYPE;
  v_test_session_record public.quiz_sessions%ROWTYPE;
  v_test_claim_record   public.campaign_phone_registrations%ROWTYPE;
  v_hist_claim_record   public.campaign_phone_registrations%ROWTYPE;

  -- Macroscopic count tracking variables
  v_baseline_leads_count    INTEGER := 0;
  v_baseline_claims_count   INTEGER := 0;
  v_baseline_sessions_count INTEGER := 0;

  -- Mutation diagnostics tracking
  v_rows_updated INTEGER := 0;
  v_rows_deleted INTEGER := 0;

  -- Postcondition assertion variables
  v_check_count INTEGER := 0;
BEGIN
  -- ==========================================================================
  -- PHASE 0: EXACT REGTYPE CATALOG ASSERTIONS & CONSTRAINT CHECKS (V18 P1 FIX)
  -- ==========================================================================
  RAISE NOTICE '>>> PHASE 0: ASSERTING CATALOGS, SCHEMA-QUALIFIED REGTYPES, PK, FK, & TRIGGERS <<<';

  -- 1. Assert public.leads: Total active cols = 11 AND matching cols = 11 using schema-qualified regtype
  SELECT 
    COUNT(*),
    COUNT(*) FILTER (WHERE 
      (a.attname = 'id' AND a.atttypid = 'pg_catalog.uuid'::regtype) OR
      (a.attname = 'campaign_id' AND a.atttypid = 'pg_catalog.uuid'::regtype) OR
      (a.attname = 'quiz_session_id' AND a.atttypid = 'pg_catalog.uuid'::regtype) OR
      (a.attname = 'full_name' AND a.atttypid = 'pg_catalog.text'::regtype) OR
      (a.attname = 'phone_number' AND a.atttypid = 'pg_catalog.text'::regtype) OR
      (a.attname = 'masked_phone' AND a.atttypid = 'pg_catalog.text'::regtype) OR
      (a.attname = 'score' AND a.atttypid = 'pg_catalog.int4'::regtype) OR
      (a.attname = 'time_taken_seconds' AND a.atttypid = 'pg_catalog.int4'::regtype) OR
      (a.attname = 'voucher_code' AND a.atttypid = 'pg_catalog.text'::regtype) OR
      (a.attname = 'submitted_at' AND a.atttypid = 'pg_catalog.timestamptz'::regtype) OR
      (a.attname = 'created_at' AND a.atttypid = 'pg_catalog.timestamptz'::regtype)
    )
  INTO v_catalog_leads_cols_total, v_catalog_leads_cols_matching
  FROM pg_attribute a
  WHERE a.attrelid = 'public.leads'::regclass
    AND a.attnum > 0
    AND NOT a.attisdropped;

  IF v_catalog_leads_cols_total IS DISTINCT FROM 11 OR v_catalog_leads_cols_matching IS DISTINCT FROM 11 THEN
    RAISE EXCEPTION 'CATALOG_CHECK_FAILED: public.leads schema mismatch! Total: %, Matching: % (expected 11/11, fail-closed on regtype)',
      v_catalog_leads_cols_total, v_catalog_leads_cols_matching;
  END IF;

  -- 2. Assert public.quiz_sessions: Total active cols = 14 AND matching cols = 14 using schema-qualified regtype
  SELECT 
    COUNT(*),
    COUNT(*) FILTER (WHERE 
      (a.attname = 'id' AND a.atttypid = 'pg_catalog.uuid'::regtype) OR
      (a.attname = 'campaign_id' AND a.atttypid = 'pg_catalog.uuid'::regtype) OR
      (a.attname = 'status' AND a.atttypid = 'pg_catalog.text'::regtype) OR
      (a.attname = 'total_score' AND a.atttypid = 'pg_catalog.int4'::regtype) OR
      (a.attname = 'correct_count' AND a.atttypid = 'pg_catalog.int2'::regtype) OR
      (a.attname = 'total_questions' AND a.atttypid = 'pg_catalog.int2'::regtype) OR
      (a.attname = 'time_taken_seconds' AND a.atttypid = 'pg_catalog.int4'::regtype) OR
      (a.attname = 'answers_snapshot' AND a.atttypid = 'pg_catalog.jsonb'::regtype) OR
      (a.attname = 'started_at' AND a.atttypid = 'pg_catalog.timestamptz'::regtype) OR
      (a.attname = 'completed_at' AND a.atttypid = 'pg_catalog.timestamptz'::regtype) OR
      (a.attname = 'created_at' AND a.atttypid = 'pg_catalog.timestamptz'::regtype) OR
      (a.attname = 'current_question_index' AND a.atttypid = 'pg_catalog.int2'::regtype) OR
      (a.attname = 'current_question_started_at' AND a.atttypid = 'pg_catalog.timestamptz'::regtype) OR
      (a.attname = 'session_token_hash' AND a.atttypid = 'pg_catalog.text'::regtype)
    )
  INTO v_catalog_sessions_cols_total, v_catalog_sessions_cols_matching
  FROM pg_attribute a
  WHERE a.attrelid = 'public.quiz_sessions'::regclass
    AND a.attnum > 0
    AND NOT a.attisdropped;

  IF v_catalog_sessions_cols_total IS DISTINCT FROM 14 OR v_catalog_sessions_cols_matching IS DISTINCT FROM 14 THEN
    RAISE EXCEPTION 'CATALOG_CHECK_FAILED: public.quiz_sessions schema mismatch! Total: %, Matching: % (expected 14/14, fail-closed on regtype)',
      v_catalog_sessions_cols_total, v_catalog_sessions_cols_matching;
  END IF;

  -- 3. Assert public.campaign_phone_registrations: Total active cols = 5 AND matching cols = 5 using schema-qualified regtype
  SELECT 
    COUNT(*),
    COUNT(*) FILTER (WHERE 
      (a.attname = 'id' AND a.atttypid = 'pg_catalog.uuid'::regtype) OR
      (a.attname = 'campaign_id' AND a.atttypid = 'pg_catalog.uuid'::regtype) OR
      (a.attname = 'phone_hash' AND a.atttypid = 'pg_catalog.text'::regtype) OR
      (a.attname = 'first_lead_id' AND a.atttypid = 'pg_catalog.uuid'::regtype) OR
      (a.attname = 'created_at' AND a.atttypid = 'pg_catalog.timestamptz'::regtype)
    )
  INTO v_catalog_claims_cols_total, v_catalog_claims_cols_matching
  FROM pg_attribute a
  WHERE a.attrelid = 'public.campaign_phone_registrations'::regclass
    AND a.attnum > 0
    AND NOT a.attisdropped;

  IF v_catalog_claims_cols_total IS DISTINCT FROM 5 OR v_catalog_claims_cols_matching IS DISTINCT FROM 5 THEN
    RAISE EXCEPTION 'CATALOG_CHECK_FAILED: public.campaign_phone_registrations schema mismatch! Total: %, Matching: % (expected 5/5, fail-closed on regtype)',
      v_catalog_claims_cols_total, v_catalog_claims_cols_matching;
  END IF;

  -- 4. Assert Primary Key constraints on all 3 tables
  SELECT COUNT(*) INTO v_catalog_pk_valid
  FROM pg_constraint con
  JOIN pg_attribute att ON att.attrelid = con.conrelid AND att.attnum = con.conkey[1]
  WHERE con.contype = 'p'
    AND array_length(con.conkey, 1) = 1
    AND att.attname = 'id'
    AND con.conrelid IN ('public.leads'::regclass, 'public.quiz_sessions'::regclass, 'public.campaign_phone_registrations'::regclass);

  IF v_catalog_pk_valid IS DISTINCT FROM 3 THEN
    RAISE EXCEPTION 'CATALOG_CHECK_FAILED: Primary key constraints invalid on leads, quiz_sessions, or campaign_phone_registrations!';
  END IF;

  -- 5. Assert User-Defined Triggers on public.leads: EXACTLY 0 (excludes internal FK triggers)
  SELECT COUNT(*) INTO v_catalog_triggers_leads_count
  FROM pg_trigger
  WHERE tgrelid = 'public.leads'::regclass
    AND NOT tgisinternal;

  IF v_catalog_triggers_leads_count IS DISTINCT FROM 0 THEN
    RAISE EXCEPTION 'CATALOG_CHECK_FAILED: Unexpected user-defined trigger(s) found on public.leads (count %)', v_catalog_triggers_leads_count;
  END IF;

  -- 6. Assert User-Defined Triggers on public.campaign_phone_registrations: EXACTLY 0
  SELECT COUNT(*) INTO v_catalog_triggers_claims_count
  FROM pg_trigger
  WHERE tgrelid = 'public.campaign_phone_registrations'::regclass
    AND NOT tgisinternal;

  IF v_catalog_triggers_claims_count IS DISTINCT FROM 0 THEN
    RAISE EXCEPTION 'CATALOG_CHECK_FAILED: Unexpected user-defined trigger(s) found on public.campaign_phone_registrations (count %)', v_catalog_triggers_claims_count;
  END IF;

  -- 7. Assert User-Defined Triggers on public.quiz_sessions: EXACTLY 1 (trg_sync_quiz_sessions_token_hash, non-DELETE)
  SELECT COUNT(*) INTO v_catalog_triggers_sessions_count
  FROM pg_trigger
  WHERE tgrelid = 'public.quiz_sessions'::regclass
    AND NOT tgisinternal
    AND tgname = 'trg_sync_quiz_sessions_token_hash'
    AND (tgtype & 8) = 0; -- bit 3 (value 8) represents TRIGGER_TYPE_DELETE

  IF v_catalog_triggers_sessions_count IS DISTINCT FROM 1 THEN
    RAISE EXCEPTION 'CATALOG_CHECK_FAILED: public.quiz_sessions trigger trg_sync_quiz_sessions_token_hash missing or fires on DELETE!';
  END IF;

  SELECT COUNT(*) INTO v_catalog_triggers_sessions_total
  FROM pg_trigger
  WHERE tgrelid = 'public.quiz_sessions'::regclass
    AND NOT tgisinternal;

  IF v_catalog_triggers_sessions_total IS DISTINCT FROM 1 THEN
    RAISE EXCEPTION 'CATALOG_CHECK_FAILED: Unexpected extra user-defined trigger(s) on public.quiz_sessions (expected 1, found %)', v_catalog_triggers_sessions_total;
  END IF;

  -- 8. Assert exactly 1 FK references public.quiz_sessions
  SELECT COUNT(*) INTO v_catalog_fk_quiz_sessions_total
  FROM pg_constraint
  WHERE contype = 'f'
    AND confrelid = 'public.quiz_sessions'::regclass;

  IF v_catalog_fk_quiz_sessions_total IS DISTINCT FROM 1 THEN
    RAISE EXCEPTION 'CATALOG_CHECK_FAILED: Unexpected foreign key count referencing quiz_sessions (expected 1, found %)', v_catalog_fk_quiz_sessions_total;
  END IF;

  -- 9. Assert this FK maps specifically leads(quiz_session_id) -> quiz_sessions(id) with ON DELETE SET NULL, ON UPDATE NO ACTION
  SELECT COUNT(*) INTO v_catalog_fk_quiz_sessions_valid
  FROM pg_constraint con
  JOIN pg_attribute src_att ON src_att.attrelid = con.conrelid AND src_att.attnum = con.conkey[1]
  JOIN pg_attribute ref_att ON ref_att.attrelid = con.confrelid AND ref_att.attnum = con.confkey[1]
  WHERE con.contype = 'f'
    AND con.confrelid = 'public.quiz_sessions'::regclass
    AND con.conrelid = 'public.leads'::regclass
    AND array_length(con.conkey, 1) = 1
    AND array_length(con.confkey, 1) = 1
    AND src_att.attname = 'quiz_session_id'
    AND ref_att.attname = 'id'
    AND con.confdeltype = 'n'
    AND con.confupdtype = 'a'
    AND con.convalidated = true;

  IF v_catalog_fk_quiz_sessions_valid IS DISTINCT FROM 1 THEN
    RAISE EXCEPTION 'CATALOG_CHECK_FAILED: FK leads(quiz_session_id) -> quiz_sessions(id) invalid or missing SET NULL!';
  END IF;

  -- 10. Assert exactly 1 FK in database references public.leads
  SELECT COUNT(*) INTO v_catalog_fk_leads_total
  FROM pg_constraint
  WHERE contype = 'f'
    AND confrelid = 'public.leads'::regclass;

  IF v_catalog_fk_leads_total IS DISTINCT FROM 1 THEN
    RAISE EXCEPTION 'CATALOG_CHECK_FAILED: Unexpected foreign key count referencing leads (expected 1, found %)', v_catalog_fk_leads_total;
  END IF;

  -- 11. Assert this FK maps specifically campaign_phone_registrations(first_lead_id) -> leads(id) with ON DELETE SET NULL, ON UPDATE NO ACTION
  SELECT COUNT(*) INTO v_catalog_fk_leads_valid
  FROM pg_constraint con
  JOIN pg_attribute src_att ON src_att.attrelid = con.conrelid AND src_att.attnum = con.conkey[1]
  JOIN pg_attribute ref_att ON ref_att.attrelid = con.confrelid AND ref_att.attnum = con.confkey[1]
  WHERE con.contype = 'f'
    AND con.confrelid = 'public.leads'::regclass
    AND con.conrelid = 'public.campaign_phone_registrations'::regclass
    AND array_length(con.conkey, 1) = 1
    AND array_length(con.confkey, 1) = 1
    AND src_att.attname = 'first_lead_id'
    AND ref_att.attname = 'id'
    AND con.confdeltype = 'n'
    AND con.confupdtype = 'a'
    AND con.convalidated = true;

  IF v_catalog_fk_leads_valid IS DISTINCT FROM 1 THEN
    RAISE EXCEPTION 'CATALOG_CHECK_FAILED: FK campaign_phone_registrations(first_lead_id) -> leads(id) invalid or missing SET NULL!';
  END IF;

  -- 12. Assert unique constraint uq_campaign_phone_registrations applies to EXACTLY (campaign_id, phone_hash)
  --     and binds directly to a valid, ready unique index (conindid check)
  SELECT COUNT(*) INTO v_catalog_uq_count
  FROM pg_constraint con
  JOIN pg_index idx ON idx.indexrelid = con.conindid
  JOIN pg_attribute att1 ON att1.attrelid = con.conrelid AND att1.attnum = con.conkey[1]
  JOIN pg_attribute att2 ON att2.attrelid = con.conrelid AND att2.attnum = con.conkey[2]
  WHERE con.contype = 'u'
    AND con.conrelid = 'public.campaign_phone_registrations'::regclass
    AND con.conname = 'uq_campaign_phone_registrations'
    AND con.convalidated = true
    AND array_length(con.conkey, 1) = 2
    AND att1.attname = 'campaign_id'
    AND att2.attname = 'phone_hash'
    AND idx.indrelid = 'public.campaign_phone_registrations'::regclass
    AND idx.indisunique = true
    AND idx.indisvalid = true
    AND idx.indisready = true;

  IF v_catalog_uq_count IS DISTINCT FROM 1 THEN
    RAISE EXCEPTION 'CATALOG_CHECK_FAILED: Unique constraint uq_campaign_phone_registrations invalid or backing index not ready!';
  END IF;

  RAISE NOTICE '>>> PHASE 0 PASSED: Catalogs, schema-qualified regtypes, PKs, FKs, UQ, and triggers asserted. <<<';

  -- ==========================================================================
  -- PHASE 1: MACROSCOPIC BASELINE & ROW-LEVEL LOCKING (V18 STRATEGY)
  -- ==========================================================================
  RAISE NOTICE '>>> PHASE 1: ACQUIRING ROW LOCKS (TARGETS: FOR UPDATE, HISTORY: FOR SHARE) <<<';

  -- Macroscopic baseline assertions before mutations
  SELECT COUNT(*) INTO v_baseline_leads_count FROM public.leads;
  IF v_baseline_leads_count IS DISTINCT FROM 3 THEN
    RAISE EXCEPTION 'BASELINE_CHECK_FAILED: Expected exactly 3 leads before cleanup, found %', v_baseline_leads_count;
  END IF;

  SELECT COUNT(*) INTO v_baseline_claims_count FROM public.campaign_phone_registrations;
  IF v_baseline_claims_count IS DISTINCT FROM 2 THEN
    RAISE EXCEPTION 'BASELINE_CHECK_FAILED: Expected exactly 2 claims before cleanup, found %', v_baseline_claims_count;
  END IF;

  SELECT COUNT(*) INTO v_baseline_sessions_count FROM public.quiz_sessions;
  IF v_baseline_sessions_count IS DISTINCT FROM 23 THEN
    RAISE EXCEPTION 'BASELINE_CHECK_FAILED: Expected exactly 23 sessions before cleanup, found %', v_baseline_sessions_count;
  END IF;

  -- 1. Claims Locking: Target Claim (FOR UPDATE), Historical Claim (FOR SHARE)
  SELECT * INTO v_test_claim_record
  FROM public.campaign_phone_registrations
  WHERE id = v_test_claim_id
  FOR UPDATE;

  SELECT * INTO v_hist_claim_record
  FROM public.campaign_phone_registrations
  WHERE id = v_hist_claim_id
  FOR SHARE;

  -- 2. Leads Locking: Target Lead (FOR UPDATE), Historical Leads (FOR SHARE)
  SELECT * INTO v_test_lead_record
  FROM public.leads
  WHERE id = v_test_lead_id
  FOR UPDATE;

  SELECT * INTO v_hist1_record
  FROM public.leads
  WHERE id = v_hist_lead_1_id
  FOR SHARE;

  SELECT * INTO v_hist2_record
  FROM public.leads
  WHERE id = v_hist_lead_2_id
  FOR SHARE;

  -- 3. Sessions Locking: Target Session (FOR UPDATE), Historical Sessions (FOR SHARE)
  SELECT * INTO v_test_session_record
  FROM public.quiz_sessions
  WHERE id = v_test_session_id
  FOR UPDATE;

  SELECT * INTO v_hist_sess1_record
  FROM public.quiz_sessions
  WHERE id = v_hist_session_1_id
  FOR SHARE;

  SELECT * INTO v_hist_sess2_record
  FROM public.quiz_sessions
  WHERE id = v_hist_session_2_id
  FOR SHARE;

  RAISE NOTICE '>>> PHASE 1 PASSED: Baseline validated and row locks acquired. <<<';

  -- ==========================================================================
  -- PHASE 2: EXACT PRECONDITIONS & FK REFERENCING ASSERTIONS
  -- ==========================================================================
  RAISE NOTICE '>>> PHASE 2: EXECUTING PRECONDITIONS & FK REFERENCING ASSERTIONS <<<';

  -- --------------------------------------------------------------------------
  -- A. CRITICAL FOREIGN KEY REFERENCING ASSERTIONS (PREVENTING INDIRECT MODIFICATIONS)
  -- --------------------------------------------------------------------------
  -- Assert EXACTLY 1 Lead references the Smoke Test Session, and that lead is v_test_lead_id
  SELECT COUNT(*), COALESCE(MAX(id), '00000000-0000-0000-0000-000000000000'::UUID)
  INTO v_referencing_leads_count, v_single_referencing_lead_id
  FROM public.leads
  WHERE quiz_session_id = v_test_session_id;

  IF v_referencing_leads_count IS DISTINCT FROM 1 THEN
    RAISE EXCEPTION 'FK_INDIRECT_RISK: Expected exactly 1 lead referencing test session %, found %',
      v_test_session_id, v_referencing_leads_count;
  END IF;

  IF v_single_referencing_lead_id IS DISTINCT FROM v_test_lead_id THEN
    RAISE EXCEPTION 'FK_INDIRECT_RISK: Referencing lead ID % does not match expected test lead ID %',
      v_single_referencing_lead_id, v_test_lead_id;
  END IF;

  -- Assert EXACTLY 1 Claim references the Smoke Test Lead, and that claim is v_test_claim_id
  SELECT COUNT(*), COALESCE(MAX(id), '00000000-0000-0000-0000-000000000000'::UUID)
  INTO v_referencing_claims_count, v_single_referencing_claim_id
  FROM public.campaign_phone_registrations
  WHERE first_lead_id = v_test_lead_id;

  IF v_referencing_claims_count IS DISTINCT FROM 1 THEN
    RAISE EXCEPTION 'FK_INDIRECT_RISK: Expected exactly 1 claim referencing test lead %, found %',
      v_test_lead_id, v_referencing_claims_count;
  END IF;

  IF v_single_referencing_claim_id IS DISTINCT FROM v_test_claim_id THEN
    RAISE EXCEPTION 'FK_INDIRECT_RISK: Referencing claim ID % does not match expected test claim ID %',
      v_single_referencing_claim_id, v_test_claim_id;
  END IF;

  -- --------------------------------------------------------------------------
  -- B. EXACT RECORD CONTENT ASSERTIONS
  -- --------------------------------------------------------------------------
  -- Precondition 1: Historical Lead #1 (All 11 columns verified using canonical UUID)
  IF v_hist1_record.id IS NULL THEN
    RAISE EXCEPTION 'PRECONDITION_FAILED: Historical Lead #1 not found!';
  END IF;
  IF v_hist1_record.campaign_id IS DISTINCT FROM 'a4720a44-f039-4f80-9f00-dfac138af21c'::UUID THEN
    RAISE EXCEPTION 'PRECONDITION_FAILED: Historical Lead #1 campaign_id mismatch';
  END IF;
  IF v_hist1_record.full_name IS DISTINCT FROM 'Nguyen Tran Minh Quan' THEN
    RAISE EXCEPTION 'PRECONDITION_FAILED: Historical Lead #1 full_name mismatch';
  END IF;
  IF v_hist1_record.phone_number IS DISTINCT FROM '0899067427' THEN
    RAISE EXCEPTION 'PRECONDITION_FAILED: Historical Lead #1 phone_number mismatch';
  END IF;
  IF v_hist1_record.masked_phone IS DISTINCT FROM '089***7427' THEN
    RAISE EXCEPTION 'PRECONDITION_FAILED: Historical Lead #1 masked_phone mismatch';
  END IF;
  IF v_hist1_record.score IS DISTINCT FROM 1840 THEN
    RAISE EXCEPTION 'PRECONDITION_FAILED: Historical Lead #1 score mismatch';
  END IF;
  IF v_hist1_record.time_taken_seconds IS DISTINCT FROM 18 THEN
    RAISE EXCEPTION 'PRECONDITION_FAILED: Historical Lead #1 time_taken_seconds mismatch';
  END IF;
  IF v_hist1_record.voucher_code IS DISTINCT FROM 'VIBE20' THEN
    RAISE EXCEPTION 'PRECONDITION_FAILED: Historical Lead #1 voucher_code mismatch';
  END IF;
  IF v_hist1_record.quiz_session_id IS DISTINCT FROM '5438e9fe-b41d-4775-8b75-6c299b5e544b'::UUID THEN
    RAISE EXCEPTION 'PRECONDITION_FAILED: Historical Lead #1 quiz_session_id mismatch';
  END IF;
  IF v_hist1_record.submitted_at IS DISTINCT FROM '2026-11-06 17:23:48.238+00'::TIMESTAMPTZ THEN
    RAISE EXCEPTION 'PRECONDITION_FAILED: Historical Lead #1 submitted_at mismatch';
  END IF;
  IF v_hist1_record.created_at IS DISTINCT FROM '2026-11-06 17:23:48.404002+00'::TIMESTAMPTZ THEN
    RAISE EXCEPTION 'PRECONDITION_FAILED: Historical Lead #1 created_at mismatch';
  END IF;

  -- Precondition 2: Historical Lead #2 (All 11 columns verified)
  IF v_hist2_record.id IS NULL THEN
    RAISE EXCEPTION 'PRECONDITION_FAILED: Historical Lead #2 not found!';
  END IF;
  IF v_hist2_record.campaign_id IS DISTINCT FROM 'a4720a44-f039-4f80-9f00-dfac138af21c'::UUID THEN
    RAISE EXCEPTION 'PRECONDITION_FAILED: Historical Lead #2 campaign_id mismatch';
  END IF;
  IF v_hist2_record.full_name IS DISTINCT FROM 'Nguyen Tran Minh Quan' THEN
    RAISE EXCEPTION 'PRECONDITION_FAILED: Historical Lead #2 full_name mismatch';
  END IF;
  IF v_hist2_record.phone_number IS DISTINCT FROM '0899067427' THEN
    RAISE EXCEPTION 'PRECONDITION_FAILED: Historical Lead #2 phone_number mismatch';
  END IF;
  IF v_hist2_record.masked_phone IS DISTINCT FROM '089***7427' THEN
    RAISE EXCEPTION 'PRECONDITION_FAILED: Historical Lead #2 masked_phone mismatch';
  END IF;
  IF v_hist2_record.score IS DISTINCT FROM 1470 THEN
    RAISE EXCEPTION 'PRECONDITION_FAILED: Historical Lead #2 score mismatch';
  END IF;
  IF v_hist2_record.time_taken_seconds IS DISTINCT FROM 20 THEN
    RAISE EXCEPTION 'PRECONDITION_FAILED: Historical Lead #2 time_taken_seconds mismatch';
  END IF;
  IF v_hist2_record.voucher_code IS DISTINCT FROM 'VIBE20' THEN
    RAISE EXCEPTION 'PRECONDITION_FAILED: Historical Lead #2 voucher_code mismatch';
  END IF;
  IF v_hist2_record.quiz_session_id IS DISTINCT FROM '70e06057-343f-4ab1-8ebb-37199f902ac5'::UUID THEN
    RAISE EXCEPTION 'PRECONDITION_FAILED: Historical Lead #2 quiz_session_id mismatch';
  END IF;
  IF v_hist2_record.submitted_at IS DISTINCT FROM '2026-11-06 17:27:20.06+00'::TIMESTAMPTZ THEN
    RAISE EXCEPTION 'PRECONDITION_FAILED: Historical Lead #2 submitted_at mismatch';
  END IF;
  IF v_hist2_record.created_at IS DISTINCT FROM '2026-11-06 17:27:20.218364+00'::TIMESTAMPTZ THEN
    RAISE EXCEPTION 'PRECONDITION_FAILED: Historical Lead #2 created_at mismatch';
  END IF;

  -- Precondition 3: Smoke Test Lead (All 11 columns verified)
  IF v_test_lead_record.id IS NULL THEN
    RAISE EXCEPTION 'PRECONDITION_FAILED: Smoke Test Lead not found!';
  END IF;
  IF v_test_lead_record.campaign_id IS DISTINCT FROM 'a4720a44-f039-4f80-9f00-dfac138af21c'::UUID THEN
    RAISE EXCEPTION 'PRECONDITION_FAILED: Smoke Test Lead campaign_id mismatch';
  END IF;
  IF v_test_lead_record.full_name IS DISTINCT FROM 'Smoke Test Participant' THEN
    RAISE EXCEPTION 'PRECONDITION_FAILED: Smoke Test Lead full_name mismatch';
  END IF;
  IF v_test_lead_record.phone_number IS DISTINCT FROM '0944349166' THEN
    RAISE EXCEPTION 'PRECONDITION_FAILED: Smoke Test Lead phone_number mismatch';
  END IF;
  IF v_test_lead_record.masked_phone IS DISTINCT FROM '094***9166' THEN
    RAISE EXCEPTION 'PRECONDITION_FAILED: Smoke Test Lead masked_phone mismatch';
  END IF;
  IF v_test_lead_record.score IS DISTINCT FROM 780 THEN
    RAISE EXCEPTION 'PRECONDITION_FAILED: Smoke Test Lead score mismatch';
  END IF;
  IF v_test_lead_record.time_taken_seconds IS DISTINCT FROM 8 THEN
    RAISE EXCEPTION 'PRECONDITION_FAILED: Smoke Test Lead time_taken_seconds mismatch';
  END IF;
  IF v_test_lead_record.voucher_code IS DISTINCT FROM 'VIBE20' THEN
    RAISE EXCEPTION 'PRECONDITION_FAILED: Smoke Test Lead voucher_code mismatch';
  END IF;
  IF v_test_lead_record.quiz_session_id IS DISTINCT FROM v_test_session_id THEN
    RAISE EXCEPTION 'PRECONDITION_FAILED: Smoke Test Lead quiz_session_id mismatch';
  END IF;
  IF v_test_lead_record.submitted_at IS DISTINCT FROM '2026-11-06 18:42:26.095+00'::TIMESTAMPTZ THEN
    RAISE EXCEPTION 'PRECONDITION_FAILED: Smoke Test Lead submitted_at mismatch';
  END IF;
  IF v_test_lead_record.created_at IS DISTINCT FROM '2026-11-06 18:42:26.247837+00'::TIMESTAMPTZ THEN
    RAISE EXCEPTION 'PRECONDITION_FAILED: Smoke Test Lead created_at mismatch';
  END IF;

  -- Precondition 4: Smoke Test Session (All 14 columns verified, including exact JSONB)
  IF v_test_session_record.id IS NULL THEN
    RAISE EXCEPTION 'PRECONDITION_FAILED: Test Session not found!';
  END IF;
  IF v_test_session_record.campaign_id IS DISTINCT FROM 'a4720a44-f039-4f80-9f00-dfac138af21c'::UUID THEN
    RAISE EXCEPTION 'PRECONDITION_FAILED: Test Session campaign_id mismatch';
  END IF;
  IF v_test_session_record.status IS DISTINCT FROM 'completed' THEN
    RAISE EXCEPTION 'PRECONDITION_FAILED: Test Session status mismatch';
  END IF;
  IF v_test_session_record.total_score IS DISTINCT FROM 780 THEN
    RAISE EXCEPTION 'PRECONDITION_FAILED: Test Session total_score mismatch';
  END IF;
  IF v_test_session_record.correct_count IS DISTINCT FROM 2 THEN
    RAISE EXCEPTION 'PRECONDITION_FAILED: Test Session correct_count mismatch';
  END IF;
  IF v_test_session_record.total_questions IS DISTINCT FROM 5 THEN
    RAISE EXCEPTION 'PRECONDITION_FAILED: Test Session total_questions mismatch';
  END IF;
  IF v_test_session_record.time_taken_seconds IS DISTINCT FROM 8 THEN
    RAISE EXCEPTION 'PRECONDITION_FAILED: Test Session time_taken_seconds mismatch';
  END IF;
  IF v_test_session_record.started_at IS DISTINCT FROM '2026-11-06 18:42:12.951+00'::TIMESTAMPTZ THEN
    RAISE EXCEPTION 'PRECONDITION_FAILED: Test Session started_at mismatch';
  END IF;
  IF v_test_session_record.completed_at IS DISTINCT FROM '2026-11-06 18:42:20.933+00'::TIMESTAMPTZ THEN
    RAISE EXCEPTION 'PRECONDITION_FAILED: Test Session completed_at mismatch';
  END IF;
  IF v_test_session_record.created_at IS DISTINCT FROM '2026-11-06 18:42:13.4794+00'::TIMESTAMPTZ THEN
    RAISE EXCEPTION 'PRECONDITION_FAILED: Test Session created_at mismatch';
  END IF;
  IF v_test_session_record.current_question_index IS DISTINCT FROM 5 THEN
    RAISE EXCEPTION 'PRECONDITION_FAILED: Test Session current_question_index mismatch';
  END IF;
  IF v_test_session_record.current_question_started_at IS DISTINCT FROM '2026-11-06 18:42:20.933+00'::TIMESTAMPTZ THEN
    RAISE EXCEPTION 'PRECONDITION_FAILED: Test Session current_question_started_at mismatch';
  END IF;
  IF v_test_session_record.session_token_hash IS DISTINCT FROM '20e59e4ccdae237452958e56f9f414dccae3a0a81e877fd322c6ce9b39a44fb0' THEN
    RAISE EXCEPTION 'PRECONDITION_FAILED: Test Session session_token_hash mismatch';
  END IF;

  -- Exact JSONB semantic comparison for Smoke Test Session answers_snapshot
  IF v_test_session_record.answers_snapshot::jsonb IS DISTINCT FROM '[
    {"isCorrect":false,"pointsAwarded":0,"questionOrder":0,"remainingSeconds":29,"selectedIndex":0},
    {"isCorrect":true,"pointsAwarded":390,"questionOrder":1,"remainingSeconds":29,"selectedIndex":0},
    {"isCorrect":false,"pointsAwarded":0,"questionOrder":2,"remainingSeconds":29,"selectedIndex":0},
    {"isCorrect":true,"pointsAwarded":390,"questionOrder":3,"remainingSeconds":29,"selectedIndex":0},
    {"isCorrect":false,"pointsAwarded":0,"questionOrder":4,"remainingSeconds":29,"selectedIndex":0}
  ]'::jsonb THEN
    RAISE EXCEPTION 'PRECONDITION_FAILED: Test Session answers_snapshot JSONB semantic mismatch!';
  END IF;

  -- Precondition 5: Smoke Test Claim (All 5 columns verified)
  IF v_test_claim_record.id IS NULL THEN
    RAISE EXCEPTION 'PRECONDITION_FAILED: Smoke Test Claim not found!';
  END IF;
  IF v_test_claim_record.campaign_id IS DISTINCT FROM 'a4720a44-f039-4f80-9f00-dfac138af21c'::UUID THEN
    RAISE EXCEPTION 'PRECONDITION_FAILED: Smoke Test Claim campaign_id mismatch';
  END IF;
  IF v_test_claim_record.phone_hash IS DISTINCT FROM '1caad5df133efcd64a164b9b94e17d0cfce07abe7abb73416004c49db3737f99' THEN
    RAISE EXCEPTION 'PRECONDITION_FAILED: Smoke Test Claim phone_hash mismatch';
  END IF;
  IF v_test_claim_record.first_lead_id IS DISTINCT FROM v_test_lead_id THEN
    RAISE EXCEPTION 'PRECONDITION_FAILED: Smoke Test Claim first_lead_id mismatch (expected test lead id)';
  END IF;
  IF v_test_claim_record.created_at IS DISTINCT FROM '2026-11-06 18:42:26.095+00'::TIMESTAMPTZ THEN
    RAISE EXCEPTION 'PRECONDITION_FAILED: Smoke Test Claim created_at mismatch';
  END IF;

  -- Precondition 6: Historical Claim (All 5 columns verified)
  IF v_hist_claim_record.id IS NULL THEN
    RAISE EXCEPTION 'PRECONDITION_FAILED: Historical Claim not found!';
  END IF;
  IF v_hist_claim_record.campaign_id IS DISTINCT FROM 'a4720a44-f039-4f80-9f00-dfac138af21c'::UUID THEN
    RAISE EXCEPTION 'PRECONDITION_FAILED: Historical Claim campaign_id mismatch';
  END IF;
  IF v_hist_claim_record.phone_hash IS DISTINCT FROM 'bff5e75e3c334c172b456a34512c8d1f4223a2abd99d86e2bcb74728272e5eb4' THEN
    RAISE EXCEPTION 'PRECONDITION_FAILED: Historical Claim phone_hash mismatch';
  END IF;
  IF v_hist_claim_record.first_lead_id IS DISTINCT FROM v_hist_lead_1_id THEN
    RAISE EXCEPTION 'PRECONDITION_FAILED: Historical Claim first_lead_id mismatch';
  END IF;
  IF v_hist_claim_record.created_at IS DISTINCT FROM '2026-11-06 17:23:48.238+00'::TIMESTAMPTZ THEN
    RAISE EXCEPTION 'PRECONDITION_FAILED: Historical Claim created_at mismatch';
  END IF;

  -- Precondition 7: Historical Session #1 (All 14 columns verified explicitly, including exact JSONB)
  IF v_hist_sess1_record.id IS NULL THEN
    RAISE EXCEPTION 'PRECONDITION_FAILED: Historical Session #1 not found!';
  END IF;
  IF v_hist_sess1_record.campaign_id IS DISTINCT FROM 'a4720a44-f039-4f80-9f00-dfac138af21c'::UUID THEN
    RAISE EXCEPTION 'PRECONDITION_FAILED: Historical Session #1 campaign_id mismatch';
  END IF;
  IF v_hist_sess1_record.status IS DISTINCT FROM 'completed' THEN
    RAISE EXCEPTION 'PRECONDITION_FAILED: Historical Session #1 status mismatch';
  END IF;
  IF v_hist_sess1_record.total_score IS DISTINCT FROM 1840 THEN
    RAISE EXCEPTION 'PRECONDITION_FAILED: Historical Session #1 total_score mismatch';
  END IF;
  IF v_hist_sess1_record.correct_count IS DISTINCT FROM 5 THEN
    RAISE EXCEPTION 'PRECONDITION_FAILED: Historical Session #1 correct_count mismatch';
  END IF;
  IF v_hist_sess1_record.total_questions IS DISTINCT FROM 5 THEN
    RAISE EXCEPTION 'PRECONDITION_FAILED: Historical Session #1 total_questions mismatch';
  END IF;
  IF v_hist_sess1_record.time_taken_seconds IS DISTINCT FROM 18 THEN
    RAISE EXCEPTION 'PRECONDITION_FAILED: Historical Session #1 time_taken_seconds mismatch';
  END IF;
  IF v_hist_sess1_record.started_at IS DISTINCT FROM '2026-11-06 17:23:14.751+00'::TIMESTAMPTZ THEN
    RAISE EXCEPTION 'PRECONDITION_FAILED: Historical Session #1 started_at mismatch';
  END IF;
  IF v_hist_sess1_record.completed_at IS DISTINCT FROM '2026-11-06 17:23:33.145+00'::TIMESTAMPTZ THEN
    RAISE EXCEPTION 'PRECONDITION_FAILED: Historical Session #1 completed_at mismatch';
  END IF;
  IF v_hist_sess1_record.created_at IS DISTINCT FROM '2026-11-06 17:23:14.903166+00'::TIMESTAMPTZ THEN
    RAISE EXCEPTION 'PRECONDITION_FAILED: Historical Session #1 created_at mismatch';
  END IF;
  IF v_hist_sess1_record.current_question_index IS DISTINCT FROM 5 THEN
    RAISE EXCEPTION 'PRECONDITION_FAILED: Historical Session #1 current_question_index mismatch';
  END IF;
  IF v_hist_sess1_record.current_question_started_at IS DISTINCT FROM '2026-11-06 17:23:33.145+00'::TIMESTAMPTZ THEN
    RAISE EXCEPTION 'PRECONDITION_FAILED: Historical Session #1 current_question_started_at mismatch';
  END IF;
  IF v_hist_sess1_record.session_token_hash IS DISTINCT FROM '46c18925b5d882f96c69c9e3d9947cda00e07c8d6db90b41363be75281c76019' THEN
    RAISE EXCEPTION 'PRECONDITION_FAILED: Historical Session #1 session_token_hash mismatch';
  END IF;

  -- Exact JSONB semantic comparison for Historical Session #1 answers_snapshot
  IF v_hist_sess1_record.answers_snapshot::jsonb IS DISTINCT FROM '[
    {"isCorrect":true,"pointsAwarded":360,"questionOrder":0,"remainingSeconds":26,"selectedIndex":1},
    {"isCorrect":true,"pointsAwarded":370,"questionOrder":1,"remainingSeconds":27,"selectedIndex":0},
    {"isCorrect":true,"pointsAwarded":360,"questionOrder":2,"remainingSeconds":26,"selectedIndex":1},
    {"isCorrect":true,"pointsAwarded":370,"questionOrder":3,"remainingSeconds":27,"selectedIndex":0},
    {"isCorrect":true,"pointsAwarded":380,"questionOrder":4,"remainingSeconds":28,"selectedIndex":2}
  ]'::jsonb THEN
    RAISE EXCEPTION 'PRECONDITION_FAILED: Historical Session #1 answers_snapshot JSONB semantic mismatch!';
  END IF;

  -- Precondition 8: Historical Session #2 (All 14 columns verified explicitly, including exact JSONB)
  IF v_hist_sess2_record.id IS NULL THEN
    RAISE EXCEPTION 'PRECONDITION_FAILED: Historical Session #2 not found!';
  END IF;
  IF v_hist_sess2_record.campaign_id IS DISTINCT FROM 'a4720a44-f039-4f80-9f00-dfac138af21c'::UUID THEN
    RAISE EXCEPTION 'PRECONDITION_FAILED: Historical Session #2 campaign_id mismatch';
  END IF;
  IF v_hist_sess2_record.status IS DISTINCT FROM 'completed' THEN
    RAISE EXCEPTION 'PRECONDITION_FAILED: Historical Session #2 status mismatch';
  END IF;
  IF v_hist_sess2_record.total_score IS DISTINCT FROM 1470 THEN
    RAISE EXCEPTION 'PRECONDITION_FAILED: Historical Session #2 total_score mismatch';
  END IF;
  IF v_hist_sess2_record.correct_count IS DISTINCT FROM 4 THEN
    RAISE EXCEPTION 'PRECONDITION_FAILED: Historical Session #2 correct_count mismatch';
  END IF;
  IF v_hist_sess2_record.total_questions IS DISTINCT FROM 5 THEN
    RAISE EXCEPTION 'PRECONDITION_FAILED: Historical Session #2 total_questions mismatch';
  END IF;
  IF v_hist_sess2_record.time_taken_seconds IS DISTINCT FROM 20 THEN
    RAISE EXCEPTION 'PRECONDITION_FAILED: Historical Session #2 time_taken_seconds mismatch';
  END IF;
  IF v_hist_sess2_record.started_at IS DISTINCT FROM '2026-11-06 17:26:24.983+00'::TIMESTAMPTZ THEN
    RAISE EXCEPTION 'PRECONDITION_FAILED: Historical Session #2 started_at mismatch';
  END IF;
  IF v_hist_sess2_record.completed_at IS DISTINCT FROM '2026-11-06 17:26:45.469+00'::TIMESTAMPTZ THEN
    RAISE EXCEPTION 'PRECONDITION_FAILED: Historical Session #2 completed_at mismatch';
  END IF;
  IF v_hist_sess2_record.created_at IS DISTINCT FROM '2026-11-06 17:26:25.522607+00'::TIMESTAMPTZ THEN
    RAISE EXCEPTION 'PRECONDITION_FAILED: Historical Session #2 created_at mismatch';
  END IF;
  IF v_hist_sess2_record.current_question_index IS DISTINCT FROM 5 THEN
    RAISE EXCEPTION 'PRECONDITION_FAILED: Historical Session #2 current_question_index mismatch';
  END IF;
  IF v_hist_sess2_record.current_question_started_at IS DISTINCT FROM '2026-11-06 17:26:45.469+00'::TIMESTAMPTZ THEN
    RAISE EXCEPTION 'PRECONDITION_FAILED: Historical Session #2 current_question_started_at mismatch';
  END IF;
  IF v_hist_sess2_record.session_token_hash IS DISTINCT FROM 'b0a10596ec1889531f9e75ddee8cd6e2857dde329dbe5117072f81a3d6b455dc' THEN
    RAISE EXCEPTION 'PRECONDITION_FAILED: Historical Session #2 session_token_hash mismatch';
  END IF;

  -- Exact JSONB semantic comparison for Historical Session #2 answers_snapshot
  IF v_hist_sess2_record.answers_snapshot::jsonb IS DISTINCT FROM '[
    {"isCorrect":true,"pointsAwarded":360,"questionOrder":0,"remainingSeconds":26,"selectedIndex":1},
    {"isCorrect":false,"pointsAwarded":0,"questionOrder":1,"remainingSeconds":26,"selectedIndex":1},
    {"isCorrect":true,"pointsAwarded":370,"questionOrder":2,"remainingSeconds":27,"selectedIndex":1},
    {"isCorrect":true,"pointsAwarded":370,"questionOrder":3,"remainingSeconds":27,"selectedIndex":0},
    {"isCorrect":true,"pointsAwarded":370,"questionOrder":4,"remainingSeconds":27,"selectedIndex":2}
  ]'::jsonb THEN
    RAISE EXCEPTION 'PRECONDITION_FAILED: Historical Session #2 answers_snapshot JSONB semantic mismatch!';
  END IF;

  RAISE NOTICE '>>> PHASE 2 PASSED: All 8 records verified via strict NULL-safe comparisons and exact JSONB. <<<';

  -- ==========================================================================
  -- PHASE 3: STRICTLY THREE DATA MUTATIONS (WITH ROW_COUNT ASSERTIONS)
  -- ==========================================================================
  RAISE NOTICE '>>> PHASE 3: EXECUTING CONTROLLED DATA MUTATIONS <<<';

  -- 1. Disassociate Lead from Test Claim (Set first_lead_id = NULL)
  UPDATE public.campaign_phone_registrations
  SET first_lead_id = NULL
  WHERE id = v_test_claim_id
    AND campaign_id = 'a4720a44-f039-4f80-9f00-dfac138af21c'
    AND phone_hash = '1caad5df133efcd64a164b9b94e17d0cfce07abe7abb73416004c49db3737f99'
    AND first_lead_id = v_test_lead_id;

  GET DIAGNOSTICS v_rows_updated = ROW_COUNT;
  IF v_rows_updated IS DISTINCT FROM 1 THEN
    RAISE EXCEPTION 'MUTATION_FAILED: Expected exactly 1 row updated on campaign_phone_registrations, got %', v_rows_updated;
  END IF;

  -- 2. Delete Smoke Test Lead
  DELETE FROM public.leads
  WHERE id = v_test_lead_id
    AND campaign_id = 'a4720a44-f039-4f80-9f00-dfac138af21c'
    AND quiz_session_id = v_test_session_id
    AND phone_number = '0944349166';

  GET DIAGNOSTICS v_rows_deleted = ROW_COUNT;
  IF v_rows_deleted IS DISTINCT FROM 1 THEN
    RAISE EXCEPTION 'MUTATION_FAILED: Expected exactly 1 row deleted from leads, got %', v_rows_deleted;
  END IF;

  -- 3. Delete Smoke Test Quiz Session
  DELETE FROM public.quiz_sessions
  WHERE id = v_test_session_id
    AND campaign_id = 'a4720a44-f039-4f80-9f00-dfac138af21c'
    AND status = 'completed'
    AND total_score = 780;

  GET DIAGNOSTICS v_rows_deleted = ROW_COUNT;
  IF v_rows_deleted IS DISTINCT FROM 1 THEN
    RAISE EXCEPTION 'MUTATION_FAILED: Expected exactly 1 row deleted from quiz_sessions, got %', v_rows_deleted;
  END IF;

  RAISE NOTICE '>>> PHASE 3 PASSED: Exactly 3 mutations executed with ROW_COUNT = 1 assertions. <<<';

  -- ==========================================================================
  -- PHASE 4: POSTCONDITIONS & HISTORICAL INVARIANCE VERIFICATION
  -- ==========================================================================
  RAISE NOTICE '>>> PHASE 4: VERIFYING POSTCONDITIONS & HISTORICAL INVARIANCE <<<';

  -- Postcondition 1: Assert Smoke Test Lead is completely deleted
  SELECT COUNT(*) INTO v_check_count FROM public.leads WHERE id = v_test_lead_id;
  IF v_check_count IS DISTINCT FROM 0 THEN
    RAISE EXCEPTION 'POSTCONDITION_FAILED: Smoke Test Lead still exists in public.leads!';
  END IF;

  -- Postcondition 2: Assert Smoke Test Session is completely deleted
  SELECT COUNT(*) INTO v_check_count FROM public.quiz_sessions WHERE id = v_test_session_id;
  IF v_check_count IS DISTINCT FROM 0 THEN
    RAISE EXCEPTION 'POSTCONDITION_FAILED: Smoke Test Session still exists in public.quiz_sessions!';
  END IF;

  -- Postcondition 3: Historical Lead #1 exists and retains all 11 original columns
  SELECT COUNT(*) INTO v_check_count
  FROM public.leads
  WHERE id = v_hist_lead_1_id
    AND campaign_id = 'a4720a44-f039-4f80-9f00-dfac138af21c'
    AND full_name = 'Nguyen Tran Minh Quan'
    AND phone_number = '0899067427'
    AND masked_phone = '089***7427'
    AND score = 1840
    AND time_taken_seconds = 18
    AND voucher_code = 'VIBE20'
    AND quiz_session_id = '5438e9fe-b41d-4775-8b75-6c299b5e544b'
    AND submitted_at = '2026-11-06 17:23:48.238+00'::TIMESTAMPTZ
    AND created_at = '2026-11-06 17:23:48.404002+00'::TIMESTAMPTZ;
  IF v_check_count IS DISTINCT FROM 1 THEN
    RAISE EXCEPTION 'POSTCONDITION_FAILED: Historical Lead #1 compromised or modified!';
  END IF;

  -- Postcondition 4: Historical Lead #2 exists and retains all 11 original columns
  SELECT COUNT(*) INTO v_check_count
  FROM public.leads
  WHERE id = v_hist_lead_2_id
    AND campaign_id = 'a4720a44-f039-4f80-9f00-dfac138af21c'
    AND full_name = 'Nguyen Tran Minh Quan'
    AND phone_number = '0899067427'
    AND masked_phone = '089***7427'
    AND score = 1470
    AND time_taken_seconds = 20
    AND voucher_code = 'VIBE20'
    AND quiz_session_id = '70e06057-343f-4ab1-8ebb-37199f902ac5'
    AND submitted_at = '2026-11-06 17:27:20.06+00'::TIMESTAMPTZ
    AND created_at = '2026-11-06 17:27:20.218364+00'::TIMESTAMPTZ;
  IF v_check_count IS DISTINCT FROM 1 THEN
    RAISE EXCEPTION 'POSTCONDITION_FAILED: Historical Lead #2 compromised or modified!';
  END IF;

  -- Postcondition 5: Total Leads count is exactly 2 (macroscopic check: 3 - 1 = 2)
  SELECT COUNT(*) INTO v_check_count FROM public.leads;
  IF v_check_count IS DISTINCT FROM 2 THEN
    RAISE EXCEPTION 'POSTCONDITION_FAILED: Total leads count is not 2 (found %)', v_check_count;
  END IF;

  -- Postcondition 6: Historical Session #1 exists and retains all 14 original columns (including exact answers_snapshot)
  SELECT COUNT(*) INTO v_check_count
  FROM public.quiz_sessions
  WHERE id = v_hist_session_1_id
    AND campaign_id = 'a4720a44-f039-4f80-9f00-dfac138af21c'
    AND status = 'completed'
    AND total_score = 1840
    AND correct_count = 5
    AND total_questions = 5
    AND time_taken_seconds = 18
    AND started_at = '2026-11-06 17:23:14.751+00'::TIMESTAMPTZ
    AND completed_at = '2026-11-06 17:23:33.145+00'::TIMESTAMPTZ
    AND created_at = '2026-11-06 17:23:14.903166+00'::TIMESTAMPTZ
    AND current_question_index = 5
    AND current_question_started_at = '2026-11-06 17:23:33.145+00'::TIMESTAMPTZ
    AND session_token_hash = '46c18925b5d882f96c69c9e3d9947cda00e07c8d6db90b41363be75281c76019'
    AND answers_snapshot = '[
      {"isCorrect":true,"pointsAwarded":360,"questionOrder":0,"remainingSeconds":26,"selectedIndex":1},
      {"isCorrect":true,"pointsAwarded":370,"questionOrder":1,"remainingSeconds":27,"selectedIndex":0},
      {"isCorrect":true,"pointsAwarded":360,"questionOrder":2,"remainingSeconds":26,"selectedIndex":1},
      {"isCorrect":true,"pointsAwarded":370,"questionOrder":3,"remainingSeconds":27,"selectedIndex":0},
      {"isCorrect":true,"pointsAwarded":380,"questionOrder":4,"remainingSeconds":28,"selectedIndex":2}
    ]'::jsonb;
  IF v_check_count IS DISTINCT FROM 1 THEN
    RAISE EXCEPTION 'POSTCONDITION_FAILED: Historical Session #1 compromised or modified (14-column assertion failed)!';
  END IF;

  -- Postcondition 7: Historical Session #2 exists and retains all 14 original columns (including exact answers_snapshot)
  SELECT COUNT(*) INTO v_check_count
  FROM public.quiz_sessions
  WHERE id = v_hist_session_2_id
    AND campaign_id = 'a4720a44-f039-4f80-9f00-dfac138af21c'
    AND status = 'completed'
    AND total_score = 1470
    AND correct_count = 4
    AND total_questions = 5
    AND time_taken_seconds = 20
    AND started_at = '2026-11-06 17:26:24.983+00'::TIMESTAMPTZ
    AND completed_at = '2026-11-06 17:26:45.469+00'::TIMESTAMPTZ
    AND created_at = '2026-11-06 17:26:25.522607+00'::TIMESTAMPTZ
    AND current_question_index = 5
    AND current_question_started_at = '2026-11-06 17:26:45.469+00'::TIMESTAMPTZ
    AND session_token_hash = 'b0a10596ec1889531f9e75ddee8cd6e2857dde329dbe5117072f81a3d6b455dc'
    AND answers_snapshot = '[
      {"isCorrect":true,"pointsAwarded":360,"questionOrder":0,"remainingSeconds":26,"selectedIndex":1},
      {"isCorrect":false,"pointsAwarded":0,"questionOrder":1,"remainingSeconds":26,"selectedIndex":1},
      {"isCorrect":true,"pointsAwarded":370,"questionOrder":2,"remainingSeconds":27,"selectedIndex":1},
      {"isCorrect":true,"pointsAwarded":370,"questionOrder":3,"remainingSeconds":27,"selectedIndex":0},
      {"isCorrect":true,"pointsAwarded":370,"questionOrder":4,"remainingSeconds":27,"selectedIndex":2}
    ]'::jsonb;
  IF v_check_count IS DISTINCT FROM 1 THEN
    RAISE EXCEPTION 'POSTCONDITION_FAILED: Historical Session #2 compromised or modified (14-column assertion failed)!';
  END IF;

  -- Postcondition 8: Total Sessions count is exactly 22 (macroscopic check: 23 - 1 = 22)
  SELECT COUNT(*) INTO v_check_count FROM public.quiz_sessions;
  IF v_check_count IS DISTINCT FROM 22 THEN
    RAISE EXCEPTION 'POSTCONDITION_FAILED: Total sessions count is not 22 (found %)', v_check_count;
  END IF;

  -- Postcondition 9: Test Claim exists, retains all 5 columns (with first_lead_id IS NULL)
  SELECT COUNT(*) INTO v_check_count
  FROM public.campaign_phone_registrations
  WHERE id = v_test_claim_id
    AND campaign_id = 'a4720a44-f039-4f80-9f00-dfac138af21c'
    AND phone_hash = '1caad5df133efcd64a164b9b94e17d0cfce07abe7abb73416004c49db3737f99'
    AND created_at = '2026-11-06 18:42:26.095+00'::TIMESTAMPTZ
    AND first_lead_id IS NULL;
  IF v_check_count IS DISTINCT FROM 1 THEN
    RAISE EXCEPTION 'POSTCONDITION_FAILED: Test Claim state invalid! Expected preserved claim with first_lead_id = NULL';
  END IF;

  -- Postcondition 10: Historical Claim exists, all 5 columns unchanged
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

  RAISE NOTICE '>>> ALL PRECONDITIONS, MUTATIONS, AND POSTCONDITIONS VERIFIED SUCCESSFULLY (V18 FINAL) <<<';
END $$;

COMMIT;
