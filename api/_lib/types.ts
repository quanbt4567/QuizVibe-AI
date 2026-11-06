export interface AIQuizRequest {
  topic: string;
  difficulty: string; // 'Dễ' | 'Trung bình' | 'Khó'
  industry: string;
}

export interface NormalizedQuestion {
  question: string;
  options: [string, string, string, string];
  correctIndex: number; // 0..3
  explanation?: string;
}

export type ProviderId = 'gemini' | 'groq' | 'cerebras';

export interface ProviderResult {
  ok: boolean;
  provider: ProviderId;
  model: string;
  questions?: NormalizedQuestion[];
  error?: string;
  isTimeout?: boolean;
  retryable?: boolean;
}

export interface AIProvider {
  readonly id: ProviderId;
  readonly model: string;
  isConfigured(): boolean;
  generate(req: AIQuizRequest, signal: AbortSignal): Promise<ProviderResult>;
}

export type GatewaySuccessResponse = {
  ok: true;
  provider: ProviderId;
  model: string;
  questions: NormalizedQuestion[];
};

export type GatewayErrorResponse = {
  ok: false;
  error: string;
  code?: 'INVALID_REQUEST' | 'TIMEOUT' | 'UNAVAILABLE';
  canFallback?: boolean;
  exhaustedProviders?: string[];
};

export type GatewayResponse = GatewaySuccessResponse | GatewayErrorResponse;

