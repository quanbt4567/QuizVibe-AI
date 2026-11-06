import { assertServerRuntime } from '../db/config';
import type {
  CampaignQuestionRow,
  CampaignRow,
  CampaignStatus,
  CompleteCampaignRecord,
  VoucherRow,
} from '../db/types';

assertServerRuntime();

/**
 * Explicit, allow-list DTO mappers.
 *
 * SECURITY: the PUBLIC mapper builds a brand-new object from an allow-list of fields.
 * It never spreads or copies a database row, so answer-verification metadata
 * (`correct_index`, `explanation`) and the reward code can never leak by accident when
 * a new column is added to the table.
 */

// ---------------------------------------------------------------------------
// Admin DTOs (authenticated endpoints only) — keeps everything needed for editing
// ---------------------------------------------------------------------------

export interface AdminQuestionDto {
  id: string;
  question: string;
  options: [string, string, string, string];
  correctIndex: number;
  explanation?: string;
}

export interface AdminVoucherDto {
  code: string;
  discount: string;
  description: string;
  expiryDate?: string;
  terms?: string;
}

export interface AdminCampaignDto {
  id: string;
  slug: string;
  status: CampaignStatus;
  title: string;
  description: string;
  industry: string;
  isAiGenerated: boolean;
  isMock: boolean;
  mockLabel?: string;
  publishedAt?: string;
  createdAt: string;
  updatedAt: string;
  questions: AdminQuestionDto[];
  voucher: AdminVoucherDto;
}

export interface AdminCampaignSummaryDto {
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

function sortedQuestions(questions: CampaignQuestionRow[]): CampaignQuestionRow[] {
  return [...questions].sort((a, b) => a.question_order - b.question_order);
}

export function toAdminCampaignDto(record: CompleteCampaignRecord): AdminCampaignDto {
  const { campaign, questions, voucher } = record;
  const v: VoucherRow | null = voucher;
  return {
    id: campaign.id,
    slug: campaign.slug,
    status: campaign.status,
    title: campaign.title,
    description: campaign.description,
    industry: campaign.industry,
    isAiGenerated: campaign.is_ai_generated,
    isMock: campaign.is_mock,
    mockLabel: campaign.mock_label ?? undefined,
    publishedAt: campaign.published_at ?? undefined,
    createdAt: campaign.created_at,
    updatedAt: campaign.updated_at,
    questions: sortedQuestions(questions).map((q) => ({
      id: q.id,
      question: q.question_text,
      options: q.options,
      correctIndex: q.correct_index,
      explanation: q.explanation ?? undefined,
    })),
    voucher: {
      code: v?.code ?? '',
      discount: v?.discount ?? '',
      description: v?.description ?? '',
      expiryDate: v?.expiry_date ?? undefined,
      terms: v?.terms ?? undefined,
    },
  };
}

export function toAdminCampaignSummaryDto(
  campaign: CampaignRow,
  voucher: Pick<VoucherRow, 'code' | 'discount'> | null
): AdminCampaignSummaryDto {
  return {
    id: campaign.id,
    slug: campaign.slug,
    status: campaign.status,
    title: campaign.title,
    industry: campaign.industry,
    isAiGenerated: campaign.is_ai_generated,
    isMock: campaign.is_mock,
    mockLabel: campaign.mock_label ?? undefined,
    publishedAt: campaign.published_at ?? undefined,
    createdAt: campaign.created_at,
    updatedAt: campaign.updated_at,
    voucherCode: voucher?.code,
    voucherDiscount: voucher?.discount,
  };
}

// ---------------------------------------------------------------------------
// Public DTO (unauthenticated players) — NO answer-verification metadata
// ---------------------------------------------------------------------------

export interface PublicQuestionDto {
  id: string;
  order: number;
  question: string;
  options: [string, string, string, string];
}

export interface PublicVoucherTeaserDto {
  discount: string;
  description: string;
  expiryDate?: string;
  terms?: string;
}

export interface PublicCampaignDto {
  id: string;
  slug: string;
  title: string;
  description: string;
  industry: string;
  isMock: boolean;
  mockLabel?: string;
  publishedAt?: string;
  questionCount: number;
  questions: PublicQuestionDto[];
  voucher: PublicVoucherTeaserDto | null;
}

/**
 * Maps a campaign record to the public-safe DTO.
 * Returns null unless the campaign is PUBLISHED (defense in depth on top of the SQL filter).
 *
 * Deliberately omitted: `correct_index`, `explanation`, voucher `code`, `legacy_id`,
 * `is_ai_generated`, timestamps other than `published_at`.
 */
export function toPublicCampaignDto(record: CompleteCampaignRecord): PublicCampaignDto | null {
  const { campaign, questions, voucher } = record;
  if (campaign.status !== 'published') return null;

  const publicQuestions: PublicQuestionDto[] = sortedQuestions(questions).map((q, index) => ({
    id: q.id,
    order: index,
    question: q.question_text,
    options: [q.options[0], q.options[1], q.options[2], q.options[3]],
  }));

  return {
    id: campaign.id,
    slug: campaign.slug,
    title: campaign.title,
    description: campaign.description,
    industry: campaign.industry,
    isMock: campaign.is_mock,
    mockLabel: campaign.mock_label ?? undefined,
    publishedAt: campaign.published_at ?? undefined,
    questionCount: publicQuestions.length,
    questions: publicQuestions,
    voucher: voucher
      ? {
          discount: voucher.discount,
          description: voucher.description,
          expiryDate: voucher.expiry_date ?? undefined,
          terms: voucher.terms ?? undefined,
        }
      : null,
  };
}

