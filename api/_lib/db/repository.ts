import crypto from 'node:crypto';
import { SupabaseClient } from '@supabase/supabase-js';
import {
  CampaignInsert,
  CampaignQuestionInsert,
  CampaignQuestionRow,
  CampaignRow,
  CampaignStatus,
  CompleteCampaignRecord,
  Database,
  LeadInsert,
  LeadRow,
  PublicLeaderboardRow,
  QuizSessionAnswerSnapshot,
  QuizSessionInsert,
  QuizSessionRow,
  QuizSessionStatus,
  VoucherInsert,
  VoucherRow,
} from './types.js';
import { assertServerRuntime } from './config.js';
import { getSupabaseServerClient } from './supabaseServer.js';

// Enforce server-only boundary at module load time
assertServerRuntime();

export const SERVER_VIETNAMESE_PHONE_REGEX = /^(03|05|07|08|09)\d{8}$/;

export class DatabaseOperationError extends Error {
  public readonly code: string;
  public readonly details?: unknown;

  constructor(code: string, message: string, details?: unknown) {
    super(message);
    this.name = 'DatabaseOperationError';
    this.code = code;
    this.details = details;
  }
}

/**
 * Generates a URL-safe slug from a Vietnamese campaign title.
 * Example: "Thử Thách Chăm Da Đẹp!" -> "thu-thach-cham-da-dep"
 */
export function slugifyCampaignTitle(title: string, suffix?: string): string {
  const normalized = (title || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'd')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

  const base = normalized.length >= 3 ? normalized : `campaign-${normalized || 'quiz'}`;
  if (suffix && suffix.trim() !== '') {
    const cleanSuffix = suffix
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
    return cleanSuffix ? `${base}-${cleanSuffix}` : base;
  }
  return base;
}

/**
 * Validates a 10-digit Vietnamese mobile phone number on the server.
 */
export function isValidVietnamesePhoneServer(phone: string): boolean {
  if (typeof phone !== 'string') return false;
  const clean = phone.trim().replace(/\s+/g, '');
  return SERVER_VIETNAMESE_PHONE_REGEX.test(clean);
}

/**
 * Computes the privacy-masked phone number on the server (e.g., 098***5678).
 */
export function maskVietnamesePhone(phone: string): string {
  const clean = (phone || '').trim().replace(/\s+/g, '');
  if (!isValidVietnamesePhoneServer(clean)) {
    throw new DatabaseOperationError(
      'INVALID_PHONE_NUMBER',
      'Số điện thoại không đúng định dạng di động Việt Nam (10 chữ số, đầu số 03, 05, 07, 08, 09).'
    );
  }
  return `${clean.slice(0, 3)}***${clean.slice(-4)}`;
}

export interface CreateCampaignDetailsInput {
  campaign: CampaignInsert;
  questions: Array<{
    question_order: number;
    question_text: string;
    options: [string, string, string, string];
    correct_index: number;
    explanation?: string | null;
  }>;
  voucher: {
    code: string;
    discount: string;
    description?: string;
    expiry_date?: string | null;
    terms?: string | null;
  };
}

export interface CreateLeadServerInput {
  campaign_id: string;
  quiz_session_id?: string | null;
  full_name: string;
  phone_number: string;
  score: number;
  time_taken_seconds: number;
  voucher_code?: string | null;
  submitted_at?: string;
}

/**
 * Minimal, server-only data-access repository for QuizVibe AI PostgreSQL tables.
 * Never falls back to browser localStorage.
 */
export class QuizVibeDatabaseRepository {
  private readonly clientProvider: () => SupabaseClient<Database>;

  constructor(client?: SupabaseClient<Database>) {
    assertServerRuntime();
    this.clientProvider = client ? () => client : () => getSupabaseServerClient();
  }

  private get db(): SupabaseClient<Database> {
    assertServerRuntime();
    return this.clientProvider();
  }

