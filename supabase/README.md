# QuizVibe AI — Supabase PostgreSQL Database & Migration Guide

This directory contains the versioned PostgreSQL schema migrations and setup documentation for **QuizVibe AI (Phase 1: Backend Foundation & Database)**.

---

## 1. Database Schema Overview

Migration file: [`supabase/migrations/20261105000001_initial_quizvibe_schema.sql`](./migrations/20261105000001_initial_quizvibe_schema.sql)

### Tables & Relationships

1. **`public.campaigns`**
   - Primary Key: `id UUID DEFAULT gen_random_uuid()`
   - Public Identifier: `slug TEXT NOT NULL UNIQUE` (URL-safe kebab-case slug)
   - Legacy Compatibility: `legacy_id TEXT UNIQUE` (maps preset/localStorage campaign IDs during explicit migration)
   - Lifecycle State: `status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'archived'))`
   - Provenance: `is_ai_generated BOOLEAN`, `is_mock BOOLEAN`, `mock_label TEXT`
   - Timestamps: `published_at`, `created_at`, `updated_at`

2. **`public.campaign_questions`**
   - Primary Key: `id UUID DEFAULT gen_random_uuid()`
   - Foreign Key: `campaign_id UUID NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE`
   - Ordering & Integrity: `question_order SMALLINT CHECK (question_order BETWEEN 0 AND 4)`, `UNIQUE (campaign_id, question_order)`
   - Content: `question_text TEXT`, `options JSONB` (4-element array), `correct_index SMALLINT (0..3)`, `explanation TEXT`

3. **`public.vouchers`**
   - Primary Key: `id UUID DEFAULT gen_random_uuid()`
   - Foreign Key: `campaign_id UUID NOT NULL UNIQUE REFERENCES public.campaigns(id) ON DELETE CASCADE` (1:1 per campaign)
   - Content: `code TEXT`, `discount TEXT`, `description TEXT`, `expiry_date TEXT`, `terms TEXT`

4. **`public.quiz_sessions`**
   - Primary Key: `id UUID DEFAULT gen_random_uuid()`
   - Foreign Key: `campaign_id UUID NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE`
   - Telemetry (Zero PII): `status ('in_progress' | 'completed' | 'expired')`, `total_score (0..2000)`, `correct_count (0..5)`, `total_questions (5)`, `time_taken_seconds (0..300)`, `answers_snapshot JSONB`

5. **`public.leads`**
   - Primary Key: `id UUID DEFAULT gen_random_uuid()`
   - Foreign Keys:
     - `campaign_id UUID NOT NULL REFERENCES public.campaigns(id) ON DELETE RESTRICT`
     - `quiz_session_id UUID UNIQUE REFERENCES public.quiz_sessions(id) ON DELETE SET NULL`
   - Minimal Participant Data: `full_name TEXT`, `phone_number TEXT` (validated 10-digit Vietnamese mobile regex `^(03|05|07|08|09)[0-9]{8}$`), `masked_phone TEXT` (`098***5678`), `score (0..2000)`, `time_taken_seconds`, `voucher_code`, `submitted_at`
   - Leaderboard Index: `idx_leads_campaign_leaderboard ON public.leads (campaign_id, score DESC, time_taken_seconds ASC, submitted_at ASC)`

---

## 2. How to Create & Configure the Supabase Project

