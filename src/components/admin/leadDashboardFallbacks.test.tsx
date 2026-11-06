import { act } from 'react';
import { createRoot, Root } from 'react-dom/client';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { LeadDashboard } from './LeadDashboard';
import { leadAdminApi } from '../../services/leadAdminApi';
import { StorageService } from '../../services';

(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;

const sampleCampaign = {
  id: 'camp_1',
  title: 'Chiến dịch Test 1',
  description: 'Mô tả',
  industry: 'Mỹ phẩm',
  status: 'published' as const,
  isAiGenerated: false,
  isMock: false,
  createdAt: '2026-11-05T00:00:00Z',
  updatedAt: '2026-11-05T00:00:00Z',
  questions: [],
  voucher: { code: 'V1', discount: '10%', description: 'D1' },
};

describe('SEC-02: LeadDashboard Zero LocalStorage Fallback Verification', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    StorageService.clearLeads();
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

  it('1. shows error notification on network error and does NOT fall back to StorageService', async () => {
    // Populate localStorage directly with legacy data that should NOT be displayed
    window.localStorage.setItem(
      'quizvibe_leads',
      JSON.stringify([
        {
          id: 'local_lead_1',
          fullName: 'Khách Hàng Local Không Được Hiện',
          phoneNumber: '0988888888',
          score: 1000,
          timeTakenSeconds: 30,
          voucherCode: 'LOCAL_CODE',
          campaignId: 'camp_1',
          submittedAt: '2026-11-05T00:00:00Z',
        },
      ])
    );

    const getLeadsSpy = vi.spyOn(StorageService, 'getLeads');
    vi.spyOn(leadAdminApi, 'listLeads').mockRejectedValueOnce(
      new Error('Failed to fetch from server')
    );

    await act(async () => {
      root.render(<LeadDashboard currentCampaign={sampleCampaign} />);
    });

    // Verify error notification is shown
    expect(container.textContent).toContain('Failed to fetch from server');
    // Verify local storage was NOT queried as a fallback
    expect(getLeadsSpy).not.toHaveBeenCalled();
    // Verify legacy local lead is NOT rendered in the table
    expect(container.textContent).not.toContain('Khách Hàng Local Không Được Hiện');
  });

  it('2. handles HTTP 401 session expiration with an explicit notification', async () => {
    vi.spyOn(leadAdminApi, 'listLeads').mockRejectedValueOnce({
      status: 401,
      code: 'UNAUTHORIZED',
      message: 'Unauthorized',
    });

    await act(async () => {
      root.render(<LeadDashboard currentCampaign={sampleCampaign} />);
    });

    expect(container.textContent).toContain('Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại');
  });

  it('3. on delete lead failure, shows error and does NOT show false success or delete from StorageService', async () => {
    vi.spyOn(leadAdminApi, 'listLeads').mockResolvedValueOnce([
      {
        id: 'lead_server_1',
        campaign_id: 'camp_1',
        quiz_session_id: null,
        full_name: 'Nguyễn Văn Server',
        phone_number: '0912345678',
        masked_phone: '0912***678',
        score: 1500,
        time_taken_seconds: 25,
        voucher_code: 'VOUCHER1',
        submitted_at: '2026-11-05T00:00:00Z',
      },
    ]);

    const deleteLeadSpy = vi.spyOn(StorageService, 'deleteLead');
    vi.spyOn(leadAdminApi, 'deleteLead').mockRejectedValueOnce(
      new Error('Database delete error')
    );

    await act(async () => {
      root.render(<LeadDashboard currentCampaign={sampleCampaign} />);
    });

    expect(container.textContent).toContain('Nguyễn Văn Server');

    // Click delete button for this lead
    const deleteBtn = container.querySelector(
      'button[aria-label="Xóa lead của Nguyễn Văn Server"]'
    ) as HTMLButtonElement;
    expect(deleteBtn).toBeTruthy();

    await act(async () => {
      deleteBtn.click();
    });

    // Confirm modal should be open
    const modal = container.querySelector('div[aria-labelledby="delete-lead-modal-title"]');
    expect(modal).toBeTruthy();

    const confirmBtn = Array.from(modal!.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Xác nhận xóa')
    ) as HTMLButtonElement;
    expect(confirmBtn).toBeTruthy();

    await act(async () => {
      confirmBtn.click();
    });

    // Error must be displayed
    expect(container.textContent).toContain('Database delete error');
    // False success must NEVER be displayed
    expect(container.textContent).not.toContain('thành công!');
    // StorageService must NOT have been called
    expect(deleteLeadSpy).not.toHaveBeenCalled();
  });
});
