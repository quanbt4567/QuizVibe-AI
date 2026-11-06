// @vitest-environment node
import { describe, it, expect, beforeEach, beforeAll, afterAll } from 'vitest';
import crypto from 'node:crypto';
import { FakePostgrest, FAKE_SUPABASE_HOST } from '../testing/fakePostgrest.js';
import { createSupabaseServerClient, resetSupabaseServerClientCache } from './supabaseServer.js';
import {
  QuizVibeDatabaseRepository,
  hashVietnamesePhone,
} from './repository.js';
import { QuizService } from '../quiz/quizService.js';
import { QuizError } from '../quiz/quizTypes.js';

const CAMPAIGN_ID = 'a4720a44-f039-4f80-9f00-dfac138af21c';
const SECOND_CAMPAIGN_ID = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';

const ENV = {
  SUPABASE_URL: `https://${FAKE_SUPABASE_HOST}`,
  SUPABASE_SERVICE_ROLE_KEY:
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.test-service-role-key-123456789012345',
};

const HISTORICAL_LEAD_1 = {
  id: '819a82dd-aae3-4bf6-a850-e0db78b77cfb',
  campaign_id: CAMPAIGN_ID,
  quiz_session_id: '5438e9fe-b41d-4775-8b75-6c299b5e544b',
  full_name: 'Nguyen Tran Minh Quan',
  phone_number: '0897654321',
  masked_phone: '089***4321',
  score: 1840,
  time_taken_seconds: 18,
  voucher_code: 'VIBE20',
  submitted_at: '2026-11-06T17:23:48.238+00:00',
  created_at: '2026-11-06T17:23:48.238+00:00',
};

const HISTORICAL_LEAD_2 = {
  id: 'a9eb7f01-2817-4476-a404-613d92601ef2',
  campaign_id: CAMPAIGN_ID,
  quiz_session_id: '70e06057-343f-4ab1-8ebb-37199f902ac5',
  full_name: 'Nguyen Tran Minh Quan',
  phone_number: '0897654321',
  masked_phone: '089***4321',
  score: 1470,
  time_taken_seconds: 20,
  voucher_code: 'VIBE20',
  submitted_at: '2026-11-06T17:27:20.060+00:00',
  created_at: '2026-11-06T17:27:20.060+00:00',
};

