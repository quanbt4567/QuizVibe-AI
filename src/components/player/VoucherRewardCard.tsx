import React, { useState } from 'react';
import {
  Gift,
  Copy,
  Check,
  Clock,
  FileText,
  AlertCircle,
  HelpCircle,
  Trophy,
  Share2,
} from 'lucide-react';
import { VoucherConfig, Lead } from '../../types';
import { copyToClipboard, isVoucherExpired } from '../../services/clipboard';
import { maskPhoneNumber } from '../../services/validators';
import { Card } from '../ui/card';
import { Button } from '../ui/button';

export interface VoucherRewardCardProps {
  voucher: VoucherConfig | null | undefined;
  lead: Lead;
  rank?: number;
  onCopySuccess?: (code: string) => void;
  onViewLeaderboard?: () => void;
  onShare?: () => void;
  className?: string;
}

export const VoucherRewardCard: React.FC<VoucherRewardCardProps> = ({
  voucher,
  lead,
  rank,
  onCopySuccess,
  onViewLeaderboard,
  onShare,
  className = '',
}) => {
  const [copied, setCopied] = useState<boolean>(false);
  const [copyError, setCopyError] = useState<string | null>(null);

  // Missing or invalid voucher configuration
  if (!voucher || !voucher.code || typeof voucher.code !== 'string' || voucher.code.trim() === '') {
    return (
      <Card variant="player" className={`p-5 sm:p-6 text-center space-y-3 ${className}`}>
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl border border-amber-500/30 bg-amber-500/10 text-amber-400">
          <HelpCircle className="h-6 w-6" />
        </div>
        <h3 className="text-base font-bold text-foreground">Chưa có thông tin voucher</h3>
        <p className="text-xs text-content-secondary leading-relaxed max-w-sm mx-auto">
          Chiến dịch hiện tại chưa cấu hình mã voucher ưu đãi. Thông tin của bạn ({lead.fullName} &bull;{' '}
          <span className="font-mono tabular-nums">{maskPhoneNumber(lead.phoneNumber)}</span>) đã được ghi nhận trên hệ thống.
        </p>
      </Card>
    );
  }

  const expired = isVoucherExpired(voucher.expiryDate);

  const handleCopy = async () => {
    setCopyError(null);
    const result = await copyToClipboard(voucher.code);
    if (result.success) {
      setCopied(true);
      onCopySuccess?.(voucher.code);
      setTimeout(() => setCopied(false), 2500);
    } else {
      setCopyError(result.error || 'Không thể tự động sao chép mã. Bạn vui lòng chọn và sao chép thủ công.');
    }
  };

  return (
    <div
      className={`relative overflow-hidden rounded-2xl border-2 border-dashed border-amber-500/55 bg-card p-5 sm:p-6 shadow-player-card space-y-4 animate-fadeIn ${className}`}
      role="region"
      aria-label="Voucher ưu đãi đã mở khóa"
    >
      {/* Decorative Perforated Ticket Cutout Notches */}
      <div
        className="pointer-events-none absolute -left-3 top-1/2 h-6 w-6 -translate-y-1/2 rounded-full border-r-2 border-amber-500/55 bg-canvas"
        aria-hidden="true"
      />
      <div
        className="pointer-events-none absolute -right-3 top-1/2 h-6 w-6 -translate-y-1/2 rounded-full border-l-2 border-amber-500/55 bg-canvas"
        aria-hidden="true"
      />

      {/* Header & Unlock Badge */}
      <div className="text-center space-y-2">
        <div className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/40 bg-amber-500/15 px-3 py-1 text-xs font-bold text-amber-300">
          <Gift className="w-3.5 h-3.5 text-amber-400" />
          <span>Mã ưu đãi đã được mở khóa</span>
        </div>

        <h3 className="text-lg sm:text-xl font-black text-foreground tracking-tight leading-snug">
          {voucher.discount}
        </h3>

        {voucher.description && (
          <p className="text-xs text-content-secondary leading-relaxed max-w-xs mx-auto">
            {voucher.description}
          </p>
        )}
      </div>

      {/* Prominent Voucher Code Well (Flattened single recessed well — no double nested box) */}
      <div className="rounded-xl border border-amber-500/40 bg-recessed p-3.5 space-y-2.5">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="text-center sm:text-left space-y-0.5">
            <span className="block text-xs font-semibold text-content-secondary">
              Mã ưu đãi của bạn
            </span>
            <span
              tabIndex={0}
              aria-label={`Mã voucher: ${voucher.code}`}
              className="inline-block font-mono tabular-nums text-xl sm:text-2xl font-black tracking-widest text-amber-400 select-all focus:outline-none focus:ring-2 focus:ring-amber-400 rounded-md"
            >
              {voucher.code}
            </span>
          </div>

          <button
            type="button"
            onClick={handleCopy}
            aria-label={copied ? 'Đã sao chép mã' : 'Sao chép mã voucher'}
            className={`flex min-h-[44px] w-full sm:w-auto items-center justify-center gap-2 rounded-xl border-b-4 px-4 py-2.5 text-xs font-extrabold transition-all duration-100 active:translate-y-[2px] active:border-b-2 motion-reduce:transition-none ${
              copied
                ? 'border-b-emerald-700 bg-emerald-500 text-slate-950'
                : 'border-b-amber-700 bg-amber-500 text-slate-950 hover:bg-amber-400'
            }`}
          >
            {copied ? (
              <>
                <Check className="w-4 h-4 stroke-[3]" />
                <span>Đã sao chép!</span>
              </>
            ) : (
              <>
                <Copy className="w-4 h-4" />
                <span>Sao chép mã</span>
              </>
            )}
          </button>
        </div>

        {/* Copy Error Message with manual selection advice */}
        {copyError && (
          <div
            role="alert"
            className="rounded-xl border border-rose-500/40 bg-rose-500/10 p-2.5 text-[11px] text-rose-300 flex items-center justify-between gap-2 animate-fadeIn"
          >
            <div className="flex items-center gap-1.5 min-w-0">
              <AlertCircle className="w-3.5 h-3.5 shrink-0 text-rose-400" />
              <span className="leading-tight">{copyError}</span>
            </div>
            <button
              type="button"
              onClick={handleCopy}
              className="text-[11px] font-bold text-amber-400 hover:underline shrink-0"
            >
              Thử lại
            </button>
          </div>
        )}
      </div>

      {/* Voucher Expiration & Terms Breakdown */}
      <div className="rounded-xl border border-border-subtle bg-recessed p-3.5 text-xs text-content-secondary space-y-2">
        {voucher.expiryDate && (
          <div className="flex items-start gap-2">
            <Clock className="w-3.5 h-3.5 text-primary-400 shrink-0 mt-0.5" />
            <div className="flex-1 flex items-center justify-between gap-1 flex-wrap">
              <span>Hạn sử dụng:</span>
              <span className={`font-mono tabular-nums font-semibold ${expired ? 'text-rose-400 font-bold' : 'text-foreground'}`}>
                {voucher.expiryDate}
              </span>
              {expired && (
                <span className="rounded bg-rose-500/20 px-1.5 py-0.5 text-[10px] font-bold text-rose-300 border border-rose-500/30">
                  Đã hết hạn
                </span>
              )}
            </div>
          </div>
        )}

        {voucher.terms && (
          <div className="flex items-start gap-2 pt-2 border-t border-border-subtle">
            <FileText className="w-3.5 h-3.5 text-primary-400 shrink-0 mt-0.5" />
            <div className="flex-1 space-y-0.5">
              <span>Điều kiện áp dụng:</span>
              <p className="text-foreground/90 leading-relaxed font-medium">
                {voucher.terms}
              </p>
            </div>
          </div>
        )}

        {/* Recipient Attribution & Rank */}
        <div className="flex items-center justify-between pt-2 border-t border-border-subtle text-[11px] font-mono tabular-nums text-content-secondary">
          <span>
            Người nhận: <strong className="font-sans text-foreground">{lead.fullName}</strong>
          </span>
          {rank && onViewLeaderboard ? (
            <button
              type="button"
              onClick={onViewLeaderboard}
              className="flex items-center gap-1 rounded-lg border border-amber-500/40 bg-amber-500/15 px-2.5 py-1 text-amber-300 font-bold hover:bg-amber-500/25 transition-colors cursor-pointer"
              title="Xem Bảng Xếp Hạng Top 10"
              aria-label={`Thứ hạng #${rank}. Bấm để xem Bảng Xếp Hạng Top 10`}
            >
              <Trophy className="w-3 h-3 text-amber-400" /> Hạng #{rank}
            </button>
          ) : rank ? (
            <span className="flex items-center gap-1 text-amber-400 font-bold">
              <Trophy className="w-3 h-3" /> Hạng #{rank}
            </span>
          ) : null}
        </div>
      </div>

      {/* Social Share Button (Story 4.5, Screen S4) */}
      {onShare && (
        <div className="pt-1">
          <Button
            type="button"
            variant="tactile-primary"
            size="lg"
            onClick={onShare}
            className="w-full gap-2 text-xs font-extrabold"
            aria-label="Chia sẻ thành tích và voucher lên Facebook"
          >
            <Share2 className="w-4 h-4" />
            <span>Chia sẻ lên Facebook</span>
          </Button>
        </div>
      )}

      {/* Disclaimer Label (Acceptance Criteria Story 4.3) */}
      <div className="text-center pt-0.5">
        <p className="text-[11px] text-content-muted italic">
          * Mã ưu đãi demo phục vụ cuộc thi. Áp dụng khi liên hệ mua sắm tại Fanpage.
        </p>
      </div>
    </div>
  );
};

export default VoucherRewardCard;
