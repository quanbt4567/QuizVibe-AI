// @vitest-environment node
import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach, vi } from 'vitest';
import { FAKE_SUPABASE_HOST, FakePostgrest } from '../lib/testing/fakePostgrest';
import { mockHttp, tokenFromSetCookie } from '../lib/testing/httpMock';

/**
 * Phase 3: database-backed multi-campaign management, lifecycle, slugs, public publishing and
 * public answer sanitization. All data lives in an in-memory PostgREST emulator — the real
 * Supabase project is never contacted.
 */

const ENV: Record<string, string> = {
  ADMIN_PASSWORD: 'Synthetic_Admin_Pass_2026!',
  ADMIN_SESSION_SECRET: 'f3a91c07be4d82a65e10c9b7d4a3f281660ba9e5c7d1348f2b0e6a95d7c43e18',
  SUPABASE_URL: `https://${FAKE_SUPABASE_HOST}`,
  SUPABASE_SERVICE_ROLE_KEY: 'sb_secret_synthetic_fake_key_for_tests_only',
  NODE_ENV: 'test',
};

const SECRET_EXPLANATION = 'SECRET-EXPLANATION-do-not-leak-7731';
const SECRET_VOUCHER_CODE = 'SECRETCODE7731';

function campaignBody(overrides: Record<string, unknown> = {}) {
  return {
    title: 'Thử thách chăm da rạng rỡ',
    description: 'Minigame 5 câu hỏi nhận voucher',
    industry: 'Mỹ phẩm & Chăm sóc da',
    isAiGenerated: false,
    isMock: false,
    questions: [0, 1, 2, 3, 4].map((i) => ({
      question: `Câu hỏi số ${i + 1} về chăm sóc da?`,
      options: [`A${i}`, `B${i}`, `C${i}`, `D${i}`],
      correctIndex: i % 4,
      explanation: `${SECRET_EXPLANATION}-${i}`,
    })),
    voucher: {
      code: SECRET_VOUCHER_CODE,
      discount: 'Giảm 20% đơn từ 299.000đ',
      description: 'Áp dụng cho khách tham gia minigame',
      expiryDate: '7 ngày sau khi nhận',
      terms: 'Áp dụng 01 lần cho mỗi khách hàng',
    },
    ...overrides,
  };
}

const fake = new FakePostgrest();
let restoreFetch: () => void;
const SAVED_ENV: Record<string, string | undefined> = {};

type Handlers = {
  login: (req: any, res: any) => Promise<any>;
  manage: (req: any, res: any) => Promise<any>;
  publicCampaign: (req: any, res: any) => Promise<any>;
  logout: (req: any, res: any) => Promise<any>;
};
let h: Handlers;
let cookie = '';

async function loadHandlers(): Promise<Handlers> {
  vi.resetModules();
  const [login, manage, pub, logout] = await Promise.all([
    import('./login'),
    import('./manage'),
    import('../public/campaign'),
    import('./logout'),
  ]);
  return {
    login: login.default,
    manage: manage.default,
    publicCampaign: pub.default,
    logout: logout.default,
  };
}

async function adminCall(
  method: string,
  query: Record<string, string>,
  body?: unknown,
  options: { cookie?: string | null; headers?: Record<string, string> } = {}
) {
  const c = options.cookie === undefined ? cookie : options.cookie;
  const { req, res } = mockHttp({
    method,
    query: { resource: 'campaigns', ...query },
    body,
    cookie: c || undefined,
    headers: options.headers,
  });
  await h.manage(req, res);
  return { status: res.status$() as number, body: res.body$() as any, headers: res.headers$() };
}

async function publicGet(slug: string | undefined, method = 'GET') {
  const { req, res } = mockHttp({ method, query: slug === undefined ? {} : { slug } });
  await h.publicCampaign(req, res);
  return { status: res.status$() as number, body: res.body$() as any, headers: res.headers$() };
}

async function createCampaign(overrides: Record<string, unknown> = {}) {
  const r = await adminCall('POST', {}, campaignBody(overrides));
  expect(r.status).toBe(201);
  return r.body.campaign as any;
}

