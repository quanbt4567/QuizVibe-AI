import {
  adminAuthFailureStatus,
  ensureServerEnvLoaded,
  verifyAdminRequest,
} from '../lib/auth';
import {
  CAMPAIGN_TRANSITION_ACTIONS,
  CampaignService,
  CampaignServiceError,
  CampaignTransitionAction,
} from '../lib/campaigns';
import { QuizVibeDatabaseRepository } from '../lib/db/repository';
import type { CampaignStatus } from '../lib/db/types';

ensureServerEnvLoaded();

const CAMPAIGN_STATUSES: readonly CampaignStatus[] = ['draft', 'published', 'archived'];

function firstString(value: unknown): string | undefined {
  if (Array.isArray(value)) return typeof value[0] === 'string' ? value[0] : undefined;
  return typeof value === 'string' ? value : undefined;
}

/**
 * Basic CSRF defence-in-depth for state-changing requests: when the browser sends an `Origin`
 * header it must match the request host (the session cookie is also SameSite=Strict).
 */
function isCrossOriginMutation(req: any): boolean {
  if (req.method === 'GET') return false;
  const origin = firstString(req.headers?.origin);
  const host = firstString(req.headers?.['x-forwarded-host']) || firstString(req.headers?.host);
  if (!origin || !host) return false;
  try {
    return new URL(origin).host !== host;
  } catch {
    return true;
  }
}

function parseJsonBody(req: any): { ok: true; body: Record<string, unknown> } | { ok: false } {
  const raw = req.body;
  if (raw === undefined || raw === null || raw === '') return { ok: true, body: {} };
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
        ? { ok: true, body: parsed as Record<string, unknown> }
        : { ok: false };
    } catch {
      return { ok: false };
    }
  }
  if (typeof raw === 'object' && !Array.isArray(raw)) {
    return { ok: true, body: raw as Record<string, unknown> };
  }
  return { ok: false };
}

function sendServiceError(res: any, err: unknown) {
  if (err instanceof CampaignServiceError) {
    return res.status(err.status).json({
      ok: false,
      code: err.code,
      error: err.message,
      ...(err.fieldErrors ? { fieldErrors: err.fieldErrors } : {}),
    });
  }
  // Unknown failure: generic message only (no internals), and never a success status.
  return res.status(503).json({
    ok: false,
    code: 'DATABASE_ERROR',
    error: 'Không thể xử lý yêu cầu lúc này. Thao tác chưa được lưu.',
  });
}

async function handleCampaigns(req: any, res: any, body: Record<string, unknown>) {
  const service = new CampaignService();
  // The campaign id and action come ONLY from the query string; ids in the JSON body are ignored.
  const id = firstString(req.query?.id);
  const action = firstString(req.query?.action);

  try {
    if (req.method === 'GET') {
      if (id) {
        return res.status(200).json({ ok: true, campaign: await service.get(id) });
      }
      const statusParam = firstString(req.query?.status);
      const status = CAMPAIGN_STATUSES.includes(statusParam as CampaignStatus)
        ? (statusParam as CampaignStatus)
        : undefined;
      return res.status(200).json({ ok: true, campaigns: await service.list(status) });
    }

    if (req.method === 'POST') {
      if (!id) {
        const campaign = await service.create(body);
        return res.status(201).json({ ok: true, campaign });
      }
      if (!action || !CAMPAIGN_TRANSITION_ACTIONS.includes(action as CampaignTransitionAction)) {
        return res.status(400).json({
          ok: false,
          code: 'VALIDATION_FAILED',
          error: 'Hành động chiến dịch không hợp lệ.',
        });
      }
      const campaign = await service.transition(id, action as CampaignTransitionAction);
      return res.status(200).json({ ok: true, campaign });
    }

    if (req.method === 'PUT') {
      if (!id) {
        return res.status(400).json({ ok: false, code: 'VALIDATION_FAILED', error: 'Thiếu mã chiến dịch.' });
      }
      const campaign = await service.update(id, body);
      return res.status(200).json({ ok: true, campaign });
    }

    if (req.method === 'DELETE') {
      if (!id) {
        return res.status(400).json({ ok: false, code: 'VALIDATION_FAILED', error: 'Thiếu mã chiến dịch.' });
      }
      // Deletion is a soft delete (archive): leads reference campaigns with ON DELETE RESTRICT.
      const campaign = await service.transition(id, 'archive');
      return res.status(200).json({ ok: true, campaign, archived: true });
    }

    return res.status(405).json({ ok: false, code: 'METHOD_NOT_ALLOWED', error: 'Phương thức không được hỗ trợ.' });
  } catch (err) {
    console.error('DEBUG handleLeads error:', err);
    return sendServiceError(res, err);
  }
}

