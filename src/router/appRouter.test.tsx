import { act } from 'react';
import { createRoot, Root } from 'react-dom/client';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { App } from '../App';
import {
  getCampaignSlug,
  matchAppRoute,
  resolvePublicCampaignBySlug,
} from './appRouter';
import { COSMETICS_DEFAULT_CAMPAIGN } from '../data/mockPresets';
import { StorageService } from '../services';

(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;

describe('Phase 2: URL Routing, Layout Separation & Admin/Player Access Boundaries', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    StorageService.clearAll();
    StorageService.initializeDefaults(true);
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

  describe('1. Route Matcher & Campaign Slug Resolution', () => {
    it('matches all required Admin and Public Player routes accurately', () => {
      expect(matchAppRoute('/admin/login')).toEqual({
        kind: 'admin-login',
        pathname: '/admin/login',
      });
      expect(matchAppRoute('/admin')).toEqual({
        kind: 'admin',
        section: 'overview',
        pathname: '/admin',
      });
      expect(matchAppRoute('/admin/campaigns')).toEqual({
        kind: 'admin',
        section: 'campaigns',
        pathname: '/admin/campaigns',
      });
      expect(matchAppRoute('/admin/leads')).toEqual({
        kind: 'admin',
        section: 'leads',
        pathname: '/admin/leads',
      });
      expect(matchAppRoute('/admin/vouchers')).toEqual({
        kind: 'admin',
        section: 'vouchers',
        pathname: '/admin/vouchers',
      });
      expect(matchAppRoute('/quiz/thu-thach-cham-da-rang-ro-cung-glowbeauty')).toEqual({
        kind: 'public-quiz',
        slug: 'thu-thach-cham-da-rang-ro-cung-glowbeauty',
        isRootAlias: false,
        pathname: '/quiz/thu-thach-cham-da-rang-ro-cung-glowbeauty',
      });
      expect(matchAppRoute('/unknown-route')).toEqual({
        kind: 'not-found',
        area: 'public',
        pathname: '/unknown-route',
      });
      expect(matchAppRoute('/admin/unknown-subroute')).toEqual({
        kind: 'not-found',
        area: 'admin',
        pathname: '/admin/unknown-subroute',
      });
    });

    it('resolves published campaign slugs and returns null for unknown/unpublished slugs', () => {
      const slug = getCampaignSlug(COSMETICS_DEFAULT_CAMPAIGN);
      expect(slug).toBe('thu-thach-cham-da-rang-ro-cung-glowbeauty');

      const resolved = resolvePublicCampaignBySlug(slug, COSMETICS_DEFAULT_CAMPAIGN);
      expect(resolved?.id).toBe(COSMETICS_DEFAULT_CAMPAIGN.id);

      const unknown = resolvePublicCampaignBySlug(
        'unpublished-secret-draft-slug',
        COSMETICS_DEFAULT_CAMPAIGN
      );
      expect(unknown).toBeNull();
    });
  });

  describe('2. Public Player Route Isolation (/quiz/:slug)', () => {
    it('renders PublicPlayerLayout at /quiz/:slug without login and hides all Admin navigation controls', async () => {
      const mockPublishedCampaign = {
        id: 'c1',
        slug: 'thu-thach-cham-da-rang-ro-cung-glowbeauty',
        title: 'Thử Thách Chăm Da Rạng Rỡ Cùng GlowBeauty',
        description: 'Mô tả',
        industry: 'Mỹ phẩm & Chăm sóc da',
        isMock: false,
        questionCount: 5,
        questions: [0, 1, 2, 3, 4].map((i) => ({
          id: `q${i}`,
          order: i,
          question: `Câu hỏi ${i + 1}?`,
          options: ['A', 'B', 'C', 'D'],
        })),
        voucher: {
          discount: 'Giảm 20%',
          description: 'Mô tả voucher',
        },
      };

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          ok: true,
          campaign: mockPublishedCampaign,
        }),
      } as unknown as Response);

      window.history.pushState(
        {},
        '',
        '/quiz/thu-thach-cham-da-rang-ro-cung-glowbeauty'
      );

      await act(async () => {
        root.render(<App />);
      });

      expect(container.querySelector('[data-testid="public-player-layout"]')).not.toBeNull();
      expect(container.querySelector('[data-testid="admin-studio-layout"]')).toBeNull();
      expect(container.querySelector('[data-testid="public-campaign-screen"]')).not.toBeNull();
      expect(container.textContent).toContain('Thử Thách Chăm Da Rạng Rỡ Cùng GlowBeauty');
      expect(container.textContent).toContain('Bắt đầu chơi ngay!');

      // Public users must never see Admin navigation or management links
      expect(container.textContent).not.toContain('Quản trị viên');
      expect(container.textContent).not.toContain('Bảng điều khiển Quản trị');
      expect(container.textContent).not.toContain('Quản lý Leads');
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/public/campaign?slug=thu-thach-cham-da-rang-ro-cung-glowbeauty',
        expect.any(Object)
      );
    });

    it('renders a clean public 404 state for unknown or unpublished /quiz/:slug without exposing Admin links', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 404,
        json: async () => ({
          ok: false,
          code: 'NOT_FOUND',
          error: 'Chiến dịch không tồn tại hoặc chưa được xuất bản.',
        }),
      } as unknown as Response);

      window.history.pushState({}, '', '/quiz/non-existent-draft-slug');

      await act(async () => {
        root.render(<App />);
      });

      expect(container.querySelector('[data-testid="public-player-layout"]')).not.toBeNull();
      expect(container.querySelector('[data-testid="not-found-screen"]')).not.toBeNull();
      expect(container.textContent).toContain('Chiến dịch không tồn tại hoặc chưa xuất bản');
      expect(container.textContent).not.toContain('Quản trị viên');
    });
  });

  describe('3. Unauthenticated & Authenticated Admin Route Guards (/admin/*)', () => {
    it('redirects unauthenticated visitors on /admin, /admin/campaigns, /admin/leads, and /admin/vouchers to /admin/login', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 401,
        json: async () => ({
          ok: false,
          authenticated: false,
          code: 'UNAUTHORIZED',
        }),
      } as unknown as Response);

      for (const protectedPath of ['/admin', '/admin/campaigns', '/admin/leads', '/admin/vouchers']) {
        await act(async () => {
          window.history.pushState({}, '', protectedPath);
          window.dispatchEvent(new PopStateEvent('popstate'));
          root.render(<App />);
        });

        expect(window.location.pathname).toBe('/admin/login');
        expect(container.querySelector('[data-testid="admin-login-screen"]')).not.toBeNull();
        expect(container.querySelector('[data-testid="admin-studio-layout"]')).toBeNull();
        expect(container.textContent).toContain('Đăng nhập Quản trị viên');
      }
    });

    it('renders AdminLayout and supports direct URL navigation across /admin, /admin/campaigns, /admin/leads, and /admin/vouchers when authenticated', async () => {
      global.fetch = vi.fn().mockImplementation(async (url: string) => {
        if (url.includes('/api/admin/session')) {
          return {
            ok: true,
            status: 200,
            json: async () => ({
              ok: true,
              authenticated: true,
              expiresAt: '2026-11-05T12:00:00.000Z',
            }),
          } as unknown as Response;
        }
        if (url.includes('/api/admin/manage?resource=campaigns')) {
          return {
            ok: true,
            status: 200,
            json: async () => ({
              ok: true,
              campaigns: [],
            }),
          } as unknown as Response;
        }
        return {
          ok: true,
          status: 200,
          json: async () => ({ ok: true }),
        } as unknown as Response;
      });

      window.history.pushState({}, '', '/admin/leads');

      await act(async () => {
        root.render(<App />);
      });

      expect(window.location.pathname).toBe('/admin/leads');
      expect(container.querySelector('[data-testid="admin-studio-layout"]')).not.toBeNull();
      expect(container.textContent).toContain('Danh sách Khách hàng Tham gia (Leads)');

      // Navigate to /admin/vouchers via direct popstate simulation (browser refresh / navigation)
      await act(async () => {
        window.history.pushState({}, '', '/admin/vouchers');
        window.dispatchEvent(new PopStateEvent('popstate'));
      });

      expect(window.location.pathname).toBe('/admin/vouchers');
      expect(container.textContent).toContain('Cấu hình Phần thưởng Voucher');
      expect(container.textContent).toContain('Lưu cấu hình Voucher');

      // Verify zero auth secrets or tokens in localStorage or sessionStorage
      expect(window.localStorage.getItem('qv_admin_session')).toBeNull();
      expect(window.localStorage.getItem('admin_password')).toBeNull();
      expect(window.sessionStorage.length).toBe(0);
    });
  });
});

