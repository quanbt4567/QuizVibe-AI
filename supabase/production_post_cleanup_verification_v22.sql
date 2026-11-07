-- ============================================================================
-- QUIZVIBE AI - PRODUCTION POST-CLEANUP VERIFICATION (V22 READ-ONLY AUDIT)
-- TARGET: Verify Cleaned State & Absolute Integrity of Preserved Production Data
-- SCOPE: Strictly READ-ONLY. Zero DML mutations.
--
-- TARGET RECORDS (VERIFIED PURGED / DISASSOCIATED):
--   - Smoke Test Claim:   '33581da6-24ac-482b-b37d-7bacc53be80d' (first_lead_id IS NULL)
--   - Smoke Test Lead:    '2eee5fc6-ea40-4aff-9cad-15f6e756555d' (MUST BE ABSENT / 0 ROWS)
--   - Smoke Test Session: 'e1d59ea1-5ea2-4ea7-b1ed-e1ec44ca9453' (MUST BE ABSENT / 0 ROWS)
--
-- PRESERVED HISTORICAL RECORDS:
--   - Historical Lead #1:    '819a82dd-aae3-4bf6-a850-e0db78b77cfb' (CANONICAL UUID, score 1840)
--   - Historical Lead #2:    'a9eb7f01-2817-4476-a404-613d92601ef2' (score 1470)
--   - Historical Session #1: '5438e9fe-b41d-4775-8b75-6c299b5e544b' (score 1840, token hash 46c18925...)
--   - Historical Session #2: '70e06057-343f-4ab1-8ebb-37199f902ac5' (score 1470, token hash b0a10596...)
--   - Historical Claim:      '99bc1e11-05a0-4ce2-9305-e3ccdd0022ff'
-- ============================================================================

