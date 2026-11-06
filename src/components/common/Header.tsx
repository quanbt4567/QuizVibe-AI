import React from 'react';
import { Gamepad2, SlidersHorizontal, Zap } from 'lucide-react';
import { AppView } from '../../types';
import { Badge } from '../ui';

interface HeaderProps {
  currentView: AppView;
  onViewChange: (view: AppView) => void;
}

export const Header: React.FC<HeaderProps> = ({ currentView, onViewChange }) => {
  return (
    <header className="sticky top-0 z-50 w-full border-b border-border-subtle bg-canvas/90 backdrop-blur-md">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-2 px-3 sm:px-6 lg:px-8">
        {/* Brand Identity */}
        <div className="flex items-center gap-2.5 shrink-0">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-primary/30 bg-primary/15 text-primary shadow-key">
            <Zap className="h-4 w-4" />
          </div>

          <div className="flex items-center gap-2">
            <span className="text-sm sm:text-base font-bold tracking-tight text-foreground whitespace-nowrap">
              QuizVibe <span className="text-primary">AI</span>
            </span>

            <Badge
              variant={currentView === 'admin' ? 'default' : 'muted'}
              shape="compact"
              className="hidden sm:inline-flex font-mono text-[10px] uppercase tracking-wider shrink-0"
            >
              {currentView === 'admin' ? 'STUDIO' : 'PLAYER'}
            </Badge>

            <span className="hidden lg:inline-block text-xs text-content-muted border-l border-border-subtle pl-2.5 whitespace-nowrap">
              Minigame Quiz thu lead Fanpage
            </span>
          </div>
        </div>

        {/* Compact Segmented View Switcher */}
        <nav
          aria-label="Role Switcher"
          className="inline-flex items-center rounded-lg border border-border-subtle bg-recessed p-1 shadow-inset-well shrink-0"
        >
          <button
            type="button"
            onClick={() => onViewChange('player')}
            aria-pressed={currentView === 'player'}
            className={`inline-flex items-center gap-1.5 rounded-md px-2 sm:px-3 py-1 text-[11px] sm:text-xs font-medium whitespace-nowrap leading-snug transition-all duration-150 cursor-pointer ${
              currentView === 'player'
                ? 'border border-border-subtle/80 bg-interactive text-foreground font-semibold shadow-key'
                : 'border border-transparent text-content-secondary hover:text-foreground hover:bg-interactive/50'
            }`}
          >
            <Gamepad2 className="h-3.5 w-3.5 shrink-0 text-primary" />
            <span>
              <span className="hidden sm:inline">Màn hình </span>Người chơi
            </span>
          </button>

          <button
            type="button"
            onClick={() => onViewChange('admin')}
            aria-pressed={currentView === 'admin'}
            className={`inline-flex items-center gap-1.5 rounded-md px-2 sm:px-3 py-1 text-[11px] sm:text-xs font-medium whitespace-nowrap leading-snug transition-all duration-150 cursor-pointer ${
              currentView === 'admin'
                ? 'border border-border-subtle/80 bg-interactive text-foreground font-semibold shadow-key'
                : 'border border-transparent text-content-secondary hover:text-foreground hover:bg-interactive/50'
            }`}
          >
            <SlidersHorizontal className="h-3.5 w-3.5 shrink-0 text-primary" />
            <span>Quản trị viên</span>
          </button>
        </nav>
      </div>
    </header>
  );
};
