---
title: "Story 2.3: AI Resilience, One-Shot Self-Repair & Mock Fallback"
type: "feature"
created: "2026-11-03"
status: "done"
route: "oneshot"
review_loop_iteration: 0
context: []
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** LLMs occasionally output malformed JSON (e.g. conversational wrapping, unescaped characters, trailing commas, or markdown blocks), while network flakiness or rate limits can leave admins stranded if errors cause crashes or silent data corruption.

**Approach:** Implement a resilient JSON sanitization and one-shot repair pipeline on the serverless gateway, bounded retry logic with immediate cessation on 401/403/400 errors, and an explicit, non-silent offline Mock Mode fallback preserving all admin inputs and displaying the exact required label: *"Bản demo vòng loại - Dữ liệu mô phỏng AI"*.

</frozen-after-approval>

## Implementation Notes

- Created `api/lib/repairJson.ts` implementing programmatic JSON cleaning (markdown stripping, trailing comma elimination, brace balancing) and one-shot repair validation.
- Enhanced provider calls with status-code inspection: 401/403/400 are non-retryable and abort immediately; 429 cascades immediately to next provider.
- Enhanced `api/lib/router.ts` with bounded resilience.
- Updated `AdminDashboard.tsx` to preserve admin form inputs on AI failure and provide explicit "Thử lại" and "Dùng câu hỏi mẫu (Mock)" actions.
- Preserved exact label `"Bản demo vòng loại - Dữ liệu mô phỏng AI"` and distinct `isMock: true` vs `isAiGenerated: true` flags.
- Added comprehensive unit tests for JSON repair, non-retryable errors, and explicit fallback.

