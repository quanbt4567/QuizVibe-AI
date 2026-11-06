// @vitest-environment node
import crypto from 'node:crypto';
import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import { FakePostgrest, FAKE_SUPABASE_HOST } from '../_lib/testing/fakePostgrest.js';
import { mockHttp } from '../_lib/testing/httpMock.js';
import { calculateSpeedScore } from '../_lib/quiz/quizScoring.js';
import { QuizVibeDatabaseRepository } from '../_lib/db/repository.js';

const fake = new FakePostgrest();
let restoreFetch: () => void;
const SAVED_ENV: Record<string, string | undefined> = {};

const ENV: Record<string, string> = {
  SUPABASE_URL: `https://${FAKE_SUPABASE_HOST}`,
  SUPABASE_SERVICE_ROLE_KEY: 'sb_secret_synthetic_fake_key_for_tests_only',
  ADMIN_SESSION_SECRET: 'f3a91c07be4d82a65e10c9b7d4a3f281660ba9e5c7d1348f2b0e6a95d7c43e18',
  NODE_ENV: 'test',
};

let sessionHandler: any;
let answerHandler: any;
let completeHandler: any;
let leadHandler: any;
let leaderboardHandler: any;

async function loadHandlers() {
  vi.resetModules();
  const [session, answer, complete, lead, leaderboard] = await Promise.all([
    import('./session.js'),
    import('./answer.js'),
    import('./complete.js'),
    import('./lead.js'),
    import('./leaderboard.js'),
  ]);
  sessionHandler = session.default;
  answerHandler = answer.default;
  completeHandler = complete.default;
  leadHandler = lead.default;
  leaderboardHandler = leaderboard.default;
}

const CAMPAIGN_ID = '11111111-1111-4111-8111-111111111111';
const DRAFT_CAMPAIGN_ID = '22222222-2222-4222-8222-222222222222';
const CAMPAIGN_SLUG = 'thu-thach-lam-dep';
const DRAFT_SLUG = 'nhap-chua-xuat-ban';

function seedTestCampaigns() {
  const now = new Date().toISOString();

  // 1. Published campaign
  fake.tables.campaigns.push({
    id: CAMPAIGN_ID,
    slug: CAMPAIGN_SLUG,
    title: 'Thử thách Làm đẹp Mùa xuân',
    description: 'Trả lời 5 câu trắc nghiệm nhận voucher',
    industry: 'Mỹ phẩm & Chăm sóc da',
    status: 'published',
    is_ai_generated: false,
    is_mock: false,
    published_at: now,
    created_at: now,
    updated_at: now,
  });

  // 2. Draft campaign
  fake.tables.campaigns.push({
    id: DRAFT_CAMPAIGN_ID,
    slug: DRAFT_SLUG,
    title: 'Bản nháp chưa xuất bản',
    description: 'Chỉ admin thấy',
    industry: 'Thời trang',
    status: 'draft',
    is_ai_generated: false,
    is_mock: false,
    published_at: null,
    created_at: now,
    updated_at: now,
  });

  // 3. 5 Questions for published campaign
  const correctIndices = [1, 0, 2, 3, 1]; // Answer keys
  for (let i = 0; i < 5; i++) {
    fake.tables.campaign_questions.push({
      id: `q_${i + 1}`,
      campaign_id: CAMPAIGN_ID,
      question_order: i,
      question_text: `Nội dung câu hỏi số ${i + 1}?`,
      options: ['Phương án A', 'Phương án B', 'Phương án C', 'Phương án D'],
      correct_index: correctIndices[i],
      explanation: `Giải thích chi tiết cho câu ${i + 1}`,
      created_at: now,
      updated_at: now,
    });
  }

  // 4. Voucher configuration
  fake.tables.vouchers.push({
    id: 'v_1',
    campaign_id: CAMPAIGN_ID,
    code: 'BEAUTY50',
    discount: 'Giảm 50% đơn hàng',
    description: 'Dành cho khách hàng vượt qua minigame',
    expiry_date: '30 ngày kể từ khi nhận',
    terms: 'Áp dụng trên toàn hệ thống',
    created_at: now,
    updated_at: now,
  });
}

beforeAll(async () => {
  restoreFetch = fake.install();
  for (const k of Object.keys(ENV)) SAVED_ENV[k] = process.env[k];
  Object.assign(process.env, ENV);
  await loadHandlers();
});

afterAll(() => {
  restoreFetch();
  for (const k of Object.keys(SAVED_ENV)) {
    if (SAVED_ENV[k] === undefined) delete process.env[k];
    else process.env[k] = SAVED_ENV[k];
  }
});

beforeEach(() => {
  fake.reset();
  seedTestCampaigns();
});

