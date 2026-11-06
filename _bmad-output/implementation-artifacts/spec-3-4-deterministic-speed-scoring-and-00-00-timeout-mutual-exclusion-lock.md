---
title: "Story 3.4: Deterministic Speed Scoring & 00:00 Timeout Mutual-Exclusion Lock"
type: "feature"
created: "2026-11-03"
status: "done"
route: "oneshot"
review_loop_iteration: 0
context: []
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Minigames on Fanpage need high competitive excitement with fair, deterministic scoring that rewards speed while preventing race conditions between answer clicks and timeout triggers.

**Approach:**
1. Implement the Speed Scoring engine according to FR-203 and TC-02:
   - Correct answer: $100 + (10 \times T_{\text{rem}})$ points, where $T_{\text{rem}}$ is whole seconds remaining in $[0, 30]$.
   - Max per question: 400 pts; 5-question maximum: 2,000 pts.
   - Incorrect answer: 0 pts.
   - Timeout (00:00): 0 pts.
   - Calculate score deterministically at the exact moment of acceptance.
2. Implement 5-question sequential progression (Câu 1/5 to Câu 5/5):
   - Fresh 30-second timer per question without carrying over leftover time.
   - Auto-advance delay: 800ms after answer selection; 1,000ms after timeout.
   - Transition exactly once to quiz completion state after the 5th question.
3. Synchronous mutual exclusion (`isLockedRef`, `isAdvancingRef`, `hasCompletedRef`):
   - Prevent race conditions between 00:00 timeout tick and rapid user taps.
   - Discard all late clicks, duplicate taps, and secondary timeouts.

</frozen-after-approval>

## Implementation Notes

- Created `src/services/scoring.ts` defining `calculateSpeedScore(isCorrect, timeRemainingSeconds)`, `QuestionPlayResult`, and `QuizGameSessionResult`.
- Exported scoring module via `src/services/index.ts`.
- Updated `src/components/player/QuizGameScreen.tsx`:
  - Added live score badge (`Award` + `{totalScore} đ`) and question progression tracker (`Câu {i} / {n}`).
  - Wired deterministic speed scoring on option selection.
  - Added awarded points popover badge (`+X điểm (Tốc độ: Ys)` / `Chưa chính xác (0 điểm)`).
  - Wired timeout auto-advancement with 0 points.
  - Guaranteed fresh 30s timer per question via `timer.reset(30)`.
  - Added single completion dispatch (`onQuizCompleted`).
- Updated `src/App.tsx` with completion state view showing total score out of 2,000, correct count out of 5, time spent, and replay options.
- Strictly halted before Epic 4 (no lead capture form, voucher unlocking, or leaderboard writes).
- Added comprehensive unit tests in `src/components/player/QuizGameScreen.test.ts` covering all 12 required scenarios.
- All 143 unit tests passing; TypeScript compilation and Vite production build verified with 0 errors.