  /**
   * Fetches a single PUBLISHED campaign by its public slug along with ordered questions and voucher.
   * Draft and archived campaigns are strictly excluded from public lookup.
   */
  public async getPublishedCampaignBySlug(slug: string): Promise<CompleteCampaignRecord | null> {
    const cleanSlug = (slug || '').trim().toLowerCase();
    if (!cleanSlug) return null;

    const { data: campaign, error: campaignError } = await this.db
      .from('campaigns')
      .select('*')
      .eq('slug', cleanSlug)
      .eq('status', 'published')
      .maybeSingle();

    if (campaignError) {
      throw new DatabaseOperationError(
        'CAMPAIGN_QUERY_FAILED',
        `Failed to fetch published campaign for slug "${cleanSlug}": ${campaignError.message}`,
        campaignError
      );
    }

    if (!campaign) {
      return null;
    }

    return this.hydrateCampaignRelations(campaign as CampaignRow);
  }

  /**
   * Fetches a campaign by UUID regardless of status (for Admin Studio operations).
   */
  public async getCampaignById(campaignId: string): Promise<CompleteCampaignRecord | null> {
    const { data: campaign, error: campaignError } = await this.db
      .from('campaigns')
      .select('*')
      .eq('id', campaignId)
      .maybeSingle();

    if (campaignError) {
      throw new DatabaseOperationError(
        'CAMPAIGN_QUERY_FAILED',
        `Failed to fetch campaign "${campaignId}": ${campaignError.message}`,
        campaignError
      );
    }

    if (!campaign) {
      return null;
    }

    return this.hydrateCampaignRelations(campaign as CampaignRow);
  }

  /**
   * Lists campaigns ordered by updated_at DESC, optionally filtered by lifecycle status.
   */
  public async listCampaigns(status?: CampaignStatus): Promise<CampaignRow[]> {
    let query = this.db.from('campaigns').select('*').order('updated_at', { ascending: false });
    if (status) {
      query = query.eq('status', status);
    }

    const { data, error } = await query;
    if (error) {
      throw new DatabaseOperationError(
        'CAMPAIGN_LIST_FAILED',
        `Failed to list campaigns: ${error.message}`,
        error
      );
    }

    return (data ?? []) as CampaignRow[];
  }

  /**
   * Creates a campaign along with its 5 questions and voucher configuration.
   */
  public async createCampaignWithDetails(
    input: CreateCampaignDetailsInput
  ): Promise<CompleteCampaignRecord> {
    if (!Array.isArray(input.questions) || input.questions.length !== 5) {
      throw new DatabaseOperationError(
        'INVALID_QUESTION_COUNT',
        'A campaign must contain exactly 5 questions.'
      );
    }

    const status: CampaignStatus = input.campaign.status ?? 'draft';
    const campaignPayload: CampaignInsert = {
      ...input.campaign,
      slug: slugifyCampaignTitle(input.campaign.slug || input.campaign.title),
      status,
      published_at:
        status === 'published'
          ? input.campaign.published_at ?? new Date().toISOString()
          : null,
    };

    const { data: createdCampaign, error: campaignError } = await this.db
      .from('campaigns')
      .insert(campaignPayload)
      .select('*')
      .single();

    if (campaignError || !createdCampaign) {
      throw new DatabaseOperationError(
        'CAMPAIGN_CREATE_FAILED',
        `Failed to create campaign: ${campaignError?.message || 'Unknown error'}`,
        campaignError
      );
    }

    const campaignRow = createdCampaign as CampaignRow;

    const questionPayloads: CampaignQuestionInsert[] = input.questions.map((q, idx) => ({
      campaign_id: campaignRow.id,
      question_order: typeof q.question_order === 'number' ? q.question_order : idx,
      question_text: q.question_text.trim(),
      options: q.options,
      correct_index: q.correct_index,
      explanation: q.explanation ?? null,
    }));

    const { data: createdQuestions, error: questionsError } = await this.db
      .from('campaign_questions')
      .insert(questionPayloads)
      .select('*');

    if (questionsError || !createdQuestions) {
      throw new DatabaseOperationError(
        'QUESTIONS_CREATE_FAILED',
        `Failed to insert campaign questions: ${questionsError?.message || 'Unknown error'}`,
        questionsError
      );
    }

    const voucherPayload: VoucherInsert = {
      campaign_id: campaignRow.id,
      code: input.voucher.code.trim(),
      discount: input.voucher.discount.trim(),
      description: input.voucher.description ?? '',
      expiry_date: input.voucher.expiry_date ?? null,
      terms: input.voucher.terms ?? null,
    };

    const { data: createdVoucher, error: voucherError } = await this.db
      .from('vouchers')
      .insert(voucherPayload)
      .select('*')
      .single();

    if (voucherError || !createdVoucher) {
      throw new DatabaseOperationError(
        'VOUCHER_CREATE_FAILED',
        `Failed to insert campaign voucher: ${voucherError?.message || 'Unknown error'}`,
        voucherError
      );
    }

    return {
      campaign: campaignRow,
      questions: (createdQuestions as CampaignQuestionRow[]).sort(
        (a, b) => a.question_order - b.question_order
      ),
      voucher: createdVoucher as VoucherRow,
    };
  }