function allKeys(value: unknown, acc: Set<string> = new Set()): Set<string> {
  if (Array.isArray(value)) value.forEach((v) => allKeys(v, acc));
  else if (value && typeof value === 'object') {
    for (const [k, v] of Object.entries(value)) {
      acc.add(k);
      allKeys(v, acc);
    }
  }
  return acc;
}

beforeAll(() => {
  restoreFetch = fake.install();
});
afterAll(() => {
  restoreFetch();
});

beforeEach(async () => {
  fake.reset();
  for (const k of [...Object.keys(ENV), 'VERCEL', 'VERCEL_ENV']) SAVED_ENV[k] = process.env[k];
  delete process.env.VERCEL;
  delete process.env.VERCEL_ENV;
  Object.assign(process.env, ENV);
  h = await loadHandlers();

  const login = mockHttp({ method: 'POST', body: { password: ENV.ADMIN_PASSWORD } });
  await h.login(login.req, login.res);
  expect(login.res.status$()).toBe(200);
  cookie = `qv_admin_session=${encodeURIComponent(tokenFromSetCookie(login.res.headers$()['Set-Cookie']))}`;
});

afterEach(() => {
  for (const k of Object.keys(SAVED_ENV)) {
    if (SAVED_ENV[k] === undefined) delete process.env[k];
    else process.env[k] = SAVED_ENV[k];
  }
});

