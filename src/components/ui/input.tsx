import React from 'react';
import { cn } from '../../lib/utils';

export type InputVariant = 'default' | 'player';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  variant?: InputVariant;
  tabularNums?: boolean;
}

const inputVariantStyles: Record<InputVariant, string> = {
  default:
    'h-10 rounded-admin border border-input bg-recessed px-3 py-2 text-sm leading-snug shadow-inset-well',
  player:
    'h-12 rounded-xl border-2 border-border-tactile bg-recessed px-4 py-2.5 text-base leading-snug shadow-inset-well',
};

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type = 'text', variant = 'default', tabularNums = false, ...props }, ref) => {
    return (
      <input
        type={type}
        ref={ref}
        className={cn(
          'flex w-full text-foreground ring-offset-background',
          'file:border-0 file:bg-transparent file:text-sm file:font-medium',
          'placeholder:text-content-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:border-primary',
          'disabled:cursor-not-allowed disabled:opacity-50 transition-colors duration-150',
          inputVariantStyles[variant],
          tabularNums && 'tabular-nums',
          className
        )}
        {...props}
      />
    );
  }
);

Input.displayName = 'Input';
