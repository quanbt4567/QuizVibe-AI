import crypto from 'node:crypto';
import { assertServerRuntime } from '../db/config.js';
import {
  DatabaseOperationError,
  QuizVibeDatabaseRepository,
  slugifyCampaignTitle,
} from '../db/repository.js';
import type { CampaignStatus } from '../db/types.js';
import {
  AdminCampaignDto,
  AdminCampaignSummaryDto,
  PublicCampaignDto,
  toAdminCampaignDto,
  toAdminCampaignSummaryDto,
  toPublicCampaignDto,
} from './campaignDto.js';
import {
  buildSavePayload,
  isValidCampaignId,
  isValidPublicSlug,
  validateCampaignWriteInput,
} from './campaignValidation.js';

assertServerRuntime();

export type CampaignServiceErrorCode =
  | 'VALIDATION_FAILED'
  | 'NOT_FOUND'
  | 'INVALID_STATE_TRANSITION'
  | 'CAMPAIGN_ARCHIVED'
  | 'NOT_PUBLISHABLE'
  | 'DATABASE_ERROR';

const STATUS_BY_CODE: Record<CampaignServiceErrorCode, number> = {
  VALIDATION_FAILED: 400,
  NOT_FOUND: 404,
  INVALID_STATE_TRANSITION: 409,
  CAMPAIGN_ARCHIVED: 409,
  NOT_PUBLISHABLE: 422,
  DATABASE_ERROR: 503,
};

export class CampaignServiceError extends Error {
  public readonly code: CampaignServiceErrorCode;
  public readonly status: number;
  public readonly fieldErrors?: Record<string, string>;

  constructor(
    code: CampaignServiceErrorCode,
    message: string,
    fieldErrors?: Record<string, string>
  ) {
    super(message);
    this.name = 'CampaignServiceError';
    this.code = code;
    this.status = STATUS_BY_CODE[code];
    this.fieldErrors = fieldErrors;
  }
}

export type CampaignTransitionAction = 'publish' | 'unpublish' | 'archive' | 'restore';

export const CAMPAIGN_TRANSITION_ACTIONS: readonly CampaignTransitionAction[] = [
  'publish',
  'unpublish',
  'archive',
  'restore',
];

const TRANSITIONS: Record<
  CampaignTransitionAction,
  { from: CampaignStatus[]; to: CampaignStatus }
> = {
  publish: { from: ['draft'], to: 'published' },
  unpublish: { from: ['published'], to: 'draft' },
  archive: { from: ['draft', 'published'], to: 'archived' },
  restore: { from: ['archived'], to: 'draft' },
};

/** Slugs that collide with route aliases or reserved words. */
const RESERVED_SLUGS = new Set(['active', 'default', 'new', 'admin', 'api', 'login']);
const MAX_SLUG_BASE_LENGTH = 80;
const MAX_SLUG_RETRIES = 3;

function sqlState(err: unknown): string | undefined {
  if (err instanceof DatabaseOperationError) {
    const details = err.details as { code?: unknown } | undefined;
    return typeof details?.code === 'string' ? details.code : undefined;
  }
  return undefined;
}

/** Converts repository failures into service errors without leaking database internals. */
function toServiceError(err: unknown): CampaignServiceError {
  if (err instanceof CampaignServiceError) return err;
  const state = sqlState(err);
  if (state === 'P0002') {
    return new CampaignServiceError('NOT_FOUND', 'Không tìm thấy chiến dịch (hoặc chiến dịch đã được lưu trữ).');
  }
  if (state === '22023' || state === '23514' || state === '22P02') {
    return new CampaignServiceError('VALIDATION_FAILED', 'Dữ liệu chiến dịch bị cơ sở dữ liệu từ chối.');
  }
  return new CampaignServiceError(
    'DATABASE_ERROR',
    'Không thể truy cập cơ sở dữ liệu lúc này. Thao tác chưa được lưu.'
  );
}

function randomSuffix(): string {
  return crypto.randomBytes(3).toString('hex').slice(0, 4);
}

