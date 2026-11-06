// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { validateCampaignWriteInput } from '../_lib/campaigns/campaignValidation';
import { validateClientRequest } from '../_lib/validator';
import { buildQuizPrompts } from '../_lib/prompt';

const validQuestions = [0, 1, 2, 3, 4].map((i) => ({
  question: `Câu hỏi số ${i + 1} về ngành hàng tùy chỉnh?`,
  options: ['Đáp án A', 'Đáp án B', 'Đáp án C', 'Đáp án D'] as [string, string, string, string],
  correctIndex: 0,
  explanation: `Giải thích chi tiết cho câu hỏi ${i + 1}.`,
}));

const validVoucher = {
  code: 'CUSTOM20',
  discount: 'Giảm 20% đơn đầu tiên',
  description: 'Áp dụng cho khách hàng trải nghiệm minigame',
  expiryDate: null,
  terms: null,
};

describe('Server-Side Industry Validation & AI Prompt Construction', () => {
  describe('1. Campaign Write Input Validation (Admin API)', () => {
    it('accepts predefined industry', () => {
      const res = validateCampaignWriteInput({
        title: 'Chiến dịch Mỹ phẩm',
        description: 'Mô tả hợp lệ',
        industry: 'Mỹ phẩm & Chăm sóc da',
        isAiGenerated: false,
        isMock: false,
        questions: validQuestions,
        voucher: validVoucher,
      });

      expect(res.valid).toBe(true);
      if (res.valid) {
        expect(res.data.industry).toBe('Mỹ phẩm & Chăm sóc da');
      }
    });

    it('accepts custom industry "Đồ chơi trẻ em"', () => {
      const res = validateCampaignWriteInput({
        title: 'Chiến dịch Đồ chơi cho bé',
        description: 'Mô tả hợp lệ',
        industry: 'Đồ chơi trẻ em',
        isAiGenerated: false,
        isMock: false,
        questions: validQuestions,
        voucher: validVoucher,
      });

      expect(res.valid).toBe(true);
      if (res.valid) {
        expect(res.data.industry).toBe('Đồ chơi trẻ em');
      }
    });

    it('accepts custom industry "Nông sản sạch"', () => {
      const res = validateCampaignWriteInput({
        title: 'Tuần lễ Nông sản Sạch',
        description: 'Mô tả hợp lệ',
        industry: 'Nông sản sạch',
        isAiGenerated: false,
        isMock: false,
        questions: validQuestions,
        voucher: validVoucher,
      });

      expect(res.valid).toBe(true);
      if (res.valid) {
        expect(res.data.industry).toBe('Nông sản sạch');
      }
    });

    it('accepts custom industry up to 100 characters', () => {
      const longCustom = 'Ngành hàng cung cấp thiết bị và phụ kiện điện máy thông minh cho nhà ở cao cấp tại đô thị';
      expect(longCustom.length).toBeLessThanOrEqual(100);

      const res = validateCampaignWriteInput({
        title: 'Chiến dịch Thiết bị thông minh',
        description: 'Mô tả hợp lệ',
        industry: longCustom,
        isAiGenerated: false,
        isMock: false,
        questions: validQuestions,
        voucher: validVoucher,
      });

      expect(res.valid).toBe(true);
      if (res.valid) {
        expect(res.data.industry).toBe(longCustom);
      }
    });

    it('rejects empty or whitespace industry', () => {
      const res1 = validateCampaignWriteInput({
        title: 'Chiến dịch Lỗi',
        description: 'Mô tả',
        industry: '',
        questions: validQuestions,
        voucher: validVoucher,
      });
      expect(res1.valid).toBe(false);

      const res2 = validateCampaignWriteInput({
        title: 'Chiến dịch Lỗi',
        description: 'Mô tả',
        industry: '     ',
        questions: validQuestions,
        voucher: validVoucher,
      });
      expect(res2.valid).toBe(false);
    });

    it('rejects industry exceeding 100 characters', () => {
      const overLimit = 'X'.repeat(101);
      const res = validateCampaignWriteInput({
        title: 'Chiến dịch Quá Dài',
        description: 'Mô tả',
        industry: overLimit,
        questions: validQuestions,
        voucher: validVoucher,
      });
      expect(res.valid).toBe(false);
      if (!res.valid) {
        expect(res.fieldErrors.industry).toContain('Ngành hàng');
      }
    });
  });

  describe('2. AI Gateway Request Validation (/api/generate-quiz)', () => {
    it('accepts custom industry in generate-quiz request', () => {
      const res = validateClientRequest({
        topic: 'Chăm sóc mèo con dưới 3 tháng',
        industry: 'Dịch vụ thú cưng & thú y',
        difficulty: 'Dễ',
      });

      expect(res.valid).toBe(true);
      if (res.valid && res.data) {
        expect(res.data.industry).toBe('Dịch vụ thú cưng & thú y');
        expect(res.data.topic).toBe('Chăm sóc mèo con dưới 3 tháng');
      }
    });

    it('builds AI prompts with exact custom industry and guidance', () => {
      const req = {
        topic: 'Lựa chọn nội thất chung cư nhỏ',
        industry: 'Nội thất & Decor nhà thông minh',
        difficulty: 'Trung bình',
      };

      const { systemPrompt, userPrompt } = buildQuizPrompts(req);

      expect(userPrompt).toContain('Ngành hàng: Nội thất & Decor nhà thông minh');
      expect(userPrompt).toContain('Chủ đề minigame: Lựa chọn nội thất chung cư nhỏ');
      expect(userPrompt).toContain('Độ khó yêu cầu: Trung bình');
      expect(systemPrompt).toContain('hỗ trợ cả các ngành hàng phổ biến lẫn ngành hàng tùy chỉnh/ngách');
    });

    it('rejects generate-quiz request with empty or too short industry', () => {
      const res = validateClientRequest({
        topic: 'Chủ đề hợp lệ',
        industry: ' ',
      });
      expect(res.valid).toBe(false);
      expect(res.error).toContain('industry');
    });

    it('rejects generate-quiz request with industry exceeding 100 characters', () => {
      const res = validateClientRequest({
        topic: 'Chủ đề hợp lệ',
        industry: 'A'.repeat(101),
      });
      expect(res.valid).toBe(false);
      expect(res.error).toContain('100 ký tự');
    });
  });
});