DO $$
DECLARE
  v_smoke_claim_id    UUID := '33581da6-24ac-482b-b37d-7bacc53be80d';
  v_smoke_lead_id     UUID := '2eee5fc6-ea40-4aff-9cad-15f6e756555d';
  v_smoke_session_id  UUID := 'e1d59ea1-5ea2-4ea7-b1ed-e1ec44ca9453';

  v_hist_lead_1_id    UUID := '819a82dd-aae3-4bf6-a850-e0db78b77cfb';
  v_hist_lead_2_id    UUID := 'a9eb7f01-2817-4476-a404-613d92601ef2';
  v_hist_session_1_id UUID := '5438e9fe-b41d-4775-8b75-6c299b5e544b';
  v_hist_session_2_id UUID := '70e06057-343f-4ab1-8ebb-37199f902ac5';
  v_hist_claim_id     UUID := '99bc1e11-05a0-4ce2-9305-e3ccdd0022ff';

  v_check_count       INT;

  -- Historical session snapshot variables
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

  -- --------------------------------------------------------------------------
  -- 1. ASSERT TARGET SMOKE LEAD IS COMPLETELY DELETED
  -- --------------------------------------------------------------------------
  SELECT COUNT(*) INTO v_check_count
  FROM public.leads
  WHERE id = v_smoke_lead_id;

  IF v_check_count IS DISTINCT FROM 0 THEN
    RAISE EXCEPTION 'VERIFICATION_FAILED: Target smoke lead % still exists in public.leads!', v_smoke_lead_id;
  END IF;

  -- --------------------------------------------------------------------------
  -- 2. ASSERT TARGET SMOKE SESSION IS COMPLETELY DELETED
  -- --------------------------------------------------------------------------
  SELECT COUNT(*) INTO v_check_count
  FROM public.quiz_sessions
  WHERE id = v_smoke_session_id;

  IF v_check_count IS DISTINCT FROM 0 THEN
    RAISE EXCEPTION 'VERIFICATION_FAILED: Target smoke session % still exists in public.quiz_sessions!', v_smoke_session_id;
  END IF;

  -- --------------------------------------------------------------------------
  -- 3. ASSERT TARGET SMOKE CLAIM IS DISASSOCIATED (first_lead_id IS NULL)
  -- --------------------------------------------------------------------------
  SELECT COUNT(*) INTO v_check_count
  FROM public.campaign_phone_registrations
  WHERE id = v_smoke_claim_id
    AND campaign_id = 'a4720a44-f039-4f80-9f00-dfac138af21c'::UUID
    AND phone_hash = '1caad5df133efcd64a164b9b94e17d0cfce07abe7abb73416004c49db3737f99'
    AND first_lead_id IS NULL;

  IF v_check_count IS DISTINCT FROM 1 THEN
    RAISE EXCEPTION 'VERIFICATION_FAILED: Target smoke claim % does not exist or has non-null first_lead_id!', v_smoke_claim_id;
  END IF;

  -- --------------------------------------------------------------------------
  -- 4. ASSERT EXACT TABLE COUNTS (POST-CLEANUP BASELINE)
  -- --------------------------------------------------------------------------
  SELECT COUNT(*) INTO v_check_count FROM public.leads;
  IF v_check_count IS DISTINCT FROM 2 THEN
    RAISE EXCEPTION 'VERIFICATION_FAILED: Expected exactly 2 leads in public.leads post-cleanup; found %', v_check_count;
  END IF;

  SELECT COUNT(*) INTO v_check_count FROM public.campaign_phone_registrations;
  IF v_check_count IS DISTINCT FROM 2 THEN
    RAISE EXCEPTION 'VERIFICATION_FAILED: Expected exactly 2 claims in public.campaign_phone_registrations; found %', v_check_count;
  END IF;

  SELECT COUNT(*) INTO v_check_count FROM public.quiz_sessions;
  IF v_check_count IS DISTINCT FROM 22 THEN
    RAISE EXCEPTION 'VERIFICATION_FAILED: Expected exactly 22 sessions in public.quiz_sessions post-cleanup; found %', v_check_count;
  END IF;

  -- --------------------------------------------------------------------------
  -- 5. ASSERT PRESERVED HISTORICAL LEADS
  -- --------------------------------------------------------------------------
  SELECT COUNT(*) INTO v_check_count
  FROM public.leads
  WHERE id = v_hist_lead_1_id
    AND campaign_id = 'a4720a44-f039-4f80-9f00-dfac138af21c'::UUID
    AND quiz_session_id = '5438e9fe-b41d-4775-8b75-6c299b5e544b'::UUID
    AND full_name = 'Nguyen Tran Minh Quan'
    AND phone_number = '0899067427'
    AND masked_phone = '089***7427'
    AND score = 1840
    AND time_taken_seconds = 18
    AND voucher_code = 'VIBE20'
    AND submitted_at = '2026-11-06 17:23:48.238+00'::TIMESTAMPTZ
    AND created_at = '2026-11-06 17:23:48.404002+00'::TIMESTAMPTZ;

  IF v_check_count IS DISTINCT FROM 1 THEN
    RAISE EXCEPTION 'VERIFICATION_FAILED: Historical Lead #1 missing or corrupted!';
  END IF;

  SELECT COUNT(*) INTO v_check_count
  FROM public.leads
  WHERE id = v_hist_lead_2_id
    AND campaign_id = 'a4720a44-f039-4f80-9f00-dfac138af21c'::UUID
    AND quiz_session_id = '70e06057-343f-4ab1-8ebb-37199f902ac5'::UUID
    AND full_name = 'Nguyen Tran Minh Quan'
    AND phone_number = '0899067427'
    AND masked_phone = '089***7427'
    AND score = 1470
    AND time_taken_seconds = 20
    AND voucher_code = 'VIBE20'
    AND submitted_at = '2026-11-06 17:27:20.06+00'::TIMESTAMPTZ
    AND created_at = '2026-11-06 17:27:20.218364+00'::TIMESTAMPTZ;

  IF v_check_count IS DISTINCT FROM 1 THEN
    RAISE EXCEPTION 'VERIFICATION_FAILED: Historical Lead #2 missing or corrupted!';
  END IF;

  -- --------------------------------------------------------------------------
  -- 6. ASSERT PRESERVED HISTORICAL CLAIM
  -- --------------------------------------------------------------------------
  SELECT COUNT(*) INTO v_check_count
  FROM public.campaign_phone_registrations
  WHERE id = v_hist_claim_id
    AND campaign_id = 'a4720a44-f039-4f80-9f00-dfac138af21c'::UUID
    AND phone_hash = 'bff5e75e3c334c172b456a34512c8d1f4223a2abd99d86e2bcb74728272e5eb4'
    AND first_lead_id = v_hist_lead_1_id
    AND created_at = '2026-11-06 17:23:48.238+00'::TIMESTAMPTZ;

  IF v_check_count IS DISTINCT FROM 1 THEN
    RAISE EXCEPTION 'VERIFICATION_FAILED: Historical Claim missing or corrupted!';
  END IF;

  -- --------------------------------------------------------------------------
  -- 7. FULL 14-COLUMN & JSONB VERIFICATION: HISTORICAL SESSION #1
  -- --------------------------------------------------------------------------
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

  IF NOT FOUND THEN
    RAISE EXCEPTION 'VERIFICATION_FAILED: Historical Session #1 (%) does not exist in public.quiz_sessions!', v_hist_session_1_id;
  END IF;

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
    RAISE EXCEPTION 'VERIFICATION_FAILED: Historical Session #1 has corrupted or mismatched values!';
  END IF;

  -- --------------------------------------------------------------------------
  -- 8. FULL 14-COLUMN & JSONB VERIFICATION: HISTORICAL SESSION #2
  -- --------------------------------------------------------------------------
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

  IF NOT FOUND THEN
    RAISE EXCEPTION 'VERIFICATION_FAILED: Historical Session #2 (%) does not exist in public.quiz_sessions!', v_hist_session_2_id;
  END IF;

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
    RAISE EXCEPTION 'VERIFICATION_FAILED: Historical Session #2 has corrupted or mismatched values!';
  END IF;

  -- --------------------------------------------------------------------------
  -- 9. FOREIGN KEY REFERENTIAL INTEGRITY RE-VERIFICATION
  -- --------------------------------------------------------------------------
  SELECT COUNT(*) INTO v_check_count
  FROM public.leads l
  LEFT JOIN public.quiz_sessions qs ON l.quiz_session_id = qs.id
  WHERE l.quiz_session_id IS NOT NULL
  AND qs.id IS NULL;

  IF v_check_count IS DISTINCT FROM 0 THEN
    RAISE EXCEPTION
        USING MESSAGE =
        'VERIFICATION_FAILED: Found '
        || v_check_count::TEXT
        || ' leads referencing non-existent quiz_sessions!';
  END IF;

  SELECT COUNT(*) INTO v_check_count
  FROM public.campaign_phone_registrations c
  LEFT JOIN public.leads l ON c.first_lead_id = l.id
  WHERE c.first_lead_id IS NOT NULL AND l.id IS NULL;

  IF v_check_count IS DISTINCT FROM 0 THEN
    RAISE EXCEPTION 'VERIFICATION_FAILED: Found % claims referencing non-existent leads!', v_check_count;
  END IF;

  RAISE NOTICE '>>> PRODUCTION POST-CLEANUP VERIFICATION PASSED (100%% INTACT & CLEAN) <<<';
  RAISE NOTICE 'Total Active Leads: 2 (Historical #1 & #2 fully preserved)';
  RAISE NOTICE 'Total Active Claims: 2 (Smoke Claim disassociated, Historical Claim linked)';
  RAISE NOTICE 'Total Quiz Sessions: 22 (Smoke Session purged, 2 Historical Sessions preserved, 20 other campaign sessions intact)';
  RAISE NOTICE 'Target Smoke Lead (2eee5fc6): PURGED (0 rows)';
  RAISE NOTICE 'Target Smoke Session (e1d59ea1): PURGED (0 rows)';
  RAISE NOTICE 'All 14 columns + exact JSONB of Historical Sessions: 100%% VALIDATED';
END $$;

