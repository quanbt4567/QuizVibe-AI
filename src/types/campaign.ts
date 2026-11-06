/**
 * Campaign lifecycle + API data-transfer types shared by the browser services.
 *
 * SECURITY: `PublicCampaign` / `PublicQuestion` intentionally have NO field for the correct
 * answer, an answer key, an explanation, or the voucher code. Public players are never sent them.
 */

export type CampaignStatus = 'draft' | 'published' | 'archived';

/** Row shown in the Admin campaign library (no questions, no answers). */
export interface CampaignSummary {
  id: string;
  slug: string;
  status: CampaignStatus;
  title: string;
  industry: string;
  isAiGenerated: boolean;
  isMock: boolean;
  mockLabel?: string;
  publishedAt?: string;
  createdAt: string;
  updatedAt: string;
  voucherCode?: string;
  voucherDiscount?: string;
}

/** Sanitized question served to anonymous players: text and options only. */
export interface PublicQuestion {
  id: string;
  order: number;
  question: string;
  options: [string, string, string, string];
}

export interface PublicVoucherTeaser {
  discount: string;
  description: string;
  expiryDate?: string;
  terms?: string;
}

/** Sanitized published campaign served by `GET /api/public/campaign`. */
export interface PublicCampaign {
  id: string;
  slug: string;
  title: string;
  description: string;
  industry: string;
  isMock: boolean;
  mockLabel?: string;
  publishedAt?: string;
  questionCount: number;
  questions: PublicQuestion[];
  voucher: PublicVoucherTeaser | null;
}

