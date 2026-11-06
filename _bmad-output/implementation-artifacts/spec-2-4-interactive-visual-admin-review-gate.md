---
title: "Story 2.4: Interactive Visual Admin Review Gate"
type: "feature"
created: "2026-11-03"
status: "done"
route: "oneshot"
review_loop_iteration: 0
context: []
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Auto-publishing AI-generated or mock promotional quiz questions risks embarrassing hallucinations, off-brand phrasing, or faulty answer keys reaching customers without oversight.

**Approach:** Build a mandatory, interactive Review Gate (`AIReviewGate.tsx`) enforcing human-in-the-loop verification. When questions arrive from the Serverless Gateway or offline presets, zero questions are published automatically. Fanpage Admins can visually inspect all 5 questions, edit question prompt text and answer options, toggle the designated correct answer, refine explanations, configure voucher details, and explicitly approve the campaign. Active campaign replacements require confirmation.

</frozen-after-approval>

## Implementation Notes

- Created `AIReviewGate.tsx` in `src/components/admin/` with full interactive visual question editing, option modification (A, B, C, D), radio correct-answer toggling, and voucher configuration.
- Enforced zero auto-publishing invariant: AI outputs and mock presets load into `reviewDraft` state and require explicit admin approval to activate.
- Connected comprehensive validation using `validateManualQuizForm()`: rejects empty prompts, incomplete options, invalid answer indices, and malformed voucher settings.
- Added confirmation modal dialog when replacing an active campaign in browser storage, safeguarding existing campaign data.
- Preserved exact provenance metadata: `isAiGenerated: true`, `isMock: false` for AI campaigns; `isAiGenerated: false`, `isMock: true`, `mockLabel: "Bản demo vòng loại - Dữ liệu mô phỏng AI"` for mock presets.
- Exported `AIReviewGate` from `src/components/admin/index.ts`.
- Created `src/components/admin/AIReviewGate.test.ts` with 17 unit tests verifying rendering, editing, validation rejection, explicit approval, storage persistence, and replacement confirmation.

