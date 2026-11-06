import fs from 'node:fs';
import path from 'node:path';
import { assertServerRuntime } from './config';

assertServerRuntime();

export type RlsProbeOutcomeClassification =
  | 'AUTH_FAILURE_401'
  | 'PERMISSION_OR_RLS_DENIED_403'
  | 'RLS_FILTERED_EMPTY_200'
  | 'UNEXPECTED_DATA_EXPOSURE_200'
  | 'OTHER_ERROR';

export interface TableRlsProbeResult {
  table: string;
  httpStatus: number;
  classification: RlsProbeOutcomeClassification;
  rowsReturned: number | null;
  safe: boolean;
  detail: string;
}

export interface RlsPreflightReport {
  migrationRlsEnabledOnAllFive: Record<string, boolean>;
  migrationAnonOrPublicPolicyCount: number;
  anonKeyConfigured: boolean;
  missingApiKeyGatewayTest: {
    httpStatus: number;
    classification: RlsProbeOutcomeClassification;
  } | null;
  anonKeyReadProbes: Record<string, TableRlsProbeResult>;
}

export const PHASE1_TABLES = [
  'campaigns',
  'campaign_questions',
  'vouchers',
  'quiz_sessions',
  'leads',
  'admin_sessions',
] as const;

/**
 * Distinguishes:
 * 1. Authentication failure (401) — missing or invalid API key at gateway
 * 2. Permission / RLS denial (403, or 401 with PostgreSQL code 42501)
 * 3. RLS-filtered empty result (200 with zero rows `[]`)
 * 4. Unexpected data exposure (200 with >= 1 rows returned to anon role)
 */
export function classifyPostgrestRlsOutcome(
  httpStatus: number,
  parsedBody: unknown,
  usedValidAnonKey: boolean
): {
  classification: RlsProbeOutcomeClassification;
  rowsReturned: number | null;
  safe: boolean;
  detail: string;
} {
  if (httpStatus === 401) {
    const bodyObj =
      parsedBody && typeof parsedBody === 'object'
        ? (parsedBody as Record<string, unknown>)
        : {};
    if (bodyObj.code === '42501') {
      return {
        classification: 'PERMISSION_OR_RLS_DENIED_403',
        rowsReturned: null,
        safe: true,
        detail: 'PostgreSQL permission/RLS denied (SQLSTATE 42501).',
      };
    }
    return {
      classification: 'AUTH_FAILURE_401',
      rowsReturned: null,
      safe: !usedValidAnonKey,
      detail: usedValidAnonKey
        ? 'Provided SUPABASE_ANON_KEY was rejected with 401 (invalid/expired anon key).'
        : 'Gateway authentication failure (401): request missing valid API key.',
    };
  }

  if (httpStatus === 403) {
    return {
      classification: 'PERMISSION_OR_RLS_DENIED_403',
      rowsReturned: null,
      safe: true,
      detail: 'Permission or RLS policy denied access (HTTP 403).',
    };
  }

  if (httpStatus === 200 && Array.isArray(parsedBody)) {
    if (parsedBody.length === 0) {
      return {
        classification: 'RLS_FILTERED_EMPTY_200',
        rowsReturned: 0,
        safe: true,
        detail: 'RLS active with default-deny (HTTP 200 with 0 rows returned to anon role).',
      };
    }
    return {
      classification: 'UNEXPECTED_DATA_EXPOSURE_200',
      rowsReturned: parsedBody.length,
      safe: false,
      detail: `SECURITY WARNING: Anon role received ${parsedBody.length} row(s) (HTTP 200).`,
    };
  }

  return {
    classification: 'OTHER_ERROR',
    rowsReturned: null,
    safe: false,
    detail: `Unexpected HTTP status ${httpStatus}.`,
  };
}

/**
 * Inspects the Phase 1 SQL migration file and (when a valid `SUPABASE_ANON_KEY` or
 * `SUPABASE_PUBLISHABLE_KEY` is provided) executes live REST probes as the `anon` role.
 */
