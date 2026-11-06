import React, { useState, useRef, useEffect } from 'react';
import {
  Trophy,
  Award,
  Clock,
  CheckCircle2,
  XCircle,
  AlertCircle,
  RotateCcw,
  ArrowLeft,
  ChevronDown,
  ChevronUp,
  Lightbulb,
  Sparkles,
  HelpCircle,
  Share2,
  X,
} from 'lucide-react';
import { Campaign, Lead } from '../../types';
import { QuizGameSessionResult, QuestionPlayResult } from '../../services/scoring';
import {
  shareToFacebook,
  loadFacebookSdk,
  generateShareMessage,
} from '../../services/sharing';
import { copyToClipboard } from '../../services/clipboard';
import { LeadCaptureForm } from './LeadCaptureForm';
import { LeaderboardModal } from './LeaderboardModal';
import { Card } from '../ui/card';
import { Button } from '../ui/button';

export interface ResultScreenProps {
  result: QuizGameSessionResult | null;
  campaign?: Campaign | null;
  sessionToken?: string;
  campaignSlug?: string;
  onPlayAgain: () => void;
  onBackToWelcome: () => void;
  onProceedToLeadCapture?: () => void;
  onLeadSubmitted?: (lead: Lead, rank: number) => void;
  onVoucherCopied?: (code: string) => void;
  onShareNotice?: (message: string) => void;
}

/**
 * Score Tier Definition (Story 4.1 Acceptance Criteria)
 */
export interface ScoreTierInfo {
  tier: 'master' | 'great' | 'good' | 'participant';
  title: string;
  badge: string;
  message: string;
  badgeColor: string;
  icon: React.ReactNode;
}

/**
 * Evaluates performance tier based on total score out of 2,000 points.
 */
export function getScoreTierInfo(score: number): ScoreTierInfo {
  if (score >= 1600) {
    return {
      tier: 'master',
      title: 'Xuất sắc!',
      badge: 'Bậc thầy kiến thức',
      message:
        'Phản xạ cực nhanh và độ chính xác tuyệt đối! Bạn đang là ứng viên nặng ký cho vị trí Top 10 Bảng xếp hạng.',
      badgeColor: 'border-amber-500/40 bg-amber-500/15 text-amber-300',
      icon: <Trophy className="h-8 w-8 text-amber-400" />,
    };
  }

  if (score >= 1200) {
    return {
      tier: 'great',
      title: 'Rất tốt!',
      badge: 'Phong độ ấn tượng',
      message:
        'Khả năng phản xạ và kiến thức rất vững chắc. Bạn hoàn toàn đủ điều kiện nhận mã ưu đãi đặc biệt từ shop!',
      badgeColor: 'border-emerald-500/40 bg-emerald-500/15 text-emerald-300',
      icon: <Sparkles className="h-8 w-8 text-emerald-400" />,
    };
  }

  if (score >= 800) {
    return {
      tier: 'good',
      title: 'Khá tốt!',
      badge: 'Cố gắng thêm chút nữa',
      message:
        'Bạn đã vượt qua hơn một nửa số câu hỏi thử thách. Tiếp tục nhận mã voucher ưu đãi của bạn nhé!',
      badgeColor: 'border-sky-500/40 bg-sky-500/15 text-sky-300',
      icon: <Award className="h-8 w-8 text-sky-400" />,
    };
  }

  return {
    tier: 'participant',
    title: 'Hoàn thành!',
    badge: 'Tinh thần tuyệt vời',
    message:
      'Cảm ơn bạn đã tham gia thử thách minigame kiến thức. Phần quà voucher ưu đãi từ shop vẫn sẵn sàng dành cho bạn!',
    badgeColor: 'border-slate-700 bg-slate-800 text-slate-300',
    icon: <Award className="h-8 w-8 text-primary-400" />,
  };
}

