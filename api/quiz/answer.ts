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
 * Vercel Serverless Function: POST /api/quiz/answer
 * Submits an answer for the current question in a gameplay session.
 * Evaluates speed score and advances sequence on the server.
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
  const questionIndex = typeof body.questionIndex === 'number' ? body.questionIndex : -1;
  const selectedOptionIndex =
    typeof body.selectedOptionIndex === 'number'
      ? body.selectedOptionIndex
      : body.selectedOptionIndex === null
      ? null
      : null;

  if (!sessionToken) {
    return res.status(400).json({
      ok: false,
      code: 'INVALID_REQUEST',
      error: 'Thiếu mã phiên chơi (sessionToken).',
    });
  }

  if (questionIndex < 0 || questionIndex > 4) {
    return res.status(400).json({
      ok: false,
      code: 'INVALID_REQUEST',
      error: 'Chỉ số câu hỏi không hợp lệ (0..4).',
    });
  }

  try {
    const service = new QuizService();
    const result = await service.submitAnswer(sessionToken, questionIndex, selectedOptionIndex);
    return res.status(200).json({ ok: true, answer: result });
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
      error: 'Không thể ghi nhận câu trả lời lúc này. Vui lòng thử lại.',
    });
  }
}

