/**
 * Client-side Admin Authentication Service
 * Communicates with server-verified `/api/admin/*` endpoints using HttpOnly cookies.
 * SECURITY INVARIANT: Never stores passwords, tokens, or secrets in localStorage or sessionStorage.
 */

export interface AdminSessionStatus {
  authenticated: boolean;
  expiresAt?: string;
  code?: string;
  error?: string;
}

export interface AdminLoginResult {
  ok: boolean;
  authenticated: boolean;
  expiresAt?: string;
  code?: string;
  error?: string;
  retryAfterSeconds?: number;
}

/**
 * Checks whether the current browser has a valid server-verified Admin session cookie.
 */
export async function checkAdminSession(
  fetchImpl: typeof fetch = fetch
): Promise<AdminSessionStatus> {
  try {
    const response = await fetchImpl('/api/admin/session', {
      method: 'GET',
      credentials: 'same-origin',
      headers: {
        Accept: 'application/json',
      },
    });

    const data = await response.json().catch(() => null);
    if (response.ok && data?.ok && data?.authenticated === true) {
      return {
        authenticated: true,
        expiresAt: data.expiresAt,
      };
    }

    return {
      authenticated: false,
      code: data?.code || 'UNAUTHORIZED',
      error: data?.error,
    };
  } catch {
    return {
      authenticated: false,
      code: 'NETWORK_ERROR',
      error: 'Không thể kết nối đến máy chủ xác thực.',
    };
  }
}

/**
 * Submits the Admin password to `POST /api/admin/login`.
 * On success, the server sets an HttpOnly session cookie (`qv_admin_session`).
 */
export async function loginAdmin(
  password: string,
  fetchImpl: typeof fetch = fetch
): Promise<AdminLoginResult> {
  try {
    const response = await fetchImpl('/api/admin/login', {
      method: 'POST',
      credentials: 'same-origin',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({ password }),
    });

    const data = await response.json().catch(() => null);
    if (response.ok && data?.ok && data?.authenticated === true) {
      return {
        ok: true,
        authenticated: true,
        expiresAt: data.expiresAt,
      };
    }

    return {
      ok: false,
      authenticated: false,
      code: data?.code || 'LOGIN_FAILED',
      error: data?.error || 'Đăng nhập không thành công.',
      retryAfterSeconds: data?.retryAfterSeconds,
    };
  } catch {
    return {
      ok: false,
      authenticated: false,
      code: 'NETWORK_ERROR',
      error: 'Không thể kết nối đến máy chủ xác thực.',
    };
  }
}

/**
 * Logs out the current Admin session via `POST /api/admin/logout`,
 * invalidating the server-side session and clearing the HttpOnly cookie.
 */
export async function logoutAdmin(
  fetchImpl: typeof fetch = fetch
): Promise<boolean> {
  try {
    const response = await fetchImpl('/api/admin/logout', {
      method: 'POST',
      credentials: 'same-origin',
      headers: {
        Accept: 'application/json',
      },
    });
    return response.ok;
  } catch {
    return false;
  }
}