export const ResultScreen: React.FC<ResultScreenProps> = ({
  result,
  campaign,
  sessionToken,
  campaignSlug,
  onPlayAgain,
  onBackToWelcome,
  onProceedToLeadCapture,
  onLeadSubmitted,
  onVoucherCopied,
  onShareNotice,
}) => {
  // Expandable state for individual question breakdown accordions
  const [expandedIndices, setExpandedIndices] = useState<Record<number, boolean>>({});
  // Top 10 Leaderboard modal state
  const [showLeaderboard, setShowLeaderboard] = useState<boolean>(false);
  const [submittedLeadId, setSubmittedLeadId] = useState<string | null>(null);
  const [submittedLeadRank, setSubmittedLeadRank] = useState<number | null>(null);

  // Social sharing states (Story 4.5)
  const [isSharing, setIsSharing] = useState<boolean>(false);
  const isSharingRef = useRef<boolean>(false);
  const [shareFeedback, setShareFeedback] = useState<string | null>(null);
  const [manualShareText, setManualShareText] = useState<string | null>(null);
  const lastTriggerRef = useRef<HTMLElement | null>(null);
  const manualTextareaRef = useRef<HTMLTextAreaElement | null>(null);

  // Focus management and accessibility for manual copy dialog
  useEffect(() => {
    if (manualShareText) {
      const timer = setTimeout(() => {
        manualTextareaRef.current?.focus();
        manualTextareaRef.current?.select();
      }, 50);

      const originalOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';

      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === 'Escape') {
          setManualShareText(null);
        }
      };
      window.addEventListener('keydown', handleKeyDown);

      return () => {
        clearTimeout(timer);
        document.body.style.overflow = originalOverflow;
        window.removeEventListener('keydown', handleKeyDown);
        lastTriggerRef.current?.focus();
      };
    }
  }, [manualShareText]);

  // Pre-load Facebook SDK on mount for responsive sharing
  useEffect(() => {
    loadFacebookSdk().catch(() => {});
  }, []);

  const handleShare = async () => {
    if (isSharingRef.current || !result) return;
    if (document.activeElement instanceof HTMLElement) {
      lastTriggerRef.current = document.activeElement;
    }
    isSharingRef.current = true;
    setIsSharing(true);

    try {
      const origin = typeof window !== 'undefined' ? window.location.origin : '';
      const targetSlug = campaignSlug || campaign?.slug;
      const quizUrl = targetSlug ? `${origin}/quiz/${targetSlug}` : (origin || 'https://quiz-vibe-ai.vercel.app');

      const { text } = generateShareMessage({
        score: result.totalScore,
        campaignTitle: campaign?.title,
        voucherDiscount: submittedLeadId ? campaign?.voucher?.discount : undefined,
        quizUrl,
      });

      const outcome = await shareToFacebook({
        url: quizUrl,
        quote: text,
        hashtag: '#QuizVibeAI',
      });

      if (outcome.status === 'shared') {
        const msg = 'Đã chia sẻ thành công lên Facebook! 🎉';
        if (onShareNotice) {
          onShareNotice(msg);
        } else {
          setShareFeedback(msg);
          setTimeout(() => setShareFeedback(null), 3500);
        }
      } else if (outcome.status === 'opened') {
        const msg = 'Đã mở cửa sổ chia sẻ Facebook.';
        if (onShareNotice) {
          onShareNotice(msg);
        } else {
          setShareFeedback(msg);
          setTimeout(() => setShareFeedback(null), 3000);
        }
      } else if (outcome.status === 'cancelled') {
        const msg = 'Đã huỷ chia sẻ Facebook.';
        if (onShareNotice) {
          onShareNotice(msg);
        } else {
          setShareFeedback(msg);
          setTimeout(() => setShareFeedback(null), 2500);
        }
      } else if (outcome.status === 'blocked') {
        const clip = await copyToClipboard(text);
        const msg = clip.success
          ? 'Cửa sổ chia sẻ bị chặn. Đã sao chép nội dung thử thách để bạn dán lên Facebook!'
          : 'Cửa sổ chia sẻ bị chặn. Vui lòng cho phép mở popup trên trình duyệt.';
        if (onShareNotice) {
          onShareNotice(msg);
        } else {
          setShareFeedback(msg);
          setTimeout(() => setShareFeedback(null), 4000);
        }
        if (!clip.success) {
          setManualShareText(text);
        }
      } else {
        const clip = await copyToClipboard(text);
        const msg = clip.success
          ? 'Đã sao chép nội dung chia sẻ để bạn đăng lên Facebook!'
          : 'Không thể mở Facebook. Bạn có thể sao chép liên kết thử thách.';
        if (onShareNotice) {
          onShareNotice(msg);
        } else {
          setShareFeedback(msg);
          setTimeout(() => setShareFeedback(null), 3500);
        }
        if (!clip.success) {
          setManualShareText(text);
        }
      }
    } catch {
      // Graceful fallback
    } finally {
      isSharingRef.current = false;
      setIsSharing(false);
    }
  };

  const toggleAccordion = (index: number) => {
    setExpandedIndices((prev) => ({
      ...prev,
      [index]: !prev[index],
    }));
  };

  // Graceful fallback if result data is missing or empty
  if (!result || !Array.isArray(result.results) || result.results.length === 0) {
    return (
      <div className="mx-auto w-full max-w-[480px] px-4 py-8">
        <Card variant="player" className="p-6 sm:p-8 text-center space-y-5">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-amber-500/30 bg-amber-500/10 text-amber-400">
            <HelpCircle className="h-7 w-7" />
          </div>
          <div className="space-y-2">
            <h2 className="text-xl font-bold text-foreground">Chưa có dữ liệu kết quả</h2>
            <p className="text-xs text-content-secondary leading-relaxed">
              Không tìm thấy thông tin lượt chơi hoàn thành. Bạn có thể quay lại trang chủ hoặc bắt đầu một vòng chơi mới.
            </p>
          </div>
          <div className="pt-2 space-y-2.5">
            <Button
              type="button"
              variant="tactile-primary"
              size="lg"
              onClick={onPlayAgain}
              className="w-full gap-2"
            >
              <RotateCcw className="w-4 h-4" />
              <span>Bắt đầu chơi ngay</span>
            </Button>
            <Button
              type="button"
              variant="tactile-secondary"
              size="lg"
              onClick={onBackToWelcome}
              className="w-full gap-2"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Quay về trang Chào mừng</span>
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  const tierInfo = getScoreTierInfo(result.totalScore);
  const scorePercent = Math.min(100, Math.max(0, (result.totalScore / 2000) * 100));
  const optionLetters = ['A', 'B', 'C', 'D'];

  return (
    <div className="mx-auto w-full max-w-[480px] px-4 py-5 sm:py-8 space-y-4">
      {/* 1. Hero Score Summary Card */}
      <Card variant="player" className="p-5 sm:p-6 text-center space-y-4">
        {/* Tier Icon & Badge */}
        <div className="space-y-2.5">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border-2 border-amber-500/35 border-b-4 border-b-amber-700/60 bg-recessed">
            {tierInfo.icon}
          </div>

          <div>
            <span
              className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-bold ${tierInfo.badgeColor}`}
            >
              {tierInfo.badge}
            </span>
          </div>

          <div className="space-y-1">
            <h1 className="text-2xl sm:text-3xl font-extrabold text-foreground tracking-tight">
              {tierInfo.title}
            </h1>
            <p className="text-xs sm:text-sm text-content-secondary max-w-xs mx-auto leading-relaxed">
              {tierInfo.message}
            </p>
          </div>
        </div>

        {/* Unified Score & Performance Well (Flattened nesting + conversion-focused compact height) */}
        <div className="rounded-2xl border border-border-tactile bg-recessed p-4 space-y-3">
          <div className="space-y-1">
            <span className="text-xs font-semibold text-content-secondary">
              Tổng điểm đạt được
            </span>
            <div className="flex items-baseline justify-center gap-1.5 font-mono">
              <span className="text-3xl sm:text-4xl font-black tracking-tight text-amber-400 tabular-nums">
                {result.totalScore}
              </span>
              <span className="text-sm font-bold text-content-muted tabular-nums">
                / 2,000 điểm
              </span>
            </div>
          </div>

          {/* Progress Bar towards 2,000 */}
          <div className="space-y-1">
            <div className="h-2 w-full overflow-hidden rounded-full bg-card border border-border-subtle">
              <div
                className="h-full bg-primary transition-all duration-700 ease-out rounded-full"
                style={{ width: `${scorePercent}%` }}
              />
            </div>
            <div className="flex justify-between text-[10px] text-content-muted font-mono tabular-nums">
              <span>0đ</span>
              <span>{Math.round(scorePercent)}% tối đa</span>
              <span>2,000đ</span>
            </div>
          </div>

          {/* 3-Column Performance Metrics inside the same recessed well (No extra nested boxes) */}
          <div className="grid grid-cols-3 divide-x divide-border-subtle border-t border-border-subtle pt-3 text-center">
            <div className="px-2 space-y-0.5">
              <span className="block text-[11px] font-semibold text-content-secondary">
                Điểm số
              </span>
              <p className="font-mono text-sm sm:text-base font-black text-amber-400 tabular-nums">
                {result.totalScore}đ
              </p>
            </div>

            <div className="px-2 space-y-0.5">
              <span className="text-[11px] font-semibold text-content-secondary flex items-center justify-center gap-1">
                <CheckCircle2 className="w-3 h-3 text-emerald-400" /> Đúng
              </span>
              <p className="font-mono text-sm sm:text-base font-black text-emerald-400 tabular-nums">
                {result.totalCorrect}/{result.totalQuestions}
              </p>
            </div>

            <div className="px-2 space-y-0.5">
              <span className="text-[11px] font-semibold text-content-secondary flex items-center justify-center gap-1">
                <Clock className="w-3 h-3 text-primary-400" /> Thời gian
              </span>
              <p className="font-mono text-sm sm:text-base font-black text-primary-300 tabular-nums">
                {result.totalTimeSpentSeconds}s
              </p>
            </div>
          </div>
        </div>

        <p className="text-[11px] text-content-muted text-center">
          * Thời gian xếp hạng chỉ tính số giây trả lời câu hỏi thực tế, không tính thời gian chờ.
        </p>
      </Card>

      {/* 2. Primary Conversion Action: Vietnamese Phone Lead Capture & Voucher Reward Unlock (Story 4.2 & 4.3) */}
      <LeadCaptureForm
        score={result.totalScore}
        timeTakenSeconds={result.totalTimeSpentSeconds}
        campaignId={campaign?.id || result.campaignId}
        voucherCode={campaign?.voucher?.code || 'DEFAULT20'}
        voucher={campaign?.voucher}
        sessionToken={sessionToken}
        onCopyVoucher={onVoucherCopied}
        onViewLeaderboard={() => setShowLeaderboard(true)}
        onShare={handleShare}
        onSuccess={(lead, rank) => {
          setSubmittedLeadId(lead.id);
          setSubmittedLeadRank(rank);
          onLeadSubmitted?.(lead, rank);
          onProceedToLeadCapture?.();
        }}
      />

      {/* 3. Secondary Actions: Leaderboard, Social Share & Replay Navigation */}
      <Card variant="player" className="p-4 sm:p-5 space-y-2.5">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          <Button
            type="button"
            variant="tactile-primary"
            size="lg"
            disabled={isSharing}
            onClick={handleShare}
            className="w-full gap-2 text-xs font-extrabold"
            aria-label="Chia sẻ kết quả lên Facebook"
          >
            <Share2 className="w-4 h-4" />
            <span>{isSharing ? 'Đang chia sẻ...' : 'Chia sẻ lên Facebook'}</span>
          </Button>

          <Button
            type="button"
            variant="tactile-secondary"
            size="lg"
            onClick={() => setShowLeaderboard(true)}
            className="w-full gap-2 border-amber-500/35 text-amber-300 hover:text-amber-200 text-xs font-bold"
          >
            <Trophy className="w-4 h-4 text-amber-400" />
            <span>Xem Bảng Xếp Hạng Top 10</span>
          </Button>
        </div>

        {shareFeedback && (
          <div
            role="status"
            className="rounded-xl border border-emerald-500/40 bg-emerald-950/40 p-2.5 text-center text-xs text-emerald-300 font-medium flex items-center justify-center gap-2 animate-fadeIn"
          >
            <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
            <span>{shareFeedback}</span>
          </div>
        )}

        <div className="grid grid-cols-2 gap-2.5 pt-0.5">
          <Button
            type="button"
            variant="tactile-secondary"
            size="default"
            onClick={onPlayAgain}
            className="w-full gap-2 text-xs"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Chơi lại</span>
          </Button>

          <Button
            type="button"
            variant="tactile-secondary"
            size="default"
            onClick={onBackToWelcome}
            className="w-full gap-2 text-xs"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Trang chủ</span>
          </Button>
        </div>
      </Card>

      {/* 4. Question-by-Question Performance Breakdown (Quizlet Flashcard Review) */}
      <Card variant="player" className="p-5 sm:p-6 space-y-4">
        <div className="flex items-center justify-between border-b border-border-subtle pb-3">
          <div className="flex items-center gap-2">
            <Award className="w-4 h-4 text-primary-400" />
            <h2 className="text-sm font-bold text-foreground">
              Chi tiết câu trả lời
            </h2>
          </div>
          <span className="rounded-lg border border-border-tactile bg-recessed px-2.5 py-0.5 font-mono tabular-nums text-[11px] font-bold text-content-secondary">
            {result.totalCorrect}/{result.totalQuestions} đúng
          </span>
        </div>

        {/* Breakdown List of 5 Questions */}
        <div className="space-y-2.5" role="region" aria-label="Chi tiết từng câu hỏi">
          {result.results.map((qResult: QuestionPlayResult, idx: number) => {
            const isExpanded = !!expandedIndices[idx];
            const isTimedOut = qResult.selectedOptionIndex === null || qResult.timeSpentSeconds >= 30;
            const campaignQuestion = campaign?.questions?.[qResult.questionIndex];
            const displayOptions = qResult.options || campaignQuestion?.options || [];
            const displayExplanation = qResult.explanation || campaignQuestion?.explanation;
            const correctOptionIndex = qResult.correctIndex;

            // Determine state badges & styling
            let badgeBg = 'bg-rose-500/15 border-rose-500/35 text-rose-300';
            let badgeText = '+0đ (Sai)';
            let statusIcon = <XCircle className="w-4 h-4 text-rose-400 shrink-0" />;

            if (qResult.isCorrect) {
              badgeBg = 'bg-emerald-500/15 border-emerald-500/35 text-emerald-300';
              badgeText = `+${qResult.score}đ`;
              statusIcon = <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />;
            } else if (isTimedOut) {
              badgeBg = 'bg-amber-500/15 border-amber-500/35 text-amber-300';
              badgeText = '+0đ (Hết giờ)';
              statusIcon = <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />;
            }

            return (
              <div
                key={qResult.questionId || idx}
                className="overflow-hidden rounded-xl border border-border-subtle bg-recessed transition-all"
              >
                {/* Header row: Clickable Accordion Trigger */}
                <button
                  type="button"
                  id={`accordion-trigger-${idx}`}
                  onClick={() => toggleAccordion(idx)}
                  aria-expanded={isExpanded}
                  aria-controls={`accordion-panel-${idx}`}
                  aria-label={`Xem chi tiết Câu ${idx + 1}: ${isExpanded ? 'Đang mở' : 'Đang đóng'}`}
                  className="flex w-full items-start justify-between gap-3 p-3.5 text-left hover:bg-interactive/60 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-inset"
                >
                  <div className="flex items-start gap-2.5 min-w-0">
                    <div className="pt-0.5">{statusIcon}</div>
                    <div className="space-y-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-mono tabular-nums text-[11px] font-bold text-primary-400">
                          Câu {idx + 1}
                        </span>
                        <span className="text-content-muted">&bull;</span>
                        <span className="text-[11px] text-content-secondary font-mono tabular-nums">
                          {isTimedOut ? '30s (Hết giờ)' : `${qResult.timeSpentSeconds}s`}
                        </span>
                      </div>
                      <p className="text-xs font-semibold text-foreground line-clamp-2 leading-snug">
                        {qResult.question || campaignQuestion?.question}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0 pt-0.5">
                    <span className={`rounded-md border px-2 py-0.5 font-mono tabular-nums text-[11px] font-bold ${badgeBg}`}>
                      {badgeText}
                    </span>
                    {isExpanded ? (
                      <ChevronUp className="w-4 h-4 text-content-secondary" />
                    ) : (
                      <ChevronDown className="w-4 h-4 text-content-muted" />
                    )}
                  </div>
                </button>

                {/* Expanded Details: Options & Explanation (Flattened container hierarchy) */}
                {isExpanded && (
                  <div
                    id={`accordion-panel-${idx}`}
                    role="region"
                    aria-labelledby={`accordion-trigger-${idx}`}
                    className="border-t border-border-subtle px-3.5 py-3 space-y-2.5 animate-fadeIn"
                  >
                    {/* Option Choices List */}
                    {displayOptions.length > 0 && (
                      <div className="space-y-1.5">
                        <span className="text-xs font-semibold text-content-secondary">
                          Các phương án:
                        </span>
                        <div className="space-y-1.5">
                          {displayOptions.map((optText, optIdx) => {
                            const isUserSelection = qResult.selectedOptionIndex === optIdx;
                            const isThisCorrect = optIdx === correctOptionIndex;
                            const letter = optionLetters[optIdx] || `${optIdx + 1}`;

                            let optStyle = 'text-content-secondary';
                            let optBadge = 'bg-card text-content-muted border border-border-subtle';

                            if (isThisCorrect) {
                              optStyle = 'bg-emerald-500/10 text-emerald-200 font-medium';
                              optBadge = 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-bold';
                            } else if (isUserSelection && !qResult.isCorrect) {
                              optStyle = 'bg-rose-500/10 text-rose-200';
                              optBadge = 'bg-rose-500/20 text-rose-300 border border-rose-500/30 font-bold';
                            }

                            return (
                              <div
                                key={optIdx}
                                className={`flex items-start justify-between gap-2.5 rounded-lg px-2.5 py-2 text-xs transition-colors ${optStyle}`}
                              >
                                <div className="flex items-start gap-2 min-w-0">
                                  <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md font-mono text-[10px] ${optBadge}`}>
                                    {letter}
                                  </span>
                                  <span className="leading-relaxed break-words">{optText}</span>
                                </div>

                                <div className="shrink-0 flex items-center gap-1 text-[11px] font-bold pt-0.5">
                                  {isUserSelection && (
                                    <span className={isThisCorrect ? 'text-emerald-400' : 'text-rose-400'}>
                                      {isThisCorrect ? 'Bạn chọn (Đúng)' : 'Bạn chọn'}
                                    </span>
                                  )}
                                  {!isUserSelection && isThisCorrect && (
                                    <span className="text-emerald-400">
                                      Đáp án đúng
                                    </span>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Timeout Notice if no answer chosen */}
                    {isTimedOut && (
                      <div className="rounded-lg bg-amber-500/10 px-2.5 py-2 text-[11px] text-amber-200 flex items-center gap-2">
                        <AlertCircle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                        <span>Hết 30 giây thời gian quy định &mdash; Không kịp chọn đáp án (0đ).</span>
                      </div>
                    )}

                    {/* Explanation */}
                    {displayExplanation && (
                      <div className="border-t border-border-subtle pt-2.5 text-[11px] text-primary-200 space-y-1">
                        <div className="flex items-center gap-1.5 font-bold text-primary-300">
                          <Lightbulb className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                          <span>Giải thích:</span>
                        </div>
                        <p className="text-foreground/90 leading-relaxed pl-5">
                          {displayExplanation}
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </Card>

      {/* Top 10 Leaderboard Modal (Story 4.4) */}
      <LeaderboardModal
        isOpen={showLeaderboard}
        onClose={() => setShowLeaderboard(false)}
        campaignTitle={campaign?.title}
        campaignSlug={campaignSlug}
        highlightLeadId={submittedLeadId || undefined}
        currentLeadRank={submittedLeadRank || undefined}
      />

      {/* Manual Copy Dialog Fallback (Story 4.5) */}
      {manualShareText && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-canvas/85 p-4 backdrop-blur-sm animate-fadeIn"
          role="dialog"
          aria-modal="true"
          aria-label="Sao chép nội dung chia sẻ"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setManualShareText(null);
            }
          }}
        >
          <Card
            variant="player"
            className="w-full max-w-md p-5 space-y-3"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-border-subtle pb-2.5">
              <h4 className="text-sm font-bold text-foreground flex items-center gap-1.5">
                <Share2 className="w-4 h-4 text-primary-400" />
                <span>Nội dung chia sẻ lên Facebook</span>
              </h4>
              <button
                type="button"
                onClick={() => setManualShareText(null)}
                className="text-content-secondary hover:text-foreground p-1"
                aria-label="Đóng"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-xs text-content-secondary">
              Trình duyệt không hỗ trợ chia sẻ tự động. Bạn vui lòng chọn và sao chép đoạn văn bản bên dưới để dán lên Facebook:
            </p>
            <textarea
              ref={manualTextareaRef}
              readOnly
              value={manualShareText}
              rows={4}
              className="w-full rounded-xl border border-border-tactile bg-recessed p-3 text-xs text-foreground font-mono select-all focus:outline-none focus:ring-2 focus:ring-primary"
              onFocus={(e) => e.target.select()}
              aria-label="Đoạn văn bản chia sẻ"
            />
            <Button
              type="button"
              variant="tactile-secondary"
              size="default"
              onClick={() => setManualShareText(null)}
              className="w-full"
            >
              Đóng
            </Button>
          </Card>
        </div>
      )}
    </div>
  );
};

export default ResultScreen;
