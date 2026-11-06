import React, { useState, useEffect, useCallback } from 'react';
import {
  Sparkles,
  Edit3,
  Users,
  ShieldCheck,
  AlertCircle,
  RefreshCw,
  CheckCircle2,
  Layers,
  Ticket,
  X,
  Save,
  ArrowLeft,
  Loader2,
} from 'lucide-react';
import { Campaign, MOCK_MODE_LABEL, PresetIndustry, VoucherConfig as VoucherConfigType } from '../../types';
import { StorageService, generateQuizFromAI } from '../../services';
import { AdminRouteSection } from '../../router/appRouter';
import { QuizBuilder } from './QuizBuilder';
import { AIReviewGate, DraftCampaignData } from './AIReviewGate';
import { LeadDashboard } from './LeadDashboard';
import { VoucherConfig } from './VoucherConfig';
import { CampaignManager } from './CampaignManager';
import { campaignAdminApi, AdminApiError } from '../../services/campaignAdminApi';
import type { PersistCampaign, PersistCampaignResult } from './persistence';
import {
  Button,
  Badge,
  Card,
  Input,
  Tabs,
  TabsList,
  TabsTrigger,
} from '../ui';

export interface AdminDashboardProps {
  campaign: Campaign | null;
  onCampaignChange: (campaign: Campaign) => void;
  activeSection?: AdminRouteSection;
  routeView?: 'new' | 'edit';
  campaignId?: string;
  onNavigateRoute?: (path: string) => void;
  onUnauthenticated?: () => void;
}

export type AdminTab = 'manual' | 'ai' | 'leads' | 'vouchers';

