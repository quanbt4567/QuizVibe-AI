import crypto from 'node:crypto';
import { assertServerRuntime } from '../db/config.js';
import { getSupabaseServerClient } from '../db/supabaseServer.js';

// Enforce server-only boundary at module load time
assertServerRuntime();

export const ADMIN_SESSION_COOKIE_NAME = 'qv_admin_session';
export const DEFAULT_SESSION_TTL_SECONDS = 8 * 60 * 60; // 8 hours
export const LOGIN_RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000; // 15 minutes
export const LOGIN_RATE_LIMIT_MAX_FAILURES = 5;
export const SESSION_DB_TIMEOUT_MS = 5000;
export const MIN_ADMIN_SESSION_SECRET_LENGTH = 32;

export type AdminAuthErrorCode =
  | 'ADMIN_AUTH_NOT_CONFIGURED'
  | 'CLIENT_EXPOSURE_DETECTED'
  | 'INVALID_CREDENTIALS'
  | 'UNAUTHORIZED'
  | 'SESSION_EXPIRED'
  | 'SESSION_REVOKED'
  | 'RATE_LIMITED'
  | 'SESSION_STORE_UNAVAILABLE';

export class AdminAuthConfigError extends Error {
  public readonly code: AdminAuthErrorCode;

  constructor(code: AdminAuthErrorCode, message: string) {
    super(message);
    this.name = 'AdminAuthConfigError';
    this.code = code;
  }
}

interface ServerSessionRecord {
  tokenHash: string;
  createdAtMs: number;
  expiresAtMs: number;
  revokedAtMs: number | null;
}

interface RateLimitBucket {
  failures: number[];
}

// Process-local session registry. Used ONLY in local-development memory mode (Supabase fully unset).
// When Supabase is configured, `public.admin_sessions` is the sole source of truth.
const serverSessions = new Map<string, ServerSessionRecord>();
const loginRateLimitBuckets = new Map<string, RateLimitBucket>();

/**
 * Loads `.env.local` or `.env` in local Node.js 20+ environments if not already loaded.
 */
export function ensureServerEnvLoaded(): void {
  if (typeof process.loadEnvFile === 'function') {
    try {
      process.loadEnvFile('.env.local');
    } catch {
      try {
        process.loadEnvFile('.env');
      } catch {
        // Ignored in cloud environments where process.env is injected directly
      }
    }
  }
}

/**
 * Rejects missing, short, low-variety, placeholder-like, or derived session secrets.
 * Never logs or returns the secret.
 */
function isAcceptableSessionSecret(
  secret: string,
  adminPassword: string,
  serviceRoleKey: string
): boolean {
  if (secret.length < MIN_ADMIN_SESSION_SECRET_LENGTH) return false;
  if (new Set(secret).size < 10) return false;
  const lowered = secret.toLowerCase();
  if (/(changeme|change-me|change_me|placeholder|example|your[-_]|replace[-_]?me|password)/.test(lowered)) {
    return false;
  }
  if (secret === adminPassword || secret.includes(adminPassword)) return false;
  if (serviceRoleKey && secret === serviceRoleKey) return false;
  return true;
}

/**
 * Validates required server-side Admin authentication environment variables.
 * - Rejects any `VITE_ADMIN_*` variables to prevent accidental client-bundle exposure.
 * - Never hardcodes credentials in source code.
 */
