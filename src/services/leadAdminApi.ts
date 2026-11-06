import { AdminApiError } from './campaignAdminApi';

export interface AdminLeadItem {
  id: string;
  campaign_id: string;
  campaign_title?: string;
  quiz_session_id: string | null;
  full_name: string;
  phone_number: string;
  masked_phone: string;
  score: number;
  time_taken_seconds: number;
  voucher_code: string;
  submitted_at: string;
}

export const leadAdminApi = {
  async listLeads(options?: {
    campaignId?: string;
    search?: string;
    sortBy?: 'newest' | 'score_desc' | 'time_asc';
  }): Promise<AdminLeadItem[]> {
    const params = new URLSearchParams({ resource: 'leads' });
    if (options?.campaignId && options.campaignId !== 'all') params.set('campaignId', options.campaignId);
    if (options?.search) params.set('search', options.search);
    if (options?.sortBy) params.set('sortBy', options.sortBy);

    let res: Response;
    try {
      res = await fetch(`/api/admin/manage?${params.toString()}`, {
        method: 'GET',
        headers: { Accept: 'application/json' },
      });
    } catch {
      throw new AdminApiError(0, 'NETWORK_ERROR', 'Không thể kết nối đến máy chủ.');
    }

    const data = await res.json().catch(() => null);
    if (!res.ok || !data || data.ok !== true) {
      throw new AdminApiError(res.status, data?.code || 'REQUEST_FAILED', data?.error || 'Lỗi tải danh sách lead.');
    }

    return Array.isArray(data.leads) ? data.leads : [];
  },

  async deleteLead(id: string): Promise<boolean> {
    const params = new URLSearchParams({ resource: 'leads', id });
    let res: Response;
    try {
      res = await fetch(`/api/admin/manage?${params.toString()}`, {
        method: 'DELETE',
        headers: { Accept: 'application/json' },
      });
    } catch {
      throw new AdminApiError(0, 'NETWORK_ERROR', 'Không thể kết nối đến máy chủ.');
    }

    const data = await res.json().catch(() => null);
    if (!res.ok || !data || data.ok !== true) {
      throw new AdminApiError(res.status, data?.code || 'REQUEST_FAILED', data?.error || 'Không thể xóa lead.');
    }

    return true;
  },

  async clearAllLeads(campaignId?: string): Promise<boolean> {
    const params = new URLSearchParams({ resource: 'leads', action: 'clear-all' });
    if (campaignId && campaignId !== 'all') params.set('campaignId', campaignId);

    let res: Response;
    try {
      res = await fetch(`/api/admin/manage?${params.toString()}`, {
        method: 'DELETE',
        headers: { Accept: 'application/json' },
      });
    } catch {
      throw new AdminApiError(0, 'NETWORK_ERROR', 'Không thể kết nối đến máy chủ.');
    }

    const data = await res.json().catch(() => null);
    if (!res.ok || !data || data.ok !== true) {
      throw new AdminApiError(res.status, data?.code || 'REQUEST_FAILED', data?.error || 'Không thể xóa toàn bộ lead.');
    }

    return true;
  },

  downloadLeadsCsvUrl(campaignId?: string): string {
    const params = new URLSearchParams({ resource: 'leads', format: 'csv' });
    if (campaignId && campaignId !== 'all') params.set('campaignId', campaignId);
    return `/api/admin/manage?${params.toString()}`;
  },
};

