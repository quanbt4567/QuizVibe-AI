import React, { forwardRef } from 'react';
import { Search, X } from 'lucide-react';
import { cn } from '../../lib/utils';

export interface InputGroupProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
}

export const InputGroup: React.FC<InputGroupProps> = ({ children, className, ...props }) => {
  return (
    <div className={cn('relative flex items-center w-full', className)} {...props}>
      {children}
    </div>
  );
};

export interface InputAddonProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  placement?: 'left' | 'right';
}

export const InputAddon: React.FC<InputAddonProps> = ({
  children,
  placement = 'left',
  className,
  ...props
}) => {
  return (
    <div
      className={cn(
        'pointer-events-none absolute flex items-center text-content-muted text-xs',
        placement === 'left' ? 'left-3' : 'right-3',
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
};

export interface SearchInputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange'> {
  value: string;
  onChange: (value: string) => void;
  onClear?: () => void;
  shortcutBadge?: string;
}

/**
 * Enterprise Search Input inspired by Origin UI comp-01 to comp-10.
 * Includes leading search icon, instant clear button, and optional shortcut indicator.
 */
export const SearchInput = forwardRef<HTMLInputElement, SearchInputProps>(
  ({ value, onChange, onClear, shortcutBadge, placeholder = 'Tìm kiếm...', className, ...props }, ref) => {
    const handleClear = () => {
      onChange('');
      onClear?.();
    };

    return (
      <div className={cn('relative flex items-center w-full', className)}>
        <Search className="pointer-events-none absolute left-3 h-4 w-4 text-content-muted shrink-0" />

        <input
          ref={ref}
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className={cn(
            'w-full rounded-lg border border-border bg-recessed py-2 pl-9 pr-9 text-xs sm:text-sm text-content-primary',
            'placeholder:text-content-muted/60 transition-colors',
            'focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent',
            'disabled:cursor-not-allowed disabled:opacity-50'
          )}
          {...props}
        />

        {value ? (
          <button
            type="button"
            onClick={handleClear}
            className="absolute right-2.5 flex h-5 w-5 items-center justify-center rounded-md text-content-muted hover:bg-interactive hover:text-content-primary transition-colors focus:outline-none focus:ring-1 focus:ring-primary"
            aria-label="Xoá tìm kiếm"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        ) : shortcutBadge ? (
          <kbd className="pointer-events-none absolute right-2.5 hidden h-5 select-none items-center gap-1 rounded border border-border bg-card px-1.5 font-mono text-[10px] font-medium text-content-muted sm:inline-flex">
            {shortcutBadge}
          </kbd>
        ) : null}
      </div>
    );
  }
);

SearchInput.displayName = 'SearchInput';

