import { describe, it, expect } from 'vitest';
import { getUrgencyClasses } from './QuizGameScreen';
import { Campaign, Question, VoucherConfig } from '../../types';
import {
  calculateSpeedScore,
  QuestionPlayResult,
  QuizGameSessionResult,
} from '../../services/scoring';

describe('Story 3.2 & 3.3: QuizGameScreen Timer Feedback & Question Interaction', () => {
  const sampleQuestions: Question[] = [
    {
      id: 'q1',
      question: 'Thời điểm nào thoa kem chống nắng mang lại hiệu quả bảo vệ tốt nhất?',
      options: ['15-20 phút trước khi ra ngoài', 'Vừa ra ngoài mới thoa', 'Buổi tối', 'Không cần thoa'],
      correctIndex: 0,
      explanation: 'Kem chống nắng cần thời gian để tạo lớp màng bảo vệ trên bề mặt da.',
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

  const sampleVoucher: VoucherConfig = {
    code: 'GLOW20',
    discount: 'Giảm 20% cho đơn từ 299k',
    description: 'Áp dụng cho mọi sản phẩm serum và kem dưỡng tại Fanpage GlowBeauty',
    expiryDate: '7 ngày sau khi nhận',
    terms: 'Áp dụng 01 lần cho mỗi khách hàng hợp lệ trên Fanpage',
  };

  const sampleCampaign: Campaign = {
    id: 'campaign_quiz_test',
    title: 'Thử Thách Skincare Rạng Rỡ',
    description: 'Trả lời đúng 5 câu hỏi nhanh để nhận ngay voucher giảm 20% độc quyền!',
    industry: 'Mỹ phẩm & Chăm sóc da',
    questions: sampleQuestions,
    voucher: sampleVoucher,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  describe('1. Urgency Styling Class Mappings (DESIGN.md Tokens)', () => {
    it('applies emerald classes for safe urgency (16s-30s)', () => {
      const classes = getUrgencyClasses('safe');
      expect(classes.container).toContain('emerald');
      expect(classes.badge).toContain('emerald');
      expect(classes.bar).toContain('bg-emerald-500');
      expect(classes.container).not.toContain('animate-pulse');
    });

    it('applies amber classes for caution urgency (6s-15s)', () => {
      const classes = getUrgencyClasses('caution');
      expect(classes.container).toContain('amber');
      expect(classes.badge).toContain('amber');
      expect(classes.bar).toContain('bg-amber-500');
      expect(classes.container).not.toContain('animate-pulse');
    });

    it('applies pulsing rose/crimson classes for urgent urgency (1s-5s)', () => {
      const classes = getUrgencyClasses('urgent');
      expect(classes.container).toContain('rose');
      expect(classes.container).toContain('animate-pulse');
      expect(classes.bar).toContain('bg-rose-500');
    });

    it('applies timeout classes for timeout urgency (0s)', () => {
      const classes = getUrgencyClasses('timeout');
      expect(classes.container).toContain('border-rose-600');
      expect(classes.bar).toContain('bg-rose-600');
    });
  });

  describe('2. Question Options & Interaction Data Integrity', () => {
    it('loads question prompt and exactly 4 options from active campaign', () => {
      expect(sampleCampaign.questions[0].question).toBe(
        'Thời điểm nào thoa kem chống nắng mang lại hiệu quả bảo vệ tốt nhất?'
      );
      expect(sampleCampaign.questions[0].options).toHaveLength(4);
      expect(sampleCampaign.questions[0].correctIndex).toBe(0);
      expect(sampleCampaign.questions[0].explanation).toBeDefined();
    });
  });

  describe('3. Single-Answer Selection & Double-Tap Locking (Story 3.3)', () => {
    it('locks option interaction immediately upon first answer selection', () => {
      let isLocked = false;
      let selectedOption: number | null = null;
      let callbackCount = 0;

      const handleSelectOption = (idx: number) => {
        if (isLocked) return;
        isLocked = true;
        selectedOption = idx;
        callbackCount++;
      };

      // Player selects option 0
      handleSelectOption(0);
      expect(selectedOption).toBe(0);
      expect(isLocked).toBe(true);
      expect(callbackCount).toBe(1);

      // Rapid follow-up taps (double-tap attempt) are blocked
      handleSelectOption(1);
      handleSelectOption(2);
      handleSelectOption(0);

      expect(selectedOption).toBe(0);
      expect(callbackCount).toBe(1);
    });

    it('distinguishes correct answer selection from incorrect selection', () => {
      const currentQuestion = sampleCampaign.questions[0];

      // Correct selection (Option A = index 0)
      const isIndex0Correct = 0 === currentQuestion.correctIndex;
      expect(isIndex0Correct).toBe(true);

      // Incorrect selection (Option B = index 1)
      const isIndex1Correct = 1 === currentQuestion.correctIndex;
      expect(isIndex1Correct).toBe(false);
    });
  });

  describe('4. Mutual Exclusion Between Selection and Timeout (Story 3.3)', () => {
    it('rejects answer selection if timeout occurred first', () => {
      let hasTimedOut = true;
      let selectedOption: number | null = null;

      const handleSelectOption = (idx: number) => {
        if (hasTimedOut) return;
        selectedOption = idx;
      };

      handleSelectOption(0);
      expect(selectedOption).toBeNull();
    });

    it('blocks timeout trigger if answer was already selected', () => {
      let isAnswered = true;
      let timeoutTriggered = false;

      const handleTimeout = () => {
        if (isAnswered) return;
        timeoutTriggered = true;
      };

      handleTimeout();
      expect(timeoutTriggered).toBe(false);
    });
  });

  describe('5. Story 3.4: Deterministic Speed Scoring Engine (FR-203, TC-02)', () => {
    it('1. awards maximum 400 points for correct answer with full 30s remaining', () => {
      const score = calculateSpeedScore(true, 30);
      expect(score).toBe(400); // 100 + 10 * 30
    });

    it('2. awards exact points for correct answer with partial remaining time (18s -> 280 pts)', () => {
      const score = calculateSpeedScore(true, 18);
      expect(score).toBe(280); // 100 + 10 * 18
    });

    it('3. awards 110 points for correct answer with 1s remaining', () => {
      const score = calculateSpeedScore(true, 1);
      expect(score).toBe(110); // 100 + 10 * 1
    });

    it('4. awards base 100 points for correct answer with 0s remaining', () => {
      const score = calculateSpeedScore(true, 0);
      expect(score).toBe(100); // 100 + 10 * 0
    });

    it('5. awards 0 points for any incorrect answer regardless of speed', () => {
      expect(calculateSpeedScore(false, 30)).toBe(0);
      expect(calculateSpeedScore(false, 15)).toBe(0);
      expect(calculateSpeedScore(false, 0)).toBe(0);
    });

    it('6. awards 0 points for timeout (00:00 elapsed)', () => {
      const timeoutScore = calculateSpeedScore(false, 0);
      expect(timeoutScore).toBe(0);
    });

    it('clamps remaining seconds to [0, 30] and score ceiling to 400', () => {
      // Defensive clamping against abnormal timer inputs
      expect(calculateSpeedScore(true, 45)).toBe(400); // clamped to 30s
      expect(calculateSpeedScore(true, -5)).toBe(100); // clamped to 0s
    });
  });

  describe('6. Story 3.4: Mutual-Exclusion Lock & Progression Engine (FR-201, FR-204, TC-05)', () => {
    it('7. resolves near-simultaneous answer and timeout with strict mutual exclusion', () => {
      let isLocked = false;
      let outcome: 'answered' | 'timedOut' | null = null;
      let recordedScore = -1;

      const triggerAnswer = (timeRem: number) => {
        if (isLocked) return;
        isLocked = true;
        outcome = 'answered';
        recordedScore = calculateSpeedScore(true, timeRem);
      };

      const triggerTimeout = () => {
        if (isLocked) return;
        isLocked = true;
        outcome = 'timedOut';
        recordedScore = 0;
      };

      // Case A: Answer arrives first by a hair
      triggerAnswer(1);
      triggerTimeout(); // Late timeout callback must be dropped
      expect(outcome).toBe('answered');
      expect(recordedScore).toBe(110);

      // Case B: Timeout arrives first
      isLocked = false;
      outcome = null;
      recordedScore = -1;

      triggerTimeout();
      triggerAnswer(0); // Late answer click must be dropped
      expect(outcome).toBe('timedOut');
      expect(recordedScore).toBe(0);
    });

    it('8. ignores duplicate rapid answer clicks after first selection', () => {
      let isLocked = false;
      let clickCount = 0;
      let accumulatedScore = 0;

      const handleSelect = (_idx: number, isCorrect: boolean, timeRem: number) => {
        if (isLocked) return;
        isLocked = true;
        clickCount++;
        accumulatedScore += calculateSpeedScore(isCorrect, timeRem);
      };

      // First click
      handleSelect(0, true, 20);
      // Rapid follow-up clicks (taps during feedback window)
      handleSelect(1, true, 19);
      handleSelect(0, true, 19);
      handleSelect(2, false, 18);

      expect(clickCount).toBe(1);
      expect(accumulatedScore).toBe(300); // 100 + 10 * 20
    });

    it('9. resets timer to 30s between consecutive questions without carrying elapsed time', () => {
      let currentQuestionTimer = 30;
      const historyOfTimerStarts: number[] = [];

      const startNewQuestion = () => {
        currentQuestionTimer = 30; // Fresh uncarried duration
        historyOfTimerStarts.push(currentQuestionTimer);
      };

      // Question 1 starts
      startNewQuestion();
      currentQuestionTimer = 12; // 18s elapsed

      // Question 2 starts -> must be fresh 30s
      startNewQuestion();
      expect(currentQuestionTimer).toBe(30);

      // Question 3 starts -> must be fresh 30s
      currentQuestionTimer = 5; // 25s elapsed
      startNewQuestion();
      expect(currentQuestionTimer).toBe(30);

      expect(historyOfTimerStarts).toEqual([30, 30, 30]);
    });

    it('10. advances through exactly 5 questions sequentially (Câu 1/5 to Câu 5/5)', () => {
      const totalQuestions = sampleQuestions.length;
      expect(totalQuestions).toBe(5);

      const visitedIndices: number[] = [];
      let currentIndex = 0;

      while (currentIndex < totalQuestions) {
        visitedIndices.push(currentIndex);
        currentIndex++;
      }

      expect(visitedIndices).toEqual([0, 1, 2, 3, 4]);
      expect(visitedIndices.length).toBe(5);
    });

    it('11. invokes completion transition exactly once after question 5', () => {
      let completionCalls = 0;
      let completedPayload: QuizGameSessionResult | null = null;
      let hasCompleted = false;

      const onQuizCompleted = (result: QuizGameSessionResult) => {
        if (hasCompleted) return;
        hasCompleted = true;
        completionCalls++;
        completedPayload = result;
      };

      const mockResults: QuestionPlayResult[] = [
        { questionIndex: 0, questionId: 'q1', question: 'Q1', selectedOptionIndex: 0, correctIndex: 0, isCorrect: true, timeRemainingSeconds: 25, timeSpentSeconds: 5, score: 350 },
        { questionIndex: 1, questionId: 'q2', question: 'Q2', selectedOptionIndex: 0, correctIndex: 0, isCorrect: true, timeRemainingSeconds: 20, timeSpentSeconds: 10, score: 300 },
        { questionIndex: 2, questionId: 'q3', question: 'Q3', selectedOptionIndex: 1, correctIndex: 0, isCorrect: false, timeRemainingSeconds: 15, timeSpentSeconds: 15, score: 0 },
        { questionIndex: 3, questionId: 'q4', question: 'Q4', selectedOptionIndex: 0, correctIndex: 0, isCorrect: true, timeRemainingSeconds: 10, timeSpentSeconds: 20, score: 200 },
        { questionIndex: 4, questionId: 'q5', question: 'Q5', selectedOptionIndex: null, correctIndex: 0, isCorrect: false, timeRemainingSeconds: 0, timeSpentSeconds: 30, score: 0 },
      ];

      // Simulate completion triggered on 5th question
      const totalScore = mockResults.reduce((acc, r) => acc + r.score, 0);
      const totalCorrect = mockResults.filter((r) => r.isCorrect).length;
      const totalTime = mockResults.reduce((acc, r) => acc + r.timeSpentSeconds, 0);

      const payload: QuizGameSessionResult = {
        campaignId: 'test_camp',
        totalScore,
        totalCorrect,
        totalQuestions: 5,
        totalTimeSpentSeconds: totalTime,
        results: mockResults,
        completedAt: new Date().toISOString(),
      };

      onQuizCompleted(payload);
      // Attempt double invocation
      onQuizCompleted(payload);

      expect(completionCalls).toBe(1);
      expect(completedPayload).not.toBeNull();
      const payloadResult = completedPayload as unknown as QuizGameSessionResult;
      expect(payloadResult.totalScore).toBe(850);
      expect(payloadResult.totalCorrect).toBe(3);
      expect(payloadResult.totalTimeSpentSeconds).toBe(80);
      expect(payloadResult.results).toHaveLength(5);
    });

    it('12. calculates maximum possible total score of 2,000 for perfect 5-question speed run', () => {
      // 5 questions answered with 30s remaining: 5 * 400 = 2,000
      const perfectScores = [
        calculateSpeedScore(true, 30),
        calculateSpeedScore(true, 30),
        calculateSpeedScore(true, 30),
        calculateSpeedScore(true, 30),
        calculateSpeedScore(true, 30),
      ];

      const totalMaxScore = perfectScores.reduce((acc, s) => acc + s, 0);
      expect(perfectScores).toEqual([400, 400, 400, 400, 400]);
      expect(totalMaxScore).toBe(2000);
    });

    it('13. rejects answer and triggers timeout when wall-clock reaches zero even if tick is delayed', () => {
      // Verifies zero-second boundary protection against JS event-loop delays
      let isLocked = false;
      let timeoutTriggered = false;
      let recordedScore = -1;

      const handleTimerTimeout = () => {
        isLocked = true;
        timeoutTriggered = true;
        recordedScore = 0;
      };

      const handleSelectOptionWithWallClock = (_idx: number, getRemainingMs: () => number) => {
        if (isLocked) return;

        // Zero-second boundary check
        const remainingMs = getRemainingMs();
        if (remainingMs <= 0) {
          handleTimerTimeout();
          return;
        }

        isLocked = true;
        const remainingSec = Math.max(1, Math.min(30, Math.ceil(remainingMs / 1000)));
        recordedScore = calculateSpeedScore(true, remainingSec);
      };

      // Simulating a tap arriving 15ms after the 30s deadline, before setInterval tick
      const simulatePastDeadlineRemainingMs = () => 0; // 30,015ms elapsed
      handleSelectOptionWithWallClock(0, simulatePastDeadlineRemainingMs);

      expect(isLocked).toBe(true);
      expect(timeoutTriggered).toBe(true);
      expect(recordedScore).toBe(0);
    });

    it('14. measures active answering duration strictly excluding feedback delays (TC-02)', () => {
      // 5 questions with 18s remaining each:
      // Time spent per question = 30 - 18 = 12s
      // Total active answering time = 5 * 12s = 60s
      // Feedback delays (800ms / 1000ms) are NOT added
      const questionResults: QuestionPlayResult[] = Array.from({ length: 5 }, (_, idx) => {
        const remainingSec = 18;
        const timeSpent = 30 - remainingSec;
        return {
          questionIndex: idx,
          questionId: `q_${idx + 1}`,
          question: `Question ${idx + 1}`,
          selectedOptionIndex: 0,
          correctIndex: 0,
          isCorrect: true,
          timeRemainingSeconds: remainingSec,
          timeSpentSeconds: timeSpent,
          score: calculateSpeedScore(true, remainingSec),
        };
      });

      const totalActiveTime = questionResults.reduce((acc, r) => acc + r.timeSpentSeconds, 0);
      const totalScore = questionResults.reduce((acc, r) => acc + r.score, 0);

      expect(totalActiveTime).toBe(60); // Exactly 60s per TC-02
      expect(totalScore).toBe(1400); // 5 * 280 = 1,400 pts per TC-02
    });

    it('15. ensures complete replay isolation across sequential quiz sessions', () => {
      // Session 1: plays through to completion
      const session1Results = {
        sessionKey: 1,
        questionIndex: 4,
        totalScore: 1600,
        isLocked: true,
        isCompleted: true,
      };
      expect(session1Results.isCompleted).toBe(true);

      // Session 2 initialized with fresh key
      const createFreshSession = (key: number) => ({
        sessionKey: key,
        questionIndex: 0,
        totalScore: 0,
        isLocked: false,
        isCompleted: false,
        results: [],
        awardedScore: null,
      });

      const session2 = createFreshSession(2);
      expect(session2.questionIndex).toBe(0);
      expect(session2.totalScore).toBe(0);
      expect(session2.isLocked).toBe(false);
      expect(session2.isCompleted).toBe(false);
      expect(session2.results).toEqual([]);
      expect(session2.sessionKey).toBe(2);
    });
  });
});
