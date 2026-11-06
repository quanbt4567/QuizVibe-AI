import type { Campaign, CampaignStatus, CampaignSummary } from '../types';

/**
 * Browser client for the authenticated Admin campaign API (`/api/admin/manage?resource=campaigns`).
 * Authentication is the HttpOnly session cookie; no token or secret is handled here.
 * Every failure is thrown as `AdminApiError` — callers can never mistake an error for success.
 */

export class AdminApiError extends Error {
  public readonly status: number;
  public readonly code: string;
  public readonly fieldErrors?: Record<string, string>;

  constructor(status: number, code: string, message: string, fieldErrors?: Record<string, string>) {
    super(message);
    this.name = 'AdminApiError';
    this.status = status;
    this.code = code;
    this.fieldErrors = fieldErrors;
  }

  /** True when the Admin session is missing/expired/revoked and the user must sign in again. */
  get isUnauthenticated(): boolean {
    return this.status === 401;
  }
}

export type CampaignTransitionAction = 'publish' | 'unpublish' | 'archive' | 'restore';

type FetchLike = typeof fetch;

/** Builds the write payload from an editor `Campaign`. Never sends id, slug, or status. */
export function toCampaignWritePayload(campaign: Campaign) {
  return {
    title: campaign.title,
    description: campaign.description,
    industry: campaign.industry,
    isAiGenerated: Boolean(campaign.isAiGenerated),
    isMock: Boolean(campaign.isMock),
    mockLabel: campaign.mockLabel,
    questions: campaign.questions.map((q) => ({
      question: q.question,
      options: q.options,
      correctIndex: q.correctIndex,
      explanation: q.explanation,
    })),
    voucher: {
      code: campaign.voucher.code,
      discount: campaign.voucher.discount,
      description: campaign.voucher.description,
      expiryDate: campaign.voucher.expiryDate,
      terms: campaign.voucher.terms,
    },
  };
}

async function request<T>(
  fetchImpl: FetchLike,
  method: 'GET' | 'POST' | 'PUT' | 'DELETE',
  query: Record<string, string>,
  body?: unknown
): Promise<T> {
  const qs = new URLSearchParams({ resource: 'campaigns', ...query }).toString();

  let response: Response;
  try {
    response = await fetchImpl(`/api/admin/manage?${qs}`, {
      method,
      credentials: 'same-origin',
      headers: {
        Accept: 'application/json',
        ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new AdminApiError(0, 'NETWORK_ERROR', 'Không thể kết nối đến máy chủ. Vui lòng thử lại.');
  }

  const data = await response.json().catch(() => null);
  if (!response.ok || !data || data.ok !== true) {
    throw new AdminApiError(
      response.status,
      data?.code || 'REQUEST_FAILED',
      data?.error || `Máy chủ phản hồi lỗi ${response.status}.`,
      data?.fieldErrors
    );
  }
  return data as T;
}

export function createCampaignAdminApi(fetchImpl: FetchLike = (...args) => fetch(...args)) {
  return {
    async list(status?: CampaignStatus): Promise<CampaignSummary[]> {
      const data = await request<{ campaigns?: CampaignSummary[] }>(
        fetchImpl,
        'GET',
        status ? { status } : {}
      );
      return Array.isArray(data?.campaigns) ? data.campaigns : [];
    },

    async get(id: string): Promise<Campaign> {
      const data = await request<{ campaign: Campaign }>(fetchImpl, 'GET', { id });
      return data.campaign;
    },

    async create(campaign: Campaign): Promise<Campaign> {
      const data = await request<{ campaign: Campaign }>(
        fetchImpl,
        'POST',
        {},
        toCampaignWritePayload(campaign)
      );
      return data.campaign;
    },

    async update(id: string, campaign: Campaign): Promise<Campaign> {
      const data = await request<{ campaign: Campaign }>(
        fetchImpl,
        'PUT',
        { id },
        toCampaignWritePayload(campaign)
      );
      return data.campaign;
    },

    async transition(id: string, action: CampaignTransitionAction): Promise<Campaign> {
      const data = await request<{ campaign: Campaign }>(fetchImpl, 'POST', { id, action });
      return data.campaign;
    },
  };
}

export const campaignAdminApi = createCampaignAdminApi();

