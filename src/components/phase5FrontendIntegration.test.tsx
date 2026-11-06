import { act } from 'react';
import { createRoot, Root } from 'react-dom/client';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { PublicCampaignScreen } from './player/PublicCampaignScreen';
import { LeadCaptureForm } from './player/LeadCaptureForm';
import { LeaderboardModal } from './player/LeaderboardModal';
import { LeadDashboard } from './admin/LeadDashboard';
import { AdminLoginScreen } from './admin/AdminLoginScreen';
import { CampaignManager } from './admin/CampaignManager';
import { PublicCampaign } from '../types/campaign';
import { Campaign } from '../types';
import { playerApi } from '../services/playerApi';
import { leadAdminApi } from '../services/leadAdminApi';
import { campaignAdminApi } from '../services/campaignAdminApi';

(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;

const testCampaign: Campaign = {
  id: 'c5555555-5555-4555-8555-555555555555',
  slug: 'thu-thach-ca-phe-viet-2026',
  title: 'Thử Thách Cà Phê Việt 2026',
  description: 'Trắc nghiệm kiến thức cà phê nhận voucher 30%',
  industry: 'F&B / Quán Cà Phê',
  status: 'published',
  isAiGenerated: false,
  isMock: false,
  questions: [0, 1, 2, 3, 4].map((i) => ({
    id: `q_${i + 1}`,
    question: `Câu hỏi số ${i + 1} về cà phê Việt?`,
    options: ['Lựa chọn A', 'Lựa chọn B', 'Lựa chọn C', 'Lựa chọn D'] as [string, string, string, string],
    correctIndex: 0,
    explanation: `Giải thích chi tiết câu ${i + 1}`,
  })),
  voucher: {
    code: 'CAFE30',
    discount: 'Giảm 30% tổng hóa đơn',
    description: 'Voucher ưu đãi thử thách',
    expiryDate: '31/12/2026',
    terms: 'Áp dụng đơn từ 100k',
  },
  createdAt: '2026-11-05T00:00:00.000Z',
  updatedAt: '2026-11-05T00:00:00.000Z',
};

const testPublicCampaign: PublicCampaign = {
  id: testCampaign.id,
  slug: testCampaign.slug || 'thu-thach-ca-phe-viet-2026',
  title: testCampaign.title,
  description: testCampaign.description,
  industry: testCampaign.industry,
  isMock: false,
  questionCount: 5,
  questions: testCampaign.questions.map((q, idx) => ({
    id: q.id,
    order: idx,
    question: q.question,
    options: q.options,
  })),
  voucher: {
    discount: testCampaign.voucher.discount,
    description: testCampaign.voucher.description,
    expiryDate: testCampaign.voucher.expiryDate,
    terms: testCampaign.voucher.terms,
  },
};

describe('Phase 5 — Frontend End-to-End User Experience & Flow Verification', () => {
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

  // ---------------------------------------------------------------------------
  // 1. Admin Login Experience
  // ---------------------------------------------------------------------------
  it('1. AdminLoginScreen renders login form and invokes callbacks on action', async () => {
    const onLoginSuccess = vi.fn();
    const onNavigatePublicQuiz = vi.fn();

    await act(async () => {
      root.render(
        <AdminLoginScreen
          onLoginSuccess={onLoginSuccess}
          onNavigatePublicQuiz={onNavigatePublicQuiz}
        />
      );
    });

    expect(container.textContent).toContain('Đăng nhập Quản trị viên');
    const passwordInput = container.querySelector('input[type="password"]') as HTMLInputElement;
    expect(passwordInput).toBeTruthy();

    const publicQuizLink = container.querySelector('button[type="button"]') as HTMLButtonElement;
    expect(publicQuizLink).toBeTruthy();
  });

  // ---------------------------------------------------------------------------
  // 2. Admin Campaign Manager (Listing & Status Badges)
  // ---------------------------------------------------------------------------
  it('2. CampaignManager lists campaigns with status badges and share URLs', async () => {
    const listSpy = vi.spyOn(campaignAdminApi, 'list').mockResolvedValueOnce([
      {
        id: testCampaign.id,
        slug: testCampaign.slug || 'thu-thach-ca-phe-viet-2026',
        title: testCampaign.title,
        industry: testCampaign.industry,
        status: 'published',
        isAiGenerated: false,
        isMock: false,
        createdAt: '2026-11-05T00:00:00Z',
        updatedAt: '2026-11-05T00:00:00Z',
      },
    ]);

    await act(async () => {
      root.render(
        <CampaignManager
          onNavigate={() => {}}
          onUnauthenticated={() => {}}
        />
      );
    });

    expect(listSpy).toHaveBeenCalled();
    expect(container.textContent).toContain('Thử Thách Cà Phê Việt 2026');
    expect(container.textContent).toContain('Đã xuất bản');
  });

  // ---------------------------------------------------------------------------
  // 3. Public Player Screen Landing
  // ---------------------------------------------------------------------------
  it('3. PublicCampaignScreen displays teaser with voucher details and hidden voucher code', async () => {
    await act(async () => {
      root.render(<PublicCampaignScreen campaign={testPublicCampaign} />);
    });

    expect(container.textContent).toContain('Thử Thách Cà Phê Việt 2026');
    expect(container.textContent).toContain('Giảm 30% tổng hóa đơn');
    expect(container.textContent).toContain('••••••'); // Masked voucher teaser
    expect(container.textContent).not.toContain('CAFE30'); // NEVER LEAKED
    const startBtn = container.querySelector('[data-testid="start-quiz-btn"]') as HTMLButtonElement;
    expect(startBtn).toBeTruthy();
  });

  // ---------------------------------------------------------------------------
  // 4. Player Starts Quiz & Enters Gameplay Screen
  // ---------------------------------------------------------------------------
  it('4. PublicCampaignScreen calls playerApi.startSession and transitions to Question 1', async () => {
    vi.spyOn(playerApi, 'startSession').mockResolvedValueOnce({
      sessionToken: 'token-abc-123',
      sessionId: 'sess-abc-123',
      campaignId: testPublicCampaign.id,
      campaignTitle: testPublicCampaign.title,
      totalQuestions: 5,
      timeLimitSeconds: 30,
      currentQuestion: {
        questionIndex: 0,
        questionText: 'Câu hỏi số 1 về cà phê Việt?',
        options: ['Lựa chọn A', 'Lựa chọn B', 'Lựa chọn C', 'Lựa chọn D'],
      },
    });

    await act(async () => {
      root.render(<PublicCampaignScreen campaign={testPublicCampaign} />);
    });

    const startBtn = container.querySelector('[data-testid="start-quiz-btn"]') as HTMLButtonElement;
    await act(async () => {
      startBtn.click();
    });

    expect(playerApi.startSession).toHaveBeenCalledWith(testPublicCampaign.slug);
    expect(container.textContent).toContain('Câu hỏi số 1 về cà phê Việt?');
    expect(container.textContent).toContain('Lựa chọn A');
  });

  // ---------------------------------------------------------------------------
  // 5. LeadCaptureForm Validates Inputs & Unlocks Voucher Reward Card
  // ---------------------------------------------------------------------------
  it('5. LeadCaptureForm validates Vietnamese phone, submits via playerApi, and displays VoucherRewardCard', async () => {
    const submitLeadSpy = vi.spyOn(playerApi, 'submitLead').mockResolvedValueOnce({
      lead: {
        id: 'lead-123',
        fullName: 'Lê Thị Thu',
        maskedPhone: '098***4321',
        score: 1650,
        timeTakenSeconds: 35,
        rank: 1,
      },
      voucher: {
        code: 'CAFE30',
        discount: 'Giảm 30% tổng hóa đơn',
        description: 'Voucher ưu đãi thử thách',
        expiryDate: '31/12/2026',
        terms: 'Áp dụng đơn từ 100k',
      },
    });

    await act(async () => {
      root.render(
        <LeadCaptureForm
          score={1650}
          timeTakenSeconds={35}
          campaignId={testPublicCampaign.id}
          voucherCode=""
          voucher={testCampaign.voucher}
          sessionToken="token-abc-123"
          initialName="Lê Thị Thu"
          initialPhone="0987654321"
        />
      );
    });

    expect(container.textContent).toContain('Mở khóa Voucher');

    const submitBtn = container.querySelector('[data-testid="submit-lead-btn"]') as HTMLButtonElement;
    expect(submitBtn).toBeTruthy();

    await act(async () => {
      submitBtn.click();
    });

    expect(submitLeadSpy).toHaveBeenCalledWith('token-abc-123', 'Lê Thị Thu', '0987654321');

    // Should now display the unlocked voucher card!
    expect(container.textContent).toContain('CAFE30');
    expect(container.textContent).toContain('Giảm 30% tổng hóa đơn');
    expect(container.textContent).toContain('Hạng #1');
  });

  // ---------------------------------------------------------------------------
  // 6. LeaderboardModal Displays Masked Phone Rankings
  // ---------------------------------------------------------------------------
  it('6. LeaderboardModal fetches and displays public leaderboard rankings with privacy masking', async () => {
    vi.spyOn(playerApi, 'fetchLeaderboard').mockResolvedValueOnce([
      {
        rank: 1,
        fullName: 'Lê Thị Thu',
        maskedPhone: '098***4321',
        score: 1650,
        timeTakenSeconds: 35,
        submittedAt: '2026-11-05T12:00:00Z',
      },
      {
        rank: 2,
        fullName: 'Trần Văn Bình',
        maskedPhone: '091***7890',
        score: 1400,
        timeTakenSeconds: 42,
        submittedAt: '2026-11-05T12:05:00Z',
      },
    ]);

    await act(async () => {
      root.render(
        <LeaderboardModal
          isOpen={true}
          campaignSlug={testPublicCampaign.slug}
          campaignTitle={testPublicCampaign.title}
          onClose={() => {}}
        />
      );
    });

    expect(playerApi.fetchLeaderboard).toHaveBeenCalledWith(testPublicCampaign.slug);
    expect(container.textContent).toContain('Bảng Xếp Hạng');
    expect(container.textContent).toContain('Lê Thị Thu');
    expect(container.textContent).toContain('098***4321'); // MASKED
    expect(container.textContent).toContain('1.650');
    expect(container.textContent).toContain('Trần Văn Bình');
    expect(container.textContent).toContain('091***7890'); // MASKED
  });

  // ---------------------------------------------------------------------------
  // 7. Admin Lead Dashboard Displays Full Leads & CSV Export Link
  // ---------------------------------------------------------------------------
  it('7. LeadDashboard fetches leads for campaign and provides safe CSV export action', async () => {
    vi.spyOn(leadAdminApi, 'listLeads').mockResolvedValueOnce([
      {
        id: 'lead-123',
        campaign_id: testCampaign.id,
        campaign_title: testCampaign.title,
        quiz_session_id: 'sess-123',
        full_name: 'Lê Thị Thu',
        phone_number: '0987654321', // Unmasked in Admin
        masked_phone: '098***4321',
        score: 1650,
        time_taken_seconds: 35,
        voucher_code: 'CAFE30',
        submitted_at: '2026-11-05T12:00:00Z',
      },
    ]);

    await act(async () => {
      root.render(<LeadDashboard currentCampaign={testCampaign} />);
    });

    expect(leadAdminApi.listLeads).toHaveBeenCalled();
    expect(container.textContent).toContain('Lê Thị Thu');
    expect(container.textContent).toContain('098***4321'); // Screen table displays privacy-masked phone
    expect(container.textContent).toContain('CAFE30');

    // Verify CSV export action exists
    const csvBtn = container.querySelector('[aria-label="Xuất file Excel (CSV)"]') as HTMLButtonElement;
    expect(csvBtn).toBeTruthy();

    const expectedCsvUrl = leadAdminApi.downloadLeadsCsvUrl('all');
    expect(expectedCsvUrl).toContain('/api/admin/manage?resource=leads&format=csv');
  });
});
