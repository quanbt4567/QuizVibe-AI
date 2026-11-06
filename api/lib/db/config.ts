/**
 * Server-Side Supabase Configuration & Runtime Boundary Guard
 * Ensures database credentials and client initialization occur strictly on the server.
 */

export type SupabaseConfigErrorCode =
  | 'SERVER_ONLY_VIOLATION'
  | 'SUPABASE_CONFIG_MISSING'
  | 'SUPABASE_CONFIG_INVALID'
  | 'CLIENT_EXPOSURE_DETECTED';

export class ServerOnlyModuleError extends Error {
  public readonly code: SupabaseConfigErrorCode = 'SERVER_ONLY_VIOLATION';

  constructor(
    message = 'SECURITY_VIOLATION: Server-side database module (api/lib/db) cannot be imported or executed in a browser environment.'
  ) {
    super(message);
    this.name = 'ServerOnlyModuleError';
  }
}

export class SupabaseConfigError extends Error {
  public readonly code: SupabaseConfigErrorCode;
  public readonly missingVars: string[];

  constructor(
    code: SupabaseConfigErrorCode,
    message: string,
    missingVars: string[] = []
  ) {
    super(message);
    this.name = 'SupabaseConfigError';
    this.code = code;
    this.missingVars = missingVars;
  }
}

export interface ValidatedSupabaseServerConfig {
  supabaseUrl: string;
  serviceRoleKey: string;
}

/**
 * Verifies that execution is taking place inside a server-side runtime (Node.js / Vercel Serverless)
 * and NOT inside a browser DOM context (`window` defined).
 */
export function assertServerRuntime(globalScope: Record<string, unknown> = globalThis as Record<string, unknown>): void {
  if (typeof globalScope.window !== 'undefined') {
    throw new ServerOnlyModuleError();
  }
}

/**
 * Validates required server-side Supabase environment variables.
 * - Fails clearly with `SupabaseConfigError` if `SUPABASE_URL` or `SUPABASE_SERVICE_ROLE_KEY` is missing or invalid.
 * - Rejects `VITE_SUPABASE_SERVICE_ROLE_KEY` if present to prevent accidental client-bundle exposure.
 * - Never falls back to browser localStorage.
 */
export function validateSupabaseServerEnv(
  env: Record<string, string | undefined> = process.env
): ValidatedSupabaseServerConfig {
  assertServerRuntime();

  // Guard against accidental VITE_ prefixing of the privileged service-role key
  const exposedKey = env.VITE_SUPABASE_SERVICE_ROLE_KEY;
  if (typeof exposedKey === 'string' && exposedKey.trim() !== '') {
    throw new SupabaseConfigError(
      'CLIENT_EXPOSURE_DETECTED',
      'SECURITY_VIOLATION: VITE_SUPABASE_SERVICE_ROLE_KEY must never be defined. Use server-only SUPABASE_SERVICE_ROLE_KEY without the VITE_ prefix.'
    );
  }

  const rawUrl = typeof env.SUPABASE_URL === 'string' ? env.SUPABASE_URL.trim() : '';
  const rawServiceKey =
    typeof env.SUPABASE_SERVICE_ROLE_KEY === 'string'
      ? env.SUPABASE_SERVICE_ROLE_KEY.trim()
      : '';

  const missingVars: string[] = [];
  if (!rawUrl) {
    missingVars.push('SUPABASE_URL');
  }
  if (!rawServiceKey) {
    missingVars.push('SUPABASE_SERVICE_ROLE_KEY');
  }

  if (missingVars.length > 0) {
    throw new SupabaseConfigError(
      'SUPABASE_CONFIG_MISSING',
      `Missing required server-side Supabase environment variable(s): ${missingVars.join(', ')}. Configure them in .env.local (local dev) or Vercel Project Settings (production).`,
      missingVars
    );
  }

  // Validate URL format (https://<project>.supabase.co or local CLI http://localhost / http://127.0.0.1)
  let parsedUrl: URL;
  try {
    parsedUrl = new URL(rawUrl);
  } catch {
    throw new SupabaseConfigError(
      'SUPABASE_CONFIG_INVALID',
      `Invalid SUPABASE_URL "${rawUrl}": must be a valid URL (e.g., https://<project-ref>.supabase.co).`
    );
  }

  const isHttps = parsedUrl.protocol === 'https:';
  const isLocalDevHttp =
    parsedUrl.protocol === 'http:' &&
    (parsedUrl.hostname === 'localhost' || parsedUrl.hostname === '127.0.0.1');

  if (!isHttps && !isLocalDevHttp) {
    throw new SupabaseConfigError(
      'SUPABASE_CONFIG_INVALID',
      `Invalid SUPABASE_URL protocol "${parsedUrl.protocol}": must use https:// (or http://localhost for local Supabase CLI).`
    );
  }

  // Reject placeholder or obviously malformed service role keys
  if (
    rawServiceKey.length < 20 ||
    rawServiceKey.includes('your-service-role-key') ||
    rawServiceKey.includes('<')
  ) {
    throw new SupabaseConfigError(
      'SUPABASE_CONFIG_INVALID',
      'Invalid SUPABASE_SERVICE_ROLE_KEY: key appears to be a placeholder or too short.'
    );
  }

  return {
    supabaseUrl: rawUrl.replace(/\/+$/, ''),
    serviceRoleKey: rawServiceKey,
  };
}

