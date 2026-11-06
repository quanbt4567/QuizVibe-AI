import { ensureServerEnvLoaded } from './_lib/auth/index.js';
import { CampaignService } from './_lib/campaigns/index.js';

ensureServerEnvLoaded();

function firstString(value: unknown): string {
  if (Array.isArray(value)) return typeof value[0] === 'string' ? value[0] : '';
  return typeof value === 'string' ? value : '';
}

const ROOT_MARKDOWN = `# QuizVibe AI — Gamified Lead Capture Minigames

> Turn social media engagement into verified customer leads with interactive 5-question trivia quizzes and instant voucher rewards.

## What is QuizVibe AI?
QuizVibe AI is an enterprise gamification marketing platform for e-commerce shops, retail brands, and social media fanpages. It enables merchants to build, review, and launch branded 5-question trivia challenges. Players participate in a rapid 30-second reflex quiz, earn points based on accuracy and speed, submit verified contact details to unlock discount vouchers, and compete on a live Top 10 leaderboard.

## Target Audience
- Retail brands & D2C e-commerce stores looking to lower Customer Acquisition Cost (CAC).
- Fanpage administrators and community marketers aiming to boost post engagement.
- Marketing agencies seeking turnkey viral campaigns.

## Core Capabilities
1. **AI & Manual Quiz Generation**:
   - Automated 5-question multiple-choice quiz creation using Google Gemini 3.8 Flash.
   - Editorial AI Review Gate ensuring quality, safety, and brand alignment before publication.
   - Manual builder with customizable questions, options (A, B, C, D), and explanations.
2. **Speed Scoring Engine**:
   - 30-second synchronized timer per question.
   - Server-side authoritative verification preventing cheating.
   - Dynamic points scale (+100 to +400 points per question based on reaction time).
3. **Lead Capture & Voucher Incentives**:
   - Gated reward unlock requiring player full name and 10-digit Vietnamese phone number.
   - Immediate delivery of single-use voucher codes with expiration terms.
   - Lead export for merchant CRM integration.
4. **Public Leaderboard & Viral Sharing**:
   - Deterministic tie-breaking (Score DESC, Time ASC, Submission ASC).
   - Phone number privacy masking (0912***678).
   - Native Facebook SDK Share Dialog with dynamic serverless Open Graph social cards.

## How to Access & Participate
- **Play Active Minigame**: https://quiz-vibe-ai.vercel.app/quiz/active
- **Admin Studio**: https://quiz-vibe-ai.vercel.app/admin/login
- **API Discovery**: https://quiz-vibe-ai.vercel.app/api
- **Health Status**: https://quiz-vibe-ai.vercel.app/api/health
`;

export default async function handler(req: any, res: any) {
  res.setHeader('Content-Type', 'text/markdown; charset=utf-8');
  res.setHeader('Vary', 'Accept');

  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).send('# 405 Method Not Allowed\n\nOnly GET requests are supported.\n');
  }

  const slug = firstString(req.query?.slug).trim().toLowerCase();

  if (slug) {
    try {
      const campaign = await new CampaignService().getPublicBySlug(slug);
      if (!campaign) {
        return res.status(404).send(`# 404 Not Found\n\nChiến dịch minigame "${slug}" không tồn tại hoặc chưa được xuất bản.\n\nQuay về trang chủ: https://quiz-vibe-ai.vercel.app/\n`);
      }

      const md = `# ${campaign.title}

> ${campaign.description || 'Thử thách kiến thức trắc nghiệm 5 câu hỏi nhận voucher độc quyền!'}

- **Ngành hàng**: ${campaign.industry}
- **Số lượng câu hỏi**: ${campaign.questionCount} câu hỏi
- **Thời gian mỗi câu**: 30 giây
- **Phần thưởng voucher**: ${campaign.voucher?.discount || 'Ưu đãi đặc biệt'}
${campaign.voucher?.description ? `- **Phạm vi áp dụng**: ${campaign.voucher.description}\n` : ''}${campaign.voucher?.expiryDate ? `- **Hạn sử dụng**: ${campaign.voucher.expiryDate}\n` : ''}${campaign.voucher?.terms ? `- **Điều khoản**: ${campaign.voucher.terms}\n` : ''}
## Cách tham gia
Truy cập liên kết để bắt đầu lượt chơi:
https://quiz-vibe-ai.vercel.app/quiz/${campaign.slug}
`;
      return res.status(200).send(md);
    } catch {
      return res.status(503).send('# 503 Service Unavailable\n\nKhông thể tải dữ liệu chiến dịch lúc này. Vui lòng thử lại sau.\n');
    }
  }

  return res.status(200).send(ROOT_MARKDOWN);
}

