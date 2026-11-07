import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  Clock,
  ArrowLeft,
  AlertCircle,
  HelpCircle,
  Check,
  X,
  Lightbulb,
  Award,
  Zap,
  Loader2,
  RefreshCw,
} from 'lucide-react';
import { Campaign, Question } from '../../types';
import { useCountdownTimer, TimerUrgency } from '../../hooks';
import {
  calculateSpeedScore,
  QuestionPlayResult,
  QuizGameSessionResult,
} from '../../services/scoring';
import { Card } from '../ui/card';
import { Button } from '../ui/button';
import { playerApi, type QuizSessionInit, type PublicQuestionPlay } from '../../services/playerApi';

export interface QuizGameScreenProps {
  campaign?: Campaign | null;
  initialSession?: QuizSessionInit | null;
  onExitToWelcome: () => void;
  onQuizCompleted?: (result: QuizGameSessionResult) => void;
  answerTransitionDelayMs?: number; // default 800ms per EXPERIENCE.md
  timeoutTransitionDelayMs?: number; // default 1000ms per EXPERIENCE.md
}

/**
 * Maps timer urgency level to Tailwind styling classes (DESIGN.md & EXPERIENCE.md).
 */
export function getUrgencyClasses(urgency: TimerUrgency): {
  container: string;
  badge: string;
  bar: string;
  dotColor: string;
} {
  switch (urgency) {
    case 'safe':
      return {
        container: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300',
        badge: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
        bar: 'bg-emerald-500',
        dotColor: 'bg-emerald-400',
      };
    case 'caution':
      return {
        container: 'border-amber-500/40 bg-amber-500/10 text-amber-300',
        badge: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
        bar: 'bg-amber-500',
        dotColor: 'bg-amber-400',
      };
    case 'urgent':
      return {
        container: 'border-rose-500/60 bg-rose-500/20 text-rose-200 animate-pulse',
        badge: 'bg-rose-500/30 text-rose-200 border-rose-500/50 animate-pulse',
        bar: 'bg-rose-500',
        dotColor: 'bg-rose-400 animate-ping',
      };
    case 'timeout':
      return {
        container: 'border-rose-600 bg-rose-600/30 text-rose-200',
        badge: 'bg-rose-600 text-white font-black',
        bar: 'bg-rose-600',
        dotColor: 'bg-rose-600',
      };
  }
}