1. Sign in to [https://supabase.com/dashboard](https://supabase.com/dashboard) and click **New Project**.
2. Choose your organization, set the project name (e.g., `quizvibe-ai`), generate a strong database password, and select the nearest region (e.g., `ap-southeast-1` Singapore).
3. Wait for the PostgreSQL database to finish provisioning.
4. Navigate to **Project Settings → API** and locate:
   - **Project URL** (`https://<project-ref>.supabase.co`) → use as `SUPABASE_URL`.
   - **Project API Keys → `service_role` (secret)** → use as `SUPABASE_SERVICE_ROLE_KEY`.

---

## 3. How to Apply Database Migrations

### Option A — Via Supabase Dashboard SQL Editor (Fastest)
1. Open your Supabase project dashboard and go to **SQL Editor** → **New query**.
2. Copy the entire contents of [`supabase/migrations/20261105000001_initial_quizvibe_schema.sql`](./migrations/20261105000001_initial_quizvibe_schema.sql) and paste it into the editor.
3. Click **Run** (`Ctrl+Enter`).
4. Verify in **Table Editor** that `campaigns`, `campaign_questions`, `vouchers`, `quiz_sessions`, and `leads` exist with **RLS enabled**.

### Option B — Via Supabase CLI
```bash
npx supabase login
npx supabase link --project-ref <your-project-ref>
npx supabase db push
```

---

## 4. Environment Variables & Security Boundary

| Variable Name | Scope | Required | Where to Configure | Client Exposure Allowed? |
| :--- | :--- | :--- | :--- | :--- |
| `SUPABASE_URL` | Server-only (`api/`) | Yes | `.env.local` & Vercel Env Vars | **No** (Keep server-side) |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-only (`api/`) | Yes | `.env.local` & Vercel Env Vars | **NEVER** |
| `GEMINI_API_KEY` | Server-only (`api/`) | Yes (AI) | `.env.local` & Vercel Env Vars | **NEVER** |
| `GROQ_API_KEY` | Server-only (`api/`) | Optional | `.env.local` & Vercel Env Vars | **NEVER** |
| `CEREBRAS_API_KEY` | Server-only (`api/`) | Optional | `.env.local` & Vercel Env Vars | **NEVER** |

### Strict Security Rules
- **Never prefix `SUPABASE_SERVICE_ROLE_KEY` with `VITE_`.** Vite automatically embeds any `VITE_*` variable into the public browser JavaScript bundle. `validateSupabaseServerEnv()` in `api/lib/db/config.ts` explicitly checks for `VITE_SUPABASE_SERVICE_ROLE_KEY` and throws `CLIENT_EXPOSURE_DETECTED` if it is set.
- **Row Level Security (RLS):** All 5 tables have `ENABLE ROW LEVEL SECURITY` with no public `anon` policies. Browser clients cannot read raw `leads.phone_number` or `campaign_questions.correct_index` directly.

---

## 5. Safe Migration Strategy for Existing Browser `localStorage` Data

During Phase 1, existing browser `localStorage` behavior (`StorageService` in `src/services/storageService.ts`) remains 100% preserved so current single-device workflows and tests continue to work without disruption.

When migrating existing `localStorage` data (`quizvibe_active_campaign` and `quizvibe_leads`) to Supabase PostgreSQL in subsequent phases:
1. **No Automatic Background Upload of Personal Data:** The application must **never** silently upload `quizvibe_leads` (which contains personal phone numbers) from a browser's `localStorage` to the central database without an explicit, authenticated Admin action.
2. **Explicit Admin Opt-In Flow (`buildExplicitLocalStorageMigrationBundle`):**
   - Campaign definitions (`quizvibe_active_campaign`) can be prepared for server import via `buildExplicitLocalStorageMigrationBundle(campaign, leads, { targetStatus: 'draft', includePersonalLeads: false })` in `api/lib/db/repository.ts`.
   - By default, `includePersonalLeads` is `false` (returning `leadsToMigrate: []`).
   - Only when an Admin explicitly checks **"Đồng ý tải danh sách Leads cục bộ lên máy chủ"** and triggers migration is `includePersonalLeads: true` passed, validating each 10-digit Vietnamese phone number and computing `masked_phone` server-side before insertion.

---

## 6. Operational Rollback Protocol & Warnings for Migration 000005

### ⚠️ Critical Data-Integrity Notice — Potentially Destructive Operation

Dropping `public.quiz_sessions.session_token_hash` is **NOT fully lossless** once application instances or background tasks begin writing hash-only sessions (`session_token IS NULL AND session_token_hash IS NOT NULL`).

In Phase 4.3 Expand mode:
- Existing sessions possess plaintext `session_token` values that were backfilled to SHA-256 hashes.
- Once newer application versions write sessions where `session_token` is omitted (`NULL`), `session_token_hash` becomes the sole credential for those sessions.
- **Dropping `session_token_hash` will permanently and irrevocably destroy authentication credentials for any hash-only sessions.**

### Mandatory Pre-Rollback Diagnostic Query
Before executing any rollback DDL, run the following diagnostic query in Supabase SQL Editor:

```sql
SELECT 
  count(*) AS total_sessions,
  count(*) FILTER (WHERE session_token IS NOT NULL AND session_token_hash IS NOT NULL) AS dual_token_sessions,
  count(*) FILTER (WHERE session_token IS NULL AND session_token_hash IS NOT NULL) AS hash_only_sessions,
  count(*) FILTER (WHERE session_token IS NULL AND session_token_hash IS NULL) AS orphan_sessions
FROM public.quiz_sessions;
```

### Operational Triage Protocol
1. **If `hash_only_sessions = 0`**:
   - All active and historical sessions retain their plaintext `session_token`.
   - Reverting to pre-migration `session_token` lookups is safe for session credentials.
2. **If `hash_only_sessions > 0`**:
   - **STOP! Do NOT drop `session_token_hash` immediately.**
   - Dropping the column will immediately terminate active player gameplay and prevent reconnection.
   - Required triage options:
     - **Option A (Session Draining)**: Wait for active sessions to finish or naturally expire (sessions have a 300-second TTL).
     - **Option B (Forced Expiration)**: If an emergency rollback cannot wait, explicitly mark hash-only sessions as expired before dropping the column:
       ```sql
       UPDATE public.quiz_sessions
       SET status = 'expired'
       WHERE session_token IS NULL AND session_token_hash IS NOT NULL;
       ```
     - **Option C (Manual Approval Gate)**: An authorized engineering lead must review the count of affected active players and approve proceeding.

### Step-by-Step Reverse DDL (Manual Execution Only)
```sql
BEGIN;
  -- Step 1: Remove coexistence trigger & trigger function
  DROP TRIGGER IF EXISTS trg_sync_quiz_sessions_token_hash ON public.quiz_sessions;
  DROP FUNCTION IF EXISTS public.sync_quiz_sessions_token_hash();

  -- Step 2: Remove dedicated hash index and unique constraint
  DROP INDEX IF EXISTS public.idx_quiz_sessions_token_hash;
  ALTER TABLE public.quiz_sessions DROP CONSTRAINT IF EXISTS quiz_sessions_token_hash_unique;

  -- Step 3: POTENTIALLY DESTRUCTIVE — drop column only after diagnostic & triage
  ALTER TABLE public.quiz_sessions DROP COLUMN IF EXISTS session_token_hash;
COMMIT;
```

---

## 7. Operational Protocol, Preconditions & Deployment Runbook for Migration 000006 (Contract Phase)

Migration file: [`supabase/migrations/20261105000006_player_session_token_contract.sql`](./migrations/20261105000006_player_session_token_contract.sql)

### ⚠️ Critical Data-Integrity Notice — Irreversible One-Way Operation

Dropping `public.quiz_sessions.session_token` is an **IRREVERSIBLE, ONE-WAY cryptographic transition**:
- SHA-256 is a one-way cryptographic hash function.
- Once `session_token` is dropped, original plaintext session tokens **CANNOT** be recovered, reversed, or reconstructed from `session_token_hash`.
- Any legacy client or un-updated service that attempts to authenticate using legacy raw `session_token` queries will fail permanently (PostgreSQL error `42703: undefined_column`).
- Application rollback to a version requiring `session_token` is **impossible** without recreating the column and forcing all players to re-authenticate.

### 7.1 The Four Independent Operational Dimensions

Operational verification requires distinguishing four independent system dimensions. **No single check proves all four**:

| Dimension | What It Directly Verifies | What It DOES NOT Prove | Primary Verification Tool |
| :--- | :--- | :--- | :--- |
| **1. Hash Completeness** | 100% of rows at rest in `public.quiz_sessions` possess a valid, non-null, non-empty, cryptographically consistent SHA-256 hash. | Does NOT prove that application instances have stopped writing plaintext tokens or that legacy containers are dead. | Read-only SQL diagnostic query in Supabase SQL Editor. |
| **2. Plaintext-Write Draining** | Absence of observable writes containing `session_token IS NOT NULL` across available operational monitoring channels. | Does NOT prove that no legacy runtime has written or updated `session_token` during the window (the multi-timestamp query only observes specific session lifecycle events, NOT comprehensive write telemetry). | Vercel deployment runtime logs, function metrics, and Supabase lifecycle event observation queries. |
| **3. Vercel Deployment Routing** | 100% of incoming production edge HTTP traffic is assigned to the deployment ID built with `ENABLE_LEGACY_SESSION_TOKEN_WRITE=false`. | Does NOT prove that in-flight requests or cold/paused serverless instances have finished executing. | Vercel Project Dashboard → Deployments → Traffic / Alias Routing Analytics. |
| **4. Expiration of In-Flight Requests & Old Serverless Instances** | In-flight execution timeouts (15s–60s) have passed and cloud container reuse intervals have elapsed without legacy invocations. | Temporal waiting is operational evidence, NOT direct catalog or database proof. | Cloud runtime draining observation window (10–30 minutes). |

### 7.2 Operational Evidence vs. Absolute Proof in Serverless Container Lifecycles

In modern serverless architectures (such as AWS Lambda micro-VMs managed by Vercel):
- Containers may remain paused and frozen in memory between invocations.
- While 100% edge traffic routing guarantees that all new incoming requests resolve to the latest deployment, a paused execution container from an earlier deployment could theoretically remain suspended.
- Consequently, edge traffic routing and the absence of observable writes constitute **strong operational evidence** of draining, but **not absolute mathematical proof** that every historical micro-VM container has been deprovisioned.

### 7.3 Application Write Paths & Critical Telemetry Limitations

A rigorous code-level audit of all database write operations on `public.quiz_sessions` was conducted across the application codebase:

#### Application Write Paths Identified
1. **`startSession` (`api/lib/quiz/quizService.ts:79-102`)**:
   - Executes an `INSERT` into `public.quiz_sessions` via `repo.createQuizSession(sessionInsert)`.
   - When `ENABLE_LEGACY_SESSION_TOKEN_WRITE !== 'false'`, it populates `sessionInsert.session_token = sessionToken`.
   - On this write, `started_at` is set to `nowIso`, `current_question_started_at` is set to `nowIso`, and `created_at` defaults to `now()`.
2. **`createQuizSession` (`api/lib/db/repository.ts:347-366`)**:
   - Executes the actual PostgreSQL `INSERT INTO public.quiz_sessions`.
   - Contains a resilient fallback that strips `session_token` and retries if the database column has already been dropped.
3. **`getQuizSessionByToken` (`api/lib/db/repository.ts:518-523`)**:
   - Executes an `UPDATE` on `public.quiz_sessions`, but only updates `session_token_hash: tokenHash` for lazy hash backfill. It **never** writes or updates `session_token`.
4. **`updateQuizSessionAnswerAtomic` (`api/lib/db/repository.ts:597-614`)**:
   - Executes an `UPDATE` on `public.quiz_sessions` for question progression.
   - Updates `total_score`, `correct_count`, `current_question_index`, `current_question_started_at`, `answers_snapshot`, `status`, `completed_at`, `time_taken_seconds`.
   - The update payload does **not** accept, write, or modify `session_token`.

#### Critical Schema & Telemetry Limitation
- **`public.quiz_sessions` does NOT possess an `updated_at` column** in baseline schema.
- Attempting `WHERE updated_at >= now() - interval '10 minutes'` returns PostgreSQL error `42703 (undefined_column)`.
- The multi-timestamp fallback query across `created_at`, `started_at`, `current_question_started_at`, and `completed_at` **only observes specific session lifecycle events**.
- **It is NOT equivalent to an `updated_at` column and does NOT constitute comprehensive write telemetry**:
  - If an UPDATE modifies an existing session without changing those specific columns (e.g. an administrative correction, an external maintenance script, or a concurrent tool writing `session_token`), none of those four lifecycle timestamps will change.
- **Reporting Limitation**: Without an engine-level audit log (WAL/CDC) or a dedicated database trigger maintaining an auto-updated timestamp or audit table, comprehensive database-level write telemetry cannot be obtained from PostgreSQL SQL queries alone. Operators must not rely on timestamp proxies as absolute proof of write cessation.

### 7.4 Conservative Stop Condition & Abort Protocol

> [!CAUTION]
> **CONSERVATIVE STOP CONDITION**
> If at any point during pre-flight observation:
> 1. Any write or row with `session_token IS NOT NULL` is observed in available logs or database queries during the observation window; OR
> 2. Vercel deployment analytics or runtime logs report any invocations on previous deployment IDs; OR
> 3. Production traffic drops unexpectedly to 0 (indicating DNS/routing failure where absence of writes is uninformative); OR
> 4. Evidence of draining is incomplete, ambiguous, or inconclusive:
> 
> **STOP IMMEDIATELY. DO NOT EXECUTE MIGRATION 000006.**
> 
> **Required Action on Stop**:
> - Remain in **STATE B (Expand Mode)**.
> - STATE B represents the current Expand Mode compatibility state, maintaining both `session_token` and `session_token_hash` along with trigger synchronization to support legacy and updated clients without guaranteeing zero downtime or zero data loss under all failure modes.
> - Investigate Vercel runtime logs, confirm environment variable propagation, redeploy if necessary, and reset the observation window to zero.
> - If anomalies cannot be resolved within the maintenance window, abort the Contract phase and remain in STATE B indefinitely.

---

### 7.5 Step-by-Step Production Deployment Runbook for Migration 000006

#### Step 1: Pre-Deployment Configuration
1. In Vercel Project Settings → **Environment Variables**:
   ```env
   ENABLE_LEGACY_SESSION_TOKEN_WRITE=false
   ```
2. Confirm the variable is applied to the **Production** environment.
3. Trigger a production deployment (or merge PR to `main`).

#### Step 2: Deployment Execution & Routing Verification
1. Open the Vercel Dashboard → **Deployments**.
2. Confirm the new deployment status is **Ready**.
3. Inspect **Domains / Aliases** and verify **100% of production traffic** is routed to the new deployment.
4. Inspect runtime logs and verify serverless functions initialize with `ENABLE_LEGACY_SESSION_TOKEN_WRITE=false`.

#### Step 3: Draining Observation Window
1. Maintain observation for at least **10 minutes (600 seconds)**, ideally **30 minutes**. Note that this observation window is an operational indicator and does not constitute absolute proof that all old serverless execution environments have been destroyed.
2. **Distinguish Session TTL from Serverless Runtime Lifecycles**:
   - **Quiz Session TTL (Application-level)**: Gameplay sessions operate within a nominal 300-second gameplay limit. However, a wall-clock observation window does not guarantee that every historical gameplay session in existence has completed or expired.
   - **Serverless Invocation Duration**: In-flight HTTP request handlers on Vercel Functions are bounded by execution timeouts (typically $\le 15$s to 60s). A 10-minute window ensures in-flight requests running on old code have fully finished executing.
   - **Execution-Environment Lifecycle**: Micro-VM containers (AWS Lambda instances) may remain paused and frozen in memory by the cloud provider for extended periods. A 10- to 30-minute window allows edge routing to settle and active container pools to cycle, but temporal waiting is operational evidence, not absolute proof that every cached container has been destroyed.
3. Review Vercel Function logs to verify zero invocations on older deployment IDs.

#### Step 4: Supabase Pre-Execution Diagnostic Queries

Open the **Supabase SQL Editor** and execute the following read-only diagnostics:

##### Diagnostic 4.1 — Session Lifecycle Event Observation (Partial Operational Indicator Only)
> [!NOTE]
> **Operational Telemetry Notice**:
> This query observes recent session lifecycle events (`created_at`, `started_at`, `current_question_started_at`, `completed_at`). It does **not** prove that no legacy runtime has written or updated `session_token` during the observation window, because `public.quiz_sessions` lacks an auto-updating `updated_at` column.
> 
> **Critical Telemetry Limitation**:
> A result of **`legacy_lifecycle_events_last_10m = 0` does NOT prove comprehensive plaintext-write cessation**. It only confirms that no sessions recorded initial insertion or question advancement with `session_token IS NOT NULL` during the last 10 minutes. Any update modifying an existing session without altering those four timestamps remains undetected by this query. It serves strictly as a partial operational indicator, not absolute proof.

```sql
SELECT count(*) AS legacy_lifecycle_events_last_10m
FROM public.quiz_sessions
WHERE (
  created_at >= now() - interval '10 minutes'
  OR started_at >= now() - interval '10 minutes'
  OR current_question_started_at >= now() - interval '10 minutes'
  OR (completed_at IS NOT NULL AND completed_at >= now() - interval '10 minutes')
)
AND session_token IS NOT NULL;
```
*Mandatory Gate*: **`legacy_lifecycle_events_last_10m = 0`**. If $> 0$, trigger the Conservative Stop Condition. Even when $= 0$, treat this solely as partial operational evidence.

##### Diagnostic 4.2 — Data Completeness & Integrity Check
```sql
SELECT 
  count(*) AS total_sessions,
  count(*) FILTER (WHERE session_token_hash IS NULL OR length(trim(session_token_hash)) = 0) AS missing_hashes,
  count(*) FILTER (WHERE session_token_hash !~ '^[0-9a-f]{64}$') AS malformed_hashes,
  count(*) FILTER (WHERE session_token IS NOT NULL AND length(trim(session_token)) = 0) AS corrupt_empty_tokens,
  count(*) FILTER (WHERE session_token IS NOT NULL AND session_token_hash IS NOT NULL) AS dual_written_sessions,
  count(*) FILTER (WHERE session_token IS NULL AND session_token_hash IS NOT NULL) AS hash_only_sessions
FROM public.quiz_sessions;
```
*Mandatory Gates*:
- **`missing_hashes = 0`** across **all** session statuses (`in_progress`, `completed`, `expired`).
- **`malformed_hashes = 0`** across **all** session rows (Check 2e SHA-256 canonical format integrity gate).
- **`corrupt_empty_tokens = 0`**.

#### Step 5: Execute Migration 000006
1. Open [`supabase/migrations/20261105000006_player_session_token_contract.sql`](./migrations/20261105000006_player_session_token_contract.sql) in the Supabase SQL Editor.
2. Click **Run** (`Ctrl+Enter`).
3. The migration runs inside a single atomic transaction:
   - Verifies `pgcrypto` schema and dynamic qualification.
   - Enforces complete hash coverage, zero corrupt tokens, zero hash mismatches, zero duplicate hashes.
   - Verifies catalog integrity of unique constraint `quiz_sessions_token_hash_unique` and partial index `idx_quiz_sessions_token_hash`.
   - Verifies trigger `trg_sync_quiz_sessions_token_hash` and function `sync_quiz_sessions_token_hash`.
   - Drops coexistence trigger, function, plaintext index, and plaintext column `session_token`.
   - Runs post-DDL verification confirming column drop and hash index/constraint retention.
4. Verify the output displays:
   `MIGRATION 000006 SUCCESS: session_token dropped; hash column, index, and constraint verified.`

#### Step 6: Post-Execution Verification
Run the following post-migration verification query in Supabase SQL Editor:
```sql
SELECT 
  column_name, 
  data_type, 
  is_nullable
FROM information_schema.columns
WHERE table_schema = 'public' 
  AND table_name = 'quiz_sessions'
  AND column_name IN ('session_token', 'session_token_hash');
```
*Expected Result*: Exactly one row returned (`session_token_hash`), `session_token` absent.

---

### 7.6 Pre-Flight Operational Checklist Table

| Check ID | Verification Gate | Required State | Pass/Fail Condition |
| :--- | :--- | :--- | :--- |
| **GATE-1** | Vercel Environment Variable | `ENABLE_LEGACY_SESSION_TOKEN_WRITE=false` | Fail closed if true or unset. |
| **GATE-2** | Vercel Edge Traffic Routing | 100% traffic on new deployment ID | Fail closed if any legacy traffic. |
| **GATE-3** | Runtime Draining Window | $\ge 10$ minutes elapsed post-deployment | Fail closed if timer interrupted. |
| **GATE-4** | Lifecycle Event Observation | `legacy_lifecycle_events_last_10m = 0` | Fail closed if $> 0$ (Stop Condition). |
| **GATE-5** | Hash Coverage (All Statuses) | `missing_hashes = 0` | Fail closed if any row lacks hash. |
| **GATE-6** | Plaintext Token Sanitation | `corrupt_empty_tokens = 0` | Fail closed if empty strings exist. |
| **GATE-7** | Cryptographic Consistency | 0 hash mismatches (`digest(session_token)`) | Migration aborts if $> 0$. |
| **GATE-8** | Duplicate Hash Check | 0 duplicate `session_token_hash` values | Migration aborts if duplicates exist. |
| **GATE-9** | Unique Constraint Catalog Check | `quiz_sessions_token_hash_unique` valid | Migration aborts if invalid/missing. |
| **GATE-10**| Index Catalog Check | `idx_quiz_sessions_token_hash` valid & anchored | Migration aborts if predicate altered. |
| **GATE-11**| Coexistence Trigger Check | `trg_sync_quiz_sessions_token_hash` enabled | Migration aborts if altered/missing. |
| **GATE-12**| Irreversible Loss Approval | Explicit Engineering Lead Approval | Mandatory before executing DDL. |