  /**
   * Transitions a campaign between draft, published, and archived states.
   */
  public async updateCampaignStatus(
    campaignId: string,
    status: CampaignStatus
  ): Promise<CampaignRow> {
    const updatePayload = {
      status,
      published_at: status === 'published' ? new Date().toISOString() : undefined,
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await this.db
      .from('campaigns')
      .update(updatePayload)
      .eq('id', campaignId)
      .select('*')
      .single();

    if (error || !data) {
      throw new DatabaseOperationError(
        'CAMPAIGN_STATUS_UPDATE_FAILED',
        `Failed to update campaign status to "${status}": ${error?.message || 'Unknown error'}`,
        error
      );
    }

    return data as CampaignRow;
  }

  /**
   * Records a completed or in-progress quiz session scoped to a campaign.
   */
  public async createQuizSession(input: QuizSessionInsert): Promise<QuizSessionRow> {
    if (input.total_score < 0 || input.total_score > 2000) {
      throw new DatabaseOperationError(
        'INVALID_SESSION_SCORE',
        'Quiz session score must be between 0 and 2000.'
      );
    }

    const { data, error } = await this.db
      .from('quiz_sessions')
      .insert(input)
      .select('*')
      .single();

    if (error || !data) {
      throw new DatabaseOperationError(
        'QUIZ_SESSION_CREATE_FAILED',
        `Failed to record quiz session: ${error?.message || 'Unknown error'}`,
        error
      );
    }

    return data as QuizSessionRow;
  }

  /**
   * Validates and stores a participant lead scoped to a specific campaign.
   * Automatically computes `masked_phone` on the server so public views never need raw phone numbers.
   */
  public async createLeadForCampaign(input: CreateLeadServerInput): Promise<LeadRow> {
    const cleanName = (input.full_name || '').trim();
    if (cleanName.length < 2) {
      throw new DatabaseOperationError(
        'INVALID_LEAD_NAME',
        'Họ và tên phải có ít nhất 2 ký tự.'
      );
    }

    const cleanPhone = (input.phone_number || '').trim().replace(/\s+/g, '');
    const maskedPhone = maskVietnamesePhone(cleanPhone);

    if (typeof input.score !== 'number' || input.score < 0 || input.score > 2000) {
      throw new DatabaseOperationError(
        'INVALID_LEAD_SCORE',
        'Điểm số không hợp lệ (phải từ 0 đến 2.000 điểm).'
      );
    }

    if (typeof input.time_taken_seconds !== 'number' || input.time_taken_seconds < 0) {
      throw new DatabaseOperationError(
        'INVALID_LEAD_TIME',
        'Thời gian hoàn thành không hợp lệ.'
      );
    }

    const leadInsert: LeadInsert = {
      campaign_id: input.campaign_id,
      quiz_session_id: input.quiz_session_id ?? null,
      full_name: cleanName,
      phone_number: cleanPhone,
      masked_phone: maskedPhone,
      score: input.score,
      time_taken_seconds: input.time_taken_seconds,
      voucher_code: input.voucher_code ? input.voucher_code.trim() : null,
      submitted_at: input.submitted_at ?? new Date().toISOString(),
    };

    const { data, error } = await this.db
      .from('leads')
      .insert(leadInsert)
      .select('*')
      .single();

    if (error || !data) {
      throw new DatabaseOperationError(
        'LEAD_CREATE_FAILED',
        `Failed to store lead for campaign "${input.campaign_id}": ${error?.message || 'Unknown error'}`,
        error
      );
    }

    return data as LeadRow;
  }

  /**
   * Returns the deterministic Top N Leaderboard for a campaign without exposing raw `phone_number`.
   * Canonical ordering: score DESC, time_taken_seconds ASC, submitted_at ASC.
   */
  public async getCampaignLeaderboard(
    campaignId: string,
    limit = 10
  ): Promise<PublicLeaderboardRow[]> {
    const { data, error } = await this.db
      .from('leads')
      .select('id, campaign_id, full_name, masked_phone, score, time_taken_seconds, submitted_at')
      .eq('campaign_id', campaignId)
      .order('score', { ascending: false })
      .order('time_taken_seconds', { ascending: true })
      .order('submitted_at', { ascending: true })
      .limit(limit);

    if (error) {
      throw new DatabaseOperationError(
        'LEADERBOARD_QUERY_FAILED',
        `Failed to query leaderboard for campaign "${campaignId}": ${error.message}`,
        error
      );
    }

    const rows = (data ?? []) as Array<Omit<PublicLeaderboardRow, 'rank'>>;
    return rows.map((row, index) => ({
      ...row,
      rank: index + 1,
    }));
  }

  /**
   * Retrieves a quiz gameplay session by its SHA-256 session token hash.
   * Player tokens are never stored or queried in plaintext at rest.
   */
  public async getQuizSessionByTokenHash(tokenHash: string): Promise<QuizSessionRow | null> {
    if (!tokenHash) return null;
    const { data, error } = await this.db
      .from('quiz_sessions')
      .select('*')
      .eq('session_token_hash', tokenHash)
      .maybeSingle();

    if (error) {
      throw new DatabaseOperationError(
        'QUIZ_SESSION_QUERY_FAILED',
        `Failed to query quiz session: ${error.message}`,
        error
      );
    }
    return (data as QuizSessionRow | null) ?? null;
  }

  /**
   * Retrieves a quiz gameplay session given a raw player bearer token.
   * Computes the SHA-256 hash and performs a hash-only indexed B-tree lookup.
   * Player tokens are never stored, queried, or logged in plaintext at rest.
   */
  public async getQuizSessionByToken(token: string): Promise<QuizSessionRow | null> {
    if (!token) return null;
    const cleanToken = token.trim();
    if (!cleanToken) return null;
    const tokenHash = crypto.createHash('sha256').update(cleanToken).digest('hex');

    return this.getQuizSessionByTokenHash(tokenHash);
  }

  /**
   * Returns all 5 questions for a campaign in deterministic order (0..4) including correct_index.
   * Server-internal only; never returned directly to the player client during gameplay.
   */
  public async getCampaignQuestionsByCampaignId(campaignId: string): Promise<CampaignQuestionRow[]> {
    const { data, error } = await this.db
      .from('campaign_questions')
      .select('*')
      .eq('campaign_id', campaignId)
      .order('question_order', { ascending: true });

    if (error) {
      throw new DatabaseOperationError(
        'QUESTIONS_QUERY_FAILED',
        `Failed to query questions for campaign "${campaignId}": ${error.message}`,
        error
      );
    }
    return (data ?? []) as CampaignQuestionRow[];
  }

  /**
   * Returns the single configured voucher for a campaign, or null if unconfigured.
   */
  public async getVoucherByCampaignId(campaignId: string): Promise<VoucherRow | null> {
    const { data, error } = await this.db
      .from('vouchers')
      .select('*')
      .eq('campaign_id', campaignId)
      .maybeSingle();

    if (error) {
      throw new DatabaseOperationError(
        'VOUCHER_QUERY_FAILED',
        `Failed to query voucher for campaign "${campaignId}": ${error.message}`,
        error
      );
    }
    return (data as VoucherRow | null) ?? null;
  }

  /**
   * Concurrency-safe atomic question progression.
   * Uses compare-and-set on `status = 'in_progress'` and `current_question_index = expectedQuestionIndex`.
   * Returns null if another concurrent request already advanced this question index.
   */
  public async updateQuizSessionAnswerAtomic(
    sessionId: string,
    expectedQuestionIndex: number,
    payload: {
      total_score: number;
      correct_count: number;
      current_question_index: number;
      current_question_started_at: string;
      answers_snapshot: QuizSessionAnswerSnapshot[];
      status: QuizSessionStatus;
      completed_at: string | null;
      time_taken_seconds: number;
    }
  ): Promise<QuizSessionRow | null> {
    const { data, error } = await this.db
      .from('quiz_sessions')
      .update(payload)
      .eq('id', sessionId)
      .eq('status', 'in_progress')
      .eq('current_question_index', expectedQuestionIndex)
      .select('*')
      .maybeSingle();

    if (error) {
      throw new DatabaseOperationError(
        'QUIZ_SESSION_UPDATE_FAILED',
        `Failed to update quiz session atomically: ${error.message}`,
        error
      );
    }
    return (data as QuizSessionRow | null) ?? null;
  }

  /**
   * Checks if a lead has already been recorded for a specific quiz session.
   */
  public async getLeadByQuizSessionId(quizSessionId: string): Promise<LeadRow | null> {
    if (!quizSessionId) return null;
    const { data, error } = await this.db
      .from('leads')
      .select('*')
      .eq('quiz_session_id', quizSessionId)
      .maybeSingle();

    if (error) {
      throw new DatabaseOperationError(
        'LEAD_QUERY_FAILED',
        `Failed to check existing lead: ${error.message}`,
        error
      );
    }
    return (data as LeadRow | null) ?? null;
  }

  /**
   * Calculates deterministic rank for a lead in a campaign using canonical ordering:
   * 1. score DESC, 2. time_taken_seconds ASC, 3. submitted_at ASC.
   */
  public async getLeadRank(
    campaignId: string,
    score: number,
    timeTakenSeconds: number,
    submittedAt: string
  ): Promise<number> {
    const { data, error } = await this.db
      .from('leads')
      .select('id, score, time_taken_seconds, submitted_at')
      .eq('campaign_id', campaignId);

    if (error) {
      throw new DatabaseOperationError(
        'LEAD_RANK_FAILED',
        `Failed to compute lead rank: ${error.message}`,
        error
      );
    }

    const rows = (data ?? []) as Array<Pick<LeadRow, 'id' | 'score' | 'time_taken_seconds' | 'submitted_at'>>;
    const betterLeads = rows.filter((r) => {
      if (r.score > score) return true;
      if (r.score === score && r.time_taken_seconds < timeTakenSeconds) return true;
      if (
        r.score === score &&
        r.time_taken_seconds === timeTakenSeconds &&
        new Date(r.submitted_at).getTime() < new Date(submittedAt).getTime()
      ) {
        return true;
      }
      return false;
    });

    return betterLeads.length + 1;
  }

  /**
   * Lists leads for authenticated Admin management with campaign information, search, and sorting.
   */
  public async listAdminLeads(options?: {
    campaignId?: string;
    search?: string;
    sortBy?: 'newest' | 'score_desc' | 'time_asc';
  }): Promise<Array<LeadRow & { campaign_title?: string }>> {
    let query = this.db.from('leads').select('*');
    if (options?.campaignId && options.campaignId !== 'all') {
      query = query.eq('campaign_id', options.campaignId);
    }

    const { data, error } = await query;
    if (error) {
      throw new DatabaseOperationError(
        'LEADS_QUERY_FAILED',
        `Failed to list leads: ${error.message}`,
        error
      );
    }

    let list = (data ?? []) as LeadRow[];

    if (options?.search) {
      const q = options.search.trim().toLowerCase();
      list = list.filter(
        (l) =>
          (l.full_name && l.full_name.toLowerCase().includes(q)) ||
          (l.phone_number && l.phone_number.includes(q)) ||
          (l.masked_phone && l.masked_phone.includes(q)) ||
          (l.voucher_code && l.voucher_code.toLowerCase().includes(q))
      );
    }

    if (options?.sortBy === 'score_desc') {
      list.sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score;
        return a.time_taken_seconds - b.time_taken_seconds;
      });
    } else if (options?.sortBy === 'time_asc') {
      list.sort((a, b) => {
        if (a.time_taken_seconds !== b.time_taken_seconds) return a.time_taken_seconds - b.time_taken_seconds;
        return b.score - a.score;
      });
    } else {
      list.sort((a, b) => new Date(b.submitted_at).getTime() - new Date(a.submitted_at).getTime());
    }

