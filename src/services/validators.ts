import { Campaign, Question, VoucherConfig, Lead, LeaderboardEntry, LeadSubmissionPayload } from '../types';

export const VIETNAMESE_PHONE_REGEX = /^(03|05|07|08|09)\d{8}$/;

/**
 * Validates whether a phone number string matches the Vietnamese 10-digit mobile spec.
 */
export function isValidVietnamesePhone(phone: string): boolean {
  if (typeof phone !== 'string') return false;
  const cleanPhone = phone.trim().replace(/\s+/g, '');
  return VIETNAMESE_PHONE_REGEX.test(cleanPhone);
}

/**
 * Masks the middle digits of a phone number for public leaderboard privacy.
 * Example: 0912345678 -> 091***5678
 * Defensively handles non-string or malformed inputs without throwing.
 */
export function maskPhoneNumber(phone?: unknown): string {
  if (typeof phone !== 'string') return '';
  const clean = phone.trim();
  if (clean.length < 7) return clean;
  return `${clean.slice(0, 3)}***${clean.slice(-4)}`;
}

/**
 * Validates a single quiz question object.
 */
export function isQuestion(obj: unknown): obj is Question {
  if (!obj || typeof obj !== 'object') return false;
  const q = obj as Record<string, unknown>;

  if (typeof q.id !== 'string' || q.id.trim() === '') return false;
  if (typeof q.question !== 'string' || q.question.trim() === '') return false;
  if (!Array.isArray(q.options) || q.options.length !== 4) return false;
  if (!q.options.every((opt) => typeof opt === 'string' && opt.trim() !== '')) return false;
  if (typeof q.correctIndex !== 'number' || !Number.isInteger(q.correctIndex)) return false;
  if (q.correctIndex < 0 || q.correctIndex > 3) return false;

  return true;
}

/**
 * Validates a voucher configuration object.
 */
export function isVoucherConfig(obj: unknown): obj is VoucherConfig {
  if (!obj || typeof obj !== 'object') return false;
  const v = obj as Record<string, unknown>;

  if (typeof v.code !== 'string' || v.code.trim() === '') return false;
  if (typeof v.discount !== 'string' || v.discount.trim() === '') return false;
  if (typeof v.description !== 'string') return false;

  return true;
}

/**
 * Validates a complete Campaign object.
 */
export function isCampaign(obj: unknown): obj is Campaign {
  if (!obj || typeof obj !== 'object') return false;
  const c = obj as Record<string, unknown>;

  if (typeof c.id !== 'string' || c.id.trim() === '') return false;
  if (typeof c.title !== 'string' || c.title.trim() === '') return false;
  if (typeof c.description !== 'string') return false;
  if (typeof c.industry !== 'string') return false;
  if (!Array.isArray(c.questions) || !c.questions.every(isQuestion)) return false;
  if (!isVoucherConfig(c.voucher)) return false;
  if (typeof c.createdAt !== 'string') return false;
  if (typeof c.updatedAt !== 'string') return false;

  return true;
}

/**
 * Validates an individual lead record.
 */
export function isLead(obj: unknown): obj is Lead {
  if (!obj || typeof obj !== 'object') return false;
  const l = obj as Record<string, unknown>;

  if (typeof l.id !== 'string' || l.id.trim() === '') return false;
  if (typeof l.fullName !== 'string' || l.fullName.trim().length < 2) return false;
  if (typeof l.phoneNumber !== 'string' || !isValidVietnamesePhone(l.phoneNumber)) return false;
  if (typeof l.score !== 'number' || l.score < 0 || l.score > 2000) return false;
  if (typeof l.voucherCode !== 'string' || l.voucherCode.trim() === '') return false;
  if (typeof l.campaignId !== 'string') return false;
  if (typeof l.submittedAt !== 'string') return false;

  return true;
}

/**
 * Validates a single LeaderboardEntry.
 */
export function isLeaderboardEntry(obj: unknown): obj is LeaderboardEntry {
  if (!obj || typeof obj !== 'object') return false;
  const e = obj as Record<string, unknown>;

  if (typeof e.id !== 'string' || e.id.trim() === '') return false;
  if (typeof e.leadId !== 'string' || e.leadId.trim() === '') return false;
  if (typeof e.fullName !== 'string' || e.fullName.trim().length < 2) return false;
  if (typeof e.phoneNumber !== 'string') return false;
  if (typeof e.maskedPhone !== 'string') return false;
  if (typeof e.score !== 'number' || e.score < 0 || e.score > 2000) return false;
  if (typeof e.timeTakenSeconds !== 'number' || e.timeTakenSeconds < 0) return false;
  if (typeof e.rank !== 'number' || e.rank < 1) return false;
  if (typeof e.submittedAt !== 'string') return false;

  return true;
}

/**
 * Validates incoming lead submission payload per AD-4 rules.
 */
