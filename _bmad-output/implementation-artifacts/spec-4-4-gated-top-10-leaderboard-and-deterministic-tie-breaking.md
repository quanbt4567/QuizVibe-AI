# Implementation Specification: Story 4.4 — Gated Top 10 Leaderboard & Deterministic Tie-Breaking

**Status:** Done  
**Epic:** Epic 4 — Viral Lead Capture & Conversion Engine  
**Implemented Date:** 2026-11-04  
**Author:** Amelia (Senior Software Engineer)

---

## 1. Overview & Objective
Implement a mobile-first, gated Top 10 Leaderboard for QuizVibe AI ensuring that only verified players who successfully submitted their contact details (Name $\ge 2$ chars, Vietnamese 10-digit phone) can qualify. Enforce the canonical deterministic ranking strategy (`Score DESC, Time ASC, SubmittedAt ASC`) and provide accessible entry points from both the Campaign Welcome screen and the Results screen.

---

## 2. Architecture & Data Flow

### 2.1. Canonical Comparator (`src/services/storageService.ts`)
`compareLeaderboardEntries(a, b)`:
1. **Primary Sort:** `b.score - a.score` (Score DESC)
2. **Secondary Sort:** `a.timeTakenSeconds - b.timeTakenSeconds` (Time ASC)
3. **Tertiary Sort:** `new Date(a.submittedAt).getTime() - new Date(b.submittedAt).getTime()` (SubmittedAt ASC)
4. **Stable Equality:** Returns `0` if all 3 fields match, avoiding non-deterministic or arbitrary sorting.

### 2.2. Gated Write Pipeline & Query Integrity
- **Writes:** Enforced via `StorageService.submitLead()` (AD-4). Unsubmitted, skipped, or failed validations never write to `quizvibe_leaderboard`.
- **Reads:** `StorageService.getLeaderboard()` defensively sorts with `compareLeaderboardEntries` and bounds entries to exactly `slice(0, 10)` with consecutive ranks `1..10`. Non-mutating spread `[...validEntries]` prevents altering in-memory or storage arrays.

### 2.3. LeaderboardModal Component (`src/components/player/LeaderboardModal.tsx`)
- **Responsive Layout:** Mobile-first, works down to 360px without horizontal scrolling.
- **Top 3 Medals:** Gold (`🥇` #1), Silver (`🥈` #2), Bronze (`🥉` #3) with distinct tier badges.
- **Ranks 4–10:** Styled with `#4`..`#10` monospace badges.
- **Privacy Enforcement:** Displays exclusively masked phone numbers (`entry.maskedPhone || maskPhoneNumber(entry.phoneNumber)`). Raw phone numbers are completely omitted from text, titles, and `aria-label` attributes.
- **Empty State (UX-DR5):** Stylized SVG podium illustration with `"Chưa có ai ghi danh! Hãy là người đầu tiên vượt qua thử thách để nhận vị trí số 1 trên Bảng xếp hạng!"`.
- **Tie-break Transparency:** Footer card explaining the exact deterministic sorting rules.
- **Accessibility:** `role="dialog"`, `aria-modal="true"`, `aria-labelledby`, ESC key listener, backdrop click dismiss, touch targets $\ge 44$–$48$px.
- **Player Highlighting:** Highlights the current player's newly registered row with `"Bạn"` badge when `highlightLeadId` matches.

### 2.4. Integration Points
- **WelcomeScreen (`src/components/player/WelcomeScreen.tsx`):**
  - "Xem Bảng Xếp Hạng Top 10" button opens `LeaderboardModal` before starting.
- **ResultScreen (`src/components/player/ResultScreen.tsx`):**
  - "Xem Bảng Xếp Hạng Top 10" button in the action area opens `LeaderboardModal`.
  - Passes `highlightLeadId` so players immediately see their newly submitted position.
- **VoucherRewardCard (`src/components/player/VoucherRewardCard.tsx`):**
  - Renders rank `#rank` as an interactive button triggering `onViewLeaderboard` when provided.

---

## 3. Verification & Quality Gates
- **Unit & Integration Tests:** 19 dedicated tests in `LeaderboardModal.test.ts` covering eligibility, deterministic sorting, Top 10 slicing, phone masking, malformed storage data, and session isolation.
- **Full Test Suite:** 225/225 passing across 15 test files.
- **TypeScript Compiler:** 0 errors (`tsc --noEmit`).
- **Production Build:** Clean (`npm run build`).