function slugBase(title: string): string {
  let base = slugifyCampaignTitle(title).slice(0, MAX_SLUG_BASE_LENGTH).replace(/-+$/g, '');
  if (base.length < 3) base = 'campaign-quiz';
  if (RESERVED_SLUGS.has(base)) base = `${base}-quiz`;
  return base;
}

export class CampaignService {
  private readonly repo: QuizVibeDatabaseRepository;
  private readonly now: () => Date;

  constructor(options?: { repository?: QuizVibeDatabaseRepository; now?: () => Date }) {
    assertServerRuntime();
    this.repo = options?.repository ?? new QuizVibeDatabaseRepository();
    this.now = options?.now ?? (() => new Date());
  }

  // -------------------------------------------------------------------------
  // Admin reads
  // -------------------------------------------------------------------------

  public async list(status?: CampaignStatus): Promise<AdminCampaignSummaryDto[]> {
    try {
      const rows = await this.repo.listCampaignSummaries(status);
      return rows.map(({ campaign, voucher }) => toAdminCampaignSummaryDto(campaign, voucher));
    } catch (err) {
      throw toServiceError(err);
    }
  }

  public async get(id: string): Promise<AdminCampaignDto> {
    if (!isValidCampaignId(id)) {
      throw new CampaignServiceError('NOT_FOUND', 'Không tìm thấy chiến dịch.');
    }
    try {
      const record = await this.repo.getCampaignById(id);
      if (!record) throw new CampaignServiceError('NOT_FOUND', 'Không tìm thấy chiến dịch.');
      return toAdminCampaignDto(record);
    } catch (err) {
      throw toServiceError(err);
    }
  }

  // -------------------------------------------------------------------------
  // Admin writes
  // -------------------------------------------------------------------------

  /**
   * Creates a campaign as DRAFT. Any client-provided `status`, `slug`, or `published_at` is ignored.
   * The campaign, its 5 questions and voucher are written in one database transaction (RPC),
   * then re-read to confirm persistence before success is reported.
   */
  public async create(body: unknown): Promise<AdminCampaignDto> {
    const validation = validateCampaignWriteInput(body);
    if (!validation.valid) {
      throw new CampaignServiceError(
        'VALIDATION_FAILED',
        'Dữ liệu chiến dịch không hợp lệ.',
        validation.fieldErrors
      );
    }

    try {
      const base = slugBase(validation.data.title);
      let savedId: string | null = null;
      let lastError: unknown;

      for (let attempt = 0; attempt <= MAX_SLUG_RETRIES && !savedId; attempt++) {
        const slug =
          attempt === 0 ? await this.allocateSlug(base) : `${base}-${randomSuffix()}`;
        try {
          savedId = await this.repo.saveCampaignAtomic(
            null,
            buildSavePayload(validation.data, slug)
          );
        } catch (err) {
          lastError = err;
          if (sqlState(err) !== '23505') throw err; // only slug collisions are retried
        }
      }

      if (!savedId) throw lastError ?? new Error('SLUG_ALLOCATION_FAILED');
      return await this.readBackAfterWrite(savedId);
    } catch (err) {
      throw toServiceError(err);
    }
  }

  /**
   * Updates campaign content (details, 5 questions, voucher). Slug and status are never changed here.
   */
  public async update(id: string, body: unknown): Promise<AdminCampaignDto> {
    if (!isValidCampaignId(id)) {
      throw new CampaignServiceError('NOT_FOUND', 'Không tìm thấy chiến dịch.');
    }
    const validation = validateCampaignWriteInput(body);
    if (!validation.valid) {
      throw new CampaignServiceError(
        'VALIDATION_FAILED',
        'Dữ liệu chiến dịch không hợp lệ.',
        validation.fieldErrors
      );
    }

    try {
      const existing = await this.repo.getCampaignById(id);
      if (!existing) throw new CampaignServiceError('NOT_FOUND', 'Không tìm thấy chiến dịch.');
      if (existing.campaign.status === 'archived') {
        throw new CampaignServiceError(
          'CAMPAIGN_ARCHIVED',
          'Chiến dịch đã lưu trữ. Hãy khôi phục trước khi chỉnh sửa.'
        );
      }
      await this.repo.saveCampaignAtomic(id, buildSavePayload(validation.data, null));
      return await this.readBackAfterWrite(id);
    } catch (err) {
      throw toServiceError(err);
    }
  }

