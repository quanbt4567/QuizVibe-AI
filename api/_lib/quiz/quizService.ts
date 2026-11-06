import crypto from 'node:crypto';
import { assertServerRuntime } from '../db/config.js';
import { QuizVibeDatabaseRepository } from '../db/repository.js';
import type { CompleteCampaignRecord, QuizSessionInsert } from '../db/types.js';
import {
  calculateSpeedScore,
  QUESTION_TIME_LIMIT_SECONDS,
  TOTAL_QUESTIONS,
} from './quizScoring.js';
import {
  LeaderboardEntryDto,
  PublicQuestionPlayDto,
  QuizAnswerResponse,
  QuizCompleteResponse,
  QuizError,
  QuizLeadSubmitResponse,
  QuizSessionInitResponse,
  UnlockedVoucherDto,
} from './quizTypes.js';

assertServerRuntime();

export function hashPlayerSessionToken(token: string): string {
  return crypto.createHash('sha256').update((token || '').trim()).digest('hex');
}

const VIETNAMESE_PHONE_REGEX = /^(03|05|07|08|09)\d{8}$/;

function cleanPublicSlug(raw: string): string {
  return (raw || '').trim().toLowerCase();
}

export class QuizService {
  private readonly repo: QuizVibeDatabaseRepository;
  private readonly now: () => number;

  constructor(options?: { repository?: QuizVibeDatabaseRepository; now?: () => number }) {
    assertServerRuntime();
    this.repo = options?.repository ?? new QuizVibeDatabaseRepository();
    this.now = options?.now ?? (() => Date.now());
  }

  /**
   * Starts a new player session for a PUBLISHED campaign.
   * Generates an unguessable session token and returns the first question without answer keys.
   */
  public async createSession(slugOrId: string): Promise<QuizSessionInitResponse> {
    const clean = cleanPublicSlug(slugOrId);
    let record: CompleteCampaignRecord | null = null;

    if (clean === 'active') {
      record = await this.repo.getLatestPublishedCampaign();
    } else {
      record = await this.repo.getPublishedCampaignBySlug(clean);
    }

    if (!record || record.campaign.status !== 'published') {
      throw new QuizError(
        'CAMPAIGN_NOT_PUBLISHED',
        'Chiến dịch không tồn tại hoặc chưa được xuất bản.',
        404
      );
    }

    const campaign = record.campaign;
    const questions = await this.repo.getCampaignQuestionsByCampaignId(campaign.id);
    if (!questions || questions.length !== TOTAL_QUESTIONS) {
      throw new QuizError(
        'CAMPAIGN_NOT_PUBLISHED',
        'Chiến dịch chưa được cấu hình đủ câu hỏi.',
        422
      );
    }

    const sessionToken = crypto.randomBytes(32).toString('hex');
    const sessionTokenHash = hashPlayerSessionToken(sessionToken);
    const nowIso = new Date(this.now()).toISOString();

    const sessionInsert: QuizSessionInsert = {
      campaign_id: campaign.id,
      session_token_hash: sessionTokenHash,
      status: 'in_progress',
      total_score: 0,
      correct_count: 0,
      total_questions: TOTAL_QUESTIONS,
      time_taken_seconds: 0,
      answers_snapshot: [],
      current_question_index: 0,
      current_question_started_at: nowIso,
      started_at: nowIso,
    };

    const createdSession = await this.repo.createQuizSession(sessionInsert);

    const firstQ = questions[0];
    const currentQuestion: PublicQuestionPlayDto = {
      questionIndex: 0,
      questionText: firstQ.question_text,
      options: firstQ.options,
    };

    return {
      sessionToken,
      sessionId: createdSession.id,
      campaignId: campaign.id,
      campaignTitle: campaign.title,
      totalQuestions: TOTAL_QUESTIONS,
      timeLimitSeconds: QUESTION_TIME_LIMIT_SECONDS,
      currentQuestion,
    };
  }

