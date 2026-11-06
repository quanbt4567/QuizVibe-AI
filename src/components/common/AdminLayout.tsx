import React, { useState, useEffect } from 'react';
import {
  LayoutDashboard,
  Layers,
  Users,
  Ticket,
  ExternalLink,
  LogOut,
  PanelLeftClose,
  PanelLeftOpen,
  Menu,
  X,
  ShieldCheck,
  ChevronRight,
} from 'lucide-react';
import { AdminRouteSection } from '../../router/appRouter';
import { Button } from '../ui';
import { cn } from '../../lib/utils';

export interface AdminLayoutProps {
  activeSection: AdminRouteSection;
  publicQuizPath: string;
  onNavigate: (path: string) => void;
  onLogout: () => void;
  isLoggingOut?: boolean;
  logoutError?: string | null;
  children: React.ReactNode;
}

interface NavItem {
  section: AdminRouteSection;
  path: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}

const ADMIN_NAV_ITEMS: NavItem[] = [
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
    icon: Layers,
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
    label: 'Cấu hình Voucher',
    icon: Ticket,
  },
];

const SECTION_LABELS: Record<AdminRouteSection, string> = {
  overview: 'Tổng quan studio',
  campaigns: 'Quản lý chiến dịch',
  leads: 'Danh sách khách hàng (Leads)',
  vouchers: 'Cấu hình Voucher ưu đãi',
};

