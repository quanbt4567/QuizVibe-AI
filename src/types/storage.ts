export type StorageErrorCode =
  | 'QUOTA_EXCEEDED'
  | 'STORAGE_UNAVAILABLE'
  | 'VALIDATION_FAILED'
  | 'PARSE_ERROR'
  | 'NOT_FOUND'
  | 'INVALID_LEAD'
  | 'STORAGE_FAILURE'
  | 'LEADERBOARD_SYNC_FAILED'
  | 'UNKNOWN';

export interface StorageResult<T> {
  success: boolean;
  data?: T;
  error?: StorageErrorCode;
  message?: string;
  isMemoryFallback?: boolean;
}

export const STORAGE_KEYS = {
  SCHEMA_VERSION: 'quizvibe_schema_version',
  ACTIVE_CAMPAIGN: 'quizvibe_active_campaign',
  LEADS: 'quizvibe_leads',
  LEADERBOARD: 'quizvibe_leaderboard',
} as const;

export type StorageKey = typeof STORAGE_KEYS[keyof typeof STORAGE_KEYS];

export const CURRENT_SCHEMA_VERSION = 1;

