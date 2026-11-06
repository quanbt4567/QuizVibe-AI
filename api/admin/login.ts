import {
  AdminAuthConfigError,
  checkLoginRateLimit,
  clearLoginRateLimit,
  createAdminSession,
  ensureServerEnvLoaded,
  getClientRateLimitKey,
  isRequestSecure,
  recordFailedLoginAttempt,
  validateAdminAuthEnv,
  verifyAdminPassword,
} from '../lib/auth';

ensureServerEnvLoaded();

/**
 * Vercel Serverless Function: POST /api/admin/login
 * Authenticates Admin credentials on the server and sets an HttpOnly session cookie.
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

  const clientKey = getClientRateLimitKey(req);
  const rateLimit = checkLoginRateLimit(clientKey);
  if (!rateLimit.allowed) {
    res.setHeader('Retry-After', String(rateLimit.retryAfterSeconds));
    return res.status(429).json({
      ok: false,
      error: 'Quá nhiều lần đăng nhập thất bại. Vui lòng thử lại sau ít phút.',
      code: 'RATE_LIMITED',
      retryAfterSeconds: rateLimit.retryAfterSeconds,
    });
  }

  let body = req.body;
  if (typeof body === 'string') {
    try {
      body = JSON.parse(body);
    } catch {
      return res.status(400).json({
        ok: false,
        error: 'Dữ liệu JSON không hợp lệ.',
        code: 'INVALID_REQUEST',
      });
    }
  }

  const password =
    body && typeof body === 'object' && typeof body.password === 'string'
      ? body.password
      : '';

  if (!password.trim()) {
    return res.status(400).json({
      ok: false,
      error: 'Vui lòng nhập mật khẩu Quản trị viên.',
      code: 'INVALID_REQUEST',
    });
  }

  try {
    validateAdminAuthEnv();
  } catch (err) {
    const configErr = err as AdminAuthConfigError;
    return res.status(503).json({
      ok: false,
      error:
        'Chức năng đăng nhập Quản trị viên chưa được cấu hình bảo mật đầy đủ trên máy chủ (ADMIN_PASSWORD / ADMIN_SESSION_SECRET).',
      code: configErr.code || 'ADMIN_AUTH_NOT_CONFIGURED',
    });
  }

  const isValid = verifyAdminPassword(password);
  if (!isValid) {
    recordFailedLoginAttempt(clientKey);
    return res.status(401).json({
      ok: false,
      error: 'Mật khẩu Quản trị viên không chính xác.',
      code: 'INVALID_CREDENTIALS',
    });
  }

  clearLoginRateLimit(clientKey);

  let session: Awaited<ReturnType<typeof createAdminSession>>;
  try {
    session = await createAdminSession({
      isSecure: isRequestSecure(req),
    });
  } catch (err) {
    // Fail closed: no cookie is issued when the session cannot be persisted. No internals are exposed.
    const code = (err as AdminAuthConfigError)?.code;
    return res.status(503).json({
      ok: false,
      authenticated: false,
      error: 'Không thể tạo phiên đăng nhập an toàn lúc này. Vui lòng thử lại sau.',
      code: code === 'ADMIN_AUTH_NOT_CONFIGURED' ? code : 'SESSION_STORE_UNAVAILABLE',
    });
  }

  res.setHeader('Set-Cookie', session.cookieHeader);
  return res.status(200).json({
    ok: true,
    authenticated: true,
    expiresAt: session.expiresAt,
  });
}