export const QuizGameScreen: React.FC<QuizGameScreenProps> = ({
  campaign,
  initialSession,
  onExitToWelcome,
  onQuizCompleted,
  answerTransitionDelayMs = 800,
  timeoutTransitionDelayMs = 1000,
}) => {
  // 5-Question Progression & Scoring State (Story 3.4)
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState<number>(0);
  const [totalScore, setTotalScore] = useState<number>(0);
  const [questionResults, setQuestionResults] = useState<QuestionPlayResult[]>([]);
  const [serverQuestion, setServerQuestion] = useState<PublicQuestionPlay | null>(
    () => initialSession?.currentQuestion || null
  );

  // Per-question interaction states
  const [selectedOptionIndex, setSelectedOptionIndex] = useState<number | null>(null);
  const [isAnswered, setIsAnswered] = useState<boolean>(false);
  const [timeoutOccurred, setTimeoutOccurred] = useState<boolean>(false);
  const [awardedScore, setAwardedScore] = useState<number | null>(null);

  // Per-question feedback from server (for server-authoritative sessions)
  const [serverExplanation, setServerExplanation] = useState<string | null>(null);
  const [serverCorrectIndex, setServerCorrectIndex] = useState<number | null>(null);
  const [submissionError, setSubmissionError] = useState<string | null>(null);

  // Synchronous mutual-exclusion lock ref to prevent race conditions
  const isLockedRef = useRef<boolean>(false);
  const isAdvancingRef = useRef<boolean>(false);
  const hasCompletedRef = useRef<boolean>(false);
  const advanceTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Clear transition timer on unmount
  useEffect(() => {
    return () => {
      if (advanceTimeoutRef.current !== null) {
        clearTimeout(advanceTimeoutRef.current);
      }
    };
  }, []);

  // Safe question resolution helper
  const questionsList = campaign?.questions || [];
  const currentQuestion: Question | undefined = questionsList[currentQuestionIndex];
  const totalQuestions = initialSession ? initialSession.totalQuestions : (questionsList.length || 5);
  const activeQuestionText = initialSession ? (serverQuestion?.questionText || '') : (currentQuestion?.question || '');
  const activeOptions = initialSession ? (serverQuestion?.options || ['A', 'B', 'C', 'D']) : (currentQuestion?.options || []);

  // Question advancement function (Story 3.4)
  const advanceToNextQuestion = useCallback(
    (currentResult: QuestionPlayResult) => {
      if (isAdvancingRef.current) return;
      isAdvancingRef.current = true;

      const nextResults = [...questionResults, currentResult];
      setQuestionResults(nextResults);

      const nextIndex = currentQuestionIndex + 1;

      if (nextIndex < totalQuestions) {
        // Advance to next question with a fresh 30s timer
        setCurrentQuestionIndex(nextIndex);
        setSelectedOptionIndex(null);
        setIsAnswered(false);
        setTimeoutOccurred(false);
        setAwardedScore(null);
        setServerExplanation(null);
        setServerCorrectIndex(null);
        setSubmissionError(null);
        isLockedRef.current = false;
        isAdvancingRef.current = false;

        // Reset timer synchronously with fresh 30 seconds
        timer.reset(30);
      } else {
        // Completed all 5 questions — transition exactly once to result state
        if (!hasCompletedRef.current) {
          hasCompletedRef.current = true;
          const finalScore = nextResults.reduce((acc, r) => acc + r.score, 0);
          const finalCorrect = nextResults.filter((r) => r.isCorrect).length;
          const totalTimeSpent = nextResults.reduce((acc, r) => acc + r.timeSpentSeconds, 0);

          const completionPayload: QuizGameSessionResult = {
            campaignId: initialSession ? initialSession.campaignId : (campaign?.id || 'unknown'),
            totalScore: finalScore,
            totalCorrect: finalCorrect,
            totalQuestions,
            totalTimeSpentSeconds: totalTimeSpent,
            results: nextResults,
            completedAt: new Date().toISOString(),
          };

          onQuizCompleted?.(completionPayload);
        }
      }
    },
    [currentQuestionIndex, totalQuestions, questionResults, campaign?.id, initialSession, onQuizCompleted]
  );

  // 00:00 Timeout Handler with Mutual Exclusion (FR-204, TC-05)
  const handleTimerTimeout = useCallback(() => {
    // If an answer was already selected, reject timeout
    if (isLockedRef.current || isAnswered) return;

    if (initialSession) {
      isLockedRef.current = true;
      setTimeoutOccurred(true);
      setAwardedScore(0);

      playerApi
        .submitAnswer(initialSession.sessionToken, currentQuestionIndex, null)
        .then((res) => {
          if (typeof res.correctIndex === 'number') {
            setServerCorrectIndex(res.correctIndex);
          }
          if (typeof res.explanation === 'string' && res.explanation.trim().length > 0) {
            setServerExplanation(res.explanation);
          } else {
            setServerExplanation(null);
          }

          const qResult: QuestionPlayResult = {
            questionIndex: currentQuestionIndex,
            questionId: `q_${currentQuestionIndex + 1}`,
            question: activeQuestionText,
            options: activeOptions,
            selectedOptionIndex: null,
            correctIndex: typeof res.correctIndex === 'number' ? res.correctIndex : -1,
            isCorrect: false,
            timeRemainingSeconds: 0,
            timeSpentSeconds: 30,
            score: 0,
            explanation: res.explanation ?? undefined,
          };

          const nextResults = [...questionResults, qResult];
          setQuestionResults(nextResults);

          advanceTimeoutRef.current = setTimeout(() => {
            if (res.isComplete) {
              if (!hasCompletedRef.current) {
                hasCompletedRef.current = true;
                onQuizCompleted?.({
                  campaignId: initialSession.campaignId,
                  totalScore: res.totalScore,
                  totalCorrect: res.result?.correctCount ?? nextResults.filter((r) => r.isCorrect).length,
                  totalQuestions: 5,
                  totalTimeSpentSeconds: res.result?.timeTakenSeconds ?? 30,
                  results: nextResults,
                  completedAt: new Date().toISOString(),
                });
              }
            } else if (res.nextQuestion) {
              setServerQuestion(res.nextQuestion);
              setCurrentQuestionIndex(res.nextQuestion.questionIndex);
              setSelectedOptionIndex(null);
              setIsAnswered(false);
              setTimeoutOccurred(false);
              setAwardedScore(null);
              setServerExplanation(null);
              setServerCorrectIndex(null);
              setSubmissionError(null);
              isLockedRef.current = false;
              isAdvancingRef.current = false;
              timer.reset(30);
            }
          }, timeoutTransitionDelayMs);
        })
        .catch(() => {
          onExitToWelcome();
        });
      return;
    }

    isLockedRef.current = true;
    setTimeoutOccurred(true);
    setAwardedScore(0);

    const questionResult: QuestionPlayResult = {
      questionIndex: currentQuestionIndex,
      questionId: currentQuestion?.id || `q_${currentQuestionIndex + 1}`,
      question: currentQuestion?.question || '',
      options: currentQuestion?.options,
      explanation: currentQuestion?.explanation,
      selectedOptionIndex: null,
      correctIndex: currentQuestion ? currentQuestion.correctIndex : 0,
      isCorrect: false,
      timeRemainingSeconds: 0,
      timeSpentSeconds: 30,
      score: 0,
    };

    // Auto-advance after timeout transition delay (1000ms per EXPERIENCE.md)
    advanceTimeoutRef.current = setTimeout(() => {
      advanceToNextQuestion(questionResult);
    }, timeoutTransitionDelayMs);
  }, [
    isAnswered,
    currentQuestionIndex,
    currentQuestion,
    initialSession,
    activeQuestionText,
    activeOptions,
    questionResults,
    timeoutTransitionDelayMs,
    advanceToNextQuestion,
    onQuizCompleted,
    onExitToWelcome,
  ]);

  // High-precision countdown timer hook
  const timer = useCountdownTimer({
    durationSeconds: 30,
    autoStart: true,
    onTimeout: handleTimerTimeout,
  });

  const urgencyClasses = getUrgencyClasses(timer.urgency);

  const submitServerAnswer = (index: number, clientRemainingSec?: number) => {
    if (!initialSession) return;
    setSubmissionError(null);
    isLockedRef.current = true;

    playerApi
      .submitAnswer(initialSession.sessionToken, currentQuestionIndex, index)
      .then((res) => {
        setSubmissionError(null);
        setAwardedScore(res.pointsEarned);
        setTotalScore(res.totalScore);
        if (typeof res.correctIndex === 'number') {
          setServerCorrectIndex(res.correctIndex);
        }
        if (typeof res.explanation === 'string' && res.explanation.trim().length > 0) {
          setServerExplanation(res.explanation);
        } else {
          setServerExplanation(null);
        }

        const remainingSec = typeof res.remainingSeconds === 'number'
          ? res.remainingSeconds
          : (res.isCorrect && res.pointsEarned > 100
              ? Math.round((res.pointsEarned - 100) / 10)
              : (clientRemainingSec ?? 0));
        const spentSec = Math.max(0, 30 - remainingSec);

        const questionResult: QuestionPlayResult = {
          questionIndex: currentQuestionIndex,
          questionId: `q_${currentQuestionIndex + 1}`,
          question: activeQuestionText,
          options: activeOptions,
          selectedOptionIndex: index,
          correctIndex: typeof res.correctIndex === 'number' ? res.correctIndex : (res.isCorrect ? index : -1),
          isCorrect: res.isCorrect,
          timeRemainingSeconds: remainingSec,
          timeSpentSeconds: spentSec,
          score: res.pointsEarned,
          explanation: res.explanation ?? undefined,
        };

        const nextResults = [...questionResults, questionResult];
        setQuestionResults(nextResults);

        advanceTimeoutRef.current = setTimeout(() => {
          if (res.isComplete) {
            if (!hasCompletedRef.current) {
              hasCompletedRef.current = true;
              onQuizCompleted?.({
                campaignId: initialSession.campaignId,
                totalScore: res.totalScore,
                totalCorrect: res.result?.correctCount ?? nextResults.filter((r) => r.isCorrect).length,
                totalQuestions: 5,
                totalTimeSpentSeconds: res.result?.timeTakenSeconds ?? nextResults.reduce((a, b) => a + b.timeSpentSeconds, 0),
                results: nextResults,
                completedAt: new Date().toISOString(),
              });
            }
          } else if (res.nextQuestion) {
            setServerQuestion(res.nextQuestion);
            setCurrentQuestionIndex(res.nextQuestion.questionIndex);
            setSelectedOptionIndex(null);
            setIsAnswered(false);
            setTimeoutOccurred(false);
            setAwardedScore(null);
            setServerExplanation(null);
            setServerCorrectIndex(null);
            setSubmissionError(null);
            isLockedRef.current = false;
            isAdvancingRef.current = false;
            timer.reset(30);
          }
        }, answerTransitionDelayMs);
      })
      .catch((err) => {
        console.warn('[QuizGame] Submit answer error:', err);
        setSubmissionError('Không thể gửi đáp án lên máy chủ. Vui lòng kiểm tra kết nối mạng và thử lại.');
        isLockedRef.current = false;
      });
  };

  // Answer selection handler with Speed Scoring (FR-203, TC-02)
  const handleSelectOption = (index: number) => {
    // Guard against duplicate taps, late clicks, or clicks after timeout
    if (isLockedRef.current || isAnswered || timeoutOccurred) {
      return;
    }

    // Real-time wall-clock verification (Zero-second boundary protection)
    // If the 30s deadline elapsed before setInterval tick executed,
    // trigger timeout synchronously and reject this late answer.
    const remainingMs = timer.getRemainingMs();
    if (remainingMs <= 0) {
      handleTimerTimeout();
      return;
    }

    // Immediately lock interaction
    isLockedRef.current = true;
    setSubmissionError(null);
    setIsAnswered(true);
    setSelectedOptionIndex(index);

    // Pause timer immediately to freeze remaining time
    timer.pause();

    const remainingSeconds = Math.max(1, Math.min(30, Math.ceil(remainingMs / 1000)));

    if (initialSession) {
      submitServerAnswer(index, remainingSeconds);
      return;
    }

    // Deterministic speed scoring at the exact moment of acceptance
    const isCorrect = currentQuestion ? index === currentQuestion.correctIndex : false;
    const earnedPoints = calculateSpeedScore(isCorrect, remainingSeconds);

    setAwardedScore(earnedPoints);
    setTotalScore((prev) => prev + earnedPoints);

    const questionResult: QuestionPlayResult = {
      questionIndex: currentQuestionIndex,
      questionId: currentQuestion?.id || `q_${currentQuestionIndex + 1}`,
      question: currentQuestion?.question || '',
      options: currentQuestion?.options,
      explanation: currentQuestion?.explanation,
      selectedOptionIndex: index,
      correctIndex: currentQuestion ? currentQuestion.correctIndex : 0,
      isCorrect,
      timeRemainingSeconds: remainingSeconds,
      timeSpentSeconds: Math.max(0, 30 - remainingSeconds),
      score: earnedPoints,
    };

    // Auto-advance after feedback flash (800ms per EXPERIENCE.md)
    advanceTimeoutRef.current = setTimeout(() => {
      advanceToNextQuestion(questionResult);
    }, answerTransitionDelayMs);
  };

  const handleRetryAnswer = () => {
    if (selectedOptionIndex === null || !initialSession) return;
    submitServerAnswer(selectedOptionIndex);
  };

  // If campaign is missing or empty, fallback gracefully
  if (!initialSession && (!campaign || !campaign.questions || campaign.questions.length === 0 || !currentQuestion)) {
    return (
      <div className="mx-auto w-full max-w-[480px] px-4 py-8">
        <Card variant="player" className="p-6 text-center space-y-4">
          <HelpCircle className="mx-auto h-10 w-10 text-amber-400" />
          <h2 className="text-lg font-bold text-foreground">Không tìm thấy câu hỏi</h2>
          <p className="text-xs text-content-secondary">
            Chiến dịch hiện tại chưa có dữ liệu câu hỏi để bắt đầu.
          </p>
          <Button
            type="button"
            variant="tactile-secondary"
            size="default"
            onClick={onExitToWelcome}
          >
            Quay lại trang Chào mừng
          </Button>
        </Card>
      </div>
    );
  }

  const optionLetters = ['A', 'B', 'C', 'D'];
  const hasEnded = isAnswered || timeoutOccurred || timer.hasTimedOut;
  const rawExplanation = serverExplanation ?? currentQuestion?.explanation ?? null;
  const activeExplanation =
    typeof rawExplanation === 'string' && rawExplanation.trim().length > 0
      ? rawExplanation.trim()
      : null;

  return (
    <div className="mx-auto w-full max-w-[480px] px-4 py-4 sm:py-7">
      {/* Quiz Gameplay Flashcard Container */}
      <Card variant="player" className="p-4 sm:p-6 space-y-4">
        {/* Top HUD: Step Tracker, Scoreboard & 30s Countdown Timer */}
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-2">
            {/* Step Tracker */}
            <div className="flex items-center gap-2 min-w-0">
              <span className="inline-flex items-center rounded-lg border border-primary/35 bg-primary/15 px-2.5 py-1 font-mono tabular-nums text-xs font-extrabold text-primary-300">
                Câu {currentQuestionIndex + 1} / {totalQuestions}
              </span>
              <span className="hidden xs:inline text-xs text-content-muted">&bull;</span>
              <span className="hidden sm:inline text-xs text-content-secondary font-medium truncate max-w-[130px]">
                {campaign?.industry || 'Minigame'}
              </span>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              {/* Live Score Counter */}
              <div className="flex items-center gap-1.5 rounded-xl border border-amber-500/35 bg-amber-500/10 px-2.5 py-1 text-xs font-bold text-amber-300">
                <Award className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                <span className="font-mono tabular-nums font-extrabold">{totalScore} đ</span>
              </div>

              {/* Synchronized 30-Second Timer Pill (FR-202) */}
              <div
                className={`flex items-center gap-1.5 rounded-xl border px-3 py-1 text-xs font-bold transition-colors motion-reduce:transition-none ${urgencyClasses.container}`}
                role="timer"
                aria-live="polite"
                aria-label={`Thời gian còn lại: ${timer.secondsRemaining} giây`}
              >
                <Clock className="w-3.5 h-3.5 shrink-0" />
                <span className="font-mono tabular-nums tracking-wider text-sm font-black">
                  {timer.secondsRemaining}s
                </span>
                <span className={`inline-block h-2 w-2 rounded-full ${urgencyClasses.dotColor}`} />
              </div>
            </div>
          </div>

          {/* Synchronized Time Progress Bar */}
          <div className="h-2 w-full overflow-hidden rounded-full bg-recessed border border-border-subtle">
            <div
              className={`h-full transition-all duration-100 ease-linear motion-reduce:transition-none ${urgencyClasses.bar}`}
              style={{ width: `${timer.progressPercent}%` }}
            />
          </div>
        </div>

        {/* Timeout Flash Alert (at 00:00 per EXPERIENCE.md) */}
        {timeoutOccurred && !isAnswered && (
          <div className="rounded-xl border-2 border-rose-500/60 bg-rose-500/15 px-4 py-3 text-center text-xs font-bold text-rose-200 animate-pulse flex items-center justify-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
            <span>Hết giờ! (0 điểm)</span>
          </div>
        )}

        {/* Score Awarded Banner */}
        {isAnswered && awardedScore !== null && (
          <div
            className={`rounded-xl border-2 px-3.5 py-2.5 text-center text-xs font-bold animate-fadeIn flex items-center justify-center gap-2 ${
              awardedScore > 0
                ? 'border-emerald-500/50 bg-emerald-500/15 text-emerald-200'
                : 'border-rose-500/50 bg-rose-500/15 text-rose-200'
            }`}
          >
            <Zap className={`w-4 h-4 shrink-0 ${awardedScore > 0 ? 'text-amber-300 fill-amber-300' : 'text-rose-400'}`} />
            <span className="tabular-nums">
              {awardedScore > 0
                ? `Chính xác! +${awardedScore} điểm (Tốc độ: ${timer.secondsRemaining}s)`
                : 'Chưa chính xác! (0 điểm)'}
            </span>
          </div>
        )}

        {/* Quizlet-Inspired Flashcard Question Well */}
        <div className="rounded-2xl border border-border-tactile bg-recessed p-4 sm:p-5">
          <div className="mb-1.5 flex items-center justify-between text-xs font-semibold text-content-secondary">
            <span>Câu hỏi thử thách</span>
            <span className="font-mono tabular-nums text-primary-400">
              #{currentQuestionIndex + 1}
            </span>
          </div>
          <h2 className="text-[18px] sm:text-xl font-bold text-foreground leading-[1.4]">
            {activeQuestionText}
          </h2>
        </div>

        {/* 4 Tactile 3D Answer Choices (Duolingo #2 Mechanics — Story 3.3 & 3.4) */}
        <div className="space-y-2.5" role="group" aria-label="Các phương án trả lời">
          {activeOptions.map((optionText, idx) => {
            const isSelected = selectedOptionIndex === idx;
            const resolvedCorrectIndex =
              serverCorrectIndex !== null
                ? serverCorrectIndex
                : currentQuestion
                ? currentQuestion.correctIndex
                : null;
            const isCorrectOption =
              resolvedCorrectIndex !== null ? idx === resolvedCorrectIndex : false;
            const letter = optionLetters[idx];

            // Consistent border-2 border-b-4 geometry so choices never shift or reflow unpredictably
            let optionStyling =
              'border-border-tactile border-b-border-tactile-depth bg-recessed text-foreground hover:bg-interactive hover:border-primary/60 hover:border-b-primary-depth active:translate-y-[2px] active:border-b-2 cursor-pointer';
            let badgeStyling =
              'border border-border-tactile bg-card text-content-secondary group-hover:border-primary/50 group-hover:text-primary-300';

            const isCorrectSelection =
              initialSession
                ? awardedScore !== null && awardedScore > 0
                : isCorrectOption;

            if (isAnswered) {
              if (isSelected) {
                if (initialSession && awardedScore === null) {
                  // Immediate visual pressed/selected & verifying state
                  optionStyling =
                    'border-primary/80 border-b-2 translate-y-[2px] bg-primary/25 text-foreground cursor-default ring-1 ring-primary/40 shadow-inner';
                  badgeStyling = 'border-primary/60 bg-primary/30 text-primary-200';
                } else if (isCorrectSelection) {
                  // Chosen & Correct
                  optionStyling =
                    'border-emerald-500 border-b-emerald-700 bg-emerald-500/15 text-emerald-50 cursor-default';
                  badgeStyling = 'border-emerald-400 bg-emerald-500 text-slate-950';
                } else {
                  // Chosen & Incorrect
                  optionStyling =
                    'border-rose-500 border-b-rose-700 bg-rose-500/15 text-rose-50 cursor-default';
                  badgeStyling = 'border-rose-400 bg-rose-500 text-white';
                }
              } else if (resolvedCorrectIndex !== null && idx === resolvedCorrectIndex) {
                // Not chosen, but revealed as the correct answer
                optionStyling =
                  'border-emerald-500/70 border-b-emerald-800 bg-emerald-500/10 text-emerald-200 cursor-default';
                badgeStyling = 'border-emerald-500/50 bg-emerald-500/25 text-emerald-300';
              } else {
                // Unselected distractor
                optionStyling =
                  'border-border-subtle border-b-border-subtle bg-recessed/50 text-content-muted opacity-45 cursor-default';
                badgeStyling = 'border-border-subtle bg-card/50 text-content-muted';
              }
            } else if (timeoutOccurred) {
              if (resolvedCorrectIndex !== null && idx === resolvedCorrectIndex) {
                // Reveal correct answer upon timeout
                optionStyling =
                  'border-emerald-500/70 border-b-emerald-800 bg-emerald-500/15 text-emerald-200 cursor-default';
                badgeStyling = 'border-emerald-500/50 bg-emerald-500/25 text-emerald-300';
              } else {
                optionStyling =
                  'border-border-subtle border-b-border-subtle bg-recessed/50 text-content-muted opacity-45 cursor-default';
                badgeStyling = 'border-border-subtle bg-card/50 text-content-muted';
              }
            }

            return (
              <button
                key={idx}
                type="button"
                data-testid={`option-btn-${idx}`}
                onClick={() => handleSelectOption(idx)}
                disabled={hasEnded}
                aria-pressed={isSelected}
                className={`group flex min-h-[54px] w-full items-center justify-between gap-3 rounded-xl border-2 border-b-4 px-3.5 py-3 text-left text-xs sm:text-sm transition-all duration-100 motion-reduce:transition-none focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 ${optionStyling}`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <span
                    className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg font-mono text-xs font-extrabold transition-colors ${badgeStyling}`}
                  >
                    {isAnswered && isSelected && (awardedScore !== null || !initialSession) ? (
                      isCorrectSelection ? (
                        <Check className="w-4 h-4 stroke-[3]" />
                      ) : (
                        <X className="w-4 h-4 stroke-[3]" />
                      )
                    ) : isAnswered && isSelected && initialSession && awardedScore === null ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin text-primary-300" />
                    ) : (
                      letter
                    )}
                  </span>
                  <span className="font-semibold leading-[1.35] break-words">
                    {optionText}
                  </span>
                </div>

                {/* State Tag Feedback */}
                {isAnswered && isSelected && (
                  initialSession && awardedScore === null ? (
                    <span className="shrink-0 inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 font-mono text-[11px] font-semibold text-primary-300 bg-primary/20 border border-primary/35 animate-pulse">
                      <Loader2 className="w-3 h-3 animate-spin text-primary-400" />
                      <span>Đang kiểm tra...</span>
                    </span>
                  ) : (
                    awardedScore !== null && (
                      <span
                        className={`shrink-0 rounded-md px-2 py-0.5 font-mono tabular-nums text-[11px] font-bold ${
                          isCorrectSelection
                            ? 'bg-emerald-500/25 text-emerald-300 border border-emerald-500/40'
                            : 'bg-rose-500/25 text-rose-300 border border-rose-500/40'
                        }`}
                      >
                        {isCorrectSelection ? `+${awardedScore}đ` : '+0đ'}
                      </span>
                    )
                  )
                )}

                {hasEnded && !isSelected && isCorrectOption && (
                  <span className="shrink-0 rounded-md bg-emerald-500/20 px-2 py-0.5 text-[11px] font-bold text-emerald-300 border border-emerald-500/35">
                    Đáp án đúng
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Submission Error Banner & Retry */}
        {submissionError && (
          <div className="rounded-xl border border-rose-500/40 bg-rose-950/40 p-3 text-xs text-rose-200 flex items-center justify-between gap-3 animate-fadeIn">
            <div className="flex items-center gap-2 min-w-0">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
              <span className="leading-snug">{submissionError}</span>
            </div>
            <Button
              type="button"
              variant="tactile-secondary"
              size="compact"
              onClick={handleRetryAnswer}
              className="shrink-0 gap-1.5 text-xs text-rose-200 border-rose-500/40 hover:bg-rose-500/20"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Thử lại</span>
            </Button>
          </div>
        )}

        {/* Question Explanation Card (Shown on answer or timeout when explanation is present) */}
        {hasEnded && Boolean(activeExplanation) && (
          <div className="rounded-xl border border-primary/35 bg-primary/10 p-3.5 text-xs text-primary-200 animate-fadeIn space-y-1">
            <div className="flex items-center gap-1.5 font-bold text-primary-300">
              <Lightbulb className="w-3.5 h-3.5 shrink-0 text-amber-400" />
              <span>Giải thích đáp án:</span>
            </div>
            <p className="text-foreground/90 leading-relaxed pl-5">
              {activeExplanation}
            </p>
          </div>
        )}

        {/* Bottom Exit & Progression Status */}
        <div className="pt-2 border-t border-border-subtle space-y-3">
          <div className="flex items-center justify-between text-xs">
            <span className="text-[11px] font-medium text-content-secondary">
              {hasEnded ? 'Đang chuyển câu tiếp theo...' : 'Chọn 1 phương án để trả lời'}
            </span>
            <span className="text-[11px] font-mono tabular-nums font-bold text-primary-400">
              {currentQuestionIndex + 1}/{totalQuestions}
            </span>
          </div>

          <Button
            type="button"
            variant="tactile-secondary"
            size="default"
            onClick={onExitToWelcome}
            className="w-full gap-2 text-xs text-content-secondary hover:text-foreground"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Thoát ra trang Chào mừng</span>
          </Button>
        </div>
      </Card>
    </div>
  );
};
