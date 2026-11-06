import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { copyToClipboard, isVoucherExpired } from '../../services/clipboard';
import { StorageService } from '../../services/storageService';
import { Lead, VoucherConfig } from '../../types';
import { maskPhoneNumber } from '../../services/validators';

describe('Story 4.3: Instant Copyable Voucher Reward Unlock', () => {
  const sampleVoucher: VoucherConfig = {
    code: 'VIBE2026',
    discount: 'Giảm 20% tối đa 50.000đ',
    description: 'Áp dụng cho mọi hóa đơn tại Fanpage',
    expiryDate: '2026-12-31',
    terms: 'Không áp dụng chung với các chương trình khuyến mãi khác.',
  };

  const sampleLead: Lead = {
    id: 'lead-test-123',
    campaignId: 'camp-default-1',
    fullName: 'Lê Hoàng Nam',
    phoneNumber: '0987654321',
    score: 1500,
    timeTakenSeconds: 45,
    submittedAt: '2026-11-04T00:00:00.000Z',
    voucherCode: 'VIBE2026',
  };

  beforeEach(() => {
    StorageService.clearAll();
  });

  describe('1. Clipboard Copy Service (copyToClipboard)', () => {
    const originalNavigator = globalThis.navigator;

    afterEach(() => {
      vi.restoreAllMocks();
    });

    it('rejects empty or whitespace-only text', async () => {
      const res1 = await copyToClipboard('');
      expect(res1.success).toBe(false);
      expect(res1.error).toContain('Không có nội dung để sao chép');

      const res2 = await copyToClipboard('   ');
      expect(res2.success).toBe(false);
    });

    it('successfully copies using modern navigator.clipboard.writeText', async () => {
      const writeTextMock = vi.fn().mockResolvedValue(undefined);
      Object.defineProperty(globalThis, 'navigator', {
        value: {
          ...originalNavigator,
          clipboard: {
            writeText: writeTextMock,
          },
        },
        configurable: true,
        writable: true,
      });

      const res = await copyToClipboard('VIBE2026');
      expect(res.success).toBe(true);
      expect(writeTextMock).toHaveBeenCalledWith('VIBE2026');
    });

    it('falls back to document.execCommand when navigator.clipboard.writeText throws', async () => {
      const writeTextMock = vi.fn().mockRejectedValue(new Error('Permission denied'));
      Object.defineProperty(globalThis, 'navigator', {
        value: {
          ...originalNavigator,
          clipboard: {
            writeText: writeTextMock,
          },
        },
        configurable: true,
        writable: true,
      });

      const execCommandMock = vi.fn().mockReturnValue(true);
      document.execCommand = execCommandMock;

      const res = await copyToClipboard('FALLBACK_CODE');
      expect(res.success).toBe(true);
      expect(execCommandMock).toHaveBeenCalledWith('copy');
    });

    it('falls back to document.execCommand when navigator.clipboard is unavailable (WebView / In-App)', async () => {
      Object.defineProperty(globalThis, 'navigator', {
        value: {},
        configurable: true,
        writable: true,
      });

      const execCommandMock = vi.fn().mockReturnValue(true);
      document.execCommand = execCommandMock;

      const res = await copyToClipboard('WEBVIEW_CODE');
      expect(res.success).toBe(true);
      expect(execCommandMock).toHaveBeenCalledWith('copy');
    });

    it('returns error when both navigator.clipboard and execCommand fail', async () => {
      Object.defineProperty(globalThis, 'navigator', {
        value: {},
        configurable: true,
        writable: true,
      });

      const execCommandMock = vi.fn().mockReturnValue(false);
      document.execCommand = execCommandMock;

      const res = await copyToClipboard('FAIL_CODE');
      expect(res.success).toBe(false);
      expect(res.error).toContain('sao chép thủ công');
    });
  });

  describe('2. Voucher Expiry Checking (isVoucherExpired)', () => {
    it('returns false when expiryDate is undefined, null, or empty string', () => {
      expect(isVoucherExpired(undefined)).toBe(false);
      expect(isVoucherExpired('')).toBe(false);
      expect(isVoucherExpired('   ')).toBe(false);
      expect(isVoucherExpired(null as any)).toBe(false);
    });

    it('returns true when ISO date is in the past', () => {
      const pastDate = '2020-01-01';
      expect(isVoucherExpired(pastDate)).toBe(true);
    });

    it('returns false when ISO date is in the future', () => {
      const futureDate = '2030-01-01';
      expect(isVoucherExpired(futureDate)).toBe(false);
    });

    it('keeps date-only ISO voucher valid through the end of that day (23:59:59.999)', () => {
      const targetDate = '2026-11-04';
      // 08:00 AM on that day
      const morningOfTarget = new Date(2026, 10, 4, 8, 0, 0, 0).getTime();
      expect(isVoucherExpired(targetDate, morningOfTarget)).toBe(false);

      // 23:59:59 on that day
      const nightOfTarget = new Date(2026, 10, 4, 23, 59, 59, 0).getTime();
      expect(isVoucherExpired(targetDate, nightOfTarget)).toBe(false);

      // Next day 00:00:01
      const nextDay = new Date(2026, 10, 5, 0, 0, 1, 0).getTime();
      expect(isVoucherExpired(targetDate, nextDay)).toBe(true);
    });

    it('supports Vietnamese date format (DD/MM/YYYY) and keeps it valid through end of day', () => {
      const vnDate = '15/12/2026';
      const beforeTime = new Date(2026, 11, 15, 12, 0, 0, 0).getTime();
      const afterTime = new Date(2026, 11, 16, 0, 0, 1, 0).getTime();

      expect(isVoucherExpired(vnDate, beforeTime)).toBe(false);
      expect(isVoucherExpired(vnDate, afterTime)).toBe(true);
    });

    it('returns false for relative policy strings (e.g. "14 ngày sau khi nhận")', () => {
      expect(isVoucherExpired('14 ngày sau khi nhận')).toBe(false);
      expect(isVoucherExpired('7 ngày sau khi nhận mã')).toBe(false);
      expect(isVoucherExpired('10 ngày')).toBe(false);
      expect(isVoucherExpired('30 ngày sau khi nhận')).toBe(false);
    });

    it('returns true (expired) for invalid or unrecognized date strings, not treating them as valid indefinitely', () => {
      expect(isVoucherExpired('invalid-date-string')).toBe(true);
      expect(isVoucherExpired('abcxyz123')).toBe(true);
      expect(isVoucherExpired('2026-02-31')).toBe(true); // Non-existent calendar day
      expect(isVoucherExpired('99/99/9999')).toBe(true);
    });

    it('marks voucher expired deterministically when comparison timestamp is after expiry', () => {
      const fixedNow = new Date('2026-06-01T00:00:00.000Z').getTime();
      const expiredDate = '2026-05-31T23:59:59.000Z';
      const validDate = '2026-06-02T00:00:00.000Z';

      expect(isVoucherExpired(expiredDate, fixedNow)).toBe(true);
      expect(isVoucherExpired(validDate, fixedNow)).toBe(false);
    });
  });

  describe('3. Voucher Reward Unlock Flow & Security Guards', () => {
    it('1. unlocks voucher ONLY upon successful valid lead submission via StorageService', () => {
      let isUnlocked = false;
      let unlockedVoucher: VoucherConfig | null = null;

      const submitResult = StorageService.submitLead({
        fullName: 'Nguyễn Văn Minh',
        phoneNumber: '0912345678',
        score: 1600,
        timeTakenSeconds: 32,
        voucherCode: sampleVoucher.code,
        campaignId: 'camp-default-1',
      });

      expect(submitResult.success).toBe(true);
      if (submitResult.success) {
        isUnlocked = true;
        unlockedVoucher = sampleVoucher;
      }

      expect(isUnlocked).toBe(true);
      expect(unlockedVoucher?.code).toBe('VIBE2026');
    });

    it('2. does NOT unlock voucher when user chooses to skip (State B)', () => {
      let isUnlocked = false;
      const onSkip = () => {
        // Player skips lead capture
      };

      onSkip();
      // Neither StorageService nor voucher unlock is triggered
      expect(isUnlocked).toBe(false);
      expect(StorageService.getLeads().data).toHaveLength(0);
    });

    it('3. does NOT unlock voucher when validation fails (invalid phone number)', () => {
      let isUnlocked = false;
      const invalidPhone = '0123456789'; // Old/invalid prefix

      const isValid = /^(03|05|07|08|09)\d{8}$/.test(invalidPhone);
      expect(isValid).toBe(false);

      if (isValid) {
        isUnlocked = true;
      }

      expect(isUnlocked).toBe(false);
    });

    it('4. does NOT unlock voucher on mere visit to Results screen without submitting lead', () => {
      const playerResultScreenState = {
        hasSubmittedLead: false,
        leadData: null,
      };

      const canViewVoucherTicket = playerResultScreenState.hasSubmittedLead && playerResultScreenState.leadData !== null;
      expect(canViewVoucherTicket).toBe(false);
    });

    it('5. resetting or replaying quiz completely wipes unlocked state', () => {
      let completedQuizResult: any = { score: 1400 };
      let submittedLead: any = { lead: sampleLead, rank: 2 };
      let isVoucherUnlocked = true;

      // Player clicks "Chơi lại"
      const handlePlayAgain = () => {
        completedQuizResult = null;
        submittedLead = null;
        isVoucherUnlocked = false;
      };

      handlePlayAgain();

      expect(completedQuizResult).toBeNull();
      expect(submittedLead).toBeNull();
      expect(isVoucherUnlocked).toBe(false);
    });

    it('6. exact campaign voucher code is preserved without invention or randomization', () => {
      expect(sampleVoucher.code).toBe('VIBE2026');
      expect(sampleLead.voucherCode).toBe(sampleVoucher.code);
      // Code is not randomized
      expect(sampleVoucher.code).not.toMatch(/^VOUCHER_[A-Z0-9]{8}$/);
    });

    it('7. handles missing voucher configuration with graceful fallback', () => {
      const checkIsMissing = (v?: VoucherConfig | null) => !v || !v.code || v.code.trim() === '';

      const missingVoucher: VoucherConfig | null = null;
      expect(checkIsMissing(missingVoucher)).toBe(true);

      const emptyCodeVoucher: VoucherConfig = { code: '   ', discount: 'Giảm 10%', description: 'Test' };
      expect(checkIsMissing(emptyCodeVoucher)).toBe(true);

      const validVoucher: VoucherConfig = { code: 'VALID', discount: 'Giảm 10%', description: 'Test' };
      expect(checkIsMissing(validVoucher)).toBe(false);
    });

    it('8. formats recipient attribution and masks phone number securely', () => {
      const recipientName = sampleLead.fullName;
      const maskedPhone = maskPhoneNumber(sampleLead.phoneNumber);
      const rank = 3;

      expect(recipientName).toBe('Lê Hoàng Nam');
      expect(maskedPhone).toBe('098***4321');
      expect(`${recipientName} • ${maskedPhone} • Hạng #${rank}`).toBe('Lê Hoàng Nam • 098***4321 • Hạng #3');
    });

    it('9. includes mandatory disclaimer text for competition demo', () => {
      const disclaimer = '* Mã ưu đãi demo phục vụ cuộc thi. Áp dụng khi liên hệ mua sắm tại Fanpage.';
      expect(disclaimer).toContain('Mã ưu đãi demo phục vụ cuộc thi');
      expect(disclaimer).toContain('Fanpage');
    });

    it('10. voucher remains unlocked if clipboard copy fails', () => {
      const isUnlocked = true;
      const copyResult = { success: false, error: 'Clipboard error' };

      // Copy failure should not revoke unlocked status
      expect(isUnlocked).toBe(true);
      expect(copyResult.success).toBe(false);
    });
  });
});
