// @vitest-environment node
import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import { FakePostgrest, FAKE_SUPABASE_HOST } from '../lib/testing/fakePostgrest';
import { mockHttp, tokenFromSetCookie } from '../lib/testing/httpMock';

const fake = new FakePostgrest();
let restoreFetch: () => void;
const SAVED_ENV: Record<string, string | undefined> = {};

const ENV: Record<string, string> = {
  ADMIN_PASSWORD: 'Synthetic_Admin_Pass_2026!',
  ADMIN_SESSION_SECRET: 'f3a91c07be4d82a65e10c9b7d4a3f281660ba9e5c7d1348f2b0e6a95d7c43e18',
  SUPABASE_URL: `https://${FAKE_SUPABASE_HOST}`,
  SUPABASE_SERVICE_ROLE_KEY: 'sb_secret_synthetic_fake_key_for_tests_only',
  NODE_ENV: 'test',
};

let manageHandler: any;
let loginHandler: any;
let adminCookie = '';

async function loadHandlers() {
  vi.resetModules();
  const [manage, login] = await Promise.all([
    import('./manage'),
    import('./login'),
  ]);
  manageHandler = manage.default;
  loginHandler = login.default;
}

const CAMPAIGN_A_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const CAMPAIGN_B_ID = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';

function seedTestData() {
  const now = new Date().toISOString();

  fake.tables.campaigns.push(
    {
      id: CAMPAIGN_A_ID,
      slug: 'chien-dich-a',
      title: 'Chiến dịch A - Mỹ phẩm',
      status: 'published',
      created_at: now,
      updated_at: now,
    },
    {
      id: CAMPAIGN_B_ID,
      slug: 'chien-dich-b',
      title: 'Chiến dịch B - Đồ uống',
      status: 'published',
      created_at: now,
      updated_at: now,
    }
  );

  fake.tables.leads.push(
    {
      id: 'lead_1',
      campaign_id: CAMPAIGN_A_ID,
      quiz_session_id: 'sess_1',
      full_name: 'Nguyễn Văn An',
      phone_number: '0987654321',
      score: 1800,
      time_taken_seconds: 35,
      voucher_code: 'BEAUTY50',
      submitted_at: '2026-11-05T01:00:00.000Z',
    },
    {
      id: 'lead_2',
      campaign_id: CAMPAIGN_A_ID,
      quiz_session_id: 'sess_2',
      full_name: 'Trần Thị Bình',
      phone_number: '0912345678',
      score: 1500,
      time_taken_seconds: 40,
      voucher_code: 'BEAUTY50',
      submitted_at: '2026-11-05T02:00:00.000Z',
    },
    {
      id: 'lead_3',
      campaign_id: CAMPAIGN_B_ID,
      quiz_session_id: 'sess_3',
      full_name: 'Lê Hoàng Cúc',
      phone_number: '0909888777',
      score: 1950,
      time_taken_seconds: 22,
      voucher_code: 'DRINK20',
      submitted_at: '2026-11-05T03:00:00.000Z',
    }
  );
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

beforeEach(async () => {
  fake.reset();
  seedTestData();

  // Obtain valid admin session
  const loginHttp = mockHttp({
    method: 'POST',
    body: { password: ENV.ADMIN_PASSWORD },
  });
  await loginHandler(loginHttp.req, loginHttp.res);
  expect(loginHttp.res.status$()).toBe(200);
  const rawCookie = loginHttp.res.headers$()['Set-Cookie'];
  adminCookie = `qv_admin_session=${encodeURIComponent(tokenFromSetCookie(rawCookie))}`;
});

describe('Phase 4: Admin Lead Management (/api/admin/manage?resource=leads)', () => {
  it('rejects unauthenticated requests with 401', async () => {
    const http = mockHttp({
      method: 'GET',
      query: { resource: 'leads' },
      // No cookie
    });
    await manageHandler(http.req, http.res);

    expect(http.res.status$()).toBe(401);
    expect(http.res.body$().ok).toBe(false);
  });

  it('lists all leads with campaign titles for authenticated admin', async () => {
    const http = mockHttp({
      method: 'GET',
      query: { resource: 'leads' },
      cookie: adminCookie,
    });
    await manageHandler(http.req, http.res);

    expect(http.res.status$()).toBe(200);
    const body = http.res.body$();
    expect(body.ok).toBe(true);
    expect(body.leads).toHaveLength(3);
    const lead1 = body.leads.find((l: any) => l.id === 'lead_1');
    expect(lead1).toBeDefined();
    expect(lead1.campaign_title).toBe('Chiến dịch A - Mỹ phẩm');
    expect(lead1.phone_number).toBe('0987654321');
  });

  it('filters leads by campaignId', async () => {
    const http = mockHttp({
      method: 'GET',
      query: { resource: 'leads', campaignId: CAMPAIGN_B_ID },
      cookie: adminCookie,
    });
    await manageHandler(http.req, http.res);

    expect(http.res.status$()).toBe(200);
    const body = http.res.body$();
    expect(body.leads).toHaveLength(1);
    expect(body.leads[0].id).toBe('lead_3');
  });

  it('searches leads by phone number or name', async () => {
    const http = mockHttp({
      method: 'GET',
      query: { resource: 'leads', search: '0912' },
      cookie: adminCookie,
    });
    await manageHandler(http.req, http.res);

    expect(http.res.status$()).toBe(200);
    const body = http.res.body$();
    expect(body.leads).toHaveLength(1);
    expect(body.leads[0].full_name).toBe('Trần Thị Bình');
  });

  it('exports leads to CSV with UTF-8 BOM, safe formula neutralization, and correct headers', async () => {
    // Seed malicious formula payloads and edge cases
    fake.tables.leads.push(
      {
        id: 'lead_formula_1',
        campaign_id: CAMPAIGN_A_ID,
        quiz_session_id: 'sess_f1',
        full_name: '=SUM(A1:A2)',
        phone_number: '0981111111',
        score: 1000,
        time_taken_seconds: 15,
        voucher_code: 'CODE1',
        submitted_at: '2026-11-05T04:00:00.000Z',
      },
      {
        id: 'lead_formula_2',
        campaign_id: CAMPAIGN_A_ID,
        quiz_session_id: 'sess_f2',
        full_name: '+cmd| /C calc',
        phone_number: '0982222222',
        score: 1100,
        time_taken_seconds: 16,
        voucher_code: 'CODE2',
        submitted_at: '2026-11-05T04:01:00.000Z',
      },
      {
        id: 'lead_formula_3',
        campaign_id: CAMPAIGN_A_ID,
        quiz_session_id: 'sess_f3',
        full_name: '-1+2',
        phone_number: '0983333333',
        score: 1200,
        time_taken_seconds: 17,
        voucher_code: 'CODE3',
        submitted_at: '2026-11-05T04:02:00.000Z',
      },
      {
        id: 'lead_formula_4',
        campaign_id: CAMPAIGN_A_ID,
        quiz_session_id: 'sess_f4',
        full_name: '@malicious_link',
        phone_number: '0984444444',
        score: 1300,
        time_taken_seconds: 18,
        voucher_code: 'CODE4',
        submitted_at: '2026-11-05T04:03:00.000Z',
      },
      {
        id: 'lead_formula_5',
        campaign_id: CAMPAIGN_A_ID,
        quiz_session_id: 'sess_f5',
        full_name: '\tTAB_PREFIX',
        phone_number: '0985555555',
        score: 1400,
        time_taken_seconds: 19,
        voucher_code: 'CODE5',
        submitted_at: '2026-11-05T04:04:00.000Z',
      },
      {
        id: 'lead_formula_6',
        campaign_id: CAMPAIGN_A_ID,
        quiz_session_id: 'sess_f6',
        full_name: '\rCR_PREFIX',
        phone_number: '0986666666',
        score: 1500,
        time_taken_seconds: 20,
        voucher_code: 'CODE6',
        submitted_at: '2026-11-05T04:05:00.000Z',
      },
      {
        id: 'lead_comma_quote',
        campaign_id: CAMPAIGN_A_ID,
        quiz_session_id: 'sess_cq',
        full_name: 'Nguyễn, "Vibe" An',
        phone_number: '0987777777',
        score: 1600,
        time_taken_seconds: 21,
        voucher_code: 'CODE7',
        submitted_at: '2026-11-05T04:06:00.000Z',
      },
      {
        id: 'lead_multiline',
        campaign_id: CAMPAIGN_A_ID,
        quiz_session_id: 'sess_ml',
        full_name: 'Dòng 1\nDòng 2',
        phone_number: '0988888888',
        score: 1700,
        time_taken_seconds: 22,
        voucher_code: 'CODE8',
        submitted_at: '2026-11-05T04:07:00.000Z',
      }
    );

    const http = mockHttp({
      method: 'GET',
      query: { resource: 'leads', format: 'csv' },
      cookie: adminCookie,
    });
    await manageHandler(http.req, http.res);

    expect(http.res.status$()).toBe(200);
    expect(http.res.headers$()['Content-Type']).toBe('text/csv; charset=utf-8');
    expect(http.res.headers$()['Content-Disposition']).toBe('attachment; filename="quizvibe-leads.csv"');

    const csvContent = http.res.body$() as string;
    // 1. Must start with UTF-8 BOM
    expect(csvContent.startsWith('\uFEFF')).toBe(true);

    // 2. Must contain Vietnamese column headers
    expect(csvContent).toContain('Họ và tên,Số điện thoại,Điểm số,Thời gian (giây),Mã Voucher,Chiến dịch,Thời gian gửi');

    // 3. Normal Vietnamese names and numbers are preserved
    expect(csvContent).toContain('Nguyễn Văn An');
    expect(csvContent).toContain('0987654321');
    expect(csvContent).toContain('Chiến dịch A - Mỹ phẩm');

    // 4. Formula injection triggers are neutralized with leading single quote (')
    expect(csvContent).toContain(`"'=SUM(A1:A2)"`);
    expect(csvContent).toContain(`"'+cmd| /C calc"`);
    expect(csvContent).toContain(`"'-1+2"`);
    expect(csvContent).toContain(`"'@malicious_link"`);
    expect(csvContent).toContain(`"'\tTAB_PREFIX"`);
    expect(csvContent).toContain(`"'\rCR_PREFIX"`);

    // 5. Commas, quotes, and multiline values are escaped per RFC 4180
    expect(csvContent).toContain(`"Nguyễn, ""Vibe"" An"`);
    expect(csvContent).toContain(`"Dòng 1\nDòng 2"`);
  });

  it('deletes a single lead by id', async () => {
    const http = mockHttp({
      method: 'DELETE',
      query: { resource: 'leads', id: 'lead_2' },
      cookie: adminCookie,
    });
    await manageHandler(http.req, http.res);

    expect(http.res.status$()).toBe(200);
    expect(http.res.body$().deleted).toBe(true);
    expect(fake.tables.leads.some((l) => l.id === 'lead_2')).toBe(false);
    expect(fake.tables.leads).toHaveLength(2);
  });

  it('rejects clear-all when campaignId is missing or "all"', async () => {
    // Missing campaignId
    const httpMissing = mockHttp({
      method: 'DELETE',
      query: { resource: 'leads', action: 'clear-all' },
      cookie: adminCookie,
    });
    await manageHandler(httpMissing.req, httpMissing.res);
    expect(httpMissing.res.status$()).toBe(400);
    expect(httpMissing.res.body$().code).toBe('VALIDATION_FAILED');
    expect(fake.tables.leads).toHaveLength(3); // Untouched

    // campaignId="all"
    const httpAll = mockHttp({
      method: 'DELETE',
      query: { resource: 'leads', action: 'clear-all', campaignId: 'all' },
      cookie: adminCookie,
    });
    await manageHandler(httpAll.req, httpAll.res);
    expect(httpAll.res.status$()).toBe(400);
    expect(httpAll.res.body$().code).toBe('VALIDATION_FAILED');
    expect(fake.tables.leads).toHaveLength(3); // Still untouched
  });

  it('clears leads scoped strictly to the specified campaignId without touching other campaigns', async () => {
    const http = mockHttp({
      method: 'DELETE',
      query: { resource: 'leads', action: 'clear-all', campaignId: CAMPAIGN_A_ID },
      cookie: adminCookie,
    });
    await manageHandler(http.req, http.res);

    expect(http.res.status$()).toBe(200);
    expect(http.res.body$().cleared).toBe(true);

    // Campaign A leads (lead_1, lead_2) were cleared
    expect(fake.tables.leads.some((l) => l.campaign_id === CAMPAIGN_A_ID)).toBe(false);

    // Campaign B leads (lead_3) remain completely untouched!
    expect(fake.tables.leads).toHaveLength(1);
    expect(fake.tables.leads[0].id).toBe('lead_3');
    expect(fake.tables.leads[0].campaign_id).toBe(CAMPAIGN_B_ID);
  });
});

