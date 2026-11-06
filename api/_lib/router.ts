import {
  AIProvider,
  AIQuizRequest,
  GatewayResponse,
  ProviderId,
} from './types.js';
import { GeminiProvider } from './providers/geminiProvider.js';
import { GroqProvider } from './providers/groqProvider.js';
import { CerebrasProvider } from './providers/cerebrasProvider.js';

export interface RouterOptions {
  globalDeadlineMs?: number;
  perProviderMaxMs?: number;
  minReserveMs?: number;
  providers?: AIProvider[];
}

export interface RouterExecutionResult {
  statusCode: 200 | 503 | 504;
  response: GatewayResponse;
}

export class AIProviderRouter {
  private providers: AIProvider[];
  private globalDeadlineMs: number;
  private perProviderMaxMs: number;
  private minReserveMs: number;

  constructor(options?: RouterOptions) {
    this.globalDeadlineMs = options?.globalDeadlineMs ?? 9000; // 9.0s conservative global deadline
    this.perProviderMaxMs = options?.perProviderMaxMs ?? 4500; // Max per-provider allocation
    this.minReserveMs = options?.minReserveMs ?? 1200; // Minimum time to justify attempting network call

    // Priority 1: Gemini -> Priority 2: Groq -> Priority 3: Cerebras (disabled by default)
    this.providers = options?.providers ?? [
      new GeminiProvider(),
      new GroqProvider(),
      new CerebrasProvider(),
    ];
  }

  public async execute(req: AIQuizRequest): Promise<RouterExecutionResult> {
    const startTime = Date.now();
    const exhaustedProviders: ProviderId[] = [];
    let hadTimeout = false;

    for (const provider of this.providers) {
      // 1. Skip unconfigured or disabled providers
      if (!provider.isConfigured()) {
        continue;
      }

      // 2. Check remaining global deadline
      const elapsed = Date.now() - startTime;
      const remainingGlobalTime = this.globalDeadlineMs - elapsed;

      if (remainingGlobalTime < this.minReserveMs) {
        hadTimeout = true;
        break;
      }

      // 3. Bound provider timeout to remaining global time
      const providerBudget = Math.min(this.perProviderMaxMs, remainingGlobalTime);
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), providerBudget);

      try {
        const result = await provider.generate(req, controller.signal);
        clearTimeout(timeoutId);

        if (result.ok && result.questions && result.questions.length === 5) {
          return {
            statusCode: 200,
            response: {
              ok: true,
              provider: result.provider,
              model: result.model,
              questions: result.questions,
            },
          };
        }

        if (result.isTimeout) {
          hadTimeout = true;
        }

        exhaustedProviders.push(provider.id);
        console.warn(`[AIProviderRouter] Provider "${provider.id}" failed:`, result.error);
      } catch (err: unknown) {
        clearTimeout(timeoutId);
        exhaustedProviders.push(provider.id);
        const errorObj = err as Error;
        if (errorObj?.name === 'AbortError' || controller.signal.aborted) {
          hadTimeout = true;
        }
        console.warn(`[AIProviderRouter] Provider "${provider.id}" threw an exception:`, errorObj?.message);
      }
    }

    // 4. Return appropriate failure status
    if (hadTimeout) {
      return {
        statusCode: 504,
        response: {
          ok: false,
          error: 'Quá thời gian xử lý AI (9.0s). Vui lòng thử lại hoặc chọn bộ câu hỏi mẫu.',
          code: 'TIMEOUT',
          canFallback: true,
          exhaustedProviders,
        },
      };
    }

    return {
      statusCode: 503,
      response: {
        ok: false,
        error: 'Tất cả nhà cung cấp AI miễn phí đều bận hoặc chưa được cấu hình khóa API.',
        code: 'UNAVAILABLE',
        canFallback: true,
        exhaustedProviders,
      },
    };
  }
}

