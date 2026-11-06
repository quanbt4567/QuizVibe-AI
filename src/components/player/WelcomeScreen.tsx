import React, { useState } from 'react';
import {
  Sparkles,
  Trophy,
  Gift,
  Clock,
  Zap,
  AlertCircle,
  HelpCircle,
  RefreshCw,
  ArrowRight,
  Play,
} from 'lucide-react';
import { Campaign, MOCK_MODE_LABEL } from '../../types';
import { LeaderboardModal } from './LeaderboardModal';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Card } from '../ui/card';

export interface WelcomeScreenProps {
  campaign: Campaign | null;
  onStartQuiz: () => void;
  onNavigateToAdmin?: () => void;
  onReloadDefaultCampaign?: () => void;
}

export const WelcomeScreen: React.FC<WelcomeScreenProps> = ({
  campaign,
  onStartQuiz,
  onNavigateToAdmin,
  onReloadDefaultCampaign,
}) => {
  const [showLeaderboard, setShowLeaderboard] = useState<boolean>(false);

  // Fallback state: Missing or invalid campaign
  if (!campaign || !Array.isArray(campaign.questions) || campaign.questions.length === 0) {
    return (
      <div className="mx-auto w-full max-w-[480px] px-4 py-8 sm:py-12">
        <Card variant="player" className="p-6 sm:p-8 text-center space-y-5">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border-2 border-border-tactile border-b-4 border-b-border-tactile-depth bg-recessed text-primary">
            <HelpCircle className="h-7 w-7" />
          </div>

          <div className="space-y-2">
            <h2 className="text-xl sm:text-2xl font-bold text-foreground tracking-tight">
              Chưa có chiến dịch nào được kích hoạt
            </h2>
            <p className="text-xs sm:text-sm text-content-secondary leading-relaxed">
              Hiện tại chưa có minigame nào sẵn sàng trong bộ nhớ. Bạn có thể nạp ngay bộ câu hỏi mẫu mặc định hoặc chuyển sang giao diện Quản trị để tạo bằng AI.
            </p>
          </div>

          <div className="pt-2 flex flex-col gap-3">
            {onReloadDefaultCampaign && (
              <Button
                type="button"
                variant="tactile-primary"
                size="lg"
                onClick={onReloadDefaultCampaign}
                className="w-full gap-2"
              >
                <RefreshCw className="w-4 h-4" />
                <span>Nạp chiến dịch mẫu mặc định</span>
              </Button>
            )}

            {onNavigateToAdmin && (
              <Button
                type="button"
                variant="tactile-secondary"
                size="lg"
                onClick={onNavigateToAdmin}
                className="w-full gap-2"
              >
                <span>Chuyển sang Màn hình Quản trị</span>
                <ArrowRight className="w-4 h-4" />
              </Button>
            )}
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-[480px] px-4 py-5 sm:py-8">
      {/* Offline Demo / Mock Mode Banner per FR-103 & Requirement 4 */}
      {campaign.isMock && (
        <div className="mb-4 flex items-center justify-center gap-2 rounded-xl border border-amber-500/35 bg-amber-500/10 px-4 py-2.5 text-center text-xs sm:text-sm font-semibold text-amber-300">
          <AlertCircle className="h-4 w-4 shrink-0 text-amber-400" />
          <span>{campaign.mockLabel || MOCK_MODE_LABEL}</span>
        </div>
      )}

      {/* Main Campaign Flashcard Container (Quizlet + Duolingo #2) */}
      <Card variant="player" className="p-5 sm:p-7 space-y-5">
        {/* Top Meta Bar: Challenge Pill & Industry Badge */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border-subtle pb-4">
          <Badge variant="default" className="gap-1.5 font-bold">
            <Zap className="w-3 h-3 fill-current" />
            <span>Thử thách Fanpage</span>
          </Badge>

          <div className="flex items-center gap-1.5">
            <Badge variant="outline" className="font-medium text-content-secondary">
              {campaign.industry}
            </Badge>
            <Badge variant="secondary" tabularNums className="font-semibold text-foreground">
              {campaign.questions.length} câu
            </Badge>
          </div>
        </div>

        {/* Hero Flashcard Identity */}
        <div className="text-center space-y-2.5 pt-1">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl border-2 border-primary/40 border-b-4 border-b-primary-depth bg-primary/15 text-primary-300">
            <Sparkles className="h-6 w-6" />
          </div>

          <h1 className="text-2xl sm:text-[28px] font-extrabold tracking-tight text-foreground leading-snug">
            {campaign.title}
          </h1>

          <p className="text-xs sm:text-sm text-content-secondary leading-relaxed max-w-md mx-auto">
            {campaign.description ||
              'Tham gia thử thách trắc nghiệm nhanh 5 câu để mở khóa voucher ưu đãi mua sắm độc quyền từ Shop!'}
          </p>
        </div>

        {/* Reward Preview Ticket (Structured Coupon Preview) */}
        <div className="relative overflow-hidden rounded-2xl border-2 border-dashed border-amber-500/45 bg-recessed p-4 sm:p-5 space-y-3">
          {/* Subtle Ticket Cutout Notches */}
          <div
            className="pointer-events-none absolute -left-2.5 top-1/2 h-5 w-5 -translate-y-1/2 rounded-full border-r-2 border-amber-500/45 bg-card"
            aria-hidden="true"
          />
          <div
            className="pointer-events-none absolute -right-2.5 top-1/2 h-5 w-5 -translate-y-1/2 rounded-full border-l-2 border-amber-500/45 bg-card"
            aria-hidden="true"
          />

          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-3 min-w-0">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-amber-500/35 bg-amber-500/15 text-amber-400">
                <Gift className="h-5 w-5" />
              </div>
              <div className="min-w-0 space-y-0.5">
                <p className="text-xs font-bold text-amber-400">
                  Phần thưởng vượt qua thử thách
                </p>
                <h3 className="text-base sm:text-lg font-extrabold text-foreground leading-snug">
                  {campaign.voucher.discount}
                </h3>
              </div>
            </div>

            <div className="shrink-0 rounded-xl border border-amber-500/35 bg-card px-2.5 py-1.5 text-center">
              <span className="block text-[10px] font-semibold text-content-secondary">
                Mã ưu đãi
              </span>
              <span className="font-mono tabular-nums text-xs sm:text-sm font-black tracking-wider text-amber-400">
                {campaign.voucher.code}
              </span>
            </div>
          </div>

          <div className="border-t border-border-subtle pt-2.5 text-xs text-content-secondary space-y-1.5">
            <p className="line-clamp-2 text-foreground/90">{campaign.voucher.description}</p>
            <div className="flex flex-wrap items-center justify-between gap-2 pt-0.5">
              {campaign.voucher.expiryDate && (
                <p className="text-[11px] text-amber-300 font-medium flex items-center gap-1 tabular-nums">
                  <Clock className="w-3 h-3 shrink-0 text-amber-400" />
                  <span>Hạn sử dụng: {campaign.voucher.expiryDate}</span>
                </p>
              )}
              {campaign.voucher.terms && (
                <p className="text-[11px] text-content-muted leading-snug">
                  * {campaign.voucher.terms}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Concise Rules Summary (2 Tactile Stat Cards) */}
        <div className="grid grid-cols-2 gap-3 text-left">
          <div className="rounded-xl border border-border-tactile border-b-2 bg-recessed p-3.5 space-y-1">
            <div className="flex items-center gap-2 text-primary-300">
              <Clock className="h-4 w-4 shrink-0 text-primary-400" />
              <span className="text-xs font-bold text-foreground tabular-nums">30s Mỗi câu</span>
            </div>
            <p className="text-[11px] text-content-secondary leading-relaxed">
              Tối đa 30 giây mỗi câu. Trả lời càng nhanh, điểm tốc độ càng cao!
            </p>
          </div>

          <div className="rounded-xl border border-border-tactile border-b-2 bg-recessed p-3.5 space-y-1">
            <div className="flex items-center gap-2 text-amber-400">
              <Trophy className="h-4 w-4 shrink-0 text-amber-400" />
              <span className="text-xs font-bold text-foreground tabular-nums">Đua Top 10</span>
            </div>
            <p className="text-[11px] text-content-secondary leading-relaxed">
              Ghi danh bảng xếp hạng cao thủ và nhận ngay mã voucher ưu đãi.
            </p>
          </div>
        </div>

        {/* Tactile 3D Action Buttons (Duolingo #2 Mechanics) */}
        <div className="space-y-3 pt-1">
          <Button
            type="button"
            variant="tactile-primary"
            size="xl"
            onClick={onStartQuiz}
            className="w-full gap-2.5 text-base sm:text-lg font-extrabold"
          >
            <Play className="w-5 h-5 fill-current" />
            <span>Bắt đầu chơi ngay</span>
          </Button>

          <Button
            type="button"
            variant="tactile-secondary"
            size="lg"
            onClick={() => setShowLeaderboard(true)}
            className="w-full gap-2 text-xs sm:text-sm font-bold"
          >
            <Trophy className="w-4 h-4 text-amber-400" />
            <span>Xem Bảng Xếp Hạng Top 10</span>
          </Button>
        </div>
      </Card>

      {/* Leaderboard Modal (Story 4.4, Preview prior to gameplay) */}
      <LeaderboardModal
        isOpen={showLeaderboard}
        onClose={() => setShowLeaderboard(false)}
        campaignTitle={campaign?.title}
      />
    </div>
  );
};