describe('Phase 3: Admin campaign management (database-backed)', () => {
  describe('1. Authentication on every campaign endpoint', () => {
    it('1. requires an authenticated Admin session for list, get, create, update, transition and delete', async () => {
      const created = await createCampaign();
      const calls: Array<[string, Record<string, string>, unknown?]> = [
        ['GET', {}],
        ['GET', { id: created.id }],
        ['POST', {}, campaignBody()],
        ['PUT', { id: created.id }, campaignBody()],
        ['POST', { id: created.id, action: 'publish' }],
        ['DELETE', { id: created.id }],
      ];
      for (const [method, query, body] of calls) {
        const r = await adminCall(method, query, body, { cookie: null });
        expect(r.status, `${method} ${JSON.stringify(query)}`).toBe(401);
        expect(r.body.ok).toBe(false);
        expect(r.body.campaign).toBeUndefined();
        expect(r.body.campaigns).toBeUndefined();
      }
      // Nothing was mutated by the unauthenticated attempts.
      expect(fake.tables.campaigns).toHaveLength(1);
      expect(fake.tables.campaigns[0].status).toBe('draft');
    });

    it('1b. a revoked session cannot list campaigns', async () => {
      const { req, res } = mockHttp({ method: 'POST', cookie });
      await h.logout(req, res);
      expect(res.status$()).toBe(200);
      const r = await adminCall('GET', {});
      expect(r.status).toBe(401);
      expect(r.body.code).toBe('SESSION_REVOKED');
    });

    it('1c. rejects cross-origin state-changing requests', async () => {
      const r = await adminCall('POST', {}, campaignBody(), {
        headers: { origin: 'https://evil.example', host: 'quizvibe.example' },
      });
      expect(r.status).toBe(403);
      expect(fake.tables.campaigns).toHaveLength(0);
    });
  });

  describe('2. Creation persists to the database', () => {
    it('2. creates a DRAFT campaign with 5 ordered questions and a voucher, atomically', async () => {
      const before = fake.requests.length;
      const r = await adminCall('POST', {}, campaignBody({ isAiGenerated: true }));
      expect(r.status).toBe(201);
      const c = r.body.campaign;

      expect(c.status).toBe('draft');
      expect(c.slug).toBe('thu-thach-cham-da-rang-ro');
      expect(c.isAiGenerated).toBe(true);
      expect(c.questions).toHaveLength(5);
      expect(c.voucher.code).toBe(SECRET_VOUCHER_CODE);

      expect(fake.tables.campaigns).toHaveLength(1);
      expect(fake.tables.campaign_questions).toHaveLength(5);
      expect(fake.tables.vouchers).toHaveLength(1);
      expect(fake.tables.campaigns[0].status).toBe('draft');
      expect(fake.tables.campaigns[0].published_at).toBeNull();
      expect(
        fake.tables.campaign_questions
          .sort((a, b) => a.question_order - b.question_order)
          .map((q) => q.question_order)
      ).toEqual([0, 1, 2, 3, 4]);

      // Atomicity evidence: all three tables are written by ONE rpc call, never by separate inserts.
      const writes = fake.requests.slice(before).filter((q) => q.method === 'POST');
      expect(writes).toHaveLength(1);
      expect(writes[0].table).toBe('admin_save_campaign');
    });

    it('2b. ignores client-supplied status, slug, published_at and ids (server is authoritative)', async () => {
      const r = await adminCall(
        'POST',
        {},
        campaignBody({
          status: 'published',
          slug: 'attacker-chosen-slug',
          published_at: '2020-01-01T00:00:00Z',
          publishedAt: '2020-01-01T00:00:00Z',
          id: '11111111-1111-1111-1111-111111111111',
        })
      );
      expect(r.status).toBe(201);
      expect(r.body.campaign.status).toBe('draft');
      expect(r.body.campaign.slug).not.toBe('attacker-chosen-slug');
      expect(r.body.campaign.id).not.toBe('11111111-1111-1111-1111-111111111111');
      expect(r.body.campaign.publishedAt).toBeUndefined();
      expect((await publicGet(r.body.campaign.slug)).status).toBe(404);
    });

    it('2c. rejects invalid payloads (not exactly 5 questions / 4 options / one valid answer) without writing', async () => {
      const bad: Array<Record<string, unknown>> = [
        { questions: campaignBody().questions.slice(0, 4) },
        { questions: [...campaignBody().questions, campaignBody().questions[0]] },
        { questions: campaignBody().questions.map((q, i) => (i === 2 ? { ...q, options: ['a', 'b', 'c'] } : q)) },
        { questions: campaignBody().questions.map((q, i) => (i === 1 ? { ...q, correctIndex: 4 } : q)) },
        { questions: campaignBody().questions.map((q, i) => (i === 0 ? { ...q, correctIndex: '1' } : q)) },
        { questions: campaignBody().questions.map((q, i) => (i === 3 ? { ...q, options: ['a', '', 'c', 'd'] } : q)) },
        { title: 'ab' },
        { voucher: undefined },
        { voucher: { ...campaignBody().voucher, code: 'HAS SPACE' } },
      ];
      for (const override of bad) {
        const r = await adminCall('POST', {}, campaignBody(override));
        expect(r.status, JSON.stringify(Object.keys(override))).toBe(400);
        expect(r.body.code).toBe('VALIDATION_FAILED');
        expect(r.body.fieldErrors).toBeTruthy();
      }
      expect(fake.tables.campaigns).toHaveLength(0);
      expect(fake.tables.campaign_questions).toHaveLength(0);
    });
  });

  describe('3. Update persists correctly', () => {
    it('3. updates details, questions and voucher; keeps slug, status and question ids stable', async () => {
      const created = await createCampaign();
      const originalIds = created.questions.map((q: any) => q.id);

      const r = await adminCall(
        'PUT',
        { id: created.id },
        campaignBody({
          title: 'Tiêu đề hoàn toàn mới',
          status: 'published',
          slug: 'should-not-change',
          questions: campaignBody().questions.map((q, i) => ({
            ...q,
            question: `Nội dung đã sửa cho câu ${i + 1}?`,
            correctIndex: 3,
          })),
          voucher: { ...campaignBody().voucher, code: 'NEWCODE50', discount: 'Giảm 50.000đ' },
        })
      );
      expect(r.status).toBe(200);
      const c = r.body.campaign;
      expect(c.title).toBe('Tiêu đề hoàn toàn mới');
      expect(c.slug).toBe(created.slug); // stable
      expect(c.status).toBe('draft'); // update can never publish
      expect(c.questions.map((q: any) => q.id)).toEqual(originalIds);
      expect(c.questions.every((q: any) => q.correctIndex === 3)).toBe(true);
      expect(c.questions[0].question).toBe('Nội dung đã sửa cho câu 1?');
      expect(c.voucher.code).toBe('NEWCODE50');

      const stored = fake.tables.campaigns[0];
      expect(stored.title).toBe('Tiêu đề hoàn toàn mới');
      expect(stored.slug).toBe(created.slug);
      expect(fake.tables.campaign_questions).toHaveLength(5);
      expect(fake.tables.vouchers).toHaveLength(1);
    });

    it('3b. returns 404 for unknown / malformed ids and rejects edits to archived campaigns', async () => {
      expect((await adminCall('PUT', { id: '22222222-2222-2222-2222-222222222222' }, campaignBody())).status).toBe(404);
      expect((await adminCall('PUT', { id: 'not-a-uuid' }, campaignBody())).status).toBe(404);
      expect((await adminCall('GET', { id: 'not-a-uuid' })).status).toBe(404);

      const created = await createCampaign();
      await adminCall('DELETE', { id: created.id });
      const r = await adminCall('PUT', { id: created.id }, campaignBody({ title: 'Cố gắng sửa bản lưu trữ' }));
      expect(r.status).toBe(409);
      expect(r.body.code).toBe('CAMPAIGN_ARCHIVED');
      expect(fake.tables.campaigns[0].title).not.toBe('Cố gắng sửa bản lưu trữ');
    });
  });

  describe('4. Archiving and lifecycle', () => {
    it('4. DELETE archives (soft delete), the campaign leaves public access, and can be restored to draft', async () => {
      const created = await createCampaign();
      await adminCall('POST', { id: created.id, action: 'publish' });
      expect((await publicGet(created.slug)).status).toBe(200);

      const del = await adminCall('DELETE', { id: created.id });
      expect(del.status).toBe(200);
      expect(del.body.archived).toBe(true);
      expect(del.body.campaign.status).toBe('archived');
      expect(fake.tables.campaigns).toHaveLength(1); // never hard-deleted (leads use ON DELETE RESTRICT)
      expect((await publicGet(created.slug)).status).toBe(404);

      const restored = await adminCall('POST', { id: created.id, action: 'restore' });
      expect(restored.status).toBe(200);
      expect(restored.body.campaign.status).toBe('draft');
      expect((await publicGet(created.slug)).status).toBe(404); // restore never republishes
    });

    it('4b. enforces valid state transitions on the server', async () => {
      const c = await createCampaign();
      // unpublish on a draft is an idempotent no-op; restore on a non-archived campaign is invalid
      const noop = await adminCall('POST', { id: c.id, action: 'unpublish' });
      expect(noop.status).toBe(200);
      expect(noop.body.campaign.status).toBe('draft');
      await adminCall('POST', { id: c.id, action: 'publish' });
      expect((await adminCall('POST', { id: c.id, action: 'restore' })).status).toBe(409);
      await adminCall('DELETE', { id: c.id });
      expect((await adminCall('POST', { id: c.id, action: 'unpublish' })).status).toBe(409);
      // archived -> publish must go through restore first
      const r = await adminCall('POST', { id: c.id, action: 'publish' });
      expect(r.status).toBe(409);
      expect(r.body.code).toBe('INVALID_STATE_TRANSITION');
      expect(fake.tables.campaigns[0].status).toBe('archived');
      // unknown actions are rejected
      expect((await adminCall('POST', { id: c.id, action: 'hack' })).status).toBe(400);
      expect((await adminCall('POST', { id: c.id })).status).toBe(400);
    });

    it('4c. same-state transitions are idempotent and publish sets published_at', async () => {
      const c = await createCampaign();
      const first = await adminCall('POST', { id: c.id, action: 'publish' });
      expect(first.body.campaign.status).toBe('published');
      expect(first.body.campaign.publishedAt).toBeTruthy();
      const again = await adminCall('POST', { id: c.id, action: 'publish' });
      expect(again.status).toBe(200);
      expect(again.body.campaign.publishedAt).toBe(first.body.campaign.publishedAt);
      const un = await adminCall('POST', { id: c.id, action: 'unpublish' });
      expect(un.body.campaign.status).toBe('draft');
      expect(un.body.campaign.publishedAt).toBeUndefined();
    });

    it('4d. refuses to publish a campaign whose stored data is incomplete', async () => {
      const c = await createCampaign();
      fake.tables.vouchers = []; // simulate corrupt/incomplete data
      const r = await adminCall('POST', { id: c.id, action: 'publish' });
      expect(r.status).toBe(422);
      expect(r.body.code).toBe('NOT_PUBLISHABLE');
      expect(fake.tables.campaigns[0].status).toBe('draft');
    });
  });

  describe('5-6. Multiple campaigns and slug handling', () => {
    it('5. multiple campaigns coexist and are listed without question or answer data', async () => {
      const a = await createCampaign({ title: 'Chiến dịch Alpha' });
      const b = await createCampaign({ title: 'Chiến dịch Beta' });
      const c = await createCampaign({ title: 'Chiến dịch Gamma' });
      await adminCall('POST', { id: b.id, action: 'publish' });
      await adminCall('DELETE', { id: c.id });

      const list = await adminCall('GET', {});
      expect(list.status).toBe(200);
      expect(list.body.campaigns).toHaveLength(3);
      expect(list.body.campaigns.map((x: any) => x.status).sort()).toEqual(['archived', 'draft', 'published']);
      expect(list.body.campaigns.find((x: any) => x.id === a.id).voucherCode).toBe(SECRET_VOUCHER_CODE);

      const text = JSON.stringify(list.body);
      expect(text).not.toContain('correctIndex');
      expect(text).not.toContain(SECRET_EXPLANATION);
      expect(list.body.campaigns[0].questions).toBeUndefined();

      const filtered = await adminCall('GET', { status: 'published' });
      expect(filtered.body.campaigns).toHaveLength(1);
      expect(filtered.body.campaigns[0].id).toBe(b.id);

      for (const x of [a, b, c]) {
        expect((await adminCall('GET', { id: x.id })).body.campaign.title).toBe(x.title);
      }
    });

    it('6. generates unique slugs for duplicate titles and keeps them stable across title edits', async () => {
      const one = await createCampaign({ title: 'Quiz Mùa Hè' });
      const two = await createCampaign({ title: 'Quiz Mùa Hè' });
      const three = await createCampaign({ title: 'quiz mua he' });
      expect([one.slug, two.slug, three.slug]).toEqual(['quiz-mua-he', 'quiz-mua-he-2', 'quiz-mua-he-3']);
      expect(new Set(fake.tables.campaigns.map((c) => c.slug)).size).toBe(3);

      const edited = await adminCall('PUT', { id: two.id }, campaignBody({ title: 'Tên hoàn toàn khác' }));
      expect(edited.body.campaign.slug).toBe('quiz-mua-he-2');
    });

    it('6b. resolves concurrent slug collisions (SQLSTATE 23505) by retrying with a different suffix', async () => {
      fake.forceSlugCollisions = 2;
      const c = await createCampaign({ title: 'Cuộc đua Thu Đông' });
      expect(c.slug).toMatch(/^cuoc-dua-thu-dong-[0-9a-f]{4}$/);
      expect(fake.tables.campaigns).toHaveLength(1);
    });

    it('6c. gives up safely (503, nothing persisted) when collisions never resolve', async () => {
      fake.forceSlugCollisions = 50;
      const r = await adminCall('POST', {}, campaignBody({ title: 'Không thể tạo' }));
      expect(r.status).toBe(503);
      expect(r.body.ok).toBe(false);
      expect(fake.tables.campaigns).toHaveLength(0);
    });

    it('6d. never produces slugs that collide with route aliases', async () => {
      const c = await createCampaign({ title: 'Active' });
      expect(c.slug).toBe('active-quiz');
      const d = await createCampaign({ title: '!!!' });
      expect(d.slug).toMatch(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
      expect(['active', 'default']).not.toContain(d.slug);
    });
  });

  describe('7-10. Public publishing rules', () => {
    it('7. draft campaigns are not accessible publicly (by slug or root alias)', async () => {
      const c = await createCampaign();
      const bySlug = await publicGet(c.slug);
      expect(bySlug.status).toBe(404);
      expect(bySlug.body.ok).toBe(false);
      expect((await publicGet('active')).status).toBe(404);
    });

    it('8. published campaigns are accessible through their slug and through the root alias', async () => {
      const c = await createCampaign();
      await adminCall('POST', { id: c.id, action: 'publish' });
      const r = await publicGet(c.slug);
      expect(r.status).toBe(200);
      expect(r.body.ok).toBe(true);
      expect(r.body.campaign.slug).toBe(c.slug);
      expect(r.body.campaign.title).toBe(c.title);
      expect(r.body.campaign.questions).toHaveLength(5);
      expect(r.headers['Cache-Control']).toBe('no-store');

      const active = await publicGet('active');
      expect(active.status).toBe(200);
      expect(active.body.campaign.id).toBe(c.id);
    });

    it('8b. several published campaigns are served independently; root alias is the most recently published', async () => {
      const a = await createCampaign({ title: 'Chiến dịch A' });
      const b = await createCampaign({ title: 'Chiến dịch B' });
      await adminCall('POST', { id: a.id, action: 'publish' });
      fake.tables.campaigns.find((x) => x.id === a.id)!.published_at = '2026-01-01T00:00:00.000Z';
      await adminCall('POST', { id: b.id, action: 'publish' });
      fake.tables.campaigns.find((x) => x.id === b.id)!.published_at = '2026-06-01T00:00:00.000Z';

      expect((await publicGet(a.slug)).body.campaign.title).toBe('Chiến dịch A');
      expect((await publicGet(b.slug)).body.campaign.title).toBe('Chiến dịch B');
      expect((await publicGet('active')).body.campaign.id).toBe(b.id);
    });

    it('9. unpublished and archived campaigns become inaccessible to new players immediately', async () => {
      const c = await createCampaign();
      await adminCall('POST', { id: c.id, action: 'publish' });
      expect((await publicGet(c.slug)).status).toBe(200);

      await adminCall('POST', { id: c.id, action: 'unpublish' });
      expect((await publicGet(c.slug)).status).toBe(404);

      await adminCall('POST', { id: c.id, action: 'publish' });
      expect((await publicGet(c.slug)).status).toBe(200);
      await adminCall('DELETE', { id: c.id });
      expect((await publicGet(c.slug)).status).toBe(404);
    });

    it('10. unknown, malformed and missing slugs return the same not-found response (no enumeration)', async () => {
      const draft = await createCampaign();
      const responses = [
        await publicGet('does-not-exist'),
        await publicGet(draft.slug), // draft
        await publicGet('../../etc/passwd'),
        await publicGet("x'; drop table campaigns;--"),
        await publicGet(''),
        await publicGet(undefined),
        await publicGet('A'),
      ];
      for (const r of responses) {
        expect(r.status).toBe(404);
        expect(r.body).toEqual(responses[0].body);
      }
    });

    it('10b. the public endpoint is read-only', async () => {
      for (const m of ['POST', 'PUT', 'DELETE', 'PATCH']) {
        expect((await publicGet('anything', m)).status).toBe(405);
      }
    });
  });

  describe('11-12. Public answer sanitization vs Admin DTOs', () => {
    it('11. the public response contains no correctIndex, answer keys, explanations or voucher code', async () => {
      const c = await createCampaign();
      await adminCall('POST', { id: c.id, action: 'publish' });
      const r = await publicGet(c.slug);
      expect(r.status).toBe(200);

      const raw = JSON.stringify(r.body);
      expect(raw).not.toMatch(/correct/i);
      expect(raw).not.toMatch(/answer/i);
      expect(raw).not.toMatch(/explanation/i);
      expect(raw).not.toContain(SECRET_EXPLANATION);
      expect(raw).not.toContain(SECRET_VOUCHER_CODE);
      expect(raw).not.toContain('is_ai_generated');
      expect(raw).not.toContain('legacy_id');

      // Strict allow-list of keys (anything new must be added here deliberately).
      expect([...allKeys(JSON.parse(raw))].sort()).toEqual(
        [
          'campaign',
          'description',
          'discount',
          'expiryDate',
          'id',
          'industry',
          'isMock',
          'ok',
          'options',
          'order',
          'publishedAt',
          'question',
          'questionCount',
          'questions',
          'slug',
          'terms',
          'title',
          'voucher',
        ].sort()
      );
    });

    it('11b. sanitization is an explicit mapping: unexpected extra columns on a database row cannot leak', async () => {
      vi.resetModules();
      const { toPublicCampaignDto } = await import('../lib/campaigns/campaignDto');
      const dto = toPublicCampaignDto({
        campaign: {
          id: 'c1',
          slug: 'demo-slug',
          legacy_id: 'legacy-1',
          title: 'Demo',
          description: '',
          industry: 'x',
          status: 'published',
          is_ai_generated: true,
          is_mock: false,
          mock_label: null,
          published_at: '2026-01-01T00:00:00Z',
          created_at: 'x',
          updated_at: 'x',
          // a hypothetical future column
          internal_notes: 'LEAKY-INTERNAL-NOTE',
        } as any,
        questions: [0, 1, 2, 3, 4].map((i) => ({
          id: `q${i}`,
          campaign_id: 'c1',
          question_order: i,
          question_text: `Câu ${i}?`,
          options: ['a', 'b', 'c', 'd'],
          correct_index: 2,
          explanation: 'LEAKY-EXPLANATION',
          answer_key: 'LEAKY-KEY',
          created_at: 'x',
          updated_at: 'x',
        })) as any,
        voucher: {
          id: 'v',
          campaign_id: 'c1',
          code: 'LEAKYCODE',
          discount: '10%',
          description: 'desc',
          expiry_date: null,
          terms: null,
          created_at: 'x',
          updated_at: 'x',
        },
      });
      const raw = JSON.stringify(dto);
      expect(raw).not.toContain('LEAKY');
      expect(raw).not.toContain('correct');
      expect(dto?.questions[0]).toEqual({ id: 'q0', order: 0, question: 'Câu 0?', options: ['a', 'b', 'c', 'd'] });

      // Non-published records never produce a public DTO.
      for (const status of ['draft', 'archived'] as const) {
        expect(
          toPublicCampaignDto({
            campaign: { id: 'c', slug: 's', status } as any,
            questions: [],
            voucher: null,
          })
        ).toBeNull();
      }
    });

    it('12. Admin DTOs retain everything needed to edit questions (answer, explanation, voucher code)', async () => {
      const c = await createCampaign();
      const full = (await adminCall('GET', { id: c.id })).body.campaign;
      expect(full.questions).toHaveLength(5);
      full.questions.forEach((q: any, i: number) => {
        expect(q.id).toBeTruthy();
        expect(q.correctIndex).toBe(i % 4);
        expect(q.explanation).toBe(`${SECRET_EXPLANATION}-${i}`);
        expect(q.options).toEqual([`A${i}`, `B${i}`, `C${i}`, `D${i}`]);
      });
      expect(full.voucher).toMatchObject({
        code: SECRET_VOUCHER_CODE,
        discount: 'Giảm 20% đơn từ 299.000đ',
        expiryDate: '7 ngày sau khi nhận',
      });
      expect(full.slug).toBe(c.slug);
      expect(full.status).toBe('draft');
    });
  });

  describe('13. AI-generated campaigns stay draft and enforce the 5x4 schema', () => {
    it('13. AI output validation still demands exactly 5 questions with 4 options and one valid answer each', async () => {
      vi.resetModules();
      const { validateAIOutput } = await import('../lib/validator');
      const q = (i: number) => ({
        question: `Câu hỏi AI số ${i + 1}?`,
        options: ['a', 'b', 'c', 'd'],
        correctIndex: i % 4,
      });
      expect(validateAIOutput({ questions: [0, 1, 2, 3, 4].map(q) }).valid).toBe(true);
      expect(validateAIOutput({ questions: [0, 1, 2, 3].map(q) }).valid).toBe(false);
      expect(validateAIOutput({ questions: [0, 1, 2, 3, 4, 5].map(q) }).valid).toBe(false);
      expect(
        validateAIOutput({ questions: [0, 1, 2, 3, 4].map((i) => ({ ...q(i), options: ['a', 'b', 'c'] })) }).valid
      ).toBe(false);
      expect(
        validateAIOutput({ questions: [0, 1, 2, 3, 4].map((i) => ({ ...q(i), correctIndex: 4 })) }).valid
      ).toBe(false);
      expect(
        validateAIOutput({ questions: [0, 1, 2, 3, 4].map((i) => ({ ...q(i), correctIndex: undefined })) }).valid
      ).toBe(false);
    });

    it('13b. a reviewed AI-generated campaign is saved as Draft and is not public until explicitly published', async () => {
      const c = await createCampaign({ isAiGenerated: true, title: 'Quiz AI: Kem chống nắng' });
      expect(c.isAiGenerated).toBe(true);
      expect(c.status).toBe('draft');
      expect((await publicGet(c.slug)).status).toBe(404);
      await adminCall('POST', { id: c.id, action: 'publish' });
      expect((await publicGet(c.slug)).status).toBe(200);
    });
  });

  describe('14. Database failures never return false success', () => {
    it('14. create: RPC failure -> 503, nothing stored, no campaign in response', async () => {
      for (const mode of ['http500'] as const) {
        fake.failure = (r) => (r.table === 'admin_save_campaign' ? mode : null);
        const r = await adminCall('POST', {}, campaignBody());
        expect(r.status, mode).toBe(503);
        expect(r.body.ok).toBe(false);
        expect(r.body.campaign).toBeUndefined();
        expect(r.body.code).toBe('DATABASE_ERROR');
        expect(JSON.stringify(r.body)).not.toContain('simulated');
      }
      expect(fake.tables.campaigns).toHaveLength(0);
      expect(fake.tables.campaign_questions).toHaveLength(0);
      expect(fake.tables.vouchers).toHaveLength(0);
    });

    it('14b. create: success is not reported when the write cannot be read back', async () => {
      let rpcDone = false;
      fake.failure = (r) => {
        if (r.table === 'admin_save_campaign') {
          rpcDone = true;
          return null;
        }
        return rpcDone && r.table === 'campaigns' && r.method === 'GET' && r.params.id ? 'http500' : null;
      };
      const r = await adminCall('POST', {}, campaignBody());
      expect(r.status).toBe(503);
      expect(r.body.ok).toBe(false);
    });

    it('14c. update: RPC failure -> 503 and stored data is unchanged', async () => {
      const c = await createCampaign();
      fake.failure = (r) => (r.table === 'admin_save_campaign' ? 'http500' : null);
      const r = await adminCall('PUT', { id: c.id }, campaignBody({ title: 'Không được lưu' }));
      expect(r.status).toBe(503);
      expect(fake.tables.campaigns[0].title).toBe(c.title);
    });

    it('14d. lifecycle: a failed status write returns 503 and the campaign stays unpublished', async () => {
      const c = await createCampaign();
      fake.failure = (r) => (r.table === 'campaigns' && r.method === 'PATCH' ? 'http500' : null);
      const r = await adminCall('POST', { id: c.id, action: 'publish' });
      expect(r.status).toBe(503);
      expect(fake.tables.campaigns[0].status).toBe('draft');
      fake.failure = null;
      expect((await publicGet(c.slug)).status).toBe(404);
    });

    it('14e. list / get during an outage -> 503 (never an empty success)', async () => {
      const c = await createCampaign();
      fake.failure = (r) => (r.table !== 'admin_sessions' ? 'http500' : null);
      const list = await adminCall('GET', {});
      expect(list.status).toBe(503);
      expect(list.body.campaigns).toBeUndefined();
      const get = await adminCall('GET', { id: c.id });
      expect(get.status).toBe(503);
    });

    it('14f. public endpoint during an outage -> 503, never a fake "not found" or stale campaign', async () => {
      const c = await createCampaign();
      await adminCall('POST', { id: c.id, action: 'publish' });
      fake.failure = (r) => (r.table !== 'admin_sessions' ? 'http500' : null);
      const r = await publicGet(c.slug);
      expect(r.status).toBe(503);
      expect(r.body.ok).toBe(false);
      expect(r.body.campaign).toBeUndefined();
    });
  });

  describe('15. Existing authentication and Phase 4 placeholders remain intact', () => {
    it('15. leads / vouchers / overview placeholders still require authentication', async () => {
      for (const resource of ['leads', 'vouchers', 'overview']) {
        const anon = mockHttp({ method: 'GET', query: { resource } });
        await h.manage(anon.req, anon.res);
        expect(anon.res.status$()).toBe(401);

        const authed = mockHttp({ method: 'GET', query: { resource }, cookie });
        await h.manage(authed.req, authed.res);
        expect(authed.res.status$()).toBe(200);
        expect(authed.res.body$().authorized).toBe(true);
      }
    });

    it('15b. rejects unknown resources and malformed JSON for authenticated admins', async () => {
      const bad = mockHttp({ method: 'GET', query: { resource: 'nope' }, cookie });
      await h.manage(bad.req, bad.res);
      expect(bad.res.status$()).toBe(400);

      const malformed = mockHttp({ method: 'POST', query: { resource: 'campaigns' }, body: '{not json', cookie });
      await h.manage(malformed.req, malformed.res);
      expect(malformed.res.status$()).toBe(400);
    });
  });
});