export async function runRlsPreflightCheck(options?: {
  env?: Record<string, string | undefined>;
  fetchImpl?: typeof fetch;
  migrationFilePath?: string;
}): Promise<RlsPreflightReport> {
  assertServerRuntime();
  const env = options?.env ?? process.env;
  const fetchFn = options?.fetchImpl ?? fetch;
  const migrationPath =
    options?.migrationFilePath ??
    path.resolve(process.cwd(), 'supabase/migrations/20261105000001_initial_quizvibe_schema.sql');

  const adminMigrationPath = path.resolve(
    path.dirname(migrationPath),
    '20261105000002_admin_sessions.sql'
  );
  const migrationSql =
    (fs.existsSync(migrationPath) ? fs.readFileSync(migrationPath, 'utf8') : '') +
    '\n' +
    (fs.existsSync(adminMigrationPath) ? fs.readFileSync(adminMigrationPath, 'utf8') : '');

  const migrationRlsEnabledOnAllFive: Record<string, boolean> = {};
  for (const table of PHASE1_TABLES) {
    migrationRlsEnabledOnAllFive[table] = new RegExp(
      `ALTER\\s+TABLE\\s+public\\.${table}\\s+ENABLE\\s+ROW\\s+LEVEL\\s+SECURITY`,
      'i'
    ).test(migrationSql);
  }

  const policyMatches = migrationSql.match(/CREATE\s+POLICY/gi);
  const migrationAnonOrPublicPolicyCount = policyMatches ? policyMatches.length : 0;

  const supabaseUrl = (env.SUPABASE_URL || '').trim().replace(/\/+$/, '');
  const anonKey = (
    env.SUPABASE_ANON_KEY ||
    env.SUPABASE_PUBLISHABLE_KEY ||
    ''
  ).trim();

  const report: RlsPreflightReport = {
    migrationRlsEnabledOnAllFive,
    migrationAnonOrPublicPolicyCount,
    anonKeyConfigured: anonKey.length > 0,
    missingApiKeyGatewayTest: null,
    anonKeyReadProbes: {},
  };

  if (!supabaseUrl) {
    return report;
  }

  // 1. Control check: Missing API key -> must be classified as 401 AUTH_FAILURE_401 (not RLS)
  try {
    const resNoKey = await fetchFn(`${supabaseUrl}/rest/v1/campaigns?select=id&limit=1`);
    let bodyNoKey: unknown = null;
    try {
      bodyNoKey = await resNoKey.json();
    } catch {
      bodyNoKey = null;
    }
    const classified = classifyPostgrestRlsOutcome(resNoKey.status, bodyNoKey, false);
    report.missingApiKeyGatewayTest = {
      httpStatus: resNoKey.status,
      classification: classified.classification,
    };
  } catch {
    report.missingApiKeyGatewayTest = null;
  }

  // 2. Live Anon/Publishable Key check against all 5 tables (if configured)
  if (anonKey.length > 0) {
    for (const table of PHASE1_TABLES) {
      const headers: Record<string, string> = {
        apikey: anonKey,
      };
      if (anonKey.startsWith('eyJ')) {
        headers['Authorization'] = `Bearer ${anonKey}`;
      }

      const res = await fetchFn(`${supabaseUrl}/rest/v1/${table}?select=id&limit=1`, {
        method: 'GET',
        headers,
      });

      let parsedBody: unknown = null;
      try {
        parsedBody = await res.json();
      } catch {
        parsedBody = null;
      }

      const outcome = classifyPostgrestRlsOutcome(res.status, parsedBody, true);
      report.anonKeyReadProbes[table] = {
        table,
        httpStatus: res.status,
        classification: outcome.classification,
        rowsReturned: outcome.rowsReturned,
        safe: outcome.safe,
        detail: outcome.detail,
      };
    }
  }

  return report;
}