/**
 * Enterprise Admin Studio Layout (/admin, /admin/campaigns, /admin/leads, /admin/vouchers)
 * Inspired by Shadcn Dashboard and Blocks.so sidebar-01 architectures.
 * Enforces obsidian dark surfaces, collapsible desktop sidebar, and accessible navigation.
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
  const [isCollapsed, setIsCollapsed] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('qv_admin_sidebar_collapsed') === 'true';
    }
    return false;
  });

  const [isMobileNavOpen, setIsMobileNavOpen] = useState<boolean>(false);

  const handleToggleCollapse = () => {
    setIsCollapsed((prev) => {
      const next = !prev;
      if (typeof window !== 'undefined') {
        localStorage.setItem('qv_admin_sidebar_collapsed', String(next));
      }
      return next;
    });
  };

  // Close mobile nav on route change or Escape
  useEffect(() => {
    setIsMobileNavOpen(false);
  }, [activeSection]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isMobileNavOpen) {
        setIsMobileNavOpen(false);
      }
      // Keyboard shortcut (Cmd/Ctrl + B) to toggle sidebar
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'b') {
        e.preventDefault();
        handleToggleCollapse();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isMobileNavOpen]);

  const currentSectionLabel = SECTION_LABELS[activeSection] || 'Studio';

  const renderNavButtons = (collapsedMode: boolean) => (
    <div className="space-y-1">
      {ADMIN_NAV_ITEMS.map((item) => {
        const Icon = item.icon;
        const isActive = activeSection === item.section;

        return (
          <button
            key={item.path}
            type="button"
            onClick={() => onNavigate(item.path)}
            aria-current={isActive ? 'page' : undefined}
            title={collapsedMode ? item.label : undefined}
            className={cn(
              'group relative flex w-full items-center rounded-lg text-xs font-medium transition-all duration-150',
              collapsedMode ? 'justify-center h-10 px-0' : 'gap-3 px-3 py-2.5',
              isActive
                ? 'bg-interactive text-foreground font-semibold shadow-key border border-border-tactile/60'
                : 'text-content-secondary hover:bg-interactive/40 hover:text-foreground'
            )}
          >
            <Icon
              className={cn(
                'h-4 w-4 shrink-0 transition-colors',
                isActive ? 'text-primary' : 'text-content-muted group-hover:text-foreground'
              )}
            />

            {!collapsedMode && (
              <span className="truncate flex-1 text-left">{item.label}</span>
            )}

            {isActive && (
              <span className="absolute left-0 top-1.5 bottom-1.5 w-1 rounded-r bg-primary" />
            )}
          </button>
        );
      })}
    </div>
  );

  return (
    <div
      data-testid="admin-studio-layout"
      className="flex min-h-screen w-full bg-canvas text-foreground selection:bg-indigo-500 selection:text-white"
    >
      {/* 1. Desktop Sidebar (>= lg) */}
      <aside
        className={cn(
          'hidden lg:flex flex-col justify-between border-r border-border bg-card transition-all duration-200 select-none shrink-0 z-30',
          isCollapsed ? 'w-16' : 'w-64'
        )}
        aria-label="Thanh điều hướng chính"
      >
        <div>
          {/* Header Brand */}
          <div className="flex h-14 items-center justify-between px-3.5 border-b border-border/80">
            {!isCollapsed ? (
              <button
                type="button"
                onClick={() => onNavigate('/admin')}
                className="flex items-center gap-2.5 text-left cursor-pointer min-w-0"
              >
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground font-extrabold text-sm shadow-sm">
                  QV
                </div>
                <div className="min-w-0">
                  <span className="block text-sm font-bold tracking-tight text-foreground truncate">
                    QuizVibe AI
                  </span>
                  <span className="block text-[10px] text-content-muted tracking-wider uppercase font-semibold">
                    Studio Console
                  </span>
                </div>
              </button>
            ) : (
              <button
                type="button"
                onClick={() => onNavigate('/admin')}
                className="mx-auto flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground font-extrabold text-sm cursor-pointer shadow-sm"
                title="QuizVibe AI Studio"
              >
                QV
              </button>
            )}

            {!isCollapsed && (
              <button
                type="button"
                onClick={handleToggleCollapse}
                className="flex h-7 w-7 items-center justify-center rounded-md text-content-muted hover:bg-interactive hover:text-foreground transition-colors"
                title="Thu gọn thanh bên (Ctrl+B)"
                aria-label="Thu gọn thanh bên"
              >
                <PanelLeftClose className="h-4 w-4" />
              </button>
            )}
          </div>

          {/* Navigation Items */}
          <nav aria-label="Admin Navigation" className="p-2">
            {renderNavButtons(isCollapsed)}
          </nav>
        </div>

        {/* Footer Actions */}
        <div className="p-2 border-t border-border/80 space-y-1">
          <Button
            type="button"
            variant="ghost"
            size="compact"
            onClick={() => onNavigate(publicQuizPath)}
            className={cn(
              'w-full text-xs text-content-muted hover:text-foreground justify-start',
              isCollapsed && 'justify-center px-0'
            )}
            title="Mở giao diện người chơi Quiz công khai"
          >
            <ExternalLink className="h-3.5 w-3.5 shrink-0 text-primary" />
            {!isCollapsed && <span className="truncate ml-2">Xem Quiz công khai</span>}
          </Button>

          {isCollapsed && (
            <button
              type="button"
              onClick={handleToggleCollapse}
              className="flex h-10 w-full items-center justify-center rounded-lg text-content-muted hover:bg-interactive hover:text-foreground transition-colors"
              title="Mở rộng thanh bên (Ctrl+B)"
              aria-label="Mở rộng thanh bên"
            >
              <PanelLeftOpen className="h-4 w-4" />
            </button>
          )}
        </div>
      </aside>

      {/* 2. Mobile Drawer & Backdrop (< lg) */}
      {isMobileNavOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          <div
            className="fixed inset-0 bg-canvas/80 backdrop-blur-sm transition-opacity"
            onClick={() => setIsMobileNavOpen(false)}
            aria-hidden="true"
          />

          <div className="relative flex w-72 max-w-[80vw] flex-col bg-card border-r border-border shadow-2xl z-10 animate-fadeIn">
            <button
              type="button"
              onClick={() => setIsMobileNavOpen(false)}
              className="absolute right-3.5 top-3.5 flex h-7 w-7 items-center justify-center rounded-lg text-content-muted hover:bg-interactive hover:text-foreground"
              aria-label="Đóng thanh điều hướng"
            >
              <X className="h-4 w-4" />
            </button>

            <div className="flex h-14 items-center gap-2.5 px-4 border-b border-border/80">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground font-extrabold text-sm shadow-sm">
                QV
              </div>
              <span className="text-sm font-bold tracking-tight text-foreground">
                QuizVibe AI Studio
              </span>
            </div>

            <nav aria-label="Admin Mobile Navigation" className="p-3 flex-1 overflow-y-auto">
              {renderNavButtons(false)}
            </nav>

            <div className="p-3 border-t border-border/80">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  onNavigate(publicQuizPath);
                  setIsMobileNavOpen(false);
                }}
                className="w-full gap-2 text-xs"
              >
                <ExternalLink className="h-3.5 w-3.5 text-primary" />
                <span>Xem Quiz công khai</span>
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* 3. Main Workspace Area */}
      <div className="flex flex-1 flex-col min-w-0 overflow-y-auto">
        {/* Sticky Command Header */}
        <header className="sticky top-0 z-20 flex h-14 w-full items-center justify-between border-b border-border bg-card/95 px-4 backdrop-blur-sm sm:px-6">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setIsMobileNavOpen(true)}
              className="lg:hidden flex h-8 w-8 items-center justify-center rounded-lg border border-border bg-recessed text-content-secondary hover:text-foreground transition-colors"
              aria-label="Mở danh mục điều hướng"
            >
              <Menu className="h-4 w-4" />
            </button>

            {/* Breadcrumb Navigation */}
            <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-xs text-content-muted overflow-hidden">
              <span className="hidden sm:inline">Quản trị</span>
              <ChevronRight className="hidden sm:inline h-3 w-3 shrink-0 text-content-muted/60" />
              <span className="font-semibold text-content-primary truncate">
                {currentSectionLabel}
              </span>
            </nav>
          </div>

          {/* Right Header: Security Badge & Logout */}
          <div className="flex items-center gap-2.5 shrink-0">
            <div className="hidden sm:flex items-center gap-1.5 text-xs text-content-muted pr-2 border-r border-border/80">
              <ShieldCheck className="h-3.5 w-3.5 text-emerald-400" />
              <span className="font-medium text-[11px]">Xác thực Server</span>
            </div>

            <Button
              type="button"
              variant="ghost"
              size="compact"
              onClick={onLogout}
              disabled={isLoggingOut}
              className="gap-1.5 text-xs text-content-secondary hover:text-rose-300 hover:bg-rose-500/10 transition-colors"
              title="Đăng xuất khỏi phiên quản trị"
              aria-label="Đăng xuất"
            >
              <LogOut className="h-3.5 w-3.5" />
              <span>{isLoggingOut ? 'Đang thoát...' : 'Đăng xuất'}</span>
            </Button>
          </div>
        </header>

        {logoutError && (
          <div
            role="alert"
            className="mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8 pt-3 text-xs text-rose-300"
          >
            {logoutError}
          </div>
        )}

        {/* Content Body */}
        <main className="flex-1 flex flex-col">{children}</main>

        <footer className="border-t border-border/60 bg-canvas/80 py-3.5 text-center text-xs text-content-muted">
          <p>QuizVibe AI Studio &copy; 2026 &mdash; Hệ thống Quản trị Chiến dịch Minigame Tương Tác</p>
        </footer>
      </div>
    </div>
  );
};
