---
title: "Story 3.2: 30-Second Countdown Timer & Color Urgency Transitions"
type: "feature"
created: "2026-11-03"
status: "done"
route: "oneshot"
review_loop_iteration: 0
context: []
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Fast-paced social minigames require high adrenaline and clear time awareness. Naive interval counters drift heavily under browser throttling, cause duplicate interval triggers, and lack synchronized urgency cues.

**Approach:** Implement a reusable, wall-clock timestamped countdown hook (`useCountdownTimer`) that counts down from 30.0s to 0.0s using tabular figures (`font-mono tabular-nums`). Dynamically transitions urgency colors matching `DESIGN.md`: Safe (30s–16s, Emerald), Caution (15s–6s, Amber), Urgent (5s–1s, Pulsing Crimson `animate-pulse`), and Timeout (0s, Red Flash alert *"Hết giờ! (0 điểm)"*). Prevents interval leaks on unmount and prevents duplicate timeout dispatches through a one-way latch.

</frozen-after-approval>

## Implementation Notes

- Created `src/hooks/useCountdownTimer.ts` based on `Date.now()` timestamp deltas to resist setInterval drift.
- Exported hook from `src/hooks/index.ts`.
- Created `src/components/player/QuizGameScreen.tsx` rendering the 30-second timer pill, synchronized progress bar, question prompt preview, and timeout notification.
- Exported `QuizGameScreen` from `src/components/player/index.ts` and integrated in `src/App.tsx`.
- Applied tabular numerals (`font-mono tabular-nums`) to prevent layout shift during countdown.
- Enforced strict scope boundaries: zero answer selection, scoring, or question advancement was implemented.
- Created `src/hooks/useCountdownTimer.test.ts` and `src/components/player/QuizGameScreen.test.ts` covering 13 unit tests.

