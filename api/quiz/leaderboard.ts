import { ensureServerEnvLoaded } from '../_lib/auth/index.js';
import { QuizService, QuizError } from '../_lib/quiz/index.js';

ensureServerEnvLoaded();

function firstString(val: unknown): string {
  if (Array.isArray(val)) return typeof val[0] === 'string' ? val[0] : '';
  return typeof val === 'string' ? val : '';
}

/**
 * Vercel Serverless Function: GET /api/quiz/leaderboard?slug=<slug>
 * Public leaderboard for a published campaign. Masked phone numbers only.
 */
export default async function handler(req: any, res: any) {
  res.setHeader('Cache-Control', 'no-store');

  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({
      ok: false,
      code: 'METHOD_NOT_ALLOWED',
      error: 'Phương thức không được hỗ trợ.',
    });
  }

  const slug = firstString(req.query?.slug || req.query?.campaignId).trim();
  if (!slug) {
    return res.status(400).json({
      ok: false,
      code: 'INVALID_REQUEST',
      error: 'Thiếu định danh chiến dịch (slug).',
    });
  }

  try {
    const service = new QuizService();
    const leaderboard = await service.getLeaderboard(slug);
    return res.status(200).json({ ok: true, leaderboard });
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
      error: 'Không thể tải bảng xếp hạng lúc này.',
    });
  }
}