export function validateAdminAuthEnv(
  env: Record<string, string | undefined> = process.env
): {
  adminPassword: string;
  signingSecret: string;
} {
  assertServerRuntime();

  if (
    (typeof env.VITE_ADMIN_PASSWORD === 'string' && env.VITE_ADMIN_PASSWORD.trim() !== '') ||
    (typeof env.VITE_ADMIN_SESSION_SECRET === 'string' &&
      env.VITE_ADMIN_SESSION_SECRET.trim() !== '')
  ) {
    throw new AdminAuthConfigError(
      'CLIENT_EXPOSURE_DETECTED',
      'SECURITY_VIOLATION: Admin authentication secrets must never use the VITE_ prefix.'
    );
  }

  const adminPassword =
    typeof env.ADMIN_PASSWORD === 'string' ? env.ADMIN_PASSWORD.trim() : '';

  if (!adminPassword || adminPassword.length < 8) {
    throw new AdminAuthConfigError(
      'ADMIN_AUTH_NOT_CONFIGURED',
      'Server-side ADMIN_PASSWORD is not configured (or is shorter than 8 characters). Set ADMIN_PASSWORD in .env.local or Vercel Environment Variables.'
    );
  }

  const signingSecret = typeof env.ADMIN_SESSION_SECRET === 'string' ? env.ADMIN_SESSION_SECRET.trim() : '';
  const serviceRoleKey =
    typeof env.SUPABASE_SERVICE_ROLE_KEY === 'string' ? env.SUPABASE_SERVICE_ROLE_KEY.trim() : '';

  if (!isAcceptableSessionSecret(signingSecret, adminPassword, serviceRoleKey)) {
    throw new AdminAuthConfigError(
      'ADMIN_AUTH_NOT_CONFIGURED',
      'ADMIN_SESSION_SECRET is missing or too weak. Configure an independent random secret of at least ' +
        MIN_ADMIN_SESSION_SECRET_LENGTH +
        ' characters (for example: openssl rand -hex 32).'
    );
  }

  return {
    adminPassword,
    signingSecret,
  };
}

/**
 * Performs a constant-time comparison of the submitted password against `ADMIN_PASSWORD`.
 */
export function verifyAdminPassword(
  candidatePassword: unknown,
  env: Record<string, string | undefined> = process.env
): boolean {
  assertServerRuntime();
  if (typeof candidatePassword !== 'string' || candidatePassword.trim() === '') {
    return false;
  }

  const { adminPassword } = validateAdminAuthEnv(env);
  const candidateDigest = crypto
    .createHash('sha256')
    .update(candidatePassword, 'utf8')
    .digest();
  const expectedDigest = crypto
    .createHash('sha256')
    .update(adminPassword, 'utf8')
    .digest();

  return crypto.timingSafeEqual(candidateDigest, expectedDigest);
}

/**
 * Computes the SHA-256 hex digest of a raw session token for safe storage.
 */
export function hashSessionToken(rawToken: string): string {
  return crypto.createHash('sha256').update(rawToken, 'utf8').digest('hex');
}

/**
 * Serializes an HttpOnly, SameSite=Strict session cookie header.
 */
