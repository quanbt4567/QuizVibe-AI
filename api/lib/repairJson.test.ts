import { describe, it, expect, vi, beforeEach } from 'vitest';
import { programmaticJsonRepair, sanitizeAndValidateAIOutput } from './repairJson';
import { GeminiProvider } from './providers/geminiProvider';
import { GroqProvider } from './providers/groqProvider';

describe('Story 2.3: AI Resilience, Programmatic Repair & One-Shot Self-Repair', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  const valid5Questions = [
    { question: 'Câu hỏi 1?', options: ['A', 'B', 'C', 'D'], correctIndex: 0 },
    { question: 'Câu hỏi 2?', options: ['A', 'B', 'C', 'D'], correctIndex: 1 },
    { question: 'Câu hỏi 3?', options: ['A', 'B', 'C', 'D'], correctIndex: 2 },
    { question: 'Câu hỏi 4?', options: ['A', 'B', 'C', 'D'], correctIndex: 3 },
    { question: 'Câu hỏi 5?', options: ['A', 'B', 'C', 'D'], correctIndex: 0 },
  ];

  describe('1. Programmatic JSON Repair', () => {
    it('successfully extracts and parses JSON wrapped in markdown fences', () => {
      const rawWithFences = `\`\`\`json
{
  "questions": ${JSON.stringify(valid5Questions)}
}
\`\`\``;

      const res = programmaticJsonRepair(rawWithFences);
      expect(res.success).toBe(true);
      expect(res.wasRepaired).toBe(true);
      expect((res.data as any).questions).toHaveLength(5);
    });

    it('cleans conversational commentary before and after the JSON block', () => {
      const rawWithCommentary = `Dưới đây là 5 câu hỏi minigame theo yêu cầu của bạn:
{
  "questions": ${JSON.stringify(valid5Questions)}
}
Chúc chiến dịch của bạn thành công rực rỡ!`;

      const res = programmaticJsonRepair(rawWithCommentary);
      expect(res.success).toBe(true);
      expect(res.wasRepaired).toBe(true);
      expect((res.data as any).questions).toHaveLength(5);
    });

    it('strips trailing commas in objects and arrays', () => {
      const rawWithTrailingCommas = `{
        "questions": [
          {
            "question": "Câu 1?",
            "options": ["A", "B", "C", "D",],
            "correctIndex": 0,
          },
          {
            "question": "Câu 2?",
            "options": ["A", "B", "C", "D",],
            "correctIndex": 1,
          },
          {
            "question": "Câu 3?",
            "options": ["A", "B", "C", "D",],
            "correctIndex": 2,
          },
          {
            "question": "Câu 4?",
            "options": ["A", "B", "C", "D",],
            "correctIndex": 3,
          },
          {
            "question": "Câu 5?",
            "options": ["A", "B", "C", "D",],
            "correctIndex": 0,
          },
        ],
      }`;

      const res = programmaticJsonRepair(rawWithTrailingCommas);
      expect(res.success).toBe(true);
      expect(res.wasRepaired).toBe(true);
      expect((res.data as any).questions).toHaveLength(5);
    });

    it('validates repaired JSON against the strict 5 questions x 4 options schema', () => {
      const raw = `\`\`\`json
{ "questions": ${JSON.stringify(valid5Questions)} }
\`\`\``;

      const result = sanitizeAndValidateAIOutput(raw);
      expect(result.success).toBe(true);
      expect(result.wasRepaired).toBe(true);
      expect(result.questions).toHaveLength(5);
      expect(result.questions![0].options).toHaveLength(4);
    });

    it('rejects repaired JSON if it fails schema requirements (e.g. only 3 questions)', () => {
      const rawFewer = `\`\`\`json
{ "questions": ${JSON.stringify(valid5Questions.slice(0, 3))} }
\`\`\``;

      const result = sanitizeAndValidateAIOutput(rawFewer);
      expect(result.success).toBe(false);
      expect(result.error).toContain('đúng 5 câu');
    });
  });

  describe('2. Model-Level One-Shot Self-Repair', () => {
    it('Gemini executes one-shot self-repair when initial output is unparseable and succeeds', async () => {
      process.env.GEMINI_API_KEY = 'mock_gemini_key';

      // 1st call: returns unparseable text
      // 2nd call (self-repair): returns valid JSON
      const fetchMock = vi
        .fn()
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            candidates: [
              {
                content: {
                  parts: [{ text: 'Here is an invalid output without JSON braces' }],
                },
              },
            ],
          }),
        } as unknown as Response)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            candidates: [
              {
                content: {
                  parts: [{ text: JSON.stringify({ questions: valid5Questions }) }],
                },
              },
            ],
          }),
        } as unknown as Response);

      global.fetch = fetchMock;

      const gemini = new GeminiProvider();
      const signal = new AbortController().signal;

      const res = await gemini.generate({ topic: 'Da dầu', industry: 'Cosmetics', difficulty: 'Dễ' }, signal);

      expect(res.ok).toBe(true);
      expect(res.questions).toHaveLength(5);
      expect(fetchMock).toHaveBeenCalledTimes(2); // exactly ONE self-repair attempt
    });

    it('Groq executes one-shot self-repair when initial output has malformed schema and succeeds', async () => {
      process.env.GROQ_API_KEY = 'mock_groq_key';

      // 1st call: returns bad schema (only 2 options)
      // 2nd call (self-repair): returns valid schema
      const fetchMock = vi
        .fn()
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            choices: [
              {
                message: {
                  content: JSON.stringify({
                    questions: [{ question: 'Q?', options: ['A', 'B'], correctIndex: 0 }],
                  }),
                },
              },
            ],
          }),
        } as unknown as Response)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            choices: [
              {
                message: {
                  content: JSON.stringify({ questions: valid5Questions }),
                },
              },
            ],
          }),
        } as unknown as Response);

      global.fetch = fetchMock;

      const groq = new GroqProvider();
      const signal = new AbortController().signal;

      const res = await groq.generate({ topic: 'Thời trang', industry: 'Fashion', difficulty: 'Dễ' }, signal);

      expect(res.ok).toBe(true);
      expect(res.questions).toHaveLength(5);
      expect(fetchMock).toHaveBeenCalledTimes(2); // exactly ONE self-repair attempt
    });

    it('rejects cleanly if one-shot self-repair also fails', async () => {
      process.env.GEMINI_API_KEY = 'mock_gemini_key';

      // Both calls return invalid data
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          candidates: [{ content: { parts: [{ text: 'Still invalid' }] } }],
        }),
      } as unknown as Response);

      const gemini = new GeminiProvider();
      const signal = new AbortController().signal;

      const res = await gemini.generate({ topic: 'Da dầu', industry: 'Cosmetics', difficulty: 'Dễ' }, signal);

      expect(res.ok).toBe(false);
      expect(res.error).toBeDefined();
    });
  });

  describe('3. Non-Retryable Error Handling (401, 403, 400, 429)', () => {
    it('marks HTTP 401 / 403 authentication errors as non-retryable', async () => {
      process.env.GEMINI_API_KEY = 'bad_key';

      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 401,
        text: async () => 'API key not valid.',
      } as unknown as Response);

      const gemini = new GeminiProvider();
      const signal = new AbortController().signal;

      const res = await gemini.generate({ topic: 'Da', industry: 'Cosmetics', difficulty: 'Dễ' }, signal);

      expect(res.ok).toBe(false);
      expect((res as any).retryable).toBe(false);
      expect(res.error).toContain('401');
    });

    it('marks HTTP 429 rate limit errors as non-retryable to trigger immediate cascade', async () => {
      process.env.GROQ_API_KEY = 'groq_key';

      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 429,
        text: async () => 'Rate limit exceeded.',
      } as unknown as Response);

      const groq = new GroqProvider();
      const signal = new AbortController().signal;

      const res = await groq.generate({ topic: 'Da', industry: 'Cosmetics', difficulty: 'Dễ' }, signal);

      expect(res.ok).toBe(false);
      expect((res as any).retryable).toBe(false);
      expect(res.error).toContain('429');
    });
  });
});

