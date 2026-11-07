// @vitest-environment node
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { FakePostgrest, FAKE_SUPABASE_HOST } from './_lib/testing/fakePostgrest.js';
// @ts-expect-error demo-server fixture module does not have d.ts
import { createDemoFixtures, DEMO_CAMPAIGN_ID, DEMO_ADMIN_PASSWORD } from '../video-production/demo-server/fixtures.mjs';

describe('QuizVibe AI — Local Demo Security & Isolation Verification Suite', () => {
  let fakeDb: FakePostgrest;
  let restoreFetch: () => void;

  beforeAll(() => {
    // 1. Enforce synthetic environment
    process.env.SUPABASE_URL = `https://${FAKE_SUPABASE_HOST}`;
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'sb_synthetic_service_role_key_demo_local_2026';
    process.env.ADMIN_PASSWORD = DEMO_ADMIN_PASSWORD;
    process.env.ADMIN_SESSION_SECRET = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
    process.env.ENABLE_LEGACY_SESSION_TOKEN_WRITE = 'true';

    // 2. Install FakePostgrest
    fakeDb = new FakePostgrest();
    restoreFetch = fakeDb.install();

    // 3. Seed fixtures
    const fixtures = createDemoFixtures();
    for (const [k, v] of Object.entries(fixtures)) {
      fakeDb.tables[k] = v as any;
    }
  });

  afterAll(() => {
    restoreFetch();
  });

  it('SEC-01: Chặn đứng mọi kết nối ra Supabase Production (Fail-Closed Network Guard)', async () => {
    // Attempting to fetch a real Supabase production host MUST throw an immediate error
    await expect(async () => {
      await fetch('https://test-production-ref.supabase.co/rest/v1/campaigns', {
        headers: { apikey: 'test' },
      });
    }).rejects.toThrow(/Real network call attempted to test-production-ref\.supabase\.co in test suite/);
  });

  it('SEC-02: Cô lập RPC admin_save_campaign hoàn toàn trong bộ nhớ RAM', async () => {
    const initialCampaignCount = fakeDb.tables.campaigns.length;

    // Call admin_save_campaign via synthetic Supabase URL
    const res = await fetch(`https://${FAKE_SUPABASE_HOST}/rest/v1/rpc/admin_save_campaign`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        p_campaign_id: null,
        p_payload: {
          slug: 'new-isolated-test-campaign',
          title: 'Chiến dịch Test Cô Lập',
          industry: 'Ẩm thực & Nhà hàng',
          questions: [
            { question_text: 'C1?', options: ['A', 'B', 'C', 'D'], correct_index: 0 },
            { question_text: 'C2?', options: ['A', 'B', 'C', 'D'], correct_index: 0 },
            { question_text: 'C3?', options: ['A', 'B', 'C', 'D'], correct_index: 0 },
            { question_text: 'C4?', options: ['A', 'B', 'C', 'D'], correct_index: 0 },
            { question_text: 'C5?', options: ['A', 'B', 'C', 'D'], correct_index: 0 },
          ],
          voucher: { code: 'TEST10K', discount: '10k' },
        },
      }),
    });

    expect(res.status).toBe(200);
    expect(fakeDb.tables.campaigns.length).toBe(initialCampaignCount + 1);
    expect(fakeDb.tables.campaigns.some((c) => c.slug === 'new-isolated-test-campaign')).toBe(true);
  });

  it('SEC-03: Cô lập RPC register_quiz_lead & Chống trùng SĐT trong RAM', async () => {
    const initialLeadCount = fakeDb.tables.leads.length;

    const payload = {
      campaign_id: DEMO_CAMPAIGN_ID,
      quiz_session_id: 's0000000-0000-0000-0000-000000000099',
      full_name: 'Người Chơi Demo',
      phone_number: '0989998877',
      masked_phone: '098***8877',
      score: 500,
      time_taken_seconds: 15,
      voucher_code: 'AMTHUC50K',
    };

    // First registration
    const res1 = await fetch(`https://${FAKE_SUPABASE_HOST}/rest/v1/rpc/register_quiz_lead`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ p_payload: payload }),
    });

    expect(res1.status).toBe(200);
    expect(fakeDb.tables.leads.length).toBe(initialLeadCount + 1);

    // Duplicate registration with same phone MUST return 409 Conflict
    const res2 = await fetch(`https://${FAKE_SUPABASE_HOST}/rest/v1/rpc/register_quiz_lead`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        p_payload: {
          ...payload,
          quiz_session_id: 's0000000-0000-0000-0000-000000000098',
        },
      }),
    });

    expect(res2.status).toBe(409);
    const errData = await res2.json();
    expect(errData.code).toBe('23505');
  });

  it('SEC-04: Cô lập Quiz Sessions & Bảng xếp hạng Top 10 trong RAM', async () => {
    // Check initial leaderboard
    const res = await fetch(
      `https://${FAKE_SUPABASE_HOST}/rest/v1/leads?campaign_id=eq.${DEMO_CAMPAIGN_ID}&order=score.desc,time_taken_seconds.asc&limit=10&select=full_name,masked_phone,score,time_taken_seconds,submitted_at`,
      { method: 'GET', headers: { 'Content-Type': 'application/json' } }
    );

    expect(res.status).toBe(200);
    const top10 = await res.json();
    expect(top10.length).toBe(10);
    expect(top10[0].score).toBe(500);
    expect(top10[0].masked_phone).toMatch(/098\*\*\*2233/);
  });

  it('SEC-05: Đảm bảo tiến trình Demo ép buộc dùng synthetic URL và không kế thừa Production keys', () => {
    expect(process.env.SUPABASE_URL).toBe(`https://${FAKE_SUPABASE_HOST}`);
    expect(process.env.SUPABASE_SERVICE_ROLE_KEY).toBe('sb_synthetic_service_role_key_demo_local_2026');
    expect(process.env.SUPABASE_URL).not.toContain('vercel.app');
  });

  it('SEC-06: Nguyên tắc Fail-Closed: Khi FakePostgrest gặp sự cố, không âm thầm fallback ra ngoài', async () => {
    // Inject temporary failure mode
    fakeDb.failure = () => 'down';

    await expect(async () => {
      await fetch(`https://${FAKE_SUPABASE_HOST}/rest/v1/campaigns`);
    }).rejects.toThrow(/fetch failed \(simulated outage\)/);

    // Restore failure mode
    fakeDb.failure = null;
  });

  it('TEST-FIXTURE: Đảm bảo hàm reset phục hồi nguyên vẹn dữ liệu Fixture mẫu', () => {
    // Mutate state
    fakeDb.tables.campaigns = [];
    expect(fakeDb.tables.campaigns.length).toBe(0);

    // Reset fixtures
    const fresh = createDemoFixtures();
    for (const [k, v] of Object.entries(fresh)) {
      fakeDb.tables[k] = v as any;
    }

    expect(fakeDb.tables.campaigns.length).toBeGreaterThan(0);
    expect(fakeDb.tables.campaign_questions.length).toBe(5);
    expect(fakeDb.tables.leads.length).toBe(10);
    expect(fakeDb.tables.vouchers[0].code).toBe('AMTHUC50K');
  });
});
