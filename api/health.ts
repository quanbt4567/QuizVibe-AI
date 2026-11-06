/**
 * Vercel Serverless Function: GET /api/health
 * Public Service Health Check for Uptime Monitors and AI Agent Evaluators.
 */
export default async function handler(req: any, res: any) {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');

  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({
      ok: false,
      code: 'METHOD_NOT_ALLOWED',
      error: 'Chỉ hỗ trợ phương thức GET.',
    });
  }

  return res.status(200).json({
    status: 'ok',
    service: 'quizvibe-ai',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
}

