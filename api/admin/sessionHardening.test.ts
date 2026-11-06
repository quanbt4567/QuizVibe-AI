// @vitest-environment node
import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach, vi } from 'vitest';

/**
 * Phase 2 Hardening: fail-closed, database-authoritative Admin sessions.
 * Every scenario uses synthetic secrets and a stubbed PostgREST `fetch` — the real Supabase
 * project is never contacted (any non-synthetic host makes the stub throw).
 */

const SYNTHETIC_HOST = 'synthetic-test-project.supabase.co';
const ENV = {
  ADMIN_PASSWORD: 'Synthetic_Admin_Pass_2026!',
  ADMIN_SESSION_SECRET: 'f3a91c07be4d82a65e10c9b7d4a3f281660ba9e5c7d1348f2b0e6a95d7c43e18',
  SUPABASE_URL: `https://${SYNTHETIC_HOST}`,
  SUPABASE_SERVICE_ROLE_KEY: 'sb_secret_synthetic_fake_key_for_tests_only',
  NODE_ENV: 'test',
} as Record<string, string>;

type Row = {
  token_hash: string;
  created_at: string;
  expires_at: string;
  revoked_at: string | null;
  last_seen_at: string;
};
type RecordedRequest = { method: string; path: string; body: any };
type DbMode = 'ok' | 'down' | 'http500' | 'hang' | 'write500';

let table = new Map<string, Row>();
let dbMode: DbMode = 'ok';
let requests: RecordedRequest[] = [];
const realFetch = globalThis.fetch;

function installFetchStub() {
  globalThis.fetch = (async (input: any, init: any = {}) => {
    const url = new URL(typeof input === 'string' ? input : input.url ?? String(input));
    if (url.hostname !== SYNTHETIC_HOST) {
      throw new Error(`Blocked non-synthetic network call to ${url.hostname}`);
    }
    const method = String(init.method || 'GET').toUpperCase();
    const body = typeof init.body === 'string' ? JSON.parse(init.body) : undefined;
    requests.push({ method, path: url.pathname, body });

    const json = (status: number, payload: unknown) =>
      new Response(JSON.stringify(payload), {
        status,
        headers: { 'content-type': 'application/json' },
      });

    if (dbMode === 'down') throw new TypeError('fetch failed (simulated outage)');
    if (dbMode === 'hang') return new Promise<Response>(() => {});
    if (dbMode === 'http500') return json(500, { message: 'simulated failure' });
    if (dbMode === 'write500' && method !== 'GET') return json(500, { message: 'simulated write failure' });

    const hash = url.searchParams.get('token_hash')?.replace(/^eq\./, '');
    const row = hash ? table.get(hash) : undefined;

    if (method === 'POST') {
      const existing = table.get(body.token_hash);
      table.set(body.token_hash, { ...(existing ?? ({} as Row)), ...body });
      return new Response(null, { status: 201 });
    }
    if (method === 'PATCH') {
      if (!row) return json(200, []);
      if (url.searchParams.get('revoked_at') === 'is.null' && row.revoked_at !== null) {
        return json(200, []);
      }
      Object.assign(row, body);
      return json(200, [{ token_hash: row.token_hash }]);
    }
    const accept = new Headers(init.headers).get('accept') || '';
    if (accept.includes('pgrst.object')) {
      return row ? json(200, row) : json(406, { code: 'PGRST116', message: 'no rows' });
    }
    return json(200, row ? [row] : []);
  }) as typeof fetch;
}

type AuthModule = typeof import('../_lib/auth/adminAuth');

/** A brand-new module registry == a brand-new serverless instance with empty process memory. */
async function freshInstance(): Promise<AuthModule> {
  vi.resetModules();
  return import('../_lib/auth/adminAuth');
}

async function loadHandlers() {
  vi.resetModules();
  const [login, session, logout, manage] = await Promise.all([
    import('./login'),
    import('./session'),
    import('./logout'),
    import('./manage'),
  ]);
  return {
    login: login.default,
    session: session.default,
    logout: logout.default,
    manage: manage.default,
  };
}

function cookieFor(token: string) {
  return `qv_admin_session=${encodeURIComponent(token)}`;
}

