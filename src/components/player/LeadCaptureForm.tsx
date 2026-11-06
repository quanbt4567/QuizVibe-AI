import React, { useState, useRef } from 'react';
import {
  User,
  Phone,
  Gift,
  AlertCircle,
  CheckCircle2,
  Loader2,
  ShieldCheck,
  ArrowRight,
} from 'lucide-react';
import { Lead, VoucherConfig } from '../../types';
import { StorageService } from '../../services';
import { VIETNAMESE_PHONE_REGEX, maskPhoneNumber } from '../../services/validators';
import { playerApi, type UnlockedVoucher } from '../../services/playerApi';
import { VoucherRewardCard } from './VoucherRewardCard';
import { Card } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';

export interface LeadCaptureFormProps {
  score: number;
  timeTakenSeconds: number;
  campaignId: string;
  voucherCode: string;
  voucher?: VoucherConfig | null;
  sessionToken?: string;
  onSuccess?: (lead: Lead, rank: number) => void;
  onSkip?: () => void;
  onCopyVoucher?: (code: string) => void;
  onViewLeaderboard?: () => void;
  onShare?: () => void;
  initialName?: string;
  initialPhone?: string;
}

/**
 * Validates player full name.
 * Requirements: Required, >= 2 characters after trimming.
 */
export function validateFullName(name: string): { valid: boolean; error?: string; sanitized: string } {
  const trimmed = typeof name === 'string' ? name.trim() : '';
  if (!trimmed) {
    return { valid: false, error: 'Vui lòng nhập họ và tên.', sanitized: '' };
  }
  if (trimmed.length < 2) {
    return { valid: false, error: 'Họ và tên phải có ít nhất 2 ký tự.', sanitized: trimmed };
  }
  return { valid: true, sanitized: trimmed };
}

/**
 * Validates Vietnamese mobile phone number.
 * Requirements: Exactly 10 digits, starts with 03, 05, 07, 08, 09.
 * Matches /^(03|05|07|08|09)\d{8}$/ per FR-302, TC-03.
 */
export function validateVietnamesePhone(phone: string): { valid: boolean; error?: string; sanitized: string } {
  if (typeof phone !== 'string') {
    return { valid: false, error: 'Vui lòng nhập số điện thoại nhận voucher.', sanitized: '' };
  }
  const cleanPhone = phone.trim().replace(/\s+/g, '');
  if (!cleanPhone) {
    return { valid: false, error: 'Vui lòng nhập số điện thoại nhận voucher.', sanitized: '' };
  }
  if (!VIETNAMESE_PHONE_REGEX.test(cleanPhone)) {
    return {
      valid: false,
      error: 'Số điện thoại không hợp lệ (10 số, đầu số di động VN).',
      sanitized: cleanPhone,
    };
  }
  return { valid: true, sanitized: cleanPhone };
}

