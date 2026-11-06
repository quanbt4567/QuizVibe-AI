/**
 * Server-Side Relational Database Types for Supabase PostgreSQL
 * Mirrors supabase/migrations/20261105000001_initial_quizvibe_schema.sql
 * Note: Uses `type` aliases (instead of `interface`) so row/insert/update shapes
 * satisfy @supabase/postgrest-js `GenericTable` (`Record<string, unknown>`) constraints.
 */

export type CampaignStatus = 'draft' | 'published' | 'archived';
export type QuizSessionStatus = 'in_progress' | 'completed' | 'expired';

export type CampaignRow = {
  id: string;
  slug: string;
  legacy_id: string | null;
  title: string;
  description: string;
  industry: string;
  status: CampaignStatus;
  is_ai_generated: boolean;
  is_mock: boolean;
  mock_label: string | null;
  published_at: string | null;
  created_at: string;
  updated_at: string;
};

export type CampaignInsert = {
  id?: string;
  slug: string;
  legacy_id?: string | null;
  title: string;
  description?: string;
  industry: string;
  status?: CampaignStatus;
  is_ai_generated?: boolean;
  is_mock?: boolean;
  mock_label?: string | null;
  published_at?: string | null;
  created_at?: string;
  updated_at?: string;
};

export type CampaignUpdate = {
  slug?: string;
  legacy_id?: string | null;
  title?: string;
  description?: string;
  industry?: string;
  status?: CampaignStatus;
  is_ai_generated?: boolean;
  is_mock?: boolean;
  mock_label?: string | null;
  published_at?: string | null;
  updated_at?: string;
};

export type CampaignQuestionRow = {
  id: string;
  campaign_id: string;
  question_order: number; // 0..4
  question_text: string;
  options: [string, string, string, string];
  correct_index: number; // 0..3
  explanation: string | null;
  created_at: string;
  updated_at: string;
};

export type CampaignQuestionInsert = {
  id?: string;
  campaign_id: string;
  question_order: number;
  question_text: string;
  options: [string, string, string, string];
  correct_index: number;
  explanation?: string | null;
  created_at?: string;
  updated_at?: string;
};

export type VoucherRow = {
  id: string;
  campaign_id: string;
  code: string;
  discount: string;
  description: string;
  expiry_date: string | null;
  terms: string | null;
  created_at: string;
  updated_at: string;
};

export type VoucherInsert = {
  id?: string;
  campaign_id: string;
  code: string;
  discount: string;
  description?: string;
  expiry_date?: string | null;
  terms?: string | null;
  created_at?: string;
  updated_at?: string;
};

export type QuizSessionAnswerSnapshot = {
  questionOrder: number;
  selectedIndex: number | null;
  isCorrect: boolean;
  remainingSeconds: number;
  pointsAwarded: number;
};

export type QuizSessionRow = {
  id: string;
  campaign_id: string;
  status: QuizSessionStatus;
  total_score: number;
  correct_count: number;
  total_questions: number;
  time_taken_seconds: number;
  answers_snapshot: QuizSessionAnswerSnapshot[];
  started_at: string;
  completed_at: string | null;
  created_at: string;
  session_token_hash?: string | null;
  current_question_index?: number;
  current_question_started_at?: string;
};

export type QuizSessionInsert = {
  id?: string;
  campaign_id: string;
  status?: QuizSessionStatus;
  total_score: number;
  correct_count: number;
  total_questions?: number;
  time_taken_seconds: number;
  answers_snapshot?: QuizSessionAnswerSnapshot[];
  started_at?: string;
  completed_at?: string | null;
  created_at?: string;
  session_token_hash?: string | null;
  current_question_index?: number;
  current_question_started_at?: string;
};

export type LeadRow = {
  id: string;
  campaign_id: string;
  quiz_session_id: string | null;
  full_name: string;
  phone_number: string;
  phone_hash?: string | null;
  masked_phone: string;
  score: number;
  time_taken_seconds: number;
  voucher_code: string | null;
  submitted_at: string;
  created_at: string;
};

export type LeadInsert = {
  id?: string;
  campaign_id: string;
  quiz_session_id?: string | null;
  full_name: string;
  phone_number: string;
  phone_hash?: string;
  masked_phone: string;
  score: number;
  time_taken_seconds: number;
  voucher_code?: string | null;
  submitted_at?: string;
  created_at?: string;
};

export type CampaignPhoneRegistrationRow = {
  id: string;
  campaign_id: string;
  phone_hash: string;
  first_lead_id: string | null;
  created_at: string;
};

export type CampaignPhoneRegistrationInsert = {
  id?: string;
  campaign_id: string;
  phone_hash: string;
  first_lead_id?: string | null;
  created_at?: string;
};

export type PublicLeaderboardRow = {
  id: string;
  campaign_id: string;
  full_name: string;
  masked_phone: string;
  score: number;
  time_taken_seconds: number;
  submitted_at: string;
  rank: number;
};

export type CompleteCampaignRecord = {
  campaign: CampaignRow;
  questions: CampaignQuestionRow[];
  voucher: VoucherRow | null;
};

export type AdminSessionRow = {
  id: string;
  token_hash: string;
  created_at: string;
  expires_at: string;
  revoked_at: string | null;
  last_seen_at: string;
};

export type AdminSessionInsert = {
  id?: string;
  token_hash: string;
  created_at?: string;
  expires_at: string;
  revoked_at?: string | null;
  last_seen_at?: string;
};

export type Database = {
  public: {
    Tables: {
      campaigns: {
        Row: CampaignRow;
        Insert: CampaignInsert;
        Update: CampaignUpdate;
        Relationships: [];
      };
      campaign_questions: {
        Row: CampaignQuestionRow;
        Insert: CampaignQuestionInsert;
        Update: Partial<CampaignQuestionInsert>;
        Relationships: [];
      };
      vouchers: {
        Row: VoucherRow;
        Insert: VoucherInsert;
        Update: Partial<VoucherInsert>;
        Relationships: [];
      };
      quiz_sessions: {
        Row: QuizSessionRow;
        Insert: QuizSessionInsert;
        Update: Partial<QuizSessionInsert>;
        Relationships: [];
      };
      leads: {
        Row: LeadRow;
        Insert: LeadInsert;
        Update: Partial<LeadInsert>;
        Relationships: [];
      };
      campaign_phone_registrations: {
        Row: CampaignPhoneRegistrationRow;
        Insert: CampaignPhoneRegistrationInsert;
        Update: Partial<CampaignPhoneRegistrationInsert>;
        Relationships: [];
      };
      admin_sessions: {
        Row: AdminSessionRow;
        Insert: AdminSessionInsert;
        Update: Partial<AdminSessionInsert>;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      admin_save_campaign: {
        Args: { p_campaign_id: string | null; p_payload: Record<string, unknown> };
        Returns: string;
      };
      register_quiz_lead: {
        Args: { p_payload: Record<string, unknown> };
        Returns: LeadRow;
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
