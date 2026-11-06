---
title: "Story 3.1: Campaign Welcome Landing"
type: "feature"
created: "2026-11-03"
status: "done"
route: "oneshot"
review_loop_iteration: 0
context: []
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Players clicking into a Facebook minigame need an immediate, high-converting, mobile-first welcome experience that communicates the contest rules and voucher reward without login barriers.

**Approach:** Build `WelcomeScreen.tsx` (Screen S1) optimized for mobile webview (360px–430px Facebook in-app browser). Loads active campaign data via `StorageService.getCampaign()`, displays campaign title, industry, and a golden ticket voucher reward card with dashed borders, rule pills (5 questions • 30s per question), an active Start Quiz CTA button (`min-h-[56px]`), a secondary Top 10 Leaderboard viewer, graceful missing-campaign fallback, and the exact mock disclaimer: *"Bản demo vòng loại - Dữ liệu mô phỏng AI"*.

</frozen-after-approval>

## Implementation Notes

- Created `WelcomeScreen.tsx` in `src/components/player/` with responsive mobile-first UI adhering to `DESIGN.md` and `EXPERIENCE.md`.
- Exported components from `src/components/player/index.ts`.
- Integrated `WelcomeScreen` in `src/App.tsx` with role switching and state transition from `'welcome'` to `'playing'`.
- Enforced strict mock banner display using verbatim label `MOCK_MODE_LABEL` (`"Bản demo vòng loại - Dữ liệu mô phỏng AI"`).
- Built elegant dashed voucher ticket preview with code, discount value, description, and expiry info.
- Built quick leaderboard inspector modal to view the Top 10 before starting.
- Added graceful fallback state when no active campaign is found in storage, offering one-click default campaign initialization.
- Created `src/components/player/WelcomeScreen.test.ts` with 10 unit and integration tests verifying all acceptance criteria.

