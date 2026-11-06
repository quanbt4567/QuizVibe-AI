import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  shareToFacebook,
  openCenteredPopup,
  __resetFacebookSdkForTesting,
} from './facebookShare';

describe('Facebook Share Service', () => {
  const originalWindowOpen = window.open;

  beforeEach(() => {
    __resetFacebookSdkForTesting();
    window.open = vi.fn();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    window.open = originalWindowOpen;
    __resetFacebookSdkForTesting();
  });

  describe('openCenteredPopup', () => {
    it('calculates center coordinates and opens window with correct specs', () => {
      const mockWindow = { closed: false, focus: vi.fn() } as unknown as Window;
      (window.open as any).mockReturnValue(mockWindow);

      const result = openCenteredPopup('https://www.facebook.com/sharer/sharer.php?u=https://example.com', 'FB Share', 600, 500);

      expect(window.open).toHaveBeenCalledWith(
        'https://www.facebook.com/sharer/sharer.php?u=https://example.com',
        'FB Share',
        expect.stringContaining('width=600,height=500')
      );
      expect(result).toBe(mockWindow);
      expect(mockWindow.focus).toHaveBeenCalled();
    });

    it('returns null when popup is blocked (window.open returns null)', () => {
      (window.open as any).mockReturnValue(null);
      const result = openCenteredPopup('https://example.com');
      expect(result).toBeNull();
    });

    it('returns null when popup is immediately closed by browser popup blocker', () => {
      (window.open as any).mockReturnValue({ closed: true });
      const result = openCenteredPopup('https://example.com');
      expect(result).toBeNull();
    });
  });

  describe('shareToFacebook without SDK (Sharer Fallback Mode)', () => {
    it('opens centered sharer.php popup and returns status opened when no App ID configured', async () => {
      const mockWindow = { closed: false, focus: vi.fn() } as unknown as Window;
      (window.open as any).mockReturnValue(mockWindow);

      const outcome = await shareToFacebook({
        url: 'https://quiz-vibe-ai.vercel.app/quiz/test-slug',
        quote: 'Thử thách Quiz cực vui!',
      });

      expect(outcome.status).toBe('opened');
      if (outcome.status === 'opened') {
        expect(outcome.method).toBe('sharer_fallback');
      }
      expect(window.open).toHaveBeenCalledWith(
        expect.stringContaining('https://www.facebook.com/sharer/sharer.php?u='),
        expect.any(String),
        expect.any(String)
      );
    });

    it('returns status blocked when browser popup blocker intervenes', async () => {
      (window.open as any).mockReturnValue(null);

      const outcome = await shareToFacebook({
        url: 'https://quiz-vibe-ai.vercel.app/quiz/test-slug',
      });

      expect(outcome.status).toBe('blocked');
      if (outcome.status === 'blocked') {
        expect(outcome.url).toBe('https://quiz-vibe-ai.vercel.app/quiz/test-slug');
      }
    });

    it('returns error when url is empty', async () => {
      const outcome = await shareToFacebook({ url: '' });
      expect(outcome.status).toBe('error');
    });
  });

  describe('shareToFacebook with FB JS SDK (FB.ui Dialog Mode)', () => {
    it('resolves with status shared when FB.ui dialog is successfully completed', async () => {
      window.FB = {
        init: vi.fn(),
        ui: vi.fn((_params, callback) => {
          callback({ post_id: 'post_12345' });
        }),
      };

      const outcome = await shareToFacebook({
        url: 'https://quiz-vibe-ai.vercel.app/quiz/my-quiz',
        quote: 'Tôi vừa đạt 1800 điểm!',
      });

      expect(window.FB.ui).toHaveBeenCalledWith(
        expect.objectContaining({
          method: 'share',
          href: 'https://quiz-vibe-ai.vercel.app/quiz/my-quiz',
          quote: 'Tôi vừa đạt 1800 điểm!',
          display: 'popup',
        }),
        expect.any(Function)
      );
      expect(outcome.status).toBe('shared');
      if (outcome.status === 'shared') {
        expect(outcome.postId).toBe('post_12345');
      }
    });

    it('resolves with status cancelled when player dismisses dialog (response is null or empty)', async () => {
      window.FB = {
        init: vi.fn(),
        ui: vi.fn((_params, callback) => {
          callback(null);
        }),
      };

      const outcome = await shareToFacebook({
        url: 'https://quiz-vibe-ai.vercel.app/quiz/my-quiz',
      });

      expect(outcome.status).toBe('cancelled');
    });

    it('resolves with status error when FB.ui reports error_code', async () => {
      window.FB = {
        init: vi.fn(),
        ui: vi.fn((_params, callback) => {
          callback({ error_code: 4201, error_message: 'User cancelled or failed' });
        }),
      };

      const outcome = await shareToFacebook({
        url: 'https://quiz-vibe-ai.vercel.app/quiz/my-quiz',
      });

      expect(outcome.status).toBe('error');
    });
  });
});