  /**
   * Lifecycle transition validated on the server (draft ⇄ published, → archived, archived → draft).
   * Same-state requests are idempotent no-ops. Uses compare-and-set to avoid races.
   */
  public async transition(
    id: string,
    action: CampaignTransitionAction
  ): Promise<AdminCampaignDto> {
    if (!isValidCampaignId(id)) {
      throw new CampaignServiceError('NOT_FOUND', 'Không tìm thấy chiến dịch.');
    }
    const rule = TRANSITIONS[action];
    if (!rule) {
      throw new CampaignServiceError('VALIDATION_FAILED', 'Hành động không hợp lệ.');
    }

    try {
      const record = await this.repo.getCampaignById(id);
      if (!record) throw new CampaignServiceError('NOT_FOUND', 'Không tìm thấy chiến dịch.');

      const current = record.campaign.status;
      if (current === rule.to) return toAdminCampaignDto(record);

      if (!rule.from.includes(current)) {
        throw new CampaignServiceError(
          'INVALID_STATE_TRANSITION',
          `Không thể "${action}" chiến dịch đang ở trạng thái "${current}".`
        );
      }

      if (action === 'publish') {
        const check = validateCampaignWriteInput(toAdminCampaignDto(record));
        if (!check.valid) {
          throw new CampaignServiceError(
            'NOT_PUBLISHABLE',
            'Chiến dịch chưa đủ điều kiện xuất bản (cần 5 câu hỏi hợp lệ và cấu hình voucher).',
            check.fieldErrors
          );
        }
      }

      const publishedAt =
        action === 'publish'
          ? this.now().toISOString()
          : action === 'unpublish'
          ? null
          : record.campaign.published_at;

      const updated = await this.repo.transitionCampaignStatus(id, current, rule.to, publishedAt);
      if (!updated) {
        throw new CampaignServiceError(
          'INVALID_STATE_TRANSITION',
          'Trạng thái chiến dịch vừa được thay đổi bởi thao tác khác. Hãy tải lại và thử lại.'
        );
      }
      return await this.readBackAfterWrite(id);
    } catch (err) {
      throw toServiceError(err);
    }
  }

  // -------------------------------------------------------------------------
  // Public reads
  // -------------------------------------------------------------------------

  /**
   * Returns the sanitized public DTO for a PUBLISHED campaign, or null (unknown, draft, archived).
   * `active` resolves to the most recently published campaign (root alias).
   */
  public async getPublicBySlug(slug: string): Promise<PublicCampaignDto | null> {
    const clean = typeof slug === 'string' ? slug.trim().toLowerCase() : '';
    if (clean !== 'active' && !isValidPublicSlug(clean)) return null;

    try {
      const record =
        clean === 'active'
          ? await this.repo.getLatestPublishedCampaign()
          : await this.repo.getPublishedCampaignBySlug(clean);
      return record ? toPublicCampaignDto(record) : null;
    } catch (err) {
      throw toServiceError(err);
    }
  }

  // -------------------------------------------------------------------------
  // Internals
  // -------------------------------------------------------------------------

  private async allocateSlug(base: string): Promise<string> {
    const taken = new Set(await this.repo.findSlugsWithPrefix(base));
    if (!taken.has(base)) return base;
    for (let n = 2; n <= 99; n++) {
      const candidate = `${base}-${n}`;
      if (!taken.has(candidate)) return candidate;
    }
    return `${base}-${randomSuffix()}`;
  }

  /** Never report success unless the written campaign can be read back. */
  private async readBackAfterWrite(id: string): Promise<AdminCampaignDto> {
    const record = await this.repo.getCampaignById(id);
    if (!record) {
      throw new DatabaseOperationError('PERSISTENCE_NOT_CONFIRMED', 'Write could not be confirmed.');
    }
    return toAdminCampaignDto(record);
  }
}

