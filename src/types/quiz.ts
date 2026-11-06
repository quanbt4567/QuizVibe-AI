export const MOCK_MODE_LABEL = 'Bản demo vòng loại - Dữ liệu mô phỏng AI';

export type PresetIndustry = 'cosmetics' | 'fashion' | 'tech' | 'fnb';

export interface Question {
  id: string;
  question: string;
  options: [string, string, string, string];
  correctIndex: number; // 0..3
  explanation?: string;
}

export interface VoucherConfig {
  code: string;
  discount: string;
  description: string;
  expiryDate?: string;
  terms?: string;
}

export interface Campaign {
  id: string;
  title: string;
  description: string;
  industry: string;
  questions: Question[];
  voucher: VoucherConfig;
  createdAt: string;
  updatedAt: string;
  isAiGenerated?: boolean;
  isMock?: boolean;
  mockLabel?: string;
  /** Database-backed campaigns only (Phase 3). Absent on legacy localStorage campaigns. */
  slug?: string;
  status?: 'draft' | 'published' | 'archived';
  publishedAt?: string;
}
