import { AIQuizRequest, NormalizedQuestion } from './types.js';

/**
 * Validates incoming client HTTP POST body.
 */
export function validateClientRequest(body: unknown): {
  valid: boolean;
  error?: string;
  data?: AIQuizRequest;
} {
  if (!body || typeof body !== 'object') {
    return { valid: false, error: 'Dữ liệu yêu cầu không hợp lệ (cần JSON body).' };
  }

  const b = body as Record<string, unknown>;

  const topic = typeof b.topic === 'string' ? b.topic.trim() : '';
  const industry = typeof b.industry === 'string' ? b.industry.trim() : '';
  const difficulty = typeof b.difficulty === 'string' ? b.difficulty.trim() : 'Trung bình';

  if (!topic || topic.length < 2) {
    return { valid: false, error: 'Chủ đề câu hỏi (topic) phải có ít nhất 2 ký tự.' };
  }

  if (!industry || industry.length < 2) {
    return { valid: false, error: 'Ngành hàng (industry) không được để trống.' };
  }

  if (industry.length > 100) {
    return { valid: false, error: 'Ngành hàng (industry) tối đa 100 ký tự.' };
  }

  return {
    valid: true,
    data: {
      topic,
      industry,
      difficulty,
    },
  };
}

/**
 * Validates AI-generated questions against the strict 5 questions x 4 options schema.
 */
export function validateAIOutput(raw: unknown): {
  valid: boolean;
  questions?: NormalizedQuestion[];
  error?: string;
} {
  if (!raw || typeof raw !== 'object') {
    return { valid: false, error: 'Đầu ra AI không phải là đối tượng hợp lệ.' };
  }

  let questionsArray: unknown[] | null = null;

  if (Array.isArray(raw)) {
    questionsArray = raw;
  } else {
    const obj = raw as Record<string, unknown>;
    if (Array.isArray(obj.questions)) {
      questionsArray = obj.questions;
    }
  }

  if (!questionsArray || questionsArray.length !== 5) {
    return {
      valid: false,
      error: `Số lượng câu hỏi không hợp lệ: cần đúng 5 câu (nhận được: ${questionsArray ? questionsArray.length : 0}).`,
    };
  }

  const normalized: NormalizedQuestion[] = [];

  for (let i = 0; i < questionsArray.length; i++) {
    const item = questionsArray[i];
    if (!item || typeof item !== 'object') {
      return { valid: false, error: `Câu hỏi ${i + 1} không phải là đối tượng hợp lệ.` };
    }

    const qObj = item as Record<string, unknown>;

    // 1. Question prompt
    if (typeof qObj.question !== 'string' || qObj.question.trim().length < 5) {
      return { valid: false, error: `Câu hỏi ${i + 1} có nội dung quá ngắn hoặc trống.` };
    }

    // 2. Options
    if (!Array.isArray(qObj.options) || qObj.options.length !== 4) {
      return { valid: false, error: `Câu hỏi ${i + 1} phải có đúng 4 phương án trả lời.` };
    }

    const cleanedOptions: string[] = [];
    for (let optIdx = 0; optIdx < 4; optIdx++) {
      const opt = qObj.options[optIdx];
      if (typeof opt !== 'string' || opt.trim().length === 0) {
        return { valid: false, error: `Đáp án ${optIdx + 1} của Câu hỏi ${i + 1} không được để trống.` };
      }
      cleanedOptions.push(opt.trim());
    }

    // 3. Correct Index
    if (
      typeof qObj.correctIndex !== 'number' ||
      !Number.isInteger(qObj.correctIndex) ||
      qObj.correctIndex < 0 ||
      qObj.correctIndex > 3
    ) {
      return { valid: false, error: `Câu hỏi ${i + 1} có correctIndex không hợp lệ (phải là số nguyên 0..3).` };
    }

    const explanation = typeof qObj.explanation === 'string' ? qObj.explanation.trim() : undefined;

    normalized.push({
      question: qObj.question.trim(),
      options: [cleanedOptions[0], cleanedOptions[1], cleanedOptions[2], cleanedOptions[3]],
      correctIndex: qObj.correctIndex,
      explanation,
    });
  }

  return {
    valid: true,
    questions: normalized,
  };
}

