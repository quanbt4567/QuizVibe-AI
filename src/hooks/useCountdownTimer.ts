import { useState, useEffect, useRef, useCallback } from 'react';

export type TimerUrgency = 'safe' | 'caution' | 'urgent' | 'timeout';

export interface UseCountdownTimerOptions {
  durationSeconds?: number;
  autoStart?: boolean;
  onTimeout?: () => void;
}

export interface UseCountdownTimerResult {
  secondsRemaining: number;
  formattedSeconds: string;
  urgency: TimerUrgency;
  isRunning: boolean;
  isPaused: boolean;
  hasTimedOut: boolean;
  progressPercent: number; // 0 to 100%
  start: () => void;
  pause: () => void;
  resume: () => void;
  reset: (newDurationSeconds?: number) => void;
  getRemainingMs: () => number;
}

/**
 * Calculates timer urgency level based on approved thresholds (FR-202):
 * - Safe: 16s to 30s (Emerald)
 * - Caution: 6s to 15s (Amber)
 * - Urgent: 1s to 5s (Pulsing Crimson)
 * - Timeout: 0s (Red flash)
 */
export function getTimerUrgency(secondsRemaining: number): TimerUrgency {
  if (secondsRemaining <= 0) return 'timeout';
  if (secondsRemaining <= 5) return 'urgent';
  if (secondsRemaining <= 15) return 'caution';
  return 'safe';
}

/**
 * High-precision, drift-free countdown timer hook based on wall-clock timestamps.
 * Prevents interval duplication, memory leaks on unmount, and race-condition double timeouts.
 */
export function useCountdownTimer({
  durationSeconds = 30,
  autoStart = true,
  onTimeout,
}: UseCountdownTimerOptions = {}): UseCountdownTimerResult {
  const [secondsRemaining, setSecondsRemaining] = useState<number>(durationSeconds);
  const [isRunning, setIsRunning] = useState<boolean>(autoStart);
  const [isPaused, setIsPaused] = useState<boolean>(false);
  const [hasTimedOut, setHasTimedOut] = useState<boolean>(false);

  // High-precision timing refs to prevent setInterval drift
  const durationMsRef = useRef<number>(durationSeconds * 1000);
  const startTimeRef = useRef<number | null>(null);
  const elapsedBeforePauseRef = useRef<number>(0);
  const intervalIdRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const hasTimedOutRef = useRef<boolean>(false);
  const onTimeoutRef = useRef(onTimeout);

  // Keep callback ref fresh without triggering re-subscriptions
  useEffect(() => {
    onTimeoutRef.current = onTimeout;
  }, [onTimeout]);

  const clearTimerInterval = useCallback(() => {
    if (intervalIdRef.current !== null) {
      clearInterval(intervalIdRef.current);
      intervalIdRef.current = null;
    }
  }, []);

  const tick = useCallback(() => {
    if (startTimeRef.current === null) return;

    const now = Date.now();
    const totalElapsedMs = now - startTimeRef.current + elapsedBeforePauseRef.current;
    const remainingMs = Math.max(0, durationMsRef.current - totalElapsedMs);
    const wholeSecondsRemaining = Math.ceil(remainingMs / 1000);

    setSecondsRemaining(wholeSecondsRemaining);

    if (remainingMs <= 0) {
      clearTimerInterval();
      setIsRunning(false);
      setIsPaused(false);
      setSecondsRemaining(0);

      // Prevent duplicate timeout events
      if (!hasTimedOutRef.current) {
        hasTimedOutRef.current = true;
        setHasTimedOut(true);
        onTimeoutRef.current?.();
      }
    }
  }, [clearTimerInterval]);

  const start = useCallback(() => {
    clearTimerInterval();
    hasTimedOutRef.current = false;
    setHasTimedOut(false);
    elapsedBeforePauseRef.current = 0;
    startTimeRef.current = Date.now();
    setIsRunning(true);
    setIsPaused(false);
    setSecondsRemaining(Math.ceil(durationMsRef.current / 1000));

    // Run interval every 50ms for responsive, smooth wall-clock tracking
    intervalIdRef.current = setInterval(tick, 50);
  }, [clearTimerInterval, tick]);

  const pause = useCallback(() => {
    if (!isRunning || isPaused) return;

    clearTimerInterval();
    if (startTimeRef.current !== null) {
      elapsedBeforePauseRef.current += Date.now() - startTimeRef.current;
      startTimeRef.current = null;
    }
    setIsRunning(false);
    setIsPaused(true);
  }, [clearTimerInterval, isRunning, isPaused]);

  const resume = useCallback(() => {
    if (!isPaused || hasTimedOutRef.current) return;

    clearTimerInterval();
    startTimeRef.current = Date.now();
    setIsRunning(true);
    setIsPaused(false);
    intervalIdRef.current = setInterval(tick, 50);
  }, [clearTimerInterval, isPaused, tick]);

  const reset = useCallback(
    (newDurationSeconds?: number) => {
      clearTimerInterval();
      const nextDurationSec = newDurationSeconds ?? durationSeconds;
      durationMsRef.current = nextDurationSec * 1000;
      elapsedBeforePauseRef.current = 0;
      startTimeRef.current = null;
      hasTimedOutRef.current = false;
      setHasTimedOut(false);
      setIsPaused(false);
      setSecondsRemaining(nextDurationSec);

      if (autoStart) {
        startTimeRef.current = Date.now();
        setIsRunning(true);
        intervalIdRef.current = setInterval(tick, 50);
      } else {
        setIsRunning(false);
      }
    },
    [clearTimerInterval, durationSeconds, autoStart, tick]
  );

  // Mount/autoStart setup and cleanup
  useEffect(() => {
    durationMsRef.current = durationSeconds * 1000;
    if (autoStart) {
      start();
    }
    return () => {
      clearTimerInterval();
    };
  }, [durationSeconds, autoStart, start, clearTimerInterval]);

  const getRemainingMs = useCallback((): number => {
    if (hasTimedOutRef.current) return 0;
    if (startTimeRef.current === null) {
      return Math.max(0, durationMsRef.current - elapsedBeforePauseRef.current);
    }
    const now = Date.now();
    const totalElapsedMs = now - startTimeRef.current + elapsedBeforePauseRef.current;
    return Math.max(0, durationMsRef.current - totalElapsedMs);
  }, []);

  const urgency = getTimerUrgency(secondsRemaining);
  const formattedSeconds = `${secondsRemaining}s`;
  const initialDuration = durationMsRef.current / 1000 || 30;
  const progressPercent = Math.min(100, Math.max(0, (secondsRemaining / initialDuration) * 100));

  return {
    secondsRemaining,
    formattedSeconds,
    urgency,
    isRunning,
    isPaused,
    hasTimedOut,
    progressPercent,
    start,
    pause,
    resume,
    reset,
    getRemainingMs,
  };
}

