import React, { useEffect, useState, useRef } from 'react';
import {
  Trophy,
  X,
  Clock,
  Info,
  UserCheck,
  Award,
} from 'lucide-react';
import { LeaderboardEntry } from '../../types';
import { StorageService } from '../../services';
import { maskPhoneNumber } from '../../services/validators';
import { playerApi } from '../../services/playerApi';
import { Button } from '../ui/button';

export interface LeaderboardModalProps {
  isOpen: boolean;
  onClose: () => void;
  campaignTitle?: string;
  campaignSlug?: string;
  highlightLeadId?: string;
  currentLeadRank?: number;
  /**
   * Optional injected entries for unit testing or controlled display.
   * If omitted, entries are fetched fresh from StorageService.getLeaderboard().
   */
  initialEntries?: LeaderboardEntry[];
}

/**
 * Top 10 Leaderboard Modal (Story 4.4, FR-401, FR-402, UX-DR5).
 * Mobile-first, gated leaderboard showing top verified leads with deterministic ranking,
 * complete with WAI-ARIA accessibility, focus management, focus trap, and body scroll lock.
 */
export const LeaderboardModal: React.FC<LeaderboardModalProps> = ({
  isOpen,
  onClose,
  campaignTitle,
  campaignSlug,
  highlightLeadId,
  currentLeadRank,
  initialEntries,
}) => {
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const modalRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const previouslyFocusedElementRef = useRef<HTMLElement | null>(null);

  // Fetch or update entries whenever modal is opened
  useEffect(() => {
    if (isOpen) {
      if (initialEntries) {
        setEntries(initialEntries.slice(0, 10));
      } else if (campaignSlug) {
        playerApi
          .fetchLeaderboard(campaignSlug)
          .then((items) => {
            setEntries(
              items.map((item) => ({
                id: `entry_${item.rank}`,
                leadId: `lead_${item.rank}`,
                fullName: item.fullName,
                phoneNumber: item.maskedPhone,
                maskedPhone: item.maskedPhone,
                score: item.score,
                timeTakenSeconds: item.timeTakenSeconds,
                rank: item.rank,
                submittedAt: item.submittedAt,
              }))
            );
          })
          .catch(() => {
            const res = StorageService.getLeaderboard();
            setEntries((res.data || []).slice(0, 10));
          });
      } else {
        const res = StorageService.getLeaderboard();
        setEntries((res.data || []).slice(0, 10));
      }
    }
  }, [isOpen, initialEntries, campaignSlug]);

  // Focus management, focus trap, body scroll lock, and ESC handler
  useEffect(() => {
    if (!isOpen) return;

    // 1. Save currently focused element to restore when closing
    previouslyFocusedElementRef.current = document.activeElement as HTMLElement | null;

    // 2. Lock body scroll
    const previousBodyOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    // 3. Move initial focus into the modal
    const focusTimer = setTimeout(() => {
      closeButtonRef.current?.focus();
    }, 50);

    // 4. Keyboard handlers: Escape to close, Tab for focus trapping
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
        return;
      }

      if (e.key === 'Tab' && modalRef.current) {
        const focusableSelectors = 'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';
        const focusables = Array.from(
          modalRef.current.querySelectorAll<HTMLElement>(focusableSelectors)
        ).filter((el) => !el.hasAttribute('disabled') && el.offsetParent !== null);

        if (focusables.length === 0) {
          e.preventDefault();
          return;
        }

        const firstEl = focusables[0];
        const lastEl = focusables[focusables.length - 1];

        if (e.shiftKey) {
          if (document.activeElement === firstEl || !modalRef.current.contains(document.activeElement)) {
            e.preventDefault();
            lastEl.focus();
          }
        } else {
          if (document.activeElement === lastEl || !modalRef.current.contains(document.activeElement)) {
            e.preventDefault();
            firstEl.focus();
          }
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      clearTimeout(focusTimer);
      window.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = previousBodyOverflow;
      // Return focus to trigger element
      if (previouslyFocusedElementRef.current && typeof previouslyFocusedElementRef.current.focus === 'function') {
        previouslyFocusedElementRef.current.focus();
      }
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  // Tactile Rank Badges for Top 3 and #4–#10
  const getRankBadge = (rank: number) => {
    switch (rank) {
      case 1:
        return (
          <span
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border-2 border-amber-400 border-b-4 border-b-amber-700 bg-amber-500 text-slate-950 font-mono tabular-nums font-black text-xs"
            title="Hạng Nhất - Huy chương Vàng"
            aria-label="Hạng 1, Huy chương Vàng"
          >
            #1
          </span>
        );
      case 2:
        return (
          <span
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border-2 border-slate-300 border-b-4 border-b-slate-600 bg-slate-200 text-slate-950 font-mono tabular-nums font-black text-xs"
            title="Hạng Nhì - Huy chương Bạc"
            aria-label="Hạng 2, Huy chương Bạc"
          >
            #2
          </span>
        );
      case 3:
        return (
          <span
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border-2 border-amber-600 border-b-4 border-b-amber-900 bg-amber-700 text-amber-50 font-mono tabular-nums font-black text-xs"
            title="Hạng Ba - Huy chương Đồng"
            aria-label="Hạng 3, Huy chương Đồng"
          >
            #3
          </span>
        );
      default:
        return (
          <span
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-border-tactile bg-card font-mono tabular-nums font-bold text-xs text-content-secondary"
            aria-label={`Hạng ${rank}`}
          >
            #{rank}
          </span>
        );
    }
  };

  const getRowStyle = (rank: number, isHighlighted: boolean) => {
    if (isHighlighted) {
      return 'border-2 border-primary bg-primary/15 ring-1 ring-primary/40 text-foreground';
    }
    switch (rank) {
      case 1:
        return 'border border-amber-500/45 bg-amber-500/10 text-foreground';
      case 2:
        return 'border border-slate-400/35 bg-recessed text-foreground';
      case 3:
        return 'border border-amber-700/45 bg-recessed text-foreground';
      default:
        return 'border border-border-subtle bg-recessed/75 text-foreground/90';
    }
  };

  const isPlayerInTop10 = Boolean(highlightLeadId && entries.some((e) => e.leadId === highlightLeadId));

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-canvas/85 p-3.5 sm:p-4 backdrop-blur-sm animate-fadeIn"
      role="dialog"
      aria-modal="true"
      aria-labelledby="leaderboard-modal-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={modalRef}
        className="relative flex max-h-[90vh] w-full max-w-[460px] flex-col overflow-hidden rounded-2xl border-2 border-border-tactile bg-card shadow-player-card animate-scaleUp"
      >
        {/* Header */}
        <div className="flex items-start justify-between border-b border-border-subtle p-4 sm:p-5">
          <div className="flex items-center gap-3 min-w-0">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border-2 border-amber-500/40 border-b-4 border-b-amber-700/60 bg-amber-500/15 text-amber-400">
              <Trophy className="h-5 w-5" />
            </div>
            <div className="min-w-0 space-y-0.5">
              <h3
                id="leaderboard-modal-title"
                className="text-base sm:text-lg font-extrabold tracking-tight text-foreground"
              >
                Bảng Xếp Hạng Top 10
              </h3>
              <p className="text-xs text-content-secondary truncate">
                {campaignTitle ? `Chiến dịch: ${campaignTitle}` : 'Những cao thủ có điểm số & tốc độ cao nhất'}
              </p>
            </div>
          </div>

          <button
            ref={closeButtonRef}
            type="button"
            onClick={onClose}
            className="flex min-h-[40px] min-w-[40px] shrink-0 items-center justify-center rounded-xl border border-border-subtle bg-recessed p-2 text-content-secondary hover:text-foreground hover:bg-interactive transition-colors focus:outline-none focus:ring-2 focus:ring-primary"
            aria-label="Đóng bảng xếp hạng"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">
          {/* Notice when current player is outside the Top 10 */}
          {highlightLeadId && !isPlayerInTop10 && (
            <div className="rounded-xl border border-primary/40 bg-primary/10 p-3 sm:p-3.5 text-xs text-primary-200 space-y-1">
              <div className="flex items-center gap-1.5 font-bold text-foreground">
                <Trophy className="w-4 h-4 text-amber-400 shrink-0" />
                <span className="tabular-nums">
                  Thứ hạng của bạn: #{currentLeadRank || 'Ngoài Top 10'}
                </span>
              </div>
              <p className="text-[11px] text-content-secondary leading-snug">
                Bạn chưa lọt vào danh sách Top 10 cao thủ. Hãy bấm &quot;Chơi lại&quot; để cải thiện tốc độ và điểm số!
              </p>
            </div>
          )}

          {entries.length === 0 ? (
            /* Empty State: Clean Podium State (UX-DR5) */
            <div className="py-8 sm:py-10 text-center space-y-3.5">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl border-2 border-amber-500/30 border-b-4 border-b-amber-700/50 bg-recessed text-amber-400">
                <Award className="h-8 w-8" />
              </div>

              <div className="space-y-1 max-w-xs mx-auto">
                <h4 className="text-base font-bold text-foreground">Chưa có ai ghi danh!</h4>
                <p className="text-xs text-content-secondary leading-relaxed">
                  Hãy là người đầu tiên vượt qua thử thách để nhận vị trí số 1 trên Bảng xếp hạng!
                </p>
              </div>
            </div>
          ) : (
            /* Top 10 Entries List */
            <div className="space-y-2" role="list" aria-label="Danh sách Top 10 cao thủ">
              {entries.map((entry, index) => {
                const rankNumber = entry.rank || index + 1;
                const isHighlighted = Boolean(highlightLeadId && entry.leadId === highlightLeadId);
                const safeMaskedPhone = entry.maskedPhone || maskPhoneNumber(entry.phoneNumber);

                return (
                  <div
                    key={entry.id || entry.leadId || index}
                    role="listitem"
                    className={`flex items-center justify-between gap-3 rounded-xl p-3 transition-colors ${getRowStyle(
                      rankNumber,
                      isHighlighted
                    )}`}
                  >
                    {/* Left: Rank badge + Name + Masked Phone */}
                    <div className="flex items-center gap-3 min-w-0">
                      {getRankBadge(rankNumber)}

                      <div className="min-w-0 space-y-0.5">
                        <div className="flex items-center gap-1.5">
                          <p className="text-xs sm:text-sm font-bold truncate text-foreground">
                            {entry.fullName || 'Người chơi ẩn danh'}
                          </p>
                          {isHighlighted && (
                            <span className="inline-flex items-center gap-0.5 rounded-full bg-primary/25 border border-primary/45 px-2 py-0.5 text-[10px] font-bold text-primary-200">
                              <UserCheck className="w-3 h-3" />
                              <span>Bạn</span>
                            </span>
                          )}
                        </div>

                        {safeMaskedPhone && (
                          <p className="font-mono tabular-nums text-[11px] text-content-secondary">
                            {safeMaskedPhone}
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Right: Score + Time */}
                    <div className="text-right shrink-0 space-y-0.5">
                      <p className="font-mono tabular-nums text-xs sm:text-sm font-black text-amber-400">
                        {entry.score.toLocaleString('vi-VN')}đ
                      </p>
                      <p className="font-mono tabular-nums text-[11px] text-content-secondary flex items-center justify-end gap-1">
                        <Clock className="w-3 h-3 text-primary-400" />
                        <span>{entry.timeTakenSeconds}s</span>
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Tie-breaking Criteria Note (EXPERIENCE.md) */}
          <div className="rounded-xl border border-border-subtle bg-recessed p-3 text-[11px] text-content-secondary space-y-1 leading-relaxed">
            <div className="flex items-center gap-1.5 font-bold text-foreground">
              <Info className="w-3.5 h-3.5 text-primary-400 shrink-0" />
              <span>Tiêu chí xếp hạng:</span>
            </div>
            <p className="pl-5 text-content-secondary">
              Điểm cao hơn xếp trước. Nếu bằng điểm, ai làm nhanh hơn (thời gian ít hơn) sẽ xếp trên. Nếu bằng cả điểm và thời gian, ai hoàn thành trước sẽ xếp trên.
            </p>
          </div>
        </div>

        {/* Footer Action */}
        <div className="border-t border-border-subtle p-4 bg-recessed/50">
          <Button
            type="button"
            variant="tactile-secondary"
            size="lg"
            onClick={onClose}
            className="w-full text-xs sm:text-sm font-bold"
          >
            Đóng
          </Button>
        </div>
      </div>
    </div>
  );
};

export default LeaderboardModal;
