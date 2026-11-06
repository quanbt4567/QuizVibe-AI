-- Migration 000008: Fix leads_masked_phone_check constraint to support standard 10-char mask format (e.g. 098***5678)
--
-- PROBLEM:
-- Migration 20261105000001 created leads_masked_phone_check with regex:
--   CHECK (masked_phone ~ '^(03|05|07|08|09)\*{3}[0-9]{4}$')
-- which enforces exactly 9 characters (2-digit prefix + 3 asterisks + 4-digit suffix).
-- However, Vietnamese mobile numbers are 10 digits, and standard privacy masking formats
-- are 10 characters (e.g., '098***5678' with 3-digit prefix or '09****5678' with 4 asterisks).
-- This caused all production lead insertions to fail with PostgreSQL check violation 23514.
--
-- REMEDIATION:
-- Drop the restrictive constraint and recreate it to accept standard 10-character formats
-- while preserving compatibility with legacy 9-character format.

ALTER TABLE public.leads DROP CONSTRAINT IF EXISTS leads_masked_phone_check;
ALTER TABLE public.leads ADD CONSTRAINT leads_masked_phone_check
  CHECK (masked_phone ~ '^(03|05|07|08|09)[0-9]?\*{3,4}[0-9]{4}$');

