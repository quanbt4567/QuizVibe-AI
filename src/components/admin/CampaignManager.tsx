import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Plus,
  Pencil,
  Rocket,
  EyeOff,
  Archive,
  ArchiveRestore,
  Link2,
  ExternalLink,
  Loader2,
  AlertCircle,
  RefreshCw,
  Ticket,
  Layers,
} from 'lucide-react';
import type { CampaignStatus, CampaignSummary } from '../../types';
import {
  AdminApiError,
  CampaignTransitionAction,
  campaignAdminApi,
} from '../../services/campaignAdminApi';
import { copyToClipboard } from '../../services/clipboard';
import { Badge, Button, Card } from '../ui';

type CampaignApi = Pick<typeof campaignAdminApi, 'list' | 'transition'>;

export interface CampaignManagerProps {
  /** `vouchers` reuses the library to pick which campaign's voucher to edit. */
  variant?: 'campaigns' | 'vouchers';
  onNavigate: (path: string) => void;
  /** Called when the API reports the Admin session is gone (HTTP 401). */
  onUnauthenticated: () => void;
  onNotice?: (message: string) => void;
  api?: CampaignApi;
}

type StatusFilter = 'all' | CampaignStatus;

const STATUS_LABEL: Record<CampaignStatus, string> = {
  draft: 'Bản nháp',
  published: 'Đã xuất bản',
  archived: 'Đã lưu trữ',
};

const STATUS_BADGE: Record<CampaignStatus, 'muted' | 'success' | 'warning'> = {
  draft: 'muted',
  published: 'success',
  archived: 'warning',
};

const FILTERS: Array<{ value: StatusFilter; label: string }> = [
  { value: 'all', label: 'Tất cả' },
  { value: 'draft', label: 'Bản nháp' },
  { value: 'published', label: 'Đã xuất bản' },
  { value: 'archived', label: 'Đã lưu trữ' },
];

const TRANSITION_NOTICE: Record<CampaignTransitionAction, string> = {
  publish: 'Đã xuất bản chiến dịch. Liên kết công khai đã hoạt động.',
  unpublish: 'Đã gỡ xuất bản. Liên kết công khai không còn truy cập được.',
  archive: 'Đã lưu trữ chiến dịch.',
  restore: 'Đã khôi phục chiến dịch về bản nháp.',
};

function formatDate(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleString('vi-VN');
}

export function publicQuizUrl(slug: string): string {
  const origin = typeof window !== 'undefined' && window.location ? window.location.origin : '';
  return `${origin}/quiz/${slug}`;
}

