import { act } from 'react';
import { createRoot, Root } from 'react-dom/client';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { QuizGameScreen } from './QuizGameScreen';
import { playerApi, type QuizSessionInit } from '../../services/playerApi';

// @ts-expect-error global flag for react testing
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

describe('Production Bug Fix: QuizGameScreen Black Screen & Explanation Resilience', () => {
  let container: HTMLDivElement;
  let root: Root;

  const mockSession: QuizSessionInit = {
    sessionToken: 'test-session-token-abc',
    sessionId: 'session_123',
    campaignId: 'camp_123',
    campaignTitle: 'Thử Thách Làm Đẹp',
    totalQuestions: 5,
    timeLimitSeconds: 30,
    currentQuestion: {
      questionIndex: 0,
      questionText: 'Bước đầu tiên trong quy trình skincare buổi tối là gì?',
      options: [
        'Tẩy trang & Sữa rửa mặt',
        'Thoa kem dưỡng ẩm ngay',
        'Rửa bằng nước ấm',
        'Đắp mặt nạ đất sét',
      ],
    },
  };

  // Real production structure: campaign.questions is EMPTY array to protect answer leakage
  const productionCampaign = {
    id: 'camp_123',
    title: 'Thử Thách Làm Đẹp',
    description: 'Trả lời đúng nhận voucher',
    industry: 'Mỹ phẩm & Chăm sóc da',
    questions: [], // CRUCIAL: Empty in production server-authoritative sessions!
    voucher: {
      code: 'REWARD',
      discount: '20%',
      description: 'Giảm 20%',
    },
    createdAt: '2026-11-06T00:00:00Z',
    updatedAt: '2026-11-06T00:00:00Z',
  };

  beforeEach(() => {
    vi.useFakeTimers();
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  // Scenario 1: Select a correct answer → Verify score updates, feedback displays, no black screen.
  it('Scenario 1: Select a correct answer with empty campaign.questions updates score and feedback without black screen', async () => {
    const submitSpy = vi.spyOn(playerApi, 'submitAnswer').mockResolvedValueOnce({
      isCorrect: true,
      pointsEarned: 350,
      totalScore: 350,
      isComplete: false,
      correctIndex: 0,
      explanation: 'Tẩy trang giúp loại bỏ bụi bẩn và kem chống nắng hiệu quả.',
      nextQuestion: {
        questionIndex: 1,
        questionText: 'Câu hỏi số 2?',
        options: ['A', 'B', 'C', 'D'],
      },
    });

    await act(async () => {
      root.render(
        <QuizGameScreen
          campaign={productionCampaign}
          initialSession={mockSession}
          onExitToWelcome={() => {}}
        />
      );
    });

    // Ensure initial question rendered
    expect(container.textContent).toContain('Bước đầu tiên trong quy trình skincare');

    // Select option 0
    const option0 = container.querySelector('[data-testid="option-btn-0"]') as HTMLButtonElement;
    expect(option0).toBeTruthy();

    await act(async () => {
      option0.click();
    });

    expect(submitSpy).toHaveBeenCalledWith('test-session-token-abc', 0, 0);

    // Let Promise resolve
    await act(async () => {
      await Promise.resolve();
    });

    // Verify feedback rendered without crashing
    expect(container.textContent).toContain('+350đ');
    expect(container.textContent).toContain('Chính xác! +350 điểm');
    expect(container.textContent).toContain('Tẩy trang giúp loại bỏ bụi bẩn và kem chống nắng hiệu quả.');
    expect(container.innerHTML).not.toBe('');
  });

  // Scenario 2: Select an incorrect answer → Verify correct feedback, score unchanged, no black screen.
  it('Scenario 2: Select an incorrect answer displays incorrect feedback and reveals correct option without crashing', async () => {
    vi.spyOn(playerApi, 'submitAnswer').mockResolvedValueOnce({
      isCorrect: false,
      pointsEarned: 0,
      totalScore: 0,
      isComplete: false,
      correctIndex: 0,
      explanation: 'Bạn cần tẩy trang trước tiên.',
      nextQuestion: {
        questionIndex: 1,
        questionText: 'Câu hỏi số 2?',
        options: ['A', 'B', 'C', 'D'],
      },
    });

    await act(async () => {
      root.render(
        <QuizGameScreen
          campaign={productionCampaign}
          initialSession={mockSession}
          onExitToWelcome={() => {}}
        />
      );
    });

    // Select option 1 (incorrect)
    const option1 = container.querySelector('[data-testid="option-btn-1"]') as HTMLButtonElement;
    await act(async () => {
      option1.click();
    });

    await act(async () => {
      await Promise.resolve();
    });

    // Verify incorrect feedback
    expect(container.textContent).toContain('+0đ');
    expect(container.textContent).toContain('Chưa chính xác! (0 điểm)');
    expect(container.textContent).toContain('Đáp án đúng');
    expect(container.textContent).toContain('Bạn cần tẩy trang trước tiên.');
  });

  // Scenario 3: Answer consecutive questions → Verify transitions work smoothly.
  it('Scenario 3: Consecutive questions transition smoothly and update prompts', async () => {
    vi.spyOn(playerApi, 'submitAnswer')
      .mockResolvedValueOnce({
        isCorrect: true,
        pointsEarned: 300,
        totalScore: 300,
        isComplete: false,
        correctIndex: 0,
        explanation: 'Giải thích câu 1',
        nextQuestion: {
          questionIndex: 1,
          questionText: 'Câu hỏi 2: Serum nên dùng trước hay sau kem dưỡng?',
          options: ['Trước kem dưỡng', 'Sau kem dưỡng', 'Trộn chung', 'Không quan trọng'],
        },
      })
      .mockResolvedValueOnce({
        isCorrect: true,
        pointsEarned: 350,
        totalScore: 650,
        isComplete: false,
        correctIndex: 0,
        explanation: 'Serum lỏng hơn nên dùng trước.',
        nextQuestion: {
          questionIndex: 2,
          questionText: 'Câu hỏi 3: Độ pH chuẩn của da là bao nhiêu?',
          options: ['pH 5.5', 'pH 7.0', 'pH 3.0', 'pH 9.0'],
        },
      });

    await act(async () => {
      root.render(
        <QuizGameScreen
          campaign={productionCampaign}
          initialSession={mockSession}
          answerTransitionDelayMs={500}
          onExitToWelcome={() => {}}
        />
      );
    });

    // Answer Q0
    const option0 = container.querySelector('[data-testid="option-btn-0"]') as HTMLButtonElement;
    await act(async () => {
      option0.click();
    });
    await act(async () => {
      await Promise.resolve();
    });

    expect(container.textContent).toContain('Giải thích câu 1');

    // Advance timer by 500ms for transition
    await act(async () => {
      vi.advanceTimersByTime(500);
    });

    // Verify Question 2 is now shown
    expect(container.textContent).toContain('Serum nên dùng trước hay sau kem dưỡng?');
    // Previous explanation must be cleared
    expect(container.textContent).not.toContain('Giải thích câu 1');

    // Answer Q1
    const nextOption0 = container.querySelector('[data-testid="option-btn-0"]') as HTMLButtonElement;
    await act(async () => {
      nextOption0.click();
    });
    await act(async () => {
      await Promise.resolve();
    });

    expect(container.textContent).toContain('Serum lỏng hơn nên dùng trước.');
  });

  // Scenario 4: Question with NO explanation in data → Verify page does not crash, layout looks clean.
  it('Scenario 4: Missing or null explanation renders cleanly without crashing or displaying empty box', async () => {
    vi.spyOn(playerApi, 'submitAnswer').mockResolvedValueOnce({
      isCorrect: true,
      pointsEarned: 200,
      totalScore: 200,
      isComplete: false,
      correctIndex: 0,
      explanation: null, // No explanation provided by database
      nextQuestion: {
        questionIndex: 1,
        questionText: 'Câu 2?',
        options: ['A', 'B', 'C', 'D'],
      },
    });

    await act(async () => {
      root.render(
        <QuizGameScreen
          campaign={productionCampaign}
          initialSession={mockSession}
          onExitToWelcome={() => {}}
        />
      );
    });

    const option0 = container.querySelector('[data-testid="option-btn-0"]') as HTMLButtonElement;
    await act(async () => {
      option0.click();
    });
    await act(async () => {
      await Promise.resolve();
    });

    // Should NOT crash, should show score feedback, but NO explanation heading
    expect(container.textContent).toContain('+200đ');
    expect(container.textContent).not.toContain('Giải thích đáp án:');
  });

  // Scenario 5: Question with explanation → Verify explanation text renders properly.
  it('Scenario 5: Question with explanation text renders properly with lightbulb badge', async () => {
    vi.spyOn(playerApi, 'submitAnswer').mockResolvedValueOnce({
      isCorrect: true,
      pointsEarned: 300,
      totalScore: 300,
      isComplete: false,
      correctIndex: 1,
      explanation: 'Đây là lời giải thích chi tiết cho phương án đúng.',
      nextQuestion: null,
    });

    await act(async () => {
      root.render(
        <QuizGameScreen
          campaign={productionCampaign}
          initialSession={mockSession}
          onExitToWelcome={() => {}}
        />
      );
    });

    const option1 = container.querySelector('[data-testid="option-btn-1"]') as HTMLButtonElement;
    await act(async () => {
      option1.click();
    });
    await act(async () => {
      await Promise.resolve();
    });

    expect(container.textContent).toContain('Giải thích đáp án:');
    expect(container.textContent).toContain('Đây là lời giải thích chi tiết cho phương án đúng.');
  });

  // Scenario 6: Timeout (timer expires without selection) → Verify handled gracefully without crash.
  it('Scenario 6: Timeout expires without answer selection and handles submission gracefully', async () => {
    const submitSpy = vi.spyOn(playerApi, 'submitAnswer').mockResolvedValueOnce({
      isCorrect: false,
      pointsEarned: 0,
      totalScore: 0,
      isComplete: false,
      correctIndex: 0,
      explanation: 'Hết giờ! Tẩy trang là bước đầu tiên.',
      nextQuestion: {
        questionIndex: 1,
        questionText: 'Câu tiếp theo?',
        options: ['1', '2', '3', '4'],
      },
    });

    await act(async () => {
      root.render(
        <QuizGameScreen
          campaign={productionCampaign}
          initialSession={mockSession}
          timeoutTransitionDelayMs={500}
          onExitToWelcome={() => {}}
        />
      );
    });

    // Advance 30 seconds to trigger countdown timeout
    await act(async () => {
      vi.advanceTimersByTime(30000);
    });

    expect(submitSpy).toHaveBeenCalledWith('test-session-token-abc', 0, null);

    await act(async () => {
      await Promise.resolve();
    });

    // Verify explanation and correct answer are shown upon timeout
    expect(container.textContent).toContain('Hết giờ! Tẩy trang là bước đầu tiên.');
    expect(container.textContent).toContain('Đáp án đúng');
  });

  // Scenario 7: Final question answered → Verify smooth transition to Quiz Complete screen.
  it('Scenario 7: Final question answered triggers onQuizCompleted callback with full summary', async () => {
    const onCompleteMock = vi.fn();

    vi.spyOn(playerApi, 'submitAnswer').mockResolvedValueOnce({
      isCorrect: true,
      pointsEarned: 400,
      totalScore: 1950,
      isComplete: true, // Marked complete
      correctIndex: 2,
      explanation: 'Hoàn thành thử thách!',
      nextQuestion: null,
      result: {
        totalScore: 1950,
        correctCount: 5,
        timeTakenSeconds: 45,
      },
    });

    await act(async () => {
      root.render(
        <QuizGameScreen
          campaign={productionCampaign}
          initialSession={{
            ...mockSession,
            totalQuestions: 1, // Make this the only question
          }}
          answerTransitionDelayMs={300}
          onQuizCompleted={onCompleteMock}
          onExitToWelcome={() => {}}
        />
      );
    });

    const option2 = container.querySelector('[data-testid="option-btn-2"]') as HTMLButtonElement;
    await act(async () => {
      option2.click();
    });
    await act(async () => {
      await Promise.resolve();
    });

    // Advance past transition delay
    await act(async () => {
      vi.advanceTimersByTime(300);
    });

    expect(onCompleteMock).toHaveBeenCalledTimes(1);
    expect(onCompleteMock).toHaveBeenCalledWith(
      expect.objectContaining({
        campaignId: 'camp_123',
        totalScore: 1950,
        totalCorrect: 5,
      })
    );
  });

  // Scenario 8: Rapid double-click on answer option → Verify no duplicate submission or state corruption.
  it('Scenario 8: Rapid double-click on answer option only triggers a single submission', async () => {
    const submitSpy = vi.spyOn(playerApi, 'submitAnswer').mockResolvedValue({
      isCorrect: true,
      pointsEarned: 300,
      totalScore: 300,
      isComplete: false,
      correctIndex: 0,
      nextQuestion: null,
    });

    await act(async () => {
      root.render(
        <QuizGameScreen
          campaign={productionCampaign}
          initialSession={mockSession}
          onExitToWelcome={() => {}}
        />
      );
    });

    const option0 = container.querySelector('[data-testid="option-btn-0"]') as HTMLButtonElement;

    // Rapid double click in same tick
    await act(async () => {
      option0.click();
      option0.click();
      option0.click();
    });

    expect(submitSpy).toHaveBeenCalledTimes(1);
  });

  // Scenario 9: Network error during answer submission → Verify error handled gracefully with retry option, no crash.
  it('Scenario 9: Network error during answer submission displays error banner gracefully without black screen', async () => {
    const onExitMock = vi.fn();
    vi.spyOn(playerApi, 'submitAnswer').mockRejectedValueOnce(
      new Error('Failed to fetch')
    );

    await act(async () => {
      root.render(
        <QuizGameScreen
          campaign={productionCampaign}
          initialSession={mockSession}
          onExitToWelcome={onExitMock}
        />
      );
    });

    const option0 = container.querySelector('[data-testid="option-btn-0"]') as HTMLButtonElement;
    await act(async () => {
      option0.click();
    });
    await act(async () => {
      await Promise.resolve();
    });

    // Should display error notification without crashing
    expect(container.textContent).toContain('Không thể gửi đáp án lên máy chủ');
    expect(container.textContent).toContain('Thử lại');
  });
});
