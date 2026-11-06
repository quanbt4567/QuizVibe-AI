import type { Campaign } from '../../types';

/**
 * Result of persisting a campaign to the database-backed Admin API.
 * `success` is true ONLY when the server confirmed the write.
 */
export interface PersistCampaignResult {
  success: boolean;
  campaign?: Campaign;
  message?: string;
  fieldErrors?: Record<string, string>;
}

export type PersistCampaign = (campaign: Campaign) => Promise<PersistCampaignResult>;