export const CampaignManager: React.FC<CampaignManagerProps> = ({
  variant = 'campaigns',
  onNavigate,
  onUnauthenticated,
  onNotice,
  api = campaignAdminApi,
}) => {
  const [campaigns, setCampaigns] = useState<CampaignSummary[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [confirmArchiveId, setConfirmArchiveId] = useState<string | null>(null);
  const [filter, setFilter] = useState<StatusFilter>('all');

  const handleError = useCallback(
    (err: unknown): string => {
      if (err instanceof AdminApiError) {
        if (err.isUnauthenticated) onUnauthenticated();
        return err.message;
      }
      return 'Đã xảy ra lỗi không xác định. Vui lòng thử lại.';
    },
    [onUnauthenticated]
  );

  const load = useCallback(async () => {
    setLoadError(null);
    try {
      setCampaigns(await api.list());
    } catch (err) {
      setCampaigns(null);
      setLoadError(handleError(err));
    }
  }, [api, handleError]);

  useEffect(() => {
    void load();
  }, [load]);

  const runTransition = async (campaign: CampaignSummary, action: CampaignTransitionAction) => {
    setBusyId(campaign.id);
    setActionError(null);
    setConfirmArchiveId(null);
    try {
      await api.transition(campaign.id, action);
      onNotice?.(TRANSITION_NOTICE[action]);
      await load();
    } catch (err) {
      // The server did not confirm the change: surface the failure, never a false success.
      setActionError(handleError(err));
    } finally {
      setBusyId(null);
    }
  };

  const copyLink = async (campaign: CampaignSummary) => {
    const result = await copyToClipboard(publicQuizUrl(campaign.slug));
    onNotice?.(
      result.success
        ? 'Đã sao chép liên kết công khai của chiến dịch.'
        : `Không thể tự động sao chép. Liên kết: ${publicQuizUrl(campaign.slug)}`
    );
  };

  const list = useMemo(() => (Array.isArray(campaigns) ? campaigns : []), [campaigns]);
  const visible = useMemo(
    () => list.filter((c) => filter === 'all' || c.status === filter),
    [list, filter]
  );

  const isVouchers = variant === 'vouchers';

  return (
    <div data-testid="campaign-manager" className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 lg:px-8 space-y-6">
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4 pb-5 border-b border-border-subtle">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground leading-snug">
            {isVouchers ? 'Cấu hình Voucher theo chiến dịch' : 'Chiến dịch Minigame'}
          </h1>
          <p className="mt-1 text-xs sm:text-sm text-content-secondary">
            {isVouchers
              ? 'Mỗi chiến dịch có một voucher riêng. Chọn chiến dịch để chỉnh sửa mã và nội dung ưu đãi.'
              : 'Tạo, biên tập, xuất bản và lưu trữ nhiều chiến dịch cùng lúc. Chỉ chiến dịch đã xuất bản mới có thể được chơi công khai.'}
          </p>
        </div>

        <Button type="button" onClick={() => onNavigate('/admin/campaigns/new')} className="gap-2 shrink-0">
          <Plus className="h-4 w-4" />
          <span>Tạo chiến dịch mới</span>
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Lọc theo trạng thái">
        {FILTERS.map((f) => (
          <button
            key={f.value}
            type="button"
            onClick={() => setFilter(f.value)}
            aria-pressed={filter === f.value}
            className={`rounded-md border px-2.5 py-1.5 text-xs font-medium transition-colors cursor-pointer ${
              filter === f.value
                ? 'border-border-subtle/80 bg-interactive text-foreground font-semibold shadow-key'
                : 'border-transparent text-content-secondary hover:bg-interactive/50 hover:text-foreground'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {actionError && (
        <div
          role="alert"
          className="flex items-start gap-2.5 rounded-lg border border-destructive/40 bg-destructive/10 p-3.5 text-xs text-rose-200"
        >
          <AlertCircle className="h-4 w-4 shrink-0 text-destructive mt-0.5" />
          <span>{actionError}</span>
        </div>
      )}

      {campaigns === null && !loadError && (
        <div
          data-testid="campaign-manager-loading"
          className="flex items-center justify-center gap-2 py-12 text-xs text-content-secondary"
        >
          <Loader2 className="h-4 w-4 animate-spin text-primary" />
          <span>Đang tải danh sách chiến dịch...</span>
        </div>
      )}

      {loadError && (
        <Card className="p-5 space-y-3">
          <div role="alert" className="flex items-start gap-2.5 text-xs text-rose-200">
            <AlertCircle className="h-4 w-4 shrink-0 text-destructive mt-0.5" />
            <span>{loadError}</span>
          </div>
          <Button type="button" variant="secondary" size="compact" onClick={() => void load()} className="gap-1.5">
            <RefreshCw className="h-3.5 w-3.5" />
            <span>Thử lại</span>
          </Button>
        </Card>
      )}

      {Array.isArray(campaigns) && campaigns.length === 0 && (
        <Card className="p-8 text-center space-y-3">
          <Layers className="mx-auto h-6 w-6 text-primary" />
          <p className="text-sm font-semibold text-foreground">Chưa có chiến dịch nào</p>
          <p className="text-xs text-content-secondary">
            Tạo chiến dịch đầu tiên bằng AI hoặc thủ công. Chiến dịch mới luôn bắt đầu ở trạng thái bản nháp.
          </p>
          <Button type="button" onClick={() => onNavigate('/admin/campaigns/new')} className="gap-2">
            <Plus className="h-4 w-4" />
            <span>Tạo chiến dịch mới</span>
          </Button>
        </Card>
      )}

      {Array.isArray(campaigns) && campaigns.length > 0 && visible.length === 0 && (
        <p className="py-8 text-center text-xs text-content-secondary">Không có chiến dịch nào ở trạng thái này.</p>
      )}

      <ul className="space-y-3">
        {visible.map((c) => {
          const busy = busyId === c.id;
          return (
            <li key={c.id}>
              <Card data-testid={`campaign-row-${c.id}`} className="p-4 sm:p-5">
                <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                  <div className="min-w-0 space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="text-sm sm:text-base font-semibold text-foreground truncate max-w-full">
                        {c.title}
                      </h2>
                      <Badge variant={STATUS_BADGE[c.status]} shape="compact" data-testid={`status-${c.id}`}>
                        {STATUS_LABEL[c.status]}
                      </Badge>
                      {c.isMock && (
                        <Badge variant="warning" shape="compact">
                          Bản demo
                        </Badge>
                      )}
                      {c.isAiGenerated && (
                        <Badge variant="default" shape="compact">
                          AI
                        </Badge>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-content-secondary">
                      <span>{c.industry}</span>
                      {c.voucherCode && (
                        <span className="inline-flex items-center gap-1 font-mono tabular-nums text-emerald-300">
                          <Ticket className="h-3 w-3" />
                          {c.voucherCode}
                        </span>
                      )}
                      <span className="font-mono tabular-nums text-content-muted">/quiz/{c.slug}</span>
                      <span className="text-content-muted">Cập nhật: {formatDate(c.updatedAt)}</span>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 shrink-0">
                    {busy && <Loader2 className="h-4 w-4 animate-spin text-primary" aria-label="Đang xử lý" />}

                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      disabled={busy || c.status === 'archived'}
                      onClick={() => onNavigate(`/admin/campaigns/${c.id}/edit`)}
                      className="gap-1.5"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                      <span>{isVouchers ? 'Sửa voucher' : 'Chỉnh sửa'}</span>
                    </Button>

                    {c.status === 'draft' && (
                      <Button
                        type="button"
                        variant="success"
                        size="sm"
                        disabled={busy}
                        onClick={() => void runTransition(c, 'publish')}
                        className="gap-1.5"
                      >
                        <Rocket className="h-3.5 w-3.5" />
                        <span>Xuất bản</span>
                      </Button>
                    )}

                    {c.status === 'published' && (
                      <>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          disabled={busy}
                          onClick={() => void runTransition(c, 'unpublish')}
                          className="gap-1.5"
                        >
                          <EyeOff className="h-3.5 w-3.5" />
                          <span>Gỡ xuất bản</span>
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          disabled={busy}
                          onClick={() => void copyLink(c)}
                          className="gap-1.5"
                        >
                          <Link2 className="h-3.5 w-3.5" />
                          <span>Sao chép liên kết</span>
                        </Button>
                        <a
                          href={`/quiz/${c.slug}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex h-8 items-center gap-1.5 rounded-admin px-3 text-xs text-content-secondary hover:bg-interactive hover:text-foreground"
                        >
                          <ExternalLink className="h-3.5 w-3.5" />
                          <span>Mở</span>
                        </a>
                      </>
                    )}

                    {c.status === 'archived' ? (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={busy}
                        onClick={() => void runTransition(c, 'restore')}
                        className="gap-1.5"
                      >
                        <ArchiveRestore className="h-3.5 w-3.5" />
                        <span>Khôi phục</span>
                      </Button>
                    ) : confirmArchiveId === c.id ? (
                      <span className="inline-flex items-center gap-1.5" role="group" aria-label="Xác nhận lưu trữ">
                        <Button
                          type="button"
                          variant="destructive"
                          size="sm"
                          disabled={busy}
                          onClick={() => void runTransition(c, 'archive')}
                        >
                          Xác nhận lưu trữ
                        </Button>
                        <Button type="button" variant="ghost" size="sm" onClick={() => setConfirmArchiveId(null)}>
                          Hủy
                        </Button>
                      </span>
                    ) : (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        disabled={busy}
                        onClick={() => setConfirmArchiveId(c.id)}
                        className="gap-1.5 text-content-secondary hover:text-rose-300"
                      >
                        <Archive className="h-3.5 w-3.5" />
                        <span>Lưu trữ</span>
                      </Button>
                    )}
                  </div>
                </div>
              </Card>
            </li>
          );
        })}
      </ul>
    </div>
  );
};

