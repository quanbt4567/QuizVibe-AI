import {
  ensureServerEnvLoaded,
  isRequestSecure,
  serializeSessionCookie,
  verifyAdminRequest,
  adminAuthFailureStatus,
} from '../_lib/auth';

ensureServerEnvLoaded();

/**
 * Vercel Serverless Function: GET /api/admin/session
 * Verifies the server-side Admin session from the HttpOnly cookie.
 */
export default async function handler(req: any, res: any) {
  res.setHeader('Cache-Control', 'no-store');

  if (req.method !== 'GET') {
    return res.status(405).json({
      ok: false,
      error: 'Phương thức không được hỗ trợ (chỉ chấp nhận GET).',
      code: 'METHOD_NOT_ALLOWED',
    });
  }

  const verification = await verifyAdminRequest(req);
  if (!verification.authenticated) {
    const status = adminAuthFailureStatus(verification.code);
    if (status === 401) {
      res.setHeader(
        'Set-Cookie',
        serializeSessionCookie('', 0, isRequestSecure(req))
      );
    }
    return res.status(status).json({
      ok: false,
      authenticated: false,
      code: verification.code || 'UNAUTHORIZED',
      error: 'Phiên đăng nhập Quản trị viên không hợp lệ hoặc đã hết hạn.',
    });
  }

  return res.status(200).json({
    ok: true,
    authenticated: true,
    expiresAt: verification.expiresAt,
  });
}

