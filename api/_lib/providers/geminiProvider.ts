import { AIProvider, AIQuizRequest, ProviderResult } from '../types.js';
import { buildQuizPrompts } from '../prompt.js';
import { sanitizeAndValidateAIOutput } from '../repairJson.js';

export class GeminiProvider implements AIProvider {
  public readonly id = 'gemini';
  public readonly model: string;

  constructor(model?: string) {
    this.model = model || process.env.GEMINI_MODEL || 'gemini-3.8-flash';
  }

  public isConfigured(): boolean {
    const key = process.env.GEMINI_API_KEY;
    return Boolean(key && key.trim().length > 0);
  }

  public async generate(req: AIQuizRequest, signal: AbortSignal): Promise<ProviderResult> {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return {
        ok: false,
        provider: this.id,
        model: this.model,
        error: 'GEMINI_API_KEY chưa được cấu hình trên máy chủ.',
      };
    }

    const { systemPrompt, userPrompt } = buildQuizPrompts(req);
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
      this.model
    )}:generateContent?key=${encodeURIComponent(apiKey)}`;

    const bodyPayload = {
      contents: [
        {
          role: 'user',
          parts: [{ text: `${systemPrompt}\n\n${userPrompt}` }],
        },
      ],
      generationConfig: {
        responseMimeType: 'application/json',
        temperature: 0.7,
      },
    };

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(bodyPayload),
        signal,
      });

      if (!response.ok) {
        let errorText = await response.text().catch(() => '');
        if (apiKey && errorText.includes(apiKey)) {
          errorText = errorText.replaceAll(apiKey, '[REDACTED]');
        }
        // Explicitly handle 401/403/400/429 without infinite retries
        const isAuthOrClient = response.status === 401 || response.status === 403 || response.status === 400 || response.status === 404;
        return {
          ok: false,
          provider: this.id,
          model: this.model,
          error: `Gemini HTTP ${response.status}: ${errorText.slice(0, 200)}`,
          retryable: !isAuthOrClient && response.status !== 429,
        };
      }

      const data = (await response.json()) as Record<string, unknown>;
      const candidate = (data.candidates as Array<Record<string, unknown>>)?.[0];
      const content = candidate?.content as Record<string, unknown> | undefined;
      const part = (content?.parts as Array<Record<string, unknown>>)?.[0];
      const rawText = typeof part?.text === 'string' ? part.text : '';

      if (!rawText) {
        return {
          ok: false,
          provider: this.id,
          model: this.model,
          error: 'Gemini trả về nội dung rỗng.',
        };
      }

      // Step 1: Programmatic repair & validation
      const sanitized = sanitizeAndValidateAIOutput(rawText);
      if (sanitized.success && sanitized.questions) {
        return {
          ok: true,
          provider: this.id,
          model: this.model,
          questions: sanitized.questions,
        };
      }

      // Step 2: Exactly ONE model-level self-repair attempt if not aborted
      if (!signal.aborted) {
        const repairAttempt = await this.attemptOneShotSelfRepair(
          rawText,
          sanitized.error || 'Schema validation failed',
          apiKey,
          signal
        );
        if (repairAttempt.ok && repairAttempt.questions) {
          return repairAttempt;
        }
      }

      return {
        ok: false,
        provider: this.id,
        model: this.model,
        error: sanitized.error || 'Cấu trúc câu hỏi từ Gemini không hợp lệ sau khi tự sửa lỗi.',
      };
    } catch (err: unknown) {
      const errorObj = err as Error;
      const isAbort = errorObj?.name === 'AbortError' || signal.aborted;
      let rawMsg = errorObj?.message || 'Unknown';
      if (apiKey && rawMsg.includes(apiKey)) {
        rawMsg = rawMsg.replaceAll(apiKey, '[REDACTED]');
      }

      return {
        ok: false,
        provider: this.id,
        model: this.model,
        isTimeout: isAbort,
        error: isAbort ? 'Quá thời gian chờ phản hồi từ Gemini.' : `Lỗi gọi Gemini: ${rawMsg}`,
      };
    }
  }

  /**
   * Performs exactly one self-repair prompt asking the model to fix JSON formatting.
   */
  private async attemptOneShotSelfRepair(
    badOutput: string,
    errorReason: string,
    apiKey: string,
    signal: AbortSignal
  ): Promise<ProviderResult> {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
      this.model
    )}:generateContent?key=${encodeURIComponent(apiKey)}`;

    const repairPrompt = `The previous output was supposed to be valid JSON with exactly 5 multiple choice questions, each with 4 options and a correctIndex (0..3).
Error encountered: ${errorReason}
Original output snippet:
${badOutput.slice(0, 1200)}

Please output ONLY the corrected, valid JSON containing {"questions": [...]}. No explanation or markdown fences.`;

    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: repairPrompt }] }],
          generationConfig: { responseMimeType: 'application/json', temperature: 0.2 },
        }),
        signal,
      });

      if (!res.ok) {
        return { ok: false, provider: this.id, model: this.model, error: 'Self-repair call failed' };
      }

      const data = (await res.json()) as Record<string, unknown>;
      const candidate = (data.candidates as Array<Record<string, unknown>>)?.[0];
      const content = candidate?.content as Record<string, unknown> | undefined;
      const part = (content?.parts as Array<Record<string, unknown>>)?.[0];
      const text = typeof part?.text === 'string' ? part.text : '';

      const validated = sanitizeAndValidateAIOutput(text);
      if (validated.success && validated.questions) {
        return {
          ok: true,
          provider: this.id,
          model: this.model,
          questions: validated.questions,
        };
      }

      return { ok: false, provider: this.id, model: this.model, error: validated.error || 'Self-repair validation failed' };
    } catch (err: unknown) {
      const errorObj = err as Error;
      return { ok: false, provider: this.id, model: this.model, error: errorObj?.message || 'Self-repair exception' };
    }
  }
}
