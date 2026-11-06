import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { Database } from './types.js';
import { assertServerRuntime, validateSupabaseServerEnv } from './config.js';

// Enforce server-only boundary at module load time
assertServerRuntime();

let cachedServerClient: SupabaseClient<Database> | null = null;
let cachedConfigUrl: string | null = null;

/**
 * Creates a fresh server-side Supabase client authenticated with `SUPABASE_SERVICE_ROLE_KEY`.
 * - Disables session persistence and token auto-refresh for stateless serverless execution.
 * - Throws `ServerOnlyModuleError` if invoked in a browser environment.
 * - Throws `SupabaseConfigError` if required environment variables are missing or invalid.
 */
export function createSupabaseServerClient(
  env: Record<string, string | undefined> = process.env
): SupabaseClient<Database> {
  assertServerRuntime();
  const { supabaseUrl, serviceRoleKey } = validateSupabaseServerEnv(env);

  return createClient<Database>(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
    global: {
      headers: {
        'X-Client-Info': 'quizvibe-ai-server/1.0.0',
      },
    },
  });
}

/**
 * Returns a cached singleton server-side Supabase client for the current serverless invocation.
 */
export function getSupabaseServerClient(
  env: Record<string, string | undefined> = process.env
): SupabaseClient<Database> {
  assertServerRuntime();
  const { supabaseUrl } = validateSupabaseServerEnv(env);

  if (!cachedServerClient || cachedConfigUrl !== supabaseUrl) {
    cachedServerClient = createSupabaseServerClient(env);
    cachedConfigUrl = supabaseUrl;
  }

  return cachedServerClient;
}

/**
 * Resets the cached client instance (used in unit tests when switching environment mocks).
 */
export function resetSupabaseServerClientCache(): void {
  cachedServerClient = null;
  cachedConfigUrl = null;
}

