// @vitest-environment node
import { describe, it, expect, beforeEach } from 'vitest';
import loginHandler from './login';
import logoutHandler from './logout';
import sessionHandler from './session';
import manageHandler from './manage';
import {
  ADMIN_SESSION_COOKIE_NAME,
  AdminAuthConfigError,
  createAdminSession,
  resetAdminAuthTestState,
  validateAdminAuthEnv,
  verifyAdminSessionToken,
} from '../_lib/auth';
import {
  classifyPostgrestRlsOutcome,
  runRlsPreflightCheck,
} from '../_lib/db';

const TEST_ADMIN_PASSWORD = 'QuizVibe_Admin_Strong_Pass_2026!';
const TEST_SESSION_SECRET = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';

function createMockHttp(options: {
  method: string;
  body?: unknown;
  cookie?: string;
  query?: Record<string, string>;
  ip?: string;
  proto?: string;
}) {
  const req = {
    method: options.method,
    body: options.body,
    query: options.query || {},
    headers: {
      ...(options.cookie ? { cookie: options.cookie } : {}),
      ...(options.ip ? { 'x-forwarded-for': options.ip } : {}),
      ...(options.proto ? { 'x-forwarded-proto': options.proto } : {}),
    },
    socket: {
      remoteAddress: options.ip || '127.0.0.1',
    },
  };

  let statusCode = 200;
  let jsonBody: any = null;
  const headers: Record<string, string> = {};

  const res = {
    setHeader(key: string, val: string) {
      headers[key] = val;
    },
    status(code: number) {
      statusCode = code;
      return res;
    },
    json(data: any) {
      jsonBody = data;
      return res;
    },
    end() {
      return res;
    },
    _getStatusCode: () => statusCode,
    _getJsonBody: () => jsonBody,
    _getHeaders: () => headers,
  };

  return { req, res };
}

function extractCookieTokenFromSetCookie(setCookieHeader?: string): string {
  if (!setCookieHeader) return '';
  const firstSegment = setCookieHeader.split(';')[0] || '';
  const eqIdx = firstSegment.indexOf('=');
  if (eqIdx < 0) return '';
  return decodeURIComponent(firstSegment.slice(eqIdx + 1));
}

