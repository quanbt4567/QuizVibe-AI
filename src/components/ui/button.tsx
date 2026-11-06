import React from 'react';
import { Loader2 } from 'lucide-react';
import { cn } from '../../lib/utils';

export type ButtonVariant =
  | 'default'
  | 'secondary'
  | 'outline'
  | 'ghost'
  | 'destructive'
  | 'success'
  | 'tactile-primary'
  | 'tactile-success'
  | 'tactile-secondary'
  | 'tactile-choice';

export type ButtonSize = 'default' | 'compact' | 'sm' | 'lg' | 'xl' | 'icon';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  isLoading?: boolean;
}

const variantStyles: Record<ButtonVariant, string> = {
  // Admin & Shared Standard Variants (Raycast / Linear precision)
  default:
    'bg-primary text-primary-foreground border border-primary/80 shadow-key hover:bg-primary-600 focus-visible:ring-primary active:scale-[0.99]',
  secondary:
    'bg-secondary text-secondary-foreground border border-border-subtle shadow-key hover:bg-interactive hover:border-border-tactile hover:text-foreground active:scale-[0.99]',
  outline:
    'border border-border-subtle bg-transparent text-foreground hover:bg-interactive hover:border-border-tactile hover:text-accent-foreground active:scale-[0.99]',
  ghost:
    'border border-transparent bg-transparent text-content-secondary hover:bg-interactive hover:text-foreground active:scale-[0.99]',
  destructive:
    'bg-destructive text-destructive-foreground border border-destructive/80 shadow-sm hover:bg-destructive/90 active:scale-[0.99]',
  success:
    'bg-success text-success-foreground border border-success/80 shadow-sm hover:bg-success/90 active:scale-[0.99]',

  // Player Tactile 3D Variants (Duolingo #2 pressable bottom-lip mechanics)
  'tactile-primary':
    'bg-primary text-primary-foreground border-2 border-primary/90 border-b-4 border-b-primary-depth font-bold hover:brightness-105 active:translate-y-[2px] active:border-b-2',
  'tactile-success':
    'bg-success text-success-foreground border-2 border-success/90 border-b-4 border-b-success-depth font-bold hover:brightness-105 active:translate-y-[2px] active:border-b-2',
  'tactile-secondary':
    'bg-recessed text-foreground border-2 border-border-tactile border-b-4 border-b-border-tactile-depth font-semibold hover:bg-interactive active:translate-y-[2px] active:border-b-2',
  'tactile-choice':
    'bg-recessed text-foreground border-2 border-border-tactile border-b-4 border-b-border-tactile-depth text-left justify-start hover:bg-interactive hover:border-primary/60 active:translate-y-[2px] active:border-b-2',
};

const sizeStyles: Record<ButtonSize, string> = {
  default: 'h-10 rounded-admin px-4 py-2 text-sm leading-snug',
  compact: 'h-9 rounded-admin px-3.5 py-1.5 text-xs leading-snug',
  sm: 'h-8 rounded-admin px-3 py-1 text-xs leading-snug',
  lg: 'h-12 rounded-xl px-6 py-2.5 text-base font-semibold leading-snug', // >=48px Player touch target
  xl: 'min-h-[56px] rounded-xl px-5 py-3 text-base font-medium leading-snug', // Player answer choice card size
  icon: 'h-10 w-10 rounded-admin p-0',
};

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant = 'default',
      size = 'default',
      isLoading = false,
      disabled,
      children,
      ...props
    },
    ref
  ) => {
    return (
      <button
        ref={ref}
        disabled={disabled || isLoading}
        className={cn(
          'inline-flex items-center justify-center gap-2 font-medium transition-all duration-150',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ring-offset-background',
          'disabled:pointer-events-none disabled:opacity-50 select-none cursor-pointer',
          variantStyles[variant],
          sizeStyles[size],
          className
        )}
        {...props}
      >
        {isLoading && <Loader2 className="mr-2 h-4 w-4 shrink-0 animate-spin" />}
        {children}
      </button>
    );
  }
);

Button.displayName = 'Button';
