import { copyToClipboard } from './clipboard';

export interface ShareContentParams {
  score: number;
  campaignTitle?: string;
  voucherDiscount?: string | null;
  quizUrl?: string;
}

export interface ShareMessageResult {
  title: string;
  text: string;
  url: string;
}

export type ShareOutcome =
  | { status: 'shared' }
  | { status: 'cancelled' }
  | { status: 'copied'; text: string }
  | { status: 'manual'; text: string; error: string };

/**
 * Resolves the public quiz/campaign URL for sharing.
 * Uses current origin + pathname if available, avoiding localhost/arbitrary hardcoding.
 */
export function getShareUrl(customUrl?: string): string {
  if (customUrl && typeof customUrl === 'string' && customUrl.trim() !== '') {
    return customUrl.trim();
  }
  if (typeof window !== 'undefined' && window.location) {
    const origin = window.location.origin && window.location.origin !== 'null' ? window.location.origin : '';
    const pathname = window.location.pathname || '';
    if (origin) {
      return `${origin}${pathname}`;
    }
  }
  return 'https://quizvibe.ai';
}

/**
 * Generates the dynamic sharing message formatted for Facebook social sharing.
 * Story 4.5 Acceptance Criteria:
 * "🔥 Tôi vừa đạt {SCORE}/2,000 điểm tại Thử thách Quiz của {SHOP_NAME} và nhận ngay Voucher {DISCOUNT}! Liệu bạn có phá được kỷ lục của tôi? Thử sức tại: {QUIZ_URL}"
 */
export function generateShareMessage({
  score,
  campaignTitle,
  voucherDiscount,
  quizUrl,
}: ShareContentParams): ShareMessageResult {
  const shopName = (campaignTitle && campaignTitle.trim()) || 'Shop';
  const url = getShareUrl(quizUrl);
  const formattedScore = typeof score === 'number' && !isNaN(score) ? score.toLocaleString('vi-VN') : '0';

  let text: string;
  if (voucherDiscount && typeof voucherDiscount === 'string' && voucherDiscount.trim() !== '') {
    text = `🔥 Tôi vừa đạt ${formattedScore}/2,000 điểm tại Thử thách Quiz của ${shopName} và nhận ngay Voucher ${voucherDiscount.trim()}! Liệu bạn có phá được kỷ lục của tôi? Thử sức tại: ${url}`;
  } else {
    text = `🎯 Tôi vừa đạt ${formattedScore}/2,000 điểm tại Thử thách Quiz của ${shopName}! Liệu bạn có phá được kỷ lục của tôi? Thử sức tại: ${url}`;
  }

  return {
    title: `Thử thách Quiz của ${shopName}`,
    text,
    url,
  };
}

/**
 * Progressive Facebook Social Sharing helper:
 * 1. Primary: navigator.share()
 * 2. Fallback: navigator.clipboard / legacy execCommand via copyToClipboard()
 * 3. Fallback: manual copy interface
 */
export async function shareQuizResult(params: ShareContentParams): Promise<ShareOutcome> {
  const { title, text, url } = generateShareMessage(params);

  // 1. Primary: Try Web Share API (Mobile / supported desktop browsers)
  if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
    try {
      await navigator.share({
        title,
        text,
        url,
      });
      return { status: 'shared' };
    } catch (err: unknown) {
      // User dismissed the native share sheet
      if (err instanceof Error && err.name === 'AbortError') {
        return { status: 'cancelled' };
      }
      // Genuine share error -> fall through to clipboard fallback
    }
  }

  // 2. Fallback: Clipboard API
  const clipResult = await copyToClipboard(text);
  if (clipResult.success) {
    return { status: 'copied', text };
  }

  // 3. Fallback: Manual copy
  return {
    status: 'manual',
    text,
    error: clipResult.error || 'Không thể tự động sao chép nội dung chia sẻ.',
  };
}

