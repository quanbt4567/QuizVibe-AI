/**
 * Public Player Client API for QuizVibe AI (Phase 4).
 * Connects unauthenticated players to server-authoritative quiz sessions,
 * server-side scoring, lead capture, and leaderboard.
 */

export interface PublicQuestionPlay {
  questionIndex: number;
  questionText: string;
  options: [string, string, string, string];
}

export interface QuizSessionInit {
  sessionToken: string;
  sessionId: string;
  campaignId: string;
  campaignTitle: string;
  totalQuestions: number;
  timeLimitSeconds: number;
  currentQuestion: PublicQuestionPlay;
}

export interface QuizAnswerResult {
  isCorrect: boolean;
  pointsEarned: number;
  totalScore: number;
  isComplete: boolean;
  correctIndex?: number;
  explanation?: string | null;
  nextQuestion: PublicQuestionPlay | null;
  result?: {
    totalScore: number;
    correctCount: number;
    timeTakenSeconds: number;
  };
}

export interface UnlockedVoucher {
  code: string;
  discount: string;
  description: string;
  expiryDate?: string;
  terms?: string;
}

export interface QuizLeadSubmitResult {
  lead: {
    id: string;
    fullName: string;
    maskedPhone: string;
    score: number;
    timeTakenSeconds: number;
    rank: number;
  };
  voucher: UnlockedVoucher | null;
}

export interface LeaderboardEntryPublic {
  rank: number;
  fullName: string;
  maskedPhone: string;
  score: number;
  timeTakenSeconds: number;
  submittedAt: string;
}

export class PlayerApiError extends Error {
  public readonly status: number;
  public readonly code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.name = 'PlayerApiError';
    this.status = status;
    this.code = code;
  }
}

async function requestJson<T>(
  url: string,
  method: 'GET' | 'POST',
  body?: unknown
): Promise<T> {
  let response: Response;
  try {
    response = await fetch(url, {
      method,
      headers: {
        Accept: 'application/json',
        ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new PlayerApiError(0, 'NETWORK_ERROR', 'Không thể kết nối đến máy chủ.');
  }

  const data = await response.json().catch(() => null);
  if (!response.ok || !data || data.ok !== true) {
    throw new PlayerApiError(
      response.status,
      data?.code || 'REQUEST_FAILED',
      data?.error || `Lỗi máy chủ (${response.status}).`
    );
  }

  return data as T;
}

export const playerApi = {
  async startSession(slug: string): Promise<QuizSessionInit> {
    const data = await requestJson<{ ok: boolean; session: QuizSessionInit }>(
      '/api/quiz/session',
      'POST',
      { slug }
    );
    return data.session;
  },

  async submitAnswer(
    sessionToken: string,
    questionIndex: number,
    selectedOptionIndex: number | null
  ): Promise<QuizAnswerResult> {
    const data = await requestJson<{ ok: boolean; answer: QuizAnswerResult }>(
      '/api/quiz/answer',
      'POST',
      { sessionToken, questionIndex, selectedOptionIndex }
    );
    return data.answer;
  },

  async completeSession(sessionToken: string) {
    const data = await requestJson<{ ok: boolean; result: unknown }>(
      '/api/quiz/complete',
      'POST',
      { sessionToken }
    );
    return data.result;
  },

  async submitLead(
    sessionToken: string,
    fullName: string,
    phoneNumber: string
  ): Promise<QuizLeadSubmitResult> {
    const data = await requestJson<{ ok: boolean; lead: QuizLeadSubmitResult['lead']; voucher: UnlockedVoucher | null }>(
      '/api/quiz/lead',
      'POST',
      { sessionToken, fullName, phoneNumber }
    );
    return { lead: data.lead, voucher: data.voucher };
  },

  async fetchLeaderboard(slug: string): Promise<LeaderboardEntryPublic[]> {
    const data = await requestJson<{ ok: boolean; leaderboard: LeaderboardEntryPublic[] }>(
      `/api/quiz/leaderboard?slug=${encodeURIComponent(slug)}`,
      'GET'
    );
    return data.leaderboard || [];
  },
};

