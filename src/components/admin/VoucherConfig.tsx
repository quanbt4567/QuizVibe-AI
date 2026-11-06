import React from 'react';
import { AlertCircle, Ticket } from 'lucide-react';
import { VoucherConfig as VoucherConfigType } from '../../types';
import { Card, Input, Badge } from '../ui';

interface VoucherConfigProps {
  voucher: VoucherConfigType;
  onChange: (field: keyof VoucherConfigType, value: string) => void;
  errors: Record<string, string>;
}

export const VoucherConfig: React.FC<VoucherConfigProps> = ({ voucher, onChange, errors }) => {
  return (
    <Card className="p-5 sm:p-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 pb-4 mb-5 border-b border-border-subtle">
        <div>
          <h3 className="text-sm sm:text-base font-semibold text-foreground leading-snug">
            Cấu hình Phần thưởng Voucher
          </h3>
          <p className="text-xs text-content-secondary mt-0.5">
            Mã ưu đãi được mở khóa sau khi người chơi hoàn tất 5 câu hỏi và xác nhận thông tin liên hệ.
          </p>
        </div>

        {voucher.code.trim() && (
          <Badge variant="success" shape="compact" tabularNums className="font-mono self-start sm:self-auto">
            {voucher.code.trim().toUpperCase()}
          </Badge>
        )}
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {/* Voucher Code */}
        <div>
          <label className="block text-xs font-medium text-content-secondary mb-1.5">
            Mã Voucher <span className="text-destructive">*</span>
          </label>
          <Input
            type="text"
            tabularNums
            value={voucher.code}
            onChange={(e) => onChange('code', e.target.value.toUpperCase())}
            placeholder="VD: GLOW20, VIBESTYLE50K"
            className={`font-mono uppercase tracking-wide ${
              errors['voucher_code'] ? 'border-destructive focus-visible:ring-destructive' : ''
            }`}
          />
          {errors['voucher_code'] ? (
            <p className="mt-1.5 flex items-center text-xs text-destructive">
              <AlertCircle className="mr-1 h-3.5 w-3.5 shrink-0" /> {errors['voucher_code']}
            </p>
          ) : (
            <p className="mt-1 text-[11px] text-content-muted">
              Viết liền không dấu, từ 3–20 ký tự chữ hoặc số.
            </p>
          )}
        </div>

        {/* Discount Description / Value */}
        <div>
          <label className="block text-xs font-medium text-content-secondary mb-1.5">
            Mức ưu đãi hiển thị <span className="text-destructive">*</span>
          </label>
          <Input
            type="text"
            value={voucher.discount}
            onChange={(e) => onChange('discount', e.target.value)}
            placeholder="VD: Giảm 20% đơn từ 299k, Giảm 50.000đ"
            className={errors['voucher_discount'] ? 'border-destructive focus-visible:ring-destructive' : ''}
          />
          {errors['voucher_discount'] && (
            <p className="mt-1.5 flex items-center text-xs text-destructive">
              <AlertCircle className="mr-1 h-3.5 w-3.5 shrink-0" /> {errors['voucher_discount']}
            </p>
          )}
        </div>

        {/* Description & Eligible Products */}
        <div className="sm:col-span-2">
          <label className="block text-xs font-medium text-content-secondary mb-1.5">
            Mô tả &amp; Phạm vi áp dụng <span className="text-destructive">*</span>
          </label>
          <Input
            type="text"
            value={voucher.description}
            onChange={(e) => onChange('description', e.target.value)}
            placeholder="VD: Áp dụng khi mua các sản phẩm serum và kem dưỡng tại Fanpage"
            className={errors['voucher_description'] ? 'border-destructive focus-visible:ring-destructive' : ''}
          />
          {errors['voucher_description'] && (
            <p className="mt-1.5 flex items-center text-xs text-destructive">
              <AlertCircle className="mr-1 h-3.5 w-3.5 shrink-0" /> {errors['voucher_description']}
            </p>
          )}
        </div>

        {/* Expiry Date / Days */}
        <div>
          <label className="block text-xs font-medium text-content-secondary mb-1.5">
            Thời hạn sử dụng
          </label>
          <Input
            type="text"
            tabularNums
            value={voucher.expiryDate || ''}
            onChange={(e) => onChange('expiryDate', e.target.value)}
            placeholder="VD: 7 ngày sau khi nhận, 30/11/2026"
          />
        </div>

        {/* Usage Terms */}
        <div>
          <label className="block text-xs font-medium text-content-secondary mb-1.5">
            Điều khoản áp dụng
          </label>
          <Input
            type="text"
            value={voucher.terms || ''}
            onChange={(e) => onChange('terms', e.target.value)}
            placeholder="VD: Áp dụng 01 lần cho mỗi khách hàng hợp lệ"
          />
        </div>
      </div>

      {/* Live Voucher Preview Card */}
      <div className="mt-5 pt-5 border-t border-border-subtle">
        <div className="flex items-center gap-2 mb-3">
          <Ticket className="w-3.5 h-3.5 text-amber-400" />
          <span className="text-xs font-semibold text-content-secondary uppercase tracking-wider">
            Xem trước Voucher (Giao diện người chơi)
          </span>
        </div>

        <div className="relative overflow-hidden rounded-xl border border-dashed border-amber-500/40 bg-recessed p-4 sm:p-5 max-w-md">
          {/* Ticket Cutout Notches */}
          <div
            className="pointer-events-none absolute -left-2.5 top-1/2 h-5 w-5 -translate-y-1/2 rounded-full border-r border-amber-500/40 bg-card"
            aria-hidden="true"
          />
          <div
            className="pointer-events-none absolute -right-2.5 top-1/2 h-5 w-5 -translate-y-1/2 rounded-full border-l border-amber-500/40 bg-card"
            aria-hidden="true"
          />

          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 space-y-1">
              <span className="text-[10px] font-bold text-amber-400 uppercase tracking-wider">
                Mã ưu đãi mở khóa
              </span>
              <h4 className="text-sm sm:text-base font-bold text-foreground truncate">
                {voucher.discount.trim() || 'Ưu đãi đặc biệt'}
              </h4>
              <p className="text-xs text-content-secondary line-clamp-2">
                {voucher.description.trim() || 'Áp dụng cho khách hàng tham gia minigame'}
              </p>
            </div>

            <div className="shrink-0 rounded-lg border border-amber-500/30 bg-card px-2.5 py-1.5 text-center">
              <span className="block text-[9px] font-semibold text-content-muted">MÃ</span>
              <span className="font-mono tabular-nums text-xs font-black tracking-wider text-amber-400">
                {voucher.code.trim().toUpperCase() || 'VIBE20'}
              </span>
            </div>
          </div>

          {(voucher.expiryDate || voucher.terms) && (
            <div className="mt-3 pt-2.5 border-t border-border-subtle flex flex-wrap items-center justify-between gap-2 text-[11px] text-content-muted font-mono tabular-nums">
              {voucher.expiryDate && <span>HSD: {voucher.expiryDate}</span>}
              {voucher.terms && <span>* {voucher.terms}</span>}
            </div>
          )}
        </div>
      </div>
    </Card>
  );
};