async function handleLeads(req: any, res: any) {
  const isSupabaseConfigured = Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
  if (!isSupabaseConfigured) {
    return res.status(200).json({
      ok: true,
      authorized: true,
      resource: 'leads',
      leads: [],
    });
  }

  const repo = new QuizVibeDatabaseRepository();
  const id = firstString(req.query?.id);
  const action = firstString(req.query?.action);
  const campaignId = firstString(req.query?.campaignId);
  const search = firstString(req.query?.search);
  const sortBy = firstString(req.query?.sortBy) as 'newest' | 'score_desc' | 'time_asc' | undefined;
  const format = firstString(req.query?.format);

  try {
    if (req.method === 'GET') {
      const leads = await repo.listAdminLeads({
        campaignId: campaignId || undefined,
        search: search || undefined,
        sortBy: ['newest', 'score_desc', 'time_asc'].includes(sortBy || '') ? sortBy : 'newest',
      });

      if (format === 'csv') {
        const header = ['Họ và tên', 'Số điện thoại', 'Điểm số', 'Thời gian (giây)', 'Mã Voucher', 'Chiến dịch', 'Thời gian gửi'];
        const FORMULA_TRIGGER_CHARS = ['=', '+', '-', '@', '\t', '\r'];

        const escapeCsv = (val: unknown): string => {
          if (val === null || val === undefined) return '';
          if (typeof val === 'number') {
            if (isNaN(val)) return '0';
            return String(val);
          }

          let str = String(val);
          const trimmed = str.trimStart();
          const startsWithTrigger =
            FORMULA_TRIGGER_CHARS.some((char) => str.startsWith(char)) ||
            FORMULA_TRIGGER_CHARS.some((char) => trimmed.startsWith(char));

          if (startsWithTrigger) {
            str = `'${str}`;
          }

          if (
            str.includes(',') ||
            str.includes('"') ||
            str.includes('\n') ||
            str.includes('\r') ||
            startsWithTrigger ||
            str.startsWith(' ') ||
            str.endsWith(' ')
          ) {
            return `"${str.replace(/"/g, '""')}"`;
          }

          return str;
        };

        const rows = leads.map((l) => [
          escapeCsv(l.full_name),
          escapeCsv(l.phone_number),
          escapeCsv(l.score),
          escapeCsv(l.time_taken_seconds),
          escapeCsv(l.voucher_code),
          escapeCsv(l.campaign_title || l.campaign_id),
          escapeCsv(l.submitted_at),
        ].join(','));

        const csvContent = '\uFEFF' + [header.join(','), ...rows].join('\r\n');
        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', 'attachment; filename="quizvibe-leads.csv"');
        return res.status(200).send(csvContent);
      }

      return res.status(200).json({ ok: true, authorized: true, resource: 'leads', leads });
    }

    if (req.method === 'DELETE') {
      if (id) {
        await repo.deleteLeadById(id);
        return res.status(200).json({ ok: true, authorized: true, deleted: true, id });
      }
      if (action === 'clear-all') {
        const cleanCampaignId = (campaignId || '').trim();
        if (!cleanCampaignId || cleanCampaignId === 'all') {
          return res.status(400).json({
            ok: false,
            code: 'VALIDATION_FAILED',
            error: 'Yêu cầu mã chiến dịch cụ thể để xóa danh sách leads. Không thể xóa toàn bộ.',
          });
        }
        await repo.clearAllLeads(cleanCampaignId);
        return res.status(200).json({ ok: true, authorized: true, cleared: true, campaignId: cleanCampaignId });
      }
      return res.status(400).json({ ok: false, code: 'VALIDATION_FAILED', error: 'Thiếu mã lead cần xóa.' });
    }

    return res.status(405).json({ ok: false, code: 'METHOD_NOT_ALLOWED', error: 'Phương thức không được hỗ trợ.' });
  } catch (err) {
    return sendServiceError(res, err);
  }
}

/**
 * Vercel Serverless Function: /api/admin/manage
 * Protected Admin management endpoint.
 *  - resource=campaigns: database-backed campaign CRUD, lifecycle, publishing (Phase 3).
 *  - resource=overview|leads|vouchers: Phase 4 placeholders (authorization check only).
 * Independently verifies the server-side Admin session on every request.
 */
export default async function handler(req: any, res: any) {
  res.setHeader('Cache-Control', 'no-store');

  if (!['GET', 'POST', 'PUT', 'DELETE'].includes(req.method || '')) {
    return res.status(405).json({
      ok: false,
      error: 'Phương thức không được hỗ trợ.',
      code: 'METHOD_NOT_ALLOWED',
    });
  }

  // Independent server-side session verification (never relies on frontend route guards)
  const verification = await verifyAdminRequest(req);
  if (!verification.authenticated) {
    return res.status(adminAuthFailureStatus(verification.code)).json({
      ok: false,
      code: verification.code || 'UNAUTHORIZED',
      error: 'Truy cập bị từ chối: Yêu cầu phiên đăng nhập Quản trị viên hợp lệ.',
    });
  }

  if (isCrossOriginMutation(req)) {
    return res.status(403).json({
      ok: false,
      code: 'CROSS_ORIGIN_REJECTED',
      error: 'Yêu cầu từ nguồn không được phép.',
    });
  }

  const parsed = parseJsonBody(req);
  if (!parsed.ok) {
    return res.status(400).json({
      ok: false,
      code: 'INVALID_REQUEST',
      error: 'Dữ liệu JSON không hợp lệ.',
    });
  }
  const body = parsed.body;

  const rawResource = (
    firstString(req.query?.resource) ||
    (typeof body.resource === 'string' ? body.resource : '') ||
    'overview'
  ).trim();

  if (!['overview', 'campaigns', 'leads', 'vouchers'].includes(rawResource)) {
    return res.status(400).json({
      ok: false,
      code: 'INVALID_RESOURCE',
      error: 'Tài nguyên quản trị yêu cầu không hợp lệ.',
    });
  }

  if (rawResource === 'campaigns') {
    return handleCampaigns(req, res, body);
  }

  if (rawResource === 'leads') {
    return handleLeads(req, res);
  }

  // Phase 4 placeholders (leads / vouchers persistence is out of scope for Phase 3).
  return res.status(200).json({
    ok: true,
    resource: rawResource,
    authorized: true,
    sessionExpiresAt: verification.expiresAt,
  });
}
