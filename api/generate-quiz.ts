import { validateClientRequest } from './_lib/validator.js';
import { AIProviderRouter } from './_lib/router.js';

// Load local environment variables if available (Node.js 20+ local runtime)
if (typeof process.loadEnvFile === 'function') {
  try {
    process.loadEnvFile('.env.local');
  } catch {
    try {
      process.loadEnvFile('.env');
    } catch {
      // Ignored in cloud environments where process.env is injected directly
    }
  }
}

// Export Vercel serverless function maxDuration configuration
export const maxDuration = 15;

/**
 * Vercel Serverless Function: /api/generate-quiz
 * Priority: 1. Gemini -> 2. Groq -> 3. Cerebras (disabled by default)
 * Free-Only budget policy, 9.0s global deadline.
 */
export default async function handler(req: any, res: any) {
  // 1. CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // 2. HTTP Method guard
  if (req.method !== 'POST') {
    return res.status(405).json({
      ok: false,
      error: 'Phương thức không được hỗ trợ (chỉ chấp nhận POST).',
      code: 'METHOD_NOT_ALLOWED',
    });
  }

  // 3. Parse JSON Body
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

  // 4. Validate incoming payload
  const validation = validateClientRequest(body);
  if (!validation.valid || !validation.data) {
    return res.status(400).json({
      ok: false,
      error: validation.error || 'Dữ liệu yêu cầu không hợp lệ.',
      code: 'INVALID_REQUEST',
    });
  }

  // 5. Execute Multi-Provider Router with 9.0s deadline
  const router = new AIProviderRouter();
  const { statusCode, response } = await router.execute(validation.data);

  return res.status(statusCode).json(response);
}

