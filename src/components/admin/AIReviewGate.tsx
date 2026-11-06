import React, { useState, useEffect, useRef } from 'react';
import {
  Sparkles,
  CheckCircle,
  AlertCircle,
  ChevronDown,
  ChevronUp,
  Check,
  ArrowLeft,
  ShieldCheck,
  AlertTriangle,
  ListChecks,
} from 'lucide-react';
import {
  Campaign,
  MOCK_MODE_LABEL,
  Question,
  VoucherConfig as VoucherConfigType,
} from '../../types';
import { StorageService } from '../../services';
import { validateManualQuizForm } from '../../services/validators';
import { VoucherConfig } from './VoucherConfig';
import { IndustrySelect } from './IndustrySelect';
import type { PersistCampaign } from './persistence';
import { Button, Badge, Card, Input } from '../ui';

export interface DraftCampaignData {
  title: string;
  description: string;
  industry: string;
  questions: Question[];
  voucher: VoucherConfigType;
  isAiGenerated: boolean;
  isMock: boolean;
  mockLabel?: string;
  providerName?: string;
}

export interface AIReviewGateProps {
  draft: DraftCampaignData;
  currentActiveCampaign: Campaign | null;
  onApproveAndActivate: (campaign: Campaign) => void;
  onDiscardOrCancel: () => void;
  persistCampaign?: PersistCampaign;
}

