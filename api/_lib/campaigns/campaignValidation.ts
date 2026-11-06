import { assertServerRuntime } from '../db/config.js';

assertServerRuntime();

/**
 * Server-side validation for Admin campaign writes.
 * The browser is never trusted: `status`, `slug`, `published_at`, ids and timestamps in the
 * request body are IGNORED (lifecycle changes only happen through explicit transition actions).
 */

export const CAMPAIGN_QUESTION_COUNT = 5;
export const CAMPAIGN_OPTION_COUNT = 4;

export const LIMITS = {
  title: { min: 3, max: 120 },
  description: { max: 500 },
  industry: { min: 1, max: 100 },
  mockLabel: { max: 120 },
  question: { min: 5, max: 300 },
  option: { min: 1, max: 150 },
  explanation: { max: 500 },
  voucherCode: { min: 2, max: 40 },
  voucherDiscount: { min: 1, max: 120 },
  voucherDescription: { min: 1, max: 300 },
  voucherExpiry: { max: 120 },
  voucherTerms: { max: 300 },
} as const;

export interface ValidatedQuestionInput {
  question_text: string;
  options: [string, string, string, string];
  correct_index: number;
  explanation: string | null;
}

export interface ValidatedVoucherInput {
  code: string;
  discount: string;
  description: string;
  expiry_date: string | null;
  terms: string | null;
}

export interface ValidatedCampaignInput {
  title: string;
  description: string;
  industry: string;
  is_ai_generated: boolean;
  is_mock: boolean;
  mock_label: string | null;
  questions: ValidatedQuestionInput[];
  voucher: ValidatedVoucherInput;
}

export type CampaignValidationResult =
  | { valid: true; data: ValidatedCampaignInput }
  | { valid: false; fieldErrors: Record<string, string> };

function asTrimmedString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function optionalString(value: unknown): string | null {
  const s = asTrimmedString(value);
  return s === '' ? null : s;
}

/**
 * Validates and normalizes a campaign write payload (client `Campaign` shape).
 */
