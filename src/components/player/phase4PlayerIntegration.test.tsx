import { act } from 'react';
import { createRoot, Root } from 'react-dom/client';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { PublicCampaignScreen } from './PublicCampaignScreen';
import { QuizGameScreen } from './QuizGameScreen';
import { LeadCaptureForm } from './LeadCaptureForm';
import { LeaderboardModal } from './LeaderboardModal';
import { PublicCampaign } from '../../types/campaign';
import { playerApi } from '../../services/playerApi';

(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;

const samplePublicCampaign: PublicCampaign = {
  id: 'c1111111-1111-4111-8111-111111111111',
  slug: 'thu-thach-lam-dep-2026',
  title: 'Thử thách Làm đẹp 2026',
  description: 'Chơi minigame nhận voucher giảm giá 50%',
  industry: 'Mỹ phẩm & Chăm sóc da',
  isMock: false,
  questionCount: 5,
  questions: [
    {
      id: 'q_1',
      order: 0,
      question: 'Bước đầu tiên trong quy trình skincare buổi tối là gì?',
      options: ['Tẩy trang', 'Thoa kem dưỡng', 'Rửa mặt bằng nước ấm', 'Đắp mặt nạ'],
    },
    {
      id: 'q_2',
      order: 1,
      question: 'Kem chống nắng nên được bôi lại sau bao lâu?',
      options: ['1-2 giờ', '2-3 giờ', '8 giờ', 'Không cần bôi lại'],
    },
  ],
  voucher: {
    discount: 'Giảm 50% đơn hàng từ 300k',
    description: 'Voucher độc quyền minigame',
    expiryDate: '31/12/2026',
    terms: 'Mỗi khách hàng áp dụng 1 lần',
  },
};

describe('Phase 4: Player Full Flow Integration (Session -> Game -> Scoring -> Lead -> Voucher -> Leaderboard)', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    vi.restoreAllMocks();
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
    vi.restoreAllMocks();
  });

  it('1. PublicCampaignScreen starts session via playerApi.startSession and transitions to QuizGameScreen', async () => {
    vi.spyOn(playerApi, 'startSession').mockResolvedValueOnce({
      sessionToken: 'test-session-token-xyz',
      sessionId: 'sess_123',
      campaignId: samplePublicCampaign.id,
      campaignTitle: samplePublicCampaign.title,
      totalQuestions: 2,
      timeLimitSeconds: 30,
      currentQuestion: {
        questionIndex: 0,
        questionText: samplePublicCampaign.questions[0].question,
        options: samplePublicCampaign.questions[0].options as [string, string, string, string],
      },
    });

    await act(async () => {
      root.render(<PublicCampaignScreen campaign={samplePublicCampaign} />);
    });

    // Verify campaign details rendered
    expect(container.textContent).toContain('Thử thách Làm đẹp 2026');
    const startBtn = container.querySelector('[data-testid="start-quiz-btn"]') as HTMLButtonElement;
    expect(startBtn).toBeTruthy();

    // Click start
    await act(async () => {
      startBtn.click();
    });

    // Should call playerApi.startSession with slug
    expect(playerApi.startSession).toHaveBeenCalledWith(samplePublicCampaign.slug);

    // Should transition to gameplay screen showing Question 1
    expect(container.textContent).toContain('Bước đầu tiên trong quy trình skincare');
  });

  it('2. QuizGameScreen submits answer via playerApi.submitAnswer on option click', async () => {
    const submitAnswerSpy = vi.spyOn(playerApi, 'submitAnswer').mockResolvedValueOnce({
      isCorrect: true,
      pointsEarned: 350,
      totalScore: 350,
      isComplete: false,
      nextQuestion: {
        questionIndex: 1,
        questionText: 'Kem chống nắng nên được bôi lại sau bao lâu?',
        options: ['1-2 giờ', '2-3 giờ', '8 giờ', 'Không cần bôi lại'],
      },
    });

    const onCompleteMock = vi.fn();

    await act(async () => {
      root.render(
        <QuizGameScreen
          campaign={{
            id: samplePublicCampaign.id,
            title: samplePublicCampaign.title,
            description: samplePublicCampaign.description,
            industry: samplePublicCampaign.industry,
            createdAt: '2026-11-05T00:00:00Z',
            updatedAt: '2026-11-05T00:00:00Z',
            questions: samplePublicCampaign.questions.map((q) => ({
              id: q.id,
              question: q.question,
              options: q.options as [string, string, string, string],
              correctIndex: 0,
            })),
            voucher: {
              code: 'TEMP',
              discount: '50%',
              description: 'Voucher',
            },
          }}
          initialSession={{
            sessionToken: 'test-session-token-xyz',
            sessionId: 'sess_123',
            campaignId: samplePublicCampaign.id,
            campaignTitle: samplePublicCampaign.title,
            totalQuestions: 2,
            timeLimitSeconds: 30,
            currentQuestion: {
              questionIndex: 0,
              questionText: samplePublicCampaign.questions[0].question,
              options: samplePublicCampaign.questions[0].options as [string, string, string, string],
            },
          }}
          onExitToWelcome={() => {}}
          onQuizCompleted={onCompleteMock}
        />
      );
    });

    // Select first option
    const optionBtn = container.querySelector('[data-testid="option-btn-0"]') as HTMLButtonElement;
    expect(optionBtn).toBeTruthy();

    await act(async () => {
      optionBtn.click();
    });

    expect(submitAnswerSpy).toHaveBeenCalledWith(
      'test-session-token-xyz',
      0,
      0
    );
  });

  it('3. LeadCaptureForm submits lead via playerApi.submitLead and displays unlocked voucher', async () => {
    const submitLeadSpy = vi.spyOn(playerApi, 'submitLead').mockResolvedValueOnce({
      lead: {
        id: 'lead_abc',
        fullName: 'Nguyễn Kiều Oanh',
        maskedPhone: '098***6655',
        score: 1850,
        timeTakenSeconds: 28,
        rank: 1,
      },
      voucher: {
        code: 'UNLOCKED_BEAUTY_50',
        discount: 'Giảm 50% đơn hàng từ 300k',
        description: 'Voucher độc quyền minigame',
        expiryDate: '31/12/2026',
        terms: 'Mỗi khách hàng áp dụng 1 lần',
      },
    });

    await act(async () => {
      root.render(
        <LeadCaptureForm
          score={1850}
          timeTakenSeconds={28}
          campaignId={samplePublicCampaign.id}
          voucherCode="HIDDEN"
          sessionToken="test-session-token-xyz"
          voucher={{
            code: 'HIDDEN',
            discount: 'Giảm 50% đơn hàng từ 300k',
            description: 'Voucher độc quyền',
          }}
        />
      );
    });

    // Verify form rendered
    const nameInput = container.querySelector('#lead-fullname') as HTMLInputElement;
    const phoneInput = container.querySelector('#lead-phone') as HTMLInputElement;
    const submitBtn = container.querySelector('[data-testid="submit-lead-btn"]') as HTMLButtonElement;

    expect(nameInput).toBeTruthy();
    expect(phoneInput).toBeTruthy();
    expect(submitBtn).toBeTruthy();

    function setInputValue(input: HTMLInputElement, value: string) {
      const descriptor = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value');
      descriptor?.set?.call(input, value);
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.dispatchEvent(new Event('change', { bubbles: true }));
    }

    // Fill form
    await act(async () => {
      setInputValue(nameInput, 'Nguyễn Kiều Oanh');
      setInputValue(phoneInput, '0988776655');
    });

    // Submit form
    const form = container.querySelector('form') as HTMLFormElement;
    await act(async () => {
      form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    });

    expect(submitLeadSpy).toHaveBeenCalledWith(
      'test-session-token-xyz',
      'Nguyễn Kiều Oanh',
      '0988776655'
    );

    // Real voucher code is now visible on screen
    expect(container.textContent).toContain('UNLOCKED_BEAUTY_50');
  });

  it('4. LeaderboardModal fetches and displays top ranked players with masked phone numbers', async () => {
    vi.spyOn(playerApi, 'fetchLeaderboard').mockResolvedValueOnce([
      {
        rank: 1,
        fullName: 'Lê Hoàng Long',
        maskedPhone: '090***1234',
        score: 1950,
        timeTakenSeconds: 22,
        submittedAt: '2026-11-05T08:00:00Z',
      },
      {
        rank: 2,
        fullName: 'Trần Mỹ Dung',
        maskedPhone: '091***5678',
        score: 1800,
        timeTakenSeconds: 31,
        submittedAt: '2026-11-05T08:05:00Z',
      },
    ]);

    await act(async () => {
      root.render(
        <LeaderboardModal
          isOpen={true}
          onClose={() => {}}
          campaignSlug={samplePublicCampaign.slug}
        />
      );
    });

    expect(playerApi.fetchLeaderboard).toHaveBeenCalledWith(samplePublicCampaign.slug);
    // Leaderboard displays masked phone and player names
    expect(container.textContent).toContain('Lê Hoàng Long');
    expect(container.textContent).toContain('090***1234');
    expect(container.textContent).toContain('Trần Mỹ Dung');
    expect(container.textContent).toContain('091***5678');
  });
});
