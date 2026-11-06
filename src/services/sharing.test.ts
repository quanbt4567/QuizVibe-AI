import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  generateShareMessage,
  getShareUrl,
  shareQuizResult,
  ShareContentParams,
} from './sharing';
import * as clipboardModule from './clipboard';
import { StorageService } from './storageService';

describe('Story 4.5: Facebook Social Sharing', () => {
  const originalNavigator = globalThis.navigator;

  beforeEach(() => {
    StorageService.clearAll();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    Object.defineProperty(globalThis, 'navigator', {
      value: originalNavigator,
      configurable: true,
      writable: true,
    });
  });

  describe('1. Dynamic Share Content Generation (generateShareMessage)', () => {
    it('generates message with voucher discount when voucher is unlocked', () => {
      const params: ShareContentParams = {
        score: 1600,
        campaignTitle: 'Mỹ phẩm Thiên Nhiên Glow',
        voucherDiscount: 'Giảm 20% đơn từ 200k',
        quizUrl: 'https://quizvibe.ai/campaign/glow',
      };

      const result = generateShareMessage(params);

      expect(result.title).toContain('Mỹ phẩm Thiên Nhiên Glow');
      expect(result.url).toBe('https://quizvibe.ai/campaign/glow');
      expect(result.text).toContain('1.600/2,000 điểm');
      expect(result.text).toContain('Mỹ phẩm Thiên Nhiên Glow');
      expect(result.text).toContain('Giảm 20% đơn từ 200k');
      expect(result.text).toContain('https://quizvibe.ai/campaign/glow');
      expect(result.text).toContain('Liệu bạn có phá được kỷ lục của tôi?');
    });

    it('generates message without voucher when player skips lead capture or voucher is unavailable', () => {
      const params: ShareContentParams = {
        score: 1200,
        campaignTitle: 'Thời Trang Urban Vibe',
        voucherDiscount: undefined,
        quizUrl: 'https://quizvibe.ai/campaign/urban',
      };

      const result = generateShareMessage(params);

      expect(result.title).toContain('Thời Trang Urban Vibe');
      expect(result.text).toContain('1.200/2,000 điểm');
      expect(result.text).toContain('Thời Trang Urban Vibe');
      expect(result.text).not.toContain('Voucher');
      expect(result.text).toContain('https://quizvibe.ai/campaign/urban');
    });

    it('handles empty or missing campaign title gracefully with default fallback', () => {
      const params: ShareContentParams = {
        score: 800,
        campaignTitle: '',
      };

      const result = generateShareMessage(params);
      expect(result.title).toBe('Thử thách Quiz của Shop');
      expect(result.text).toContain('Thử thách Quiz của Shop');
      expect(result.text).toContain('800/2,000 điểm');
    });

    it('never leaks player phone number or private lead info in generated message', () => {
      const params: ShareContentParams = {
        score: 1800,
        campaignTitle: 'Tech Hub',
        voucherDiscount: 'Giảm 50k',
      };

      const result = generateShareMessage(params);
      expect(result.text).not.toMatch(/0[35789]\d{8}/);
      expect(result.text).not.toContain('phoneNumber');
      expect(result.text).not.toContain('leadId');
      expect(result.text).not.toContain('code:');
    });

    it('formats 0 score correctly as 0/2,000 without NaN or errors', () => {
      const result = generateShareMessage({
        score: 0,
        campaignTitle: 'Zero Test',
      });
      expect(result.text).toContain('0/2,000 điểm');
    });

    it('formats NaN or negative score safely as 0/2,000', () => {
      const result = generateShareMessage({
        score: NaN,
        campaignTitle: 'NaN Test',
      });
      expect(result.text).toContain('0/2,000 điểm');
    });
  });

  describe('2. Share URL Resolution (getShareUrl)', () => {
    it('uses custom provided quiz URL if present', () => {
      expect(getShareUrl('https://custom-shop.com/quiz')).toBe('https://custom-shop.com/quiz');
    });

    it('falls back to window.location origin and pathname when available, excluding search and hash', () => {
      const originalWindow = globalThis.window;
      // @ts-ignore
      delete globalThis.window;
      // @ts-ignore
      globalThis.window = {
        location: {
          origin: 'https://quizvibe.app',
          pathname: '/play',
          search: '?utm_source=fb&leadId=123',
          hash: '#step2',
        } as unknown as Location,
      } as unknown as Window & typeof globalThis;

      // Notice pathname naturally excludes search and hash
      expect(getShareUrl()).toBe('https://quizvibe.app/play');

      globalThis.window = originalWindow;
    });

    it('falls back to default https://quizvibe.ai when origin is missing or null', () => {
      const originalWindow = globalThis.window;
      // @ts-ignore
      delete globalThis.window;
      // @ts-ignore
      globalThis.window = {
        location: {
          origin: 'null',
          pathname: '',
        } as unknown as Location,
      } as unknown as Window & typeof globalThis;

      expect(getShareUrl()).toBe('https://quizvibe.ai');

      globalThis.window = originalWindow;
    });
  });

  describe('3. Web Share API Execution & Error Handling', () => {
    it('calls navigator.share when available and returns status "shared"', async () => {
      const shareMock = vi.fn().mockResolvedValue(undefined);
      Object.defineProperty(globalThis, 'navigator', {
        value: {
          ...originalNavigator,
          share: shareMock,
        },
        configurable: true,
        writable: true,
      });

      const outcome = await shareQuizResult({
        score: 1500,
        campaignTitle: 'Test Campaign',
      });

      expect(outcome.status).toBe('shared');
      expect(shareMock).toHaveBeenCalledTimes(1);
      expect(shareMock).toHaveBeenCalledWith(
        expect.objectContaining({
          title: expect.stringContaining('Test Campaign'),
          text: expect.stringContaining('1.500/2,000 điểm'),
        })
      );
    });

    it('returns status "cancelled" without triggering error when user dismisses native sheet (AbortError)', async () => {
      const abortError = new Error('Share canceled');
      abortError.name = 'AbortError';

      const shareMock = vi.fn().mockRejectedValue(abortError);
      const copySpy = vi.spyOn(clipboardModule, 'copyToClipboard');

      Object.defineProperty(globalThis, 'navigator', {
        value: {
          ...originalNavigator,
          share: shareMock,
        },
        configurable: true,
        writable: true,
      });

      const outcome = await shareQuizResult({
        score: 1500,
        campaignTitle: 'Test Campaign',
      });

      expect(outcome.status).toBe('cancelled');
      // AbortError MUST NOT trigger clipboard fallback or show error
      expect(copySpy).not.toHaveBeenCalled();
    });

    it('falls back to clipboard copy when navigator.share throws NotAllowedError', async () => {
      const shareError = new Error('Permission denied');
      shareError.name = 'NotAllowedError';
      const shareMock = vi.fn().mockRejectedValue(shareError);

      Object.defineProperty(globalThis, 'navigator', {
        value: {
          ...originalNavigator,
          share: shareMock,
        },
        configurable: true,
        writable: true,
      });

      const copySpy = vi.spyOn(clipboardModule, 'copyToClipboard').mockResolvedValueOnce({ success: true });

      const outcome = await shareQuizResult({
        score: 1500,
        campaignTitle: 'NotAllowed Test',
      });

      expect(outcome.status).toBe('copied');
      expect(copySpy).toHaveBeenCalledTimes(1);
    });

    it('falls back to clipboard copy when navigator.share throws TypeError', async () => {
      const shareError = new TypeError('Invalid parameters passed to navigator.share');
      const shareMock = vi.fn().mockRejectedValue(shareError);

      Object.defineProperty(globalThis, 'navigator', {
        value: {
          ...originalNavigator,
          share: shareMock,
        },
        configurable: true,
        writable: true,
      });

      const copySpy = vi.spyOn(clipboardModule, 'copyToClipboard').mockResolvedValueOnce({ success: true });

      const outcome = await shareQuizResult({
        score: 1500,
        campaignTitle: 'TypeError Test',
      });

      expect(outcome.status).toBe('copied');
      expect(copySpy).toHaveBeenCalledTimes(1);
    });

    it('falls back to clipboard copy when navigator.share throws a non-abort error', async () => {
      const shareError = new Error('PermissionDeniedError');
      const shareMock = vi.fn().mockRejectedValue(shareError);

      Object.defineProperty(globalThis, 'navigator', {
        value: {
          ...originalNavigator,
          share: shareMock,
        },
        configurable: true,
        writable: true,
      });

      vi.spyOn(clipboardModule, 'copyToClipboard').mockResolvedValueOnce({ success: true });

      const outcome = await shareQuizResult({
        score: 1500,
        campaignTitle: 'Test Campaign',
      });

      expect(outcome.status).toBe('copied');
      if (outcome.status === 'copied') {
        expect(outcome.text).toContain('1.500/2,000 điểm');
      }
    });

    it('falls back to clipboard copy when navigator.share is undefined (Desktop / Unsupported)', async () => {
      Object.defineProperty(globalThis, 'navigator', {
        value: {
          ...originalNavigator,
          share: undefined,
        },
        configurable: true,
        writable: true,
      });

      vi.spyOn(clipboardModule, 'copyToClipboard').mockResolvedValueOnce({ success: true });

      const outcome = await shareQuizResult({
        score: 1400,
        campaignTitle: 'Desktop Test',
        voucherDiscount: 'Giảm 10%',
      });

      expect(outcome.status).toBe('copied');
      if (outcome.status === 'copied') {
        expect(outcome.text).toContain('1.400/2,000 điểm');
        expect(outcome.text).toContain('Giảm 10%');
      }
    });

    it('returns status "manual" when both navigator.share and clipboard copy fail', async () => {
      Object.defineProperty(globalThis, 'navigator', {
        value: {
          ...originalNavigator,
          share: undefined,
        },
        configurable: true,
        writable: true,
      });

      vi.spyOn(clipboardModule, 'copyToClipboard').mockResolvedValueOnce({
        success: false,
        error: 'Clipboard write denied',
      });

      const outcome = await shareQuizResult({
        score: 1400,
        campaignTitle: 'Fallback Test',
      });

      expect(outcome.status).toBe('manual');
      if (outcome.status === 'manual') {
        expect(outcome.text).toContain('1.400/2,000 điểm');
        expect(outcome.error).toBe('Clipboard write denied');
      }
    });
  });

  describe('4. Side-effect Isolation & Safety Guarantees', () => {
    it('sharing does NOT modify stored leads or create leaderboard records', async () => {
      expect(StorageService.getLeads().data).toHaveLength(0);
      expect(StorageService.getLeaderboard().data).toHaveLength(0);

      vi.spyOn(clipboardModule, 'copyToClipboard').mockResolvedValueOnce({ success: true });

      await shareQuizResult({
        score: 1600,
        campaignTitle: 'Safe Isolation Campaign',
      });

      // Storage remains completely pristine
      expect(StorageService.getLeads().data).toHaveLength(0);
      expect(StorageService.getLeaderboard().data).toHaveLength(0);
    });
  });
});
