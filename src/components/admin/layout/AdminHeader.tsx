import React from 'react';
import {
  Menu,
  LogOut,
  ChevronRight,
  ShieldCheck,
  Layers,
} from 'lucide-react';
import { Badge } from '../../ui/badge';
import { Button } from '../../ui/button';

export interface BreadcrumbItem {
  label: string;
  href?: string;
  onClick?: () => void;
}

export interface AdminHeaderProps {
  breadcrumbs?: BreadcrumbItem[];
  activeCampaignTitle?: string;
  activeCampaignStatus?: string;
  onOpenMobileNav: () => void;
  onLogout?: () => void;
}

export const AdminHeader: React.FC<AdminHeaderProps> = ({
  breadcrumbs = [{ label: 'Quản trị' }],
  activeCampaignTitle,
  activeCampaignStatus,
  onOpenMobileNav,
  onLogout,
}) => {
  return (
    <header className="sticky top-0 z-20 flex h-14 w-full items-center justify-between border-b border-border bg-card/95 px-4 backdrop-blur-sm sm:px-6">
      {/* Left Area: Mobile Menu Trigger & Breadcrumbs */}
      <div className="flex items-center gap-3 min-w-0">
        <button
          type="button"
          onClick={onOpenMobileNav}
          className="lg:hidden flex h-8 w-8 items-center justify-center rounded-lg border border-border bg-recessed text-content-secondary hover:text-foreground transition-colors"
          aria-label="Mở danh mục điều hướng"
        >
          <Menu className="h-4 w-4" />
        </button>

        {/* Breadcrumb Trail */}
        <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-xs text-content-muted overflow-hidden">
          {breadcrumbs.map((crumb, idx) => {
            const isLast = idx === breadcrumbs.length - 1;

            return (
              <React.Fragment key={idx}>
                {idx > 0 && <ChevronRight className="h-3 w-3 shrink-0 text-content-muted/60" />}
                {isLast ? (
                  <span className="font-semibold text-content-primary truncate max-w-[140px] sm:max-w-[200px]">
                    {crumb.label}
                  </span>
                ) : crumb.onClick ? (
                  <button
                    type="button"
                    onClick={crumb.onClick}
                    className="hover:text-content-primary truncate transition-colors"
                  >
                    {crumb.label}
                  </button>
                ) : (
                  <span className="truncate">{crumb.label}</span>
                )}
              </React.Fragment>
            );
          })}
        </nav>
      </div>

      {/* Right Area: Active Campaign Pill & User Logout */}
      <div className="flex items-center gap-2.5 shrink-0">
        {activeCampaignTitle && (
          <div className="hidden md:flex items-center gap-2 rounded-lg border border-border/80 bg-recessed/80 px-2.5 py-1 text-xs">
            <Layers className="h-3.5 w-3.5 text-primary shrink-0" />
            <span className="text-content-muted">Chiến dịch:</span>
            <span className="font-semibold text-content-primary max-w-[180px] truncate">
              {activeCampaignTitle}
            </span>
            {activeCampaignStatus && (
              <Badge
                variant={activeCampaignStatus === 'published' ? 'success' : 'secondary'}
                shape="compact"
                className="text-[10px] uppercase font-mono tracking-wider ml-1"
              >
                {activeCampaignStatus}
              </Badge>
            )}
          </div>
        )}

        {/* Admin Session Badge & Logout Trigger */}
        <div className="flex items-center gap-2 pl-2 border-l border-border/80">
          <div className="hidden sm:flex items-center gap-1.5 text-xs text-content-muted">
            <ShieldCheck className="h-3.5 w-3.5 text-emerald-400" />
            <span className="font-medium text-[11px]">Admin Authenticated</span>
          </div>

          {onLogout && (
            <Button
              type="button"
              variant="ghost"
              size="compact"
              onClick={onLogout}
              className="gap-1.5 text-xs text-content-secondary hover:text-rose-300 hover:bg-rose-500/10 transition-colors"
              title="Đăng xuất khỏi phiên quản trị"
              aria-label="Đăng xuất"
            >
              <LogOut className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Đăng xuất</span>
            </Button>
          )}
        </div>
      </div>
    </header>
  );
};