describe('Campaign Phone Registrations & Historical Lead Preservation', () => {
  let fake: FakePostgrest;
  let restoreFetch: () => void;
  const savedEnv: Record<string, string | undefined> = {};
  let repo: QuizVibeDatabaseRepository;
  let quizService: QuizService;

  beforeAll(() => {
    fake = new FakePostgrest();
    restoreFetch = fake.install();
    for (const k of Object.keys(ENV)) savedEnv[k] = process.env[k];
    Object.assign(process.env, ENV);
  });

  afterAll(() => {
    restoreFetch();
    for (const k of Object.keys(savedEnv)) {
      if (savedEnv[k] === undefined) delete process.env[k];
      else process.env[k] = savedEnv[k];
    }
  });

  beforeEach(() => {
    fake.reset();
    resetSupabaseServerClientCache();

    const client = createSupabaseServerClient(process.env);
    repo = new QuizVibeDatabaseRepository(client);
    quizService = new QuizService({ repository: repo });

    // Seed campaign
    const now = new Date().toISOString();
    fake.tables.campaigns.push({
      id: CAMPAIGN_ID,
      slug: 'quiz-ai-gen-z',
      title: 'Quiz AI: Gen Z hiểu Việt Nam đến đâu?',
      description: 'Mô tả chiến dịch',
      industry: 'Công nghệ',
      status: 'published',
      is_ai_generated: false,
      is_mock: false,
      published_at: now,
      created_at: now,
      updated_at: now,
    });
    fake.tables.vouchers.push({
      id: 'v_vibe20',
      campaign_id: CAMPAIGN_ID,
      code: 'VIBE20',
      discount: 'Giảm 20%',
      description: 'Voucher ưu đãi',
      expiry_date: null,
      terms: null,
      created_at: now,
      updated_at: now,
    });
  });

  /**
   * Helper simulating the SQL migration backfill logic:
   * INSERT INTO public.campaign_phone_registrations (...)
   * SELECT DISTINCT ON (campaign_id, phone_hash) ...
   * ORDER BY campaign_id, phone_hash, submitted_at ASC, id ASC
   * ON CONFLICT (campaign_id, phone_hash) DO NOTHING
   */
  function runMigrationBackfill(): { insertedCount: number } {
    let insertedCount = 0;
    const sortedLeads = [...fake.tables.leads].sort((a, b) => {
      const timeDiff = new Date(a.submitted_at).getTime() - new Date(b.submitted_at).getTime();
      if (timeDiff !== 0) return timeDiff;
      return a.id.localeCompare(b.id);
    });

    for (const lead of sortedLeads) {
      const pHash = hashVietnamesePhone(lead.phone_number);
      const exists = fake.tables.campaign_phone_registrations.some(
        (r) => r.campaign_id === lead.campaign_id && r.phone_hash === pHash
      );
      if (!exists) {
        fake.tables.campaign_phone_registrations.push({
          id: crypto.randomUUID(),
          campaign_id: lead.campaign_id,
          phone_hash: pHash,
          first_lead_id: lead.id,
          created_at: lead.submitted_at,
        });
        insertedCount++;
      }
    }
    return { insertedCount };
  }

  it('preserves historical duplicate leads exactly without modification or deletion', () => {
    fake.tables.leads.push({ ...HISTORICAL_LEAD_1 });
    fake.tables.leads.push({ ...HISTORICAL_LEAD_2 });

    const backfillResult = runMigrationBackfill();

    expect(backfillResult.insertedCount).toBe(1);
    expect(fake.tables.leads).toHaveLength(2);
    expect(fake.tables.leads[0]).toEqual(HISTORICAL_LEAD_1);
    expect(fake.tables.leads[1]).toEqual(HISTORICAL_LEAD_2);
  });

  it('creates exactly one registration claim for historical duplicates with the earliest lead as first_lead_id', () => {
    fake.tables.leads.push({ ...HISTORICAL_LEAD_1 });
    fake.tables.leads.push({ ...HISTORICAL_LEAD_2 });

    runMigrationBackfill();

    const claims = fake.tables.campaign_phone_registrations;
    expect(claims).toHaveLength(1);
    expect(claims[0].campaign_id).toBe(CAMPAIGN_ID);
    expect(claims[0].phone_hash).toBe(hashVietnamesePhone('0897654321'));
    expect(claims[0].first_lead_id).toBe(HISTORICAL_LEAD_1.id);
    expect(claims[0].created_at).toBe(HISTORICAL_LEAD_1.submitted_at);
  });

  it('rejects a new registration for a historically registered phone number (same campaign)', async () => {
    fake.tables.leads.push({ ...HISTORICAL_LEAD_1 });
    fake.tables.leads.push({ ...HISTORICAL_LEAD_2 });
    runMigrationBackfill();

    // Create completed session
    const sessionToken = 'token_player_attempt_12345';
    const tokenHash = crypto.createHash('sha256').update(sessionToken).digest('hex');
    const sessionId = crypto.randomUUID();
    fake.tables.quiz_sessions.push({
      id: sessionId,
      campaign_id: CAMPAIGN_ID,
      status: 'completed',
      total_score: 1900,
      correct_count: 5,
      total_questions: 5,
      time_taken_seconds: 15,
      answers_snapshot: [],
      session_token: sessionToken,
      session_token_hash: tokenHash,
      started_at: new Date().toISOString(),
      completed_at: new Date().toISOString(),
      created_at: new Date().toISOString(),
    });

    await expect(
      quizService.submitLead(sessionToken, 'Người Chơi Mới', '+84 89 765 4321')
    ).rejects.toThrowError(
      expect.objectContaining({
        code: 'PHONE_ALREADY_REGISTERED',
        status: 409,
      })
    );

    // Ensure no new lead or voucher was created
    expect(fake.tables.leads).toHaveLength(2);
    expect(fake.tables.campaign_phone_registrations).toHaveLength(1);
  });

  it('allows the same phone number to register in a different campaign', async () => {
    fake.tables.leads.push({ ...HISTORICAL_LEAD_1 });
    fake.tables.leads.push({ ...HISTORICAL_LEAD_2 });
    runMigrationBackfill();

    // Seed second campaign
    const now = new Date().toISOString();
    fake.tables.campaigns.push({
      id: SECOND_CAMPAIGN_ID,
      slug: 'quiz-thoi-trang',
      title: 'Thử thách Thời trang',
      description: 'Mô tả',
      industry: 'Thời trang',
      status: 'published',
      is_ai_generated: false,
      is_mock: false,
      published_at: now,
      created_at: now,
      updated_at: now,
    });
    fake.tables.vouchers.push({
      id: 'v_style10',
      campaign_id: SECOND_CAMPAIGN_ID,
      code: 'STYLE10',
      discount: 'Giảm 10%',
      description: 'Voucher',
      expiry_date: null,
      terms: null,
      created_at: now,
      updated_at: now,
    });

    const sessionToken = 'token_second_campaign_123';
    const tokenHash = crypto.createHash('sha256').update(sessionToken).digest('hex');
    fake.tables.quiz_sessions.push({
      id: crypto.randomUUID(),
      campaign_id: SECOND_CAMPAIGN_ID,
      status: 'completed',
      total_score: 1600,
      correct_count: 4,
      total_questions: 5,
      time_taken_seconds: 22,
      answers_snapshot: [],
      session_token: sessionToken,
      session_token_hash: tokenHash,
      started_at: now,
      completed_at: now,
      created_at: now,
    });

    const result = await quizService.submitLead(
      sessionToken,
      'Nguyen Tran Minh Quan',
      '0897654321'
    );

    expect(result.lead.id).toBeDefined();
    const savedLead = fake.tables.leads.find((l) => l.id === result.lead.id);
    expect(savedLead?.campaign_id).toBe(SECOND_CAMPAIGN_ID);
    expect(result.voucher?.code).toBe('STYLE10');
    expect(fake.tables.leads).toHaveLength(3);
    expect(fake.tables.campaign_phone_registrations).toHaveLength(2);
  });

  it('enforces atomic registration so concurrent submissions allow exactly one claim', async () => {
    const tokens = ['token_race_1', 'token_race_2'];
    for (const t of tokens) {
      const tokenHash = crypto.createHash('sha256').update(t).digest('hex');
      fake.tables.quiz_sessions.push({
        id: crypto.randomUUID(),
        campaign_id: CAMPAIGN_ID,
        status: 'completed',
        total_score: 1500,
        correct_count: 4,
        total_questions: 5,
        time_taken_seconds: 25,
        answers_snapshot: [],
        session_token: t,
        session_token_hash: tokenHash,
        started_at: new Date().toISOString(),
        completed_at: new Date().toISOString(),
        created_at: new Date().toISOString(),
      });
    }

    const promises = tokens.map((sessionToken, idx) =>
      quizService
        .submitLead(sessionToken, `Người Chơi ${idx + 1}`, '0912345678')
        .then((res) => ({ status: 'success' as const, res }))
        .catch((err) => ({ status: 'error' as const, err }))
    );

    const results = await Promise.all(promises);
    const successes = results.filter((r) => r.status === 'success');
    const failures = results.filter((r) => r.status === 'error');

    expect(successes).toHaveLength(1);
    expect(failures).toHaveLength(1);
    expect(failures[0].err).toBeInstanceOf(QuizError);
    expect((failures[0].err as QuizError).code).toBe('PHONE_ALREADY_REGISTERED');

    expect(fake.tables.campaign_phone_registrations).toHaveLength(1);
    expect(fake.tables.leads).toHaveLength(1);
  });

  it('does not leave an orphaned registration claim if lead insertion fails', async () => {
    const sessionToken = 'token_fail_test';
    const tokenHash = crypto.createHash('sha256').update(sessionToken).digest('hex');
    const duplicateSessionId = 'existing-session-uuid';

    fake.tables.leads.push({
      ...HISTORICAL_LEAD_1,
      quiz_session_id: duplicateSessionId,
    });

    fake.tables.quiz_sessions.push({
      id: duplicateSessionId, // Reusing existing session id causes 23505 on leads_quiz_session_id_key
      campaign_id: CAMPAIGN_ID,
      status: 'completed',
      total_score: 1500,
      correct_count: 4,
      total_questions: 5,
      time_taken_seconds: 20,
      answers_snapshot: [],
      session_token: sessionToken,
      session_token_hash: tokenHash,
      started_at: new Date().toISOString(),
      completed_at: new Date().toISOString(),
      created_at: new Date().toISOString(),
    });

    await expect(
      quizService.submitLead(sessionToken, 'Người Thử Nghiệm', '0977889900')
    ).rejects.toThrowError(
      expect.objectContaining({
        code: 'DUPLICATE_LEAD',
      })
    );

    // Verify no orphaned registration claim was left behind for 0977889900
    const orphanClaim = fake.tables.campaign_phone_registrations.find(
      (r) => r.phone_hash === hashVietnamesePhone('0977889900')
    );
    expect(orphanClaim).toBeUndefined();
  });

  it('preserves existing leaderboard rankings and canonical order for historical duplicates', async () => {
    fake.tables.leads.push({ ...HISTORICAL_LEAD_1 });
    fake.tables.leads.push({ ...HISTORICAL_LEAD_2 });
    runMigrationBackfill();

    const leaderboard = await repo.getCampaignLeaderboard(CAMPAIGN_ID, 10);

    expect(leaderboard).toHaveLength(2);
    // Rank 1: Lead 1 (score: 1840, time: 18s)
    expect(leaderboard[0].id).toBe(HISTORICAL_LEAD_1.id);
    expect(leaderboard[0].rank).toBe(1);
    expect(leaderboard[0].score).toBe(1840);
    expect(leaderboard[0].time_taken_seconds).toBe(18);

    // Rank 2: Lead 2 (score: 1470, time: 20s)
    expect(leaderboard[1].id).toBe(HISTORICAL_LEAD_2.id);
    expect(leaderboard[1].rank).toBe(2);
    expect(leaderboard[1].score).toBe(1470);
    expect(leaderboard[1].time_taken_seconds).toBe(20);
  });

  it('supports migration retry idempotency without failing or creating duplicate claims', () => {
    fake.tables.leads.push({ ...HISTORICAL_LEAD_1 });
    fake.tables.leads.push({ ...HISTORICAL_LEAD_2 });

    const firstRun = runMigrationBackfill();
    expect(firstRun.insertedCount).toBe(1);
    expect(fake.tables.campaign_phone_registrations).toHaveLength(1);

    // Run backfill again (simulating migration retry)
    const secondRun = runMigrationBackfill();
    expect(secondRun.insertedCount).toBe(0);
    expect(fake.tables.campaign_phone_registrations).toHaveLength(1);
  });

  it('supports clean rollback by dropping registration table without affecting leads', () => {
    fake.tables.leads.push({ ...HISTORICAL_LEAD_1 });
    fake.tables.leads.push({ ...HISTORICAL_LEAD_2 });
    runMigrationBackfill();

    expect(fake.tables.campaign_phone_registrations).toHaveLength(1);

    // Rollback simulation: drop table campaign_phone_registrations
    fake.tables.campaign_phone_registrations = [];

    // Verify all leads and leaderboard remain 100% intact
    expect(fake.tables.leads).toHaveLength(2);
    expect(fake.tables.leads[0].id).toBe(HISTORICAL_LEAD_1.id);
    expect(fake.tables.leads[1].id).toBe(HISTORICAL_LEAD_2.id);
  });
});
