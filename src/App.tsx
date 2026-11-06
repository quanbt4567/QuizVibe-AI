import React, { useState, useEffect } from 'react';
import { CheckCircle2, X, Loader2, AlertCircle, RefreshCw } from 'lucide-react';
import { PublicPlayerLayout } from './components/common/PublicPlayerLayout';
import { AdminLayout } from './components/common/AdminLayout';
import { NotFoundScreen } from './components/common/NotFoundScreen';
import { ErrorBoundary } from './components/common/ErrorBoundary';
import { AdminLoginScreen } from './components/admin/AdminLoginScreen';
import { PublicCampaignScreen } from './components/player';
import { AdminDashboard } from './components/admin/AdminDashboard';
import { Campaign } from './types';
import { PublicCampaign } from './types/campaign';
import { StorageService } from './services';
import {
  checkAdminSession,
  logoutAdmin,
} from './services/adminAuthService';
import { fetchPublicCampaign } from './services/publicCampaignApi';
import {
  getCampaignSlug,
  useAppRouter,
} from './router/appRouter';

export const App: React.FC = () => {
  const { route, navigate } = useAppRouter();
  const [activeCampaign, setActiveCampaign] = useState<Campaign | null>(() => {
    const initRes = StorageService.initializeDefaults();
    return initRes.success && initRes.data ? initRes.data : null;
  });
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Server-verified Admin authentication state (never stored in localStorage/sessionStorage)
  const [adminAuthState, setAdminAuthState] = useState<'checking' | 'authenticated' | 'unauthenticated'>('checking');
  const [isLoggingOut, setIsLoggingOut] = useState<boolean>(false);
  const [logoutError, setLogoutError] = useState<string | null>(null);

  // Public Campaign Fetching State for /quiz/:slug and /
  const [publicLoading, setPublicLoading] = useState<boolean>(true);
  const [publicCampaign, setPublicCampaign] = useState<PublicCampaign | null>(null);
  const [publicError, setPublicError] = useState<'not-found' | 'network-error' | null>(null);
  const [publicRetryCount, setPublicRetryCount] = useState<number>(0);

  const isAdminRoute =
    route.kind === 'admin' ||
    route.kind === 'admin-login' ||
    (route.kind === 'not-found' && route.area === 'admin');

  // Verify Admin session with server whenever entering an Admin route
  useEffect(() => {
    if (!isAdminRoute) return;

    let cancelled = false;
    setAdminAuthState('checking');

    checkAdminSession().then((status) => {
      if (cancelled) return;
      if (status.authenticated) {
        setAdminAuthState('authenticated');
        if (route.kind === 'admin-login') {
          navigate('/admin', { replace: true });
        }
      } else {
        setAdminAuthState('unauthenticated');
        if (route.kind !== 'admin-login') {
          navigate('/admin/login', { replace: true });
        }
      }
    });

    return () => {
      cancelled = true;
    };
  }, [isAdminRoute, route.kind, route.pathname, navigate]);

  // Fetch sanitized public campaign for public routes
  const publicSlug = route.kind === 'public-quiz' ? route.slug : null;

  useEffect(() => {
    if (!publicSlug) return;
    let cancelled = false;

    setPublicLoading(true);
    setPublicError(null);
    setPublicCampaign(null);

    fetchPublicCampaign(publicSlug)
      .then((res) => {
        if (cancelled) return;
        if (res.status === 'found') {
          setPublicCampaign(res.campaign);
          setPublicLoading(false);
        } else if (res.status === 'not-found') {
          setPublicError('not-found');
          setPublicLoading(false);
        } else {
          setPublicError('network-error');
          setPublicLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setPublicError('network-error');
          setPublicLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [publicSlug, publicRetryCount]);

  // Auto-dismiss toast after 3 seconds
  useEffect(() => {
    if (toastMessage) {
      const timer = setTimeout(() => setToastMessage(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [toastMessage]);

  const handleCampaignUpdate = (updated: Campaign) => {
    setActiveCampaign(updated);
  };

  const handleAdminLogout = async () => {
    setIsLoggingOut(true);
    setLogoutError(null);
    const loggedOut = await logoutAdmin();
    setIsLoggingOut(false);
    if (!loggedOut) {
      // Server-side revocation did not complete: stay signed in and let the user retry.
      setLogoutError('Không thể đăng xuất trên máy chủ. Phiên vẫn đang hoạt động, vui lòng thử lại.');
      return;
    }
    setAdminAuthState('unauthenticated');
    navigate('/admin/login', { replace: true });
  };

  const activePublicQuizPath = `/quiz/${getCampaignSlug(activeCampaign)}`;

  // ---------------------------------------------------------------------------
  // 1. Admin Login Route (/admin/login) or Unauthenticated Admin Access Guard
  // ---------------------------------------------------------------------------
  if (isAdminRoute) {
    if (adminAuthState === 'checking' && route.kind !== 'admin-login') {
      return (
        <div
          data-testid="admin-auth-checking"
          className="min-h-screen bg-canvas text-foreground flex flex-col items-center justify-center gap-3 font-sans"
        >
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
          <p className="text-xs text-content-secondary">
            Đang xác thực phiên Quản trị viên...
          </p>
        </div>
      );
    }

    if (route.kind === 'admin-login' || adminAuthState !== 'authenticated') {
      return (
        <AdminLoginScreen
          onLoginSuccess={() => {
            setAdminAuthState('authenticated');
            navigate('/admin', { replace: true });
          }}
          onNavigatePublicQuiz={() => navigate(activePublicQuizPath)}
        />
      );
    }

    // Authenticated Admin Studio Layout
    return (
      <AdminLayout
        activeSection={route.kind === 'admin' ? route.section : 'overview'}
        publicQuizPath={activePublicQuizPath}
        onNavigate={navigate}
        onLogout={handleAdminLogout}
        isLoggingOut={isLoggingOut}
        logoutError={logoutError}
      >
        {route.kind === 'not-found' ? (
          <NotFoundScreen
            pathname={route.pathname}
            area="admin"
            onReturnHome={() => navigate('/admin')}
          />
        ) : (
          <AdminDashboard
            campaign={activeCampaign}
            onCampaignChange={handleCampaignUpdate}
            activeSection={route.section}
            routeView={route.view}
            campaignId={route.campaignId}
            onNavigateRoute={navigate}
            onUnauthenticated={() => {
              setAdminAuthState('unauthenticated');
              navigate('/admin/login', { replace: true });
            }}
          />
        )}
      </AdminLayout>
    );
  }

  // ---------------------------------------------------------------------------
  // 2. Public Unknown Route (404 Not Found)
  // ---------------------------------------------------------------------------
  if (route.kind === 'not-found') {
    return (
      <PublicPlayerLayout campaignTitle={activeCampaign?.title}>
        <NotFoundScreen
          pathname={route.pathname}
          area="public"
          onReturnHome={() => navigate(activePublicQuizPath)}
        />
      </PublicPlayerLayout>
    );
  }

  // ---------------------------------------------------------------------------
  // 3. Public Quiz Player Route (/quiz/:slug or /)
  // ---------------------------------------------------------------------------
  if (publicLoading) {
    return (
      <PublicPlayerLayout>
        <div
          data-testid="public-campaign-loading"
          className="mx-auto w-full max-w-[480px] px-4 py-16 flex flex-col items-center justify-center gap-3 text-center"
        >
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-sm font-medium text-content-secondary">
            Đang tải thông tin thử thách...
          </p>
        </div>
      </PublicPlayerLayout>
    );
  }

  if (publicError === 'network-error') {
    return (
      <PublicPlayerLayout>
        <div data-testid="public-campaign-error" className="mx-auto w-full max-w-[480px] px-4 py-12">
          <div className="rounded-2xl border border-destructive/40 bg-card p-6 text-center space-y-4 shadow-elevated">
            <AlertCircle className="mx-auto h-10 w-10 text-destructive" />
            <h2 className="text-lg font-bold text-foreground">Không thể kết nối máy chủ</h2>
            <p className="text-xs sm:text-sm text-content-secondary leading-relaxed">
              Đã xảy ra lỗi kết nối khi tải dữ liệu chiến dịch. Vui lòng kiểm tra đường truyền mạng và thử lại.
            </p>
            <button
              type="button"
              onClick={() => setPublicRetryCount((c) => c + 1)}
              className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-bold text-white hover:bg-primary/90 transition-colors cursor-pointer"
            >
              <RefreshCw className="h-4 w-4" />
              <span>Thử lại</span>
            </button>
          </div>
        </div>
      </PublicPlayerLayout>
    );
  }

  if (publicError === 'not-found' || !publicCampaign) {
    return (
      <PublicPlayerLayout>
        <NotFoundScreen
          pathname={route.pathname}
          area="public"
          title="Chiến dịch không tồn tại hoặc chưa xuất bản"
          description={`Không tìm thấy minigame công khai cho đường dẫn "${route.pathname}". Chiến dịch có thể đã kết thúc hoặc chưa được xuất bản.`}
          ctaLabel="Về Minigame đang diễn ra"
          onReturnHome={() => navigate('/')}
        />
      </PublicPlayerLayout>
    );
  }

  return (
    <PublicPlayerLayout campaignTitle={publicCampaign.title}>
      {/* Floating Toast Notification */}
      {toastMessage && (
        <div
          role="status"
          aria-live="polite"
          className="fixed bottom-4 inset-x-4 sm:bottom-6 sm:right-6 sm:left-auto sm:max-w-md z-50 animate-fadeIn"
        >
          <div className="flex items-center justify-between gap-3 rounded-xl border border-border-tactile bg-card px-4 py-3 text-xs sm:text-sm font-semibold text-foreground shadow-elevated">
            <div className="flex items-center gap-2.5 min-w-0">
              <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" />
              <span className="leading-snug">{toastMessage}</span>
            </div>
            <button
              type="button"
              onClick={() => setToastMessage(null)}
              aria-label="Đóng thông báo"
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-content-secondary hover:bg-interactive hover:text-foreground transition-colors focus:outline-none focus:ring-2 focus:ring-primary"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      <ErrorBoundary>
        <PublicCampaignScreen campaign={publicCampaign} />
      </ErrorBoundary>
    </PublicPlayerLayout>
  );
};

export default App;
