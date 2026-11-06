import React, { useState, useEffect, useRef } from 'react';
import {
  CheckCircle,
  AlertCircle,
  ChevronDown,
  ChevronUp,
  Save,
  Check,
  ListChecks,
  AlertTriangle,
  X,
} from 'lucide-react';
import { Campaign, Question, VoucherConfig as VoucherConfigType } from '../../types';
import { StorageService } from '../../services';
import { validateManualQuizForm } from '../../services/validators';
import { VoucherConfig } from './VoucherConfig';
import { IndustrySelect } from './IndustrySelect';
import type { PersistCampaign } from './persistence';
import { Button, Badge, Card, Input } from '../ui';

interface QuizBuilderProps {
  currentCampaign: Campaign | null;
  onCampaignActivated: (campaign: Campaign) => void;
  /**
   * Database persistence (Phase 3). When provided, saving calls the server and success is reported
   * only after it confirms the write; localStorage is not touched. When omitted, the legacy
   * localStorage behavior is preserved.
   */
  persistCampaign?: PersistCampaign;
  /** Editing an existing campaign: prefill from `currentCampaign` even for demo campaigns. */
  editing?: boolean;
}

const DEFAULT_QUESTIONS_TEMPLATE: Question[] = [
  {
    id: 'q1',
    question: '',
    options: ['', '', '', ''],
    correctIndex: 0,
    explanation: '',
  },
  {
    id: 'q2',
    question: '',
    options: ['', '', '', ''],
    correctIndex: 0,
    explanation: '',
  },
  {
    id: 'q3',
    question: '',
    options: ['', '', '', ''],
    correctIndex: 0,
    explanation: '',
  },
  {
    id: 'q4',
    question: '',
    options: ['', '', '', ''],
    correctIndex: 0,
    explanation: '',
  },
  {
    id: 'q5',
    question: '',
    options: ['', '', '', ''],
    correctIndex: 0,
    explanation: '',
  },
];

const DEFAULT_VOUCHER_TEMPLATE: VoucherConfigType = {
  code: '',
  discount: '',
  description: '',
  expiryDate: '7 ngày sau khi nhận',
  terms: 'Áp dụng 01 lần cho mỗi khách hàng hợp lệ trên Fanpage',
};

