import { ensureServerEnvLoaded } from '../lib/auth';
import { QuizService, QuizError } from '../lib/quiz';

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
 * Vercel Serverless Function: POST /api/quiz/session
 * Starts a new player quiz session for a published campaign.
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
  const slug = typeof body.slug === 'string' ? body.slug : (typeof req.query?.slug === 'string' ? req.query.slug : '');

  if (!slug) {
    return res.status(400).json({
      ok: false,
      code: 'INVALID_REQUEST',
      error: 'Thiếu định danh chiến dịch (slug).',
    });
  }

  try {
    const service = new QuizService();
    const session = await service.createSession(slug);
    return res.status(201).json({ ok: true, session });
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
      error: 'Không thể khởi tạo lượt chơi lúc này. Vui lòng thử lại sau.',
    });
  }
}