  /**
   * Submits an answer for the current question in the session.
   * Calculates score on the server based on server timestamps.
   * Enforces sequential progression, active campaign status, and atomic compare-and-set.
   */
  public async submitAnswer(
    sessionToken: string,
    questionIndex: number,
    selectedOptionIndex: number | null
  ): Promise<QuizAnswerResponse> {
    if (!sessionToken || typeof sessionToken !== 'string') {
      throw new QuizError('SESSION_NOT_FOUND', 'Thiếu mã phiên chơi.', 401);
    }

    const session = await this.repo.getQuizSessionByToken(sessionToken);
    if (!session) {
      throw new QuizError('SESSION_NOT_FOUND', 'Phiên chơi không tồn tại.', 404);
    }

    // Verify campaign is still published; reject if admin unpublished or archived it midway
    const campaignRecord = await this.repo.getCampaignById(session.campaign_id);
    if (!campaignRecord || campaignRecord.campaign.status !== 'published') {
      throw new QuizError(
        'CAMPAIGN_NOT_PUBLISHED',
        'Chiến dịch đã tạm dừng hoặc không còn khả dụng.',
        404
      );
    }

    if (session.status === 'completed') {
      throw new QuizError('SESSION_COMPLETED', 'Lượt chơi đã kết thúc.', 409);
    }
    if (session.status === 'expired') {
      throw new QuizError('SESSION_EXPIRED', 'Lượt chơi đã hết hạn.', 409);
    }

    const expectedIndex = session.current_question_index ?? (session.answers_snapshot?.length || 0);
    if (questionIndex !== expectedIndex) {
      throw new QuizError(
        'INVALID_QUESTION_SEQUENCE',
        `Thứ tự câu hỏi không hợp lệ (yêu cầu câu ${expectedIndex + 1}, nhận được câu ${questionIndex + 1}).`,
        409
      );
    }

    const questions = await this.repo.getCampaignQuestionsByCampaignId(session.campaign_id);
    const targetQ = questions.find((q) => q.question_order === questionIndex);
    if (!targetQ) {
      throw new QuizError('INVALID_ANSWER_PAYLOAD', 'Không tìm thấy câu hỏi tương ứng.', 404);
    }

    const serverNow = this.now();
    const qStartedAt = session.current_question_started_at
      ? new Date(session.current_question_started_at).getTime()
      : new Date(session.started_at).getTime();

    const elapsedMs = Math.max(0, serverNow - qStartedAt);
    const elapsedSeconds = elapsedMs / 1000;

    const isTimeout =
      elapsedSeconds > QUESTION_TIME_LIMIT_SECONDS ||
      selectedOptionIndex === null ||
      selectedOptionIndex === undefined ||
      selectedOptionIndex < 0 ||
      selectedOptionIndex > 3;

    const remainingWholeSeconds = isTimeout
      ? 0
      : Math.max(0, QUESTION_TIME_LIMIT_SECONDS - Math.floor(elapsedSeconds));

    const isCorrect = !isTimeout && selectedOptionIndex === targetQ.correct_index;
    const pointsEarned = calculateSpeedScore(isCorrect, remainingWholeSeconds);

    const nextIndex = questionIndex + 1;
    const isComplete = nextIndex >= TOTAL_QUESTIONS;
    const nowIso = new Date(serverNow).toISOString();

    const totalElapsedSeconds = Math.min(
      300,
      Math.max(1, Math.round((serverNow - new Date(session.started_at).getTime()) / 1000))
    );

    const snapshotItem = {
      questionOrder: questionIndex,
      selectedIndex: isTimeout ? null : selectedOptionIndex,
      isCorrect,
      remainingSeconds: remainingWholeSeconds,
      pointsAwarded: pointsEarned,
    };

    const newSnapshot = [...(session.answers_snapshot || []), snapshotItem];
    const newTotalScore = Math.min(2000, session.total_score + pointsEarned);
    const newCorrectCount = session.correct_count + (isCorrect ? 1 : 0);

    const updated = await this.repo.updateQuizSessionAnswerAtomic(session.id, expectedIndex, {
      total_score: newTotalScore,
      correct_count: newCorrectCount,
      current_question_index: nextIndex,
      current_question_started_at: nowIso,
      answers_snapshot: newSnapshot,
      status: isComplete ? 'completed' : 'in_progress',
      completed_at: isComplete ? nowIso : null,
      time_taken_seconds: isComplete ? totalElapsedSeconds : 0,
    });

    if (!updated) {
      throw new QuizError(
        'CONCURRENT_SUBMISSION',
        'Câu hỏi này đã được ghi nhận trước đó bởi thao tác khác.',
        409
      );
    }

    if (isComplete) {
      return {
        isCorrect,
        pointsEarned,
        totalScore: newTotalScore,
        isComplete: true,
        correctIndex: targetQ.correct_index,
        explanation: targetQ.explanation ?? null,
        nextQuestion: null,
        result: {
          totalScore: newTotalScore,
          correctCount: newCorrectCount,
          timeTakenSeconds: totalElapsedSeconds,
        },
      };
    }

    const nextQ = questions.find((q) => q.question_order === nextIndex);
    return {
      isCorrect,
      pointsEarned,
      totalScore: newTotalScore,
      isComplete: false,
      correctIndex: targetQ.correct_index,
      explanation: targetQ.explanation ?? null,
      nextQuestion: nextQ
        ? {
            questionIndex: nextIndex,
            questionText: nextQ.question_text,
            options: nextQ.options,
          }
        : null,
    };
  }

  /**
   * Completes an in-progress session or returns existing results for a completed session.
   */
  public async completeSession(sessionToken: string): Promise<QuizCompleteResponse> {
    if (!sessionToken) {
      throw new QuizError('SESSION_NOT_FOUND', 'Thiếu mã phiên chơi.', 401);
    }

    const session = await this.repo.getQuizSessionByToken(sessionToken);
    if (!session) {
      throw new QuizError('SESSION_NOT_FOUND', 'Phiên chơi không tồn tại.', 404);
    }

    return {
      sessionId: session.id,
      totalScore: session.total_score,
      correctCount: session.correct_count,
      totalQuestions: TOTAL_QUESTIONS,
      timeTakenSeconds: session.time_taken_seconds,
      status: session.status,
    };
  }

