import { ensureServerEnvLoaded } from '../_lib/auth/index.js';
import { QuizService, QuizError } from '../_lib/quiz/index.js';

ensureServerEnvLoaded();

function parseBody(req: any): Record<string, unknown> {
  const raw = req.body;
  if (!raw) return {};
  if (typeof raw === 'string') {
    try {
      return JSON.parse(raw);
    } catch {
      return {};
    }
  }
  return typeof raw === 'object' ? raw : {};
}

/**
 * Vercel Serverless Function: POST /api/quiz/lead
 * Submits player lead information for a completed session and unlocks the configured voucher.
 */
export default async function handler(req: any, res: any) {
  res.setHeader('Cache-Control', 'no-store');

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({
      ok: false,
      code: 'METHOD_NOT_ALLOWED',
      error: 'Phương thức không được hỗ trợ.',
    });
  }

  const body = parseBody(req);
  const sessionToken = typeof body.sessionToken === 'string' ? body.sessionToken.trim() : '';
  const fullName = typeof body.fullName === 'string' ? body.fullName : '';
  const phoneNumber = typeof body.phoneNumber === 'string' ? body.phoneNumber : '';

  if (!sessionToken) {
    return res.status(400).json({
      ok: false,
      code: 'INVALID_REQUEST',
      error: 'Thiếu mã phiên chơi (sessionToken).',
    });
  }

  try {
    const service = new QuizService();
    const result = await service.submitLead(sessionToken, fullName, phoneNumber);
    return res.status(201).json({ ok: true, ...result });
  } catch (err) {
    if (err instanceof QuizError) {
      return res.status(err.status).json({
        ok: false,
        code: err.code,
        error: err.message,
      });
    }
    return res.status(503).json({
      ok: false,
      code: 'SERVICE_UNAVAILABLE',
      error: 'Không thể ghi nhận thông tin lúc này. Vui lòng thử lại sau.',
    });
  }
}

