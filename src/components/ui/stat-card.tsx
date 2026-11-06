import React from 'react';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { cn } from '../../lib/utils';

export interface StatTrend {
  value: string | number;
  direction?: 'up' | 'down' | 'neutral';
  label?: string;
}

export interface StatCardProps extends React.HTMLAttributes<HTMLDivElement> {
  title: string;
  value: string | number;
  icon?: React.ReactNode;
  trend?: StatTrend;
  subtitle?: string;
  onClick?: () => void;
}

/**
 * Enterprise-grade KPI metric card inspired by Blocks.so stats blocks.
 * Enforces tabular numerals, high contrast ratio, and clear trend signal.
 */
export const StatCard: React.FC<StatCardProps> = ({
  title,
  value,
  icon,
  trend,
  subtitle,
  onClick,
  className,
  ...props
}) => {
  const isClickable = Boolean(onClick);

  return (
    <div
      onClick={onClick}
      role={isClickable ? 'button' : undefined}
      tabIndex={isClickable ? 0 : undefined}
      onKeyDown={
        isClickable
          ? (e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onClick?.();
              }
            }
          : undefined
      }
      className={cn(
        'group relative flex flex-col justify-between rounded-xl border border-border bg-card p-4 sm:p-5 transition-all duration-150',
        'shadow-key',
        isClickable &&
          'cursor-pointer hover:border-border-tactile hover:bg-card/90 active:translate-y-[1px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
        className
      )}
      {...props}
    >
      {/* Top Header Row */}
      <div className="flex items-center justify-between gap-3 mb-2">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-content-secondary line-clamp-1">
          {title}
        </span>
        {icon && (
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-border bg-recessed text-content-muted transition-colors group-hover:text-primary-300">
            {icon}
          </div>
        )}
      </div>

      {/* Primary Value Row */}
      <div className="my-1">
        <span className="font-mono text-2xl sm:text-3xl font-bold tracking-tight text-content-primary tabular-nums">
          {value}
        </span>
      </div>

      {/* Trend or Subtitle Footer */}
      {(trend || subtitle) && (
        <div className="mt-2.5 flex flex-wrap items-center gap-2 pt-2 border-t border-border/40 text-xs">
          {trend && (
            <span
              className={cn(
                'inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 font-mono text-[11px] font-semibold tabular-nums border',
                trend.direction === 'up' &&
                  'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
                trend.direction === 'down' &&
                  'bg-rose-500/15 text-rose-300 border-rose-500/30',
                (!trend.direction || trend.direction === 'neutral') &&
                  'bg-slate-500/15 text-slate-300 border-slate-500/30'
              )}
            >
              {trend.direction === 'up' && <TrendingUp className="h-3 w-3" />}
              {trend.direction === 'down' && <TrendingDown className="h-3 w-3" />}
              {(!trend.direction || trend.direction === 'neutral') && (
                <Minus className="h-3 w-3" />
              )}
              <span>{trend.value}</span>
            </span>
          )}

          {(trend?.label || subtitle) && (
            <span className="text-[11px] text-content-muted line-clamp-1">
              {trend?.label || subtitle}
            </span>
          )}
        </div>
      )}
    </div>
  );
};

