import { ensureServerEnvLoaded } from '../_lib/auth';
import { CampaignService, CampaignServiceError } from '../_lib/campaigns';

ensureServerEnvLoaded();

function firstString(value: unknown): string {
  if (Array.isArray(value)) return typeof value[0] === 'string' ? value[0] : '';
  return typeof value === 'string' ? value : '';
}

/**
 * Vercel Serverless Function: GET /api/public/campaign?slug=<slug>
 * Public (no authentication) lookup of a PUBLISHED campaign.
 *
 * SECURITY CONTRACT
 *  - Only `status = 'published'` campaigns are returned.
 *  - Unknown, draft and archived slugs are indistinguishable (identical 404) — no enumeration.
 *  - The body is the explicit allow-list `PublicCampaignDto`: it NEVER contains `correctIndex`,
 *    `correct_index`, explanations, the voucher code, or any answer-verification metadata.
 *  - `Cache-Control: no-store` so an unpublish takes effect immediately for new players.
 */
export default async function handler(req: any, res: any) {
  res.setHeader('Cache-Control', 'no-store');

  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ ok: false, code: 'METHOD_NOT_ALLOWED', error: 'Chỉ hỗ trợ GET.' });
  }

  const slug = firstString(req.query?.slug).trim().toLowerCase();

  try {
    const campaign = await new CampaignService().getPublicBySlug(slug);
    if (!campaign) {
      return res.status(404).json({
        ok: false,
        code: 'NOT_FOUND',
        error: 'Chiến dịch không tồn tại hoặc chưa được xuất bản.',
      });
    }
    return res.status(200).json({ ok: true, campaign });
  } catch (err) {
    const status = err instanceof CampaignServiceError ? err.status : 503;
    return res.status(status >= 500 ? 503 : status).json({
      ok: false,
      code: 'SERVICE_UNAVAILABLE',
      error: 'Không thể tải chiến dịch lúc này. Vui lòng thử lại sau.',
    });
  }
}

