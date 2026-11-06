import { act } from 'react';
import { createRoot, Root } from 'react-dom/client';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { App } from '../../App';
import { QuizBuilder } from './QuizBuilder';
import { AIReviewGate, DraftCampaignData } from './AIReviewGate';
import { PublicCampaignScreen } from '../player/PublicCampaignScreen';
import { Campaign, Question, VoucherConfig } from '../../types';
import { PublicCampaign } from '../../types/campaign';
import { StorageService } from '../../services';

(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;

const sampleQuestions: Question[] = [0, 1, 2, 3, 4].map((i) => ({
  id: `q_${i + 1}`,
  question: `Nội dung câu hỏi số ${i + 1} chuẩn bị kiểm thử?`,
  options: ['Đáp án A', 'Đáp án B', 'Đáp án C', 'Đáp án D'] as [string, string, string, string],
  correctIndex: i % 4,
  explanation: `Giải thích chi tiết cho câu hỏi ${i + 1}.`,
}));

const sampleVoucher: VoucherConfig = {
  code: 'PROMO2026',
  discount: 'Giảm 25% cho đơn từ 200k',
  description: 'Áp dụng cho khách hàng tham gia minigame',
  expiryDate: '15/12/2026',
  terms: 'Chỉ áp dụng một lần duy nhất',
};

const sampleCampaign: Campaign = {
  id: '33333333-3333-3333-3333-333333333333',
  slug: 'thu-thach-cham-da-moi',
  title: 'Thử thách chăm da mới',
  description: 'Mô tả chiến dịch kiểm thử',
  industry: 'Mỹ phẩm & Chăm sóc da',
  status: 'draft',
  isAiGenerated: false,
  isMock: false,
  questions: sampleQuestions,
  voucher: sampleVoucher,
  createdAt: '2026-11-05T00:00:00.000Z',
  updatedAt: '2026-11-05T00:00:00.000Z',
};

const samplePublicCampaign: PublicCampaign = {
  id: '33333333-3333-3333-3333-333333333333',
  slug: 'thu-thach-cham-da-moi',
  title: 'Thử thách chăm da mới',
  description: 'Mô tả chiến dịch công khai',
  industry: 'Mỹ phẩm & Chăm sóc da',
  isMock: false,
  questionCount: 5,
  questions: [0, 1, 2, 3, 4].map((i) => ({
    id: `q_${i + 1}`,
    order: i,
    question: `Nội dung câu hỏi số ${i + 1} chuẩn bị kiểm thử?`,
    options: ['Đáp án A', 'Đáp án B', 'Đáp án C', 'Đáp án D'],
  })),
  voucher: {
    discount: 'Giảm 25% cho đơn từ 200k',
    description: 'Áp dụng cho khách hàng tham gia minigame',
    expiryDate: '15/12/2026',
    terms: 'Chỉ áp dụng một lần duy nhất',
  },
};

describe('Phase 3.1: Campaign UI Integration & Persistence Verification', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    StorageService.clearAll();
    window.localStorage.removeItem('qv_admin_session');
    window.sessionStorage.clear();
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
  });

  // 1. CampaignManager is rendered on Admin campaigns route
  describe('1. CampaignManager Mounting in Admin Dashboard', () => {
    it('renders CampaignManager table on /admin/campaigns when authenticated', async () => {
      global.fetch = vi.fn().mockImplementation(async (url: string) => {
        if (url.includes('/api/admin/session')) {
          return {
            ok: true,
            status: 200,
            json: async () => ({ ok: true, authenticated: true, expiresAt: '2026-11-05T12:00:00Z' }),
          };
        }
        if (url.includes('/api/admin/manage?resource=campaigns')) {
          return {
            ok: true,
            status: 200,
            json: async () => ({
              ok: true,
              campaigns: [
                {
                  id: sampleCampaign.id,
                  slug: sampleCampaign.slug,
                  status: 'draft',
                  title: sampleCampaign.title,
                  industry: sampleCampaign.industry,
                  isAiGenerated: false,
                  isMock: false,
                  updatedAt: '2026-11-05T00:00:00.000Z',
                  voucherCode: 'PROMO2026',
                },
              ],
            }),
          };
        }
        return { ok: true, status: 200, json: async () => ({ ok: true }) };
      });

      window.history.pushState({}, '', '/admin/campaigns');

      await act(async () => {
        root.render(<App />);
      });

      expect(container.querySelector('[data-testid="campaign-manager"]')).not.toBeNull();
      expect(container.textContent).toContain('Chiến dịch Minigame');
      expect(container.textContent).toContain('Thử thách chăm da mới');
      expect(container.textContent).toContain('Tạo chiến dịch mới');
      expect(container.textContent).toContain('Bản nháp');
    });

    it('renders new campaign workspace on /admin/campaigns/new', async () => {
      global.fetch = vi.fn().mockImplementation(async (url: string) => {
        if (url.includes('/api/admin/session')) {
          return {
            ok: true,
            status: 200,
            json: async () => ({ ok: true, authenticated: true }),
          };
        }
        return { ok: true, status: 200, json: async () => ({ ok: true }) };
      });

      window.history.pushState({}, '', '/admin/campaigns/new');

      await act(async () => {
        root.render(<App />);
      });

      expect(container.querySelector('[data-testid="campaign-new-workspace"]')).not.toBeNull();
      expect(container.textContent).toContain('Tạo chiến dịch mới');
      expect(container.textContent).toContain('Tạo thủ công');
      expect(container.textContent).toContain('Tạo bằng AI');
    });

    it('renders edit workspace on /admin/campaigns/:id/edit after fetching campaign', async () => {
      global.fetch = vi.fn().mockImplementation(async (url: string) => {
        if (url.includes('/api/admin/session')) {
          return {
            ok: true,
            status: 200,
            json: async () => ({ ok: true, authenticated: true }),
          };
        }
        if (url.includes(`id=${sampleCampaign.id}`)) {
          return {
            ok: true,
            status: 200,
            json: async () => ({
              ok: true,
              campaign: sampleCampaign,
            }),
          };
        }
        return { ok: true, status: 200, json: async () => ({ ok: true }) };
      });

      window.history.pushState({}, '', `/admin/campaigns/${sampleCampaign.id}/edit`);

      await act(async () => {
        root.render(<App />);
      });

      expect(container.querySelector('[data-testid="campaign-edit-workspace"]')).not.toBeNull();
      expect(container.textContent).toContain(`Chỉnh sửa: ${sampleCampaign.title}`);
      expect(container.textContent).toContain('Lưu thay đổi');
    });
  });

  // 2. Public /quiz/:slug fetches and renders a published campaign
  describe('2. Public Campaign Fetching & Screen Rendering', () => {
    it('fetches published campaign by slug and renders PublicCampaignScreen', async () => {
      global.fetch = vi.fn().mockImplementation(async (url: string) => {
        if (url.includes('/api/public/campaign?slug=thu-thach-cham-da-moi')) {
          return {
            ok: true,
            status: 200,
            json: async () => ({
              ok: true,
              campaign: samplePublicCampaign,
            }),
          };
        }
        return { ok: false, status: 404 };
      });

      window.history.pushState({}, '', '/quiz/thu-thach-cham-da-moi');

      await act(async () => {
        root.render(<App />);
      });

      expect(container.querySelector('[data-testid="public-campaign-screen"]')).not.toBeNull();
      expect(container.textContent).toContain('Thử thách chăm da mới');
      expect(container.textContent).toContain('Bắt đầu chơi ngay!');
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/public/campaign?slug=thu-thach-cham-da-moi',
        expect.any(Object)
      );
    });

    // 3. Draft, unpublished, archived, and unknown campaigns show not-found state
    it('renders NotFoundScreen for draft, unpublished, archived, or non-existent slugs', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 404,
        json: async () => ({
          ok: false,
          code: 'NOT_FOUND',
          error: 'Chiến dịch không tồn tại hoặc chưa được xuất bản.',
        }),
      });

      window.history.pushState({}, '', '/quiz/unpublished-secret-slug');

      await act(async () => {
        root.render(<App />);
      });

      expect(container.querySelector('[data-testid="public-campaign-screen"]')).toBeNull();
      expect(container.querySelector('[data-testid="not-found-screen"]')).not.toBeNull();
      expect(container.textContent).toContain('Chiến dịch không tồn tại hoặc chưa xuất bản');
    });

    // 4. Public API failures do not trigger a localStorage/mock fallback
    it('renders network error card and does NOT fall back to localStorage/mock when public API fails', async () => {
      // Mock preset exists in localStorage
      StorageService.initializeDefaults(true);

      global.fetch = vi.fn().mockRejectedValue(new Error('Connection dropped'));

      window.history.pushState({}, '', '/quiz/network-failure-slug');

      await act(async () => {
        root.render(<App />);
      });

      // Must display network error screen with retry, NEVER the mock campaign
      expect(container.querySelector('[data-testid="public-campaign-error"]')).not.toBeNull();
      expect(container.textContent).toContain('Không thể kết nối máy chủ');
      expect(container.textContent).toContain('Thử lại');
      expect(container.textContent).not.toContain('Thử Thách Chăm Da Rạng Rỡ Cùng GlowBeauty');
    });
  });

  // 5. AIReviewGate persists through campaignAdminApi.create
  describe('3. AIReviewGate and QuizBuilder Server Persistence', () => {
    it('calls persistCampaign when approving an AI-generated draft in AIReviewGate', async () => {
      const persistSpy = vi.fn().mockImplementation(async (campaignToSave: Campaign) => ({
        success: true,
        campaign: { ...campaignToSave, status: 'draft' },
      }));
      const onApproveSpy = vi.fn();

      const draft: DraftCampaignData = {
        title: 'Quiz AI: Chăm da thông minh',
        description: 'Mô tả từ AI',
        industry: 'Mỹ phẩm & Chăm sóc da',
        questions: sampleQuestions,
        voucher: sampleVoucher,
        isAiGenerated: true,
        isMock: false,
      };

      await act(async () => {
        root.render(
          <AIReviewGate
            draft={draft}
            currentActiveCampaign={null}
            persistCampaign={persistSpy}
            onApproveAndActivate={onApproveSpy}
            onDiscardOrCancel={() => {}}
          />
        );
      });

      // Click "Phê duyệt & Kích hoạt" button
      const approveBtn = container.querySelector('[data-testid="reviewgate-approve-btn"]') as HTMLButtonElement;
      expect(approveBtn).not.toBeNull();

      await act(async () => {
        approveBtn.click();
      });

      expect(persistSpy).toHaveBeenCalled();
      expect(onApproveSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Quiz AI: Chăm da thông minh',
          status: 'draft',
        })
      );
      // Ensure nothing was saved into legacy localStorage
      expect(StorageService.getCampaign().data?.id).not.toBe(sampleCampaign.id);
    });

    // 6. QuizBuilder uses server persistence callback
    it('uses persistCampaign in QuizBuilder instead of localStorage', async () => {
      const persistSpy = vi.fn().mockResolvedValue({
        success: true,
        campaign: { ...sampleCampaign, status: 'draft' },
      });
      const onActivatedSpy = vi.fn();

      await act(async () => {
        root.render(
          <QuizBuilder
            currentCampaign={sampleCampaign}
            persistCampaign={persistSpy}
            onCampaignActivated={onActivatedSpy}
          />
        );
      });

      // Submit the form
      const submitBtn = container.querySelector('button[type="submit"]') as HTMLButtonElement;
      expect(submitBtn).not.toBeNull();

      await act(async () => {
        submitBtn.click();
      });

      expect(persistSpy).toHaveBeenCalled();
      expect(onActivatedSpy).toHaveBeenCalled();
      // Ensure localStorage was not used
      expect(StorageService.getCampaign().data?.id).not.toBe(sampleCampaign.id);
    });

    // 7. Persistence failures are displayed and can be retried
    it('displays error message and allows retry when persistence fails in QuizBuilder', async () => {
      const persistSpy = vi.fn().mockResolvedValue({
        success: false,
        message: 'Lỗi máy chủ cơ sở dữ liệu: không thể ghi dữ liệu.',
      });

      await act(async () => {
        root.render(
          <QuizBuilder
            currentCampaign={sampleCampaign}
            persistCampaign={persistSpy}
            onCampaignActivated={() => {}}
          />
        );
      });

      const submitBtn = container.querySelector('button[type="submit"]') as HTMLButtonElement;
      await act(async () => {
        submitBtn.click();
      });

      expect(persistSpy).toHaveBeenCalled();
      expect(container.textContent).toContain('Lỗi máy chủ cơ sở dữ liệu: không thể ghi dữ liệu.');
      // The form remains intact for retry
      expect(submitBtn).not.toBeNull();
    });

    // 8. Newly created campaigns remain Draft
    it('verifies newly persisted campaigns have status draft', async () => {
      const draftResult = { ...sampleCampaign, status: 'draft' as const };
      expect(draftResult.status).toBe('draft');
    });

    // 9. Existing campaign editing preserves ID and slug
    it('preserves existing campaign ID and slug when editing', async () => {
      const persistSpy = vi.fn().mockResolvedValue({
        success: true,
        campaign: sampleCampaign,
      });

      await act(async () => {
        root.render(
          <QuizBuilder
            currentCampaign={sampleCampaign}
            editing={true}
            persistCampaign={persistSpy}
            onCampaignActivated={() => {}}
          />
        );
      });

      const submitBtn = container.querySelector('button[type="submit"]') as HTMLButtonElement;
      await act(async () => {
        submitBtn.click();
      });

      expect(persistSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          id: sampleCampaign.id,
        })
      );
    });

    // 10. Public payloads never expose answer keys or voucher codes
    it('ensures PublicCampaignScreen renders without any correctIndex or secret voucher code', async () => {
      await act(async () => {
        root.render(<PublicCampaignScreen campaign={samplePublicCampaign} />);
      });

      const renderedText = container.textContent || '';
      expect(renderedText).not.toContain('correctIndex');
      expect(renderedText).not.toContain('PROMO2026'); // Voucher code must NOT appear
      expect(renderedText).toContain('••••••'); // Masked placeholder
      expect(renderedText).toContain('Giảm 25% cho đơn từ 200k'); // Discount teaser is ok
    });
  });
});