export const AIReviewGate: React.FC<AIReviewGateProps> = ({
  draft,
  currentActiveCampaign,
  onApproveAndActivate,
  onDiscardOrCancel,
  persistCampaign,
}) => {
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [title, setTitle] = useState<string>(draft.title);
  const [description, setDescription] = useState<string>(draft.description);
  const [industry, setIndustry] = useState<string>(draft.industry);

  const [questions, setQuestions] = useState<Question[]>(() =>
    draft.questions.map((q) => ({
      ...q,
      options: [...q.options] as [string, string, string, string],
      explanation: q.explanation || '',
    }))
  );

  const [voucher, setVoucher] = useState<VoucherConfigType>(() => ({
    ...draft.voucher,
  }));

  // Default all 5 AI-generated questions to expanded so human reviewers can inspect all questions immediately (A-01)
  const [expandedCards, setExpandedCards] = useState<Record<number, boolean>>({
    0: true,
    1: true,
    2: true,
    3: true,
    4: true,
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [generalErrors, setGeneralErrors] = useState<string[]>([]);
  const [showConfirmModal, setShowConfirmModal] = useState<boolean>(false);

  const approveTriggerRef = useRef<HTMLElement | null>(null);
  const cancelConfirmBtnRef = useRef<HTMLButtonElement | null>(null);
  const confirmModalRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!showConfirmModal) return;

    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const focusTimer = setTimeout(() => {
      cancelConfirmBtnRef.current?.focus();
    }, 30);

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        setShowConfirmModal(false);
        return;
      }

      if (e.key === 'Tab' && confirmModalRef.current) {
        const focusable = Array.from(
          confirmModalRef.current.querySelectorAll<HTMLElement>(
            'button:not([disabled]), [tabindex]:not([tabindex="-1"])'
          )
        );
        if (focusable.length === 0) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];

        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      clearTimeout(focusTimer);
      document.body.style.overflow = originalOverflow;
      window.removeEventListener('keydown', handleKeyDown);
      approveTriggerRef.current?.focus();
    };
  }, [showConfirmModal]);

  const allExpanded = [0, 1, 2, 3, 4].every((i) => Boolean(expandedCards[i]));

  const toggleCard = (index: number) => {
    setExpandedCards((prev) => ({
      ...prev,
      [index]: !prev[index],
    }));
  };

  const toggleAllCards = () => {
    if (allExpanded) {
      setExpandedCards({});
    } else {
      setExpandedCards({ 0: true, 1: true, 2: true, 3: true, 4: true });
    }
  };

  const handleQuestionTextChange = (qIndex: number, text: string) => {
    setQuestions((prev) => {
      const next = [...prev];
      next[qIndex] = { ...next[qIndex], question: text };
      return next;
    });

    const key = `question_${qIndex}`;
    if (errors[key]) {
      setErrors((prev) => {
        const copy = { ...prev };
        delete copy[key];
        return copy;
      });
    }
  };

  const handleOptionTextChange = (qIndex: number, optIndex: number, text: string) => {
    setQuestions((prev) => {
      const next = [...prev];
      const opts = [...next[qIndex].options] as [string, string, string, string];
      opts[optIndex] = text;
      next[qIndex] = { ...next[qIndex], options: opts };
      return next;
    });

    const key = `q_${qIndex}_opt_${optIndex}`;
    if (errors[key]) {
      setErrors((prev) => {
        const copy = { ...prev };
        delete copy[key];
        return copy;
      });
    }
  };

  const handleCorrectIndexChange = (qIndex: number, correctIdx: number) => {
    setQuestions((prev) => {
      const next = [...prev];
      next[qIndex] = { ...next[qIndex], correctIndex: correctIdx };
      return next;
    });

    const key = `correct_${qIndex}`;
    if (errors[key]) {
      setErrors((prev) => {
        const copy = { ...prev };
        delete copy[key];
        return copy;
      });
    }
  };

  const handleExplanationChange = (qIndex: number, text: string) => {
    setQuestions((prev) => {
      const next = [...prev];
      next[qIndex] = { ...next[qIndex], explanation: text };
      return next;
    });
  };

  const handleVoucherChange = (field: keyof VoucherConfigType, value: string) => {
    setVoucher((prev) => ({ ...prev, [field]: value }));
    const errKey = `voucher_${field}`;
    if (errors[errKey]) {
      setErrors((prev) => {
        const copy = { ...prev };
        delete copy[errKey];
        return copy;
      });
    }
  };

  const runValidation = () => {
    return validateManualQuizForm({
      title,
      description,
      industry,
      questions,
      voucher,
    });
  };

  const executeApprovalAndSave = async () => {
    if (isSaving) return;
    const nowIso = new Date().toISOString();
    const campaignId = draft.isMock
      ? `campaign_mock_${Date.now()}`
      : `campaign_ai_${Date.now()}`;

    const approvedCampaign: Campaign = {
      id: campaignId,
      title: title.trim(),
      description:
        description.trim() ||
        `Thử thách trắc nghiệm minigame nhận voucher độc quyền từ ${title.trim()}`,
      industry: industry.trim(),
      questions: questions.map((q, idx) => ({
        id: q.id || `q_approved_${idx + 1}_${Date.now()}`,
        question: q.question.trim(),
        options: [
          q.options[0].trim(),
          q.options[1].trim(),
          q.options[2].trim(),
          q.options[3].trim(),
        ],
        correctIndex: q.correctIndex,
        explanation: q.explanation?.trim() || undefined,
      })),
      voucher: {
        code: voucher.code.trim().toUpperCase(),
        discount: voucher.discount.trim(),
        description: voucher.description.trim(),
        expiryDate: voucher.expiryDate?.trim() || '7 ngày sau khi nhận',
        terms: voucher.terms?.trim() || 'Áp dụng trên toàn hệ thống Fanpage',
      },
      createdAt: nowIso,
      updatedAt: nowIso,
      isAiGenerated: draft.isAiGenerated,
      isMock: draft.isMock,
      mockLabel: draft.isMock ? draft.mockLabel || MOCK_MODE_LABEL : undefined,
    };

    if (persistCampaign) {
      setIsSaving(true);
      try {
        const persisted = await persistCampaign(approvedCampaign);
        if (persisted.success && persisted.campaign) {
          setShowConfirmModal(false);
          onApproveAndActivate(persisted.campaign);
        } else {
          setShowConfirmModal(false);
          if (persisted.fieldErrors) setErrors(persisted.fieldErrors);
          setGeneralErrors([
            persisted.message || 'Không thể lưu chiến dịch vào cơ sở dữ liệu. Vui lòng thử lại.',
          ]);
        }
      } catch (err: unknown) {
        setShowConfirmModal(false);
        const msg = err instanceof Error ? err.message : 'Lỗi kết nối khi lưu chiến dịch.';
        setGeneralErrors([msg]);
      } finally {
        setIsSaving(false);
      }
      return;
    }

    const saveRes = StorageService.saveCampaign(approvedCampaign);
    if (saveRes.success && saveRes.data) {
      setShowConfirmModal(false);
      onApproveAndActivate(saveRes.data);
    } else {
      setShowConfirmModal(false);
      setGeneralErrors([saveRes.message || 'Không thể lưu chiến dịch vào bộ nhớ trình duyệt.']);
    }
  };

  const handleApproveClick = (e: React.MouseEvent<HTMLButtonElement> | React.FormEvent) => {
    e.preventDefault();
    if (e.currentTarget instanceof HTMLElement) {
      approveTriggerRef.current = e.currentTarget;
    }

    const validation = runValidation();
    if (!validation.valid) {
      setErrors(validation.fieldErrors);
      setGeneralErrors(validation.generalErrors);

      const firstErrorKey = Object.keys(validation.fieldErrors)[0];
      if (firstErrorKey) {
        if (
          firstErrorKey.startsWith('question_') ||
          firstErrorKey.startsWith('q_') ||
          firstErrorKey.startsWith('options_') ||
          firstErrorKey.startsWith('correct_')
        ) {
          const match = firstErrorKey.match(/\d+/);
          if (match) {
            const errIdx = parseInt(match[0], 10);
            setExpandedCards((prev) => ({ ...prev, [errIdx]: true }));
          }
        }
      }
      return;
    }

    setErrors({});
    setGeneralErrors([]);

    if (currentActiveCampaign) {
      setShowConfirmModal(true);
    } else {
      executeApprovalAndSave();
    }
  };

  const optionLetters = ['A', 'B', 'C', 'D'];

  return (
    <div className="space-y-6">
      {/* Review Gate Header & Provenance Banner */}
      <Card className="p-5 sm:p-6">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="default" shape="compact" className="font-mono uppercase tracking-wider">
                REVIEW GATE
              </Badge>

              {draft.isMock ? (
                <Badge variant="warning" shape="compact" className="gap-1.5">
                  <AlertCircle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                  <span>{draft.mockLabel || MOCK_MODE_LABEL}</span>
                </Badge>
              ) : (
                <Badge variant="success" shape="compact" className="gap-1.5 font-mono">
                  <Sparkles className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                  <span>AI: {draft.providerName?.toUpperCase() || 'GOOGLE GEMINI 3.8 FLASH'}</span>
                </Badge>
              )}

              <Badge variant="muted" shape="compact" tabularNums className="font-mono">
                5 CÂU HỎI &bull; BẢN NHÁP
              </Badge>
            </div>

            <div>
              <h2 className="text-lg sm:text-xl font-bold tracking-tight text-foreground leading-snug">
                Kiểm duyệt &amp; Hiệu đính Nội dung trước khi Xuất bản
              </h2>
              <p className="text-xs sm:text-sm text-content-secondary mt-0.5">
                Rà soát 5 câu hỏi bên dưới, chỉnh sửa câu chữ, đáp án đúng và cấu hình mã ưu đãi trước khi kích hoạt.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-start shrink-0">
            <Button
              type="button"
              variant="secondary"
              size="compact"
              onClick={onDiscardOrCancel}
              className="gap-1.5"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Hủy &amp; Tạo lại</span>
            </Button>

            <Button
              type="button"
              variant="success"
              size="compact"
              onClick={handleApproveClick}
              className="gap-1.5"
            >
              <CheckCircle className="w-3.5 h-3.5" />
              <span>Phê duyệt &amp; Kích hoạt</span>
            </Button>
          </div>
        </div>

        {/* Global Error Banner */}
        {generalErrors.length > 0 && (
          <div className="mt-4 rounded-lg border border-destructive/40 bg-destructive/10 p-3.5 text-xs text-rose-200 space-y-1">
            <div className="flex items-center gap-2 font-semibold text-rose-300">
              <AlertCircle className="w-4 h-4 text-destructive shrink-0" />
              <span>Vui lòng hoàn thiện các trường sau trước khi phê duyệt:</span>
            </div>
            <ul className="list-disc pl-5 space-y-0.5">
              {generalErrors.map((err, i) => (
                <li key={i}>{err}</li>
              ))}
            </ul>
          </div>
        )}
      </Card>

      {/* Campaign Metadata Settings Card */}
      <Card className="p-5 sm:p-6">
        <div className="pb-4 mb-5 border-b border-border-subtle">
          <h3 className="text-sm sm:text-base font-semibold text-foreground leading-snug">
            Thông tin Chiến dịch
          </h3>
          <p className="text-xs text-content-secondary mt-0.5">
            Tên chiến dịch và phân loại ngành hàng quảng bá.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="block text-xs font-medium text-content-secondary mb-1.5">
              Tên chiến dịch minigame <span className="text-destructive">*</span>
            </label>
            <Input
              type="text"
              value={title}
              onChange={(e) => {
                setTitle(e.target.value);
                if (errors['title']) {
                  setErrors((prev) => {
                    const copy = { ...prev };
                    delete copy['title'];
                    return copy;
                  });
                }
              }}
              placeholder="VD: Thử thách kiến thức Skincare cùng GlowBeauty"
              className={errors['title'] ? 'border-destructive focus-visible:ring-destructive' : ''}
            />
            {errors['title'] && (
              <p className="mt-1.5 flex items-center text-xs text-destructive">
                <AlertCircle className="mr-1 h-3.5 w-3.5 shrink-0" /> {errors['title']}
              </p>
            )}
          </div>

          <div>
            <IndustrySelect
              label="Ngành hàng / Lĩnh vực"
              required
              selectId="review-industry-select"
              inputId="review-custom-industry-input"
              value={industry}
              onChange={(val) => {
                setIndustry(val);
                if (errors['industry']) {
                  setErrors((prev) => {
                    const copy = { ...prev };
                    delete copy['industry'];
                    return copy;
                  });
                }
              }}
              error={errors['industry']}
            />
          </div>

          <div className="sm:col-span-2">
            <label className="block text-xs font-medium text-content-secondary mb-1.5">
              Mô tả ngắn hiển thị cho người chơi
            </label>
            <Input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="VD: Tham gia trả lời 5 câu hỏi trắc nghiệm nhanh để rinh voucher giảm giá 20% độc quyền!"
            />
          </div>
        </div>
      </Card>

      {/* 5 Interactive Question Cards */}
      <div className="space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 px-0.5">
          <div className="flex items-center gap-2.5">
            <ListChecks className="h-4 w-4 text-primary shrink-0" />
            <h3 className="text-sm sm:text-base font-semibold text-foreground leading-snug">
              Kiểm duyệt 5 Câu hỏi (Đang mở toàn bộ để rà soát nhanh)
            </h3>
            <Badge variant="default" shape="compact" tabularNums className="font-mono">
              5 / 5 câu
            </Badge>
          </div>

          <button
            type="button"
            onClick={toggleAllCards}
            className="text-xs font-medium text-primary hover:text-indigo-400 transition-colors self-start sm:self-auto cursor-pointer"
          >
            {allExpanded ? 'Thu gọn tất cả' : 'Mở rộng tất cả'}
          </button>
        </div>

        <div className="space-y-2.5">
          {questions.map((q, qIndex) => {
            const isOpen = Boolean(expandedCards[qIndex]);
            const qNum = qIndex + 1;
            const formattedNum = qNum.toString().padStart(2, '0');
            const qHasError =
              errors[`question_${qIndex}`] ||
              errors[`options_${qIndex}`] ||
              errors[`correct_${qIndex}`] ||
              optionLetters.some((_, optIdx) => errors[`q_${qIndex}_opt_${optIdx}`]);

            return (
              <Card
                key={q.id || `q_${qIndex}`}
                className={`overflow-hidden transition-colors ${
                  qHasError
                    ? 'border-destructive/60'
                    : isOpen
                    ? 'border-border-tactile'
                    : 'border-border-subtle hover:border-border-tactile'
                }`}
              >
                {/* Question Card Header */}
                <button
                  type="button"
                  onClick={() => toggleCard(qIndex)}
                  className="w-full flex items-center justify-between px-4 py-3.5 sm:px-5 text-left hover:bg-interactive/30 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring cursor-pointer"
                >
                  <div className="flex items-center gap-3 pr-2 min-w-0">
                    <span
                      className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-md font-mono text-xs font-semibold tabular-nums border ${
                        qHasError
                          ? 'bg-destructive/15 text-rose-300 border-destructive/40'
                          : 'bg-primary/15 text-indigo-300 border-primary/30'
                      }`}
                    >
                      {formattedNum}
                    </span>

                    <div className="min-w-0">
                      <p className="text-sm font-medium text-foreground truncate max-w-sm sm:max-w-md md:max-w-xl leading-snug">
                        {q.question.trim() || `(Câu hỏi ${qNum} chưa có nội dung)`}
                      </p>
                      <div className="flex items-center gap-1.5 mt-0.5 text-xs text-content-secondary truncate">
                        <span>Đáp án đúng:</span>
                        <span className="font-mono font-semibold text-emerald-400">
                          {optionLetters[q.correctIndex]}. {q.options[q.correctIndex] || '---'}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {qHasError && (
                      <Badge variant="destructive" shape="compact" className="gap-1">
                        <AlertCircle className="w-3 h-3" /> Lỗi
                      </Badge>
                    )}
                    {isOpen ? (
                      <ChevronUp className="w-4 h-4 text-content-secondary" />
                    ) : (
                      <ChevronDown className="w-4 h-4 text-content-secondary" />
                    )}
                  </div>
                </button>

                {/* Question Card Body */}
                {isOpen && (
                  <div className="border-t border-border-subtle px-4 py-4 sm:px-5 sm:py-5 space-y-4 bg-canvas/40">
                    {/* Question Text */}
                    <div>
                      <label className="block text-xs font-medium text-content-secondary mb-1.5">
                        Nội dung câu hỏi {qNum} <span className="text-destructive">*</span>
                      </label>
                      <textarea
                        rows={2}
                        value={q.question}
                        onChange={(e) => handleQuestionTextChange(qIndex, e.target.value)}
                        placeholder="VD: Thứ tự đúng của các bước dưỡng da ban ngày là gì?"
                        className={`w-full rounded-admin border bg-recessed px-3 py-2 text-sm text-foreground leading-snug placeholder:text-content-muted shadow-inset-well transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:border-primary ${
                          errors[`question_${qIndex}`]
                            ? 'border-destructive focus-visible:ring-destructive'
                            : 'border-input'
                        }`}
                      />
                      {errors[`question_${qIndex}`] && (
                        <p className="mt-1.5 flex items-center text-xs text-destructive">
                          <AlertCircle className="mr-1 h-3.5 w-3.5 shrink-0" />{' '}
                          {errors[`question_${qIndex}`]}
                        </p>
                      )}
                    </div>

                    {/* 4 Options Grid */}
                    <div>
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 mb-2">
                        <label className="block text-xs font-medium text-content-secondary">
                          4 Phương án trả lời &amp; Chỉ định đáp án đúng <span className="text-destructive">*</span>
                        </label>
                        <span className="text-[11px] text-content-muted">
                          Nhấp vào A, B, C hoặc D để đổi đáp án đúng
                        </span>
                      </div>

                      <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                        {q.options.map((optText, optIndex) => {
                          const isCorrect = q.correctIndex === optIndex;
                          const optError = errors[`q_${qIndex}_opt_${optIndex}`];
                          const letter = optionLetters[optIndex];

                          return (
                            <div key={optIndex} className="space-y-1">
                              <div
                                className={`flex items-center gap-2 rounded-admin border p-1.5 transition-colors ${
                                  isCorrect
                                    ? 'border-success/60 bg-success/10'
                                    : optError
                                    ? 'border-destructive/70 bg-destructive/5'
                                    : 'border-border-subtle bg-recessed shadow-inset-well'
                                }`}
                              >
                                <button
                                  type="button"
                                  onClick={() => handleCorrectIndexChange(qIndex, optIndex)}
                                  className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-md font-mono text-xs font-bold transition-colors cursor-pointer ${
                                    isCorrect
                                      ? 'bg-success text-white shadow-sm'
                                      : 'bg-card text-content-secondary border border-border-subtle hover:bg-interactive hover:text-foreground'
                                  }`}
                                  title={
                                    isCorrect
                                      ? 'Đáp án này đang được chọn là đúng'
                                      : `Chọn ${letter} làm đáp án đúng`
                                  }
                                >
                                  {isCorrect ? <Check className="w-3.5 h-3.5 stroke-[3]" /> : letter}
                                </button>

                                <input
                                  type="text"
                                  value={optText}
                                  onChange={(e) =>
                                    handleOptionTextChange(qIndex, optIndex, e.target.value)
                                  }
                                  placeholder={`Nhập nội dung phương án ${letter}...`}
                                  className="w-full bg-transparent px-1.5 py-1 text-sm text-foreground leading-snug placeholder:text-content-muted focus:outline-none"
                                />

                                {isCorrect && (
                                  <Badge variant="success" shape="compact" className="shrink-0">
                                    Đúng
                                  </Badge>
                                )}
                              </div>

                              {optError && (
                                <p className="flex items-center text-[11px] text-destructive pl-1">
                                  <AlertCircle className="mr-1 h-3 w-3 shrink-0" /> {optError}
                                </p>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* Explanation (Optional) */}
                    <div>
                      <label className="block text-xs font-medium text-content-secondary mb-1.5">
                        Giải thích đáp án <span className="text-content-muted">(Hiển thị sau khi người chơi trả lời)</span>
                      </label>
                      <Input
                        type="text"
                        value={q.explanation || ''}
                        onChange={(e) => handleExplanationChange(qIndex, e.target.value)}
                        placeholder="VD: Kem chống nắng là bước bảo vệ cuối cùng trước khi tiếp xúc ánh nắng mặt trời."
                      />
                    </div>
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      </div>

      {/* Voucher Configuration Card */}
      <VoucherConfig
        voucher={voucher}
        onChange={handleVoucherChange}
        errors={errors}
      />

      {/* Review Gate Bottom Action Bar */}
      <Card className="p-4 sm:p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-2 text-xs text-content-secondary">
          <ShieldCheck className="w-4 h-4 text-success shrink-0" />
          <span>
            {draft.isMock
              ? 'Dữ liệu mô phỏng sẽ được gắn nhãn minh bạch khi xuất bản.'
              : 'Chiến dịch chỉ được lưu và xuất bản khi quản trị viên phê duyệt.'}
          </span>
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 w-full sm:w-auto">
          <Button
            type="button"
            variant="secondary"
            onClick={onDiscardOrCancel}
            className="w-full sm:w-auto"
          >
            Hủy bản nháp
          </Button>

          <Button
            data-testid="reviewgate-approve-btn"
            type="button"
            variant="success"
            onClick={handleApproveClick}
            className="w-full sm:w-auto gap-2 px-5"
          >
            <CheckCircle className="w-4 h-4 shrink-0" />
            <span>Phê duyệt &amp; Kích hoạt chiến dịch</span>
          </Button>
        </div>
      </Card>

      {/* Confirmation Modal when replacing active campaign (Requirement 13) */}
      {showConfirmModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-canvas/85 p-4 backdrop-blur-sm animate-fadeIn"
          role="dialog"
          aria-modal="true"
          aria-labelledby="reviewgate-overwrite-modal-title"
          aria-describedby="reviewgate-overwrite-modal-desc"
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowConfirmModal(false);
          }}
        >
          <Card
            ref={confirmModalRef}
            className="w-full max-w-md border-warning/40 p-6 shadow-elevated space-y-4 animate-scaleUp"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3 pb-3 border-b border-border-subtle">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-warning/30 bg-warning/15 text-warning">
                <AlertTriangle className="h-4 w-4" />
              </div>
              <div>
                <h3
                  id="reviewgate-overwrite-modal-title"
                  className="text-base font-semibold text-foreground leading-snug"
                >
                  Xác nhận kích hoạt chiến dịch
                </h3>
                <p className="text-xs text-amber-300 font-medium">
                  Thay thế chiến dịch đang hoạt động
                </p>
              </div>
            </div>

            <p
              id="reviewgate-overwrite-modal-desc"
              className="text-xs sm:text-sm text-content-secondary leading-relaxed"
            >
              Chiến dịch{' '}
              <strong className="text-foreground">
                "{currentActiveCampaign?.title || 'Hiện tại'}"
              </strong>{' '}
              đang hoạt động sẽ được thay thế bằng chiến dịch mới:{' '}
              <strong className="text-primary">"{title.trim()}"</strong>.
            </p>

            <p className="text-xs text-content-muted">
              Người chơi mới sẽ nhận bộ câu hỏi và mã voucher mới này. Bạn có chắc chắn muốn thay thế không?
            </p>

            <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-border-subtle">
              <Button
                ref={cancelConfirmBtnRef}
                type="button"
                variant="secondary"
                size="compact"
                onClick={() => setShowConfirmModal(false)}
              >
                Tiếp tục chỉnh sửa
              </Button>
              <Button
                type="button"
                variant="destructive"
                size="compact"
                disabled={isSaving}
                isLoading={isSaving}
                onClick={executeApprovalAndSave}
              >
                Xác nhận &amp; Kích hoạt
              </Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
};
