/**
 * Mathematical Speed Scoring Engine (FR-203, TC-02):
 * Score = 100 + (10 * T_rem) if correct, where 0 <= T_rem <= 30
 * Score = 0 if incorrect or timeout.
 *
 * Acceptance Criteria:
 * - Correct answer at 30s: 400 pts
 * - Correct answer at 18s: 280 pts
 * - Correct answer at 1s:  110 pts
 * - Correct answer at 0s:  100 pts
 * - Incorrect answer:        0 pts
 * - Timeout:                 0 pts
 * - Maximum question score: 400 pts
 * - Maximum 5-question total: 2,000 pts
 */
export function calculateSpeedScore(isCorrect: boolean, timeRemainingSeconds: number): number {
  if (!isCorrect) {
    return 0;
  }

  // Ensure remaining whole seconds are clamped within 0..30
  const clampedSeconds = Math.max(0, Math.min(30, Math.floor(timeRemainingSeconds)));
  const score = 100 + 10 * clampedSeconds;

  // Enforce ceiling of 400 pts per question
  return Math.max(0, Math.min(400, score));
}

export interface QuestionPlayResult {
  questionIndex: number; // 0 to 4
  questionId: string;
  question: string;
  options?: string[];
  explanation?: string;
  selectedOptionIndex: number | null; // null if timed out
  correctIndex: number;
  isCorrect: boolean;
  timeRemainingSeconds: number;
  timeSpentSeconds: number;
  score: number;
}

export interface QuizGameSessionResult {
  campaignId: string;
  totalScore: number; // 0 to 2000
  totalCorrect: number; // 0 to 5
  totalQuestions: number; // 5
  totalTimeSpentSeconds: number;
  results: QuestionPlayResult[];
  completedAt: string;
}

