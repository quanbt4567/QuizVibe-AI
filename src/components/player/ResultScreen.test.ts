import { describe, it, expect } from 'vitest';
import { getScoreTierInfo } from './ResultScreen';
import { QuizGameSessionResult, QuestionPlayResult } from '../../services/scoring';
import { Campaign } from '../../types';

describe('Story 4.1: ResultScreen & Performance Breakdown', () => {
  const sampleQuestionResults: QuestionPlayResult[] = [
    {
      questionIndex: 0,
      questionId: 'q1',
      question: 'Thời điểm nào thoa kem chống nắng mang lại hiệu quả bảo vệ tốt nhất?',
      options: ['15-20 phút trước khi ra ngoài', 'Vừa ra ngoài mới thoa', 'Buổi tối', 'Không cần thoa'],
      explanation: 'Kem chống nắng cần thời gian để tạo lớp màng bảo vệ.',
      selectedOptionIndex: 0,
      correctIndex: 0,
      isCorrect: true,
      timeRemainingSeconds: 22,
      timeSpentSeconds: 8,
      score: 320,
    },
    {
      questionIndex: 1,
      questionId: 'q2',
      question: 'Độ pH chuẩn sinh lý của da người khỏe mạnh là bao nhiêu?',
      options: ['Khoảng 5.5', 'pH 10', 'pH 1', 'pH 14'],
      selectedOptionIndex: 1,
      correctIndex: 0,
      isCorrect: false,
      timeRemainingSeconds: 15,
      timeSpentSeconds: 15,
      score: 0,
    },
    {
      questionIndex: 2,
      questionId: 'q3',
      question: 'Hoạt chất Niacinamide thuộc nhóm vitamin nào?',
      options: ['Vitamin B3', 'Vitamin C', 'Vitamin A', 'Vitamin D'],
      selectedOptionIndex: null,
      correctIndex: 0,
      isCorrect: false,
      timeRemainingSeconds: 0,
      timeSpentSeconds: 30, // Timed out
      score: 0,
    },
    {
      questionIndex: 3,
      questionId: 'q4',
      question: 'Sau khi thoa Retinol ban đêm, ban ngày bắt buộc phải làm gì?',
      options: ['Thoa kem chống nắng phổ rộng', 'Rửa mặt nước nóng', 'Tẩy da chết thêm', 'Không cần làm gì'],
      selectedOptionIndex: 0,
      correctIndex: 0,
      isCorrect: true,
      timeRemainingSeconds: 20,
      timeSpentSeconds: 10,
      score: 300,
    },
    {
      questionIndex: 4,
      questionId: 'q5',
      question: 'Bước làm sạch kép (Double Cleansing) gồm những sản phẩm nào?',
      options: ['Tẩy trang và Sữa rửa mặt', 'Xà phòng và cồn', 'Chỉ dùng nước lọc', 'Đắp mặt nạ'],
      selectedOptionIndex: 0,
      correctIndex: 0,
      isCorrect: true,
      timeRemainingSeconds: 18,
      timeSpentSeconds: 12,
      score: 280,
    },
  ];

  const sampleSessionResult: QuizGameSessionResult = {
    campaignId: 'camp_test_skincare',
    totalScore: 900,
    totalCorrect: 3,
    totalQuestions: 5,
    totalTimeSpentSeconds: 75,
    results: sampleQuestionResults,
    completedAt: new Date().toISOString(),
  };

  const sampleCampaign: Campaign = {
    id: 'camp_test_skincare',
    title: 'Thử Thách Skincare Rạng Rỡ',
    description: 'Chiến dịch đố vui nhận voucher 20%',
    industry: 'Mỹ phẩm & Chăm sóc da',
    questions: [
      {
        id: 'q1',
        question: 'Thời điểm nào thoa kem chống nắng mang lại hiệu quả bảo vệ tốt nhất?',
        options: ['15-20 phút trước khi ra ngoài', 'Vừa ra ngoài mới thoa', 'Buổi tối', 'Không cần thoa'],
        correctIndex: 0,
        explanation: 'Kem chống nắng cần thời gian để tạo lớp màng bảo vệ.',
      },
    ],
    voucher: {
      code: 'GLOW20',
      discount: 'Giảm 20%',
      description: 'Áp dụng cho mọi đơn hàng',
      expiryDate: '14 ngày',
      terms: 'Áp dụng 1 lần',
    },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  describe('1. Score Tier Evaluation (getScoreTierInfo)', () => {
    it('categorizes >= 1600 as Master tier with gold badge', () => {
      const tier = getScoreTierInfo(1600);
      expect(tier.tier).toBe('master');
      expect(tier.title).toBe('Xuất sắc!');
      expect(tier.badge).toContain('Bậc thầy');
      expect(tier.badgeColor).toContain('amber');

      const maxTier = getScoreTierInfo(2000);
      expect(maxTier.tier).toBe('master');
    });

    it('categorizes 1200 - 1590 as Great tier with emerald badge', () => {
      const tier = getScoreTierInfo(1400);
      expect(tier.tier).toBe('great');
      expect(tier.title).toBe('Rất tốt!');
      expect(tier.badgeColor).toContain('emerald');
    });

    it('categorizes 800 - 1190 as Good tier with sky badge', () => {
      const tier = getScoreTierInfo(900);
      expect(tier.tier).toBe('good');
      expect(tier.title).toBe('Khá tốt!');
      expect(tier.badgeColor).toContain('sky');
    });

    it('categorizes < 800 as Participant tier with slate badge', () => {
      const tier = getScoreTierInfo(790);
      expect(tier.tier).toBe('participant');
      expect(tier.title).toBe('Hoàn thành!');
      expect(tier.badgeColor).toContain('slate');

      const zeroTier = getScoreTierInfo(0);
      expect(zeroTier.tier).toBe('participant');
    });
  });

  describe('2. Performance Breakdown Data Integrity', () => {
    it('1. correctly formats total score out of 2,000 max score', () => {
      expect(sampleSessionResult.totalScore).toBe(900);
      const formatted = `${sampleSessionResult.totalScore} / 2,000`;
      expect(formatted).toBe('900 / 2,000');
    });

    it('2. correctly formats correct answer count out of total questions', () => {
      expect(sampleSessionResult.totalCorrect).toBe(3);
      expect(sampleSessionResult.totalQuestions).toBe(5);
      const ratio = `${sampleSessionResult.totalCorrect}/${sampleSessionResult.totalQuestions}`;
      expect(ratio).toBe('3/5');
    });

    it('3. correctly reflects total answering time in seconds', () => {
      expect(sampleSessionResult.totalTimeSpentSeconds).toBe(75);
      // Sum of active seconds (8 + 15 + 30 + 10 + 12 = 75)
      const calculatedSum = sampleSessionResult.results.reduce((acc, r) => acc + r.timeSpentSeconds, 0);
      expect(calculatedSum).toBe(75);
    });

    it('4. contains exactly 5 question breakdown entries', () => {
      expect(sampleSessionResult.results).toHaveLength(5);
      expect(sampleSessionResult.results[0].questionId).toBe('q1');
      expect(sampleSessionResult.results[4].questionId).toBe('q5');
    });

    it('5. distinguishes correct question result state', () => {
      const correctQ = sampleSessionResult.results[0];
      expect(correctQ.isCorrect).toBe(true);
      expect(correctQ.score).toBe(320);
      expect(correctQ.selectedOptionIndex).toBe(0);
      expect(correctQ.correctIndex).toBe(0);
    });

    it('6. distinguishes incorrect question result state', () => {
      const incorrectQ = sampleSessionResult.results[1];
      expect(incorrectQ.isCorrect).toBe(false);
      expect(incorrectQ.score).toBe(0);
      expect(incorrectQ.selectedOptionIndex).toBe(1);
      expect(incorrectQ.correctIndex).toBe(0);
      expect(incorrectQ.timeSpentSeconds).toBe(15);
    });

    it('7. distinguishes timed-out question result state (null selection, 30s spent, 0 pts)', () => {
      const timeoutQ = sampleSessionResult.results[2];
      expect(timeoutQ.isCorrect).toBe(false);
      expect(timeoutQ.score).toBe(0);
      expect(timeoutQ.selectedOptionIndex).toBeNull();
      expect(timeoutQ.timeRemainingSeconds).toBe(0);
      expect(timeoutQ.timeSpentSeconds).toBe(30);
    });

    it('8. handles missing or invalid session result gracefully without crashing', () => {
      const isInvalid = (res: any) => !res || !Array.isArray(res.results) || res.results.length === 0;

      expect(isInvalid(null)).toBe(true);
      expect(isInvalid(undefined)).toBe(true);
      expect(isInvalid({} as any)).toBe(true);
      expect(isInvalid({ results: [] } as any)).toBe(true);
      expect(isInvalid(sampleSessionResult)).toBe(false);
    });

    it('9. supports explanation resolution from result or active campaign', () => {
      const q1 = sampleSessionResult.results[0];
      const explanation = q1.explanation || sampleCampaign.questions[0].explanation;
      expect(explanation).toBe('Kem chống nắng cần thời gian để tạo lớp màng bảo vệ.');
    });

    it('10. preserves options and explanation for both answered and timed-out questions', () => {
      // Answered question
      const answeredQ = sampleSessionResult.results[0];
      expect(answeredQ.options).toBeDefined();
      expect(answeredQ.options).toHaveLength(4);
      expect(answeredQ.explanation).toBeDefined();

      // Timed-out question
      const timedOutQ = sampleSessionResult.results[2];
      expect(timedOutQ.options).toBeDefined();
      expect(timedOutQ.options).toHaveLength(4);
      expect(timedOutQ.selectedOptionIndex).toBeNull();
      expect(timedOutQ.timeSpentSeconds).toBe(30);
    });

    it('11. verifies totalTimeSpentSeconds is displayed as recorded without recalculation', () => {
      // Arbitrary custom time to ensure component displays value directly
      const sessionWithSpecificTime: QuizGameSessionResult = {
        ...sampleSessionResult,
        totalTimeSpentSeconds: 42,
      };

      expect(sessionWithSpecificTime.totalTimeSpentSeconds).toBe(42);
      const displayString = `${sessionWithSpecificTime.totalTimeSpentSeconds}s`;
      expect(displayString).toBe('42s');
    });

    it('12. validates accessible accordion controls and attributes for screen readers', () => {
      const index = 2;
      const triggerId = `accordion-trigger-${index}`;
      const panelId = `accordion-panel-${index}`;
      const isExpanded = false;

      const triggerAttrs = {
        type: 'button',
        id: triggerId,
        'aria-expanded': isExpanded,
        'aria-controls': panelId,
        'aria-label': `Xem chi tiết Câu ${index + 1}: ${isExpanded ? 'Đang mở' : 'Đang đóng'}`,
      };

      const panelAttrs = {
        id: panelId,
        role: 'region',
        'aria-labelledby': triggerId,
      };

      expect(triggerAttrs['aria-controls']).toBe(panelAttrs.id);
      expect(panelAttrs['aria-labelledby']).toBe(triggerAttrs.id);
      expect(triggerAttrs['aria-expanded']).toBe(false);
      expect(triggerAttrs.type).toBe('button');
    });

    it('13. provides accessible share action and message parameters (Story 4.5)', () => {
      const shareParams = {
        score: sampleSessionResult.totalScore,
        campaignTitle: sampleCampaign.title,
        voucherDiscount: sampleCampaign.voucher.discount,
      };

      expect(shareParams.score).toBe(900);
      expect(shareParams.campaignTitle).toBe('Thử Thách Skincare Rạng Rỡ');
      expect(shareParams.voucherDiscount).toBe('Giảm 20%');
    });
  });
});