export const QuizBuilder: React.FC<QuizBuilderProps> = ({
  currentCampaign,
  onCampaignActivated,
  persistCampaign,
  editing = false,
}) => {
  const prefillSource = currentCampaign && (editing || !currentCampaign.isMock) ? currentCampaign : null;
  const [isSaving, setIsSaving] = useState<boolean>(false);

  const [title, setTitle] = useState(prefillSource ? prefillSource.title : '');
  const [description, setDescription] = useState(prefillSource ? prefillSource.description : '');
  const [industry, setIndustry] = useState(
    prefillSource ? prefillSource.industry : 'Thời trang & Phụ kiện'
  );

  const [questions, setQuestions] = useState<Question[]>(() => {
    if (prefillSource && prefillSource.questions.length === 5) {
      return prefillSource.questions.map((q) => ({ ...q }));
    }
    return DEFAULT_QUESTIONS_TEMPLATE.map((q) => ({
      ...q,
      options: [...q.options] as [string, string, string, string],
    }));
  });

  const [voucher, setVoucher] = useState<VoucherConfigType>(() => {
    if (prefillSource) {
      return { ...prefillSource.voucher };
    }
    return { ...DEFAULT_VOUCHER_TEMPLATE };
  });

  // UI state (-2 = expand all, 0..4 = single open index, -1 = all collapsed)
  const [openCardIndex, setOpenCardIndex] = useState<number>(0);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [generalErrors, setGeneralErrors] = useState<string[]>([]);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [showConfirmModal, setShowConfirmModal] = useState<boolean>(false);

  const submitTriggerRef = useRef<HTMLButtonElement | null>(null);
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
      submitTriggerRef.current?.focus();
    };
  }, [showConfirmModal]);

  const toggleCard = (index: number) => {
    setOpenCardIndex((prev) => (prev === index ? -1 : index));
  };

  const handleQuestionChange = (index: number, text: string) => {
    setQuestions((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], question: text };
      return next;
    });
    if (errors[`question_${index}`]) {
      setErrors((prev) => {
        const copy = { ...prev };
        delete copy[`question_${index}`];
        return copy;
      });
    }
  };

  const handleOptionChange = (qIndex: number, optIndex: number, text: string) => {
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
  };

  const handleExplanationChange = (qIndex: number, explanation: string) => {
    setQuestions((prev) => {
      const next = [...prev];
      next[qIndex] = { ...next[qIndex], explanation };
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

  const executeSave = async () => {
    if (isSaving) return;
    const nowIso = new Date().toISOString();
    const campaignId = `campaign_manual_${Date.now()}`;

    const newCampaign: Campaign = {
      id: campaignId,
      title: title.trim(),
      description:
        description.trim() ||
        `Thử thách 5 câu hỏi minigame nhận voucher độc quyền từ ${title.trim()}`,
      industry: industry.trim(),
      questions: questions.map((q, idx) => ({
        id: `q_manual_${idx + 1}_${Date.now()}`,
        question: q.question.trim(),
        options: [
          q.options[0].trim(),
          q.options[1].trim(),
          q.options[2].trim(),
          q.options[3].trim(),
        ],
        correctIndex: q.correctIndex,
        explanation: q.explanation?.trim(),
      })),
      voucher: {
        code: voucher.code.trim().toUpperCase(),
        discount: voucher.discount.trim(),
        description: voucher.description.trim(),
        expiryDate: voucher.expiryDate?.trim() || '7 ngày sau khi nhận',
        terms: voucher.terms?.trim() || 'Áp dụng cho đơn hàng trên Fanpage',
      },
      createdAt: nowIso,
      updatedAt: nowIso,
      isAiGenerated: false,
      isMock: false,
      mockLabel: undefined,
    };

    if (persistCampaign) {
      // Database mode: report success ONLY after the server confirms persistence.
      setIsSaving(true);
      try {
        const persisted = await persistCampaign({
          ...newCampaign,
          id: editing && currentCampaign ? currentCampaign.id : newCampaign.id,
          isMock: editing && currentCampaign ? Boolean(currentCampaign.isMock) : false,
          mockLabel: editing && currentCampaign ? currentCampaign.mockLabel : undefined,
          isAiGenerated:
            editing && currentCampaign ? Boolean(currentCampaign.isAiGenerated) : false,
        });
        if (persisted.success && persisted.campaign) {
          setErrors({});
          setGeneralErrors([]);
          setShowConfirmModal(false);
          setToastMessage('Đã lưu chiến dịch vào cơ sở dữ liệu.');
          onCampaignActivated(persisted.campaign);
        } else {
          if (persisted.fieldErrors) setErrors(persisted.fieldErrors);
          setGeneralErrors([persisted.message || 'Không thể lưu chiến dịch. Vui lòng thử lại.']);
          setShowConfirmModal(false);
        }
      } finally {
        setIsSaving(false);
      }
      return;
    }

    const saveRes = StorageService.saveCampaign(newCampaign);
    if (saveRes.success && saveRes.data) {
      onCampaignActivated(saveRes.data);
      setToastMessage('Chiến dịch đã được kích hoạt thành công!');
      setShowConfirmModal(false);
      setErrors({});
      setGeneralErrors([]);
      setTimeout(() => setToastMessage(null), 5000);
    } else {
      setGeneralErrors([saveRes.message || 'Không thể lưu chiến dịch vào bộ nhớ.']);
      setShowConfirmModal(false);
    }
  };

  const handleSaveAndActivate = (e: React.FormEvent) => {
    e.preventDefault();

    const validation = validateManualQuizForm({
      title,
      description,
      industry,
      questions,
      voucher,
    });

    if (!validation.valid) {
      setErrors(validation.fieldErrors);
      setGeneralErrors(validation.generalErrors);

      const firstErrorKey = Object.keys(validation.fieldErrors)[0];
      if (firstErrorKey) {
        if (firstErrorKey.startsWith('question_') || firstErrorKey.startsWith('q_')) {
          const match = firstErrorKey.match(/\d+/);
          if (match) {
            setOpenCardIndex(parseInt(match[0], 10));
          }
        }
      }
      return;
    }

    setErrors({});
    setGeneralErrors([]);

    if (!persistCampaign && currentCampaign && !currentCampaign.isMock) {
      setShowConfirmModal(true);
    } else {
      void executeSave();
    }
  };

  const optionLetters = ['A', 'B', 'C', 'D'];
  const completedCount = questions.filter(
    (q) => q.question.trim().length >= 5 && q.options.every((opt) => opt.trim().length > 0)
  ).length;

  return (
    <form onSubmit={handleSaveAndActivate} className="space-y-6">
      {/* Toast Notification */}
      {toastMessage && (
        <div
          role="status"
          aria-live="polite"
          className="fixed bottom-4 inset-x-4 sm:bottom-6 sm:right-6 sm:left-auto sm:max-w-md z-50 animate-fadeIn"
        >
          <div className="flex items-center justify-between gap-3 rounded-xl border border-success/40 bg-card px-4 py-3 text-xs sm:text-sm font-semibold text-emerald-200 shadow-elevated">
            <div className="flex items-center gap-2.5 min-w-0">
              <CheckCircle className="h-4 w-4 text-success shrink-0" />
              <span className="leading-snug">{toastMessage}</span>
            </div>
            <button
              type="button"
              onClick={() => setToastMessage(null)}
              aria-label="Đóng thông báo"
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-content-secondary hover:bg-interactive hover:text-foreground transition-colors"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* General Validation Error Alert */}
      {generalErrors.length > 0 && (
        <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-4 text-xs text-rose-200">
          <div className="flex items-center gap-2 font-semibold mb-1.5 text-rose-300">
            <AlertCircle className="h-4 w-4 text-destructive shrink-0" />
            <span>Vui lòng kiểm tra lại thông tin biểu mẫu:</span>
          </div>
          <ul className="list-disc pl-5 space-y-1">
            {generalErrors.map((err, i) => (
              <li key={i}>{err}</li>
            ))}
          </ul>
        </div>
      )}

      {/* 1. Campaign Metadata Card */}
      <Card className="p-5 sm:p-6">
        <div className="pb-4 mb-5 border-b border-border-subtle">
          <h3 className="text-sm sm:text-base font-semibold text-foreground leading-snug">
            Thông tin Chiến dịch
          </h3>
          <p className="text-xs text-content-secondary mt-0.5">
            Tên chiến dịch, ngành hàng và thông điệp chào mừng trên màn hình người chơi.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="sm:col-span-2">
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
                    const c = { ...prev };
                    delete c['title'];
                    return c;
                  });
                }
              }}
              placeholder="VD: Đố Vui Sành Điệu Cùng Shop, Săn Quà Cuối Tuần"
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
              label="Ngành hàng"
              required
              selectId="builder-industry-select"
              inputId="builder-custom-industry-input"
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

          <div className="sm:col-span-3">
            <label className="block text-xs font-medium text-content-secondary mb-1.5">
              Mô tả ngắn mời gọi người chơi
            </label>
            <Input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="VD: Chinh phục 5 câu đố vui nhận ngay mã voucher độc quyền giảm giá cho đơn tiếp theo!"
            />
          </div>
        </div>
      </Card>

      {/* 2. Questions 1 to 5 Section */}
      <div className="space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 px-0.5">
          <div className="flex items-center gap-2.5">
            <ListChecks className="h-4 w-4 text-primary shrink-0" />
            <h3 className="text-sm sm:text-base font-semibold text-foreground leading-snug">
              Bộ 5 câu hỏi trắc nghiệm
            </h3>
            <Badge variant={completedCount === 5 ? 'success' : 'secondary'} shape="compact" tabularNums className="font-mono">
              {completedCount}/5 hoàn tất
            </Badge>
          </div>

          <div className="flex items-center gap-3">
            <span className="text-xs text-content-muted">4 phương án &bull; 1 đáp án đúng/câu</span>
            <button
              type="button"
              onClick={() => setOpenCardIndex((prev) => (prev === -2 ? 0 : -2))}
              className="text-xs font-medium text-primary hover:text-indigo-400 transition-colors cursor-pointer"
            >
              {openCardIndex === -2 ? 'Thu gọn tất cả' : 'Mở rộng tất cả'}
            </button>
          </div>
        </div>

        <div className="space-y-2.5">
          {questions.map((q, qIndex) => {
            const isOpen = openCardIndex === -2 || openCardIndex === qIndex;
            const qNum = qIndex + 1;
            const formattedNum = qNum.toString().padStart(2, '0');
            const hasError =
              Boolean(errors[`question_${qIndex}`]) ||
              Boolean(errors[`options_${qIndex}`]) ||
              Boolean(errors[`correct_${qIndex}`]) ||
              [0, 1, 2, 3].some((i) => Boolean(errors[`q_${qIndex}_opt_${i}`]));

            const isFilled =
              q.question.trim().length >= 5 &&
              q.options.every((opt) => opt.trim().length > 0);

            return (
              <Card
                key={qIndex}
                className={`overflow-hidden transition-colors ${
                  hasError
                    ? 'border-destructive/60'
                    : isOpen
                    ? 'border-border-tactile'
                    : 'border-border-subtle hover:border-border-tactile'
                }`}
              >
                {/* Question Row Header */}
                <button
                  type="button"
                  onClick={() => toggleCard(qIndex)}
                  className="w-full flex items-center justify-between px-4 py-3.5 sm:px-5 text-left hover:bg-interactive/30 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring cursor-pointer"
                >
                  <div className="flex items-center gap-3 min-w-0 pr-3">
                    <span
                      className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-md font-mono text-xs font-semibold tabular-nums border ${
                        hasError
                          ? 'bg-destructive/15 text-rose-300 border-destructive/40'
                          : isFilled
                          ? 'bg-success/15 text-emerald-300 border-success/30'
                          : 'bg-recessed text-content-secondary border-border-subtle'
                      }`}
                    >
                      {isFilled && !hasError ? <Check className="h-3.5 w-3.5" /> : formattedNum}
                    </span>

                    <div className="min-w-0">
                      <p className="text-sm font-medium text-foreground truncate leading-snug">
                        {q.question.trim() ? (
                          q.question
                        ) : (
                          <span className="text-content-muted italic">
                            Câu {qNum}: Nhập nội dung câu hỏi...
                          </span>
                        )}
                      </p>
                      <p className="text-xs text-content-secondary mt-0.5 truncate">
                        Đáp án đúng:{' '}
                        <span className="font-mono font-semibold text-emerald-400">
                          {optionLetters[q.correctIndex]}
                        </span>
                        {q.options[q.correctIndex] ? (
                          <span className="text-content-muted">
                            {' '}
                            &mdash; {q.options[q.correctIndex].slice(0, 48)}
                          </span>
                        ) : null}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {hasError && (
                      <Badge variant="destructive" shape="compact">
                        Cần bổ sung
                      </Badge>
                    )}
                    {isOpen ? (
                      <ChevronUp className="h-4 w-4 text-content-secondary" />
                    ) : (
                      <ChevronDown className="h-4 w-4 text-content-secondary" />
                    )}
                  </div>
                </button>

                {/* Question Row Body */}
                {isOpen && (
                  <div className="border-t border-border-subtle px-4 py-4 sm:px-5 sm:py-5 space-y-4 bg-canvas/40">
                    {/* Question Prompt */}
                    <div>
                      <label className="block text-xs font-medium text-content-secondary mb-1.5">
                        Nội dung câu hỏi {qNum} <span className="text-destructive">*</span>
                      </label>
                      <textarea
                        rows={2}
                        value={q.question}
                        onChange={(e) => handleQuestionChange(qIndex, e.target.value)}
                        placeholder={`Nhập câu hỏi số ${qNum} (tối thiểu 5 ký tự)...`}
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

                    {/* 4 Answer Options */}
                    <div className="space-y-2">
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1">
                        <label className="block text-xs font-medium text-content-secondary">
                          4 Phương án trả lời &amp; Đáp án đúng <span className="text-destructive">*</span>
                        </label>
                        <span className="text-[11px] text-content-muted">
                          Nhấp vào ký hiệu A, B, C hoặc D để chỉ định đáp án đúng
                        </span>
                      </div>

                      <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                        {q.options.map((optText, optIdx) => {
                          const isCorrect = q.correctIndex === optIdx;
                          const optError = errors[`q_${qIndex}_opt_${optIdx}`];
                          const letter = optionLetters[optIdx];

                          return (
                            <div key={optIdx} className="space-y-1">
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
                                  onClick={() => handleCorrectIndexChange(qIndex, optIdx)}
                                  className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-md font-mono text-xs font-bold transition-colors cursor-pointer ${
                                    isCorrect
                                      ? 'bg-success text-white shadow-sm'
                                      : 'bg-card text-content-secondary border border-border-subtle hover:bg-interactive hover:text-foreground'
                                  }`}
                                  title={`Chọn ${letter} làm đáp án đúng`}
                                >
                                  {letter}
                                </button>

                                <input
                                  type="text"
                                  value={optText}
                                  onChange={(e) =>
                                    handleOptionChange(qIndex, optIdx, e.target.value)
                                  }
                                  placeholder={`Phương án ${letter}...`}
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

                    {/* Optional Explanation */}
                    <div>
                      <label className="block text-xs font-medium text-content-secondary mb-1.5">
                        Giải thích ngắn sau khi trả lời <span className="text-content-muted">(Tùy chọn)</span>
                      </label>
                      <Input
                        type="text"
                        value={q.explanation || ''}
                        onChange={(e) => handleExplanationChange(qIndex, e.target.value)}
                        placeholder="VD: Cấp ẩm giúp hàng rào bảo vệ da duy trì độ ẩm tự nhiên."
                      />
                    </div>
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      </div>

      {/* 3. Voucher Settings Card */}
      <VoucherConfig
        voucher={voucher}
        onChange={handleVoucherChange}
        errors={errors}
      />

      {/* Bottom Action Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4 border-t border-border-subtle">
        <p className="text-xs text-content-muted">
          {persistCampaign
            ? 'Chiến dịch được lưu vào cơ sở dữ liệu ở trạng thái bản nháp. Hãy xuất bản trong danh sách chiến dịch để người chơi truy cập.'
            : 'Chiến dịch sau khi lưu sẽ được áp dụng ngay cho màn hình Người chơi trên trình duyệt.'}
        </p>

        <Button
          ref={submitTriggerRef}
          type="submit"
          variant="default"
          className="w-full sm:w-auto gap-2 px-6"
          isLoading={isSaving}
        >
          {!isSaving && <Save className="h-4 w-4" />}
          <span>{persistCampaign ? (editing ? 'Lưu thay đổi' : 'Lưu bản nháp') : 'Lưu & Kích hoạt chiến dịch'}</span>
        </Button>
      </div>

      {/* Confirmation Modal when replacing active campaign */}
      {showConfirmModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-canvas/85 backdrop-blur-sm p-4 animate-fadeIn"
          role="dialog"
          aria-modal="true"
          aria-labelledby="quizbuilder-overwrite-modal-title"
          aria-describedby="quizbuilder-overwrite-modal-desc"
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
                  id="quizbuilder-overwrite-modal-title"
                  className="text-base font-semibold text-foreground leading-snug"
                >
                  Xác nhận thay thế chiến dịch
                </h3>
                <p className="text-xs text-amber-300 font-medium">
                  Thao tác này sẽ ghi đè chiến dịch đang hoạt động
                </p>
              </div>
            </div>

            <p
              id="quizbuilder-overwrite-modal-desc"
              className="text-xs sm:text-sm text-content-secondary leading-relaxed"
            >
              Bạn đang có chiến dịch đang hoạt động (
              <strong className="text-foreground font-semibold">{currentCampaign?.title}</strong>). Việc
              kích hoạt chiến dịch mới (<strong className="text-primary">{title.trim()}</strong>) sẽ thay thế bộ câu hỏi và mã ưu đãi hiện hành cho các lượt chơi tiếp theo.
            </p>

            <div className="flex justify-end gap-2.5 pt-2 border-t border-border-subtle">
              <Button
                ref={cancelConfirmBtnRef}
                type="button"
                variant="secondary"
                size="compact"
                onClick={() => setShowConfirmModal(false)}
              >
                Hủy bỏ
              </Button>
              <Button
                type="button"
                variant="destructive"
                size="compact"
                onClick={executeSave}
              >
                Đồng ý &amp; Thay thế
              </Button>
            </div>
          </Card>
        </div>
      )}
    </form>
  );
};
