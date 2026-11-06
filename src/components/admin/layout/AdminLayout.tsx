import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { AdminSidebar } from './AdminSidebar';
import { AdminHeader, BreadcrumbItem } from './AdminHeader';
import { cn } from '../../../lib/utils';

export interface AdminLayoutProps {
  children: React.ReactNode;
  activeSection: 'overview' | 'campaigns' | 'leads' | 'vouchers';
  onNavigate: (path: string) => void;
  breadcrumbs?: BreadcrumbItem[];
  activeCampaignTitle?: string;
  activeCampaignStatus?: string;
  publicQuizSlug?: string;
  leadCount?: number;
  campaignCount?: number;
  onLogout?: () => void;
  className?: string;
}

export const AdminLayout: React.FC<AdminLayoutProps> = ({
  children,
  activeSection,
  onNavigate,
  breadcrumbs,
  activeCampaignTitle,
  activeCampaignStatus,
  publicQuizSlug,
  leadCount,
  campaignCount,
  onLogout,
  className,
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
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isMobileNavOpen]);

  return (
    <div className="flex min-h-screen w-full bg-canvas text-foreground selection:bg-indigo-500 selection:text-white">
      {/* 1. Desktop Sidebar (>= lg) */}
      <div className="hidden lg:flex shrink-0">
        <AdminSidebar
          activeSection={activeSection}
          onNavigate={onNavigate}
          isCollapsed={isCollapsed}
          onToggleCollapse={handleToggleCollapse}
          leadCount={leadCount}
          campaignCount={campaignCount}
          publicQuizSlug={publicQuizSlug}
        />
      </div>

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

            <AdminSidebar
              activeSection={activeSection}
              onNavigate={(path) => {
                onNavigate(path);
                setIsMobileNavOpen(false);
              }}
              isCollapsed={false}
              onToggleCollapse={() => {}}
              leadCount={leadCount}
              campaignCount={campaignCount}
              publicQuizSlug={publicQuizSlug}
            />
          </div>
        </div>
      )}

      {/* 3. Main Workspace Area */}
      <div className="flex flex-1 flex-col min-w-0 overflow-y-auto">
        <AdminHeader
          breadcrumbs={breadcrumbs}
          activeCampaignTitle={activeCampaignTitle}
          activeCampaignStatus={activeCampaignStatus}
          onOpenMobileNav={() => setIsMobileNavOpen(true)}
          onLogout={onLogout}
        />

        <main className={cn('flex-1 px-4 py-6 sm:px-6 lg:px-8', className)}>
          {children}
        </main>
      </div>
    </div>
  );
};
