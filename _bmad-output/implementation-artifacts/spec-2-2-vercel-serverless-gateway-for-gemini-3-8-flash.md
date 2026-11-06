---
title: "Story 2.2: Multi-Provider Serverless AI Gateway (Free-Only)"
type: "feature"
created: "2026-11-03"
status: "done"
route: "oneshot"
review_loop_iteration: 0
context: []
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Frontend Single Page Applications cannot safely store API secrets or handle raw AI network calls without risking client credential leakage and severe browser latency. Furthermore, relying on a single AI provider creates single-point-of-failure vulnerabilities when free-tier rate limits or transient outages occur.

**Approach:** Build a resilient, stateless multi-provider Serverless Gateway (`/api/generate-quiz`) on Vercel with a strictly sequential priority order (Gemini 3.8 Flash $\to$ Groq Llama 3.1 8B Instant $\to$ Optional Cerebras, disabled by default). Enforce a single global 9-second deadline, per-provider AbortSignal cancellation, strict 5 questions $\times$ 4 options schema validation, HTTP 200/400/503/504 semantics, and complete secret key isolation (`AD-2`).

</frozen-after-approval>

## Implementation Notes

- Implemented `api/lib/types.ts` defining shared `AIProvider`, request, and response contracts.
- Created `api/lib/validator.ts` verifying 5 questions, 4 options, and integer correctIndex 0..3.
- Implemented `api/lib/providers/geminiProvider.ts` (Priority 1: `gemini-3.8-flash`).
- Implemented `api/lib/providers/groqProvider.ts` (Priority 2: `openai/gpt-oss-20b`, updated from deprecated `llama-3.1-8b-instant`).
- Implemented `api/lib/providers/cerebrasProvider.ts` (Priority 3: disabled by default unless explicitly configured).
- Implemented `api/lib/router.ts` executing sequential fallback governed by a 9.0s global deadline.
- Created `api/generate-quiz.ts` handling HTTP requests with 200, 400, 503, and 504 status codes.
- Implemented `src/services/aiService.ts` for frontend communication with fallback signaling.
- Configured `vercel.json` and `.env.example`.
- Created comprehensive unit tests in `api/lib/router.test.ts` and `src/services/aiService.test.ts`.
