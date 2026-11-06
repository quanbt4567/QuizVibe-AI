declare global {
  interface Window {
    FB?: {
      init: (params: { appId: string; cookie: boolean; xfbml: boolean; version: string }) => void;
      ui: (params: any, callback: (response: any) => void) => void;
    };
    fbAsyncInit?: () => void;
  }
}

export interface FacebookShareOptions {
  url: string;
  quote?: string;
  hashtag?: string;
}

export type FacebookShareOutcome =
  | { status: 'shared'; postId?: string }
  | { status: 'opened'; method: 'sharer_fallback' }
  | { status: 'cancelled' }
  | { status: 'blocked'; url: string }
  | { status: 'error'; message: string };

/**
 * Reads VITE_FACEBOOK_APP_ID from Vite environment if defined.
 */
export function getFacebookAppId(): string | null {
  try {
    const appId = (import.meta as any).env?.VITE_FACEBOOK_APP_ID;
    if (typeof appId === 'string' && appId.trim().length > 0) {
      return appId.trim();
    }
  } catch {
    // Environment access safe fallback
  }
  return null;
}

/**
 * Singleton loader for Facebook JavaScript SDK
 */
let fbInitPromise: Promise<boolean> | null = null;

export function loadFacebookSdk(): Promise<boolean> {
  if (typeof window === 'undefined') return Promise.resolve(false);

  // If FB already defined and initialized
  if (window.FB && typeof window.FB.ui === 'function') {
    return Promise.resolve(true);
  }

  if (fbInitPromise) {
    return fbInitPromise;
  }

  const appId = getFacebookAppId();
  // If no App ID configured, we cannot initialize FB SDK, return false to trigger sharer fallback
  if (!appId) {
    return Promise.resolve(false);
  }

  fbInitPromise = new Promise<boolean>((resolve) => {
    // If script already exists in DOM
    if (document.getElementById('facebook-jssdk')) {
      if (window.FB && typeof window.FB.ui === 'function') {
        return resolve(true);
      }
    }

    // Define fbAsyncInit before loading script
    window.fbAsyncInit = function () {
      try {
        if (window.FB && typeof window.FB.init === 'function') {
          window.FB.init({
            appId,
            cookie: true,
            xfbml: false,
            version: 'v19.0',
          });
          resolve(true);
          return;
        }
      } catch (err) {
        console.warn('[FacebookSDK] Init failed:', err);
      }
      resolve(false);
    };

    const script = document.createElement('script');
    script.id = 'facebook-jssdk';
    script.src = 'https://connect.facebook.net/vi_VN/sdk.js';
    script.async = true;
    script.defer = true;
    script.onerror = () => {
      console.warn('[FacebookSDK] Failed to load SDK script (blocked or network offline)');
      resolve(false);
    };

    const firstScript = document.getElementsByTagName('script')[0];
    if (firstScript && firstScript.parentNode) {
      firstScript.parentNode.insertBefore(script, firstScript);
    } else {
      document.head.appendChild(script);
    }

    // Safety timeout in case callback never fires (e.g., ad blocker silently blocking script)
    setTimeout(() => {
      if (!window.FB || typeof window.FB.ui !== 'function') {
        resolve(false);
      }
    }, 4000);
  });

  return fbInitPromise;
}

/**
 * Opens a centered popup window for Facebook Sharer
 */
export function openCenteredPopup(url: string, title = 'Facebook Share', w = 620, h = 600): Window | null {
  if (typeof window === 'undefined') return null;
  const dualScreenLeft = window.screenLeft ?? window.screenX ?? 0;
  const dualScreenTop = window.screenTop ?? window.screenY ?? 0;
  const width = window.innerWidth || document.documentElement.clientWidth || screen.width;
  const height = window.innerHeight || document.documentElement.clientHeight || screen.height;
  const left = Math.max(0, Math.floor(width / 2 - w / 2 + dualScreenLeft));
  const top = Math.max(0, Math.floor(height / 2 - h / 2 + dualScreenTop));

  try {
    const popup = window.open(
      url,
      title,
      `toolbar=no,location=no,status=no,menubar=no,scrollbars=yes,resizable=yes,width=${w},height=${h},top=${top},left=${left}`
    );
    if (!popup || popup.closed || typeof popup.closed === 'undefined') {
      return null;
    }
    popup.focus?.();
    return popup;
  } catch {
    return null;
  }
}

/**
 * Triggers official Facebook Share Dialog (FB.ui if SDK ready, or centered sharer.php popup)
 */
export async function shareToFacebook(options: FacebookShareOptions): Promise<FacebookShareOutcome> {
  const { url, quote, hashtag } = options;
  if (!url) {
    return { status: 'error', message: 'URL chia sẻ không hợp lệ' };
  }

  const isSdkLoaded = await loadFacebookSdk();

  // Mode 1: Facebook JS SDK with FB.ui
  if (isSdkLoaded && window.FB && typeof window.FB.ui === 'function') {
    const fb = window.FB;
    return new Promise<FacebookShareOutcome>((resolve) => {
      try {
        fb.ui(
          {
            method: 'share',
            href: url,
            quote: quote || undefined,
            hashtag: hashtag || undefined,
            display: 'popup',
          },
          (response: any) => {
            // Note: FB returns null/undefined or empty array if user closes/cancels dialog
            if (!response) {
              resolve({ status: 'cancelled' });
            } else if (response.error_code) {
              resolve({
                status: 'error',
                message: response.error_message || `Lỗi Facebook (${response.error_code})`,
              });
            } else {
              resolve({
                status: 'shared',
                postId: response.post_id || response.id,
              });
            }
          }
        );
      } catch (err: any) {
        console.warn('[FacebookSDK] FB.ui invocation failed, falling back to sharer URL:', err);
        resolve(fallbackToSharer(url, quote));
      }
    });
  }

  // Mode 2: Official Sharer URL Popup Fallback
  return fallbackToSharer(url, quote);
}

function fallbackToSharer(url: string, quote?: string): FacebookShareOutcome {
  let sharerUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`;
  if (quote) {
    sharerUrl += `&quote=${encodeURIComponent(quote)}`;
  }

  const popup = openCenteredPopup(sharerUrl, 'Chia sẻ lên Facebook');
  if (!popup) {
    return {
      status: 'blocked',
      url,
    };
  }

  return {
    status: 'opened',
    method: 'sharer_fallback',
  };
}

/**
 * Test helper to reset internal singleton state
 */
export function __resetFacebookSdkForTesting() {
  fbInitPromise = null;
  if (typeof window !== 'undefined') {
    delete (window as any).FB;
    delete (window as any).fbAsyncInit;
    const existing = document.getElementById('facebook-jssdk');
    if (existing && existing.parentNode) {
      existing.parentNode.removeChild(existing);
    }
  }
}