export const LeadCaptureForm: React.FC<LeadCaptureFormProps> = ({
  score,
  timeTakenSeconds,
  campaignId,
  voucherCode,
  voucher,
  sessionToken,
  onSuccess,
  onSkip,
  onCopyVoucher,
  onViewLeaderboard,
  onShare,
  initialName = '',
  initialPhone = '',
}) => {
  const [fullName, setFullName] = useState<string>(initialName);
  const [phoneNumber, setPhoneNumber] = useState<string>(initialPhone);

  const [nameError, setNameError] = useState<string | null>(null);
  const [phoneError, setPhoneError] = useState<string | null>(null);
  const [generalError, setGeneralError] = useState<string | null>(null);

  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [submittedLead, setSubmittedLead] = useState<{
    lead: Lead;
    rank: number;
    unlockedVoucher?: UnlockedVoucher | null;
  } | null>(null);
  const [isSkipped, setIsSkipped] = useState<boolean>(false);

  // Synchronous lock ref to prevent rapid double-clicks
  const isSubmittingRef = useRef<boolean>(false);

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFullName(e.target.value);
    if (nameError) setNameError(null);
    if (generalError) setGeneralError(null);
  };

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setPhoneNumber(e.target.value);
    if (phoneError) setPhoneError(null);
    if (generalError) setGeneralError(null);
  };

  const handleNameBlur = () => {
    if (fullName) {
      const res = validateFullName(fullName);
      if (!res.valid) {
        setNameError(res.error || null);
      }
    }
  };

  const handlePhoneBlur = () => {
    if (phoneNumber) {
      const res = validateVietnamesePhone(phoneNumber);
      if (!res.valid) {
        setPhoneError(res.error || null);
      }
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    // Guard against concurrent double-submissions
    if (isSubmittingRef.current || isSubmitting) {
      return;
    }

    // 1. Validate both fields
    const nameValidation = validateFullName(fullName);
    const phoneValidation = validateVietnamesePhone(phoneNumber);

    let hasError = false;

    if (!nameValidation.valid) {
      setNameError(nameValidation.error || 'Họ và tên không hợp lệ.');
      hasError = true;
    } else {
      setNameError(null);
    }

    if (!phoneValidation.valid) {
      setPhoneError(phoneValidation.error || 'Số điện thoại không hợp lệ (10 số, đầu số di động VN).');
      hasError = true;
    } else {
      setPhoneError(null);
    }

    if (hasError) {
      return;
    }

    // 2. Lock submission state
    isSubmittingRef.current = true;
    setIsSubmitting(true);
    setGeneralError(null);

    const submitAsync = async () => {
      try {
        if (sessionToken) {
          const res = await playerApi.submitLead(sessionToken, nameValidation.sanitized, phoneValidation.sanitized);
          const leadObj: Lead = {
            id: res.lead.id,
            fullName: res.lead.fullName,
            phoneNumber: phoneValidation.sanitized,
            score: res.lead.score,
            timeTakenSeconds: res.lead.timeTakenSeconds,
            voucherCode: res.voucher?.code || voucherCode || 'DEFAULT20',
            campaignId: campaignId || 'campaign_default',
            submittedAt: new Date().toISOString(),
          };

          setSubmittedLead({
            lead: leadObj,
            rank: res.lead.rank,
            unlockedVoucher: res.voucher,
          });
          onSuccess?.(leadObj, res.lead.rank);
          return;
        }

        // 3. Persist via StorageService.submitLead()
        const result = StorageService.submitLead({
          fullName: nameValidation.sanitized,
          phoneNumber: phoneValidation.sanitized,
          score,
          timeTakenSeconds,
          voucherCode: voucherCode || 'DEFAULT20',
          campaignId: campaignId || 'campaign_default',
        });

        if (result.success && result.data) {
          setSubmittedLead({
            lead: result.data.lead,
            rank: result.data.rank,
          });
          onSuccess?.(result.data.lead, result.data.rank);
        } else {
          // Preserve entered data so user does not need to retype
          setGeneralError(result.message || 'Không thể lưu thông tin. Vui lòng thử lại.');
        }
      } catch (err: unknown) {
        const errMsg = err instanceof Error ? err.message : 'Đã xảy ra lỗi không xác định khi lưu thông tin.';
        setGeneralError(errMsg);
      } finally {
        isSubmittingRef.current = false;
        setIsSubmitting(false);
      }
    };

    void submitAsync();
  };

  const handleSkipClick = () => {
    setIsSkipped(true);
    onSkip?.();
  };

  // State A: Successfully Submitted
  if (submittedLead) {
    return (
      <div className="space-y-4 animate-fadeIn">
        <div className="rounded-2xl border-2 border-emerald-500/40 bg-emerald-950/30 px-4 py-3 text-center space-y-1">
          <div className="flex items-center justify-center gap-2 text-emerald-400 font-bold text-xs sm:text-sm">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>Ghi nhận thông tin & xếp hạng thành công!</span>
          </div>
          <p className="text-[11px] sm:text-xs text-content-secondary">
            Chúc mừng <span className="font-bold text-foreground">{submittedLead.lead.fullName}</span> (SĐT:{' '}
            <span className="font-mono tabular-nums text-emerald-300">
              {maskPhoneNumber(submittedLead.lead.phoneNumber)}
            </span>
            ) đã ghi danh với{' '}
            <span className="font-mono tabular-nums font-bold text-amber-300">
              {submittedLead.lead.score} điểm
            </span>
            .
          </p>
        </div>

        <VoucherRewardCard
          voucher={
            submittedLead.unlockedVoucher
              ? {
                  code: submittedLead.unlockedVoucher.code,
                  discount: submittedLead.unlockedVoucher.discount,
                  description: submittedLead.unlockedVoucher.description,
                  expiryDate: submittedLead.unlockedVoucher.expiryDate || '7 ngày sau khi nhận',
                  terms: submittedLead.unlockedVoucher.terms || 'Áp dụng 01 lần',
                }
              : voucher
          }
          lead={submittedLead.lead}
          rank={submittedLead.rank}
          onCopySuccess={onCopyVoucher}
          onViewLeaderboard={onViewLeaderboard}
          onShare={onShare}
        />
      </div>
    );
  }

  // State B: Skipped State
  if (isSkipped) {
    return (
      <Card variant="player" className="p-5 text-center space-y-3 animate-fadeIn">
        <p className="text-xs text-content-secondary leading-relaxed">
          Bạn đã chọn bỏ qua lưu thông tin. Điểm số của bạn không được xếp hạng trên Bảng xếp hạng Top 10.
        </p>
        <Button
          type="button"
          variant="tactile-secondary"
          size="default"
          onClick={() => setIsSkipped(false)}
          className="text-xs text-primary-300"
        >
          Nhập lại thông tin để lưu điểm & nhận voucher
        </Button>
      </Card>
    );
  }

  // State C: Interactive Lead Capture Form (Natural Continuation of Game Flow)
  return (
    <Card variant="player" className="p-5 sm:p-6 space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3 border-b border-border-subtle pb-3.5">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-amber-500/35 bg-amber-500/15 text-amber-400">
          <Gift className="w-5 h-5" />
        </div>
        <div className="min-w-0">
          <h3 className="text-sm sm:text-base font-extrabold text-foreground tracking-tight">
            Mở khóa Voucher & Ghi danh Top 10
          </h3>
          <p className="text-[11px] text-content-secondary">
            Điểm số: <span className="font-mono tabular-nums font-bold text-amber-400">{score}đ</span> &bull; Thời gian:{' '}
            <span className="font-mono tabular-nums font-bold text-primary-300">{timeTakenSeconds}s</span>
          </p>
        </div>
      </div>

      {/* General Submission Error Alert */}
      {generalError && (
        <div
          role="alert"
          className="rounded-xl border border-rose-500/50 bg-rose-500/15 p-3 text-xs text-rose-200 flex items-center gap-2 animate-fadeIn"
        >
          <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
          <span>{generalError}</span>
        </div>
      )}

      {/* Lead Form */}
      <form onSubmit={handleSubmit} noValidate className="space-y-4">
        {/* Full Name Input */}
        <div className="space-y-1.5 text-left">
          <label htmlFor="lead-fullname" className="block text-xs font-bold text-foreground">
            Họ và tên của bạn <span className="text-rose-400">*</span>
          </label>
          <div className="relative">
            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-content-muted">
              <User className="h-4 w-4" />
            </div>
            <Input
              id="lead-fullname"
              name="fullName"
              type="text"
              variant="player"
              autoComplete="name"
              disabled={isSubmitting}
              placeholder="Nguyễn Văn A"
              value={fullName}
              onChange={handleNameChange}
              onBlur={handleNameBlur}
              aria-invalid={!!nameError}
              aria-describedby={nameError ? 'fullname-error' : undefined}
              className={`pl-10 text-xs sm:text-sm ${
                nameError ? 'border-rose-500 focus-visible:border-rose-500 focus-visible:ring-rose-500/30' : ''
              }`}
            />
          </div>
          {nameError && (
            <p id="fullname-error" role="alert" className="text-[11px] font-semibold text-rose-400 animate-fadeIn pl-1">
              {nameError}
            </p>
          )}
        </div>

        {/* Vietnamese Phone Input */}
        <div className="space-y-1.5 text-left">
          <label htmlFor="lead-phone" className="block text-xs font-bold text-foreground">
            Số điện thoại nhận voucher <span className="text-rose-400">*</span>
          </label>
          <div className="relative">
            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-content-muted">
              <Phone className="h-4 w-4" />
            </div>
            <Input
              id="lead-phone"
              name="phoneNumber"
              type="tel"
              variant="player"
              tabularNums
              inputMode="numeric"
              autoComplete="tel"
              disabled={isSubmitting}
              placeholder="0987654321"
              value={phoneNumber}
              onChange={handlePhoneChange}
              onBlur={handlePhoneBlur}
              aria-invalid={!!phoneError}
              aria-describedby={phoneError ? 'phone-error' : undefined}
              className={`pl-10 font-mono text-xs sm:text-sm ${
                phoneError ? 'border-rose-500 focus-visible:border-rose-500 focus-visible:ring-rose-500/30' : ''
              }`}
            />
          </div>
          {phoneError && (
            <p id="phone-error" role="alert" className="text-[11px] font-semibold text-rose-400 animate-fadeIn pl-1">
              {phoneError}
            </p>
          )}
        </div>

        {/* Transparent Purpose Notice (FR-302, Story 4.2) */}
        <div className="rounded-xl border border-border-subtle bg-recessed p-3 text-[11px] text-content-secondary flex items-start gap-2 text-left leading-relaxed">
          <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
          <span>
            Thông tin số điện thoại được thu thập nhằm mục đích đối soát người chơi hợp lệ và gửi mã ưu đãi trực tiếp từ Fanpage/Cửa hàng.
          </span>
        </div>

        {/* Form Actions */}
        <div className="pt-1 space-y-2">
          <Button
            type="submit"
            data-testid="submit-lead-btn"
            variant="tactile-success"
            size="lg"
            disabled={isSubmitting}
            className="w-full gap-2 text-xs sm:text-sm font-extrabold"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Đang lưu thông tin...</span>
              </>
            ) : (
              <>
                <span>Nhận Voucher & Xếp Hạng</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </Button>

          {onSkip && (
            <button
              type="button"
              disabled={isSubmitting}
              onClick={handleSkipClick}
              className="w-full py-2 text-center text-xs font-medium text-content-muted hover:text-content-secondary transition-colors"
            >
              Bỏ qua (Chỉ xem điểm, không lưu)
            </button>
          )}
        </div>
      </form>
    </Card>
  );
};

export default LeadCaptureForm;
