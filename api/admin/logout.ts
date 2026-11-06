import {
  ensureServerEnvLoaded,
  revokeAdminSessionFromRequest,
} from '../_lib/auth/index.js';

ensureServerEnvLoaded();

/**
 * Vercel Serverless Function: POST /api/admin/logout
 * Invalidates the active Admin session on the server and clears the HttpOnly cookie.
 */
export default async function handler(req: any, res: any) {
  res.setHeader('Cache-Control', 'no-store');

  if (req.method !== 'POST') {
    return res.status(405).json({
      ok: false,
      error: 'Phương thức không được hỗ trợ (chỉ chấp nhận POST).',
      code: 'METHOD_NOT_ALLOWED',
    });
  }

  const { completed, clearCookieHeader } = await revokeAdminSessionFromRequest(req);

  if (!completed) {
    // Server-side revocation failed: do NOT clear the cookie and do NOT claim success,
    // so the client knows the session is still active and can retry.
    return res.status(503).json({
      ok: false,
      authenticated: true,
      code: 'LOGOUT_NOT_COMPLETED',
      error:
        'Không thể thu hồi phiên đăng nhập trên máy chủ. Bạn vẫn đang đăng nhập; vui lòng thử đăng xuất lại.',
    });
  }

  res.setHeader('Set-Cookie', clearCookieHeader);

  return res.status(200).json({
    ok: true,
    authenticated: false,
  });
}