    // Enrich with campaign title
    const campaignIds = Array.from(new Set(list.map((l) => l.campaign_id)));
    if (campaignIds.length > 0) {
      const { data: camps } = await this.db.from('campaigns').select('id, title').in('id', campaignIds);
      const titleMap = new Map((camps ?? []).map((c: any) => [c.id, c.title]));
      return list.map((l) => ({ ...l, campaign_title: titleMap.get(l.campaign_id) || '' }));
    }

    return list;
  }

  /**
   * Deletes a single lead record by ID.
   */
  public async deleteLeadById(id: string): Promise<boolean> {
    const { error } = await this.db.from('leads').delete().eq('id', id);
    if (error) {
      throw new DatabaseOperationError(
        'LEAD_DELETE_FAILED',
        `Failed to delete lead "${id}": ${error.message}`,
        error
      );
    }
    return true;
  }

  /**
   * Clears all leads for a specific campaign.
   * Requires a valid, non-empty campaign ID. Rejects missing, empty, or 'all' scopes.
   * Never permits global deletion across all campaigns.
   */
  public async clearAllLeads(campaignId: string): Promise<boolean> {
    const cleanId = (campaignId || '').trim();
    if (!cleanId || cleanId === 'all') {
      throw new DatabaseOperationError(
        'INVALID_CAMPAIGN_SCOPE',
        'Yêu cầu mã chiến dịch cụ thể để xóa leads. Thao tác xóa toàn bộ không được phép.'
      );
    }

    const { error } = await this.db
      .from('leads')
      .delete()
      .eq('campaign_id', cleanId);

    if (error) {
      throw new DatabaseOperationError(
        'LEAD_CLEAR_FAILED',
        `Failed to clear leads: ${error.message}`,
        error
      );
    }
    return true;
  }

  /**
   * Lists every campaign (all statuses) with its voucher summary for the Admin campaign library.
   * Never returns questions, so answer keys are not part of list payloads.
   */
  public async listCampaignSummaries(
    status?: CampaignStatus
  ): Promise<Array<{ campaign: CampaignRow; voucher: Pick<VoucherRow, 'code' | 'discount'> | null }>> {
    const campaigns = await this.listCampaigns(status);
    if (campaigns.length === 0) return [];

    const { data: vouchers, error } = await this.db
      .from('vouchers')
      .select('campaign_id, code, discount')
      .in(
        'campaign_id',
        campaigns.map((c) => c.id)
      );

    if (error) {
      throw new DatabaseOperationError(
        'VOUCHER_QUERY_FAILED',
        `Failed to list campaign vouchers: ${error.message}`,
        error
      );
    }

    const byCampaign = new Map<string, Pick<VoucherRow, 'code' | 'discount'>>();
    for (const v of (vouchers ?? []) as Array<Pick<VoucherRow, 'campaign_id' | 'code' | 'discount'>>) {
      byCampaign.set(v.campaign_id, { code: v.code, discount: v.discount });
    }

    return campaigns.map((campaign) => ({
      campaign,
      voucher: byCampaign.get(campaign.id) ?? null,
    }));
  }

  /**
   * Returns the most recently published campaign (used by the public root alias `/`).
   */
  public async getLatestPublishedCampaign(): Promise<CompleteCampaignRecord | null> {
    const { data, error } = await this.db
      .from('campaigns')
      .select('*')
      .eq('status', 'published')
      .order('published_at', { ascending: false })
      .limit(1);

    if (error) {
      throw new DatabaseOperationError(
        'CAMPAIGN_QUERY_FAILED',
        `Failed to fetch latest published campaign: ${error.message}`,
        error
      );
    }

    const row = ((data ?? []) as CampaignRow[])[0];
    return row ? this.hydrateCampaignRelations(row) : null;
  }

  /**
   * Returns existing slugs that start with the given prefix (slug charset is [a-z0-9-], so the
   * LIKE pattern is safe). Used for deterministic collision-free slug generation.
   */
  public async findSlugsWithPrefix(prefix: string): Promise<string[]> {
    const { data, error } = await this.db
      .from('campaigns')
      .select('slug')
      .like('slug', `${prefix}%`);

    if (error) {
      throw new DatabaseOperationError(
        'CAMPAIGN_QUERY_FAILED',
        `Failed to check campaign slugs: ${error.message}`,
        error
      );
    }

    return ((data ?? []) as Array<{ slug: string }>).map((r) => r.slug);
  }

  /**
   * Atomically creates (campaignId === null) or updates a campaign together with its 5 questions
   * and voucher through the `admin_save_campaign` RPC (single database transaction).
   * Throws `DatabaseOperationError` carrying the PostgreSQL SQLSTATE in `details.code`.
   */
  public async saveCampaignAtomic(
    campaignId: string | null,
    payload: Record<string, unknown>
  ): Promise<string> {
    const { data, error } = await this.db.rpc('admin_save_campaign', {
      p_campaign_id: campaignId,
      p_payload: payload,
    });

    if (error || typeof data !== 'string' || data.length === 0) {
      throw new DatabaseOperationError(
        'CAMPAIGN_SAVE_FAILED',
        `Failed to save campaign: ${error?.message || 'RPC returned no campaign id'}`,
        error ?? { code: 'NO_RESULT' }
      );
    }

    return data;
  }

  /**
   * Compare-and-set lifecycle transition: only succeeds if the campaign is still in `from`.
   * Returns null when no row matched (not found or concurrently changed).
   */
  public async transitionCampaignStatus(
    campaignId: string,
    from: CampaignStatus,
    to: CampaignStatus,
    publishedAt: string | null
  ): Promise<CampaignRow | null> {
    const { data, error } = await this.db
      .from('campaigns')
      .update({ status: to, published_at: publishedAt })
      .eq('id', campaignId)
      .eq('status', from)
      .select('*');

    if (error) {
      throw new DatabaseOperationError(
        'CAMPAIGN_STATUS_UPDATE_FAILED',
        `Failed to change campaign status to "${to}": ${error.message}`,
        error
      );
    }

    const rows = (data ?? []) as CampaignRow[];
    return rows[0] ?? null;
  }

  private async hydrateCampaignRelations(
    campaign: CampaignRow
  ): Promise<CompleteCampaignRecord> {
    const [{ data: questions, error: qError }, { data: voucher, error: vError }] =
      await Promise.all([
        this.db
          .from('campaign_questions')
          .select('*')
          .eq('campaign_id', campaign.id)
          .order('question_order', { ascending: true }),
        this.db
          .from('vouchers')
          .select('*')
          .eq('campaign_id', campaign.id)
          .maybeSingle(),
      ]);

    if (qError) {
      throw new DatabaseOperationError(
        'QUESTIONS_QUERY_FAILED',
        `Failed to fetch questions for campaign "${campaign.id}": ${qError.message}`,
        qError
      );
    }

    if (vError) {
      throw new DatabaseOperationError(
        'VOUCHER_QUERY_FAILED',
        `Failed to fetch voucher for campaign "${campaign.id}": ${vError.message}`,
        vError
      );
    }

    return {
      campaign,
      questions: (questions ?? []) as CampaignQuestionRow[],
      voucher: (voucher as VoucherRow | null) ?? null,
    };
  }
}

