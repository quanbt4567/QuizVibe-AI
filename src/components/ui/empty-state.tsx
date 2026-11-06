import React from 'react';
import { Button } from './button';
import { cn } from '../../lib/utils';

export interface EmptyStateAction {
  label: string;
  onClick: () => void;
  icon?: React.ReactNode;
  variant?: 'primary' | 'secondary';
  disabled?: boolean;
}

export interface EmptyStateProps extends React.HTMLAttributes<HTMLDivElement> {
  title: string;
  description?: string;
  icon?: React.ReactNode;
  action?: EmptyStateAction;
  secondaryAction?: EmptyStateAction;
}

/**
 * Standardized empty state component inspired by Blocks.so and Origin UI.
 * Provides clear visual anchoring, descriptive guidance, and immediate recovery actions.
 */
export const EmptyState: React.FC<EmptyStateProps> = ({
  title,
  description,
  icon,
  action,
  secondaryAction,
  className,
  ...props
}) => {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center text-center p-8 sm:p-12 rounded-xl border border-dashed border-border/80 bg-card/30',
        className
      )}
      {...props}
    >
      {icon && (
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-border bg-recessed text-content-muted mb-4 shadow-sm">
          {icon}
        </div>
      )}

      <h3 className="text-base font-semibold text-content-primary mb-1.5 tracking-tight">
        {title}
      </h3>

      {description && (
        <p className="text-xs sm:text-sm text-content-secondary max-w-sm mb-6 leading-relaxed">
          {description}
        </p>
      )}

      {(action || secondaryAction) && (
        <div className="flex flex-wrap items-center justify-center gap-2.5">
          {action && (
            <Button
              type="button"
              variant={action.variant === 'secondary' ? 'tactile-secondary' : 'tactile-primary'}
              size="default"
              disabled={action.disabled}
              onClick={action.onClick}
              className="gap-2"
            >
              {action.icon}
              <span>{action.label}</span>
            </Button>
          )}

          {secondaryAction && (
            <Button
              type="button"
              variant="tactile-secondary"
              size="default"
              disabled={secondaryAction.disabled}
              onClick={secondaryAction.onClick}
              className="gap-2"
            >
              {secondaryAction.icon}
              <span>{secondaryAction.label}</span>
            </Button>
          )}
        </div>
      )}
    </div>
  );
};

