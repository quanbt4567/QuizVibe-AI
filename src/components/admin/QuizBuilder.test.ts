import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { StorageService } from '../../services';
import { validateManualQuizForm } from '../../services/validators';
import { Campaign, Question, VoucherConfig } from '../../types';

describe('Story 2.1: Manual Quiz Creation Form & Voucher Configuration', () => {
  beforeEach(() => {
    StorageService.clearAll();
    StorageService._setStorageAvailableForTest(null);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  const validQuestions: Question[] = [
    {
      id: 'q1',
      question: 'Thứ tự đúng của quy trình skincare ban đêm là gì?',
      options: ['Làm sạch -> Dưỡng ẩm', 'Dưỡng ẩm -> Làm sạch', 'Chỉ rửa nước', 'Không làm gì'],
      correctIndex: 0,
      explanation: 'Làm sạch trước để dưỡng chất thẩm thấu.',
    },
    {
      id: 'q2',
      question: 'Hoạt chất nào giúp củng cố hàng rào lipid cho da?',
      options: ['Ceramide & B5', 'Cồn nồng độ cao', 'Hương liệu đậm đặc', 'Xà phòng kiềm'],
      correctIndex: 0,
    },
    {
      id: 'q3',
      question: 'Chỉ số SPF 50 chống được bao nhiêu phần trăm UVB?',
      options: ['Khoảng 98%', '50%', '30%', '100%'],
      correctIndex: 0,
    },
    {
      id: 'q4',
      question: 'Nên thoa kem chống nắng trước khi ra ngoài bao lâu?',
      options: ['15-20 phút', 'Vừa ra ngoài mới thoa', '2 tiếng', 'Không cần thoa'],
      correctIndex: 0,
    },
    {
      id: 'q5',
      question: 'Retinol nên thoa vào thời điểm nào?',
      options: ['Buổi tối', 'Buổi trưa nắng gắt', 'Sáng sớm', 'Bất kỳ lúc nào'],
      correctIndex: 0,
    },
  ];

  const validVoucher: VoucherConfig = {
    code: 'GLOW20',
    discount: 'Giảm 20% đơn từ 299k',
    description: 'Áp dụng cho mọi đơn hàng tại Fanpage GlowBeauty',
    expiryDate: '7 ngày sau khi nhận',
    terms: 'Áp dụng 01 lần cho mỗi khách hàng hợp lệ',
  };

  describe('1. Form Validation Rules (validateManualQuizForm)', () => {
    it('passes validation with a complete and valid 5-question form', () => {
      const result = validateManualQuizForm({
        title: 'Đố Vui Skincare Cùng GlowBeauty',
        description: 'Tham gia minigame nhận voucher',
        industry: 'Mỹ phẩm & Chăm sóc da',
        questions: validQuestions,
        voucher: validVoucher,
      });

      expect(result.valid).toBe(true);
      expect(Object.keys(result.fieldErrors)).toHaveLength(0);
      expect(result.generalErrors).toHaveLength(0);
    });

    it('blocks submission when campaign title is too short or missing', () => {
      const result = validateManualQuizForm({
        title: 'AB', // < 3 characters
        industry: 'Thời trang',
        questions: validQuestions,
        voucher: validVoucher,
      });

      expect(result.valid).toBe(false);
      expect(result.fieldErrors['title']).toBeDefined();
    });

    it('blocks submission when fewer than 5 questions are provided', () => {
      const result = validateManualQuizForm({
        title: 'Chiến dịch thiếu câu hỏi',
        industry: 'Công nghệ',
        questions: validQuestions.slice(0, 4), // Only 4 questions
        voucher: validVoucher,
      });

      expect(result.valid).toBe(false);
      expect(result.generalErrors).toContain('Chiến dịch phải chứa đúng 5 câu hỏi.');
    });

    it('blocks submission when a question text is blank or too short', () => {
      const questionsWithBlank = validQuestions.map((q, idx) =>
        idx === 1 ? { ...q, question: '   ' } : q
      );

      const result = validateManualQuizForm({
        title: 'Chiến dịch test',
        industry: 'F&B',
        questions: questionsWithBlank,
        voucher: validVoucher,
      });

      expect(result.valid).toBe(false);
      expect(result.fieldErrors['question_1']).toBeDefined();
    });

    it('blocks submission when an option field is empty (TC-04)', () => {
      const questionsWithEmptyOpt = validQuestions.map((q, idx) =>
        idx === 2 ? { ...q, options: ['Đáp án 1', '', 'Đáp án 3', 'Đáp án 4'] } : q
      );

      const result = validateManualQuizForm({
        title: 'Chiến dịch test option rỗng',
        industry: 'Thời trang',
        questions: questionsWithEmptyOpt,
        voucher: validVoucher,
      });

      expect(result.valid).toBe(false);
      expect(result.fieldErrors['q_2_opt_1']).toBeDefined();
    });

    it('blocks submission when correctIndex is invalid or missing', () => {
      const questionsWithBadCorrect = validQuestions.map((q, idx) =>
        idx === 0 ? { ...q, correctIndex: 5 } : q // Out of range 0..3
      );

      const result = validateManualQuizForm({
        title: 'Chiến dịch test correctIndex',
        industry: 'Thời trang',
        questions: questionsWithBadCorrect,
        voucher: validVoucher,
      });

      expect(result.valid).toBe(false);
      expect(result.fieldErrors['correct_0']).toBeDefined();
    });

    it('blocks submission when voucher code is missing, too short, or contains spaces', () => {
      const resShort = validateManualQuizForm({
        title: 'Chiến dịch test',
        industry: 'Mỹ phẩm',
        questions: validQuestions,
        voucher: { ...validVoucher, code: 'A' },
      });
      expect(resShort.valid).toBe(false);
      expect(resShort.fieldErrors['voucher_code']).toBeDefined();

      const resSpace = validateManualQuizForm({
        title: 'Chiến dịch test',
        industry: 'Mỹ phẩm',
        questions: validQuestions,
        voucher: { ...validVoucher, code: 'VIBE 20' }, // Has space
      });
      expect(resSpace.valid).toBe(false);
      expect(resSpace.fieldErrors['voucher_code']).toContain('không được chứa khoảng trắng');
    });

    it('blocks submission when voucher discount or description is empty', () => {
      const res = validateManualQuizForm({
        title: 'Chiến dịch test',
        industry: 'Mỹ phẩm',
        questions: validQuestions,
        voucher: { ...validVoucher, discount: '', description: '' },
      });

      expect(res.valid).toBe(false);
      expect(res.fieldErrors['voucher_discount']).toBeDefined();
      expect(res.fieldErrors['voucher_description']).toBeDefined();
    });
  });

  describe('2. Campaign Saving & Activation via StorageService', () => {
    it('persists a manually authored campaign with isMock = false and isAiGenerated = false', () => {
      const manualCampaign: Campaign = {
        id: 'campaign_manual_123',
        title: 'Đố Vui Phong Cách Thời Trang Hè',
        description: 'Thử tài phối đồ nhận voucher 50K',
        industry: 'Thời trang & Phụ kiện',
        questions: validQuestions,
        voucher: {
          code: 'SUMMER50',
          discount: 'Giảm 50.000đ cho đơn từ 350.000đ',
          description: 'Áp dụng cho toàn bộ đồ hè mới tại Fanpage',
          expiryDate: '14 ngày',
          terms: 'Mỗi khách hàng áp dụng 01 lần',
        },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        isAiGenerated: false,
        isMock: false,
        mockLabel: undefined,
      };

      const saveRes = StorageService.saveCampaign(manualCampaign);
      expect(saveRes.success).toBe(true);

      const activeRes = StorageService.getCampaign();
      expect(activeRes.success).toBe(true);
      expect(activeRes.data?.id).toBe('campaign_manual_123');
      expect(activeRes.data?.title).toBe('Đố Vui Phong Cách Thời Trang Hè');
      expect(activeRes.data?.isMock).toBe(false);
      expect(activeRes.data?.isAiGenerated).toBe(false);
      expect(activeRes.data?.mockLabel).toBeUndefined();
      expect(activeRes.data?.questions).toHaveLength(5);
    });

    it('replaces an active campaign cleanly without data corruption', () => {
      // 1. Initial campaign
      StorageService.initializeDefaults();
      expect(StorageService.getCampaign().data?.isMock).toBe(true);

      // 2. Admin saves new manual campaign
      const customCampaign: Campaign = {
        id: 'campaign_manual_custom_1',
        title: 'Thử Thách Công Nghệ VibeTech',
        description: 'Nhận voucher 100K mua sạc dự phòng',
        industry: 'Công nghệ & Phụ kiện',
        questions: validQuestions,
        voucher: {
          code: 'TECH100',
          discount: 'Giảm 100k',
          description: 'Áp dụng tại shop',
        },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        isAiGenerated: false,
        isMock: false,
      };

      const saveRes = StorageService.saveCampaign(customCampaign);
      expect(saveRes.success).toBe(true);

      const updated = StorageService.getCampaign();
      expect(updated.data?.id).toBe('campaign_manual_custom_1');
      expect(updated.data?.title).toBe('Thử Thách Công Nghệ VibeTech');
      expect(updated.data?.voucher.code).toBe('TECH100');
    });
  });
});

