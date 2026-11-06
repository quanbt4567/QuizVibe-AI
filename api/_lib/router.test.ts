import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AIProviderRouter } from './router.js';
import { AIProvider, NormalizedQuestion, ProviderResult } from './types.js';
import { validateAIOutput, validateClientRequest } from './validator.js';
import { GroqProvider } from './providers/groqProvider.js';
import { GeminiProvider } from './providers/geminiProvider.js';

describe('Story 2.2: Multi-Provider AI Gateway & Router', () => {
  const validMockQuestions: NormalizedQuestion[] = [
    { question: 'Câu hỏi 1?', options: ['A', 'B', 'C', 'D'], correctIndex: 0 },
    { question: 'Câu hỏi 2?', options: ['A', 'B', 'C', 'D'], correctIndex: 1 },
    { question: 'Câu hỏi 3?', options: ['A', 'B', 'C', 'D'], correctIndex: 2 },
    { question: 'Câu hỏi 4?', options: ['A', 'B', 'C', 'D'], correctIndex: 3 },
    { question: 'Câu hỏi 5?', options: ['A', 'B', 'C', 'D'], correctIndex: 0 },
  ];

  const sampleReq = {
    topic: 'Chăm sóc da',
    industry: 'Cosmetics',
    difficulty: 'Dễ',
  };

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('1. Schema Validation (validator.ts)', () => {
    it('validates client request payload correctly', () => {
      const valid = validateClientRequest({
        topic: 'Thời trang hè',
        industry: 'Fashion',
        difficulty: 'Dễ',
      });
      expect(valid.valid).toBe(true);
      expect(valid.data?.topic).toBe('Thời trang hè');

      const invalidTopic = validateClientRequest({ topic: '', industry: 'Fashion' });
      expect(invalidTopic.valid).toBe(false);
      expect(invalidTopic.error).toContain('topic');

      const invalidIndustry = validateClientRequest({ topic: 'Áo sơ mi', industry: '' });
      expect(invalidIndustry.valid).toBe(false);
      expect(invalidIndustry.error).toContain('industry');
    });

    it('rejects AI output with wrong question counts (not exactly 5)', () => {
      const fewer = validateAIOutput([validMockQuestions[0], validMockQuestions[1]]);
      expect(fewer.valid).toBe(false);
      expect(fewer.error).toContain('đúng 5 câu');
    });

    it('rejects AI output with questions having fewer or more than 4 options', () => {
      const badOptions = [
        ...validMockQuestions.slice(0, 4),
        { question: 'Câu 5?', options: ['A', 'B'], correctIndex: 0 },
      ];
      const res = validateAIOutput(badOptions);
      expect(res.valid).toBe(false);
      expect(res.error).toContain('đúng 4 phương án');
    });

    it('rejects AI output with invalid correctIndex (e.g. 4 or negative)', () => {
      const badIndex = [
        ...validMockQuestions.slice(0, 4),
        { question: 'Câu 5?', options: ['A', 'B', 'C', 'D'], correctIndex: 4 },
      ];
      const res = validateAIOutput(badIndex);
      expect(res.valid).toBe(false);
      expect(res.error).toContain('correctIndex');
    });
  });

  describe('2. Router Sequential Priority & Fallback Execution', () => {
    it('calls Gemini first and does NOT call Groq or Cerebras when Gemini succeeds', async () => {
      const mockGemini: AIProvider = {
        id: 'gemini',
        model: 'gemini-3.8-flash',
        isConfigured: () => true,
        generate: vi.fn().mockResolvedValue({
          ok: true,
          provider: 'gemini',
          model: 'gemini-3.8-flash',
          questions: validMockQuestions,
        } as ProviderResult),
      };

      const mockGroq: AIProvider = {
        id: 'groq',
        model: 'openai/gpt-oss-20b',
        isConfigured: () => true,
        generate: vi.fn(),
      };

      const mockCerebras: AIProvider = {
        id: 'cerebras',
        model: 'llama3.1-8b',
        isConfigured: () => false,
        generate: vi.fn(),
      };

      const router = new AIProviderRouter({
        providers: [mockGemini, mockGroq, mockCerebras],
      });

      const { statusCode, response } = await router.execute(sampleReq);

      expect(statusCode).toBe(200);
      expect(response.ok).toBe(true);
      if (response.ok) {
        expect(response.provider).toBe('gemini');
        expect(response.questions).toHaveLength(5);
      }
      expect(mockGemini.generate).toHaveBeenCalledTimes(1);
      expect(mockGroq.generate).not.toHaveBeenCalled();
      expect(mockCerebras.generate).not.toHaveBeenCalled();
    });

    it('falls back to Groq when Gemini fails, and succeeds', async () => {
      const mockGemini: AIProvider = {
        id: 'gemini',
        model: 'gemini-3.8-flash',
        isConfigured: () => true,
        generate: vi.fn().mockResolvedValue({
          ok: false,
          provider: 'gemini',
          model: 'gemini-3.8-flash',
          error: 'Gemini Rate limit 429',
        } as ProviderResult),
      };

      const mockGroq: AIProvider = {
        id: 'groq',
        model: 'openai/gpt-oss-20b',
        isConfigured: () => true,
        generate: vi.fn().mockResolvedValue({
          ok: true,
          provider: 'groq',
          model: 'openai/gpt-oss-20b',
          questions: validMockQuestions,
        } as ProviderResult),
      };

      const router = new AIProviderRouter({
        providers: [mockGemini, mockGroq],
      });

      const { statusCode, response } = await router.execute(sampleReq);

      expect(statusCode).toBe(200);
      expect(response.ok).toBe(true);
      if (response.ok) {
        expect(response.provider).toBe('groq');
        expect(response.questions).toHaveLength(5);
      }
      expect(mockGemini.generate).toHaveBeenCalledTimes(1);
      expect(mockGroq.generate).toHaveBeenCalledTimes(1);
    });

    it('skips Cerebras when it is unconfigured/disabled by default', async () => {
      const mockGemini: AIProvider = {
        id: 'gemini',
        model: 'gemini-3.8-flash',
        isConfigured: () => true,
        generate: vi.fn().mockResolvedValue({ ok: false, provider: 'gemini', model: 'm', error: 'Fail' }),
      };

      const mockGroq: AIProvider = {
        id: 'groq',
        model: 'openai/gpt-oss-20b',
        isConfigured: () => true,
        generate: vi.fn().mockResolvedValue({ ok: false, provider: 'groq', model: 'm', error: 'Fail' }),
      };

      const mockCerebras: AIProvider = {
        id: 'cerebras',
        model: 'llama3.1-8b',
        isConfigured: () => false, // DISABLED BY DEFAULT
        generate: vi.fn(),
      };

      const router = new AIProviderRouter({
        providers: [mockGemini, mockGroq, mockCerebras],
      });

      const { statusCode, response } = await router.execute(sampleReq);

      expect(statusCode).toBe(503);
      expect(response.ok).toBe(false);
      expect(mockCerebras.generate).not.toHaveBeenCalled();
    });

    it('returns HTTP 503 when all configured providers fail', async () => {
      const mockGemini: AIProvider = {
        id: 'gemini',
        model: 'gemini-3.8-flash',
        isConfigured: () => true,
        generate: vi.fn().mockResolvedValue({ ok: false, provider: 'gemini', model: 'm', error: '429 Quota' }),
      };

      const mockGroq: AIProvider = {
        id: 'groq',
        model: 'openai/gpt-oss-20b',
        isConfigured: () => true,
        generate: vi.fn().mockResolvedValue({ ok: false, provider: 'groq', model: 'm', error: '500 Server error' }),
      };

      const router = new AIProviderRouter({
        providers: [mockGemini, mockGroq],
      });

      const { statusCode, response } = await router.execute(sampleReq);

      expect(statusCode).toBe(503);
      expect(response.ok).toBe(false);
      if (!response.ok) {
        expect(response.canFallback).toBe(true);
        expect(response.code).toBe('UNAVAILABLE');
      }
    });

    it('returns HTTP 504 when global deadline expires', async () => {
      // Simulate router where time expires during first call
      const slowGemini: AIProvider = {
        id: 'gemini',
        model: 'gemini-3.8-flash',
        isConfigured: () => true,
        generate: vi.fn().mockImplementation(async () => {
          // Simulate taking 500ms
          await new Promise((r) => setTimeout(r, 50));
          return { ok: false, provider: 'gemini', model: 'm', isTimeout: true, error: 'Timeout' };
        }),
      };

      const router = new AIProviderRouter({
        globalDeadlineMs: 40, // very small deadline
        minReserveMs: 20,
        providers: [slowGemini],
      });

      const { statusCode, response } = await router.execute(sampleReq);

      expect(statusCode).toBe(504);
      expect(response.ok).toBe(false);
      if (!response.ok) {
        expect(response.code).toBe('TIMEOUT');
        expect(response.canFallback).toBe(true);
      }
    });

    it('aborts underlying provider request via AbortSignal', async () => {
      let receivedSignal: AbortSignal | null = null;

      const mockProvider: AIProvider = {
        id: 'gemini',
        model: 'gemini-3.8-flash',
        isConfigured: () => true,
        generate: vi.fn().mockImplementation(async (_, signal: AbortSignal) => {
          receivedSignal = signal;
          await new Promise((resolve) => setTimeout(resolve, 100));
          return { ok: true, provider: 'gemini', model: 'm', questions: validMockQuestions };
        }),
      };

      const router = new AIProviderRouter({
        globalDeadlineMs: 5000,
        minReserveMs: 500,
        perProviderMaxMs: 30, // Shorter than provider work (100ms)
        providers: [mockProvider],
      });

      await router.execute(sampleReq);

      expect(receivedSignal).toBeDefined();
      expect((receivedSignal as AbortSignal | null)?.aborted).toBe(true);
    });
  });

  describe('3. Groq Default Model & Gemini 503 Fallback Resilience', () => {
    it('initializes GroqProvider with openai/gpt-oss-20b by default', () => {
      delete process.env.GROQ_MODEL;
      const provider = new GroqProvider();
      expect(provider.model).toBe('openai/gpt-oss-20b');
    });

    it('triggers Groq fallback when Gemini returns HTTP 503 transient failure, returning provider="groq"', async () => {
      const mockGemini503: AIProvider = {
        id: 'gemini',
        model: 'gemini-3.8-flash',
        isConfigured: () => true,
        generate: vi.fn().mockResolvedValue({
          ok: false,
          provider: 'gemini',
          model: 'gemini-3.8-flash',
          error: 'Gemini HTTP 503: This model is currently experiencing high demand.',
          retryable: true,
        } as ProviderResult),
      };

      const mockGroqSuccess: AIProvider = {
        id: 'groq',
        model: 'openai/gpt-oss-20b',
        isConfigured: () => true,
        generate: vi.fn().mockResolvedValue({
          ok: true,
          provider: 'groq',
          model: 'openai/gpt-oss-20b',
          questions: validMockQuestions,
        } as ProviderResult),
      };

      const router = new AIProviderRouter({
        providers: [mockGemini503, mockGroqSuccess],
      });

      const { statusCode, response } = await router.execute(sampleReq);

      expect(statusCode).toBe(200);
      expect(response.ok).toBe(true);
      if (response.ok) {
        expect(response.provider).toBe('groq');
        expect(response.model).toBe('openai/gpt-oss-20b');
        expect(response.questions).toHaveLength(5);
      }
      expect(mockGemini503.generate).toHaveBeenCalledTimes(1);
      expect(mockGroqSuccess.generate).toHaveBeenCalledTimes(1);
    });

    it('activates explicitly labeled Mock fallback capability (canFallback: true) when both providers fail', async () => {
      const mockGemini503: AIProvider = {
        id: 'gemini',
        model: 'gemini-3.8-flash',
        isConfigured: () => true,
        generate: vi.fn().mockResolvedValue({
          ok: false,
          provider: 'gemini',
          model: 'gemini-3.8-flash',
          error: 'Gemini HTTP 503: High demand',
        } as ProviderResult),
      };

      const mockGroqFail: AIProvider = {
        id: 'groq',
        model: 'openai/gpt-oss-20b',
        isConfigured: () => true,
        generate: vi.fn().mockResolvedValue({
          ok: false,
          provider: 'groq',
          model: 'openai/gpt-oss-20b',
          error: 'Groq HTTP 500: Server error',
        } as ProviderResult),
      };

      const router = new AIProviderRouter({
        providers: [mockGemini503, mockGroqFail],
      });

      const { statusCode, response } = await router.execute(sampleReq);

      expect(statusCode).toBe(503);
      expect(response.ok).toBe(false);
      if (!response.ok) {
        expect(response.canFallback).toBe(true);
        expect(response.exhaustedProviders).toEqual(['gemini', 'groq']);
        expect(response.code).toBe('UNAVAILABLE');
      }
    });

    it('ensures no API key is exposed in error logs or provider failure diagnostics', async () => {
      const secretKey = 'super_secret_groq_api_key_99999';
      process.env.GROQ_API_KEY = secretKey;

      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        text: async () => `Internal server error with key=${secretKey} in body`,
      } as unknown as Response);

      const groq = new GroqProvider();
      const signal = new AbortController().signal;
      const res = await groq.generate(sampleReq, signal);

      expect(res.ok).toBe(false);
      expect(res.error).not.toContain(secretKey);
      expect(res.error).toContain('[REDACTED]');
    });

    it('ensures GeminiProvider redacts API key from failure diagnostics', async () => {
      const secretKey = 'super_secret_gemini_api_key_88888';
      process.env.GEMINI_API_KEY = secretKey;

      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 503,
        text: async () => `Service unavailable with key=${secretKey}`,
      } as unknown as Response);

      const gemini = new GeminiProvider();
      const signal = new AbortController().signal;
      const res = await gemini.generate(sampleReq, signal);

      expect(res.ok).toBe(false);
      expect(res.error).not.toContain(secretKey);
      expect(res.error).toContain('[REDACTED]');
    });
  });
});