export const AdminDashboard: React.FC<AdminDashboardProps> = ({
  campaign,
  onCampaignChange,
  activeSection = 'overview',
  routeView,
  campaignId,
  onNavigateRoute,
  onUnauthenticated,
}) => {
  const [activeTab, setActiveTab] = useState<AdminTab>(() => {
    if (activeSection === 'leads') return 'leads';
    if (activeSection === 'vouchers') return 'vouchers';
    return 'manual';
  });
  const presets = StorageService.getPresets();

  useEffect(() => {
    if (activeSection === 'leads') {
      setActiveTab('leads');
    } else if (activeSection === 'vouchers') {
      setActiveTab('vouchers');
    } else if (activeTab === 'leads' || activeTab === 'vouchers') {
      setActiveTab('manual');
    }
  }, [activeSection]);

  // Campaign sub-view states (/admin/campaigns/new and /admin/campaigns/:id/edit)
  const [createMode, setCreateMode] = useState<'manual' | 'ai'>('manual');
  const [editingCampaign, setEditingCampaign] = useState<Campaign | null>(null);
  const [isLoadingEdit, setIsLoadingEdit] = useState<boolean>(false);
  const [editLoadError, setEditLoadError] = useState<string | null>(null);

  useEffect(() => {
    if (activeSection === 'campaigns' && routeView === 'edit' && campaignId) {
      let cancelled = false;
      setIsLoadingEdit(true);
      setEditLoadError(null);
      campaignAdminApi
        .get(campaignId)
        .then((c) => {
          if (!cancelled) {
            setEditingCampaign(c);
            setIsLoadingEdit(false);
          }
        })
        .catch((err) => {
          if (!cancelled) {
            if (err instanceof AdminApiError && err.isUnauthenticated) {
              onUnauthenticated?.();
            }
            setEditLoadError(err instanceof Error ? err.message : 'Không thể tải thông tin chiến dịch.');
            setIsLoadingEdit(false);
          }
        });
      return () => {
        cancelled = true;
      };
    }
  }, [activeSection, routeView, campaignId, onUnauthenticated]);

  const handlePersistCreate: PersistCampaign = useCallback(
    async (campaignData: Campaign): Promise<PersistCampaignResult> => {
      try {
        const created = await campaignAdminApi.create(campaignData);
        return { success: true, campaign: created };
      } catch (err) {
        if (err instanceof AdminApiError) {
          if (err.isUnauthenticated && onUnauthenticated) {
            onUnauthenticated();
          }
          return { success: false, message: err.message, fieldErrors: err.fieldErrors };
        }
        return { success: false, message: 'Không thể kết nối đến máy chủ. Vui lòng thử lại.' };
      }
    },
    [onUnauthenticated]
  );

  const handlePersistUpdate = useCallback(
    async (id: string, campaignData: Campaign): Promise<PersistCampaignResult> => {
      try {
        const updated = await campaignAdminApi.update(id, campaignData);
        return { success: true, campaign: updated };
      } catch (err) {
        if (err instanceof AdminApiError) {
          if (err.isUnauthenticated && onUnauthenticated) {
            onUnauthenticated();
          }
          return { success: false, message: err.message, fieldErrors: err.fieldErrors };
        }
        return { success: false, message: 'Không thể kết nối đến máy chủ. Vui lòng thử lại.' };
      }
    },
    [onUnauthenticated]
  );

  // Standalone Voucher Route State (/admin/vouchers)
  const [voucherDraft, setVoucherDraft] = useState<VoucherConfigType>(() => ({
    code: campaign?.voucher?.code || 'VIBE20',
    discount: campaign?.voucher?.discount || 'Giảm 20% cho đơn từ 299.000đ',
    description:
      campaign?.voucher?.description ||
      'Áp dụng cho khách hàng tham gia minigame trên Fanpage',
    expiryDate: campaign?.voucher?.expiryDate || '7 ngày sau khi nhận',
    terms: campaign?.voucher?.terms || 'Áp dụng 01 lần cho mỗi khách hàng hợp lệ',
  }));
  const [voucherErrors, setVoucherErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (campaign?.voucher) {
      setVoucherDraft({
        code: campaign.voucher.code,
        discount: campaign.voucher.discount,
        description: campaign.voucher.description,
        expiryDate: campaign.voucher.expiryDate || '',
        terms: campaign.voucher.terms || '',
      });
    }
  }, [campaign]);

  const handleSaveStandaloneVoucher = (e: React.FormEvent) => {
    e.preventDefault();
    if (!campaign) return;

    const errs: Record<string, string> = {};
    if (!voucherDraft.code || voucherDraft.code.trim().length < 2) {
      errs['voucher_code'] = 'Mã voucher phải có ít nhất 2 ký tự.';
    } else if (/\s/.test(voucherDraft.code.trim())) {
      errs['voucher_code'] = 'Mã voucher không được chứa khoảng trắng.';
    }
    if (!voucherDraft.discount || !voucherDraft.discount.trim()) {
      errs['voucher_discount'] = 'Mức ưu đãi không được để trống.';
    }
    if (!voucherDraft.description || !voucherDraft.description.trim()) {
      errs['voucher_description'] = 'Mô tả voucher không được để trống.';
    }

    setVoucherErrors(errs);
    if (Object.keys(errs).length > 0) return;

    const updatedCampaign: Campaign = {
      ...campaign,
      voucher: {
        code: voucherDraft.code.trim().toUpperCase(),
        discount: voucherDraft.discount.trim(),
        description: voucherDraft.description.trim(),
        expiryDate: voucherDraft.expiryDate?.trim() || undefined,
        terms: voucherDraft.terms?.trim() || undefined,
      },
      updatedAt: new Date().toISOString(),
    };

    const saveRes = StorageService.saveCampaign(updatedCampaign);
    if (saveRes.success && saveRes.data) {
      onCampaignChange(saveRes.data);
      setToastMessage(`Đã cập nhật cấu hình mã voucher "${updatedCampaign.voucher.code}" thành công!`);
      setTimeout(() => setToastMessage(null), 4000);
    }
  };

  // AI Generation Form State (preserved across retries and failures)
  const [aiTopic, setAiTopic] = useState<string>('Bí quyết chăm sóc da rạng rỡ');
  const [aiIndustry, setAiIndustry] = useState<string>('Mỹ phẩm & Chăm sóc da');
  const [aiDifficulty, setAiDifficulty] = useState<string>('Trung bình');
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [generationError, setGenerationError] = useState<string | null>(null);
  const [canFallback, setCanFallback] = useState<boolean>(false);
  const [reviewDraft, setReviewDraft] = useState<DraftCampaignData | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const handleSelectPreset = (industryKey: PresetIndustry) => {
    const presetData = StorageService.getPreset(industryKey);
    if (presetData) {
      setReviewDraft({
        title: presetData.title,
        description: presetData.description,
        industry: presetData.industry,
        questions: presetData.questions,
        voucher: presetData.voucher,
        isAiGenerated: false,
        isMock: true,
        mockLabel: MOCK_MODE_LABEL,
      });
      setGenerationError(null);
    }
  };

  const handleResetDefault = () => {
    const res = StorageService.initializeDefaults(true);
    if (res.success && res.data) {
      onCampaignChange(res.data);
      setGenerationError(null);
      setReviewDraft(null);
    }
  };

  const handleGenerateAI = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!aiTopic.trim()) {
      setGenerationError('Vui lòng nhập chủ đề câu hỏi.');
      return;
    }

    setIsGenerating(true);
    setGenerationError(null);
    setCanFallback(false);

    const result = await generateQuizFromAI(aiTopic, aiIndustry, aiDifficulty);

    setIsGenerating(false);

    if (result.success && result.questions) {
      // Load into Review Gate — ZERO questions published automatically per FR-104
      setReviewDraft({
        title: `Quiz AI: ${aiTopic.trim()}`,
        description: `Thử thách trắc nghiệm được tạo bởi ${result.provider?.toUpperCase() || 'AI'} dành riêng cho khách hàng.`,
        industry: aiIndustry,
        questions: result.questions,
        voucher: campaign?.voucher || {
          code: 'AIPROMO20',
          discount: 'Giảm 20% cho đơn hàng',
          description: 'Áp dụng cho khách hàng tham gia minigame AI',
          expiryDate: '7 ngày sau khi nhận',
          terms: 'Áp dụng trên toàn hệ thống Fanpage',
        },
        isAiGenerated: true,
        isMock: false,
        mockLabel: undefined,
        providerName: result.provider || 'Google Gemini 3.8 Flash',
      });
      setGenerationError(null);
      setCanFallback(false);
    } else {
      setGenerationError(result.error || 'Không thể tạo câu hỏi từ máy chủ AI.');
      setCanFallback(result.canFallback ?? true);
    }
  };

  const handleExplicitMockFallback = () => {
    const industryLower = aiIndustry.toLowerCase();
    const presetKey =
      industryLower.includes('thời trang') || industryLower.includes('fashion')
        ? 'fashion'
        : industryLower.includes('công nghệ') || industryLower.includes('tech')
        ? 'tech'
        : industryLower.includes('ẩm thực') || industryLower.includes('fnb')
        ? 'fnb'
        : 'cosmetics';

    handleSelectPreset(presetKey as PresetIndustry);
    setGenerationError(null);
  };

  // ---------------------------------------------------------------------------
  // Dedicated Route Sections
  // ---------------------------------------------------------------------------

  if (activeSection === 'campaigns') {
    if (routeView === 'new') {
      return (
        <div data-testid="campaign-new-workspace" className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 lg:px-8 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-border-subtle">
            <div className="flex items-center gap-3 min-w-0">
              <Button
                type="button"
                variant="ghost"
                size="compact"
                onClick={() => onNavigateRoute?.('/admin/campaigns')}
                className="gap-1.5 text-xs text-content-secondary hover:text-foreground shrink-0"
              >
                <ArrowLeft className="h-4 w-4" />
                <span>Danh sách chiến dịch</span>
              </Button>
              <h1 className="text-lg sm:text-xl font-bold tracking-tight text-foreground truncate">
                Tạo chiến dịch mới
              </h1>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <Button
                type="button"
                variant={createMode === 'manual' ? 'default' : 'secondary'}
                size="compact"
                onClick={() => setCreateMode('manual')}
                className="text-xs gap-1.5"
              >
                <Edit3 className="h-3.5 w-3.5" />
                <span>Tạo thủ công</span>
              </Button>
              <Button
                type="button"
                variant={createMode === 'ai' ? 'default' : 'secondary'}
                size="compact"
                onClick={() => setCreateMode('ai')}
                className="text-xs gap-1.5"
              >
                <Sparkles className="h-3.5 w-3.5" />
                <span>Tạo bằng AI</span>
              </Button>
            </div>
          </div>

          {createMode === 'manual' ? (
            <QuizBuilder
              currentCampaign={null}
              persistCampaign={handlePersistCreate}
              onCampaignActivated={(newCamp) => {
                onCampaignChange(newCamp);
                setToastMessage(`Đã tạo chiến dịch "${newCamp.title}" thành công dưới dạng Bản nháp!`);
                setTimeout(() => setToastMessage(null), 4000);
                onNavigateRoute?.('/admin/campaigns');
              }}
            />
          ) : reviewDraft ? (
            <AIReviewGate
              draft={reviewDraft}
              currentActiveCampaign={campaign}
              persistCampaign={handlePersistCreate}
              onApproveAndActivate={(approvedCampaign) => {
                onCampaignChange(approvedCampaign);
                setReviewDraft(null);
                setToastMessage(`Đã tạo chiến dịch AI "${approvedCampaign.title}" thành công dưới dạng Bản nháp!`);
                setTimeout(() => setToastMessage(null), 4000);
                onNavigateRoute?.('/admin/campaigns');
              }}
              onDiscardOrCancel={() => setReviewDraft(null)}
            />
          ) : (
            <Card className="overflow-hidden">
              <form onSubmit={handleGenerateAI} className="p-5 sm:p-6 space-y-5">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-4 border-b border-border-subtle">
                  <div>
                    <h2 className="text-sm sm:text-base font-semibold text-foreground leading-snug">
                      Trình tạo câu hỏi Minigame bằng AI
                    </h2>
                    <p className="text-xs text-content-secondary mt-0.5">
                      Tự động biên soạn 5 câu hỏi trắc nghiệm kèm đáp án và giải thích theo chủ đề.
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5 self-start sm:self-auto">
                    <Badge variant="default" shape="compact" className="font-mono text-[11px]">
                      Gemini 3.8 Flash
                    </Badge>
                  </div>
                </div>

                {generationError && (
                  <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-4 space-y-3 text-rose-200">
                    <div className="flex items-start gap-2.5">
                      <AlertCircle className="h-4 w-4 shrink-0 text-destructive mt-0.5" />
                      <div>
                        <h4 className="text-xs sm:text-sm font-semibold text-rose-200">
                          Không thể kết nối hoặc sinh câu hỏi từ AI
                        </h4>
                        <p className="text-xs text-rose-300 mt-0.5">{generationError}</p>
                      </div>
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-12 gap-4">
                  <div className="sm:col-span-6">
                    <label className="block text-xs font-medium text-content-secondary mb-1.5">
                      Chủ đề câu hỏi minigame
                    </label>
                    <Input
                      value={aiTopic}
                      onChange={(e) => setAiTopic(e.target.value)}
                      placeholder="Ví dụ: Bí quyết chăm sóc da rạng rỡ đón Tết..."
                      className="text-sm"
                    />
                  </div>

                  <div className="sm:col-span-3">
                    <label className="block text-xs font-medium text-content-secondary mb-1.5">
                      Ngành hàng
                    </label>
                    <select
                      value={aiIndustry}
                      onChange={(e) => setAiIndustry(e.target.value)}
                      className="flex h-10 w-full rounded-admin border border-input bg-recessed px-3 py-2 text-sm text-foreground leading-snug shadow-inset-well focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:border-primary transition-colors cursor-pointer"
                    >
                      <option value="Mỹ phẩm & Chăm sóc da">Mỹ phẩm & Chăm sóc da</option>
                      <option value="Thời trang & Phụ kiện">Thời trang & Phụ kiện</option>
                      <option value="Công nghệ & Phụ kiện">Công nghệ & Phụ kiện</option>
                      <option value="Ẩm thực & Đồ uống (F&B)">Ẩm thực & Đồ uống (F&B)</option>
                    </select>
                  </div>

                  <div className="sm:col-span-3">
                    <label className="block text-xs font-medium text-content-secondary mb-1.5">
                      Độ khó câu hỏi
                    </label>
                    <select
                      value={aiDifficulty}
                      onChange={(e) => setAiDifficulty(e.target.value)}
                      className="flex h-10 w-full rounded-admin border border-input bg-recessed px-3 py-2 text-sm text-foreground leading-snug shadow-inset-well focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:border-primary transition-colors cursor-pointer"
                    >
                      <option value="Dễ">Dễ (Tương tác cao)</option>
                      <option value="Trung bình">Trung bình (Cân bằng)</option>
                      <option value="Khó">Khó (Chuyên sâu)</option>
                    </select>
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pt-4 border-t border-border-subtle">
                  <div className="flex items-center gap-2 text-xs text-content-secondary">
                    <ShieldCheck className="w-4 h-4 text-success shrink-0" />
                    <span>
                      Tất cả câu hỏi sinh ra sẽ đi qua Cổng Kiểm duyệt trước khi lưu vào cơ sở dữ liệu.
                    </span>
                  </div>

                  <Button
                    type="submit"
                    variant="default"
                    isLoading={isGenerating}
                    className="w-full sm:w-auto gap-2 px-6 shrink-0"
                  >
                    {!isGenerating && <Sparkles className="h-4 w-4" />}
                    <span>{isGenerating ? 'Đang tạo câu hỏi (3-5s)...' : 'Tạo 5 câu hỏi bằng AI'}</span>
                  </Button>
                </div>
              </form>
            </Card>
          )}
        </div>
      );
    }

    if (routeView === 'edit' && campaignId) {
      if (isLoadingEdit) {
        return (
          <div data-testid="campaign-edit-loading" className="mx-auto w-full max-w-6xl px-4 py-16 flex items-center justify-center gap-2 text-xs text-content-secondary">
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
            <span>Đang tải thông tin chiến dịch...</span>
          </div>
        );
      }

      if (editLoadError || !editingCampaign) {
        return (
          <div data-testid="campaign-edit-error" className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 lg:px-8 space-y-4">
            <Card className="p-6 text-center space-y-4">
              <AlertCircle className="mx-auto h-8 w-8 text-destructive" />
              <h2 className="text-base font-bold text-foreground">Không thể tải thông tin chiến dịch</h2>
              <p className="text-xs text-content-secondary max-w-md mx-auto">
                {editLoadError || 'Chiến dịch không tồn tại hoặc đã bị xóa.'}
              </p>
              <div className="flex items-center justify-center gap-2 pt-2">
                <Button
                  type="button"
                  variant="secondary"
                  size="compact"
                  onClick={() => onNavigateRoute?.('/admin/campaigns')}
                  className="gap-1.5"
                >
                  <ArrowLeft className="h-3.5 w-3.5" />
                  <span>Quay lại danh sách</span>
                </Button>
                <Button
                  type="button"
                  variant="default"
                  size="compact"
                  onClick={() => {
                    setIsLoadingEdit(true);
                    setEditLoadError(null);
                    campaignAdminApi.get(campaignId).then((c) => {
                      setEditingCampaign(c);
                      setIsLoadingEdit(false);
                    }).catch((err) => {
                      setEditLoadError(err instanceof Error ? err.message : 'Lỗi tải chiến dịch');
                      setIsLoadingEdit(false);
                    });
                  }}
                  className="gap-1.5"
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                  <span>Thử lại</span>
                </Button>
              </div>
            </Card>
          </div>
        );
      }

      return (
        <div data-testid="campaign-edit-workspace" className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 lg:px-8 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-border-subtle">
            <div className="flex items-center gap-3 min-w-0">
              <Button
                type="button"
                variant="ghost"
                size="compact"
                onClick={() => onNavigateRoute?.('/admin/campaigns')}
                className="gap-1.5 text-xs text-content-secondary hover:text-foreground shrink-0"
              >
                <ArrowLeft className="h-4 w-4" />
                <span>Danh sách chiến dịch</span>
              </Button>
              <div className="min-w-0">
                <h1 className="text-lg sm:text-xl font-bold tracking-tight text-foreground truncate">
                  Chỉnh sửa: {editingCampaign.title}
                </h1>
                <p className="text-xs text-content-muted">
                  Đường dẫn công khai: /quiz/{editingCampaign.slug} · Trạng thái: {editingCampaign.status || 'draft'}
                </p>
              </div>
            </div>
          </div>

          <QuizBuilder
            currentCampaign={editingCampaign}
            editing={true}
            persistCampaign={(updated) => handlePersistUpdate(editingCampaign.id, updated)}
            onCampaignActivated={(saved) => {
              onCampaignChange(saved);
              setToastMessage(`Đã cập nhật chiến dịch "${saved.title}" thành công!`);
              setTimeout(() => setToastMessage(null), 4000);
              onNavigateRoute?.('/admin/campaigns');
            }}
          />
        </div>
      );
    }

    // Default /admin/campaigns -> render CampaignManager
    return (
      <CampaignManager
        variant="campaigns"
        onNavigate={onNavigateRoute || (() => {})}
        onUnauthenticated={onUnauthenticated || (() => {})}
        onNotice={(msg) => {
          setToastMessage(msg);
          setTimeout(() => setToastMessage(null), 4000);
        }}
      />
    );
  }

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 lg:px-8 space-y-6">
      {/* Toast Notification */}
      {toastMessage && (
        <div
          role="status"
          aria-live="polite"
          className="fixed bottom-4 inset-x-4 sm:bottom-6 sm:right-6 sm:left-auto sm:max-w-md z-50 animate-fadeIn"
        >
          <div className="flex items-center justify-between gap-3 rounded-xl border border-success/40 bg-card px-4 py-3 text-xs sm:text-sm font-semibold text-emerald-200 shadow-elevated">
            <div className="flex items-center gap-2.5 min-w-0">
              <CheckCircle2 className="h-4 w-4 text-success shrink-0" />
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

      {/* Active Campaign & Provenance Status Strip */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 rounded-lg border border-border-subtle bg-card px-4 py-2.5 shadow-key">
        <div className="flex flex-wrap items-center gap-2.5 min-w-0">
          {campaign?.isMock ? (
            <Badge variant="warning" shape="compact" className="gap-1.5 shrink-0">
              <AlertCircle className="h-3.5 w-3.5 text-amber-400" />
              <span>{campaign.mockLabel || MOCK_MODE_LABEL}</span>
            </Badge>
          ) : campaign?.isAiGenerated ? (
            <Badge variant="default" shape="compact" className="gap-1.5 shrink-0">
              <Sparkles className="h-3.5 w-3.5 text-indigo-400" />
              <span>Chiến dịch AI</span>
            </Badge>
          ) : (
            <Badge variant="success" shape="compact" className="gap-1.5 shrink-0">
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
              <span>Chiến dịch Thủ công</span>
            </Badge>
          )}

          <div className="flex items-center gap-2 min-w-0 text-xs">
            <span className="text-content-muted shrink-0">Đang kích hoạt:</span>
            <strong className="text-foreground font-semibold truncate max-w-[220px] sm:max-w-[320px]">
              {campaign?.title || 'Chưa khởi tạo'}
            </strong>
          </div>
        </div>

        <div className="flex items-center justify-between sm:justify-end gap-2.5 shrink-0">
          {campaign?.voucher?.code && (
            <Badge variant="secondary" shape="compact" tabularNums className="font-mono gap-1">
              <Ticket className="w-3 h-3 text-success" />
              <span>Mã: {campaign.voucher.code}</span>
            </Badge>
          )}

          {campaign?.isMock && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleResetDefault}
              className="h-7 px-2.5 text-xs gap-1 text-content-secondary hover:text-foreground"
              title="Khôi phục chiến dịch mẫu ban đầu"
            >
              <RefreshCw className="w-3 h-3" />
              <span>Khôi phục mặc định</span>
            </Button>
          )}
        </div>
      </div>

      {/* Editorial Workspace Header & Linear Segmented Navigation */}
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4 pb-5 border-b border-border-subtle">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground leading-snug">
            Bảng điều khiển Quản trị
          </h1>
          <p className="mt-1 text-xs sm:text-sm text-content-secondary">
            Biên tập chiến dịch minigame trắc nghiệm, cấu hình voucher và quản lý danh sách khách hàng tiềm năng.
          </p>
        </div>

        <Tabs
          value={activeTab}
          onValueChange={(val) => {
            const nextTab = val as AdminTab;
            setActiveTab(nextTab);
            if (onNavigateRoute) {
              if (nextTab === 'leads') onNavigateRoute('/admin/leads');
              else if (nextTab === 'vouchers') onNavigateRoute('/admin/vouchers');
              else onNavigateRoute('/admin/campaigns');
            }
          }}
          className="w-full md:w-auto"
        >
          <TabsList className="w-full md:w-auto grid grid-cols-2 sm:grid-cols-4 md:inline-flex">
            <TabsTrigger value="manual" className="gap-1.5 text-xs sm:text-sm">
              <Edit3 className="w-3.5 h-3.5 shrink-0" />
              <span>Tạo thủ công</span>
            </TabsTrigger>
            <TabsTrigger value="ai" className="gap-1.5 text-xs sm:text-sm">
              <Sparkles className="w-3.5 h-3.5 shrink-0 text-primary" />
              <span>Tạo bằng AI</span>
            </TabsTrigger>
            <TabsTrigger value="leads" className="gap-1.5 text-xs sm:text-sm">
              <Users className="w-3.5 h-3.5 shrink-0 text-success" />
              <span>Quản lý Leads</span>
            </TabsTrigger>
            <TabsTrigger value="vouchers" className="gap-1.5 text-xs sm:text-sm">
              <Ticket className="w-3.5 h-3.5 shrink-0 text-amber-400" />
              <span>Cấu hình Voucher</span>
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* Tab 1: Manual Quiz Builder */}
      {activeTab === 'manual' && (
        <QuizBuilder
          currentCampaign={campaign}
          persistCampaign={handlePersistCreate}
          onCampaignActivated={(saved) => {
            onCampaignChange(saved);
            setToastMessage(`Đã lưu chiến dịch "${saved.title}" thành công dưới dạng Bản nháp!`);
            setTimeout(() => setToastMessage(null), 4000);
          }}
        />
      )}

      {/* Tab 2: AI Question Generator & Review Gate */}
      {activeTab === 'ai' &&
        (reviewDraft ? (
          <AIReviewGate
            draft={reviewDraft}
            currentActiveCampaign={campaign}
            persistCampaign={handlePersistCreate}
            onApproveAndActivate={(approvedCampaign) => {
              onCampaignChange(approvedCampaign);
              setReviewDraft(null);
              setToastMessage('Chiến dịch đã được phê duyệt và lưu vào cơ sở dữ liệu thành công!');
              setTimeout(() => setToastMessage(null), 5000);
            }}
            onDiscardOrCancel={() => {
              setReviewDraft(null);
            }}
          />
        ) : (
          <div className="space-y-6">
            {/* Cohesive AI Prompt Composer */}
            <Card className="overflow-hidden">
              <form onSubmit={handleGenerateAI} className="p-5 sm:p-6 space-y-5">
                {/* Composer Header */}
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-4 border-b border-border-subtle">
                  <div>
                    <h2 className="text-sm sm:text-base font-semibold text-foreground leading-snug">
                      Trình tạo câu hỏi Minigame bằng AI
                    </h2>
                    <p className="text-xs text-content-secondary mt-0.5">
                      Tự động biên soạn 5 câu hỏi trắc nghiệm khách quan kèm đáp án và giải thích theo chủ đề.
                    </p>
                  </div>

                  <div className="flex items-center gap-1.5 self-start sm:self-auto">
                    <Badge variant="default" shape="compact" className="font-mono text-[11px]">
                      Gemini 3.8 Flash
                    </Badge>
                    <Badge variant="muted" shape="compact" className="font-mono text-[11px]">
                      Fallback: GPT-OSS 20B
                    </Badge>
                  </div>
                </div>

                {/* Error & Fallback Banner */}
                {generationError && (
                  <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-4 space-y-3 text-rose-200">
                    <div className="flex items-start gap-2.5">
                      <AlertCircle className="h-4 w-4 shrink-0 text-destructive mt-0.5" />
                      <div>
                        <h4 className="text-xs sm:text-sm font-semibold text-rose-200">
                          Không thể kết nối hoặc sinh câu hỏi từ AI
                        </h4>
                        <p className="text-xs text-rose-300 mt-0.5">{generationError}</p>
                        <p className="text-[11px] text-content-secondary mt-1">
                          Thông tin chủ đề của bạn đã được lưu giữ an toàn để thử lại hoặc chuyển sang chế độ mẫu.
                        </p>
                      </div>
                    </div>

                    {canFallback && (
                      <div className="pt-2.5 border-t border-destructive/20 flex flex-wrap gap-2">
                        <Button
                          type="button"
                          variant="default"
                          size="compact"
                          onClick={() => handleGenerateAI()}
                          disabled={isGenerating}
                          className="gap-1.5"
                        >
                          <RefreshCw className="w-3.5 h-3.5" />
                          <span>Thử lại</span>
                        </Button>

                        <Button
                          type="button"
                          variant="secondary"
                          size="compact"
                          onClick={handleExplicitMockFallback}
                          className="gap-1.5 text-amber-300 border-warning/40 hover:border-warning/60"
                        >
                          <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                          <span>Chuyển sang bộ câu hỏi mẫu (Mock Mode)</span>
                        </Button>

                        <Button
                          type="button"
                          variant="outline"
                          size="compact"
                          onClick={() => setActiveTab('manual')}
                          className="gap-1.5"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                          <span>Chuyển sang Tạo thủ công</span>
                        </Button>
                      </div>
                    )}
                  </div>
                )}

                {/* Composer Form Controls */}
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-12">
                  <div className="sm:col-span-6">
                    <label className="block text-xs font-medium text-content-secondary mb-1.5">
                      Chủ đề mong muốn (Topic) <span className="text-destructive">*</span>
                    </label>
                    <Input
                      type="text"
                      value={aiTopic}
                      onChange={(e) => setAiTopic(e.target.value)}
                      placeholder="VD: Kem chống nắng cho da dầu, Xu hướng phối đồ thu đông..."
                    />
                  </div>

                  <div className="sm:col-span-3">
                    <label className="block text-xs font-medium text-content-secondary mb-1.5">
                      Ngành hàng phù hợp
                    </label>
                    <select
                      value={aiIndustry}
                      onChange={(e) => setAiIndustry(e.target.value)}
                      className="flex h-10 w-full rounded-admin border border-input bg-recessed px-3 py-2 text-sm text-foreground leading-snug shadow-inset-well focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:border-primary transition-colors cursor-pointer"
                    >
                      <option value="Mỹ phẩm & Chăm sóc da">Mỹ phẩm &amp; Chăm sóc da</option>
                      <option value="Thời trang & Phụ kiện">Thời trang &amp; Phụ kiện</option>
                      <option value="Công nghệ & Phụ kiện">Công nghệ &amp; Phụ kiện</option>
                      <option value="Ẩm thực & Đồ uống (F&B)">Ẩm thực &amp; Đồ uống (F&amp;B)</option>
                      <option value="Khác">Khác</option>
                    </select>
                  </div>

                  <div className="sm:col-span-3">
                    <label className="block text-xs font-medium text-content-secondary mb-1.5">
                      Độ khó câu hỏi
                    </label>
                    <select
                      value={aiDifficulty}
                      onChange={(e) => setAiDifficulty(e.target.value)}
                      className="flex h-10 w-full rounded-admin border border-input bg-recessed px-3 py-2 text-sm text-foreground leading-snug shadow-inset-well focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:border-primary transition-colors cursor-pointer"
                    >
                      <option value="Dễ">Dễ (Tương tác cao)</option>
                      <option value="Trung bình">Trung bình (Cân bằng)</option>
                      <option value="Khó">Khó (Chuyên sâu)</option>
                    </select>
                  </div>
                </div>

                {/* Composer Footer Action */}
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pt-4 border-t border-border-subtle">
                  <div className="flex items-center gap-2 text-xs text-content-secondary">
                    <ShieldCheck className="w-4 h-4 text-success shrink-0" />
                    <span>
                      Tất cả câu hỏi sinh ra sẽ đi qua Cổng Kiểm duyệt trước khi hiển thị cho người chơi.
                    </span>
                  </div>

                  <Button
                    type="submit"
                    variant="default"
                    isLoading={isGenerating}
                    className="w-full sm:w-auto gap-2 px-6 shrink-0"
                  >
                    {!isGenerating && <Sparkles className="h-4 w-4" />}
                    <span>
                      {isGenerating
                        ? 'Đang gọi AI sinh câu hỏi (3-5s)...'
                        : 'Tạo 5 câu hỏi bằng AI'}
                    </span>
                  </Button>
                </div>
              </form>

              {/* Offline Mock Presets Section (Clearly Distinguished from Live AI) */}
              <div className="border-t border-border-subtle bg-canvas/50 p-5 sm:p-6 space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Layers className="w-4 h-4 text-warning shrink-0" />
                    <h3 className="text-xs sm:text-sm font-semibold text-foreground">
                      Bộ câu hỏi mẫu ngoại tuyến (Offline Mock Presets)
                    </h3>
                  </div>

                  <Badge variant="warning" shape="compact" className="self-start sm:self-auto">
                    {MOCK_MODE_LABEL}
                  </Badge>
                </div>

                <p className="text-xs text-content-secondary">
                  Sử dụng ngay bộ 5 câu hỏi mẫu chuẩn ngành hàng khi muốn thử nghiệm nhanh mà không tiêu tốn hạn mức API.
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5 pt-1">
                  {presets.map((preset) => {
                    const isActive = campaign?.id === preset.id;
                    const industryKey = preset.industry.toLowerCase().includes('cosmetic')
                      ? 'cosmetics'
                      : preset.industry.toLowerCase().includes('fashion')
                      ? 'fashion'
                      : preset.industry.toLowerCase().includes('tech')
                      ? 'tech'
                      : 'fnb';

                    return (
                      <button
                        key={preset.id}
                        type="button"
                        onClick={() => handleSelectPreset(industryKey as PresetIndustry)}
                        className={`flex flex-col justify-between p-3 rounded-admin border text-left transition-all cursor-pointer ${
                          isActive
                            ? 'border-primary/60 bg-primary/10 text-foreground shadow-key'
                            : 'border-border-subtle bg-recessed text-content-secondary hover:border-border-tactile hover:bg-interactive hover:text-foreground'
                        }`}
                      >
                        <div className="flex items-center justify-between w-full gap-2">
                          <span className="text-xs font-semibold text-foreground truncate">
                            {preset.industry}
                          </span>
                          {isActive && (
                            <CheckCircle2 className="w-3.5 h-3.5 text-primary shrink-0" />
                          )}
                        </div>

                        <p className="text-[11px] text-content-secondary mt-1 line-clamp-1">
                          {preset.title}
                        </p>

                        <div className="flex items-center justify-between w-full mt-2.5 pt-2 border-t border-border-subtle/70 font-mono text-[10px] tabular-nums text-content-muted">
                          <span className="text-emerald-400 font-semibold">{preset.voucher.code}</span>
                          <span>5 câu hỏi</span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            </Card>
          </div>
        ))}

      {/* Tab 3: Lead Management */}
      {activeTab === 'leads' && <LeadDashboard currentCampaign={campaign} />}

      {/* Tab 4: Voucher Configuration (/admin/vouchers) */}
      {activeTab === 'vouchers' && (
        <form onSubmit={handleSaveStandaloneVoucher} className="space-y-4">
          <VoucherConfig
            voucher={voucherDraft}
            onChange={(field, value) => {
              setVoucherDraft((prev) => ({ ...prev, [field]: value }));
              if (voucherErrors[`voucher_${field}`]) {
                setVoucherErrors((prev) => {
                  const next = { ...prev };
                  delete next[`voucher_${field}`];
                  return next;
                });
              }
            }}
            errors={voucherErrors}
          />
          <div className="flex justify-end">
            <Button type="submit" variant="default" className="gap-2">
              <Save className="h-4 w-4" />
              <span>Lưu cấu hình Voucher</span>
            </Button>
          </div>
        </form>
      )}
    </div>
  );
};
