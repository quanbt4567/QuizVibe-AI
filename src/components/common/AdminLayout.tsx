import React from 'react';
import {
  Zap,
  LayoutDashboard,
  FolderKanban,
  Users,
  Ticket,
  ExternalLink,
  LogOut,
} from 'lucide-react';
import { AdminRouteSection } from '../../router/appRouter';
import { Badge, Button } from '../ui';

export interface AdminLayoutProps {
  activeSection: AdminRouteSection;
  publicQuizPath: string;
  onNavigate: (path: string) => void;
  onLogout: () => void;
  isLoggingOut?: boolean;
  logoutError?: string | null;
  children: React.ReactNode;
}

const ADMIN_NAV_ITEMS: Array<{
  section: AdminRouteSection;
  path: string;
  label: string;
  icon: React.FC<{ className?: string }>;
}> = [
  {
    section: 'overview',
    path: '/admin',
    label: 'Tổng quan',
    icon: LayoutDashboard,
  },
  {
    section: 'campaigns',
    path: '/admin/campaigns',
    label: 'Chiến dịch',
    icon: FolderKanban,
  },
  {
    section: 'leads',
    path: '/admin/leads',
    label: 'Quản lý Leads',
    icon: Users,
  },
  {
    section: 'vouchers',
    path: '/admin/vouchers',
    label: 'Voucher',
    icon: Ticket,
  },
];

/**
 * Private Admin Studio Layout (/admin, /admin/campaigns, /admin/leads, /admin/vouchers)
 * Rendered only after server-verified Admin authentication.
 */
export const AdminLayout: React.FC<AdminLayoutProps> = ({
  activeSection,
  publicQuizPath,
  onNavigate,
  onLogout,
  isLoggingOut = false,
  logoutError = null,
  children,
}) => {
  return (
    <div
      data-testid="admin-studio-layout"
      className="min-h-screen bg-canvas text-foreground flex flex-col font-sans selection:bg-indigo-500 selection:text-white"
    >
      <header className="sticky top-0 z-50 w-full border-b border-border-subtle bg-canvas/90 backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-2 px-3 sm:px-6 lg:px-8">
          {/* Brand & Admin Studio Badge */}
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => onNavigate('/admin')}
              className="flex items-center gap-2.5 shrink-0 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded-lg cursor-pointer"
            >
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-primary/30 bg-primary/15 text-primary shadow-key">
                <Zap className="h-4 w-4" />
              </div>

              <span className="text-sm sm:text-base font-bold tracking-tight text-foreground whitespace-nowrap">
                QuizVibe <span className="text-primary">AI</span>
              </span>
            </button>

            <Badge
              variant="default"
              shape="compact"
              className="font-mono text-[10px] uppercase tracking-wider shrink-0"
            >
              STUDIO
            </Badge>

            {/* Primary Route Navigation */}
            <nav
              aria-label="Admin Navigation"
              className="hidden md:flex items-center gap-1 ml-2 pl-3 border-l border-border-subtle"
            >
              {ADMIN_NAV_ITEMS.map((item) => {
                const Icon = item.icon;
                const isActive = activeSection === item.section;
                return (
                  <button
                    key={item.path}
                    type="button"
                    onClick={() => onNavigate(item.path)}
                    aria-current={isActive ? 'page' : undefined}
                    className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors cursor-pointer ${
                      isActive
                        ? 'bg-interactive text-foreground font-semibold border border-border-subtle/80 shadow-key'
                        : 'text-content-secondary hover:text-foreground hover:bg-interactive/50 border border-transparent'
                    }`}
                  >
                    <Icon className="h-3.5 w-3.5 shrink-0 text-primary" />
                    <span>{item.label}</span>
                  </button>
                );
              })}
            </nav>
          </div>

          {/* Right Actions: View Public Quiz & Logout */}
          <div className="flex items-center gap-2 shrink-0">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onNavigate(publicQuizPath)}
              className="gap-1.5 text-xs"
              title="Mở trang Quiz công khai dành cho người chơi"
            >
              <ExternalLink className="h-3.5 w-3.5 text-primary" />
              <span className="hidden sm:inline">Xem Quiz công khai</span>
            </Button>

            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={onLogout}
              disabled={isLoggingOut}
              className="gap-1.5 text-xs text-content-secondary hover:text-rose-300"
            >
              <LogOut className="h-3.5 w-3.5" />
              <span>{isLoggingOut ? 'Đang thoát...' : 'Đăng xuất'}</span>
            </Button>
          </div>
        </div>

        {/* Mobile Route Bar */}
        <nav
          aria-label="Admin Mobile Navigation"
          className="flex md:hidden items-center justify-around border-t border-border-subtle bg-recessed/70 px-2 py-1.5 overflow-x-auto"
        >
          {ADMIN_NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const isActive = activeSection === item.section;
            return (
              <button
                key={item.path}
                type="button"
                onClick={() => onNavigate(item.path)}
                aria-current={isActive ? 'page' : undefined}
                className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium whitespace-nowrap transition-colors cursor-pointer ${
                  isActive
                    ? 'bg-interactive text-foreground font-semibold border border-border-subtle/80'
                    : 'text-content-secondary hover:text-foreground'
                }`}
              >
                <Icon className="h-3.5 w-3.5 shrink-0 text-primary" />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>
      </header>

      {logoutError && (
        <div
          role="alert"
          className="mx-auto w-full max-w-6xl px-3 sm:px-6 lg:px-8 pt-3 text-xs text-rose-300"
        >
          {logoutError}
        </div>
      )}
      <main className="flex-1 flex flex-col">{children}</main>

      <footer className="border-t border-border-subtle bg-canvas/80 py-4 text-center text-xs text-content-muted">
        <p>QuizVibe AI Studio &copy; 2026 &mdash; Hệ thống Quản trị Chiến dịch Minigame</p>
      </footer>
    </div>
  );
};

