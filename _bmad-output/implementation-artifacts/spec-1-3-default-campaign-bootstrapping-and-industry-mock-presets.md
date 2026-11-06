---
title: "Story 1.3: Default Campaign Bootstrapping & Industry Mock Presets"
type: "feature"
created: "2026-11-03"
status: "done"
route: "oneshot"
review_loop_iteration: 0
context: []
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** On initial load or after storage resets, the application has no active quiz campaign, leading to empty states and preventing instant gameplay evaluation. Additionally, demo or fallback quizzes must provide realistic multi-industry content while being transparently distinguished from real AI generation.

**Approach:** Implement `mockPresets.ts` featuring 4 verified fanpage industry presets (Cosmetics, Fashion, Tech Gadgets, F&B) strictly adhering to the 5 questions $\times$ 4 options schema. Extend `StorageService` with idempotent `initializeDefaults()` to seed the default Cosmetics campaign without overwriting existing merchant campaigns, and attach explicit mock labeling (`"Bản demo vòng loại - Dữ liệu mô phỏng AI"`).

</frozen-after-approval>

## Implementation Notes

- Created 4 comprehensive presets in `src/data/mockPresets.ts`: Fashion, Cosmetics, Tech Gadgets, and F&B.
- Each preset contains exactly 5 questions, 4 options per question, 1 valid `correctIndex` (0..3), and realistic voucher terms.
- Defined `MOCK_MODE_LABEL = "Bản demo vòng loại - Dữ liệu mô phỏng AI"` in data contracts.
- Added `initializeDefaults()`, `getPresets()`, and `applyPreset()` to `StorageService`.
- Seeded default campaign conditionally (idempotent, never overwrites valid existing campaigns).
- Updated `App.tsx` and UI placeholders to bootstrap storage on initialization and show mock indicator when active.
- Added automated unit test suite covering initialization, preservation of existing data, and preset schema validity.
