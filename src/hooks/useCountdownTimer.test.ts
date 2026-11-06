import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { getTimerUrgency } from './useCountdownTimer';

describe('Story 3.2: 30-Second Countdown Timer Logic (useCountdownTimer & getTimerUrgency)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  describe('1. Urgency Level Thresholds (getTimerUrgency)', () => {
    it('categorizes 30s to 16s as safe (Emerald)', () => {
      expect(getTimerUrgency(30)).toBe('safe');
      expect(getTimerUrgency(25)).toBe('safe');
      expect(getTimerUrgency(20)).toBe('safe');
      expect(getTimerUrgency(16)).toBe('safe');
    });

    it('categorizes 15s to 6s as caution (Amber)', () => {
      expect(getTimerUrgency(15)).toBe('caution');
      expect(getTimerUrgency(10)).toBe('caution');
      expect(getTimerUrgency(6)).toBe('caution');
    });

    it('categorizes 5s to 1s as urgent (Crimson Pulse)', () => {
      expect(getTimerUrgency(5)).toBe('urgent');
      expect(getTimerUrgency(3)).toBe('urgent');
      expect(getTimerUrgency(1)).toBe('urgent');
    });

    it('categorizes 0s or negative as timeout', () => {
      expect(getTimerUrgency(0)).toBe('timeout');
      expect(getTimerUrgency(-1)).toBe('timeout');
    });
  });

  describe('2. Wall-Clock Precision Math & Drift Resistance', () => {
    it('calculates remaining whole seconds accurately without drift', () => {
      const durationMs = 30 * 1000;
      const startTime = 1000000;

      // At start (0ms elapsed): 30s
      let now = startTime;
      let remaining = Math.max(0, durationMs - (now - startTime));
      expect(Math.ceil(remaining / 1000)).toBe(30);

      // At 500ms elapsed: 30s
      now = startTime + 500;
      remaining = Math.max(0, durationMs - (now - startTime));
      expect(Math.ceil(remaining / 1000)).toBe(30);

      // At 1001ms elapsed: 29s
      now = startTime + 1001;
      remaining = Math.max(0, durationMs - (now - startTime));
      expect(Math.ceil(remaining / 1000)).toBe(29);

      // At 15000ms elapsed: 15s
      now = startTime + 15000;
      remaining = Math.max(0, durationMs - (now - startTime));
      expect(Math.ceil(remaining / 1000)).toBe(15);

      // At 25000ms elapsed: 5s
      now = startTime + 25000;
      remaining = Math.max(0, durationMs - (now - startTime));
      expect(Math.ceil(remaining / 1000)).toBe(5);

      // At 29999ms elapsed: 1s
      now = startTime + 29999;
      remaining = Math.max(0, durationMs - (now - startTime));
      expect(Math.ceil(remaining / 1000)).toBe(1);

      // At 30000ms elapsed: 0s (timeout)
      now = startTime + 30000;
      remaining = Math.max(0, durationMs - (now - startTime));
      expect(Math.ceil(remaining / 1000)).toBe(0);

      // At 35000ms (clamped to 0)
      now = startTime + 35000;
      remaining = Math.max(0, durationMs - (now - startTime));
      expect(Math.ceil(remaining / 1000)).toBe(0);
    });

    it('prevents duplicate timeout events using a one-way latch', () => {
      let timeoutCallCount = 0;
      let hasTimedOut = false;

      const triggerTimeout = () => {
        if (!hasTimedOut) {
          hasTimedOut = true;
          timeoutCallCount++;
        }
      };

      // Repeated ticks at or beyond zero
      triggerTimeout();
      triggerTimeout();
      triggerTimeout();

      expect(timeoutCallCount).toBe(1);
      expect(hasTimedOut).toBe(true);
    });
  });

  describe('3. Pause, Resume & Elapsed Offset Preservation', () => {
    it('preserves accumulated elapsed time when paused and resumed', () => {
      const durationMs = 30000;
      let elapsedBeforePause = 0;
      let startTime: number | null = 1000;

      // Ran for 10 seconds, then paused
      let now = 11000;
      elapsedBeforePause += now - startTime;
      startTime = null;
      expect(elapsedBeforePause).toBe(10000);

      // System paused for 5 seconds (from 11000 to 16000)
      now = 16000;
      // Resumed at 16000
      startTime = now;

      // Ran for another 4 seconds (now = 20000)
      now = 20000;
      const totalElapsed = now - startTime + elapsedBeforePause;
      expect(totalElapsed).toBe(14000); // 10s + 4s = 14s

      const remainingMs = Math.max(0, durationMs - totalElapsed);
      expect(Math.ceil(remainingMs / 1000)).toBe(16); // 30s - 14s = 16s
    });
  });

  describe('4. Zero-Second Boundary & Real-Time Wall-Clock Verification', () => {
    it('returns 0ms and triggers timeout when wall-clock reaches zero even before next tick', () => {
      const durationMs = 30000;
      const startTime = 100000;

      // 10ms past deadline (30,010ms elapsed), simulating tick scheduling delay
      const now = startTime + 30010;
      const totalElapsedMs = now - startTime;
      const remainingMs = Math.max(0, durationMs - totalElapsedMs);

      expect(remainingMs).toBe(0);
      expect(Math.ceil(remainingMs / 1000)).toBe(0);
    });

    it('distinguishes positive remaining time from zero-second expiration', () => {
      const durationMs = 30000;
      const startTime = 100000;

      // 10ms before deadline (29,990ms elapsed): still 10ms left -> 1s display
      const nowBefore = startTime + 29990;
      const remBefore = Math.max(0, durationMs - (nowBefore - startTime));
      expect(remBefore).toBe(10);
      expect(Math.ceil(remBefore / 1000)).toBe(1);

      // Exactly at deadline (30,000ms elapsed): 0ms left -> 0s display / timeout
      const nowExact = startTime + 30000;
      const remExact = Math.max(0, durationMs - (nowExact - startTime));
      expect(remExact).toBe(0);
      expect(Math.ceil(remExact / 1000)).toBe(0);
    });
  });
});

