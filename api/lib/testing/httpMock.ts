/**
 * Shared HTTP mock helpers for serverless handler tests (not a test file).
 */
export function mockHttp(opts: {
  method: string;
  body?: unknown;
  cookie?: string;
  query?: Record<string, string>;
  headers?: Record<string, string>;
}) {
  const req = {
    method: opts.method,
    body: opts.body,
    query: opts.query || {},
    headers: {
      ...(opts.cookie ? { cookie: opts.cookie } : {}),
      ...(opts.headers || {}),
    } as Record<string, string>,
    socket: { remoteAddress: '198.51.100.7' },
  };
  let statusCode = 200;
  let jsonBody: any = null;
  const headers: Record<string, string> = {};
  const res: any = {
    setHeader: (k: string, v: string) => {
      headers[k] = v;
    },
    status: (c: number) => {
      statusCode = c;
      return res;
    },
    json: (d: any) => {
      jsonBody = d;
      return res;
    },
    send: (d: any) => {
      jsonBody = d;
      return res;
    },
    status$: () => statusCode,
    body$: () => jsonBody,
    headers$: () => headers,
  };
  return { req, res };
}

export function tokenFromSetCookie(setCookie: string | undefined): string {
  const first = (setCookie || '').split(';')[0] || '';
  return decodeURIComponent(first.slice(first.indexOf('=') + 1));
}

