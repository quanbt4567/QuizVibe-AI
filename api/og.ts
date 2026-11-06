import { ensureServerEnvLoaded } from './_lib/auth/index.js';
import { CampaignService } from './_lib/campaigns/index.js';

ensureServerEnvLoaded();

function firstString(value: unknown): string {
  if (Array.isArray(value)) return typeof value[0] === 'string' ? value[0] : '';
  return typeof value === 'string' ? value : '';
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function escapeJs(str: string): string {
  return str.replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/"/g, '\\"');
}

/**
 * Serverless function to serve server-rendered HTML with full Open Graph metadata
 * for social crawlers (Facebook, Twitter, LinkedIn, WhatsApp, etc.).
 */
export default async function handler(req: any, res: any) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).send('Method Not Allowed');
  }

  const rawSlug = firstString(req.query?.slug).trim().toLowerCase();
  const origin = 'https://quiz-vibe-ai.vercel.app';

  let title = 'QuizVibe AI — Minigame Quiz Thu Lead Fanpage & Tăng Chuyển Đổi';
  let description = 'Tham gia thử thách trả lời câu hỏi trúng voucher hấp dẫn cùng QuizVibe AI!';
  let targetUrl = origin;
  let imageUrl = `${origin}/og-image.png`;

  if (rawSlug) {
    try {
      const campaign = await new CampaignService().getPublicBySlug(rawSlug);
      if (campaign) {
        title = campaign.title ? `${campaign.title} | QuizVibe AI` : title;
        description =
          campaign.description ||
          `Tham gia thử thách kiến thức cùng ${campaign.title || 'shop'} để nhận ngay voucher giảm giá!`;
        targetUrl = `${origin}/quiz/${encodeURIComponent(rawSlug)}`;
      }
    } catch (err) {
      console.warn('[api/og] Failed to load campaign for crawler:', err);
    }
  }

  // Fast CDN caching for crawlers
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 'public, max-age=60, s-maxage=300');

  const html = `<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeHtml(title)}</title>
  <meta name="description" content="${escapeHtml(description)}" />
  
  <!-- Open Graph / Facebook -->
  <meta property="og:type" content="website" />
  <meta property="og:url" content="${escapeHtml(targetUrl)}" />
  <meta property="og:title" content="${escapeHtml(title)}" />
  <meta property="og:description" content="${escapeHtml(description)}" />
  <meta property="og:image" content="${escapeHtml(imageUrl)}" />
  <meta property="og:image:width" content="1200" />
  <meta property="og:image:height" content="630" />
  <meta property="og:image:alt" content="${escapeHtml(title)}" />
  <meta property="og:site_name" content="QuizVibe AI" />
  <meta property="og:locale" content="vi_VN" />

  <!-- Twitter -->
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:url" content="${escapeHtml(targetUrl)}" />
  <meta name="twitter:title" content="${escapeHtml(title)}" />
  <meta name="twitter:description" content="${escapeHtml(description)}" />
  <meta name="twitter:image" content="${escapeHtml(imageUrl)}" />

  <!-- Instant refresh for human visitors if crawler rewrite matched accidentally -->
  <meta http-equiv="refresh" content="0;url=${escapeHtml(targetUrl)}" />
</head>
<body style="font-family: system-ui, sans-serif; background: #0b0f19; color: #f3f4f6; padding: 2rem; text-align: center;">
  <h2>${escapeHtml(title)}</h2>
  <p>${escapeHtml(description)}</p>
  <p style="margin-top: 1.5rem;">
    <a href="${escapeHtml(targetUrl)}" style="color: #6366f1; text-decoration: underline;">Nhấn vào đây nếu không tự động chuyển hướng...</a>
  </p>
  <script>window.location.replace('${escapeJs(targetUrl)}');</script>
</body>
</html>`;

  return res.status(200).send(html);
}
