import crypto from 'node:crypto';
import { campaignValidationCache } from '../quiz/campaignCache.js';

/**
 * Minimal in-memory PostgREST emulator for tests (NOT a test file: no `.test.` in the name).
 * Supports the subset of PostgREST used by QuizVibe: eq / is / like / in filters, order, limit,
 * select column lists, single-object Accept, insert / upsert (on_conflict), PATCH, and the
 * `admin_save_campaign` RPC. Any request to a host other than the synthetic one throws, so tests
 * can never reach a real Supabase project.
 */

type Row = Record<string, any>;
export type FailureMode = 'http500' | 'down' | 'hang' | 'masked_phone_check' | 'duplicate_session_race';

export interface RecordedRequest {
  method: string;
  table: string;
  params: Record<string, string>;
  body: any;
}

export const FAKE_SUPABASE_HOST = 'synthetic-test-project.supabase.co';

export class FakePostgrest {
  public tables: Record<string, Row[]> = {
    campaigns: [],
    campaign_questions: [],
    vouchers: [],
    admin_sessions: [],
    quiz_sessions: [],
    leads: [],
  };
  public requests: RecordedRequest[] = [];
  /** Returns a failure mode to inject for a request, or null/undefined to process normally. */
  public failure: ((req: RecordedRequest) => FailureMode | null | undefined) | null = null;
  /** Number of upcoming RPC calls that should collide on slug (simulates concurrent creation). */
  public forceSlugCollisions = 0;

  public reset() {
    for (const k of Object.keys(this.tables)) this.tables[k] = [];
    this.requests = [];
    this.failure = null;
    this.forceSlugCollisions = 0;
    campaignValidationCache.clear();
  }

  public install(): () => void {
    const original = globalThis.fetch;
    globalThis.fetch = ((input: any, init: any = {}) => this.handle(input, init)) as typeof fetch;
    return () => {
      globalThis.fetch = original;
    };
  }

  private json(status: number, payload: unknown) {
    return new Response(JSON.stringify(payload), {
      status,
      headers: { 'content-type': 'application/json' },
    });
  }

  private matches(row: Row, params: Record<string, string>): boolean {
    for (const [key, raw] of Object.entries(params)) {
      if (['select', 'order', 'limit', 'offset', 'on_conflict', 'columns'].includes(key)) continue;
      const dot = raw.indexOf('.');
      const op = raw.slice(0, dot);
      const val = raw.slice(dot + 1);
      const cell = row[key];
      if (op === 'eq') {
        if (String(cell) !== val) return false;
      } else if (op === 'is') {
        if (val === 'null' && cell !== null && cell !== undefined) return false;
      } else if (op === 'like') {
        const prefix = val.replace(/%$/, '');
        if (typeof cell !== 'string' || !cell.startsWith(prefix)) return false;
      } else if (op === 'in') {
        const list = val.replace(/^\(|\)$/g, '').split(',').map((s) => s.replace(/^"|"$/g, ''));
        if (!list.includes(String(cell))) return false;
      }
    }
    return true;
  }

  private project(rows: Row[], select: string | undefined): Row[] {
    if (!select || select === '*') return rows.map((r) => ({ ...r }));
    const cols = select.split(',').map((c) => c.trim());
    return rows.map((r) => Object.fromEntries(cols.map((c) => [c, r[c]])));
  }

