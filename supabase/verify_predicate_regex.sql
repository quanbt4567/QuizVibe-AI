-- ============================================================================
-- Validation Script: verify_predicate_regex.sql
-- Project: QuizVibe AI — Phase 5.2.14
-- Purpose: Reproducible test of PostgreSQL 17.11 partial index predicate regex.
--          Validates semantic equivalence to exactly "WHERE session_token_hash IS NOT NULL"
--          and rejects any composite, disjunctive, or alternate predicates.
-- Run in:  Supabase SQL Editor or psql (strictly read-only test, zero table mutations).
-- ============================================================================

DO $$
DECLARE
  v_regex TEXT := '^\s*\(+\s*session_token_hash\s+IS\s+NOT\s+NULL\s*\)+\s*$';
  v_valid_predicates TEXT[] := ARRAY[
    '(session_token_hash IS NOT NULL)',
    '((session_token_hash IS NOT NULL))',
    '(((session_token_hash IS NOT NULL)))',
    ' (session_token_hash IS NOT NULL) ',
    '(  session_token_hash   IS   NOT   NULL  )',
    '(session_token_hash is not null)',
    '(SESSION_TOKEN_HASH IS NOT NULL)',
    '( Session_Token_Hash IS NOT NULL )'
  ];
  v_invalid_predicates TEXT[] := ARRAY[
    '(session_token_hash IS NOT NULL AND status = ''in_progress'')',
    '((session_token_hash IS NOT NULL) AND (status = ''in_progress''::text))',
    '((session_token_hash IS NOT NULL) OR (session_token IS NOT NULL))',
    '(session_token_hash IS NOT NULL OR true)',
    '(session_token IS NOT NULL)',
    '(session_token_hash IS NULL)',
    '(session_token_hash = ''abc'')',
    '(status = ''active'')',
    'session_token_hash IS NOT NULL',
    '(session_token_hash IS NOT NULL); DROP TABLE quiz_sessions;',
    'NOT (session_token_hash IS NULL)',
    ''
  ];
  v_pred TEXT;
  v_match BOOLEAN;
BEGIN
  -- 1. Test all valid predicates: MUST match
  FOREACH v_pred IN ARRAY v_valid_predicates LOOP
    v_match := (v_pred ~* v_regex);
    IF NOT v_match THEN
      RAISE EXCEPTION 'TEST FAILED: Valid predicate "%" failed to match regex "%"', v_pred, v_regex;
    END IF;
  END LOOP;

  -- 2. Test all invalid predicates: MUST NOT match
  FOREACH v_pred IN ARRAY v_invalid_predicates LOOP
    v_match := (v_pred ~* v_regex);
    IF v_match THEN
      RAISE EXCEPTION 'TEST FAILED: Invalid predicate "%" improperly matched regex "%"', v_pred, v_regex;
    END IF;
  END LOOP;

  RAISE NOTICE 'SUCCESS: All % valid predicates matched and all % invalid predicates were strictly rejected by regex.',
    array_length(v_valid_predicates, 1),
    array_length(v_invalid_predicates, 1);
END $$;