export function validateLeadSubmission(payload: unknown): {
  valid: boolean;
  errors: string[];
  sanitized?: LeadSubmissionPayload;
} {
  const errors: string[] = [];
  if (!payload || typeof payload !== 'object') {
    return { valid: false, errors: ['Dữ liệu gửi lên không hợp lệ.'] };
  }

  const p = payload as Record<string, unknown>;

  const fullName = typeof p.fullName === 'string' ? p.fullName.trim() : '';
  if (fullName.length < 2) {
    errors.push('Họ và tên phải có ít nhất 2 ký tự.');
  }

  const rawPhone = typeof p.phoneNumber === 'string' ? p.phoneNumber.trim().replace(/\s+/g, '') : '';
  if (!isValidVietnamesePhone(rawPhone)) {
    errors.push('Số điện thoại không đúng định dạng di động Việt Nam (10 chữ số, đầu số 03, 05, 07, 08, 09).');
  }

  const score = typeof p.score === 'number' ? p.score : -1;
  if (score < 0 || score > 2000) {
    errors.push('Điểm số không hợp lệ (phải từ 0 đến 2.000 điểm).');
  }

  const timeTakenSeconds = typeof p.timeTakenSeconds === 'number' ? p.timeTakenSeconds : 0;
  if (timeTakenSeconds < 0) {
    errors.push('Thời gian hoàn thành không hợp lệ.');
  }

  const voucherCode = typeof p.voucherCode === 'string' ? p.voucherCode.trim() : '';
  const campaignId = typeof p.campaignId === 'string' ? p.campaignId.trim() : '';

  if (errors.length > 0) {
    return { valid: false, errors };
  }

  return {
    valid: true,
    errors: [],
    sanitized: {
      fullName,
      phoneNumber: rawPhone,
      score,
      timeTakenSeconds,
      voucherCode,
      campaignId,
    },
  };
}

export interface FormValidationResult {
  valid: boolean;
  fieldErrors: Record<string, string>;
  generalErrors: string[];
}

/**
 * Validates manual quiz builder input before saving & activating.
 */
export function validateManualQuizForm(data: {
  title?: string;
  description?: string;
  industry?: string;
  questions?: Array<{
    id?: string;
    question?: string;
    options?: string[];
    correctIndex?: number;
    explanation?: string;
  }>;
  voucher?: {
    code?: string;
    discount?: string;
    description?: string;
    expiryDate?: string;
    terms?: string;
  };
}): FormValidationResult {
  const fieldErrors: Record<string, string> = {};
  const generalErrors: string[] = [];

  // 1. Campaign metadata
  if (!data.title || data.title.trim().length < 3) {
    fieldErrors['title'] = 'Tiêu đề chiến dịch phải có ít nhất 3 ký tự.';
  }

  if (!data.industry || data.industry.trim().length === 0) {
    fieldErrors['industry'] = 'Vui lòng chọn hoặc nhập ngành hàng.';
  }

  // 2. Questions validation
  if (!Array.isArray(data.questions) || data.questions.length !== 5) {
    generalErrors.push('Chiến dịch phải chứa đúng 5 câu hỏi.');
  } else {
    data.questions.forEach((q, qIndex) => {
      const qNum = qIndex + 1;
      if (!q.question || q.question.trim().length < 5) {
        fieldErrors[`question_${qIndex}`] = `Câu hỏi ${qNum} chưa có nội dung (tối thiểu 5 ký tự).`;
      }

      if (!Array.isArray(q.options) || q.options.length !== 4) {
        fieldErrors[`options_${qIndex}`] = `Câu hỏi ${qNum} phải có đúng 4 phương án trả lời.`;
      } else {
        q.options.forEach((opt, optIndex) => {
          const optLetter = ['A', 'B', 'C', 'D'][optIndex];
          if (!opt || opt.trim().length === 0) {
            fieldErrors[`q_${qIndex}_opt_${optIndex}`] = `Đáp án ${optLetter} của Câu ${qNum} không được để trống.`;
          }
        });
      }

      if (
        typeof q.correctIndex !== 'number' ||
        q.correctIndex < 0 ||
        q.correctIndex > 3 ||
        !Number.isInteger(q.correctIndex)
      ) {
        fieldErrors[`correct_${qIndex}`] = `Vui lòng chọn 1 đáp án đúng cho Câu hỏi ${qNum}.`;
      }
    });
  }

  // 3. Voucher configuration
  if (!data.voucher) {
    generalErrors.push('Cấu hình voucher không được để trống.');
  } else {
    if (!data.voucher.code || data.voucher.code.trim().length < 2) {
      fieldErrors['voucher_code'] = 'Mã voucher phải có ít nhất 2 ký tự.';
    } else if (/\s/.test(data.voucher.code.trim())) {
      fieldErrors['voucher_code'] = 'Mã voucher không được chứa khoảng trắng.';
    }

    if (!data.voucher.discount || data.voucher.discount.trim().length === 0) {
      fieldErrors['voucher_discount'] = 'Mức giảm giá không được để trống (vd: 20% hoặc 50.000đ).';
    }

    if (!data.voucher.description || data.voucher.description.trim().length === 0) {
      fieldErrors['voucher_description'] = 'Mô tả voucher không được để trống.';
    }
  }

  const valid = Object.keys(fieldErrors).length === 0 && generalErrors.length === 0;

  return {
    valid,
    fieldErrors,
    generalErrors,
  };
}