function mockHttp(opts: { method: string; body?: unknown; cookie?: string; query?: Record<string, string> }) {
  const req = {
    method: opts.method,
    body: opts.body,
    query: opts.query || {},
    headers: { ...(opts.cookie ? { cookie: opts.cookie } : {}) } as Record<string, string>,
    socket: { remoteAddress: '198.51.100.7' },
  };
  let statusCode = 200;
  let jsonBody: any = null;
  const headers: Record<string, string> = {};
  const res: any = {
    setHeader: (k: string, v: string) => {
      headers[k] = v;
    },
    status: (c: number) => {
      statusCode = c;
      return res;
    },
    json: (d: any) => {
      jsonBody = d;
      return res;
    },
    status$: () => statusCode,
    body$: () => jsonBody,
    headers$: () => headers,
  };
  return { req, res };
}

function tokenFromSetCookie(setCookie: string | undefined): string {
  const first = (setCookie || '').split(';')[0] || '';
  return decodeURIComponent(first.slice(first.indexOf('=') + 1));
}

const SAVED_ENV: Record<string, string | undefined> = {};
const ENV_KEYS = [
  ...Object.keys(ENV),
  'VERCEL',
  'VERCEL_ENV',
  'VITE_ADMIN_PASSWORD',
  'VITE_ADMIN_SESSION_SECRET',
];

beforeAll(() => {
  installFetchStub();
});
afterAll(() => {
  globalThis.fetch = realFetch;
});

beforeEach(() => {
  table = new Map();
  dbMode = 'ok';
  requests = [];
  for (const k of ENV_KEYS) SAVED_ENV[k] = process.env[k];
  for (const k of ['VERCEL', 'VERCEL_ENV', 'VITE_ADMIN_PASSWORD', 'VITE_ADMIN_SESSION_SECRET']) {
    delete process.env[k];
  }
  Object.assign(process.env, ENV);
});

afterEach(() => {
  for (const k of ENV_KEYS) {
    if (SAVED_ENV[k] === undefined) delete process.env[k];
    else process.env[k] = SAVED_ENV[k];
  }
});

