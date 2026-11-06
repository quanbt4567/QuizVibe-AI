import { act } from 'react';
import { createRoot, Root } from 'react-dom/client';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { AdminLayout } from './AdminLayout';

// @ts-expect-error react act flag
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

describe('Admin Layout Shell: Sidebar, Header, and Responsive Navigation', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
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

  it('renders branding, navigation items, breadcrumbs, and active campaign', async () => {
    await act(async () => {
      root.render(
        <AdminLayout
          activeSection="overview"
          onNavigate={() => {}}
          breadcrumbs={[{ label: 'Quản trị' }, { label: 'Tổng quan' }]}
          activeCampaignTitle="Thử Thách Skincare 2026"
          activeCampaignStatus="published"
          leadCount={42}
          campaignCount={3}
        >
          <div data-testid="workspace-content">Nội dung trang quản trị</div>
        </AdminLayout>
      );
    });

    expect(container.textContent).toContain('QuizVibe AI');
    expect(container.textContent).toContain('Admin Console');
    expect(container.textContent).toContain('Tổng quan');
    expect(container.textContent).toContain('Chiến dịch');
    expect(container.textContent).toContain('Khách hàng (Leads)');
    expect(container.textContent).toContain('Thử Thách Skincare 2026');
    expect(container.textContent).toContain('Nội dung trang quản trị');
    expect(container.querySelector('[data-testid="workspace-content"]')).toBeTruthy();
  });

  it('triggers onNavigate when clicking on sidebar items', async () => {
    const handleNavigate = vi.fn();

    await act(async () => {
      root.render(
        <AdminLayout
          activeSection="overview"
          onNavigate={handleNavigate}
        >
          <div>Body</div>
        </AdminLayout>
      );
    });

    const leadsBtn = Array.from(container.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Khách hàng (Leads)')
    );
    expect(leadsBtn).toBeTruthy();

    await act(async () => {
      leadsBtn?.click();
    });

    expect(handleNavigate).toHaveBeenCalledWith('/admin/leads');
  });

  it('supports collapsing and expanding the sidebar via toggle button', async () => {
    await act(async () => {
      root.render(
        <AdminLayout
          activeSection="overview"
          onNavigate={() => {}}
        >
          <div>Body</div>
        </AdminLayout>
      );
    });

    const collapseBtn = container.querySelector('button[aria-label="Thu gọn thanh bên"]') as HTMLButtonElement;
    expect(collapseBtn).toBeTruthy();

    await act(async () => {
      collapseBtn.click();
    });

    // After collapsing, expand button should appear
    const expandBtn = container.querySelector('button[aria-label="Mở rộng thanh bên"]') as HTMLButtonElement;
    expect(expandBtn).toBeTruthy();
  });

  it('calls onLogout when clicking logout button in header', async () => {
    const handleLogout = vi.fn();

    await act(async () => {
      root.render(
        <AdminLayout
          activeSection="overview"
          onNavigate={() => {}}
          onLogout={handleLogout}
        >
          <div>Body</div>
        </AdminLayout>
      );
    });

    const logoutBtn = container.querySelector('button[aria-label="Đăng xuất"]') as HTMLButtonElement;
    expect(logoutBtn).toBeTruthy();

    await act(async () => {
      logoutBtn.click();
    });

    expect(handleLogout).toHaveBeenCalledTimes(1);
  });
});

