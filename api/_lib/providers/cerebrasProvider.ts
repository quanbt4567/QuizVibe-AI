import { AIProvider, AIQuizRequest, ProviderResult } from '../types.js';
import { buildQuizPrompts } from '../prompt.js';
import { sanitizeAndValidateAIOutput } from '../repairJson.js';

/**
 * CerebrasProvider is optional and DISABLED by default per strict Free-Only budget policy.
 * Only enabled when ENABLE_CEREBRAS === 'true' and a verified zero-cost API key is configured.
 */
export class CerebrasProvider implements AIProvider {
  public readonly id = 'cerebras';
  public readonly model: string;

  constructor(model?: string) {
    this.model = model || process.env.CEREBRAS_MODEL || 'llama3.1-8b';
  }

  public isConfigured(): boolean {
    const isExplicitlyEnabled = process.env.ENABLE_CEREBRAS === 'true';
    const key = process.env.CEREBRAS_API_KEY;
    return isExplicitlyEnabled && Boolean(key && key.trim().length > 0);
  }

  public async generate(req: AIQuizRequest, signal: AbortSignal): Promise<ProviderResult> {
    if (!this.isConfigured()) {
      return {
        ok: false,
        provider: this.id,
        model: this.model,
        error: 'Cerebras đang bị vô hiệu hóa theo chính sách Free-Only (yêu cầu ENABLE_CEREBRAS=true).',
      };
    }

    const apiKey = process.env.CEREBRAS_API_KEY;
    const { systemPrompt, userPrompt } = buildQuizPrompts(req);
    const url = 'https://api.cerebras.ai/v1/chat/completions';

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
        const errorText = await response.text().catch(() => '');
        return {
          ok: false,
          provider: this.id,
          model: this.model,
          error: `Cerebras HTTP ${response.status}: ${errorText.slice(0, 200)}`,
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
          error: 'Cerebras trả về nội dung rỗng.',
        };
      }

      const sanitized = sanitizeAndValidateAIOutput(rawText);
      if (!sanitized.success || !sanitized.questions) {
        return {
          ok: false,
          provider: this.id,
          model: this.model,
          error: sanitized.error || 'Cấu trúc câu hỏi từ Cerebras không hợp lệ.',
        };
      }

      return {
        ok: true,
        provider: this.id,
        model: this.model,
        questions: sanitized.questions,
      };
    } catch (err: unknown) {
      const errorObj = err as Error;
      const isAbort = errorObj?.name === 'AbortError' || signal.aborted;

      return {
        ok: false,
        provider: this.id,
        model: this.model,
        isTimeout: isAbort,
        error: isAbort ? 'Quá thời gian chờ phản hồi từ Cerebras.' : `Lỗi gọi Cerebras: ${errorObj?.message || 'Unknown'}`,
      };
    }
  }
}
