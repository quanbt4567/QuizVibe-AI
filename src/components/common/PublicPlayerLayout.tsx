import React from 'react';
import { Layers } from 'lucide-react';

export interface PublicPlayerLayoutProps {
  children: React.ReactNode;
  campaignTitle?: string;
}

/**
 * Public Player Layout (/quiz/:slug)
 * Strictly isolated from Admin Studio: contains zero Admin navigation links,
 * role switchers, or management controls.
 */
export const PublicPlayerLayout: React.FC<PublicPlayerLayoutProps> = ({
  children,
  campaignTitle,
}) => {
  return (
    <div
      data-testid="public-player-layout"
      className="min-h-screen bg-canvas text-foreground flex flex-col font-sans selection:bg-indigo-500 selection:text-white"
    >
      <header className="sticky top-0 z-50 w-full border-b border-border-subtle bg-canvas/90 backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-5xl items-center justify-between gap-2 px-4 sm:px-6">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-primary/30 bg-primary/15 text-primary shadow-key">
              <Layers className="h-4 w-4" />
            </div>

            <div className="flex items-center gap-2 min-w-0">
              <span className="text-sm sm:text-base font-bold tracking-tight text-foreground whitespace-nowrap">
                QuizVibe <span className="text-primary">AI</span>
              </span>

            </div>
          </div>

          {campaignTitle && (
            <span className="hidden sm:inline-block text-xs text-content-secondary truncate max-w-[280px]">
              {campaignTitle}
            </span>
          )}
        </div>
      </header>

      <main className="flex-1 flex flex-col justify-center">{children}</main>

      <footer className="border-t border-border-subtle bg-canvas/80 py-4 text-center text-xs text-content-muted">
        <p>QuizVibe AI &copy; 2026 &mdash; Minigame Trắc nghiệm Tương tác</p>
      </footer>
    </div>
  );
};

