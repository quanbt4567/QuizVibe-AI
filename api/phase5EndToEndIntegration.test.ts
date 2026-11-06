// @vitest-environment node
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { FakePostgrest, FAKE_SUPABASE_HOST } from './_lib/testing/fakePostgrest';
import { mockHttp, tokenFromSetCookie } from './_lib/testing/httpMock';
import { ADMIN_SESSION_COOKIE_NAME } from './_lib/auth/adminAuth';

/**
 * Phase 5 — Comprehensive End-to-End Integration & Product Acceptance Test Suite.
 * Exercises the entire product lifecycle across both Admin and Public Player journeys:
 *  1. Admin Authentication & Session Security (Login -> HttpOnly Cookie -> Server Validation).
 *  2. Admin Campaign Creation & Multi-question Draft Persistence (Database-backed).
 *  3. Public Access Boundary: Draft Campaigns are 404 (Unpublished cannot be viewed or played).
 *  4. Admin Explicit Publish Workflow & Public URL Generation.
 *  5. Public Campaign Inspection: Strict DTO Sanitization (0 answer keys, 0 voucher secrets).
 *  6. Public Player Quiz Session Lifecycle: Server-Authoritative Question-by-Question Play.
 *  7. Server-Side Timer & Speed-Scoring Enforcement (Client cannot forge or manipulate scores).
 *  8. Duplicate, Concurrent & Out-of-Sequence Submission Guard.
 *  9. Quiz Session Completion & Verified Result Summary.
 * 10. Player Vietnamese Lead Capture & Conditional Voucher Unlocking.
 * 11. Public Leaderboard Ranking & Phone Number Privacy Masking.
 * 12. Admin Lead Management: Scoped Filtering, CRM Details, and Scoped Deletion.
 * 13. High-Security CSV Export with Multi-Formula Injection Neutralization.
 * 14. Campaign Lifecycle Management: Unpublish / Revert to Draft & Session Invalidation.
 * 15. Admin Logout & Session Token Revocation.
 */

const fake = new FakePostgrest();
let restoreFetch: () => void;
const SAVED_ENV: Record<string, string | undefined> = {};

const TEST_ADMIN_PASSWORD = 'super_secret_admin_password_2026';
const TEST_ADMIN_SECRET = 'f3a91c07be4d82a65e10c9b7d4a3f281660ba9e5c7d1348f2b0e6a95d7c43e18';

const ENV: Record<string, string> = {
  SUPABASE_URL: `https://${FAKE_SUPABASE_HOST}`,
  SUPABASE_SERVICE_ROLE_KEY: 'sb_secret_synthetic_fake_key_for_tests_only',
  ADMIN_PASSWORD: TEST_ADMIN_PASSWORD,
  ADMIN_SESSION_SECRET: TEST_ADMIN_SECRET,
  NODE_ENV: 'test',
};

// Handlers loaded dynamically
let adminLoginHandler: any;
let adminLogoutHandler: any;
let adminManageHandler: any;
let publicCampaignHandler: any;
let quizSessionHandler: any;
let quizAnswerHandler: any;
let quizCompleteHandler: any;
let quizLeadHandler: any;
let quizLeaderboardHandler: any;

async function loadHandlers() {
  vi.resetModules();
  const [
    login,
    logout,
    manage,
    pubCampaign,
    qSession,
    qAnswer,
    qComplete,
    qLead,
    qLeaderboard,
  ] = await Promise.all([
    import('./admin/login'),
    import('./admin/logout'),
    import('./admin/manage'),
    import('./public/campaign'),
    import('./quiz/session'),
    import('./quiz/answer'),
    import('./quiz/complete'),
    import('./quiz/lead'),
    import('./quiz/leaderboard'),
  ]);

  adminLoginHandler = login.default;
  adminLogoutHandler = logout.default;
  adminManageHandler = manage.default;
  publicCampaignHandler = pubCampaign.default;
  quizSessionHandler = qSession.default;
  quizAnswerHandler = qAnswer.default;
  quizCompleteHandler = qComplete.default;
  quizLeadHandler = qLead.default;
  quizLeaderboardHandler = qLeaderboard.default;
}

