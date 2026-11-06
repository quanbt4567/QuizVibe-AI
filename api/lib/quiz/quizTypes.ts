import type { QuizSessionStatus } from '../db/types';

export type QuizErrorCode =
  | 'CAMPAIGN_NOT_FOUND'
  | 'CAMPAIGN_NOT_PUBLISHED'
  | 'SESSION_NOT_FOUND'
  | 'SESSION_COMPLETED'
  | 'SESSION_EXPIRED'
  | 'INVALID_QUESTION_SEQUENCE'
  | 'INVALID_ANSWER_PAYLOAD'
  | 'CONCURRENT_SUBMISSION'
  | 'INVALID_LEAD_DATA'
  | 'DUPLICATE_LEAD'
  | 'VOUCHER_NOT_FOUND'
  | 'DATABASE_ERROR';

export class QuizError extends Error {
  public readonly code: QuizErrorCode;
  public readonly status: number;

  constructor(code: QuizErrorCode, message: string, status = 400) {
    super(message);
    this.name = 'QuizError';
    this.code = code;
    this.status = status;
  }
}

export interface PublicQuestionPlayDto {
  questionIndex: number;
  questionText: string;
  options: [string, string, string, string];
}

export interface QuizSessionInitResponse {
  sessionToken: string;
  sessionId: string;
  campaignId: string;
  campaignTitle: string;
  totalQuestions: number;
  timeLimitSeconds: number;
  currentQuestion: PublicQuestionPlayDto;
}

export interface QuizAnswerRequest {
  sessionToken: string;
  questionIndex: number;
  selectedOptionIndex: number | null; // null represents timeout or unanswered
}

export interface QuizAnswerResponse {
  isCorrect: boolean;
  pointsEarned: number;
  totalScore: number;
  isComplete: boolean;
  nextQuestion: PublicQuestionPlayDto | null;
  result?: {
    totalScore: number;
    correctCount: number;
    timeTakenSeconds: number;
  };
}

export interface QuizCompleteResponse {
  sessionId: string;
  totalScore: number;
  correctCount: number;
  totalQuestions: number;
  timeTakenSeconds: number;
  status: QuizSessionStatus;
}

export interface QuizLeadSubmitRequest {
  sessionToken: string;
  fullName: string;
  phoneNumber: string;
}

export interface UnlockedVoucherDto {
  code: string;
  discount: string;
  description: string;
  expiryDate?: string;
  terms?: string;
}

export interface QuizLeadSubmitResponse {
  lead: {
    id: string;
    fullName: string;
    maskedPhone: string;
    score: number;
    timeTakenSeconds: number;
    rank: number;
  };
  voucher: UnlockedVoucherDto | null;
}

export interface LeaderboardEntryDto {
  rank: number;
  fullName: string;
  maskedPhone: string;
  score: number;
  timeTakenSeconds: number;
  submittedAt: string;
}