/**
 * Step 4 Safe LocalStorage Migration Helper (Explicit User-Initiated Opt-In Only).
 * Converts a legacy localStorage Campaign (and optionally Leads only when `includePersonalLeads: true`
 * is explicitly passed by an authenticated Admin action) into relational insert payloads.
 */
export interface LegacyLocalStorageMigrationOptions {
  targetStatus?: CampaignStatus;
  includePersonalLeads?: boolean;
}

export interface LegacyLocalStorageMigrationBundle {
  campaignDetails: CreateCampaignDetailsInput;
  leadsToMigrate: Array<Omit<CreateLeadServerInput, 'campaign_id'>>;
}

export function buildExplicitLocalStorageMigrationBundle(
  legacyCampaign: {
    id: string;
    title: string;
    description: string;
    industry: string;
    questions: Array<{
      id: string;
      question: string;
      options: [string, string, string, string];
      correctIndex: number;
      explanation?: string;
    }>;
    voucher: {
      code: string;
      discount: string;
      description: string;
      expiryDate?: string;
      terms?: string;
    };
    isAiGenerated?: boolean;
    isMock?: boolean;
    mockLabel?: string;
  },
  legacyLeads: Array<{
    id: string;
    fullName: string;
    phoneNumber: string;
    score: number;
    timeTakenSeconds?: number;
    voucherCode: string;
    campaignId: string;
    submittedAt: string;
  }> = [],
  options: LegacyLocalStorageMigrationOptions = {}
): LegacyLocalStorageMigrationBundle {
  const status: CampaignStatus = options.targetStatus ?? 'draft';

  const campaignDetails: CreateCampaignDetailsInput = {
    campaign: {
      slug: slugifyCampaignTitle(legacyCampaign.title),
      legacy_id: legacyCampaign.id,
      title: legacyCampaign.title.trim(),
      description: legacyCampaign.description ?? '',
      industry: legacyCampaign.industry.trim(),
      status,
      is_ai_generated: Boolean(legacyCampaign.isAiGenerated),
      is_mock: Boolean(legacyCampaign.isMock),
      mock_label: legacyCampaign.mockLabel ?? null,
    },
    questions: legacyCampaign.questions.map((q, index) => ({
      question_order: index,
      question_text: q.question.trim(),
      options: q.options,
      correct_index: q.correctIndex,
      explanation: q.explanation ?? null,
    })),
    voucher: {
      code: legacyCampaign.voucher.code.trim(),
      discount: legacyCampaign.voucher.discount.trim(),
      description: legacyCampaign.voucher.description ?? '',
      expiry_date: legacyCampaign.voucher.expiryDate ?? null,
      terms: legacyCampaign.voucher.terms ?? null,
    },
  };

  // Privacy Guard: Never include personal lead data unless explicitly opted-in (`includePersonalLeads === true`)
  const leadsToMigrate =
    options.includePersonalLeads === true
      ? legacyLeads
          .filter(
            (l) =>
              l.campaignId === legacyCampaign.id &&
              isValidVietnamesePhoneServer(l.phoneNumber) &&
              typeof l.fullName === 'string' &&
              l.fullName.trim().length >= 2
          )
          .map((l) => ({
            full_name: l.fullName.trim(),
            phone_number: l.phoneNumber.trim().replace(/\s+/g, ''),
            score: l.score,
            time_taken_seconds:
              typeof l.timeTakenSeconds === 'number' && l.timeTakenSeconds >= 0
                ? l.timeTakenSeconds
                : 0,
            voucher_code: l.voucherCode.trim(),
            submitted_at: l.submittedAt,
          }))
      : [];

  return {
    campaignDetails,
    leadsToMigrate,
  };
}

