import { AIProvider, AIQuizRequest, ProviderResult } from '../types.js';
import { buildQuizPrompts } from '../prompt.js';
import { sanitizeAndValidateAIOutput } from '../repairJson.js';

export class GroqProvider implements AIProvider {
  public readonly id = 'groq';
  public readonly model: string;

  constructor(model?: string) {
    this.model = model || process.env.GROQ_MODEL || 'openai/gpt-oss-20b';
  }

  public isConfigured(): boolean {
    const key = process.env.GROQ_API_KEY;
    return Boolean(key && key.trim().length > 0);
  }

  public async generate(req: AIQuizRequest, signal: AbortSignal): Promise<ProviderResult> {
    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) {
      return {
        ok: false,
        provider: this.id,
        model: this.model,
        error: 'GROQ_API_KEY chưa được cấu hình trên máy chủ.',
      };
    }

    const { systemPrompt, userPrompt } = buildQuizPrompts(req);
    const url = 'https://api.groq.com/openai/v1/chat/completions';

    const bodyPayload = {
      model: this.model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.7,
    };

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify(bodyPayload),
        signal,
      });

      if (!response.ok) {
        let errorText = await response.text().catch(() => '');
        if (apiKey && errorText.includes(apiKey)) {
          errorText = errorText.replaceAll(apiKey, '[REDACTED]');
        }
        const isAuthOrClient = response.status === 401 || response.status === 403 || response.status === 400 || response.status === 404;
        return {
          ok: false,
          provider: this.id,
          model: this.model,
          error: `Groq HTTP ${response.status}: ${errorText.slice(0, 200)}`,
          retryable: !isAuthOrClient && response.status !== 429,
        };
      }

      const data = (await response.json()) as Record<string, unknown>;
      const choice = (data.choices as Array<Record<string, unknown>>)?.[0];
      const message = choice?.message as Record<string, unknown> | undefined;
      const rawText = typeof message?.content === 'string' ? message.content : '';

      if (!rawText) {
        return {
          ok: false,
          provider: this.id,
          model: this.model,
          error: 'Groq trả về nội dung rỗng.',
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
        error: sanitized.error || 'Cấu trúc câu hỏi từ Groq không hợp lệ sau khi tự sửa lỗi.',
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
        error: isAbort ? 'Quá thời gian chờ phản hồi từ Groq.' : `Lỗi gọi Groq: ${rawMsg}`,
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
    const url = 'https://api.groq.com/openai/v1/chat/completions';
    const repairPrompt = `The previous output was supposed to be valid JSON with exactly 5 multiple choice questions, each with 4 options and a correctIndex (0..3).
Error encountered: ${errorReason}
Original output snippet:
${badOutput.slice(0, 1200)}

Please output ONLY the corrected, valid JSON containing {"questions": [...]}. No explanation or markdown fences.`;

    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: this.model,
          messages: [{ role: 'user', content: repairPrompt }],
          response_format: { type: 'json_object' },
          temperature: 0.2,
        }),
        signal,
      });

      if (!res.ok) {
        return { ok: false, provider: this.id, model: this.model, error: 'Groq self-repair call failed' };
      }

      const data = (await res.json()) as Record<string, unknown>;
      const choice = (data.choices as Array<Record<string, unknown>>)?.[0];
      const message = choice?.message as Record<string, unknown> | undefined;
      const text = typeof message?.content === 'string' ? message.content : '';

      const validated = sanitizeAndValidateAIOutput(text);
      if (validated.success && validated.questions) {
        return {
          ok: true,
          provider: this.id,
          model: this.model,
          questions: validated.questions,
        };
      }

      return { ok: false, provider: this.id, model: this.model, error: validated.error || 'Groq self-repair validation failed' };
    } catch (err: unknown) {
      const errorObj = err as Error;
      return { ok: false, provider: this.id, model: this.model, error: errorObj?.message || 'Groq self-repair exception' };
    }
  }
}
