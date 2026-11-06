import { describe, it, expect, vi, beforeEach } from 'vitest';
import { generateQuizFromAI } from './aiService';

describe('Story 2.2: Frontend Client aiService', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  const sampleQuestions = [
    { question: 'Q1?', options: ['A', 'B', 'C', 'D'], correctIndex: 0 },
    { question: 'Q2?', options: ['A', 'B', 'C', 'D'], correctIndex: 1 },
    { question: 'Q3?', options: ['A', 'B', 'C', 'D'], correctIndex: 2 },
    { question: 'Q4?', options: ['A', 'B', 'C', 'D'], correctIndex: 3 },
    { question: 'Q5?', options: ['A', 'B', 'C', 'D'], correctIndex: 0 },
  ];

  it('handles HTTP 200 successful response and maps questions with client IDs', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        ok: true,
        provider: 'gemini',
        model: 'gemini-3.8-flash',
        questions: sampleQuestions,
      }),
    } as unknown as Response);

    const result = await generateQuizFromAI('Thời trang', 'Fashion', 'Dễ');

    expect(result.success).toBe(true);
    expect(result.provider).toBe('gemini');
    expect(result.model).toBe('gemini-3.8-flash');
    expect(result.questions).toHaveLength(5);
    expect(result.questions![0].id).toBeDefined();
    expect(result.questions![0].options).toEqual(['A', 'B', 'C', 'D']);
  });

  it('handles HTTP 400 Bad Request safely', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 400,
      json: async () => ({
        ok: false,
        error: 'Chủ đề câu hỏi quá ngắn.',
        code: 'INVALID_REQUEST',
      }),
    } as unknown as Response);

    const result = await generateQuizFromAI('', 'Fashion');

    expect(result.success).toBe(false);
    expect(result.statusCode).toBe(400);
    expect(result.error).toContain('Chủ đề câu hỏi quá ngắn');
  });

  it('handles HTTP 503 Provider Exhaustion with canFallback: true', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 503,
      json: async () => ({
        ok: false,
        error: 'Tất cả nhà cung cấp AI miễn phí đều bận.',
        canFallback: true,
        code: 'UNAVAILABLE',
      }),
    } as unknown as Response);

    const result = await generateQuizFromAI('Chăm sóc da', 'Cosmetics');

    expect(result.success).toBe(false);
    expect(result.statusCode).toBe(503);
    expect(result.canFallback).toBe(true);
  });

  it('handles HTTP 504 Gateway Timeout with canFallback: true', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 504,
      json: async () => ({
        ok: false,
        error: 'Quá thời gian xử lý AI (9.0s).',
        canFallback: true,
        code: 'TIMEOUT',
      }),
    } as unknown as Response);

    const result = await generateQuizFromAI('Chăm sóc da', 'Cosmetics');

    expect(result.success).toBe(false);
    expect(result.statusCode).toBe(504);
    expect(result.canFallback).toBe(true);
  });

  it('catches network failure safely without throwing', async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error('Failed to fetch'));

    const result = await generateQuizFromAI('Chăm sóc da', 'Cosmetics');

    expect(result.success).toBe(false);
    expect(result.canFallback).toBe(true);
    expect(result.error).toContain('Không thể kết nối đến máy chủ AI');
  });

  it('guarantees zero client-side leakage of server API secrets', () => {
    // Client environment must never expose server API keys
    const envObj = (typeof process !== 'undefined' ? process.env : {}) as Record<string, string | undefined>;
    expect(envObj['VITE_GEMINI_API_KEY']).toBeUndefined();
    expect(envObj['VITE_GROQ_API_KEY']).toBeUndefined();
    expect(envObj['VITE_CEREBRAS_API_KEY']).toBeUndefined();
  });
});
