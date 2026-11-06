import type { CampaignStatus } from '../db/types.js';

export interface CachedQuestionValidation {
  question_order: number;
  question_text: string;
  options: [string, string, string, string];
  correct_index: number;
  explanation?: string | null;
}

export interface CachedCampaignValidation {
  id: string;
  status: CampaignStatus;
  questions: CachedQuestionValidation[];
  cachedAt: number;
}

const DEFAULT_TTL_MS = 60_000; // 60 seconds TTL
const MAX_ENTRIES = 100;

export class CampaignValidationCache {
  private validationCache = new Map<string, CachedCampaignValidation>();
  private questionsCache = new Map<string, { questions: CachedQuestionValidation[]; cachedAt: number }>();
  private readonly ttlMs: number;
  private readonly now: () => number;

  constructor(options?: { ttlMs?: number; now?: () => number }) {
    this.ttlMs = options?.ttlMs ?? DEFAULT_TTL_MS;
    this.now = options?.now ?? (() => Date.now());
  }

  /**
   * Returns active cached validation data (status + questions) if within TTL.
   */
  public getValidation(campaignId: string): CachedCampaignValidation | null {
    if (!campaignId) return null;
    const entry = this.validationCache.get(campaignId);
    if (!entry) return null;
    if (this.now() - entry.cachedAt > this.ttlMs) {
      this.validationCache.delete(campaignId);
      return null;
    }
    return entry;
  }

  /**
   * Sets cached validation data for answer evaluation.
   */
  public setValidation(
    campaignId: string,
    data: Omit<CachedCampaignValidation, 'cachedAt'> & { cachedAt?: number }
  ): void {
    if (!campaignId) return;
    if (this.validationCache.size >= MAX_ENTRIES) {
      const oldestKey = this.validationCache.keys().next().value;
      if (oldestKey) this.validationCache.delete(oldestKey);
    }
    this.validationCache.set(campaignId, {
      id: data.id,
      status: data.status,
      questions: data.questions,
      cachedAt: data.cachedAt ?? this.now(),
    });
  }

  /**
   * Returns cached questions (without status) if within TTL.
   */
  public getQuestions(campaignId: string): CachedQuestionValidation[] | null {
    if (!campaignId) return null;
    const entry = this.questionsCache.get(campaignId);
    if (!entry) return null;
    if (this.now() - entry.cachedAt > this.ttlMs) {
      this.questionsCache.delete(campaignId);
      return null;
    }
    return entry.questions;
  }

  /**
   * Pre-populates questions cache during session creation.
   */
  public setQuestions(campaignId: string, questions: CachedQuestionValidation[]): void {
    if (!campaignId) return;
    if (this.questionsCache.size >= MAX_ENTRIES) {
      const oldestKey = this.questionsCache.keys().next().value;
      if (oldestKey) this.questionsCache.delete(oldestKey);
    }
    this.questionsCache.set(campaignId, {
      questions,
      cachedAt: this.now(),
    });
  }

  /**
   * Invalidates cached entries when an admin transitions or updates a campaign.
   */
  public invalidate(campaignId?: string): void {
    if (campaignId) {
      this.validationCache.delete(campaignId);
      this.questionsCache.delete(campaignId);
    } else {
      this.validationCache.clear();
      this.questionsCache.clear();
    }
  }

  /**
   * Clears all caches (useful for test isolation).
   */
  public clear(): void {
    this.validationCache.clear();
    this.questionsCache.clear();
  }

  public get validationSize(): number {
    return this.validationCache.size;
  }

  public get questionsSize(): number {
    return this.questionsCache.size;
  }
}

const GLOBAL_CACHE_KEY = Symbol.for('quizvibe.campaignValidationCache');

export const campaignValidationCache: CampaignValidationCache =
  (globalThis as any)[GLOBAL_CACHE_KEY] ??
  ((globalThis as any)[GLOBAL_CACHE_KEY] = new CampaignValidationCache());
