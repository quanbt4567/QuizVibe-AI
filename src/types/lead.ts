export interface Lead {
  id: string;
  fullName: string;
  phoneNumber: string; // 10-digit Vietnamese format matching /^(03|05|07|08|09)\d{8}$/
  score: number;       // 0 to 2000
  voucherCode: string;
  campaignId: string;
  submittedAt: string; // ISO 8601 UTC
  timeTakenSeconds?: number;
}

export interface LeaderboardEntry {
  id: string;
  leadId: string;
  fullName: string;
  phoneNumber: string;
  maskedPhone: string; // e.g. "098***5678"
  score: number;
  timeTakenSeconds: number;
  rank: number;
  submittedAt: string; // ISO 8601 UTC
}

export interface LeadSubmissionPayload {
  fullName: string;
  phoneNumber: string;
  score: number;
  timeTakenSeconds: number;
  voucherCode: string;
  campaignId: string;
}