  /**
   * Submits player lead information, associates it with the validated session,
   * persists it in public.leads, and unlocks the configured voucher.
   */
  public async submitLead(
    sessionToken: string,
    fullName: string,
    phoneNumber: string
  ): Promise<QuizLeadSubmitResponse> {
    if (!sessionToken) {
      throw new QuizError('SESSION_NOT_FOUND', 'Thiếu mã phiên chơi.', 401);
    }

    const session = await this.repo.getQuizSessionByToken(sessionToken);
    if (!session) {
      throw new QuizError('SESSION_NOT_FOUND', 'Phiên chơi không tồn tại.', 404);
    }

    // Verify campaign is still published; reject if admin unpublished or archived it midway
    const campaignRecord = await this.repo.getCampaignById(session.campaign_id);
    if (!campaignRecord || campaignRecord.campaign.status !== 'published') {
      throw new QuizError(
        'CAMPAIGN_NOT_PUBLISHED',
        'Chiến dịch đã tạm dừng hoặc không còn khả dụng.',
        404
      );
    }

    if (session.status !== 'completed') {
      throw new QuizError(
        'SESSION_NOT_FOUND',
        'Vui lòng hoàn thành tất cả câu hỏi trước khi nhận thưởng voucher.',
        400
      );
    }

    // Check duplicate submission for this session
    const existing = await this.repo.getLeadByQuizSessionId(session.id);
    if (existing) {
      throw new QuizError(
        'DUPLICATE_LEAD',
        'Thông tin khách hàng đã được ghi nhận trước đó cho lượt chơi này.',
        409
      );
    }

    const cleanName = (fullName || '').trim();
    if (cleanName.length < 2) {
      throw new QuizError('INVALID_LEAD_DATA', 'Họ và tên phải có ít nhất 2 ký tự.', 400);
    }

    const cleanPhone = (phoneNumber || '').trim().replace(/\s+/g, '');
    if (!VIETNAMESE_PHONE_REGEX.test(cleanPhone)) {
      throw new QuizError(
        'INVALID_LEAD_DATA',
        'Số điện thoại không hợp lệ (10 số, đầu số di động VN: 03, 05, 07, 08, 09).',
        400
      );
    }

    const voucherRecord = await this.repo.getVoucherByCampaignId(session.campaign_id);
    const voucherCode = voucherRecord ? voucherRecord.code : null;

    const lead = await this.repo.createLeadForCampaign({
      campaign_id: session.campaign_id,
      quiz_session_id: session.id,
      full_name: cleanName,
      phone_number: cleanPhone,
      score: session.total_score,
      time_taken_seconds: session.time_taken_seconds,
      voucher_code: voucherCode,
    });

    const rank = await this.repo.getLeadRank(
      session.campaign_id,
      lead.score,
      lead.time_taken_seconds,
      lead.submitted_at
    );

    const unlockedVoucher: UnlockedVoucherDto | null = voucherRecord
      ? {
          code: voucherRecord.code,
          discount: voucherRecord.discount,
          description: voucherRecord.description,
          expiryDate: voucherRecord.expiry_date ?? undefined,
          terms: voucherRecord.terms ?? undefined,
        }
      : null;

    return {
      lead: {
        id: lead.id,
        fullName: lead.full_name,
        maskedPhone: lead.masked_phone,
        score: lead.score,
        timeTakenSeconds: lead.time_taken_seconds,
        rank,
      },
      voucher: unlockedVoucher,
    };
  }

  /**
   * Retrieves the Top 10 Leaderboard for a published campaign.
   * Strictly masks phone numbers and never leaks private answers or session tokens.
   */
  public async getLeaderboard(slugOrId: string): Promise<LeaderboardEntryDto[]> {
    const clean = cleanPublicSlug(slugOrId);
    let record: CompleteCampaignRecord | null = null;

    if (clean === 'active') {
      record = await this.repo.getLatestPublishedCampaign();
    } else {
      record = await this.repo.getPublishedCampaignBySlug(clean);
    }

    if (!record || record.campaign.status !== 'published') {
      throw new QuizError('CAMPAIGN_NOT_PUBLISHED', 'Chiến dịch không tồn tại.', 404);
    }

    const leaderboard = await this.repo.getCampaignLeaderboard(record.campaign.id, 10);
    return leaderboard.map((l) => ({
      rank: l.rank,
      fullName: l.full_name,
      maskedPhone: l.masked_phone,
      score: l.score,
      timeTakenSeconds: l.time_taken_seconds,
      submittedAt: l.submitted_at,
    }));
  }
}
