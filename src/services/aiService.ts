import { Question } from '../types';

export interface AIGenerationResult {
  success: boolean;
  provider?: 'gemini' | 'groq' | 'cerebras';
  model?: string;
  questions?: Question[];
  error?: string;
  canFallback?: boolean;
  statusCode?: number;
}

/**
 * Client service invoking the serverless /api/generate-quiz gateway.
 * Zero API keys or secrets are stored or transmitted by this service (AD-2).
 */
export async function generateQuizFromAI(
  topic: string,
  industry: string,
  difficulty: string = 'Trung bình'
): Promise<AIGenerationResult> {
  const payload = {
    topic: topic.trim(),
    industry: industry.trim(),
    difficulty: difficulty.trim(),
  };

  try {
    const response = await fetch('/api/generate-quiz', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    const data = await response.json().catch(() => null);

    if (response.ok && data?.ok && Array.isArray(data.questions)) {
      // Map normalized questions to client Question models with unique IDs
      const mappedQuestions: Question[] = data.questions.map(
        (q: { question: string; options: [string, string, string, string]; correctIndex: number; explanation?: string }, index: number) => ({
          id: `q_ai_${index + 1}_${Date.now()}`,
          question: q.question,
          options: q.options,
          correctIndex: q.correctIndex,
          explanation: q.explanation,
        })
      );

      return {
        success: true,
        provider: data.provider,
        model: data.model,
        questions: mappedQuestions,
        statusCode: response.status,
      };
    }

    // Server returned 400, 503, 504, or non-200
    const errorMessage = data?.error || `Máy chủ phản hồi mã lỗi ${response.status}.`;
    return {
      success: false,
      error: errorMessage,
      canFallback: data?.canFallback ?? true,
      statusCode: response.status,
    };
  } catch (err: unknown) {
    const errorObj = err as Error;
    return {
      success: false,
      error: `Không thể kết nối đến máy chủ AI: ${errorObj?.message || 'Lỗi mạng'}`,
      canFallback: true,
      statusCode: 0,
    };
  }
}