  private async handle(input: any, init: any): Promise<Response> {
    const url = new URL(typeof input === 'string' ? input : input.url ?? String(input));
    if (url.hostname !== FAKE_SUPABASE_HOST) {
      throw new Error(`Blocked non-synthetic network call to ${url.hostname}`);
    }

    const method = String(init.method || 'GET').toUpperCase();
    const params: Record<string, string> = {};
    url.searchParams.forEach((v, k) => {
      params[k] = v;
    });
    const body = typeof init.body === 'string' ? JSON.parse(init.body) : undefined;
    const headers = new Headers(init.headers);
    const accept = headers.get('accept') || '';
    const prefer = headers.get('prefer') || '';
    const path = url.pathname.replace(/^\/rest\/v1\//, '');
    const isRpc = path.startsWith('rpc/');
    const table = isRpc ? path.slice(4) : path;
    const recorded: RecordedRequest = { method, table, params, body };
    this.requests.push(recorded);

    const mode = this.failure?.(recorded);
    if (mode === 'down') throw new TypeError('fetch failed (simulated outage)');
    if (mode === 'hang') return new Promise<Response>(() => {});
    if (mode === 'http500') return this.json(500, { message: 'simulated failure', code: 'XX000' });
    if (mode === 'masked_phone_check') {
      return this.json(400, {
        code: '23514',
        message: 'new row for relation "leads" violates check constraint "leads_masked_phone_check"',
      });
    }
    if (mode === 'duplicate_session_race') {
      return this.json(409, {
        code: '23505',
        message: 'duplicate key value violates unique constraint "leads_quiz_session_id_key"',
      });
    }

    if (isRpc) return this.rpc(table, body);

    const rows = this.tables[table];
    if (!rows) return this.json(404, { code: '42P01', message: 'relation does not exist' });

    if (method === 'GET') {
      let result = rows.filter((r) => this.matches(r, params));
      if (params.order) {
        const sortKeys = params.order.split(',').map((part) => {
          const [col, dir] = part.trim().split('.');
          return { col, dir: dir || 'asc' };
        });
        result = [...result].sort((a, b) => {
          for (const { col, dir } of sortKeys) {
            const av = a[col] ?? '';
            const bv = b[col] ?? '';
            if (av !== bv) {
              return (av < bv ? -1 : 1) * (dir === 'desc' ? -1 : 1);
            }
          }
          return 0;
        });
      }
      if (params.limit) result = result.slice(0, Number(params.limit));
      const projected = this.project(result, params.select);
      if (accept.includes('pgrst.object')) {
        return projected.length === 1
          ? this.json(200, projected[0])
          : this.json(406, { code: 'PGRST116', message: 'no or multiple rows' });
      }
      return this.json(200, projected);
    }

    if (method === 'POST') {
      const incoming: Row[] = Array.isArray(body) ? body : [body];
      const saved: Row[] = [];
      const conflictCol = params.on_conflict;
      for (const item of incoming) {
        const existing = conflictCol ? rows.find((r) => r[conflictCol] === item[conflictCol]) : undefined;
        if (existing) {
          Object.assign(existing, item);
          saved.push(existing);
          continue;
        }
        // Simulate Postgres trigger trg_sync_quiz_sessions_token_hash on public.quiz_sessions
        if (table === 'quiz_sessions' && item.session_token) {
          const computedHash = crypto
            .createHash('sha256')
            .update(String(item.session_token).trim())
            .digest('hex');
          if (!item.session_token_hash || item.session_token_hash !== computedHash) {
            item.session_token_hash = computedHash;
          }
        }
        const row = { id: crypto.randomUUID(), created_at: new Date().toISOString(), ...item };
        rows.push(row);
        saved.push(row);
      }
      if (prefer.includes('return=representation')) {
        const projected = this.project(saved, params.select);
        return accept.includes('pgrst.object')
          ? (projected.length === 1
              ? this.json(201, projected[0])
              : this.json(406, { code: 'PGRST116', message: 'no or multiple rows' }))
          : this.json(201, projected);
      }
      return new Response(null, { status: 201 });
    }

    if (method === 'PATCH') {
      const targets = rows.filter((r) => this.matches(r, params));
      const patch = typeof body === 'object' && body !== null ? { ...body } : {};
      for (const t of targets) {
        if (table === 'quiz_sessions') {
          if (patch.session_token !== undefined && patch.session_token !== null) {
            const computed = crypto
              .createHash('sha256')
              .update(String(patch.session_token).trim())
              .digest('hex');
            if (patch.session_token !== t.session_token || patch.session_token_hash !== computed) {
              patch.session_token_hash = computed;
            }
          }
        }
        Object.assign(t, patch);
        if ('updated_at' in t) t.updated_at = new Date().toISOString();
      }
      if (prefer.includes('return=representation')) {
        const projected = this.project(targets, params.select);
        return accept.includes('pgrst.object')
          ? (projected.length === 1
              ? this.json(200, projected[0])
              : this.json(406, { code: 'PGRST116', message: 'no or multiple rows' }))
          : this.json(200, projected);
      }
      return new Response(null, { status: 204 });
    }

    if (method === 'DELETE') {
      const targets = rows.filter((r) => this.matches(r, params));
      this.tables[table] = rows.filter((r) => !this.matches(r, params));
      if (prefer.includes('return=representation')) {
        const projected = this.project(targets, params.select);
        return accept.includes('pgrst.object')
          ? (projected.length === 1
              ? this.json(200, projected[0])
              : this.json(406, { code: 'PGRST116', message: 'no or multiple rows' }))
          : this.json(200, projected);
      }
      return new Response(null, { status: 204 });
    }

    return this.json(405, { message: 'unsupported in fake' });
  }

  /** Emulates public.admin_save_campaign(): all-or-nothing (state is only committed on success). */
  private rpc(fn: string, body: any): Response {
    if (fn !== 'admin_save_campaign') {
      return this.json(404, { code: '42883', message: 'function does not exist' });
    }
    const payload = body?.p_payload;
    const campaignId: string | null = body?.p_campaign_id ?? null;

    if (
      !payload ||
      !Array.isArray(payload.questions) ||
      payload.questions.length !== 5 ||
      !payload.voucher
    ) {
      return this.json(400, { code: '22023', message: 'invalid payload' });
    }

    // Work on copies so a failure leaves state untouched (transaction semantics).
    const campaigns = this.tables.campaigns.map((r) => ({ ...r }));
    const questions = this.tables.campaign_questions.map((r) => ({ ...r }));
    const vouchers = this.tables.vouchers.map((r) => ({ ...r }));

    let id: string;
    if (campaignId === null) {
      if (this.forceSlugCollisions > 0) {
        this.forceSlugCollisions -= 1;
        return this.json(409, { code: '23505', message: 'duplicate key value violates unique constraint' });
      }
      if (campaigns.some((c) => c.slug === payload.slug)) {
        return this.json(409, { code: '23505', message: 'duplicate key value violates unique constraint' });
      }
      id = crypto.randomUUID();
      const now = new Date().toISOString();
      campaigns.push({
        id,
        slug: payload.slug,
        legacy_id: null,
        title: payload.title,
        description: payload.description ?? '',
        industry: payload.industry,
        status: 'draft',
        is_ai_generated: Boolean(payload.is_ai_generated),
        is_mock: Boolean(payload.is_mock),
        mock_label: payload.mock_label || null,
        published_at: null,
        created_at: now,
        updated_at: now,
      });
    } else {
      const target = campaigns.find((c) => c.id === campaignId && c.status !== 'archived');
      if (!target) return this.json(404, { code: 'P0002', message: 'campaign_not_found_or_archived' });
      id = target.id;
      Object.assign(target, {
        title: payload.title,
        description: payload.description ?? '',
        industry: payload.industry,
        is_ai_generated: Boolean(payload.is_ai_generated),
        is_mock: Boolean(payload.is_mock),
        mock_label: payload.mock_label || null,
        updated_at: new Date().toISOString(),
      });
    }

    for (let i = 0; i < 5; i++) {
      const q = payload.questions[i];
      const existing = questions.find((r) => r.campaign_id === id && r.question_order === i);
      const values = {
        question_text: q.question_text,
        options: q.options,
        correct_index: q.correct_index,
        explanation: q.explanation || null,
      };
      if (existing) Object.assign(existing, values);
      else {
        questions.push({
          id: crypto.randomUUID(),
          campaign_id: id,
          question_order: i,
          created_at: new Date().toISOString(),
          ...values,
        });
      }
    }

    const v = payload.voucher;
    const vValues = {
      code: v.code,
      discount: v.discount,
      description: v.description ?? '',
      expiry_date: v.expiry_date || null,
      terms: v.terms || null,
    };
    const existingVoucher = vouchers.find((r) => r.campaign_id === id);
    if (existingVoucher) Object.assign(existingVoucher, vValues);
    else vouchers.push({ id: crypto.randomUUID(), campaign_id: id, ...vValues });

    this.tables.campaigns = campaigns;
    this.tables.campaign_questions = questions;
    this.tables.vouchers = vouchers;
    return this.json(200, id);
  }
}

