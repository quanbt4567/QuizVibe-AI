---
title: "Story 4.1: Results Screen & Performance Breakdown"
type: "feature"
created: "2026-11-03"
status: "done"
route: "oneshot"
review_loop_iteration: 0
context: []
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Players finishing all 5 questions need immediate gratification and transparent insight into their performance (total score out of 2,000, correct count, active duration, and per-question breakdown) to understand their achievement before proceeding to claim their voucher or enter the leaderboard.

**Approach:**
1. Implement `ResultScreen.tsx` within `src/components/player/` adhering to `DESIGN.md` and `EXPERIENCE.md`.
2. Display the overall score as the strongest visual focal point, complete with tiered achievement badge/title (`Xuất sắc!`, `Rất tốt!`, etc.) and a 2,000-point visual progress indicator.
3. Present scannable 3-column performance metrics: Total Score, Correct count (`Đúng X/5`), and Total Answering Time (strictly measuring active gameplay duration excluding UI transition pauses).
4. Provide an accessible, mobile-first accordion breakdown of all 5 questions:
   - Distinguishes Correct (Emerald), Incorrect (Rose), and Timed-out (Amber/Rose) states.
   - Shows selected option vs. correct option.
   - Displays question explanations when available.
5. Provide navigation and transition controls:
   - Primary CTA: "Nhận Voucher Ưu Đãi & Lưu Điểm" (preparing transition to Story 4.2 Lead Capture).
   - Secondary CTAs: "Chơi lại vòng mới" and "Quay về trang Chào mừng".
6. Handle missing or invalid session data gracefully without crashing or showing corrupted states.

</frozen-after-approval>

## Implementation Notes

- Created `src/components/player/ResultScreen.tsx` with `getScoreTierInfo(score)` logic.
- Exported `ResultScreen` in `src/components/player/index.ts`.
- Enhanced `QuestionPlayResult` in `src/services/scoring.ts` with optional `options?: string[]` and `explanation?: string` for complete self-contained question results.
- Updated `src/components/player/QuizGameScreen.tsx` to forward `options` and `explanation` into `QuestionPlayResult`.
- Integrated `ResultScreen` into `src/App.tsx`, replacing the temporary Story 3.4 preview container.
- Added comprehensive unit tests in `src/components/player/ResultScreen.test.ts`.
- Evaluated UI libraries (`canvas-confetti`, `framer-motion`, `radix-ui` accordion) and selected the **ADAPT** pattern with native Tailwind CSS + Lucide icons + React state to prevent mobile bundle bloat.
- Maintained strict scope boundary: no lead input fields, voucher unlock, or leaderboard persistence implemented in Story 4.1.
- All 161 tests passing across 12 suites; TypeScript and production builds verified with 0 errors.

