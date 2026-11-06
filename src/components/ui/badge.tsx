import React from 'react';
import { cn } from '../../lib/utils';

export type BadgeVariant =
  | 'default'
  | 'secondary'
  | 'outline'
  | 'destructive'
  | 'success'
  | 'warning'
  | 'muted';

export type BadgeShape = 'pill' | 'compact';

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: BadgeVariant;
  shape?: BadgeShape;
  tabularNums?: boolean;
}

const badgeVariants: Record<BadgeVariant, string> = {
  default:
    'bg-primary/15 text-indigo-300 border border-primary/30',
  secondary:
    'bg-recessed text-content-primary border border-border-subtle',
  outline:
    'bg-transparent text-foreground border border-border-subtle',
  destructive:
    'bg-destructive/15 text-rose-300 border border-destructive/30',
  success:
    'bg-success/15 text-emerald-300 border border-success/30',
  warning:
    'bg-warning/15 text-amber-300 border border-warning/30',
  muted:
    'bg-recessed/80 text-content-muted border border-border-subtle',
};

const badgeShapes: Record<BadgeShape, string> = {
  pill: 'rounded-full px-2.5 py-0.5',
  compact: 'rounded-md px-2 py-0.5',
};

export const Badge: React.FC<BadgeProps> = ({
  className,
  variant = 'default',
  shape = 'pill',
  tabularNums = false,
  children,
  ...props
}) => {
  return (
    <div
      className={cn(
        'inline-flex items-center text-xs font-semibold leading-snug transition-colors',
        badgeShapes[shape],
        badgeVariants[variant],
        tabularNums && 'tabular-nums',
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
};
