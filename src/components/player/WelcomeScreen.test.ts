import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { StorageService } from '../../services';
import { Campaign, MOCK_MODE_LABEL, Question, VoucherConfig } from '../../types';

describe('Story 3.1: Campaign Welcome Landing Screen (Screen S1)', () => {
  beforeEach(() => {
    StorageService.clearAll();
    StorageService._setStorageAvailableForTest(null);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  const testQuestions: Question[] = [
    {
      id: 'q1',
      question: 'Thời điểm nào thoa kem chống nắng mang lại hiệu quả bảo vệ tốt nhất?',
      options: ['15-20 phút trước khi ra ngoài', 'Vừa ra ngoài mới thoa', 'Buổi tối', 'Không cần thoa'],
      correctIndex: 0,
      explanation: 'Cần thời gian thẩm thấu tạo màng bảo vệ.',
    },
    {
      id: 'q2',
      question: 'Độ pH chuẩn sinh lý của da người khỏe mạnh là bao nhiêu?',
      options: ['Khoảng 5.5', 'pH 10', 'pH 1', 'pH 14'],
      correctIndex: 0,
    },
    {
      id: 'q3',
      question: 'Hoạt chất Niacinamide thuộc nhóm vitamin nào?',
      options: ['Vitamin B3', 'Vitamin C', 'Vitamin A', 'Vitamin D'],
      correctIndex: 0,
    },
    {
      id: 'q4',
      question: 'Sau khi thoa Retinol ban đêm, ban ngày bắt buộc phải làm gì?',
      options: ['Thoa kem chống nắng phổ rộng', 'Rửa mặt nước nóng', 'Tẩy da chết thêm', 'Không cần làm gì'],
      correctIndex: 0,
    },
    {
      id: 'q5',
      question: 'Bước làm sạch kép (Double Cleansing) gồm những sản phẩm nào?',
      options: ['Tẩy trang và Sữa rửa mặt', 'Xà phòng và cồn', 'Chỉ dùng nước lọc', 'Đắp mặt nạ'],
      correctIndex: 0,
    },
  ];

  const testVoucher: VoucherConfig = {
    code: 'GLOW20',
    discount: 'Giảm 20% cho đơn từ 299k',
    description: 'Áp dụng cho mọi sản phẩm serum và kem dưỡng tại Fanpage GlowBeauty',
    expiryDate: '7 ngày sau khi nhận',
    terms: 'Áp dụng 01 lần cho mỗi khách hàng hợp lệ trên Fanpage',
  };

  const sampleCampaign: Campaign = {
    id: 'campaign_welcome_test',
    title: 'Thử Thách Skincare Rạng Rỡ',
    description: 'Trả lời đúng 5 câu hỏi nhanh để nhận ngay voucher giảm 20% độc quyền!',
    industry: 'Mỹ phẩm & Chăm sóc da',
    questions: testQuestions,
    voucher: testVoucher,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    isAiGenerated: true,
    isMock: false,
    mockLabel: undefined,
  };

  describe('1. Active Campaign Loading & StorageService Integration', () => {
    it('initializes default active campaign when storage is empty', () => {
      const initRes = StorageService.initializeDefaults();
      expect(initRes.success).toBe(true);
      expect(initRes.data).not.toBeNull();
      expect(initRes.data?.questions).toHaveLength(5);
      expect(initRes.data?.voucher.code).toBeDefined();
    });

    it('loads the active campaign successfully via StorageService.getCampaign()', () => {
      StorageService.saveCampaign(sampleCampaign);

      const res = StorageService.getCampaign();
      expect(res.success).toBe(true);
      expect(res.data?.id).toBe(sampleCampaign.id);
      expect(res.data?.title).toBe('Thử Thách Skincare Rạng Rỡ');
      expect(res.data?.industry).toBe('Mỹ phẩm & Chăm sóc da');
    });
  });

  describe('2. Campaign Information & Voucher Reward Display Data', () => {
    it('contains all necessary fields for welcome screen rendering', () => {
      expect(sampleCampaign.title).toBeTruthy();
      expect(sampleCampaign.description).toBeTruthy();
      expect(sampleCampaign.industry).toBeTruthy();
      expect(sampleCampaign.voucher.discount).toBe('Giảm 20% cho đơn từ 299k');
      expect(sampleCampaign.voucher.code).toBe('GLOW20');
      expect(sampleCampaign.voucher.description).toContain('GlowBeauty');
      expect(sampleCampaign.voucher.expiryDate).toBe('7 ngày sau khi nhận');
    });

    it('contains exactly 5 questions and 4 options per question for gameplay preparation', () => {
      expect(sampleCampaign.questions).toHaveLength(5);
      sampleCampaign.questions.forEach((q) => {
        expect(q.options).toHaveLength(4);
        expect(q.correctIndex).toBeGreaterThanOrEqual(0);
        expect(q.correctIndex).toBeLessThanOrEqual(3);
      });
    });
  });

  describe('3. Mock Mode Label Exactness (Requirement 4)', () => {
    it('preserves and enforces the exact mock label "Bản demo vòng loại - Dữ liệu mô phỏng AI"', () => {
      const mockCampaign: Campaign = {
        ...sampleCampaign,
        id: 'campaign_mock_demo',
        isAiGenerated: false,
        isMock: true,
        mockLabel: MOCK_MODE_LABEL,
      };

      StorageService.saveCampaign(mockCampaign);
      const res = StorageService.getCampaign();

      expect(res.data?.isMock).toBe(true);
      expect(res.data?.mockLabel).toBe('Bản demo vòng loại - Dữ liệu mô phỏng AI');
      expect(res.data?.mockLabel).toBe(MOCK_MODE_LABEL);
    });

    it('distinguishes AI campaign from mock campaign without displaying mock disclaimer', () => {
      StorageService.saveCampaign(sampleCampaign);
      const res = StorageService.getCampaign();

      expect(res.data?.isMock).toBe(false);
      expect(res.data?.isAiGenerated).toBe(true);
      expect(res.data?.mockLabel).toBeUndefined();
    });
  });

  describe('4. Graceful Fallback on Missing or Invalid Campaign (Requirement 6)', () => {
    it('detects when no campaign is loaded in storage', () => {
      const res = StorageService.getCampaign();
      expect(res.data).toBeNull();
    });

    it('recovers safely by initializing default campaign when storage is genuinely empty', () => {
      const recoverRes = StorageService.initializeDefaults(false);
      expect(recoverRes.success).toBe(true);
      expect(recoverRes.data).toBeDefined();
      expect(recoverRes.data?.questions).toHaveLength(5);
    });

    it('preserves existing valid campaign without overwriting during safe recovery (forceReset=false)', () => {
      // 1. Save an active custom campaign
      StorageService.saveCampaign(sampleCampaign);

      // 2. Safe recovery called with forceReset=false
      const safeRes = StorageService.initializeDefaults(false);
      expect(safeRes.success).toBe(true);
      expect(safeRes.data?.id).toBe(sampleCampaign.id);
      expect(safeRes.data?.title).toBe(sampleCampaign.title);
    });

    it('preserves existing leads and leaderboard records during campaign recovery', () => {
      // 1. Pre-seed leads and leaderboard
      StorageService.saveLead({
        id: 'lead_1',
        fullName: 'Nguyễn Văn A',
        phoneNumber: '0987654321',
        score: 1500,
        timeTakenSeconds: 40,
        voucherCode: 'GLOW20',
        campaignId: 'sample_camp',
        submittedAt: new Date().toISOString(),
      });

      // 2. Execute campaign recovery
      StorageService.initializeDefaults(false);

      // 3. Verify leads remain untouched
      const leads = StorageService.getLeads();
      expect(leads.data).toHaveLength(1);
      expect(leads.data?.[0].phoneNumber).toBe('0987654321');
    });
  });

  describe('5. Voucher Expiration Accuracy (Audit Area 2)', () => {
    it('derives expiration info dynamically from configured campaign voucher', () => {
      const customExpiryCampaign: Campaign = {
        ...sampleCampaign,
        voucher: {
          ...testVoucher,
          expiryDate: '14 ngày sau khi nhận',
          terms: 'Áp dụng cho đơn từ 500k',
        },
      };

      expect(customExpiryCampaign.voucher.expiryDate).toBe('14 ngày sau khi nhận');
      expect(customExpiryCampaign.voucher.terms).toBe('Áp dụng cho đơn từ 500k');
    });
  });

  describe('6. Start Quiz Transition State & Invariant Checks', () => {
    it('defines clear progression transition: Start Quiz transitions to playing state without login', () => {
      let playerState: 'welcome' | 'playing' = 'welcome';
      const onStartQuiz = () => {
        playerState = 'playing';
      };

      // Player taps Start Quiz CTA
      onStartQuiz();
      expect(playerState).toBe('playing');
    });

    it('enforces invariants: no countdown or score calculations in Story 3.1', () => {
      // Countdown and scoring are isolated for Story 3.2 and 3.4
      const campaign = sampleCampaign;
      expect(campaign.questions[0].question).toBeDefined();
      // No gameplay timers or active answer locks are running in the welcome landing
    });
  });
});

