import React, { useEffect } from 'react';
import {
  LayoutDashboard,
  Layers,
  Users,
  Ticket,
  PanelLeftClose,
  PanelLeftOpen,
  ExternalLink,
} from 'lucide-react';
import { cn } from '../../../lib/utils';
import { Badge } from '../../ui/badge';

export interface AdminSidebarProps {
  activeSection: 'overview' | 'campaigns' | 'leads' | 'vouchers';
  onNavigate: (path: string) => void;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  leadCount?: number;
  campaignCount?: number;
  publicQuizSlug?: string;
}

interface NavItem {
  key: 'overview' | 'campaigns' | 'leads' | 'vouchers';
  label: string;
  path: string;
  icon: React.ComponentType<{ className?: string }>;
  count?: number;
}

export const AdminSidebar: React.FC<AdminSidebarProps> = ({
  activeSection,
  onNavigate,
  isCollapsed,
  onToggleCollapse,
  leadCount,
  campaignCount,
  publicQuizSlug,
}) => {
  // Keyboard shortcut (Cmd/Ctrl + B) to toggle sidebar
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'b') {
        e.preventDefault();
        onToggleCollapse();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onToggleCollapse]);

  const navItems: NavItem[] = [
    {
      key: 'overview',
      label: 'Tổng quan',
      path: '/admin',
      icon: LayoutDashboard,
    },
    {
      key: 'campaigns',
      label: 'Chiến dịch',
      path: '/admin/campaigns',
      icon: Layers,
      count: campaignCount,
    },
    {
      key: 'leads',
      label: 'Khách hàng (Leads)',
      path: '/admin/leads',
      icon: Users,
      count: leadCount,
    },
    {
      key: 'vouchers',
      label: 'Cấu hình Voucher',
      path: '/admin/vouchers',
      icon: Ticket,
    },
  ];

  return (
    <aside
      className={cn(
        'relative flex flex-col justify-between border-r border-border bg-card transition-all duration-200 select-none z-30 shrink-0',
        isCollapsed ? 'w-16' : 'w-64'
      )}
      aria-label="Thanh điều hướng chính"
    >
      {/* Top Branding Section */}
      <div>
        <div className="flex h-14 items-center justify-between px-3.5 border-b border-border/80">
          {!isCollapsed ? (
            <div
              onClick={() => onNavigate('/admin')}
              className="flex items-center gap-2.5 cursor-pointer min-w-0"
            >
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground font-extrabold text-sm shadow-sm">
                QV
              </div>
              <div className="min-w-0">
                <span className="block text-sm font-bold tracking-tight text-foreground truncate">
                  QuizVibe AI
                </span>
                <span className="block text-[10px] text-content-muted tracking-wider uppercase font-semibold">
                  Admin Console
                </span>
              </div>
            </div>
          ) : (
            <div
              onClick={() => onNavigate('/admin')}
              className="mx-auto flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground font-extrabold text-sm cursor-pointer shadow-sm"
              title="QuizVibe AI Admin"
            >
              QV
            </div>
          )}

          {!isCollapsed && (
            <button
              type="button"
              onClick={onToggleCollapse}
              className="flex h-7 w-7 items-center justify-center rounded-md text-content-muted hover:bg-interactive hover:text-foreground transition-colors"
              title="Thu gọn thanh bên (Ctrl+B)"
              aria-label="Thu gọn thanh bên"
            >
              <PanelLeftClose className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* Navigation Item List */}
        <nav className="p-2 space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeSection === item.key;

            return (
              <button
                key={item.key}
                type="button"
                onClick={() => onNavigate(item.path)}
                className={cn(
                  'group relative flex w-full items-center rounded-lg text-xs font-medium transition-all duration-150',
                  isCollapsed ? 'justify-center h-10 px-0' : 'gap-3 px-3 py-2.5',
                  isActive
                    ? 'bg-interactive text-foreground font-semibold shadow-key border border-border-tactile/60'
                    : 'text-content-secondary hover:bg-interactive/40 hover:text-foreground'
                )}
                title={isCollapsed ? item.label : undefined}
                aria-current={isActive ? 'page' : undefined}
              >
                <Icon
                  className={cn(
                    'h-4 w-4 shrink-0 transition-colors',
                    isActive ? 'text-primary' : 'text-content-muted group-hover:text-foreground'
                  )}
                />

                {!isCollapsed && (
                  <span className="truncate flex-1 text-left">{item.label}</span>
                )}

                {!isCollapsed && typeof item.count === 'number' && (
                  <Badge
                    variant={isActive ? 'default' : 'secondary'}
                    shape="compact"
                    tabularNums
                    className="font-mono text-[10px] ml-auto shrink-0"
                  >
                    {item.count}
                  </Badge>
                )}

                {/* Left Active Pillar Indicator */}
                {isActive && (
                  <span className="absolute left-0 top-1.5 bottom-1.5 w-1 rounded-r bg-primary" />
                )}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Bottom Footer Section */}
      <div className="p-2 border-t border-border/80 space-y-1">
        {publicQuizSlug && (
          <a
            href={`/quiz/${encodeURIComponent(publicQuizSlug)}`}
            target="_blank"
            rel="noopener noreferrer"
            className={cn(
              'group flex w-full items-center rounded-lg text-xs text-content-muted hover:bg-interactive hover:text-foreground transition-colors',
              isCollapsed ? 'justify-center h-10' : 'gap-2.5 px-3 py-2'
            )}
            title={isCollapsed ? 'Mở trang chơi minigame' : undefined}
          >
            <ExternalLink className="h-3.5 w-3.5 shrink-0" />
            {!isCollapsed && <span className="truncate">Xem giao diện người chơi</span>}
          </a>
        )}

        {isCollapsed && (
          <button
            type="button"
            onClick={onToggleCollapse}
            className="flex h-10 w-full items-center justify-center rounded-lg text-content-muted hover:bg-interactive hover:text-foreground transition-colors"
            title="Mở rộng thanh bên (Ctrl+B)"
            aria-label="Mở rộng thanh bên"
          >
            <PanelLeftOpen className="h-4 w-4" />
          </button>
        )}
      </div>
    </aside>
  );
};

