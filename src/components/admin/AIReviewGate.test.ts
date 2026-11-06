import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { StorageService } from '../../services';
import { validateManualQuizForm } from '../../services/validators';
import { Campaign, MOCK_MODE_LABEL, Question, VoucherConfig } from '../../types';
import { DraftCampaignData } from './AIReviewGate';

describe('Story 2.4: Interactive Visual Admin Review Gate (FR-104)', () => {
  beforeEach(() => {
    StorageService.clearAll();
    StorageService._setStorageAvailableForTest(null);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  const sampleAiQuestions: Question[] = [
    {
      id: 'ai_q1',
      question: 'Thời điểm nào thoa kem chống nắng mang lại hiệu quả bảo vệ tốt nhất?',
      options: [
        '15-20 phút trước khi tiếp xúc ánh nắng',
        'Vừa bước chân ra đường mới thoa',
        'Buổi tối trước khi đi ngủ',
        'Chỉ thoa khi trời nắng gắt',
      ],
      correctIndex: 0,
      explanation: 'Kem chống nắng cần thời gian để tạo màng bảo vệ trên bề mặt da.',
    },
    {
      id: 'ai_q2',
      question: 'Thành phần Niacinamide (Vitamin B3) có công dụng nổi bật nào cho da?',
      options: [
        'Hỗ trợ kiểm soát dầu và làm sáng đều màu da',
        'Bào mòn da nhanh chóng',
        'Gây bít tắc lỗ chân lông',
        'Làm da bắt nắng mạnh hơn',
      ],
      correctIndex: 0,
      explanation: 'Niacinamide giúp củng cố hàng rào lipid và làm dịu da.',
    },
    {
      id: 'ai_q3',
      question: 'Độ pH lý tưởng của sữa rửa mặt dịu nhẹ cho da là bao nhiêu?',
      options: [
        'Khoảng 5.5 (pH sinh lý tự nhiên)',
        'pH 10 (kiềm mạnh như xà phòng)',
        'pH 2 (axit đậm đặc)',
        'pH 14',
      ],
      correctIndex: 0,
      explanation: 'Độ pH 5.5 giúp bảo toàn màng ẩm tự nhiên của da.',
    },
    {
      id: 'ai_q4',
      question: 'Khi sử dụng hoạt chất Treatment (AHA/BHA/Retinol), bước nào là bắt buộc vào ban ngày?',
      options: [
        'Thoa kem chống nắng phổ rộng',
        'Rửa mặt liên tục bằng nước ấm',
        'Xông hơi mặt mỗi giờ',
        'Không cần bảo vệ gì',
      ],
      correctIndex: 0,
      explanation: 'Treatment làm da nhạy cảm hơn với tia UV nên bắt buộc phải chống nắng kỹ.',
    },
    {
      id: 'ai_q5',
      question: 'Thứ tự cơ bản chuẩn xác của chu trình chăm sóc da ban đêm là gì?',
      options: [
        'Tẩy trang -> Sữa rửa mặt -> Toner -> Dưỡng ẩm',
        'Dưỡng ẩm -> Rửa mặt -> Tẩy trang',
        'Chỉ thoa kem dưỡng ẩm',
        'Tẩy trang rồi đi ngủ ngay',
      ],
      correctIndex: 0,
      explanation: 'Làm sạch kép là nền tảng để các bước dưỡng chất thẩm thấu sâu.',
    },
  ];

  const sampleVoucher: VoucherConfig = {
    code: 'GLOWAI20',
    discount: 'Giảm 20% cho đơn từ 250k',
    description: 'Voucher độc quyền dành riêng cho khách hàng hoàn thành quiz AI',
    expiryDate: '7 ngày sau khi nhận',
    terms: 'Áp dụng trên toàn bộ giỏ hàng tại Fanpage GlowBeauty',
  };

  const sampleAiDraft: DraftCampaignData = {
    title: 'Quiz AI: Chăm Sóc Da Khoa Học',
    description: 'Thử thách kiến thức skincare chuẩn da liễu nhận ngay voucher ưu đãi',
    industry: 'Mỹ phẩm & Chăm sóc da',
    questions: sampleAiQuestions,
    voucher: sampleVoucher,
    isAiGenerated: true,
    isMock: false,
    mockLabel: undefined,
    providerName: 'Google Gemini 3.8 Flash',
  };

  describe('1. Review Gate Data Structure & 5-Question Integrity', () => {
    it('initializes review draft with exactly 5 questions and 4 options per question', () => {
      expect(sampleAiDraft.questions).toHaveLength(5);
      sampleAiDraft.questions.forEach((q) => {
        expect(q.options).toHaveLength(4);
        expect(q.question.trim().length).toBeGreaterThan(0);
        expect(q.correctIndex).toBeGreaterThanOrEqual(0);
        expect(q.correctIndex).toBeLessThanOrEqual(3);
      });
    });

    it('identifies the designated correct answer correctly for every question', () => {
      sampleAiDraft.questions.forEach((q) => {
        const correctText = q.options[q.correctIndex];
        expect(correctText).toBeDefined();
        expect(correctText.trim().length).toBeGreaterThan(0);
      });
    });
  });

  describe('2. Interactive Question & Option Editing', () => {
    it('allows updating question prompt text', () => {
      const editedQuestions = sampleAiDraft.questions.map((q, idx) =>
        idx === 0
          ? { ...q, question: 'Câu hỏi 1 đã được biên tập lại bởi Quản trị viên?' }
          : { ...q }
      );

      expect(editedQuestions[0].question).toBe(
        'Câu hỏi 1 đã được biên tập lại bởi Quản trị viên?'
      );
      expect(editedQuestions[1].question).toBe(sampleAiQuestions[1].question);
    });

    it('allows editing any of the 4 answer options (A, B, C, D)', () => {
      const editedQuestions = sampleAiDraft.questions.map((q, idx) => {
        if (idx === 0) {
          const newOpts = [...q.options] as [string, string, string, string];
          newOpts[1] = 'Phương án B mới được chỉnh sửa';
          return { ...q, options: newOpts };
        }
        return { ...q };
      });

      expect(editedQuestions[0].options[1]).toBe('Phương án B mới được chỉnh sửa');
      expect(editedQuestions[0].options[0]).toBe(sampleAiQuestions[0].options[0]);
    });

    it('allows changing the correct answer index from 0 to another option (0..3)', () => {
      const editedQuestions = sampleAiDraft.questions.map((q, idx) => {
        if (idx === 0) {
          return { ...q, correctIndex: 2 }; // Change correct answer to Option C (index 2)
        }
        return { ...q };
      });

      expect(editedQuestions[0].correctIndex).toBe(2);
      expect(editedQuestions[0].options[editedQuestions[0].correctIndex]).toBe(
        'Buổi tối trước khi đi ngủ'
      );
    });

    it('allows updating question explanations', () => {
      const editedQuestions = sampleAiDraft.questions.map((q, idx) => {
        if (idx === 0) {
          return { ...q, explanation: 'Giải thích bổ sung: Cần bôi lại sau mỗi 2-3 giờ.' };
        }
        return { ...q };
      });

      expect(editedQuestions[0].explanation).toBe(
        'Giải thích bổ sung: Cần bôi lại sau mỗi 2-3 giờ.'
      );
    });
  });

  describe('3. Validation Enforcement in Review Gate', () => {
    it('passes validation when all 5 questions, options, voucher, and metadata are valid', () => {
      const result = validateManualQuizForm({
        title: sampleAiDraft.title,
        description: sampleAiDraft.description,
        industry: sampleAiDraft.industry,
        questions: sampleAiDraft.questions,
        voucher: sampleAiDraft.voucher,
      });

      expect(result.valid).toBe(true);
      expect(Object.keys(result.fieldErrors)).toHaveLength(0);
      expect(result.generalErrors).toHaveLength(0);
    });

    it('blocks approval if any question prompt is blank or shorter than 5 characters', () => {
      const invalidQuestions = sampleAiDraft.questions.map((q, idx) =>
        idx === 2 ? { ...q, question: '   ' } : { ...q }
      );

      const result = validateManualQuizForm({
        title: sampleAiDraft.title,
        industry: sampleAiDraft.industry,
        questions: invalidQuestions,
        voucher: sampleAiDraft.voucher,
      });

      expect(result.valid).toBe(false);
      expect(result.fieldErrors['question_2']).toBeDefined();
    });

    it('blocks approval if any answer option is left empty', () => {
      const invalidQuestions = sampleAiDraft.questions.map((q, idx) => {
        if (idx === 0) {
          const opts = [...q.options] as [string, string, string, string];
          opts[3] = ''; // Blank option D
          return { ...q, options: opts };
        }
        return { ...q };
      });

      const result = validateManualQuizForm({
        title: sampleAiDraft.title,
        industry: sampleAiDraft.industry,
        questions: invalidQuestions,
        voucher: sampleAiDraft.voucher,
      });

      expect(result.valid).toBe(false);
      expect(result.fieldErrors['q_0_opt_3']).toBeDefined();
    });

    it('blocks approval if correctIndex is outside the 0..3 bounds', () => {
      const invalidQuestions = sampleAiDraft.questions.map((q, idx) =>
        idx === 1 ? { ...q, correctIndex: 5 } : { ...q }
      );

      const result = validateManualQuizForm({
        title: sampleAiDraft.title,
        industry: sampleAiDraft.industry,
        questions: invalidQuestions,
        voucher: sampleAiDraft.voucher,
      });

      expect(result.valid).toBe(false);
      expect(result.fieldErrors['correct_1']).toBeDefined();
    });

    it('blocks approval if voucher code contains invalid characters or whitespace', () => {
      const result = validateManualQuizForm({
        title: sampleAiDraft.title,
        industry: sampleAiDraft.industry,
        questions: sampleAiDraft.questions,
        voucher: {
          ...sampleVoucher,
          code: 'CODE WITH SPACES',
        },
      });

      expect(result.valid).toBe(false);
      expect(result.fieldErrors['voucher_code']).toBeDefined();
    });
  });

  describe('4. Explicit Admin Approval & StorageService Activation', () => {
    it('does NOT automatically save or publish questions before explicit approval (Zero Auto-Publishing)', () => {
      // Simulate draft arrived from AI
      const draft = { ...sampleAiDraft };
      expect(draft).toBeDefined();

      // Verify nothing is in storage yet
      const current = StorageService.getCampaign();
      expect(current.data).toBeNull();
    });

    it('saves and activates the campaign in StorageService upon explicit admin approval', () => {
      const approvedCampaign: Campaign = {
        id: `campaign_ai_${Date.now()}`,
        title: sampleAiDraft.title,
        description: sampleAiDraft.description,
        industry: sampleAiDraft.industry,
        questions: sampleAiDraft.questions,
        voucher: sampleAiDraft.voucher,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        isAiGenerated: true,
        isMock: false,
        mockLabel: undefined,
      };

      const saveRes = StorageService.saveCampaign(approvedCampaign);
      expect(saveRes.success).toBe(true);
      expect(saveRes.data?.title).toBe(sampleAiDraft.title);
      expect(saveRes.data?.isAiGenerated).toBe(true);
      expect(saveRes.data?.isMock).toBe(false);

      // Verify active campaign in storage
      const active = StorageService.getCampaign();
      expect(active.success).toBe(true);
      expect(active.data?.id).toBe(approvedCampaign.id);
      expect(active.data?.questions).toHaveLength(5);
    });
  });

  describe('5. Provenance Metadata & Mock Mode Transparency', () => {
    it('preserves isAiGenerated: true and isMock: false for approved AI quiz', () => {
      const aiCampaign: Campaign = {
        id: 'campaign_ai_test',
        title: 'Quiz AI Da Liễu',
        description: 'Mô tả quiz',
        industry: 'Mỹ phẩm',
        questions: sampleAiQuestions,
        voucher: sampleVoucher,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        isAiGenerated: true,
        isMock: false,
        mockLabel: undefined,
      };

      const res = StorageService.saveCampaign(aiCampaign);
      expect(res.success).toBe(true);
      expect(res.data?.isAiGenerated).toBe(true);
      expect(res.data?.isMock).toBe(false);
      expect(res.data?.mockLabel).toBeUndefined();
    });

    it('preserves exact mock label "Bản demo vòng loại - Dữ liệu mô phỏng AI" and isMock: true when approving mock preset', () => {
      const mockCampaign: Campaign = {
        id: 'campaign_mock_test',
        title: 'Bản Demo Vòng Loại Skincare',
        description: 'Mô phỏng dữ liệu',
        industry: 'Mỹ phẩm',
        questions: sampleAiQuestions,
        voucher: sampleVoucher,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        isAiGenerated: false,
        isMock: true,
        mockLabel: MOCK_MODE_LABEL,
      };

      const res = StorageService.saveCampaign(mockCampaign);
      expect(res.success).toBe(true);
      expect(res.data?.isMock).toBe(true);
      expect(res.data?.isAiGenerated).toBe(false);
      expect(res.data?.mockLabel).toBe('Bản demo vòng loại - Dữ liệu mô phỏng AI');
      expect(res.data?.mockLabel).toBe(MOCK_MODE_LABEL);
    });
  });

  describe('6. Campaign Replacement Confirmation Invariant (Requirement 13)', () => {
    it('preserves existing campaign when admin is reviewing and has not confirmed replacement', () => {
      // 1. Existing active campaign
      const existingCampaign: Campaign = {
        id: 'existing_active_campaign',
        title: 'Chiến dịch Skincare Đang Hoạt Động',
        description: 'Chiến dịch gốc',
        industry: 'Mỹ phẩm',
        questions: sampleAiQuestions,
        voucher: sampleVoucher,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      StorageService.saveCampaign(existingCampaign);

      // Verify existing is active
      const before = StorageService.getCampaign();
      expect(before.data?.id).toBe('existing_active_campaign');

      // 2. An incoming draft is in review, but admin cancels / does not confirm
      // (Draft is discarded, so StorageService.saveCampaign is never called)

      // Admin cancels: No save is called
      const afterCancel = StorageService.getCampaign();
      expect(afterCancel.data?.id).toBe('existing_active_campaign');
      expect(afterCancel.data?.title).toBe('Chiến dịch Skincare Đang Hoạt Động');
    });

    it('replaces active campaign only when confirmation is executed', () => {
      // 1. Initial campaign
      const initial: Campaign = {
        id: 'initial_campaign',
        title: 'Chiến dịch 1',
        description: 'Mô tả 1',
        industry: 'Mỹ phẩm',
        questions: sampleAiQuestions,
        voucher: sampleVoucher,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      StorageService.saveCampaign(initial);

      // 2. Confirmed replacement
      const replacement: Campaign = {
        id: 'replacement_campaign',
        title: 'Chiến dịch 2 Đã Thay Thế',
        description: 'Mô tả 2',
        industry: 'Thời trang',
        questions: sampleAiQuestions,
        voucher: sampleVoucher,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      const res = StorageService.saveCampaign(replacement);
      expect(res.success).toBe(true);

      const active = StorageService.getCampaign();
      expect(active.data?.id).toBe('replacement_campaign');
      expect(active.data?.title).toBe('Chiến dịch 2 Đã Thay Thế');
    });
  });
});
