/**
 * QuizVibe AI — Local Demo API Adapter
 * Connects Vite's Connect middleware to Vercel Serverless Functions in `api/`.
 * Ensures full request/response contract compatibility without modifying production code.
 */

import { createDemoFixtures, DEMO_CAMPAIGN_ID } from './fixtures.mjs';

const ROUTE_MAP = {
  '/api/admin/login': './api/admin/login.ts',
  '/api/admin/session': './api/admin/session.ts',
  '/api/admin/logout': './api/admin/logout.ts',
  '/api/admin/manage': './api/admin/manage.ts',
  '/api/public/campaign': './api/public/campaign.ts',
  '/api/quiz/session': './api/quiz/session.ts',
  '/api/quiz/answer': './api/quiz/answer.ts',
  '/api/quiz/complete': './api/quiz/complete.ts',
  '/api/quiz/lead': './api/quiz/lead.ts',
  '/api/quiz/leaderboard': './api/quiz/leaderboard.ts',
  '/api/health': './api/health.ts',
  '/api/og': './api/og.ts',
};

export function createApiAdapter({ viteServer, fakeDb }) {
  // Handler cache for loaded modules
  const handlerCache = new Map();

  async function getHandler(filePath) {
    if (handlerCache.has(filePath)) {
      return handlerCache.get(filePath);
    }
    const mod = await viteServer.ssrLoadModule(filePath);
    const handler = mod.default || mod.handler;
    if (typeof handler !== 'function') {
      throw new Error(`Module ${filePath} does not export a default function handler`);
    }
    handlerCache.set(filePath, handler);
    return handler;
  }

  return async function apiMiddleware(req, res, next) {
    const rawUrl = req.url || '/';
    const parsedUrl = new URL(rawUrl, 'http://localhost:3000');
    const pathname = parsedUrl.pathname;

    // Only process /api/ routes
    if (!pathname.startsWith('/api/')) {
      return next();
    }

    // 1. Handle Demo Reset Endpoint
    if (pathname === '/api/demo/reset' && req.method === 'POST') {
      const freshFixtures = createDemoFixtures();
      for (const [k, v] of Object.entries(freshFixtures)) {
        fakeDb.tables[k] = v;
      }
      fakeDb.requests = [];
      res.statusCode = 200;
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      return res.end(JSON.stringify({ ok: true, message: 'Demo fixtures reset successfully' }));
    }

    // 2. Handle Mock AI Generator Endpoint (/api/generate-quiz)
    if (pathname === '/api/generate-quiz') {
      if (req.method !== 'POST') {
        res.statusCode = 405;
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        return res.end(JSON.stringify({ ok: false, error: 'Phương thức không được hỗ trợ.' }));
      }

      // Collect body
      const chunks = [];
      for await (const chunk of req) chunks.push(chunk);
      const rawBody = Buffer.concat(chunks).toString('utf8');
      let body = {};
      try { body = JSON.parse(rawBody); } catch { body = {}; }

      const topic = (body.topic || 'Ẩm thực Việt Nam').trim();
      const industry = (body.industry || 'Ẩm thực & Nhà hàng').trim();

      // Deterministic, high-quality 5-question response matching Challenge 3
      const mockAiResponse = {
        ok: true,
        provider: 'gemini',
        model: 'gemini-3.8-flash',
        questions: [
          {
            question: 'Nước dùng của món Phở bò Hà Nội truyền thống lấy vị ngọt chủ yếu từ nguyên liệu nào?',
            options: ['Ninh từ xương ống bò và gừng nướng', 'Đường phèn và bột ngọt', 'Củ cải đường và hành tây', 'Nước cốt dừa'],
            correctIndex: 0,
            explanation: 'Nước dùng phở Hà Nội được ninh kỹ từ xương ống bò cùng hoa hồi, quế, thảo quả và hành gừng nướng thơm nức.',
          },
          {
            question: 'Thương hiệu Chả cá nổi tiếng có lịch sử hơn 130 năm tại Hà Nội là gì?',
            options: ['Chả cá Lã Vọng', 'Chả cá Thăng Long', 'Chả cá Anh Vũ', 'Chả cá Kinh Kỳ'],
            correctIndex: 0,
            explanation: 'Chả cá Lã Vọng do gia tộc họ Đoàn sáng tạo từ năm 1871 tại số 14 phố Hàng Sơn (nay là phố Chả Cá).',
          },
          {
            question: 'Bánh cuốn Thanh Trì chuẩn vị thường được ăn kèm với loại gia vị chấm độc đáo nào?',
            options: ['Tinh dầu cà cuống', 'Mắm tôm chua', 'Nước mắm me', 'Tương ớt xào'],
            correctIndex: 0,
            explanation: 'Bánh cuốn Thanh Trì tráng mỏng như cánh lụa, chấm nước mắm pha chua ngọt thơm hương tinh dầu cà cuống truyền thống.',
          },
          {
            question: 'Món Bún thang Hà Nội được ví như một bức tranh ẩm thực đa sắc màu bởi bao nhiêu nguyên liệu thái sợi chỉ?',
            options: ['Gà xé, giò lụa, trứng tráng, nấm hương, củ cải dầm', 'Thịt bò, tôm nõn, chả quế, rau cần', 'Thịt quay, đậu phụ, hành hoa, trứng muối', 'Lươn xào, mộc nhĩ, hoa chuối, măng khô'],
            correctIndex: 0,
            explanation: 'Bún thang nổi bật bởi sự cầu kỳ, các nguyên liệu gà xé, giò lụa, trứng chiên đều được thái chỉ sợi tơ bày biện tinh tế.',
          },
          {
            question: 'Thức quà giải nhiệt mùa hè gắn liền với phố Hàng Than Hà Nội là gì?',
            options: ['Kem caramen (bánh flan)', 'Kem Tràng Tiền', 'Chè sen long nhãn', 'Tào phớ thạch găng'],
            correctIndex: 0,
            explanation: 'Phố Hàng Than nức tiếng với những quán caramen mềm mịn, béo ngậy ăn cùng trân châu và thạch dừa thanh mát.',
          },
        ],
      };

      res.statusCode = 200;
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      return res.end(JSON.stringify(mockAiResponse));
    }

    // 3. Match Route
    const filePath = ROUTE_MAP[pathname];
    if (!filePath) {
      res.statusCode = 404;
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      return res.end(JSON.stringify({ ok: false, code: 'NOT_FOUND', error: `Demo endpoint ${pathname} không tồn tại.` }));
    }

    // 4. Adapt Request & Response for Vercel Serverless Function
    try {
      const handler = await getHandler(filePath);

      // Collect body if not yet collected
      if (req.body === undefined && req.method !== 'GET') {
        const chunks = [];
        for await (const chunk of req) chunks.push(chunk);
        const raw = Buffer.concat(chunks).toString('utf8');
        try {
          req.body = JSON.parse(raw);
        } catch {
          req.body = raw;
        }
      }

      // Map query params
      req.query = Object.fromEntries(parsedUrl.searchParams.entries());

      // Shim res.status and res.json
      res.status = function status(code) {
        res.statusCode = code;
        return res;
      };

      res.json = function json(data) {
        if (!res.getHeader('Content-Type')) {
          res.setHeader('Content-Type', 'application/json; charset=utf-8');
        }
        res.end(JSON.stringify(data));
        return res;
      };

      // Call handler
      await handler(req, res);
    } catch (err) {
      console.error(`[DemoAPI] Error handling ${pathname}:`, err);
      if (!res.writableEnded) {
        res.statusCode = 500;
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.end(JSON.stringify({ ok: false, code: 'INTERNAL_ERROR', error: err.message || 'Lỗi xử lý Demo API' }));
      }
    }
  };
}

