import { NormalizedQuestion } from './types';
import { validateAIOutput } from './validator';

export interface RepairResult {
  success: boolean;
  questions?: NormalizedQuestion[];
  wasRepaired: boolean;
  error?: string;
}

/**
 * Programmatically cleans and repairs common LLM JSON syntax imperfections:
 * 1. Markdown code fences (```json ... ```)
 * 2. Conversational prefix/suffix commentary
 * 3. Trailing commas before closing brackets/braces (e.g. [1, 2,])
 * 4. Trimming and bracket extraction
 */
export function programmaticJsonRepair(rawText: string): {
  success: boolean;
  data?: unknown;
  wasRepaired: boolean;
  error?: string;
} {
  if (!rawText || typeof rawText !== 'string') {
    return { success: false, wasRepaired: false, error: 'Dữ liệu đầu vào rỗng.' };
  }

  const trimmed = rawText.trim();

  // 1. Direct parse attempt
  try {
    const directParsed = JSON.parse(trimmed);
    return { success: true, data: directParsed, wasRepaired: false };
  } catch {
    // Continue to repair
  }

  // 2. Programmatic cleaning
  try {
    // Strip markdown fences
    let cleaned = trimmed
      .replace(/^```(?:json)?\s*/i, '')
      .replace(/\s*```$/i, '')
      .trim();

    // Extract outer-most JSON object or array
    const firstBrace = cleaned.indexOf('{');
    const firstBracket = cleaned.indexOf('[');
    let startIdx = -1;

    if (firstBrace !== -1 && firstBracket !== -1) {
      startIdx = Math.min(firstBrace, firstBracket);
    } else {
      startIdx = firstBrace !== -1 ? firstBrace : firstBracket;
    }

    const lastBrace = cleaned.lastIndexOf('}');
    const lastBracket = cleaned.lastIndexOf(']');
    const endIdx = Math.max(lastBrace, lastBracket);

    if (startIdx !== -1 && endIdx !== -1 && endIdx > startIdx) {
      cleaned = cleaned.substring(startIdx, endIdx + 1);
    }

    // Strip trailing commas before closing braces/brackets
    cleaned = cleaned.replace(/,\s*([}\]])/g, '$1');

    // Parse repaired string
    const repairedParsed = JSON.parse(cleaned);
    return { success: true, data: repairedParsed, wasRepaired: true };
  } catch (err: unknown) {
    const errorObj = err as Error;
    return {
      success: false,
      wasRepaired: false,
      error: `Không thể phục hồi JSON: ${errorObj?.message || 'Cú pháp không hợp lệ'}`,
    };
  }
}

/**
 * Validates raw text through programmatic repair and strict schema checking.
 */
export function sanitizeAndValidateAIOutput(rawText: string): RepairResult {
  const repair = programmaticJsonRepair(rawText);

  if (!repair.success || !repair.data) {
    return {
      success: false,
      wasRepaired: false,
      error: repair.error || 'Giải mã JSON thất bại.',
    };
  }

  const schemaValidation = validateAIOutput(repair.data);
  if (!schemaValidation.valid || !schemaValidation.questions) {
    return {
      success: false,
      wasRepaired: repair.wasRepaired,
      error: schemaValidation.error || 'Cấu trúc câu hỏi không khớp schema yêu cầu.',
    };
  }

  return {
    success: true,
    questions: schemaValidation.questions,
    wasRepaired: repair.wasRepaired,
  };
}