describe('Phase 2 Hardening: database-authoritative, fail-closed Admin sessions', () => {
  describe('Test 1-3: authoritative database row', () => {
    it('1. valid session with an active database row authenticates (on a different, cold instance)', async () => {
      const A = await freshInstance();
      const s = await A.createAdminSession({ env: ENV });
      expect(table.has(s.tokenHash)).toBe(true);

      const B = await freshInstance();
      const result = await B.verifyAdminSessionToken(s.token, { env: ENV });
      expect(result.authenticated).toBe(true);
      expect(result.tokenHash).toBe(s.tokenHash);
    });

    it('stores only the SHA-256 token hash, never the plaintext token', async () => {
      const A = await freshInstance();
      const s = await A.createAdminSession({ env: ENV });
      expect(s.tokenHash).toMatch(/^[0-9a-f]{64}$/);
      expect(JSON.stringify([...table.values()])).not.toContain(s.token);
      expect(JSON.stringify(requests)).not.toContain(s.token);
    });

    it('2. a validly signed token with no database row is rejected as UNAUTHORIZED', async () => {
      const A = await freshInstance();
      const s = await A.createAdminSession({ env: ENV });
      table.clear();

      const B = await freshInstance();
      const result = await B.verifyAdminSessionToken(s.token, { env: ENV });
      expect(result.authenticated).toBe(false);
      expect(result.code).toBe('UNAUTHORIZED');
    });

    it('3. a revoked database row is rejected as SESSION_REVOKED', async () => {
      const A = await freshInstance();
      const s = await A.createAdminSession({ env: ENV });
      table.get(s.tokenHash)!.revoked_at = new Date().toISOString();

      const B = await freshInstance();
      const result = await B.verifyAdminSessionToken(s.token, { env: ENV });
      expect(result.authenticated).toBe(false);
      expect(result.code).toBe('SESSION_REVOKED');
    });
  });

  describe('Test 4-5: database failure and timeout fail closed', () => {
    it('4. a database query error is rejected and never authenticates', async () => {
      const A = await freshInstance();
      const s = await A.createAdminSession({ env: ENV });

      dbMode = 'http500';
      const B = await freshInstance();
      const result = await B.verifyAdminSessionToken(s.token, { env: ENV });
      expect(result.authenticated).toBe(false);
      expect(result.code).toBe('SESSION_STORE_UNAVAILABLE');
    });

    it('4b. a database outage (network failure) is rejected, including for an already-revoked token', async () => {
      const A = await freshInstance();
      const s = await A.createAdminSession({ env: ENV });
      await A.revokeAdminSessionFromRequest({ headers: { cookie: cookieFor(s.token) } }, { env: ENV });

      dbMode = 'down';
      const B = await freshInstance();
      const result = await B.verifyAdminSessionToken(s.token, { env: ENV, dbTimeoutMs: 200 });
      expect(result.authenticated).toBe(false);
      expect(result.code).toBe('SESSION_STORE_UNAVAILABLE');
    });

    it('5. a database timeout is rejected and never authenticates', async () => {
      const A = await freshInstance();
      const s = await A.createAdminSession({ env: ENV });

      dbMode = 'hang';
      const B = await freshInstance();
      const started = Date.now();
      const result = await B.verifyAdminSessionToken(s.token, { env: ENV, dbTimeoutMs: 40 });
      expect(Date.now() - started).toBeLessThan(2000);
      expect(result.authenticated).toBe(false);
      expect(result.code).toBe('SESSION_STORE_UNAVAILABLE');
    });

    it('5b. protected endpoints answer 503 (never 200) during a database outage', async () => {
      const h = await loadHandlers();
      const login = mockHttp({ method: 'POST', body: { password: ENV.ADMIN_PASSWORD } });
      await h.login(login.req, login.res);
      expect(login.res.status$()).toBe(200);
      const cookie = cookieFor(tokenFromSetCookie(login.res.headers$()['Set-Cookie']));

      dbMode = 'http500';
      for (const resource of ['leads', 'campaigns', 'vouchers']) {
        const m = mockHttp({ method: 'GET', cookie, query: { resource } });
        await h.manage(m.req, m.res);
        expect(m.res.status$()).toBe(503);
        expect(m.res.body$().ok).toBe(false);
        expect(m.res.body$().authorized).toBeUndefined();
      }
      const s = mockHttp({ method: 'GET', cookie });
      await h.session(s.req, s.res);
      expect(s.res.status$()).toBe(503);
      expect(s.res.body$().authenticated).toBe(false);
    });
  });

  describe('Test 6: login persistence failure', () => {
    it('6. createAdminSession rejects and issues no token/cookie when the upsert fails', async () => {
      dbMode = 'write500';
      const A = await freshInstance();
      await expect(A.createAdminSession({ env: ENV })).rejects.toMatchObject({
        code: 'SESSION_STORE_UNAVAILABLE',
      });
      expect(table.size).toBe(0);
    });

    it('6b. POST /api/admin/login returns 503 with no Set-Cookie and no internals on persistence failure', async () => {
      dbMode = 'write500';
      const h = await loadHandlers();
      const { req, res } = mockHttp({ method: 'POST', body: { password: ENV.ADMIN_PASSWORD } });
      await h.login(req, res);

      expect(res.status$()).toBe(503);
      expect(res.body$().authenticated).toBe(false);
      expect(res.body$().code).toBe('SESSION_STORE_UNAVAILABLE');
      expect(res.headers$()['Set-Cookie']).toBeUndefined();
      const serialized = JSON.stringify(res.body$());
      expect(serialized).not.toContain('simulated');
      expect(serialized).not.toContain(ENV.SUPABASE_SERVICE_ROLE_KEY);
      expect(serialized).not.toContain(SYNTHETIC_HOST);
    });

    it('6c. a login-time database timeout also issues no cookie', async () => {
      dbMode = 'hang';
      const A = await freshInstance();
      await expect(A.createAdminSession({ env: ENV, dbTimeoutMs: 40 })).rejects.toMatchObject({
        code: 'SESSION_STORE_UNAVAILABLE',
      });
    });
  });

  describe('Test 7-8: logout and cross-instance revocation', () => {
    it('7. logout on instance B is rejected by instance A (the creating instance) on its next verification', async () => {
      const A = await freshInstance();
      const s = await A.createAdminSession({ env: ENV });
      expect((await A.verifyAdminSessionToken(s.token, { env: ENV })).authenticated).toBe(true);

      const B = await freshInstance();
      const r = await B.revokeAdminSessionFromRequest(
        { headers: { cookie: cookieFor(s.token) } },
        { env: ENV }
      );
      expect(r.completed).toBe(true);

      const afterOnA = await A.verifyAdminSessionToken(s.token, { env: ENV });
      expect(afterOnA.authenticated).toBe(false);
      expect(afterOnA.code).toBe('SESSION_REVOKED');

      const C = await freshInstance();
      expect((await C.verifyAdminSessionToken(s.token, { env: ENV })).code).toBe('SESSION_REVOKED');
    });

    it('8. logout issues a narrow UPDATE of revoked_at only and preserves created_at / expires_at', async () => {
      const A = await freshInstance();
      const s = await A.createAdminSession({ env: ENV });
      const before = { ...table.get(s.tokenHash)! };
      const postsBefore = requests.filter((r) => r.method === 'POST').length;
      requests = [];

      const B = await freshInstance();
      const nowMs = Date.now() + 1000;
      await B.revokeAdminSessionFromRequest({ headers: { cookie: cookieFor(s.token) } }, { env: ENV, nowMs });

      const patches = requests.filter((r) => r.method === 'PATCH');
      expect(patches).toHaveLength(1);
      expect(Object.keys(patches[0].body)).toEqual(['revoked_at']);
      expect(requests.some((r) => r.method === 'POST')).toBe(false);
      expect(postsBefore).toBe(1);

      const after = table.get(s.tokenHash)!;
      expect(after.created_at).toBe(before.created_at);
      expect(after.expires_at).toBe(before.expires_at);
      expect(after.token_hash).toBe(before.token_hash);
      expect(after.revoked_at).toBe(new Date(nowMs).toISOString());
    });

    it('8b. a failed revocation is not reported as complete and the cookie is NOT cleared', async () => {
      const h = await loadHandlers();
      const login = mockHttp({ method: 'POST', body: { password: ENV.ADMIN_PASSWORD } });
      await h.login(login.req, login.res);
      const cookie = cookieFor(tokenFromSetCookie(login.res.headers$()['Set-Cookie']));

      dbMode = 'http500';
      const out = mockHttp({ method: 'POST', cookie });
      await h.logout(out.req, out.res);
      expect(out.res.status$()).toBe(503);
      expect(out.res.body$().ok).toBe(false);
      expect(out.res.body$().code).toBe('LOGOUT_NOT_COMPLETED');
      expect(out.res.headers$()['Set-Cookie']).toBeUndefined();

      // The server session is still live once the database recovers: the user was not misled.
      dbMode = 'ok';
      const s = mockHttp({ method: 'GET', cookie });
      await h.session(s.req, s.res);
      expect(s.res.status$()).toBe(200);
    });

    it('8c. a logout revocation timeout is reported as not completed', async () => {
      const A = await freshInstance();
      const s = await A.createAdminSession({ env: ENV });
      dbMode = 'hang';
      const r = await A.revokeAdminSessionFromRequest(
        { headers: { cookie: cookieFor(s.token) } },
        { env: ENV, dbTimeoutMs: 40 }
      );
      expect(r.completed).toBe(false);
      expect(r.revoked).toBe(false);
    });
  });

  describe('Test 9: expiry', () => {
    it('9. an expired signed token is rejected without consulting the database', async () => {
      const A = await freshInstance();
      const base = Date.now();
      const s = await A.createAdminSession({ env: ENV, nowMs: base, ttlSeconds: 60 });
      requests = [];

      const B = await freshInstance();
      const result = await B.verifyAdminSessionToken(s.token, { env: ENV, nowMs: base + 61_000 });
      expect(result.authenticated).toBe(false);
      expect(result.code).toBe('SESSION_EXPIRED');
      expect(requests).toHaveLength(0);
    });

    it('9b. an expired database record is rejected even when the signed token is still in date', async () => {
      const A = await freshInstance();
      const s = await A.createAdminSession({ env: ENV });
      table.get(s.tokenHash)!.expires_at = new Date(Date.now() - 1000).toISOString();

      const B = await freshInstance();
      const result = await B.verifyAdminSessionToken(s.token, { env: ENV });
      expect(result.authenticated).toBe(false);
      expect(result.code).toBe('SESSION_EXPIRED');
    });

    it('9c. tampered signatures and garbage tokens are rejected before any database access', async () => {
      const A = await freshInstance();
      const s = await A.createAdminSession({ env: ENV });
      requests = [];
      const parts = s.token.split('.');
      const tampered = `${parts[0]}.${Number(parts[1]) + 86_400_000}.${parts[2]}`;
      expect((await A.verifyAdminSessionToken(tampered, { env: ENV })).code).toBe('UNAUTHORIZED');
      expect((await A.verifyAdminSessionToken('a.b.c', { env: ENV })).code).toBe('UNAUTHORIZED');
      expect(requests).toHaveLength(0);
    });
  });

  describe('Test 10: ADMIN_SESSION_SECRET validation', () => {
    const base = {
      ADMIN_PASSWORD: ENV.ADMIN_PASSWORD,
      SUPABASE_SERVICE_ROLE_KEY: ENV.SUPABASE_SERVICE_ROLE_KEY,
    };

    it('10. rejects missing, short, low-variety and placeholder secrets', async () => {
      const A = await freshInstance();
      const weak: Array<[string, string | undefined]> = [
        ['missing', undefined],
        ['empty', ''],
        ['short', 'a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d'], // 31 chars
        ['low-variety', 'a'.repeat(64)],
        ['placeholder', 'changeme-changeme-changeme-changeme-123456'],
        ['equals admin password', ENV.ADMIN_PASSWORD],
      ];
      for (const [label, value] of weak) {
        const env = { ...base, ...(value === undefined ? {} : { ADMIN_SESSION_SECRET: value }) };
        expect(() => A.validateAdminAuthEnv(env), label).toThrowError(A.AdminAuthConfigError);
      }
    });

    it('10b. does not derive a secret from the admin password and service-role key any more', async () => {
      const A = await freshInstance();
      expect(() => A.validateAdminAuthEnv({ ...base })).toThrowError(/ADMIN_SESSION_SECRET/);
    });

    it('10c. a strong independent secret is accepted', async () => {
      const A = await freshInstance();
      expect(A.validateAdminAuthEnv({ ...base, ADMIN_SESSION_SECRET: ENV.ADMIN_SESSION_SECRET })).toBeTruthy();
    });

    it('10d. error messages never contain the secret value', async () => {
      const A = await freshInstance();
      const weakValue = 'weak-secret-value-xyz';
      try {
        A.validateAdminAuthEnv({ ...base, ADMIN_SESSION_SECRET: weakValue });
        throw new Error('expected failure');
      } catch (e) {
        expect(String((e as Error).message)).not.toContain(weakValue);
        expect(String((e as Error).message)).not.toContain(ENV.ADMIN_PASSWORD);
      }
    });

    it('10e. verification and login fail closed when the secret is weak', async () => {
      const A = await freshInstance();
      const s = await A.createAdminSession({ env: ENV });
      const weakEnv = { ...ENV, ADMIN_SESSION_SECRET: 'short' };
      const v = await A.verifyAdminSessionToken(s.token, { env: weakEnv });
      expect(v.authenticated).toBe(false);
      expect(v.code).toBe('ADMIN_AUTH_NOT_CONFIGURED');
      await expect(A.createAdminSession({ env: weakEnv })).rejects.toMatchObject({
        code: 'ADMIN_AUTH_NOT_CONFIGURED',
      });

      process.env.ADMIN_SESSION_SECRET = 'short';
      const h = await loadHandlers();
      const { req, res } = mockHttp({ method: 'POST', body: { password: ENV.ADMIN_PASSWORD } });
      await h.login(req, res);
      expect(res.status$()).toBe(503);
      expect(res.headers$()['Set-Cookie']).toBeUndefined();
    });

    it('10f. still rejects VITE_-prefixed admin secrets', async () => {
      const A = await freshInstance();
      expect(() =>
        A.validateAdminAuthEnv({ ...ENV, VITE_ADMIN_SESSION_SECRET: ENV.ADMIN_SESSION_SECRET })
      ).toThrowError(A.AdminAuthConfigError);
    });
  });

  describe('Test 11: memory-only mode is local-development only', () => {
    const { SUPABASE_URL: _u, SUPABASE_SERVICE_ROLE_KEY: _k, ...noDb } = ENV;

    it('11. memory mode works when Supabase is fully unset in a non-production environment', async () => {
      const A = await freshInstance();
      expect(A.resolveAdminSessionStoreMode(noDb)).toBe('memory');
      const s = await A.createAdminSession({ env: noDb });
      expect((await A.verifyAdminSessionToken(s.token, { env: noDb })).authenticated).toBe(true);
      await A.revokeAdminSessionFromRequest({ headers: { cookie: cookieFor(s.token) } }, { env: noDb });
      expect((await A.verifyAdminSessionToken(s.token, { env: noDb })).code).toBe('SESSION_REVOKED');
      expect(requests).toHaveLength(0);
    });

    it('11b. memory mode is not shared across instances (a fresh instance rejects the token)', async () => {
      const A = await freshInstance();
      const s = await A.createAdminSession({ env: noDb });
      const B = await freshInstance();
      expect((await B.verifyAdminSessionToken(s.token, { env: noDb })).code).toBe('UNAUTHORIZED');
    });

    it('11c. production (NODE_ENV or Vercel) without Supabase fails closed instead of using memory', async () => {
      const A = await freshInstance();
      for (const extra of [{ NODE_ENV: 'production' }, { VERCEL: '1' }, { VERCEL_ENV: 'preview' }]) {
        const env = { ...noDb, ...extra };
        expect(() => A.resolveAdminSessionStoreMode(env)).toThrowError(A.AdminAuthConfigError);
        await expect(A.createAdminSession({ env })).rejects.toMatchObject({
          code: 'SESSION_STORE_UNAVAILABLE',
        });
        const v = await A.verifyAdminSessionToken('a'.repeat(64) + '.1.' + 'b'.repeat(64), { env });
        expect(v.authenticated).toBe(false);
      }
    });

    it('11d. a partial Supabase configuration fails closed', async () => {
      const A = await freshInstance();
      expect(() => A.resolveAdminSessionStoreMode({ ...noDb, SUPABASE_URL: ENV.SUPABASE_URL })).toThrowError(
        A.AdminAuthConfigError
      );
      expect(() =>
        A.resolveAdminSessionStoreMode({ ...noDb, SUPABASE_SERVICE_ROLE_KEY: ENV.SUPABASE_SERVICE_ROLE_KEY })
      ).toThrowError(A.AdminAuthConfigError);
    });

    it('11e. Supabase configured always selects the database store, even outside production', async () => {
      const A = await freshInstance();
      expect(A.resolveAdminSessionStoreMode(ENV)).toBe('database');
    });
  });

  describe('Test 12: end-to-end flow with the database store', () => {
    it('login -> session -> manage -> logout -> replay is rejected, with correct statuses and cookie flags', async () => {
      const h = await loadHandlers();

      const bad = mockHttp({ method: 'POST', body: { password: 'wrong-password-123' } });
      await h.login(bad.req, bad.res);
      expect(bad.res.status$()).toBe(401);
      expect(bad.res.headers$()['Set-Cookie']).toBeUndefined();

      const login = mockHttp({ method: 'POST', body: { password: ENV.ADMIN_PASSWORD } });
      await h.login(login.req, login.res);
      expect(login.res.status$()).toBe(200);
      const setCookie = login.res.headers$()['Set-Cookie'];
      expect(setCookie).toContain('HttpOnly');
      expect(setCookie).toContain('SameSite=Strict');
      const token = tokenFromSetCookie(setCookie);
      const cookie = cookieFor(token);
      expect(table.size).toBe(1);

      const session = mockHttp({ method: 'GET', cookie });
      await h.session(session.req, session.res);
      expect(session.res.status$()).toBe(200);

      const manage = mockHttp({ method: 'GET', cookie, query: { resource: 'leads' } });
      await h.manage(manage.req, manage.res);
      expect(manage.res.status$()).toBe(200);

      const anon = mockHttp({ method: 'GET', query: { resource: 'leads' } });
      await h.manage(anon.req, anon.res);
      expect(anon.res.status$()).toBe(401);
      expect(anon.res.body$().code).toBe('UNAUTHORIZED');

      const out = mockHttp({ method: 'POST', cookie });
      await h.logout(out.req, out.res);
      expect(out.res.status$()).toBe(200);
      expect(out.res.headers$()['Set-Cookie']).toContain('Max-Age=0');

      const replay = mockHttp({ method: 'GET', cookie });
      await h.session(replay.req, replay.res);
      expect(replay.res.status$()).toBe(401);
      expect(replay.res.body$().code).toBe('SESSION_REVOKED');

      const replayManage = mockHttp({ method: 'GET', cookie, query: { resource: 'leads' } });
      await h.manage(replayManage.req, replayManage.res);
      expect(replayManage.res.status$()).toBe(401);
    });

    it('manage responses expose no answer keys, correctIndex, or lead data', async () => {
      const h = await loadHandlers();
      const login = mockHttp({ method: 'POST', body: { password: ENV.ADMIN_PASSWORD } });
      await h.login(login.req, login.res);
      const cookie = cookieFor(tokenFromSetCookie(login.res.headers$()['Set-Cookie']));
      const m = mockHttp({ method: 'GET', cookie, query: { resource: 'leads' } });
      await h.manage(m.req, m.res);
      const text = JSON.stringify(m.res.body$());
      expect(text).not.toContain('correctIndex');
      expect(text).not.toContain('email');
      expect(text).not.toContain('phone');
    });
  });
});