export function serializeSessionCookie(
  value: string,
  maxAgeSeconds: number,
  isSecureContext: boolean
): string {
  const parts = [
    `${ADMIN_SESSION_COOKIE_NAME}=${encodeURIComponent(value)}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Strict',
    `Max-Age=${Math.max(0, Math.floor(maxAgeSeconds))}`,
  ];
  if (isSecureContext) {
    parts.push('Secure');
  }
  return parts.join('; ');
}

/**
 * Determines whether the incoming request is running in production or over HTTPS.
 */
export function isRequestSecure(
  req?: { headers?: Record<string, string | string[] | undefined> },
  env: Record<string, string | undefined> = process.env
): boolean {
  if (env.NODE_ENV === 'production' || env.VERCEL_ENV === 'production') {
    return true;
  }
  const protoHeader = req?.headers?.['x-forwarded-proto'];
  const proto = Array.isArray(protoHeader) ? protoHeader[0] : protoHeader;
  return proto === 'https';
}

/**
 * Parses the `Cookie` request header into a key-value map.
 */
export function parseCookiesHeader(cookieHeader?: string | string[]): Record<string, string> {
  const raw = Array.isArray(cookieHeader) ? cookieHeader.join('; ') : cookieHeader || '';
  const result: Record<string, string> = {};
  if (!raw) return result;

  for (const pair of raw.split(';')) {
    const eqIdx = pair.indexOf('=');
    if (eqIdx <= 0) continue;
    const key = pair.slice(0, eqIdx).trim();
    const val = pair.slice(eqIdx + 1).trim();
    if (!key) continue;
    try {
      result[key] = decodeURIComponent(val);
    } catch {
      result[key] = val;
    }
  }
  return result;
}

export type AdminSessionStoreMode = 'database' | 'memory';

const SESSION_STORE_UNAVAILABLE_MESSAGE =
  'The Admin session store is unavailable. Authentication is refused (fail-closed).';

/**
 * Decides where Admin session state is authoritative.
 * - Supabase configured (URL + service-role key): the `public.admin_sessions` table is the ONLY source of truth.
 * - Supabase completely unset AND not production/Vercel: process-local memory (local development only).
 * - Anything else (partial config, or production without Supabase): fail closed.
 */
export function resolveAdminSessionStoreMode(
  env: Record<string, string | undefined> = process.env
): AdminSessionStoreMode {
  const url = typeof env.SUPABASE_URL === 'string' ? env.SUPABASE_URL.trim() : '';
  const key =
    typeof env.SUPABASE_SERVICE_ROLE_KEY === 'string' ? env.SUPABASE_SERVICE_ROLE_KEY.trim() : '';

  if (url && key) return 'database';

  const productionLike =
    env.NODE_ENV === 'production' || Boolean(env.VERCEL) || Boolean(env.VERCEL_ENV);
  if (!url && !key && !productionLike) return 'memory';

  throw new AdminAuthConfigError('SESSION_STORE_UNAVAILABLE', SESSION_STORE_UNAVAILABLE_MESSAGE);
}

/**
 * Maps a failed verification code to an HTTP status.
 * Infrastructure/configuration failures are 503 (still fail-closed); everything else is 401.
 */
export function adminAuthFailureStatus(code: AdminAuthErrorCode | undefined): number {
  return code === 'SESSION_STORE_UNAVAILABLE' ||
    code === 'ADMIN_AUTH_NOT_CONFIGURED' ||
    code === 'CLIENT_EXPOSURE_DETECTED'
    ? 503
    : 401;
}

/**
 * Bounds a database call. Rejects on timeout and aborts the underlying request.
 */
async function withDbTimeout<T>(
  run: (signal: AbortSignal) => PromiseLike<T>,
  timeoutMs: number = SESSION_DB_TIMEOUT_MS
): Promise<T> {
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      controller.abort();
      reject(new Error('SESSION_DB_TIMEOUT'));
    }, timeoutMs);
  });
  try {
    return await Promise.race([Promise.resolve(run(controller.signal)), timeout]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

/**
 * Persists a session record. Throws `SESSION_STORE_UNAVAILABLE` on any failure (no details leaked).
 */
async function persistSessionToDatabase(
  record: ServerSessionRecord,
  env: Record<string, string | undefined>,
  timeoutMs?: number
): Promise<void> {
  try {
    const supabase = getSupabaseServerClient(env);
    const { error } = await withDbTimeout(
      (signal) =>
        supabase
          .from('admin_sessions')
          .upsert(
            {
              token_hash: record.tokenHash,
              created_at: new Date(record.createdAtMs).toISOString(),
              expires_at: new Date(record.expiresAtMs).toISOString(),
              revoked_at: null,
              last_seen_at: new Date().toISOString(),
            },
            { onConflict: 'token_hash' }
          )
          .abortSignal(signal),
      timeoutMs
    );
    if (error) throw new Error('SESSION_DB_WRITE_FAILED');
  } catch {
    throw new AdminAuthConfigError('SESSION_STORE_UNAVAILABLE', SESSION_STORE_UNAVAILABLE_MESSAGE);
  }
}

/**
 * Creates a new authenticated Admin session and returns the signed token and Set-Cookie header.
 * When Supabase is configured the record is persisted (awaited) BEFORE a cookie is produced;
 * if persistence fails this throws and no cookie is ever issued.
 */
export async function createAdminSession(options?: {
  env?: Record<string, string | undefined>;
  ttlSeconds?: number;
  nowMs?: number;
  isSecure?: boolean;
  dbTimeoutMs?: number;
}): Promise<{
  token: string;
  tokenHash: string;
  expiresAt: string;
  cookieHeader: string;
}> {
  assertServerRuntime();
  const env = options?.env ?? process.env;
  const { signingSecret } = validateAdminAuthEnv(env);
  const mode = resolveAdminSessionStoreMode(env);

  const nowMs = options?.nowMs ?? Date.now();
  const ttlSeconds = options?.ttlSeconds ?? DEFAULT_SESSION_TTL_SECONDS;
  const expiresAtMs = nowMs + ttlSeconds * 1000;

  const nonceHex = crypto.randomBytes(32).toString('hex');
  const payload = `${nonceHex}.${expiresAtMs}`;
  const signatureHex = crypto
    .createHmac('sha256', signingSecret)
    .update(payload, 'utf8')
    .digest('hex');

  const token = `${payload}.${signatureHex}`;
  const tokenHash = hashSessionToken(token);

  const record: ServerSessionRecord = {
    tokenHash,
    createdAtMs: nowMs,
    expiresAtMs,
    revokedAtMs: null,
  };

  if (mode === 'database') {
    await persistSessionToDatabase(record, env, options?.dbTimeoutMs);
  } else {
    serverSessions.set(tokenHash, record);
  }

  const isSecure = options?.isSecure ?? env.NODE_ENV === 'production';
  const cookieHeader = serializeSessionCookie(token, ttlSeconds, isSecure);

  return {
    token,
    tokenHash,
    expiresAt: new Date(expiresAtMs).toISOString(),
    cookieHeader,
  };
}

/**
 * Independently verifies an Admin session token on the server.
 * Order: config -> token shape -> HMAC -> signed expiry -> authoritative store.
 * A valid signature alone never authenticates; any store failure is fail-closed.
 */
export async function verifyAdminSessionToken(
  rawToken: string | undefined | null,
  options?: {
    env?: Record<string, string | undefined>;
    nowMs?: number;
    dbTimeoutMs?: number;
  }
): Promise<{
  authenticated: boolean;
  code?: AdminAuthErrorCode;
  expiresAt?: string;
  tokenHash?: string;
}> {
  assertServerRuntime();
  if (!rawToken || typeof rawToken !== 'string') {
    return { authenticated: false, code: 'UNAUTHORIZED' };
  }

  const env = options?.env ?? process.env;
  let signingSecret: string;
  try {
    signingSecret = validateAdminAuthEnv(env).signingSecret;
  } catch (err) {
    const authErr = err as AdminAuthConfigError;
    return {
      authenticated: false,
      code: authErr.code || 'ADMIN_AUTH_NOT_CONFIGURED',
    };
  }

  const parts = rawToken.split('.');
  if (parts.length !== 3) {
    return { authenticated: false, code: 'UNAUTHORIZED' };
  }

  const [nonceHex, expStr, providedSigHex] = parts;
  if (!nonceHex || !/^[0-9a-f]{64}$/.test(nonceHex) || !/^[0-9a-f]{64}$/.test(providedSigHex)) {
    return { authenticated: false, code: 'UNAUTHORIZED' };
  }

  const expiresAtMs = Number(expStr);
  if (!Number.isFinite(expiresAtMs) || expiresAtMs <= 0) {
    return { authenticated: false, code: 'UNAUTHORIZED' };
  }

  const payload = `${nonceHex}.${expStr}`;
  const expectedSigHex = crypto
    .createHmac('sha256', signingSecret)
    .update(payload, 'utf8')
    .digest('hex');

  const providedBuf = Buffer.from(providedSigHex, 'hex');
  const expectedBuf = Buffer.from(expectedSigHex, 'hex');
  if (
    providedBuf.length !== expectedBuf.length ||
    !crypto.timingSafeEqual(providedBuf, expectedBuf)
  ) {
    return { authenticated: false, code: 'UNAUTHORIZED' };
  }

  const nowMs = options?.nowMs ?? Date.now();
  if (nowMs >= expiresAtMs) {
    return { authenticated: false, code: 'SESSION_EXPIRED' };
  }

  const tokenHash = hashSessionToken(rawToken);

  let mode: AdminSessionStoreMode;
  try {
    mode = resolveAdminSessionStoreMode(env);
  } catch {
    return { authenticated: false, code: 'SESSION_STORE_UNAVAILABLE' };
  }

  if (mode === 'memory') {
    // Local development only (Supabase fully unset, non-production).
    const rec = serverSessions.get(tokenHash);
    if (!rec) return { authenticated: false, code: 'UNAUTHORIZED' };
    if (rec.revokedAtMs !== null) return { authenticated: false, code: 'SESSION_REVOKED' };
    if (nowMs >= rec.expiresAtMs) return { authenticated: false, code: 'SESSION_EXPIRED' };
    return {
      authenticated: true,
      expiresAt: new Date(rec.expiresAtMs).toISOString(),
      tokenHash,
    };
  }

  // Authoritative database check on EVERY request (no memory shortcut, no cache).
  let row: { expires_at: string; revoked_at: string | null } | null;
  try {
    const supabase = getSupabaseServerClient(env);
    const { data, error } = await withDbTimeout(
      (signal) =>
        supabase
          .from('admin_sessions')
          .select('token_hash, expires_at, revoked_at')
          .eq('token_hash', tokenHash)
          .abortSignal(signal)
          .maybeSingle(),
      options?.dbTimeoutMs
    );
    if (error) {
      return { authenticated: false, code: 'SESSION_STORE_UNAVAILABLE' };
    }
    row = data ?? null;
  } catch {
    return { authenticated: false, code: 'SESSION_STORE_UNAVAILABLE' };
  }

  if (!row) return { authenticated: false, code: 'UNAUTHORIZED' };
  if (row.revoked_at !== null && row.revoked_at !== undefined) {
    return { authenticated: false, code: 'SESSION_REVOKED' };
  }
  const dbExpiresAtMs = new Date(row.expires_at).getTime();
  if (!Number.isFinite(dbExpiresAtMs) || dbExpiresAtMs <= nowMs) {
    return { authenticated: false, code: 'SESSION_EXPIRED' };
  }

  return {
    authenticated: true,
    expiresAt: new Date(Math.min(expiresAtMs, dbExpiresAtMs)).toISOString(),
    tokenHash,
  };
}

/**
 * Verifies the Admin session directly from an incoming HTTP request (`req.headers.cookie`).
 */
export async function verifyAdminRequest(
  req: { headers?: Record<string, string | string[] | undefined> } | null | undefined,
  options?: {
    env?: Record<string, string | undefined>;
    nowMs?: number;
    dbTimeoutMs?: number;
  }
): Promise<{
  authenticated: boolean;
  code?: AdminAuthErrorCode;
  expiresAt?: string;
  tokenHash?: string;
}> {
  assertServerRuntime();
  const cookies = parseCookiesHeader(req?.headers?.cookie);
  const rawToken = cookies[ADMIN_SESSION_COOKIE_NAME];
  return verifyAdminSessionToken(rawToken, options);
}

/**
 * Revokes the Admin session on the server.
 * - Database mode: a narrow UPDATE of `revoked_at` only (created_at / expires_at untouched).
 * - `completed` is true only when revocation is known to have succeeded (or there was nothing to revoke).
 * - On failure `completed` is false and `clearCookieHeader` MUST NOT be sent: the browser keeps
 *   the cookie so the user is not told they are logged out while the server session is still live.
 */
export async function revokeAdminSessionFromRequest(
  req: { headers?: Record<string, string | string[] | undefined> } | null | undefined,
  options?: {
    env?: Record<string, string | undefined>;
    nowMs?: number;
    dbTimeoutMs?: number;
  }
): Promise<{
  revoked: boolean;
  completed: boolean;
  clearCookieHeader: string;
}> {
  assertServerRuntime();
  const env = options?.env ?? process.env;
  const nowMs = options?.nowMs ?? Date.now();
  const cookies = parseCookiesHeader(req?.headers?.cookie);
  const rawToken = cookies[ADMIN_SESSION_COOKIE_NAME];
  const clearCookieHeader = serializeSessionCookie('', 0, isRequestSecure(req ?? undefined, env));

  if (!rawToken) {
    return { revoked: false, completed: true, clearCookieHeader };
  }

  const tokenHash = hashSessionToken(rawToken);

  let mode: AdminSessionStoreMode;
  try {
    mode = resolveAdminSessionStoreMode(env);
  } catch {
    return { revoked: false, completed: false, clearCookieHeader };
  }

  if (mode === 'memory') {
    const existing = serverSessions.get(tokenHash);
    if (existing) {
      serverSessions.set(tokenHash, { ...existing, revokedAtMs: nowMs });
    }
    return { revoked: true, completed: true, clearCookieHeader };
  }

  try {
    const supabase = getSupabaseServerClient(env);
    const { error } = await withDbTimeout(
      (signal) =>
        supabase
          .from('admin_sessions')
          .update({ revoked_at: new Date(nowMs).toISOString() })
          .eq('token_hash', tokenHash)
          .is('revoked_at', null)
          .select('token_hash')
          .abortSignal(signal),
      options?.dbTimeoutMs
    );
    if (error) {
      return { revoked: false, completed: false, clearCookieHeader };
    }
  } catch {
    return { revoked: false, completed: false, clearCookieHeader };
  }

  return { revoked: true, completed: true, clearCookieHeader };
}

/**
 * Extracts a client rate-limit identifier from request headers or socket.
 */
export function getClientRateLimitKey(req?: {
  headers?: Record<string, string | string[] | undefined>;
  socket?: { remoteAddress?: string };
}): string {
  const forwarded = req?.headers?.['x-forwarded-for'];
  const firstIp = Array.isArray(forwarded)
    ? forwarded[0]
    : typeof forwarded === 'string'
    ? forwarded.split(',')[0]
    : undefined;
  return (firstIp || req?.socket?.remoteAddress || 'local-client').trim();
}

/**
 * Checks whether a client key is currently rate-limited for login attempts.
 */
export function checkLoginRateLimit(
  clientKey: string,
  nowMs: number = Date.now()
): {
  allowed: boolean;
  retryAfterSeconds: number;
  remainingAttempts: number;
} {
  const bucket = loginRateLimitBuckets.get(clientKey);
  if (!bucket) {
    return {
      allowed: true,
      retryAfterSeconds: 0,
      remainingAttempts: LOGIN_RATE_LIMIT_MAX_FAILURES,
    };
  }

  const cutoff = nowMs - LOGIN_RATE_LIMIT_WINDOW_MS;
  bucket.failures = bucket.failures.filter((ts) => ts > cutoff);

  if (bucket.failures.length >= LOGIN_RATE_LIMIT_MAX_FAILURES) {
    const oldestInWindow = bucket.failures[0];
    const retryAfterMs = Math.max(1000, oldestInWindow + LOGIN_RATE_LIMIT_WINDOW_MS - nowMs);
    return {
      allowed: false,
      retryAfterSeconds: Math.ceil(retryAfterMs / 1000),
      remainingAttempts: 0,
    };
  }

  return {
    allowed: true,
    retryAfterSeconds: 0,
    remainingAttempts: LOGIN_RATE_LIMIT_MAX_FAILURES - bucket.failures.length,
  };
}

/**
 * Records a failed login attempt for the given client key.
 */
export function recordFailedLoginAttempt(clientKey: string, nowMs: number = Date.now()): void {
  const cutoff = nowMs - LOGIN_RATE_LIMIT_WINDOW_MS;
  const existing = loginRateLimitBuckets.get(clientKey);
  const pruned = existing ? existing.failures.filter((ts) => ts > cutoff) : [];
  pruned.push(nowMs);
  loginRateLimitBuckets.set(clientKey, { failures: pruned });
}

/**
 * Clears failed login attempts upon successful authentication.
 */
export function clearLoginRateLimit(clientKey: string): void {
  loginRateLimitBuckets.delete(clientKey);
}

/**
 * Resets all in-memory session and rate-limit stores (for unit testing).
 */
export function resetAdminAuthTestState(): void {
  serverSessions.clear();
  loginRateLimitBuckets.clear();
}

