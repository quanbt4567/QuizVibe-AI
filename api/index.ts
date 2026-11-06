/**
 * Vercel Serverless Function: GET /api
 * Public API Discovery Manifest & Endpoint Catalog for AI Agents & Developers.
 *
 * Provides a structured, machine-readable overview of QuizVibe AI's endpoints,
 * their authentication requirements, and security boundaries.
 */
export default async function handler(req: any, res: any) {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'public, max-age=3600, s-maxage=3600');

  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({
      ok: false,
      code: 'METHOD_NOT_ALLOWED',
      error: 'Chỉ hỗ trợ phương thức GET.',
    });
  }

  return res.status(200).json({
    name: 'QuizVibe AI Public API',
    version: '1.0.0',
    status: 'healthy',
    description: 'Nền tảng Gamification Quiz Tương Tác Thu Lead & Phân Phối Voucher với AI.',
    documentation: 'https://quiz-vibe-ai.vercel.app/llms.txt',
    endpoints: {
      public: [
        {
          path: '/api',
          method: 'GET',
          description: 'API discovery manifest and endpoint catalog.',
          auth: 'none',
        },
        {
          path: '/api/health',
          method: 'GET',
          description: 'Service health and operational status check.',
          auth: 'none',
        },
        {
          path: '/api/markdown',
          method: 'GET',
          description: 'Markdown content negotiation endpoint (supports ?slug=:slug).',
          auth: 'none',
        },
        {
          path: '/api/public/campaign?slug=:slug',
          method: 'GET',
          description: 'Fetches sanitized public campaign data (questions without answers).',
          auth: 'none',
        },
        {
          path: '/api/quiz/leaderboard?slug=:slug',
          method: 'GET',
          description: 'Fetches Top 10 public leaderboard entries with masked phone numbers.',
          auth: 'none',
        },
        {
          path: '/api/og?slug=:slug',
          method: 'GET',
          description: 'Dynamic Open Graph HTML/metadata for social media crawlers.',
          auth: 'none',
        },
      ],
      player_session_required: [
        {
          path: '/api/quiz/session',
          method: 'POST',
          description: 'Initialize a player quiz session for a published campaign. Issues a hash-only SHA-256 session token.',
          auth: 'rate-limited, public initiation',
        },
        {
          path: '/api/quiz/answer',
          method: 'POST',
          description: 'Submit an answer for the active question. Evaluated and scored server-side.',
          auth: 'x-quiz-session-token header required',
        },
        {
          path: '/api/quiz/complete',
          method: 'POST',
          description: 'Finalize quiz session and compute authoritative final score.',
          auth: 'x-quiz-session-token header required',
        },
        {
          path: '/api/quiz/lead',
          method: 'POST',
          description: 'Submit verified player contact details to unlock reward voucher.',
          auth: 'x-quiz-session-token header required',
        },
      ],
      admin_authenticated: [
        {
          path: '/api/admin/login',
          method: 'POST',
          description: 'Authenticate admin and issue HttpOnly session cookie.',
          auth: 'password required',
        },
        {
          path: '/api/admin/logout',
          method: 'POST',
          description: 'Revoke admin session and clear authentication cookie.',
          auth: 'admin session required',
        },
        {
          path: '/api/admin/session',
          method: 'GET',
          description: 'Verify current admin session status.',
          auth: 'admin session cookie',
        },
        {
          path: '/api/admin/manage',
          method: 'GET | POST | PUT | DELETE',
          description: 'Manage campaigns (create, update, transition) and view customer leads ledger.',
          auth: 'admin session cookie required',
        },
        {
          path: '/api/generate-quiz',
          method: 'POST',
          description: 'Generate 5 quiz questions via Google Gemini 3.8 Flash / Groq LLMs.',
          auth: 'admin session or trusted context required',
        },
      ],
    },
  });
}

