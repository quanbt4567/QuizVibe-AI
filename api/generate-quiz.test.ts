import { describe, it, expect, vi, beforeEach } from 'vitest';
import handler from './generate-quiz';
import { AIProviderRouter } from './lib/router';

vi.mock('./lib/router');

describe('Story 2.2: Serverless HTTP Endpoint /api/generate-quiz', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  const createMockReqRes = (method: string, body: any) => {
    const req = {
      method,
      body,
    };
    let statusCode = 200;
    let jsonBody: any = null;
    let headers: Record<string, string> = {};

    const res = {
      setHeader: (key: string, val: string) => {
        headers[key] = val;
      },
      status: (code: number) => {
        statusCode = code;
        return res;
      },
      json: (data: any) => {
        jsonBody = data;
        return res;
      },
      end: () => res,
      _getStatusCode: () => statusCode,
      _getJsonBody: () => jsonBody,
      _getHeaders: () => headers,
    };

    return { req, res };
  };

  it('rejects non-POST HTTP methods with HTTP 405', async () => {
    const { req, res } = createMockReqRes('GET', null);
    await handler(req, res);

    expect(res._getStatusCode()).toBe(405);
    expect(res._getJsonBody().ok).toBe(false);
    expect(res._getJsonBody().code).toBe('METHOD_NOT_ALLOWED');
  });

  it('returns HTTP 400 when request body has missing or invalid fields', async () => {
    const { req, res } = createMockReqRes('POST', { topic: '', industry: 'Cosmetics' });
    await handler(req, res);

    expect(res._getStatusCode()).toBe(400);
    expect(res._getJsonBody().ok).toBe(false);
    expect(res._getJsonBody().code).toBe('INVALID_REQUEST');
  });

  it('returns HTTP 200 when router succeeds with 5 valid questions', async () => {
    const mockQuestions = [
      { question: 'Q1', options: ['A', 'B', 'C', 'D'], correctIndex: 0 },
      { question: 'Q2', options: ['A', 'B', 'C', 'D'], correctIndex: 1 },
      { question: 'Q3', options: ['A', 'B', 'C', 'D'], correctIndex: 2 },
      { question: 'Q4', options: ['A', 'B', 'C', 'D'], correctIndex: 3 },
      { question: 'Q5', options: ['A', 'B', 'C', 'D'], correctIndex: 0 },
    ];

    vi.spyOn(AIProviderRouter.prototype, 'execute').mockResolvedValue({
      statusCode: 200,
      response: {
        ok: true,
        provider: 'gemini',
        model: 'gemini-3.8-flash',
        questions: mockQuestions as any,
      },
    });

    const { req, res } = createMockReqRes('POST', {
      topic: 'Chăm sóc da',
      industry: 'Mỹ phẩm',
      difficulty: 'Dễ',
    });

    await handler(req, res);

    expect(res._getStatusCode()).toBe(200);
    expect(res._getJsonBody().ok).toBe(true);
    expect(res._getJsonBody().provider).toBe('gemini');
    expect(res._getJsonBody().questions).toHaveLength(5);
  });

  it('returns HTTP 503 when all providers fail', async () => {
    vi.spyOn(AIProviderRouter.prototype, 'execute').mockResolvedValue({
      statusCode: 503,
      response: {
        ok: false,
        error: 'Tất cả nhà cung cấp AI miễn phí đều bận.',
        code: 'UNAVAILABLE',
        canFallback: true,
        exhaustedProviders: ['gemini', 'groq'],
      },
    });

    const { req, res } = createMockReqRes('POST', {
      topic: 'Chăm sóc da',
      industry: 'Mỹ phẩm',
    });

    await handler(req, res);

    expect(res._getStatusCode()).toBe(503);
    expect(res._getJsonBody().ok).toBe(false);
    expect(res._getJsonBody().canFallback).toBe(true);
  });

  it('returns HTTP 504 when global deadline expires', async () => {
    vi.spyOn(AIProviderRouter.prototype, 'execute').mockResolvedValue({
      statusCode: 504,
      response: {
        ok: false,
        error: 'Quá thời gian xử lý AI (9.0s).',
        code: 'TIMEOUT',
        canFallback: true,
      },
    });

    const { req, res } = createMockReqRes('POST', {
      topic: 'Chăm sóc da',
      industry: 'Mỹ phẩm',
    });

    await handler(req, res);

    expect(res._getStatusCode()).toBe(504);
    expect(res._getJsonBody().ok).toBe(false);
    expect(res._getJsonBody().code).toBe('TIMEOUT');
  });
});

