/**
 * Server-authoritative Speed Scoring calculation for QuizVibe AI.
 *
 * RULES:
 *  - Each question has a 30-second time limit.
 *  - Correct answer: 100 + 10 * remaining whole seconds.
 *  - Incorrect answer: 0 points.
 *  - Timeout: 0 points.
 *  - Maximum score per question: 400 points (30s remaining => 100 + 300 = 400).
 *  - Minimum score for correct answer: 100 points (0s remaining before timeout cut-off).
 *  - 5 questions per quiz => Maximum total score: 2000 points.
 */

export const QUESTION_TIME_LIMIT_SECONDS = 30;
export const MAX_QUESTION_SCORE = 400;
export const BASE_QUESTION_SCORE = 100;
export const POINTS_PER_REMAINING_SECOND = 10;
export const TOTAL_QUESTIONS = 5;
export const MAX_TOTAL_SCORE = 2000;

/**
 * Calculates authoritative speed score based solely on correctness and remaining whole seconds.
 */
export function calculateSpeedScore(
  isCorrect: boolean,
  remainingWholeSeconds: number
): number {
  if (!isCorrect) return 0;
  if (typeof remainingWholeSeconds !== 'number' || isNaN(remainingWholeSeconds)) return 0;
  if (remainingWholeSeconds < 0) return 0;

  const clampedSeconds = Math.max(0, Math.min(QUESTION_TIME_LIMIT_SECONDS, Math.floor(remainingWholeSeconds)));
  const score = BASE_QUESTION_SCORE + POINTS_PER_REMAINING_SECOND * clampedSeconds;
  return Math.min(MAX_QUESTION_SCORE, Math.max(BASE_QUESTION_SCORE, score));
}