describe('Phase 2: Server-Side Admin Authentication, Session Security & RLS Preflight', () => {
  beforeEach(() => {
    resetAdminAuthTestState();
    process.env.ADMIN_PASSWORD = TEST_ADMIN_PASSWORD;
    process.env.ADMIN_SESSION_SECRET = TEST_SESSION_SECRET;
    // Isolate from any real Supabase config loaded from .env.local by handler imports: memory mode only.
    delete process.env.SUPABASE_URL;
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    delete process.env.VITE_ADMIN_PASSWORD;
    delete process.env.VITE_ADMIN_SESSION_SECRET;
  });

  describe('1. RLS Preflight Verification & Outcome Classification', () => {
    it('distinguishes 401 auth failure, 403 permission/RLS denial, and 200 RLS-filtered empty results', () => {
      // 401 when API key is missing
      const missingKeyOutcome = classifyPostgrestRlsOutcome(
        401,
        { message: 'No API key found in request' },
        false
      );
      expect(missingKeyOutcome.classification).toBe('AUTH_FAILURE_401');
      expect(missingKeyOutcome.safe).toBe(true);

      // 401 when a supposedly valid anon key is rejected
      const invalidAnonKeyOutcome = classifyPostgrestRlsOutcome(
        401,
        { message: 'Invalid API key' },
        true
      );
      expect(invalidAnonKeyOutcome.classification).toBe('AUTH_FAILURE_401');
      expect(invalidAnonKeyOutcome.safe).toBe(false);

      // 403 or SQLSTATE 42501 permission/RLS denial
      const permissionDenied = classifyPostgrestRlsOutcome(
        403,
        { code: '42501', message: 'permission denied for table leads' },
        true
      );
      expect(permissionDenied.classification).toBe('PERMISSION_OR_RLS_DENIED_403');
      expect(permissionDenied.safe).toBe(true);

      // 200 with [] (RLS enabled with zero anon SELECT policies -> filtered to 0 rows)
      const rlsFilteredEmpty = classifyPostgrestRlsOutcome(200, [], true);
      expect(rlsFilteredEmpty.classification).toBe('RLS_FILTERED_EMPTY_200');
      expect(rlsFilteredEmpty.rowsReturned).toBe(0);
      expect(rlsFilteredEmpty.safe).toBe(true);

      // 200 with leaked rows -> flagged as unsafe
      const leakedOutcome = classifyPostgrestRlsOutcome(200, [{ id: 'leaked-row' }], true);
      expect(leakedOutcome.classification).toBe('UNEXPECTED_DATA_EXPOSURE_200');
      expect(leakedOutcome.safe).toBe(false);
    });

    it('runs preflight against all 5 tables using a valid anon key and confirms RLS-filtered empty results', async () => {
      const mockFetch = (async (_url: string, init?: RequestInit) => {
        const headers = (init?.headers || {}) as Record<string, string>;
        if (!headers.apikey) {
          return {
            status: 401,
            json: async () => ({ message: 'No API key found in request' }),
          } as Response;
        }
        return {
          status: 200,
          json: async () => [],
        } as Response;
      }) as unknown as typeof fetch;

      const report = await runRlsPreflightCheck({
        env: {
          SUPABASE_URL: 'https://jtqiudpkduczkahlfjhj.supabase.co',
          SUPABASE_ANON_KEY: 'sb_publishable_valid_anon_key_for_test',
        },
        fetchImpl: mockFetch,
      });

      expect(report.anonKeyConfigured).toBe(true);
      expect(report.migrationAnonOrPublicPolicyCount).toBe(0);
      expect(report.missingApiKeyGatewayTest?.classification).toBe('AUTH_FAILURE_401');
      expect(report.anonKeyReadProbes.campaigns.classification).toBe('RLS_FILTERED_EMPTY_200');
      expect(report.anonKeyReadProbes.leads.classification).toBe('RLS_FILTERED_EMPTY_200');
      expect(report.anonKeyReadProbes.leads.rowsReturned).toBe(0);
    });
  });

  describe('2. Admin Login Success, Failure & Rate Limiting (/api/admin/login)', () => {
    it('authenticates valid ADMIN_PASSWORD and sets an HttpOnly, SameSite=Strict, Secure session cookie', async () => {
      const { req, res } = createMockHttp({
        method: 'POST',
        body: { password: TEST_ADMIN_PASSWORD },
        proto: 'https',
      });

      await loginHandler(req, res);

      expect(res._getStatusCode()).toBe(200);
      expect(res._getJsonBody().ok).toBe(true);
      expect(res._getJsonBody().authenticated).toBe(true);

      const setCookie = res._getHeaders()['Set-Cookie'];
      expect(setCookie).toBeDefined();
      expect(setCookie).toContain(`${ADMIN_SESSION_COOKIE_NAME}=`);
      expect(setCookie).toContain('HttpOnly');
      expect(setCookie).toContain('SameSite=Strict');
      expect(setCookie).toContain('Secure');
    });

    it('rejects wrong password with HTTP 401 INVALID_CREDENTIALS and does not set a session cookie', async () => {
      const { req, res } = createMockHttp({
        method: 'POST',
        body: { password: 'wrong-password-123' },
      });

      await loginHandler(req, res);

      expect(res._getStatusCode()).toBe(401);
      expect(res._getJsonBody().ok).toBe(false);
      expect(res._getJsonBody().code).toBe('INVALID_CREDENTIALS');
      expect(res._getHeaders()['Set-Cookie']).toBeUndefined();
    });

    it('enforces login rate limiting (HTTP 429) after 5 consecutive failed attempts from the same IP', async () => {
      for (let i = 0; i < 5; i++) {
        const attempt = createMockHttp({
          method: 'POST',
          body: { password: `wrong-attempt-${i}` },
          ip: '203.0.113.55',
        });
        await loginHandler(attempt.req, attempt.res);
        expect(attempt.res._getStatusCode()).toBe(401);
      }

      // 6th attempt must be blocked with 429 Too Many Requests
      const blocked = createMockHttp({
        method: 'POST',
        body: { password: TEST_ADMIN_PASSWORD },
        ip: '203.0.113.55',
      });
      await loginHandler(blocked.req, blocked.res);

      expect(blocked.res._getStatusCode()).toBe(429);
      expect(blocked.res._getJsonBody().code).toBe('RATE_LIMITED');
      expect(blocked.res._getHeaders()['Retry-After']).toBeDefined();
    });

    it('rejects VITE_ADMIN_PASSWORD to prevent client-bundle secret exposure', () => {
      expect(() =>
        validateAdminAuthEnv({
          ADMIN_PASSWORD: TEST_ADMIN_PASSWORD,
          VITE_ADMIN_PASSWORD: TEST_ADMIN_PASSWORD,
        })
      ).toThrowError(AdminAuthConfigError);
    });
  });

  describe('3. Session Verification, Expiration, Logout & Server-Side Invalidation', () => {
    it('verifies an active session via GET /api/admin/session and invalidates it on POST /api/admin/logout', async () => {
      // 1. Login
      const loginCall = createMockHttp({
        method: 'POST',
        body: { password: TEST_ADMIN_PASSWORD },
      });
      await loginHandler(loginCall.req, loginCall.res);
      const setCookie = loginCall.res._getHeaders()['Set-Cookie'];
      const rawToken = extractCookieTokenFromSetCookie(setCookie);
      const cookieHeader = `${ADMIN_SESSION_COOKIE_NAME}=${encodeURIComponent(rawToken)}`;

      // 2. Verify session succeeds
      const verifyCall = createMockHttp({
        method: 'GET',
        cookie: cookieHeader,
      });
      await sessionHandler(verifyCall.req, verifyCall.res);
      expect(verifyCall.res._getStatusCode()).toBe(200);
      expect(verifyCall.res._getJsonBody().authenticated).toBe(true);

      // 3. Logout invalidates the server-side session
      const logoutCall = createMockHttp({
        method: 'POST',
        cookie: cookieHeader,
      });
      await logoutHandler(logoutCall.req, logoutCall.res);
      expect(logoutCall.res._getStatusCode()).toBe(200);
      expect(logoutCall.res._getHeaders()['Set-Cookie']).toContain('Max-Age=0');

      // 4. Replaying the old cookie after logout is rejected on the server with 401 SESSION_REVOKED
      const replaySessionCall = createMockHttp({
        method: 'GET',
        cookie: cookieHeader,
      });
      await sessionHandler(replaySessionCall.req, replaySessionCall.res);
      expect(replaySessionCall.res._getStatusCode()).toBe(401);
      expect(replaySessionCall.res._getJsonBody().code).toBe('SESSION_REVOKED');

      const replayManageCall = createMockHttp({
        method: 'GET',
        cookie: cookieHeader,
        query: { resource: 'leads' },
      });
      await manageHandler(replayManageCall.req, replayManageCall.res);
      expect(replayManageCall.res._getStatusCode()).toBe(401);
      expect(replayManageCall.res._getJsonBody().code).toBe('SESSION_REVOKED');
    });

    it('rejects expired or tampered session tokens', async () => {
      const baseTime = 1_700_000_000_000;
      const session = await createAdminSession({
        nowMs: baseTime,
        ttlSeconds: 60,
      });

      // Valid at baseTime + 30s
      const validCheck = await verifyAdminSessionToken(session.token, {
        nowMs: baseTime + 30_000,
      });
      expect(validCheck.authenticated).toBe(true);

      // Expired at baseTime + 61s
      const expiredCheck = await verifyAdminSessionToken(session.token, {
        nowMs: baseTime + 61_000,
      });
      expect(expiredCheck.authenticated).toBe(false);
      expect(expiredCheck.code).toBe('SESSION_EXPIRED');

      // Tampered signature
      const tamperedToken = session.token.slice(0, -4) + 'ffff';
      const tamperedCheck = await verifyAdminSessionToken(tamperedToken, {
        nowMs: baseTime + 10_000,
      });
      expect(tamperedCheck.authenticated).toBe(false);
      expect(tamperedCheck.code).toBe('UNAUTHORIZED');
    });
  });

  describe('4. Protected Admin API Authorization Boundaries (/api/admin/manage)', () => {
    it('blocks unauthenticated public users from calling protected management APIs or retrieving lead records', async () => {
      for (const resource of ['leads', 'campaigns', 'vouchers']) {
        const { req, res } = createMockHttp({
          method: 'GET',
          query: { resource },
        });
        await manageHandler(req, res);
        expect(res._getStatusCode()).toBe(401);
        expect(res._getJsonBody().ok).toBe(false);
        expect(res._getJsonBody().code).toBe('UNAUTHORIZED');
      }
    });

    it('allows authenticated Admin session to access protected management resources', async () => {
      const session = await createAdminSession();
      const cookieHeader = `${ADMIN_SESSION_COOKIE_NAME}=${encodeURIComponent(session.token)}`;

      const { req, res } = createMockHttp({
        method: 'GET',
        cookie: cookieHeader,
        query: { resource: 'leads' },
      });

      await manageHandler(req, res);
      expect(res._getStatusCode()).toBe(200);
      expect(res._getJsonBody().ok).toBe(true);
      expect(res._getJsonBody().authorized).toBe(true);
      expect(res._getJsonBody().resource).toBe('leads');
    });
  });
});