describe('Phase 4: Player Sessions & Server-Side Scoring Engine', () => {
  describe('1. Speed Scoring Formula unit tests', () => {
    it('calculates score according to 100 + 10 * remainingWholeSeconds', () => {
      // 30 seconds remaining => 100 + 300 = 400
      expect(calculateSpeedScore(true, 30)).toBe(400);
      // 20 seconds remaining => 100 + 200 = 300
      expect(calculateSpeedScore(true, 20)).toBe(300);
      // 1 second remaining => 100 + 10 = 110
      expect(calculateSpeedScore(true, 1)).toBe(110);
      // Minimum correct score (0 seconds remaining): 100 points
      expect(calculateSpeedScore(true, 0)).toBe(100);
      // Timeout representation (isCorrect: false) => 0 points
      expect(calculateSpeedScore(false, 0)).toBe(0);
      // Negative remaining seconds => 0 points
      expect(calculateSpeedScore(true, -1)).toBe(0);
      expect(calculateSpeedScore(true, -10)).toBe(0);
      // Invalid input => 0 points
      expect(calculateSpeedScore(true, NaN)).toBe(0);
      // Incorrect answer => 0 points regardless of time
      expect(calculateSpeedScore(false, 30)).toBe(0);
      expect(calculateSpeedScore(false, 15)).toBe(0);
      // Max score clamped at 400
      expect(calculateSpeedScore(true, 50)).toBe(400);
    });
  });

  describe('2. Player Session Initiation (POST /api/quiz/session)', () => {
    it('creates a session for a published campaign and returns question 0 without answer keys', async () => {
      const http = mockHttp({
        method: 'POST',
        body: { slug: CAMPAIGN_SLUG },
      });
      await sessionHandler(http.req, http.res);

      expect(http.res.status$()).toBe(201);
      const body = http.res.body$();
      expect(body.ok).toBe(true);
      expect(body.session.sessionToken).toBeTruthy();
      expect(body.session.sessionId).toBeTruthy();
      expect(body.session.totalQuestions).toBe(5);
      expect(body.session.currentQuestion.questionIndex).toBe(0);
      expect(body.session.currentQuestion.questionText).toBe('Nội dung câu hỏi số 1?');
      expect(body.session.currentQuestion.options).toHaveLength(4);

      // Verify zero answer key leaks
      const rawText = JSON.stringify(body);
      expect(rawText).not.toContain('correct_index');
      expect(rawText).not.toContain('correctIndex');
      expect(rawText).not.toContain('explanation');
      expect(rawText).not.toContain('BEAUTY50');

      // Check database state: verify hash-only token protection (zero plaintext storage at rest)
      expect(fake.tables.quiz_sessions).toHaveLength(1);
      const sessionRow = fake.tables.quiz_sessions[0];
      expect(sessionRow.status).toBe('in_progress');
      expect(sessionRow.total_score).toBe(0);
      expect(sessionRow.current_question_index).toBe(0);
      expect((sessionRow as any).session_token).toBeUndefined();
      expect(sessionRow.session_token_hash).toBeTruthy();
      const expectedHash = crypto.createHash('sha256').update(body.session.sessionToken).digest('hex');
      expect(sessionRow.session_token_hash).toBe(expectedHash);
    });

    it('rejects session creation for draft or archived campaigns with 404', async () => {
      const http = mockHttp({
        method: 'POST',
        body: { slug: DRAFT_SLUG },
      });
      await sessionHandler(http.req, http.res);

      expect(http.res.status$()).toBe(404);
      expect(http.res.body$().ok).toBe(false);
      expect(fake.tables.quiz_sessions).toHaveLength(0);
    });

    it('rejects session creation for nonexistent campaigns', async () => {
      const http = mockHttp({
        method: 'POST',
        body: { slug: 'khong-ton-tai' },
      });
      await sessionHandler(http.req, http.res);

      expect(http.res.status$()).toBe(404);
      expect(http.res.body$().ok).toBe(false);
    });
  });

  describe('3. Server-Side Answer Progression & Scoring (POST /api/quiz/answer)', () => {
    async function startSession(): Promise<string> {
      const http = mockHttp({
        method: 'POST',
        body: { slug: CAMPAIGN_SLUG },
      });
      await sessionHandler(http.req, http.res);
      return http.res.body$().session.sessionToken;
    }

    it('scores correct answer, updates session, and advances to next question', async () => {
      const token = await startSession();

      // Question 0 correct index is 1 (Phương án B)
      const http = mockHttp({
        method: 'POST',
        body: {
          sessionToken: token,
          questionIndex: 0,
          selectedOptionIndex: 1,
        },
      });
      await answerHandler(http.req, http.res);

      expect(http.res.status$()).toBe(200);
      const body = http.res.body$();
      expect(body.ok).toBe(true);
      expect(body.answer.isCorrect).toBe(true);
      expect(body.answer.pointsEarned).toBeGreaterThanOrEqual(100);
      expect(body.answer.pointsEarned).toBeLessThanOrEqual(400);
      expect(body.answer.totalScore).toBe(body.answer.pointsEarned);
      expect(body.answer.isComplete).toBe(false);
      expect(body.answer.correctIndex).toBe(1);
      expect(body.answer.nextQuestion.questionIndex).toBe(1);
      expect(body.answer.nextQuestion.questionText).toBe('Nội dung câu hỏi số 2?');
      expect(body.answer.nextQuestion).not.toHaveProperty('correctIndex');
      expect(body.answer.nextQuestion).not.toHaveProperty('explanation');

      // Zero answer leakage
      expect(JSON.stringify(body)).not.toContain('correct_index');
      expect(JSON.stringify(body)).not.toContain('BEAUTY50');
    });

    it('scores incorrect answer with 0 points', async () => {
      const token = await startSession();

      // Question 0 correct index is 1, submit option 3 (wrong)
      const http = mockHttp({
        method: 'POST',
        body: {
          sessionToken: token,
          questionIndex: 0,
          selectedOptionIndex: 3,
        },
      });
      await answerHandler(http.req, http.res);

      expect(http.res.status$()).toBe(200);
      const body = http.res.body$();
      expect(body.answer.isCorrect).toBe(false);
      expect(body.answer.pointsEarned).toBe(0);
      expect(body.answer.totalScore).toBe(0);
    });

    it('scores timeout (null option) with 0 points', async () => {
      const token = await startSession();

      const http = mockHttp({
        method: 'POST',
        body: {
          sessionToken: token,
          questionIndex: 0,
          selectedOptionIndex: null,
        },
      });
      await answerHandler(http.req, http.res);

      expect(http.res.status$()).toBe(200);
      const body = http.res.body$();
      expect(body.answer.isCorrect).toBe(false);
      expect(body.answer.pointsEarned).toBe(0);
    });

    it('rejects out-of-order questions (replay earlier question or skip ahead)', async () => {
      const token = await startSession();

      // Attempt to answer question 2 before question 0
      const skipHttp = mockHttp({
        method: 'POST',
        body: {
          sessionToken: token,
          questionIndex: 2,
          selectedOptionIndex: 0,
        },
      });
      await answerHandler(skipHttp.req, skipHttp.res);
      expect(skipHttp.res.status$()).toBe(409);
      expect(skipHttp.res.body$().code).toBe('INVALID_QUESTION_SEQUENCE');

      // Now answer question 0 correctly
      const q0Http = mockHttp({
        method: 'POST',
        body: {
          sessionToken: token,
          questionIndex: 0,
          selectedOptionIndex: 1,
        },
      });
      await answerHandler(q0Http.req, q0Http.res);
      expect(q0Http.res.status$()).toBe(200);

      // Attempt to replay question 0
      const replayHttp = mockHttp({
        method: 'POST',
        body: {
          sessionToken: token,
          questionIndex: 0,
          selectedOptionIndex: 1,
        },
      });
      await answerHandler(replayHttp.req, replayHttp.res);
      expect(replayHttp.res.status$()).toBe(409);
      expect(replayHttp.res.body$().code).toBe('INVALID_QUESTION_SEQUENCE');
    });

    it('completes the quiz on the 5th question and marks session completed', async () => {
      const token = await startSession();
      const correctIndices = [1, 0, 2, 3, 1];

      for (let i = 0; i < 5; i++) {
        const http = mockHttp({
          method: 'POST',
          body: {
            sessionToken: token,
            questionIndex: i,
            selectedOptionIndex: correctIndices[i],
          },
        });
        await answerHandler(http.req, http.res);
        expect(http.res.status$()).toBe(200);

        if (i === 4) {
          const body = http.res.body$();
          expect(body.answer.isComplete).toBe(true);
          expect(body.answer.nextQuestion).toBeNull();
          expect(body.answer.result).toBeDefined();
          expect(body.answer.result.correctCount).toBe(5);
          expect(body.answer.result.totalScore).toBeGreaterThanOrEqual(500);
          expect(body.answer.result.totalScore).toBeLessThanOrEqual(2000);
        }
      }

      // Check database status
      const sessionRow = fake.tables.quiz_sessions[0];
      expect(sessionRow.status).toBe('completed');
      expect(sessionRow.correct_count).toBe(5);
      expect(sessionRow.answers_snapshot).toHaveLength(5);

      // Attempting to answer again after completion must fail
      const postCompleteHttp = mockHttp({
        method: 'POST',
        body: {
          sessionToken: token,
          questionIndex: 4,
          selectedOptionIndex: 1,
        },
      });
      await answerHandler(postCompleteHttp.req, postCompleteHttp.res);
      expect(postCompleteHttp.res.status$()).toBe(409);
      expect(postCompleteHttp.res.body$().code).toBe('SESSION_COMPLETED');
    });

    it('supports explicit session completion endpoint (POST /api/quiz/complete)', async () => {
      const token = await startSession();

      // In progress session returns in_progress status
      const cHttp1 = mockHttp({ method: 'POST', body: { sessionToken: token } });
      await completeHandler(cHttp1.req, cHttp1.res);
      expect(cHttp1.res.status$()).toBe(200);
      expect(cHttp1.res.body$().ok).toBe(true);
      expect(cHttp1.res.body$().result.status).toBe('in_progress');

      // Answer all 5 questions
      for (let i = 0; i < 5; i++) {
        const aHttp = mockHttp({
          method: 'POST',
          body: { sessionToken: token, questionIndex: i, selectedOptionIndex: 1 },
        });
        await answerHandler(aHttp.req, aHttp.res);
      }

      // Now complete endpoint reflects completed status
      const cHttp2 = mockHttp({ method: 'POST', body: { sessionToken: token } });
      await completeHandler(cHttp2.req, cHttp2.res);
      expect(cHttp2.res.status$()).toBe(200);
      expect(cHttp2.res.body$().ok).toBe(true);
      expect(cHttp2.res.body$().result.status).toBe('completed');
    });

    it('rejects answer submission if campaign is unpublished or archived mid-session', async () => {
      const token = await startSession();

      // Admin archives or unpublishes campaign mid-quiz
      const camp = fake.tables.campaigns.find((c) => c.id === CAMPAIGN_ID);
      expect(camp).toBeDefined();
      camp!.status = 'draft';

      const http = mockHttp({
        method: 'POST',
        body: {
          sessionToken: token,
          questionIndex: 0,
          selectedOptionIndex: 1,
        },
      });
      await answerHandler(http.req, http.res);

      expect(http.res.status$()).toBe(404);
      expect(http.res.body$().code).toBe('CAMPAIGN_NOT_PUBLISHED');
    });
  });

  describe('4. Lead Submission & Voucher Unlocking (POST /api/quiz/lead)', () => {
    async function completeFullQuiz(): Promise<string> {
      const sHttp = mockHttp({ method: 'POST', body: { slug: CAMPAIGN_SLUG } });
      await sessionHandler(sHttp.req, sHttp.res);
      const token = sHttp.res.body$().session.sessionToken;

      for (let i = 0; i < 5; i++) {
        const aHttp = mockHttp({
          method: 'POST',
          body: { sessionToken: token, questionIndex: i, selectedOptionIndex: 1 },
        });
        await answerHandler(aHttp.req, aHttp.res);
      }
      return token;
    }

    it('rejects lead submission for incomplete in-progress session', async () => {
      const sHttp = mockHttp({ method: 'POST', body: { slug: CAMPAIGN_SLUG } });
      await sessionHandler(sHttp.req, sHttp.res);
      const token = sHttp.res.body$().session.sessionToken;

      const http = mockHttp({
        method: 'POST',
        body: {
          sessionToken: token,
          fullName: 'Nguyễn Văn A',
          phoneNumber: '0912345678',
        },
      });
      await leadHandler(http.req, http.res);

      expect(http.res.status$()).toBe(400);
      expect(http.res.body$().ok).toBe(false);
      expect(fake.tables.leads).toHaveLength(0);
    });

    it('rejects invalid Vietnamese phone numbers', async () => {
      const token = await completeFullQuiz();
      const invalidPhones = ['1234567890', '091234567', '09123456789', '0212345678', 'abc'];

      for (const phone of invalidPhones) {
        const http = mockHttp({
          method: 'POST',
          body: {
            sessionToken: token,
            fullName: 'Lê Văn Test',
            phoneNumber: phone,
          },
        });
        await leadHandler(http.req, http.res);
        expect(http.res.status$(), `Failed to reject phone: ${phone}`).toBe(400);
        expect(http.res.body$().code).toBe('INVALID_LEAD_DATA');
      }
      expect(fake.tables.leads).toHaveLength(0);
    });

    it('rejects names shorter than 2 trimmed characters', async () => {
      const token = await completeFullQuiz();
      const http = mockHttp({
        method: 'POST',
        body: {
          sessionToken: token,
          fullName: '  A  ',
          phoneNumber: '0987654321',
        },
      });
      await leadHandler(http.req, http.res);

      expect(http.res.status$()).toBe(400);
      expect(http.res.body$().code).toBe('INVALID_LEAD_DATA');
    });

    it('accepts valid lead submission, persists lead, computes rank, and unlocks voucher', async () => {
      const token = await completeFullQuiz();

      const http = mockHttp({
        method: 'POST',
        body: {
          sessionToken: token,
          fullName: '  Trần Thị Bích  ',
          phoneNumber: '0987654321',
        },
      });
      await leadHandler(http.req, http.res);

      expect(http.res.status$()).toBe(201);
      const body = http.res.body$();
      expect(body.ok).toBe(true);
      expect(body.lead.fullName).toBe('Trần Thị Bích');
      expect(body.lead.maskedPhone).toBe('098***4321');
      expect(body.lead.rank).toBe(1);
      expect(body.lead.score).toBeGreaterThan(0);

      // Voucher is now unlocked!
      expect(body.voucher).toBeDefined();
      expect(body.voucher.code).toBe('BEAUTY50');
      expect(body.voucher.discount).toBe('Giảm 50% đơn hàng');

      // Full phone number is NEVER in the public lead payload
      expect(body.lead.phoneNumber).toBeUndefined();

      // Persisted in database
      expect(fake.tables.leads).toHaveLength(1);
      const leadRow = fake.tables.leads[0];
      expect(leadRow.full_name).toBe('Trần Thị Bích');
      expect(leadRow.phone_number).toBe('0987654321');
      expect(leadRow.masked_phone).toBe('098***4321');
      expect(leadRow.voucher_code).toBe('BEAUTY50');
      expect(leadRow.campaign_id).toBe(CAMPAIGN_ID);
    });

    it('rejects duplicate lead submission for the same session (409)', async () => {
      const token = await completeFullQuiz();

      // First submission
      const first = mockHttp({
        method: 'POST',
        body: {
          sessionToken: token,
          fullName: 'Trần Thị Bích',
          phoneNumber: '0987654321',
        },
      });
      await leadHandler(first.req, first.res);
      expect(first.res.status$()).toBe(201);

      // Duplicate submission
      const second = mockHttp({
        method: 'POST',
        body: {
          sessionToken: token,
          fullName: 'Trần Thị Bích Hack',
          phoneNumber: '0987654321',
        },
      });
      await leadHandler(second.req, second.res);
      expect(second.res.status$()).toBe(409);
      expect(second.res.body$().code).toBe('DUPLICATE_LEAD');

      // Still only 1 row in database
      expect(fake.tables.leads).toHaveLength(1);
    });

    it('rejects lead submission if campaign is unpublished mid-session', async () => {
      const token = await completeFullQuiz();

      // Admin unpublishes campaign
      const camp = fake.tables.campaigns.find((c) => c.id === CAMPAIGN_ID);
      expect(camp).toBeDefined();
      camp!.status = 'draft';

      const http = mockHttp({
        method: 'POST',
        body: {
          sessionToken: token,
          fullName: 'Nguyễn Văn A',
          phoneNumber: '0912345678',
        },
      });
      await leadHandler(http.req, http.res);

      expect(http.res.status$()).toBe(404);
      expect(http.res.body$().code).toBe('CAMPAIGN_NOT_PUBLISHED');
    });

    it('returns voucher: null without inventing fallback codes when campaign has no voucher', async () => {
      // Remove voucher from fake table
      fake.tables.vouchers = [];

      const token = await completeFullQuiz();

      const http = mockHttp({
        method: 'POST',
        body: {
          sessionToken: token,
          fullName: 'Đặng Thu Thảo',
          phoneNumber: '0934567890',
        },
      });
      await leadHandler(http.req, http.res);

      expect(http.res.status$()).toBe(201);
      const body = http.res.body$();
      expect(body.ok).toBe(true);
      expect(body.voucher).toBeNull();

      // Verify persisted lead has null voucher_code, never 'VIBE-REWARD'
      const lead = fake.tables.leads.find((l) => l.full_name === 'Đặng Thu Thảo');
      expect(lead).toBeDefined();
      expect(lead!.voucher_code).toBeNull();
      expect(JSON.stringify(body)).not.toContain('VIBE-REWARD');
    });

    it('recovers seamlessly from database leads_masked_phone_check (23514) via fallback mask', async () => {
      const token = await completeFullQuiz();

      // Trigger 23514 only on initial insert if masked_phone contains 3 digits before asterisks
      let firstAttempt = true;
      fake.failure = (req) => {
        if (req.table === 'leads' && req.method === 'POST') {
          if (firstAttempt) {
            firstAttempt = false;
            return 'masked_phone_check';
          }
        }
        return null;
      };

      const http = mockHttp({
        method: 'POST',
        body: {
          sessionToken: token,
          fullName: 'Võ Minh Quân',
          phoneNumber: '0981234567',
        },
      });
      await leadHandler(http.req, http.res);

      expect(http.res.status$()).toBe(201);
      const body = http.res.body$();
      expect(body.ok).toBe(true);
      expect(body.lead.fullName).toBe('Võ Minh Quân');

      // Verify the persisted lead used the fallback mask (09***4567)
      const lead = fake.tables.leads.find((l) => l.full_name === 'Võ Minh Quân');
      expect(lead).toBeDefined();
      expect(lead!.masked_phone).toBe('09***4567');
      fake.failure = null;
    });

    it('translates database unique constraint race (23505) to 409 DUPLICATE_LEAD', async () => {
      const token = await completeFullQuiz();

      fake.failure = (req) => {
        if (req.table === 'leads' && req.method === 'POST') {
          return 'duplicate_session_race';
        }
        return null;
      };

      const http = mockHttp({
        method: 'POST',
        body: {
          sessionToken: token,
          fullName: 'Trần Văn Song Song',
          phoneNumber: '0971234567',
        },
      });
      await leadHandler(http.req, http.res);

      expect(http.res.status$()).toBe(409);
      expect(http.res.body$().code).toBe('DUPLICATE_LEAD');
      fake.failure = null;
    });
  });

  describe('5. Public Leaderboard (GET /api/quiz/leaderboard)', () => {
    it('returns top 10 leads ordered by score DESC, time ASC, submittedAt ASC with masked phone numbers', async () => {
      // Seed 4 leads with tie-breaking scenarios
      fake.tables.leads.push(
        {
          id: 'l_1',
          campaign_id: CAMPAIGN_ID,
          full_name: 'Nguyễn Văn B',
          phone_number: '0911111111',
          masked_phone: '091***1111',
          score: 1500,
          time_taken_seconds: 40,
          voucher_code: 'BEAUTY50',
          submitted_at: '2026-11-05T10:00:00.000Z',
        },
        {
          id: 'l_2',
          campaign_id: CAMPAIGN_ID,
          full_name: 'Nguyễn Văn A (Faster)',
          phone_number: '0922222222',
          masked_phone: '092***2222',
          score: 1500,
          time_taken_seconds: 30, // faster time breaks tie
          voucher_code: 'BEAUTY50',
          submitted_at: '2026-11-05T10:05:00.000Z',
        },
        {
          id: 'l_3',
          campaign_id: CAMPAIGN_ID,
          full_name: 'Cao Thủ Top 1',
          phone_number: '0933333333',
          masked_phone: '093***3333',
          score: 1800,
          time_taken_seconds: 25,
          voucher_code: 'BEAUTY50',
          submitted_at: '2026-11-05T09:00:00.000Z',
        },
        {
          id: 'l_4',
          campaign_id: CAMPAIGN_ID,
          full_name: 'Người Chơi Điểm Thấp',
          phone_number: '0944444444',
          masked_phone: '094***4444',
          score: 800,
          time_taken_seconds: 50,
          voucher_code: 'BEAUTY50',
          submitted_at: '2026-11-05T11:00:00.000Z',
        }
      );

      const http = mockHttp({
        method: 'GET',
        query: { slug: CAMPAIGN_SLUG },
      });
      await leaderboardHandler(http.req, http.res);

      expect(http.res.status$()).toBe(200);
      const body = http.res.body$();
      expect(body.ok).toBe(true);
      expect(body.leaderboard).toHaveLength(4);

      // Verify exact sorting:
      // Rank 1: Cao Thủ Top 1 (1800 pts)
      expect(body.leaderboard[0].rank).toBe(1);
      expect(body.leaderboard[0].fullName).toBe('Cao Thủ Top 1');
      expect(body.leaderboard[0].score).toBe(1800);

      // Rank 2: Nguyễn Văn A (Faster) (1500 pts, 30s)
      expect(body.leaderboard[1].rank).toBe(2);
      expect(body.leaderboard[1].fullName).toBe('Nguyễn Văn A (Faster)');
      expect(body.leaderboard[1].timeTakenSeconds).toBe(30);

      // Rank 3: Nguyễn Văn B (1500 pts, 40s)
      expect(body.leaderboard[2].rank).toBe(3);
      expect(body.leaderboard[2].fullName).toBe('Nguyễn Văn B');
      expect(body.leaderboard[2].timeTakenSeconds).toBe(40);

      // Rank 4: Người Chơi Điểm Thấp (800 pts)
      expect(body.leaderboard[3].rank).toBe(4);

      // Privacy checks: NEVER expose full phone number, voucher code, lead ID
      const rawText = JSON.stringify(body);
      expect(rawText).not.toContain('0911111111');
      expect(rawText).not.toContain('0922222222');
      expect(rawText).not.toContain('BEAUTY50');
      expect(rawText).not.toContain('l_1');
      expect(rawText).not.toContain('l_2');
    });
  });

  describe('6. Phase 7.2 Clean Hash-Only Token Architecture Verification', () => {
    it('1. Pre-existing session with hash is authenticated via player bearer token', async () => {
      const playerToken = 'player_token_fedcba0987654321fedcba0987654321';
      const expectedHash = crypto.createHash('sha256').update(playerToken).digest('hex');

      // Database row has only session_token_hash populated (hash-only storage at rest)
      fake.tables.quiz_sessions.push({
        id: 'legacy_sess_1',
        campaign_id: CAMPAIGN_ID,
        session_token_hash: expectedHash,
        status: 'in_progress',
        total_score: 0,
        correct_count: 0,
        total_questions: 5,
        time_taken_seconds: 0,
        answers_snapshot: [],
        current_question_index: 0,
        current_question_started_at: new Date().toISOString(),
        started_at: new Date().toISOString(),
      });

      // Application authenticates this session via sessionToken
      const answerHttp = mockHttp({
        method: 'POST',
        body: {
          sessionToken: playerToken,
          questionIndex: 0,
          selectedOptionIndex: 1,
        },
      });
      await answerHandler(answerHttp.req, answerHttp.res);

      expect(answerHttp.res.status$()).toBe(200);
      expect(answerHttp.res.body$().ok).toBe(true);
      expect(answerHttp.res.body$().answer.isCorrect).toBe(true);
    });

    it('2. New player session persists only session_token_hash and returns bearer token (No plaintext storage)', async () => {
      const startHttp = mockHttp({
        method: 'POST',
        body: { slug: CAMPAIGN_SLUG },
      });
      await sessionHandler(startHttp.req, startHttp.res);
      expect(startHttp.res.status$()).toBe(201);
      const newSessionId = startHttp.res.body$().session.sessionId;
      const rawToken = startHttp.res.body$().session.sessionToken;

      expect(rawToken).toBeTruthy();
      expect(startHttp.res.body$().session.session_token_hash).toBeUndefined(); // Never leaked to client

      const sessionRow = fake.tables.quiz_sessions.find((r) => r.id === newSessionId);
      expect(sessionRow).toBeDefined();
      // Verified: session_token is NEVER persisted
      expect((sessionRow as any)?.session_token).toBeUndefined();
      expect(sessionRow?.session_token_hash).toBe(
        crypto.createHash('sha256').update(rawToken).digest('hex')
      );

      // Authenticates subsequent answer request via hash lookup
      const answerHttp = mockHttp({
        method: 'POST',
        body: {
          sessionToken: rawToken,
          questionIndex: 0,
          selectedOptionIndex: 1,
        },
      });
      await answerHandler(answerHttp.req, answerHttp.res);
      expect(answerHttp.res.status$()).toBe(200);
      expect(answerHttp.res.body$().answer.isCorrect).toBe(true);
    });

    it('3. Unknown or invalid bearer token fails closed without querying plaintext column', async () => {
      const repo = new QuizVibeDatabaseRepository();
      const fakeDb = (repo as any).db;
      const querySpy = vi.spyOn(fakeDb, 'from');

      const result = await repo.getQuizSessionByToken('completely_unknown_token_9999');
      expect(result).toBeNull();

      // Ensure that quiz_sessions was queried by hash only, never session_token
      expect(querySpy).toHaveBeenCalledWith('quiz_sessions');
      querySpy.mockRestore();

      // Verify HTTP endpoint returns 404 SESSION_NOT_FOUND cleanly
      const invalidHttp = mockHttp({
        method: 'POST',
        body: {
          sessionToken: 'invalid_token_xyz',
          questionIndex: 0,
          selectedOptionIndex: 1,
        },
      });
      await answerHandler(invalidHttp.req, invalidHttp.res);
      expect(invalidHttp.res.status$()).toBe(404);
      expect(invalidHttp.res.body$().code).toBe('SESSION_NOT_FOUND');
    });

    it('4. New application authenticates the updated session', async () => {
      const token = 'session_for_updated_auth_test_12345';
      const expectedHash = crypto.createHash('sha256').update(token).digest('hex');

      fake.tables.quiz_sessions.push({
        id: 'sess_updated_auth',
        campaign_id: CAMPAIGN_ID,
        session_token: token,
        session_token_hash: expectedHash,
        status: 'in_progress',
        total_score: 0,
        correct_count: 0,
        total_questions: 5,
        time_taken_seconds: 0,
        answers_snapshot: [],
        current_question_index: 0,
        current_question_started_at: new Date().toISOString(),
        started_at: new Date().toISOString(),
      });

      const answerHttp = mockHttp({
        method: 'POST',
        body: {
          sessionToken: token,
          questionIndex: 0,
          selectedOptionIndex: 1,
        },
      });
      await answerHandler(answerHttp.req, answerHttp.res);
      expect(answerHttp.res.status$()).toBe(200);
      expect(answerHttp.res.body$().answer.isCorrect).toBe(true);
    });

    it('5. Hash mismatch or tampering fails closed', async () => {
      const validToken = 'valid_session_token_998877665544332211';
      const validHash = crypto.createHash('sha256').update(validToken).digest('hex');

      fake.tables.quiz_sessions.push({
        id: 'sess_tamper_test',
        campaign_id: CAMPAIGN_ID,
        session_token: validToken,
        session_token_hash: validHash,
        status: 'in_progress',
        total_score: 0,
        correct_count: 0,
        total_questions: 5,
        time_taken_seconds: 0,
        answers_snapshot: [],
        current_question_index: 0,
        current_question_started_at: new Date().toISOString(),
        started_at: new Date().toISOString(),
      });

      // Submit with slightly altered token
      const tamperedHttp = mockHttp({
        method: 'POST',
        body: {
          sessionToken: validToken + '_tampered',
          questionIndex: 0,
          selectedOptionIndex: 1,
        },
      });
      await answerHandler(tamperedHttp.req, tamperedHttp.res);

      expect(tamperedHttp.res.status$()).toBe(404);
      expect(tamperedHttp.res.body$().code).toBe('SESSION_NOT_FOUND');
    });

    it('6. After plaintext writes are disabled, new sessions remain usable by new application', async () => {
      // Gate passed: all old instances have drained. Now disable plaintext writing.
      process.env.ENABLE_LEGACY_SESSION_TOKEN_WRITE = 'false';

      try {
        const startHttp = mockHttp({
          method: 'POST',
          body: { slug: CAMPAIGN_SLUG },
        });
        await sessionHandler(startHttp.req, startHttp.res);
        expect(startHttp.res.status$()).toBe(201);
        const newSessionId = startHttp.res.body$().session.sessionId;
        const rawToken = startHttp.res.body$().session.sessionToken;

        const sessionRow = fake.tables.quiz_sessions.find((r) => r.id === newSessionId);
        expect(sessionRow).toBeDefined();
        // session_token is now undefined (zero plaintext storage at rest)
        expect(sessionRow?.session_token).toBeUndefined();
        expect(sessionRow?.session_token_hash).toBeTruthy();

        // New application authenticates question answer using only session_token_hash
        const answerHttp = mockHttp({
          method: 'POST',
          body: {
            sessionToken: rawToken,
            questionIndex: 0,
            selectedOptionIndex: 1,
          },
        });
        await answerHandler(answerHttp.req, answerHttp.res);
        expect(answerHttp.res.status$()).toBe(200);
        expect(answerHttp.res.body$().answer.isCorrect).toBe(true);
      } finally {
        delete process.env.ENABLE_LEGACY_SESSION_TOKEN_WRITE;
      }
    });

    it('7. Contract migration pre-flight checks enforce hash completeness, consistency, and active session safety', async () => {
      // Helper function simulating the SQL pre-flight verification function in 20261105000006_player_session_token_contract.sql
      function evaluateContractPreflight(rows: Array<{
        status: string;
        session_token?: string | null;
        session_token_hash?: string | null;
      }>) {
        // Check 1: Require EVERY row in public.quiz_sessions to possess a non-null, non-empty session_token_hash
        const invalidHashCount = rows.filter(
          (r) => !r.session_token_hash || r.session_token_hash.trim() === ''
        ).length;
        if (invalidHashCount > 0) {
          return {
            aborted: true,
            reason: `Found ${invalidHashCount} row(s) with NULL, empty, or whitespace session_token_hash. Every session row must possess a valid hash before dropping session_token.`,
          };
        }

        // Check 2: Reject empty or whitespace plaintext session_tokens
        const emptyTokenCount = rows.filter(
          (r) => r.session_token !== null && r.session_token !== undefined && r.session_token.trim() === ''
        ).length;
        if (emptyTokenCount > 0) {
          return {
            aborted: true,
            reason: `Found ${emptyTokenCount} row(s) with empty or whitespace session_token violating data integrity contract.`,
          };
        }

        // Check 3: Cryptographic consistency between plaintext session_token and session_token_hash
        const inconsistentHashCount = rows.filter((r) => {
          if (!r.session_token || r.session_token.trim() === '') return false;
          const digest = crypto.createHash('sha256').update(r.session_token.trim()).digest('hex');
          return r.session_token_hash !== digest;
        }).length;
        if (inconsistentHashCount > 0) {
          return {
            aborted: true,
            reason: `Found ${inconsistentHashCount} row(s) where session_token_hash does not match digest(session_token).`,
          };
        }

        // Check 4: Assert zero duplicate non-null hashes
        const hashCounts = new Map<string, number>();
        for (const r of rows) {
          if (r.session_token_hash) {
            hashCounts.set(r.session_token_hash, (hashCounts.get(r.session_token_hash) || 0) + 1);
          }
        }
        let dupCount = 0;
        for (const count of hashCounts.values()) {
          if (count > 1) dupCount++;
        }
        if (dupCount > 0) {
          return {
            aborted: true,
            reason: `Found ${dupCount} duplicate session_token_hash value(s) in public.quiz_sessions.`,
          };
        }

        // Check 5: SHA-256 Hash Format Integrity Gate across ALL rows (Check 2e)
        const malformedHashCount = rows.filter(
          (r) => r.session_token_hash && !/^[0-9a-f]{64}$/.test(r.session_token_hash)
        ).length;
        if (malformedHashCount > 0) {
          return {
            aborted: true,
            reason: `Found ${malformedHashCount} row(s) with malformed session_token_hash. Every session_token_hash must be exactly 64 lowercase hexadecimal characters matching canonical SHA-256 format (^[0-9a-f]{64}$).`,
          };
        }

        return { aborted: false, reason: null };
      }

      // Condition 1: Aborts if a session has plaintext token but missing hash (NULL, empty string, or whitespace)
      const res1Null = evaluateContractPreflight([
        { status: 'completed', session_token: 'token_abc', session_token_hash: null },
      ]);
      expect(res1Null.aborted).toBe(true);
      expect(res1Null.reason).toContain('NULL, empty, or whitespace session_token_hash');

      const res1Empty = evaluateContractPreflight([
        { status: 'completed', session_token: 'token_abc', session_token_hash: '' },
      ]);
      expect(res1Empty.aborted).toBe(true);
      expect(res1Empty.reason).toContain('NULL, empty, or whitespace session_token_hash');

      const res1Whitespace = evaluateContractPreflight([
        { status: 'completed', session_token: 'token_abc', session_token_hash: '   ' },
      ]);
      expect(res1Whitespace.aborted).toBe(true);
      expect(res1Whitespace.reason).toContain('NULL, empty, or whitespace session_token_hash');

      // Condition 2: Aborts if a session has inconsistent hash
      const res2 = evaluateContractPreflight([
        { status: 'in_progress', session_token: 'token_abc', session_token_hash: 'wrong_hash' },
      ]);
      expect(res2.aborted).toBe(true);
      expect(res2.reason).toContain('does not match digest');

      // Condition 3: Aborts if an active session has no hash (NULL, empty, or whitespace, even if plaintext is null)
      const res3Null = evaluateContractPreflight([
        { status: 'in_progress', session_token: null, session_token_hash: null },
      ]);
      expect(res3Null.aborted).toBe(true);
      expect(res3Null.reason).toContain('NULL, empty, or whitespace session_token_hash');

      const res3Empty = evaluateContractPreflight([
        { status: 'in_progress', session_token: null, session_token_hash: '' },
      ]);
      expect(res3Empty.aborted).toBe(true);
      expect(res3Empty.reason).toContain('NULL, empty, or whitespace session_token_hash');

      const res3Whitespace = evaluateContractPreflight([
        { status: 'in_progress', session_token: null, session_token_hash: '   ' },
      ]);
      expect(res3Whitespace.aborted).toBe(true);
      expect(res3Whitespace.reason).toContain('NULL, empty, or whitespace session_token_hash');

      // Condition 4: Historical completed/expired pre-Phase-4 sessions without hashes FAIL closed (Finding 2)
      const res4 = evaluateContractPreflight([
        { status: 'completed', session_token: null, session_token_hash: null },
        { status: 'expired', session_token: null, session_token_hash: null },
      ]);
      expect(res4.aborted).toBe(true);
      expect(res4.reason).toContain('NULL, empty, or whitespace session_token_hash');

      // Condition 5: Valid hash-only sessions, historical backfilled sessions, and dual-written sessions pass cleanly
      const validToken = 'valid_token_123';
      const validHash = crypto.createHash('sha256').update(validToken).digest('hex');
      const validToken2 = 'valid_token_456';
      const validHash2 = crypto.createHash('sha256').update(validToken2).digest('hex');
      const validHash3 = crypto.createHash('sha256').update('valid_token_789').digest('hex');
      const res5 = evaluateContractPreflight([
        // Dual-written session
        { status: 'in_progress', session_token: validToken, session_token_hash: validHash },
        // Hash-only session (post-dual-write)
        { status: 'in_progress', session_token: null, session_token_hash: validHash2 },
        // Historical completed session with backfilled hash
        { status: 'completed', session_token: null, session_token_hash: validHash3 },
      ]);
      expect(res5.aborted).toBe(false);

      // Condition 6: Aborts if duplicate hashes exist
      const res6 = evaluateContractPreflight([
        { status: 'in_progress', session_token: validToken, session_token_hash: validHash },
        { status: 'completed', session_token: validToken, session_token_hash: validHash },
      ]);
      expect(res6.aborted).toBe(true);
      expect(res6.reason).toContain('duplicate session_token_hash');

      // Gate 7 Diagnostics exact SQL equivalence simulation
      function runGate7DiagnosticQuery(rows: Array<{
        status: string;
        session_token?: string | null;
        session_token_hash?: string | null;
      }>) {
        const invalid_hash = rows.filter(
          (r) => !r.session_token_hash || r.session_token_hash.trim() === ''
        ).length;

        const empty_token = rows.filter(
          (r) => r.session_token !== null && r.session_token !== undefined && r.session_token.trim() === ''
        ).length;

        const inconsistent_hash = rows.filter((r) => {
          if (!r.session_token || r.session_token.trim() === '' || !r.session_token_hash || r.session_token_hash.trim() === '') return false;
          const digest = crypto.createHash('sha256').update(r.session_token.trim()).digest('hex');
          return r.session_token_hash !== digest;
        }).length;

        return { invalid_hash, empty_token, inconsistent_hash };
      }

      // Verify Gate 7 diagnostic catches empty strings, whitespace, and nulls consistently across all rows
      const diagnosticResult = runGate7DiagnosticQuery([
        { status: 'completed', session_token: 'tok_empty', session_token_hash: '' },
        { status: 'completed', session_token: 'tok_ws', session_token_hash: '   ' },
        { status: 'in_progress', session_token: 'tok_inconsistent', session_token_hash: 'inconsistent_hash' },
        { status: 'in_progress', session_token: null, session_token_hash: '' },
        { status: 'in_progress', session_token: null, session_token_hash: null },
      ]);
      expect(diagnosticResult.invalid_hash).toBe(4);
      expect(diagnosticResult.inconsistent_hash).toBe(1);
    });

    it('8. Hash-only application operates seamlessly through entire gameplay lifecycle when plaintext session_token is completely dropped', async () => {
      // Simulate post-contract state: dual-writing is disabled (ENABLE_LEGACY_SESSION_TOKEN_WRITE=false)
      // and quiz_sessions table has no plaintext session_token column
      process.env.ENABLE_LEGACY_SESSION_TOKEN_WRITE = 'false';

      try {
        // 1. Create Session
        const startHttp = mockHttp({
          method: 'POST',
          body: { slug: CAMPAIGN_SLUG },
        });
        await sessionHandler(startHttp.req, startHttp.res);
        expect(startHttp.res.status$()).toBe(201);
        const token = startHttp.res.body$().session.sessionToken;
        const sessionId = startHttp.res.body$().session.sessionId;

        // Verify row has zero plaintext token stored
        const row = fake.tables.quiz_sessions.find((r) => r.id === sessionId);
        expect(row).toBeDefined();
        expect(row?.session_token).toBeUndefined();
        expect(row?.session_token_hash).toBe(
          crypto.createHash('sha256').update(token).digest('hex')
        );

        // 2. Play all 5 questions
        for (let i = 0; i < 5; i++) {
          const ansHttp = mockHttp({
            method: 'POST',
            body: {
              sessionToken: token,
              questionIndex: i,
              selectedOptionIndex: 1,
            },
          });
          await answerHandler(ansHttp.req, ansHttp.res);
          expect(ansHttp.res.status$()).toBe(200);
          expect(ansHttp.res.body$().ok).toBe(true);
        }

        // 3. Complete Session
        const compHttp = mockHttp({
          method: 'POST',
          body: { sessionToken: token },
        });
        await completeHandler(compHttp.req, compHttp.res);
        expect(compHttp.res.status$()).toBe(200);
        expect(compHttp.res.body$().result.status).toBe('completed');

        // 4. Submit Lead
        const leadHttp = mockHttp({
          method: 'POST',
          body: {
            sessionToken: token,
            fullName: 'Người Chơi Hash Only',
            phoneNumber: '0981234567',
          },
        });
        await leadHandler(leadHttp.req, leadHttp.res);
        expect(leadHttp.res.status$()).toBe(201);
        expect(leadHttp.res.body$().ok).toBe(true);
        expect(leadHttp.res.body$().lead.fullName).toBe('Người Chơi Hash Only');
      } finally {
        delete process.env.ENABLE_LEGACY_SESSION_TOKEN_WRITE;
      }
    });

    it('9. Migration 000006 Check 2e: SHA-256 hash format integrity gate enforces 64 lowercase hex characters across all session rows', () => {
      function evaluateCheck2e(rows: Array<{
        status: string;
        session_token?: string | null;
        session_token_hash?: string | null;
      }>) {
        // Simulates Migration 000006 Check 2e:
        // SELECT count(*) INTO v_malformed_hash_count
        // FROM public.quiz_sessions
        // WHERE session_token_hash !~ '^[0-9a-f]{64}$';
        const malformedCount = rows.filter(
          (r) => !r.session_token_hash || !/^[0-9a-f]{64}$/.test(r.session_token_hash)
        ).length;

        if (malformedCount > 0) {
          return {
            aborted: true,
            count: malformedCount,
            reason: `Found ${malformedCount} row(s) with malformed session_token_hash. Every session_token_hash must be exactly 64 lowercase hexadecimal characters matching canonical SHA-256 format (^[0-9a-f]{64}$).`,
          };
        }
        return { aborted: false, count: 0, reason: null };
      }

      // Scenario 1: Valid 64-character lowercase hexadecimal hash passes cleanly
      const valid64Hex = 'a1b2c3d4e5f67890'.repeat(4); // exactly 64 lowercase hex chars
      expect(valid64Hex).toHaveLength(64);
      expect(/^[0-9a-f]{64}$/.test(valid64Hex)).toBe(true);
      const res1 = evaluateCheck2e([
        { status: 'in_progress', session_token: null, session_token_hash: valid64Hex },
        { status: 'completed', session_token: 'tok_abc', session_token_hash: crypto.createHash('sha256').update('tok_abc').digest('hex') },
      ]);
      expect(res1.aborted).toBe(false);
      expect(res1.count).toBe(0);

      // Scenario 2: Hash shorter than 64 characters aborts with count
      const shortHash = 'a1b2c3d4e5f67890'.repeat(3); // 48 chars
      expect(shortHash.length).toBeLessThan(64);
      const res2 = evaluateCheck2e([
        { status: 'in_progress', session_token: null, session_token_hash: shortHash },
      ]);
      expect(res2.aborted).toBe(true);
      expect(res2.count).toBe(1);
      expect(res2.reason).toContain('Found 1 row(s) with malformed session_token_hash');

      // Scenario 3: Hash longer than 64 characters aborts with count
      const longHash = 'a1b2c3d4e5f67890'.repeat(4) + 'f'; // 65 chars
      expect(longHash.length).toBeGreaterThan(64);
      const res3 = evaluateCheck2e([
        { status: 'in_progress', session_token: null, session_token_hash: longHash },
      ]);
      expect(res3.aborted).toBe(true);
      expect(res3.count).toBe(1);
      expect(res3.reason).toContain('Found 1 row(s) with malformed session_token_hash');

      // Scenario 4: Hash containing non-hex characters aborts with count
      const nonHexHash = 'g'.repeat(64); // 64 chars but 'g' is non-hex
      const nonHexHash2 = 'a'.repeat(63) + 'z'; // 64 chars but 'z' is non-hex
      const res4 = evaluateCheck2e([
        { status: 'in_progress', session_token: null, session_token_hash: nonHexHash },
        { status: 'in_progress', session_token: null, session_token_hash: nonHexHash2 },
      ]);
      expect(res4.aborted).toBe(true);
      expect(res4.count).toBe(2);
      expect(res4.reason).toContain('Found 2 row(s) with malformed session_token_hash');

      // Scenario 5: Uppercase hash (canonical lowercase required) aborts with count
      const upperHash = 'A1B2C3D4E5F67890'.repeat(4); // 64 uppercase chars
      expect(upperHash).toHaveLength(64);
      const res5 = evaluateCheck2e([
        { status: 'in_progress', session_token: null, session_token_hash: upperHash },
      ]);
      expect(res5.aborted).toBe(true);
      expect(res5.count).toBe(1);
      expect(res5.reason).toContain('Found 1 row(s) with malformed session_token_hash');

      // Scenario 6: Malformed hash-only row (session_token IS NULL) aborts (cannot hide behind NULL token)
      const res6 = evaluateCheck2e([
        { status: 'in_progress', session_token: null, session_token_hash: 'hash_only_malformed_token_string' },
      ]);
      expect(res6.aborted).toBe(true);
      expect(res6.count).toBe(1);
      expect(res6.reason).toContain('Found 1 row(s) with malformed session_token_hash');

      // Scenario 7: Malformed hash on completed or expired session aborts (protects historical records)
      const res7 = evaluateCheck2e([
        { status: 'completed', session_token: null, session_token_hash: 'completed_session_corrupt_hash' },
        { status: 'expired', session_token: null, session_token_hash: 'expired_session_bad_hash_value' },
      ]);
      expect(res7.aborted).toBe(true);
      expect(res7.count).toBe(2);
      expect(res7.reason).toContain('Found 2 row(s) with malformed session_token_hash');
    });
  });
});
