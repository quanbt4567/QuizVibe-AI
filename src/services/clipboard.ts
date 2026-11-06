/**
 * Cross-platform clipboard helper supporting both the modern Clipboard API
 * and a legacy document.execCommand fallback for WebView / In-App Browsers.
 */
export async function copyToClipboard(text: string): Promise<{ success: boolean; error?: string }> {
  if (typeof text !== 'string' || text.trim() === '') {
    return { success: false, error: 'Không có nội dung để sao chép.' };
  }

  // 1. Try modern navigator.clipboard
  if (typeof navigator !== 'undefined' && navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
    try {
      await navigator.clipboard.writeText(text);
      return { success: true };
    } catch {
      // Fall through to legacy execCommand fallback
    }
  }

  // 2. Legacy fallback for WebViews (e.g. Facebook In-App Browser)
  if (typeof document !== 'undefined') {
    let textarea: HTMLTextAreaElement | null = null;
    try {
      textarea = document.createElement('textarea');
      textarea.value = text;
      // Fixed positioning to prevent viewport scrolling on iOS/Android
      textarea.style.position = 'fixed';
      textarea.style.top = '0';
      textarea.style.left = '0';
      textarea.style.width = '2em';
      textarea.style.height = '2em';
      textarea.style.padding = '0';
      textarea.style.border = 'none';
      textarea.style.outline = 'none';
      textarea.style.boxShadow = 'none';
      textarea.style.background = 'transparent';
      textarea.setAttribute('readonly', '');
      document.body.appendChild(textarea);
      textarea.select();
      textarea.setSelectionRange(0, textarea.value.length);
      const successful = document.execCommand('copy');

      if (successful) {
        return { success: true };
      }
    } catch {
      // Fall through to error return
    } finally {
      if (textarea && textarea.parentNode) {
        textarea.parentNode.removeChild(textarea);
      }
    }
  }

  return {
    success: false,
    error: 'Không thể tự động sao chép mã. Bạn vui lòng chọn và sao chép thủ công.',
  };
}

/**
 * Checks whether an expiration date string represents a date that has passed.
 *
 * Supported formats:
 * - Date-only ISO (YYYY-MM-DD) or Vietnamese (DD/MM/YYYY): Valid through 23:59:59.999 of that day.
 * - Full ISO timestamps (YYYY-MM-DDTHH:mm:ss.sssZ or with timezone offset): Compared deterministically.
 * - Relative expiry policy strings (e.g. "14 ngày sau khi nhận", "7 ngày"): Recognized as relative policies
 *   that are valid upon receipt (data model limitation: no issuance timestamp exists to compute dynamic elapsed time).
 * - Invalid or unrecognized date strings: Treated as expired (true) rather than silently valid indefinitely.
 */
export function isVoucherExpired(expiryDate?: string, currentTimestamp = Date.now()): boolean {
  if (!expiryDate || typeof expiryDate !== 'string') return false;
  const trimmed = expiryDate.trim();
  if (trimmed === '') return false;

  // 1. Check for recognized relative policy strings (e.g., "7 ngày sau khi nhận", "14 ngày", "24 giờ")
  const isRelativePolicy =
    /^\s*\d+\s*(ngày|ngay|giờ|gio|tháng|thang|tuần|tuan|days?|hours?|months?|weeks?)/i.test(trimmed) ||
    /sau khi nhận|sau khi nhan/i.test(trimmed);

  if (isRelativePolicy) {
    // Relative policies are valid upon issuance/receipt.
    // NOTE: The current data model does not store an issuance timestamp on the voucher,
    // so dynamic relative expiration (e.g. now > issuedAt + 7 days) cannot be calculated at the voucher level.
    return false;
  }

  // 2. Check for date-only ISO string (YYYY-MM-DD)
  const isoDateOnlyMatch = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (isoDateOnlyMatch) {
    const year = Number(isoDateOnlyMatch[1]);
    const month = Number(isoDateOnlyMatch[2]);
    const day = Number(isoDateOnlyMatch[3]);

    const dateObj = new Date(year, month - 1, day, 23, 59, 59, 999);
    // Validate calendar existence (e.g. reject 2026-02-31)
    if (
      isNaN(dateObj.getTime()) ||
      dateObj.getFullYear() !== year ||
      dateObj.getMonth() !== month - 1 ||
      dateObj.getDate() !== day
    ) {
      return true; // Invalid calendar date treated as expired
    }
    return dateObj.getTime() < currentTimestamp;
  }

  // 3. Check for Vietnamese date format (DD/MM/YYYY)
  const vnDateOnlyMatch = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (vnDateOnlyMatch) {
    const day = Number(vnDateOnlyMatch[1]);
    const month = Number(vnDateOnlyMatch[2]);
    const year = Number(vnDateOnlyMatch[3]);

    const dateObj = new Date(year, month - 1, day, 23, 59, 59, 999);
    if (
      isNaN(dateObj.getTime()) ||
      dateObj.getFullYear() !== year ||
      dateObj.getMonth() !== month - 1 ||
      dateObj.getDate() !== day
    ) {
      return true; // Invalid calendar date treated as expired
    }
    return dateObj.getTime() < currentTimestamp;
  }

  // 4. Check for standard parseable date or full ISO timestamp (e.g., "2026-12-31T23:59:59Z")
  const parsed = Date.parse(trimmed);
  if (!isNaN(parsed)) {
    return parsed < currentTimestamp;
  }

  // 5. Unrecognized or invalid date string: treated as expired/invalid, not silently valid indefinitely
  return true;
}