export function validateCampaignWriteInput(body: unknown): CampaignValidationResult {
  const errors: Record<string, string> = {};

  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return { valid: false, fieldErrors: { body: 'Dữ liệu chiến dịch không hợp lệ.' } };
  }
  const b = body as Record<string, unknown>;

  const title = asTrimmedString(b.title);
  if (title.length < LIMITS.title.min || title.length > LIMITS.title.max) {
    errors.title = `Tiêu đề phải từ ${LIMITS.title.min} đến ${LIMITS.title.max} ký tự.`;
  }

  const description = asTrimmedString(b.description);
  if (description.length > LIMITS.description.max) {
    errors.description = `Mô tả tối đa ${LIMITS.description.max} ký tự.`;
  }

  const industry = asTrimmedString(b.industry);
  if (industry.length < LIMITS.industry.min || industry.length > LIMITS.industry.max) {
    errors.industry = 'Ngành hàng không hợp lệ.';
  }

  const isMock = b.isMock === true;
  const mockLabel = isMock ? optionalString(b.mockLabel) : null;
  if (mockLabel && mockLabel.length > LIMITS.mockLabel.max) {
    errors.mockLabel = 'Nhãn bản demo quá dài.';
  }

  const questions: ValidatedQuestionInput[] = [];
  if (!Array.isArray(b.questions) || b.questions.length !== CAMPAIGN_QUESTION_COUNT) {
    errors.questions = `Chiến dịch phải chứa đúng ${CAMPAIGN_QUESTION_COUNT} câu hỏi.`;
  } else {
    b.questions.forEach((raw, i) => {
      const num = i + 1;
      if (!raw || typeof raw !== 'object') {
        errors[`question_${i}`] = `Câu hỏi ${num} không hợp lệ.`;
        return;
      }
      const q = raw as Record<string, unknown>;
      const text = asTrimmedString(q.question);
      if (text.length < LIMITS.question.min || text.length > LIMITS.question.max) {
        errors[`question_${i}`] = `Câu hỏi ${num} phải từ ${LIMITS.question.min} đến ${LIMITS.question.max} ký tự.`;
      }

      let optionsOk = true;
      const options: string[] = [];
      if (!Array.isArray(q.options) || q.options.length !== CAMPAIGN_OPTION_COUNT) {
        errors[`options_${i}`] = `Câu hỏi ${num} phải có đúng ${CAMPAIGN_OPTION_COUNT} phương án.`;
        optionsOk = false;
      } else {
        q.options.forEach((opt, optIdx) => {
          const o = asTrimmedString(opt);
          if (o.length < LIMITS.option.min || o.length > LIMITS.option.max) {
            errors[`q_${i}_opt_${optIdx}`] = `Đáp án ${'ABCD'[optIdx]} của câu ${num} không hợp lệ.`;
            optionsOk = false;
          }
          options.push(o);
        });
      }

      const ci = q.correctIndex;
      if (typeof ci !== 'number' || !Number.isInteger(ci) || ci < 0 || ci > 3) {
        errors[`correct_${i}`] = `Câu ${num} phải có đúng một đáp án đúng (0..3).`;
      }

      const explanation = optionalString(q.explanation);
      if (explanation && explanation.length > LIMITS.explanation.max) {
        errors[`explanation_${i}`] = `Giải thích câu ${num} quá dài.`;
      }

      if (!errors[`question_${i}`] && optionsOk && !errors[`correct_${i}`]) {
        questions.push({
          question_text: text,
          options: options as [string, string, string, string],
          correct_index: ci as number,
          explanation,
        });
      }
    });
  }

  const vRaw = b.voucher;
  let voucher: ValidatedVoucherInput | null = null;
  if (!vRaw || typeof vRaw !== 'object' || Array.isArray(vRaw)) {
    errors.voucher = 'Cấu hình voucher không được để trống.';
  } else {
    const v = vRaw as Record<string, unknown>;
    const code = asTrimmedString(v.code).toUpperCase();
    if (code.length < LIMITS.voucherCode.min || code.length > LIMITS.voucherCode.max) {
      errors.voucher_code = `Mã voucher phải từ ${LIMITS.voucherCode.min} đến ${LIMITS.voucherCode.max} ký tự.`;
    } else if (/\s/.test(code)) {
      errors.voucher_code = 'Mã voucher không được chứa khoảng trắng.';
    }

    const discount = asTrimmedString(v.discount);
    if (discount.length < LIMITS.voucherDiscount.min || discount.length > LIMITS.voucherDiscount.max) {
      errors.voucher_discount = 'Mức ưu đãi không hợp lệ.';
    }

    const vDescription = asTrimmedString(v.description);
    if (
      vDescription.length < LIMITS.voucherDescription.min ||
      vDescription.length > LIMITS.voucherDescription.max
    ) {
      errors.voucher_description = 'Mô tả voucher không hợp lệ.';
    }

    const expiry = optionalString(v.expiryDate);
    if (expiry && expiry.length > LIMITS.voucherExpiry.max) {
      errors.voucher_expiryDate = 'Hạn sử dụng quá dài.';
    }
    const terms = optionalString(v.terms);
    if (terms && terms.length > LIMITS.voucherTerms.max) {
      errors.voucher_terms = 'Điều khoản quá dài.';
    }

    if (
      !errors.voucher_code &&
      !errors.voucher_discount &&
      !errors.voucher_description &&
      !errors.voucher_expiryDate &&
      !errors.voucher_terms
    ) {
      voucher = {
        code,
        discount,
        description: vDescription,
        expiry_date: expiry,
        terms,
      };
    }
  }

  if (Object.keys(errors).length > 0 || !voucher || questions.length !== CAMPAIGN_QUESTION_COUNT) {
    return { valid: false, fieldErrors: errors };
  }

  return {
    valid: true,
    data: {
      title,
      description,
      industry,
      is_ai_generated: b.isAiGenerated === true,
      is_mock: isMock,
      mock_label: mockLabel,
      questions,
      voucher,
    },
  };
}

/**
 * Builds the RPC payload. Questions are emitted in a fixed order (0..4) so ordering is deterministic.
 */
export function buildSavePayload(
  data: ValidatedCampaignInput,
  slug: string | null
): Record<string, unknown> {
  return {
    ...(slug ? { slug } : {}),
    title: data.title,
    description: data.description,
    industry: data.industry,
    is_ai_generated: data.is_ai_generated,
    is_mock: data.is_mock,
    mock_label: data.mock_label,
    questions: data.questions.map((q, order) => ({
      question_order: order,
      question_text: q.question_text,
      options: q.options,
      correct_index: q.correct_index,
      explanation: q.explanation,
    })),
    voucher: data.voucher,
  };
}

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isValidCampaignId(id: unknown): id is string {
  return typeof id === 'string' && UUID_REGEX.test(id);
}

export const PUBLIC_SLUG_REGEX = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function isValidPublicSlug(slug: unknown): slug is string {
  return typeof slug === 'string' && slug.length >= 3 && slug.length <= 100 && PUBLIC_SLUG_REGEX.test(slug);
}

