import { act } from 'react';
import { createRoot, Root } from 'react-dom/client';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { QuizGameScreen } from './QuizGameScreen';
import { playerApi, type QuizSessionInit } from '../../services/playerApi';

// @ts-expect-error global flag for react testing
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

describe('UX Improvement: Faster Quiz Feedback & Verification State', () => {
  let container: HTMLDivElement;
  let root: Root;

  const mockSession: QuizSessionInit = {
    sessionToken: 'test-session-token-fast',
    sessionId: 'session_999',
    campaignId: 'camp_fast',
    campaignTitle: 'Thử Thách Công Nghệ',
    totalQuestions: 5,
    timeLimitSeconds: 30,
    currentQuestion: {
      questionIndex: 0,
      questionText: 'Bộ vi xử lý máy tính thường được viết tắt là gì?',
      options: ['RAM', 'CPU', 'GPU', 'SSD'],
    },
  };

  const mockCampaign = {
    id: 'camp_fast',
    title: 'Thử Thách Công Nghệ',
    description: 'Thử thách công nghệ hấp dẫn',
    industry: 'Công nghệ & Phụ kiện',
    questions: [],
    voucher: {
      code: 'TECH50',
      discount: '50k',
      description: 'Giảm 50k',
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
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('immediately renders tactile pressed state and "Đang kiểm tra..." indicator upon click before server responds', async () => {
    let resolveServerResponse: any;
    const serverPromise = new Promise((resolve) => {
      resolveServerResponse = resolve;
    });

    vi.spyOn(playerApi, 'submitAnswer').mockReturnValue(serverPromise as any);

    await act(async () => {
      root.render(
        <QuizGameScreen
          campaign={mockCampaign}
          initialSession={mockSession}
          onExitToWelcome={() => {}}
        />
      );
    });

    const optionButtons = container.querySelectorAll<HTMLButtonElement>('[data-testid^="option-btn-"]');
    expect(optionButtons.length).toBe(4);

    // Click option B (index 1: CPU)
    await act(async () => {
      optionButtons[1].click();
    });

    // 1. Verify immediate disabled state to prevent duplicate submissions
    optionButtons.forEach((btn) => {
      expect(btn.disabled).toBe(true);
    });

    // 2. Verify immediate in-flight visual state on selected option
    expect(optionButtons[1].className).toContain('translate-y-[2px]');
    expect(optionButtons[1].className).toContain('ring-1');

    // 3. Verify in-flight verifying indicator
    expect(container.textContent).toContain('Đang kiểm tra...');

    // 4. Resolve server response
    await act(async () => {
      resolveServerResponse({
        correct: true,
        correctIndex: 1,
        pointsEarned: 380,
        totalScore: 380,
        explanation: 'CPU là viết tắt của Central Processing Unit.',
        isCompleted: false,
        nextQuestion: null,
      });
    });

    // 5. Verify authoritative server result is displayed
    expect(container.textContent).not.toContain('Đang kiểm tra...');
    expect(container.textContent).toContain('+380đ');
    expect(container.textContent).toContain('Giải thích đáp án:');
    expect(container.textContent).toContain('CPU là viết tắt của Central Processing Unit.');
  });

  it('prevents duplicate API submissions when clicked repeatedly in rapid succession', async () => {
    const serverPromise = new Promise(() => {});

    const submitSpy = vi.spyOn(playerApi, 'submitAnswer').mockReturnValue(serverPromise as any);

    await act(async () => {
      root.render(
        <QuizGameScreen
          campaign={mockCampaign}
          initialSession={mockSession}
          onExitToWelcome={() => {}}
        />
      );
    });

    const optionButtons = container.querySelectorAll<HTMLButtonElement>('[data-testid^="option-btn-"]');

    // Click multiple times rapidly
    await act(async () => {
      optionButtons[1].click();
      optionButtons[1].click();
      optionButtons[2].click();
    });

    expect(submitSpy).toHaveBeenCalledTimes(1);
    expect(submitSpy).toHaveBeenCalledWith('test-session-token-fast', 0, 1);
  });

  it('displays error banner and retry button on server network failure without crashing', async () => {
    const submitSpy = vi
      .spyOn(playerApi, 'submitAnswer')
      .mockRejectedValueOnce(new Error('Network timeout'));

    await act(async () => {
      root.render(
        <QuizGameScreen
          campaign={mockCampaign}
          initialSession={mockSession}
          onExitToWelcome={() => {}}
        />
      );
    });

    const optionButtons = container.querySelectorAll<HTMLButtonElement>('[data-testid^="option-btn-"]');

    await act(async () => {
      optionButtons[1].click();
    });

    // Advance microtasks
    await act(async () => {
      await Promise.resolve();
    });

    // Error banner should be visible
    expect(container.textContent).toContain('Không thể gửi đáp án lên máy chủ');
    expect(container.textContent).toContain('Thử lại');

    // Prepare mock for retry
    submitSpy.mockResolvedValueOnce({
      isCorrect: true,
      pointsEarned: 400,
      totalScore: 400,
      explanation: 'Chính xác!',
      isComplete: false,
      nextQuestion: null,
    });

    // Click retry
    const retryButton = Array.from(container.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Thử lại')
    );
    expect(retryButton).toBeDefined();

    await act(async () => {
      retryButton?.click();
    });

    expect(submitSpy).toHaveBeenCalledTimes(2);

    await act(async () => {
      await Promise.resolve();
    });

    expect(container.textContent).toContain('+400đ');
  });
});
