import React, { useState } from 'react';
import {
  Sparkles,
  Trophy,
  Gift,
  Clock,
  AlertCircle,
  Play,
  RefreshCw,
} from 'lucide-react';
import { MOCK_MODE_LABEL } from '../../types/quiz';
import type { PublicCampaign } from '../../types/campaign';
import { playerApi, type QuizSessionInit } from '../../services/playerApi';
import type { QuizGameSessionResult } from '../../services/scoring';
import { QuizGameScreen } from './QuizGameScreen';
import { ResultScreen } from './ResultScreen';
import { LeaderboardModal } from './LeaderboardModal';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Card } from '../ui/card';
import { ErrorBoundary } from '../common/ErrorBoundary';

export interface PublicCampaignScreenProps {
  campaign: PublicCampaign;
}

/**
 * Public player interface for a PUBLISHED campaign (`/quiz/:slug` or `/`).
 * Connects directly to server-authoritative quiz sessions, server-side scoring,
 * lead submission, voucher unlocking, and leaderboard ranking.
 */
export const PublicCampaignScreen: React.FC<PublicCampaignScreenProps> = ({ campaign }) => {
  const [stage, setStage] = useState<'landing' | 'playing' | 'result'>('landing');
  const [session, setSession] = useState<QuizSessionInit | null>(null);
  const [isStarting, setIsStarting] = useState<boolean>(false);
  const [startError, setStartError] = useState<string | null>(null);
  const [quizResult, setQuizResult] = useState<QuizGameSessionResult | null>(null);
  const [showLeaderboard, setShowLeaderboard] = useState<boolean>(false);

  const handleStartQuiz = async () => {
    setIsStarting(true);
    setStartError(null);
    try {
      const init = await playerApi.startSession(campaign.slug);
      setSession(init);
      setStage('playing');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Không thể khởi tạo lượt chơi. Vui lòng thử lại.';
      setStartError(msg);
    } finally {
      setIsStarting(false);
    }
  };

  if (stage === 'playing' && session) {
    return (
      <ErrorBoundary onReset={() => setStage('landing')}>
        <QuizGameScreen
          initialSession={session}
          campaign={{
            id: campaign.id,
            title: campaign.title,
            description: campaign.description,
            industry: campaign.industry,
            questions: [],
            voucher: campaign.voucher
              ? {
                  code: '',
                  discount: campaign.voucher.discount,
                  description: campaign.voucher.description,
                  expiryDate: campaign.voucher.expiryDate,
                  terms: campaign.voucher.terms,
                }
              : { code: '', discount: '', description: '' },
            createdAt: '',
            updatedAt: '',
          }}
          onExitToWelcome={() => setStage('landing')}
          onQuizCompleted={(res) => {
            setQuizResult(res);
            setStage('result');
          }}
        />
      </ErrorBoundary>
    );
  }

  if (stage === 'result' && quizResult) {
    return (
      <ResultScreen
        result={quizResult}
        campaign={{
          id: campaign.id,
          title: campaign.title,
          description: campaign.description,
          industry: campaign.industry,
          questions: [],
          voucher: campaign.voucher
            ? {
                code: '',
                discount: campaign.voucher.discount,
                description: campaign.voucher.description,
                expiryDate: campaign.voucher.expiryDate,
                terms: campaign.voucher.terms,
              }
            : { code: '', discount: '', description: '' },
          createdAt: '',
          updatedAt: '',
        }}
        sessionToken={session?.sessionToken}
        campaignSlug={campaign.slug}
        onPlayAgain={() => {
          setQuizResult(null);
          setSession(null);
          setStage('landing');
        }}
        onBackToWelcome={() => setStage('landing')}
      />
    );
  }

  return (
    <div data-testid="public-campaign-screen" className="mx-auto w-full max-w-[480px] px-4 py-5 sm:py-8">
      {campaign.isMock && (
        <div className="mb-4 flex items-center justify-center gap-2 rounded-xl border border-amber-500/35 bg-amber-500/10 px-4 py-2.5 text-center text-xs sm:text-sm font-semibold text-amber-300">
          <AlertCircle className="h-4 w-4 shrink-0 text-amber-400" />
          <span>{campaign.mockLabel || MOCK_MODE_LABEL}</span>
        </div>
      )}

      <Card variant="player" className="p-5 sm:p-7 space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border-subtle pb-4">
          <div className="flex items-center gap-1.5">
            <Badge variant="outline" className="font-medium text-content-secondary">
              {campaign.industry}
            </Badge>
            <Badge variant="secondary" tabularNums className="font-semibold text-foreground">
              {campaign.questionCount} câu
            </Badge>
          </div>
        </div>

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

        {campaign.voucher && (
          <div className="relative overflow-hidden rounded-2xl border-2 border-dashed border-amber-500/45 bg-recessed p-4 sm:p-5 space-y-3">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-3 min-w-0">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-amber-500/35 bg-amber-500/15 text-amber-400">
                  <Gift className="h-5 w-5" />
                </div>
                <div className="min-w-0 space-y-0.5">
                  <p className="text-xs font-bold text-amber-400">Phần thưởng vượt qua thử thách</p>
                  <h3 className="text-base sm:text-lg font-extrabold text-foreground leading-snug">
                    {campaign.voucher.discount}
                  </h3>
                </div>
              </div>

              <div className="shrink-0 rounded-xl border border-amber-500/35 bg-card px-2.5 py-1.5 text-center">
                <span className="block text-[10px] font-semibold text-content-secondary">Mã ưu đãi</span>
                <span
                  className="font-mono text-xs font-black tracking-wider text-amber-400"
                  aria-label="Mã ưu đãi được mở khóa sau khi hoàn thành"
                >
                  ••••••
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
                  <p className="text-[11px] text-content-muted leading-snug">* {campaign.voucher.terms}</p>
                )}
              </div>
            </div>
          </div>
        )}

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

          <button
            type="button"
            onClick={() => setShowLeaderboard(true)}
            className="rounded-xl border border-border-tactile border-b-2 bg-recessed p-3.5 space-y-1 text-left hover:border-amber-500/50 transition-colors cursor-pointer"
          >
            <div className="flex items-center gap-2 text-amber-400">
              <Trophy className="h-4 w-4 shrink-0 text-amber-400" />
              <span className="text-xs font-bold text-foreground tabular-nums">Đua Top 10</span>
            </div>
            <p className="text-[11px] text-content-secondary leading-relaxed">
              Ghi danh bảng xếp hạng cao thủ và nhận ngay mã voucher ưu đãi.
            </p>
          </button>
        </div>

        {startError && (
          <div className="rounded-xl border border-destructive/40 bg-destructive/10 p-3 text-xs text-rose-200 flex items-start gap-2">
            <AlertCircle className="h-4 w-4 shrink-0 text-destructive mt-0.5" />
            <div className="space-y-1 flex-1">
              <p className="font-semibold">{startError}</p>
              <button
                type="button"
                onClick={handleStartQuiz}
                className="underline hover:no-underline font-bold text-rose-300 inline-flex items-center gap-1"
              >
                <RefreshCw className="h-3 w-3" />
                <span>Thử lại</span>
              </button>
            </div>
          </div>
        )}

        <div className="space-y-3 pt-1">
          <Button
            type="button"
            variant="tactile-primary"
            size="xl"
            data-testid="start-quiz-btn"
            isLoading={isStarting}
            onClick={handleStartQuiz}
            className="w-full gap-2.5 text-base sm:text-lg font-extrabold"
          >
            {!isStarting && <Play className="w-5 h-5 fill-current" />}
            <span>{isStarting ? 'Đang kết nối phiên chơi...' : 'Bắt đầu chơi ngay!'}</span>
          </Button>

          <div
            id="gameplay-security-notice"
            data-testid="gameplay-security-notice"
            role="status"
            className="flex items-start gap-2.5 rounded-xl border border-border-subtle bg-recessed p-3 text-left text-[11px] sm:text-xs text-content-secondary leading-relaxed"
          >
            <Trophy className="h-4 w-4 shrink-0 text-emerald-400 mt-0.5" />
            <span>
              Trả lời nhanh và chính xác để đạt điểm cao hơn.
            </span>
          </div>
        </div>
      </Card>

      <LeaderboardModal
        isOpen={showLeaderboard}
        onClose={() => setShowLeaderboard(false)}
        campaignTitle={campaign.title}
        campaignSlug={campaign.slug}
      />
    </div>
  );
};