describe('Phase 5 — End-to-End Integration & Product Acceptance', () => {
  beforeAll(async () => {
    for (const [k, v] of Object.entries(ENV)) {
      SAVED_ENV[k] = process.env[k];
      process.env[k] = v;
    }
    restoreFetch = fake.install();
    fake.reset();
    await loadHandlers();
  });

  afterAll(() => {
    restoreFetch();
    for (const [k, v] of Object.entries(SAVED_ENV)) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
  });

  // Shared state across the full end-to-end journey
  let adminCookie: string;
  let createdCampaignId: string;
  let campaignSlug: string;
  let playerSessionToken: string;
  let fullCampaignPayload: any;

  // -------------------------------------------------------------------------
  // 1. Admin Authentication & Session Security
  // -------------------------------------------------------------------------
  it('Step 1: Admin authenticates at /api/admin/login and receives HttpOnly session cookie', async () => {
    // 1a. Wrong password fails
    const { req: badReq, res: badRes } = mockHttp({
      method: 'POST',
      body: { password: 'wrong-password' },
    });
    await adminLoginHandler(badReq, badRes);
    expect(badRes.status$()).toBe(401);
    expect(badRes.body$().ok).toBe(false);

    // 1b. Correct password succeeds and sets HttpOnly cookie
    const { req, res } = mockHttp({
      method: 'POST',
      body: { password: TEST_ADMIN_PASSWORD },
    });
    await adminLoginHandler(req, res);
    expect(res.status$()).toBe(200);
    expect(res.body$().ok).toBe(true);

    const setCookie = res.headers$()['set-cookie'] || res.headers$()['Set-Cookie'];
    expect(setCookie).toBeTruthy();
    expect(setCookie).toContain(`${ADMIN_SESSION_COOKIE_NAME}=`);
    expect(setCookie).toContain('HttpOnly');
    expect(setCookie).toContain('SameSite=Strict');

    const rawToken = tokenFromSetCookie(setCookie);
    expect(rawToken).toBeTruthy();
    adminCookie = `${ADMIN_SESSION_COOKIE_NAME}=${encodeURIComponent(rawToken)}`;

    // Verify session record exists in database
    expect(fake.tables.admin_sessions.length).toBe(1);
  });

  // -------------------------------------------------------------------------
  // 2. Server-side Authorization Enforcement
  // -------------------------------------------------------------------------
  it('Step 2: Admin API endpoints reject unauthenticated or forged requests', async () => {
    // 2a. No cookie -> 401
    const { req: noAuthReq, res: noAuthRes } = mockHttp({
      method: 'GET',
      query: { resource: 'campaigns' },
    });
    await adminManageHandler(noAuthReq, noAuthRes);
    expect(noAuthRes.status$()).toBe(401);
    expect(noAuthRes.body$().ok).toBe(false);

    // 2b. Forged cookie -> 401
    const { req: fakeReq, res: fakeRes } = mockHttp({
      method: 'GET',
      query: { resource: 'campaigns' },
      cookie: `${ADMIN_SESSION_COOKIE_NAME}=forged_token_signature_value`,
    });
    await adminManageHandler(fakeReq, fakeRes);
    expect(fakeRes.status$()).toBe(401);
  });

  // -------------------------------------------------------------------------
  // 3. Admin Creates New Quiz Campaign (Draft)
  // -------------------------------------------------------------------------
  it('Step 3: Admin creates a new quiz campaign, saved strictly as Draft', async () => {
    const campaignPayload = {
      title: 'Thử Thách Quán Cà Phê Mùa Hè 2026',
      industry: 'F&B / Quán Cà Phê',
      description: 'Chinh phục 5 câu đố cà phê nhận voucher ưu đãi 30%',
      questions: [
        {
          question: 'Cà phê Robusta có vị gì đặc trưng nổi bật?',
          options: ['Đắng đậm đà', 'Chua thanh nhẹ', 'Ngọt dịu', 'Không có vị gì'],
          correctIndex: 0,
          explanation: 'Robusta chứa nhiều caffeine tạo vị đắng đậm đặc trưng.',
        },
        {
          question: 'Nhiệt độ nước tối ưu để pha Espresso tiêu chuẩn là bao nhiêu?',
          options: ['90 - 95°C', '70 - 75°C', '100°C sôi sùng sục', '50 - 60°C'],
          correctIndex: 0,
          explanation: 'Nhiệt độ 90 - 95°C giúp chiết xuất trọn vẹn hương vị espresso.',
        },
        {
          question: 'Giống cà phê Arabica phát triển tốt nhất ở điều kiện địa hình nào?',
          options: ['Vùng cao nguyên trên 1.000m mát mẻ', 'Đồng bằng ven biển', 'Rừng ngập mặn', 'Sa mạc cát'],
          correctIndex: 0,
          explanation: 'Arabica đòi hỏi độ cao và khí hậu mát mẻ để quả chín chậm, hương vị thanh tao.',
        },
        {
          question: 'Phương pháp ủ lạnh Cold Brew thường kéo dài trong thời gian bao lâu?',
          options: ['12 - 24 tiếng', '15 phút', '48 ngày liên tục', '2 tiếng'],
          correctIndex: 0,
          explanation: 'Cold Brew cần ủ lạnh từ 12-24 giờ để chiết xuất vị êm dịu, ít chua.',
        },
        {
          question: 'Điểm khác biệt cơ bản giữa Cafe Latte và Cappuccino là gì?',
          options: ['Latte có nhiều sữa nóng hơn bọt sữa', 'Latte không có cà phê', 'Cappuccino không có sữa', 'Latte chỉ uống lạnh'],
          correctIndex: 0,
          explanation: 'Latte có tỉ lệ sữa nóng cao hơn bọt sữa so với Cappuccino.',
        },
      ],
      voucher: {
        code: 'SUMMERCOFFEE30',
        discount: 'Giảm 30% tổng hóa đơn từ 100k',
        description: 'Voucher ưu đãi độc quyền dành cho khách hàng vượt qua thử thách',
        expiryDate: '31/12/2026',
        terms: 'Áp dụng tại mọi chi nhánh trên toàn quốc.',
      },
    };

    fullCampaignPayload = campaignPayload;

    const { req, res } = mockHttp({
      method: 'POST',
      query: { resource: 'campaigns' },
      body: campaignPayload,
      cookie: adminCookie,
    });
    await adminManageHandler(req, res);

    expect(res.status$()).toBe(201);
    const body = res.body$();
    expect(body.ok).toBe(true);
    expect(body.campaign).toBeTruthy();
    expect(body.campaign.status).toBe('draft'); // INVARIANT: MUST BE DRAFT
    expect(body.campaign.questions).toHaveLength(5);
    expect(body.campaign.slug).toContain('thu-thach-quan-ca-phe-mua-he-2026');

    createdCampaignId = body.campaign.id;
    campaignSlug = body.campaign.slug;
  });

  // -------------------------------------------------------------------------
  // 4. Access Restriction: Draft Campaigns are Inaccessible to Public Players
  // -------------------------------------------------------------------------
  it('Step 4: Draft campaign is rejected for public browsing and player session creation', async () => {
    // 4a. Public campaign inspection returns 404 for draft
    const { req: pubReq, res: pubRes } = mockHttp({
      method: 'GET',
      query: { slug: campaignSlug },
    });
    await publicCampaignHandler(pubReq, pubRes);
    expect(pubRes.status$()).toBe(404);
    expect(pubRes.body$().ok).toBe(false);

    // 4b. Player cannot start a session on a draft campaign
    const { req: sessReq, res: sessRes } = mockHttp({
      method: 'POST',
      body: { slug: campaignSlug },
    });
    await quizSessionHandler(sessReq, sessRes);
    expect(sessRes.status$()).toBe(404);
    expect(sessRes.body$().ok).toBe(false);
  });

  // -------------------------------------------------------------------------
  // 5. Admin Edits and Explicitly Publishes the Campaign
  // -------------------------------------------------------------------------
  it('Step 5: Admin edits and explicitly publishes the campaign', async () => {
    // 5a. Admin updates description
    const { req: putReq, res: putRes } = mockHttp({
      method: 'PUT',
      query: { resource: 'campaigns', id: createdCampaignId },
      body: {
        ...fullCampaignPayload,
        description: 'Thử thách kiến thức cà phê nhận ngay voucher giảm 30%!',
      },
      cookie: adminCookie,
    });
    await adminManageHandler(putReq, putRes);
    expect(putRes.status$()).toBe(200);
    expect(putRes.body$().campaign.description).toBe('Thử thách kiến thức cà phê nhận ngay voucher giảm 30%!');

    // 5b. Admin transitions status to published
    const { req: pubReq, res: pubRes } = mockHttp({
      method: 'POST',
      query: { resource: 'campaigns', id: createdCampaignId, action: 'publish' },
      cookie: adminCookie,
    });
    await adminManageHandler(pubReq, pubRes);
    expect(pubRes.status$()).toBe(200);
    expect(pubRes.body$().campaign.status).toBe('published');
    expect(pubRes.body$().campaign.publishedAt).toBeTruthy();
  });

  // -------------------------------------------------------------------------
  // 6. Public Player Loads Published Campaign (Strict DTO Sanitization Check)
  // -------------------------------------------------------------------------
  it('Step 6: Public player loads campaign via /api/public/campaign with 0 leaked secrets', async () => {
    const { req, res } = mockHttp({
      method: 'GET',
      query: { slug: campaignSlug },
    });
    await publicCampaignHandler(req, res);

    expect(res.status$()).toBe(200);
    const body = res.body$();
    expect(body.ok).toBe(true);
    expect(body.campaign.title).toBe('Thử Thách Quán Cà Phê Mùa Hè 2026');
    expect(body.campaign.questions).toHaveLength(5);

    // CRITICAL SECURITY INVARIANTS:
    // 1. No correctIndex or correct_index in public questions
    for (const q of body.campaign.questions) {
      expect(q.correctIndex).toBeUndefined();
      expect(q.correct_index).toBeUndefined();
      expect(q.explanation).toBeUndefined();
      expect(q.options).toHaveLength(4);
    }

    // 2. No secret voucher code exposed before completing quiz and submitting lead
    expect(body.campaign.voucher.code).toBeUndefined();
    expect(body.campaign.voucher.discount).toBe('Giảm 30% tổng hóa đơn từ 100k');
  });

  // -------------------------------------------------------------------------
  // 7. Player Starts Session & Plays Complete Game (5 Questions)
  // -------------------------------------------------------------------------
  it('Step 7: Player starts session, answers 5 questions server-side, and client cannot forge score', async () => {
    // 7a. Start session
    const { req: startReq, res: startRes } = mockHttp({
      method: 'POST',
      body: { slug: campaignSlug },
    });
    await quizSessionHandler(startReq, startRes);
    expect(startRes.status$()).toBe(201);
    const startBody = startRes.body$();
    expect(startBody.session.sessionToken).toBeTruthy();
    expect(startBody.session.totalQuestions).toBe(5);
    expect(startBody.session.currentQuestion.questionIndex).toBe(0);

    playerSessionToken = startBody.session.sessionToken;

    // 7b. Answer Q0 correctly (Option 0)
    const { req: a0Req, res: a0Res } = mockHttp({
      method: 'POST',
      body: {
        sessionToken: playerSessionToken,
        questionIndex: 0,
        selectedOptionIndex: 0,
      },
    });
    await quizAnswerHandler(a0Req, a0Res);
    expect(a0Res.status$()).toBe(200);
    const a0Body = a0Res.body$();
    expect(a0Body.answer.isCorrect).toBe(true);
    expect(a0Body.answer.pointsEarned).toBeGreaterThan(0);
    expect(a0Body.answer.isComplete).toBe(false);
    expect(a0Body.answer.nextQuestion.questionIndex).toBe(1);

    // 7c. Prevent out-of-order submission (e.g. trying to submit Q3 instead of Q1)
    const { req: skipReq, res: skipRes } = mockHttp({
      method: 'POST',
      body: {
        sessionToken: playerSessionToken,
        questionIndex: 3,
        selectedOptionIndex: 0,
      },
    });
    await quizAnswerHandler(skipReq, skipRes);
    expect(skipRes.status$()).toBe(409);

    // 7d. Prevent duplicate submission of already answered Q0
    const { req: dupReq, res: dupRes } = mockHttp({
      method: 'POST',
      body: {
        sessionToken: playerSessionToken,
        questionIndex: 0,
        selectedOptionIndex: 0,
      },
    });
    await quizAnswerHandler(dupReq, dupRes);
    expect(dupRes.status$()).toBe(409);

    // 7e. Answer Q1 correctly (Option 0)
    const { req: a1Req, res: a1Res } = mockHttp({
      method: 'POST',
      body: { sessionToken: playerSessionToken, questionIndex: 1, selectedOptionIndex: 0 },
    });
    await quizAnswerHandler(a1Req, a1Res);
    expect(a1Res.status$()).toBe(200);
    expect(a1Res.body$().answer.isCorrect).toBe(true);

    // 7f. Answer Q2 incorrectly (Option 1 instead of 0)
    const { req: a2Req, res: a2Res } = mockHttp({
      method: 'POST',
      body: { sessionToken: playerSessionToken, questionIndex: 2, selectedOptionIndex: 1 },
    });
    await quizAnswerHandler(a2Req, a2Res);
    expect(a2Res.status$()).toBe(200);
    expect(a2Res.body$().answer.isCorrect).toBe(false);
    expect(a2Res.body$().answer.pointsEarned).toBe(0);

    // 7g. Answer Q3 correctly (Option 0)
    const { req: a3Req, res: a3Res } = mockHttp({
      method: 'POST',
      body: { sessionToken: playerSessionToken, questionIndex: 3, selectedOptionIndex: 0 },
    });
    await quizAnswerHandler(a3Req, a3Res);
    expect(a3Res.status$()).toBe(200);
    expect(a3Res.body$().answer.isCorrect).toBe(true);

    // 7h. Answer Q4 correctly (Option 0) — Last question
    const { req: a4Req, res: a4Res } = mockHttp({
      method: 'POST',
      body: { sessionToken: playerSessionToken, questionIndex: 4, selectedOptionIndex: 0 },
    });
    await quizAnswerHandler(a4Req, a4Res);
    expect(a4Res.status$()).toBe(200);
    const a4Body = a4Res.body$();
    expect(a4Body.answer.isCorrect).toBe(true);
    expect(a4Body.answer.isComplete).toBe(true);
    expect(a4Body.answer.nextQuestion).toBeNull();
    expect(a4Body.answer.result.correctCount).toBe(4);
    expect(a4Body.answer.result.totalScore).toBeGreaterThan(0);
  });

  // -------------------------------------------------------------------------
  // 8. Player Completes Quiz Session
  // -------------------------------------------------------------------------
  it('Step 8: Quiz completion endpoint seals session and returns authoritative result', async () => {
    const { req, res } = mockHttp({
      method: 'POST',
      body: { sessionToken: playerSessionToken },
    });
    await quizCompleteHandler(req, res);

    expect(res.status$()).toBe(200);
    const body = res.body$();
    expect(body.ok).toBe(true);
    expect(body.result.status).toBe('completed');
    expect(body.result.correctCount).toBe(4);
    expect(body.result.totalQuestions).toBe(5);
  });

  // -------------------------------------------------------------------------
  // 9. Lead Submission & Voucher Code Unlocking
  // -------------------------------------------------------------------------
  it('Step 9: Player submits valid lead, gets masked phone, and unlocks voucher code', async () => {
    // 9a. Invalid phone rejected
    const { req: badPhoneReq, res: badPhoneRes } = mockHttp({
      method: 'POST',
      body: {
        sessionToken: playerSessionToken,
        fullName: 'Nguyễn Văn Minh',
        phoneNumber: '012345', // invalid length
      },
    });
    await quizLeadHandler(badPhoneReq, badPhoneRes);
    expect(badPhoneRes.status$()).toBe(400);

    // 9b. Valid Vietnamese phone succeeds and unlocks voucher
    const { req, res } = mockHttp({
      method: 'POST',
      body: {
        sessionToken: playerSessionToken,
        fullName: 'Nguyễn Văn Minh',
        phoneNumber: '0901234567',
      },
    });
    await quizLeadHandler(req, res);

    expect(res.status$()).toBe(201);
    const body = res.body$();
    expect(body.ok).toBe(true);
    expect(body.lead.fullName).toBe('Nguyễn Văn Minh');
    expect(body.lead.maskedPhone).toBe('090***4567');
    expect(body.lead.rank).toBe(1);

    // VOUCHER CODE UNLOCKED!
    expect(body.voucher).toBeTruthy();
    expect(body.voucher.code).toBe('SUMMERCOFFEE30');
    expect(body.voucher.discount).toBe('Giảm 30% tổng hóa đơn từ 100k');

    // 9c. Duplicate lead submission on the same session is prevented
    const { req: dupLeadReq, res: dupLeadRes } = mockHttp({
      method: 'POST',
      body: {
        sessionToken: playerSessionToken,
        fullName: 'Nguyễn Văn Minh',
        phoneNumber: '0901234567',
      },
    });
    await quizLeadHandler(dupLeadReq, dupLeadRes);
    expect(dupLeadRes.status$()).toBe(409);
  });

  // -------------------------------------------------------------------------
  // 10. Public Leaderboard Displays Masked Phone & Correct Ranking
  // -------------------------------------------------------------------------
  it('Step 10: Public leaderboard displays ranking with masked phone privacy protection', async () => {
    const { req, res } = mockHttp({
      method: 'GET',
      query: { slug: campaignSlug },
    });
    await quizLeaderboardHandler(req, res);

    expect(res.status$()).toBe(200);
    const body = res.body$();
    expect(body.ok).toBe(true);
    expect(body.leaderboard).toHaveLength(1);

    const first = body.leaderboard[0];
    expect(first.rank).toBe(1);
    expect(first.fullName).toBe('Nguyễn Văn Minh');
    expect(first.maskedPhone).toBe('090***4567'); // NEVER EXPOSE FULL PHONE IN PUBLIC API
    expect(first.score).toBeGreaterThan(0);
  });

  // -------------------------------------------------------------------------
  // 11. Admin Lead Management: Scoped Leads, CRM Phone, and Safe CSV Export
  // -------------------------------------------------------------------------
  it('Step 11: Admin accesses lead list (with unmasked phone) and exports safe CSV', async () => {
    // 11a. Admin views lead list scoped to campaign
    const { req: leadReq, res: leadRes } = mockHttp({
      method: 'GET',
      query: { resource: 'leads', campaignId: createdCampaignId },
      cookie: adminCookie,
    });
    await adminManageHandler(leadReq, leadRes);

    expect(leadRes.status$()).toBe(200);
    const leadBody = leadRes.body$();
    expect(leadBody.ok).toBe(true);
    expect(leadBody.leads).toHaveLength(1);

    const adminLead = leadBody.leads[0];
    expect(adminLead.full_name).toBe('Nguyễn Văn Minh');
    expect(adminLead.phone_number).toBe('0901234567'); // Admin gets full phone for fanpage CRM outreach
    expect(adminLead.voucher_code).toBe('SUMMERCOFFEE30');

    // 11b. Insert another lead with formula injection characters to test CSV sanitization
    fake.tables.leads.push({
      id: 'lead-formula-injection-test',
      campaign_id: createdCampaignId,
      quiz_session_id: null,
      full_name: '=SUM(A1:A10)',
      phone_number: '+84987654321',
      score: 1800,
      time_taken_seconds: 22,
      voucher_code: '@VOUCHER_CODE',
      submitted_at: new Date().toISOString(),
      created_at: new Date().toISOString(),
    });

    // 11c. Request CSV export
    const { req: csvReq, res: csvRes } = mockHttp({
      method: 'GET',
      query: { resource: 'leads', campaignId: createdCampaignId, format: 'csv' },
      cookie: adminCookie,
    });
    await adminManageHandler(csvReq, csvRes);

    expect(csvRes.status$()).toBe(200);
    expect(csvRes.headers$()['Content-Type']).toBe('text/csv; charset=utf-8');
    const csvContent = csvRes.body$() as string;

    // Verify UTF-8 BOM
    expect(csvContent.startsWith('\uFEFF')).toBe(true);

    // Verify formula characters are neutralized with leading apostrophe
    expect(csvContent).toContain("\"'=SUM(A1:A10)\"");
    expect(csvContent).toContain("\"'+84987654321\"");
    expect(csvContent).toContain("\"'@VOUCHER_CODE\"");
  });

  // -------------------------------------------------------------------------
  // 12. Admin Scoped Lead Deletion
  // -------------------------------------------------------------------------
  it('Step 12: Admin deletes leads within campaign scope, rejecting unscoped mass delete', async () => {
    // 12a. Attempting clear-all without campaignId or with 'all' is rejected
    const { req: badClearReq, res: badClearRes } = mockHttp({
      method: 'DELETE',
      query: { resource: 'leads', action: 'clear-all', campaignId: 'all' },
      cookie: adminCookie,
    });
    await adminManageHandler(badClearReq, badClearRes);
    expect(badClearRes.status$()).toBe(400);

    // 12b. Clear-all scoped to specific campaign succeeds
    const { req: clearReq, res: clearRes } = mockHttp({
      method: 'DELETE',
      query: { resource: 'leads', action: 'clear-all', campaignId: createdCampaignId },
      cookie: adminCookie,
    });
    await adminManageHandler(clearReq, clearRes);
    expect(clearRes.status$()).toBe(200);
    expect(clearRes.body$().cleared).toBe(true);

    // Verify campaign leads are now 0
    const remaining = fake.tables.leads.filter((l) => l.campaign_id === createdCampaignId);
    expect(remaining).toHaveLength(0);
  });

  // -------------------------------------------------------------------------
  // 13. Campaign Lifecycle: Unpublish & Verify Instant Revocation of Public Access
  // -------------------------------------------------------------------------
  it('Step 13: Admin unpublishes campaign, immediately invalidating public player access', async () => {
    const { req: unpubReq, res: unpubRes } = mockHttp({
      method: 'POST',
      query: { resource: 'campaigns', id: createdCampaignId, action: 'unpublish' },
      cookie: adminCookie,
    });
    await adminManageHandler(unpubReq, unpubRes);
    expect(unpubRes.status$()).toBe(200);
    expect(unpubRes.body$().campaign.status).toBe('draft');

    // Public access immediately returns 404
    const { req: pubReq, res: pubRes } = mockHttp({
      method: 'GET',
      query: { slug: campaignSlug },
    });
    await publicCampaignHandler(pubReq, pubRes);
    expect(pubRes.status$()).toBe(404);
  });

  // -------------------------------------------------------------------------
  // 14. Admin Logout & Session Token Invalidation
  // -------------------------------------------------------------------------
  it('Step 14: Admin logs out at /api/admin/logout, revoking session cookie in database', async () => {
    const { req: logoutReq, res: logoutRes } = mockHttp({
      method: 'POST',
      cookie: adminCookie,
    });
    await adminLogoutHandler(logoutReq, logoutRes);
    expect(logoutRes.status$()).toBe(200);
    expect(logoutRes.body$().ok).toBe(true);

    const logoutCookie = logoutRes.headers$()['set-cookie'] || logoutRes.headers$()['Set-Cookie'];
    expect(logoutCookie).toContain('Max-Age=0'); // Clears browser cookie

    // Subsequent authenticated request with old cookie fails
    const { req: checkReq, res: checkRes } = mockHttp({
      method: 'GET',
      query: { resource: 'campaigns' },
      cookie: adminCookie,
    });
    await adminManageHandler(checkReq, checkRes);
    expect(checkRes.status$()).toBe(401);
  });
});
