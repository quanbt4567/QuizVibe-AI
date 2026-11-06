import type { PublicCampaign, PublicQuestion } from '../types/campaign';

/**
 * Public (anonymous) campaign client.
 *
 * SECURITY: the result is rebuilt from an explicit allow-list of fields. Even if a server
 * regression ever returned answer metadata, it would be dropped here and never reach React state.
 * This module intentionally imports nothing from `services/index` (no storage, no presets).
 */

export type PublicCampaignResult =
  | { status: 'found'; campaign: PublicCampaign }
  | { status: 'not-found' }
  | { status: 'error' };

function str(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function pickPublicCampaign(raw: any): PublicCampaign | null {
  if (!raw || typeof raw !== 'object' || typeof raw.id !== 'string' || typeof raw.slug !== 'string') {
    return null;
  }
  const questions: PublicQuestion[] = Array.isArray(raw.questions)
    ? raw.questions
        .filter((q: any) => q && Array.isArray(q.options) && q.options.length === 4)
        .map((q: any, index: number) => ({
          id: str(q.id),
          order: typeof q.order === 'number' ? q.order : index,
          question: str(q.question),
          options: [str(q.options[0]), str(q.options[1]), str(q.options[2]), str(q.options[3])],
        }))
    : [];

  const v = raw.voucher;
  return {
    id: raw.id,
    slug: raw.slug,
    title: str(raw.title),
    description: str(raw.description),
    industry: str(raw.industry),
    isMock: raw.isMock === true,
    mockLabel: typeof raw.mockLabel === 'string' ? raw.mockLabel : undefined,
    publishedAt: typeof raw.publishedAt === 'string' ? raw.publishedAt : undefined,
    questionCount: questions.length,
    questions,
    voucher:
      v && typeof v === 'object'
        ? {
            discount: str(v.discount),
            description: str(v.description),
            expiryDate: typeof v.expiryDate === 'string' ? v.expiryDate : undefined,
            terms: typeof v.terms === 'string' ? v.terms : undefined,
          }
        : null,
  };
}

export async function fetchPublicCampaign(
  slug: string,
  fetchImpl: typeof fetch = (...args) => fetch(...args)
): Promise<PublicCampaignResult> {
  try {
    const response = await fetchImpl(`/api/public/campaign?slug=${encodeURIComponent(slug)}`, {
      method: 'GET',
      headers: { Accept: 'application/json' },
    });

    if (response.status === 404) return { status: 'not-found' };

    const data = await response.json().catch(() => null);
    if (response.ok && data?.ok === true) {
      const campaign = pickPublicCampaign(data.campaign);
      return campaign ? { status: 'found', campaign } : { status: 'error' };
    }
    return { status: 'error' };
  } catch {
    return { status: 'error' };
  }
}

