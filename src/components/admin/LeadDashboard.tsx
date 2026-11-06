import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  Users,
  Trash2,
  Filter,
  RotateCcw,
  AlertTriangle,
  CheckCircle2,
  X,
  Clock,
  Award,
  Ticket,
  Calendar,
  Download,
  ArrowUpDown,
} from 'lucide-react';
import { Campaign, Lead } from '../../types';
import { leadAdminApi } from '../../services/leadAdminApi';
import { maskPhoneNumber } from '../../services/validators';
import {
  Button,
  Badge,
  Card,
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
  StatCard,
  EmptyState,
  SearchInput,
} from '../ui';

export interface LeadDashboardProps {
  currentCampaign?: Campaign | null;
}

export type ScoreFilterType = 'all' | 'ge1500' | '1000to1499' | 'lt1000';
export type SortOptionType = 'newest' | 'score_desc' | 'time_asc';

export const LeadDashboard: React.FC<LeadDashboardProps> = ({ currentCampaign }) => {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [campaignFilter, setCampaignFilter] = useState<string>('all');
  const [scoreFilter, setScoreFilter] = useState<ScoreFilterType>('all');
  const [sortBy, setSortBy] = useState<SortOptionType>('newest');

  // Deletion modals state
  const [deletingLead, setDeletingLead] = useState<Lead | null>(null);
  const [showClearAllModal, setShowClearAllModal] = useState<boolean>(false);
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Focus restoration references
  const triggerButtonRef = useRef<HTMLElement | null>(null);
  const cancelDeleteBtnRef = useRef<HTMLButtonElement | null>(null);
  const cancelClearAllBtnRef = useRef<HTMLButtonElement | null>(null);

  const refreshLeads = () => {
    leadAdminApi
      .listLeads({
        campaignId: campaignFilter,
        search: searchQuery,
        sortBy,
      })
      .then((apiLeads) => {
        setLeads(
          apiLeads.map((l) => ({
            id: l.id,
            fullName: l.full_name,
            phoneNumber: l.phone_number,
            score: l.score,
            timeTakenSeconds: l.time_taken_seconds,
            voucherCode: l.voucher_code || '',
            campaignId: l.campaign_id,
            submittedAt: l.submitted_at,
          }))
        );
      })
      .catch((err: unknown) => {
        const isAuthError =
          err &&
          typeof err === 'object' &&
          'status' in err &&
          (err.status === 401 || (err as any).code === 'UNAUTHORIZED');
        setNotification({
          type: 'error',
          message: isAuthError
            ? 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại để xem dữ liệu leads.'
            : err instanceof Error
              ? err.message
              : 'Không thể tải danh sách leads từ máy chủ.',
        });
      });
  };

  useEffect(() => {
    refreshLeads();

    const handleStorageChange = (e: StorageEvent) => {
      if (!e.key || e.key.includes('leads') || e.key.includes('leaderboard')) {
        refreshLeads();
      }
    };
    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  useEffect(() => {
    if (notification) {
      const timer = setTimeout(() => setNotification(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [notification]);

  useEffect(() => {
    const activeModal = Boolean(deletingLead || showClearAllModal);
    if (!activeModal) return;

    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const focusTimer = setTimeout(() => {
      if (deletingLead) {
        cancelDeleteBtnRef.current?.focus();
      } else if (showClearAllModal) {
        cancelClearAllBtnRef.current?.focus();
      }
    }, 50);

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (deletingLead) setDeletingLead(null);
        if (showClearAllModal) setShowClearAllModal(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      clearTimeout(focusTimer);
      document.body.style.overflow = originalOverflow;
      window.removeEventListener('keydown', handleKeyDown);
      triggerButtonRef.current?.focus();
    };
  }, [deletingLead, showClearAllModal]);

  const availableCampaigns = useMemo(() => {
    const ids = new Set<string>();
    leads.forEach((l) => {
      if (l.campaignId) ids.add(l.campaignId);
    });
    if (currentCampaign?.id) ids.add(currentCampaign.id);
    return Array.from(ids);
  }, [leads, currentCampaign]);

  const filteredLeads = useMemo(() => {
    const base = leads.filter((lead) => {
      if (searchQuery.trim() !== '') {
        const query = searchQuery.trim().toLowerCase();
        const cleanDigits = searchQuery.replace(/\D/g, '');
        const nameMatch = lead.fullName.toLowerCase().includes(query);
        const phoneMatch = cleanDigits.length > 0 && lead.phoneNumber.includes(cleanDigits);
        const maskedMatch = maskPhoneNumber(lead.phoneNumber).toLowerCase().includes(query);

        if (!nameMatch && !phoneMatch && !maskedMatch) {
          return false;
        }
      }

      if (campaignFilter !== 'all') {
        if (lead.campaignId !== campaignFilter) {
          return false;
        }
      }

      if (scoreFilter === 'ge1500') {
        if (lead.score < 1500) return false;
      } else if (scoreFilter === '1000to1499') {
        if (lead.score < 1000 || lead.score >= 1500) return false;
      } else if (scoreFilter === 'lt1000') {
        if (lead.score >= 1000) return false;
      }

      return true;
    });

    if (sortBy === 'score_desc') {
      return [...base].sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score;
        return (a.timeTakenSeconds ?? 999) - (b.timeTakenSeconds ?? 999);
      });
    }

    if (sortBy === 'time_asc') {
      return [...base].sort((a, b) => {
        const timeA = typeof a.timeTakenSeconds === 'number' ? a.timeTakenSeconds : 999;
        const timeB = typeof b.timeTakenSeconds === 'number' ? b.timeTakenSeconds : 999;
        if (timeA !== timeB) return timeA - timeB;
        return b.score - a.score;
      });
    }

    return base;
  }, [leads, searchQuery, campaignFilter, scoreFilter, sortBy]);

  const stats = useMemo(() => {
    const total = leads.length;
    if (total === 0) {
      return { total: 0, averageScore: 0, highestScore: 0, vouchersClaimed: 0 };
    }
    const sumScore = leads.reduce((acc, curr) => acc + (curr.score || 0), 0);
    const maxScore = leads.reduce((acc, curr) => Math.max(acc, curr.score || 0), 0);
    const vouchers = leads.filter((l) => l.voucherCode && l.voucherCode.trim() !== '').length;

    return {
      total,
      averageScore: Math.round(sumScore / total),
      highestScore: maxScore,
      vouchersClaimed: vouchers,
    };
  }, [leads]);

  const hasActiveFilters =
    searchQuery.trim() !== '' || campaignFilter !== 'all' || scoreFilter !== 'all' || sortBy !== 'newest';

  const handleResetFilters = () => {
    setSearchQuery('');
    setCampaignFilter('all');
    setScoreFilter('all');
    setSortBy('newest');
  };

  const openDeleteModal = (lead: Lead, triggerEl?: HTMLElement) => {
    if (triggerEl) triggerButtonRef.current = triggerEl;
    setDeletingLead(lead);
  };

  const handleConfirmDeleteLead = () => {
    if (!deletingLead) return;
    const leadName = deletingLead.fullName;
    const leadId = deletingLead.id;

    leadAdminApi
      .deleteLead(leadId)
      .then(() => {
        refreshLeads();
        setNotification({
          type: 'success',
          message: `Đã xóa thông tin lead của khách hàng "${leadName}" thành công!`,
        });
      })
      .catch((err: unknown) => {
        const isAuthError =
          err &&
          typeof err === 'object' &&
          'status' in err &&
          (err.status === 401 || (err as any).code === 'UNAUTHORIZED');
        setNotification({
          type: 'error',
          message: isAuthError
            ? 'Phiên đăng nhập đã hết hạn. Không thể xóa lead.'
            : err instanceof Error
              ? err.message
              : `Lỗi khi xóa lead của "${leadName}". Thao tác chưa được thực hiện.`,
        });
      })
      .finally(() => {
        setDeletingLead(null);
      });
  };

  const openClearAllModal = (triggerEl?: HTMLElement) => {
    if (triggerEl) triggerButtonRef.current = triggerEl;
    setShowClearAllModal(true);
  };

  const handleConfirmClearAll = () => {
    if (!campaignFilter || campaignFilter === 'all') {
      setNotification({
        type: 'error',
        message: 'Vui lòng chọn một chiến dịch cụ thể để xóa leads. Không thể xóa toàn bộ.',
      });
      setShowClearAllModal(false);
      return;
    }

    const count = leads.length;

    leadAdminApi
      .clearAllLeads(campaignFilter)
      .then(() => {
        refreshLeads();
        setNotification({
          type: 'success',
          message: `Đã xóa ${count} lead của chiến dịch thành công!`,
        });
      })
      .catch((err: unknown) => {
        const isAuthError =
          err &&
          typeof err === 'object' &&
          'status' in err &&
          (err.status === 401 || (err as any).code === 'UNAUTHORIZED');
        setNotification({
          type: 'error',
          message: isAuthError
            ? 'Phiên đăng nhập đã hết hạn. Không thể xóa danh sách leads.'
            : err instanceof Error
              ? err.message
              : 'Lỗi khi xóa danh sách lead từ máy chủ.',
        });
      })
      .finally(() => {
        setShowClearAllModal(false);
      });
  };

  const handleExportCsv = () => {
    try {
      window.open(leadAdminApi.downloadLeadsCsvUrl(campaignFilter), '_blank');
      setNotification({
        type: 'success',
        message: 'Đang tải file Excel CSV từ máy chủ...',
      });
    } catch (err: unknown) {
      setNotification({
        type: 'error',
        message: err instanceof Error ? err.message : 'Không thể tải file CSV từ máy chủ.',
      });
    }
  };

  const formatDateTime = (isoString?: string): string => {
    if (!isoString) return '--';
    const date = new Date(isoString);
    if (isNaN(date.getTime())) return '--';
    return date.toLocaleDateString('vi-VN', {
      hour: '2-digit',
      minute: '2-digit',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  };

  return (
    <div className="space-y-6">
      {/* Status Notification */}
      {notification && (
        <div
          role="status"
          className={`flex items-center justify-between rounded-lg px-4 py-3 border text-xs sm:text-sm font-medium transition-all ${
            notification.type === 'success'
              ? 'bg-success/10 border-success/40 text-emerald-200'
              : 'bg-destructive/10 border-destructive/40 text-rose-200'
          }`}
        >
          <div className="flex items-center gap-2">
            {notification.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-success shrink-0" />
            ) : (
              <AlertTriangle className="w-4 h-4 text-destructive shrink-0" />
            )}
            <span>{notification.message}</span>
          </div>
          <button
            type="button"
            onClick={() => setNotification(null)}
            className="text-content-secondary hover:text-foreground p-1 cursor-pointer"
            aria-label="Đóng thông báo"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Blocks.so-Inspired High-Density KPI Metric Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
        <StatCard
          title="Tổng số Lead thu thập"
          value={stats.total.toLocaleString('vi-VN')}
          icon={<Users className="w-4 h-4 text-primary" />}
          subtitle={
            hasActiveFilters
              ? `Đang lọc: ${filteredLeads.length.toLocaleString('vi-VN')} / ${stats.total.toLocaleString('vi-VN')} bản ghi`
              : 'khách hàng đã xác thực SĐT'
          }
        />
        <StatCard
          title="Voucher đã phát"
          value={stats.vouchersClaimed.toLocaleString('vi-VN')}
          icon={<Ticket className="w-4 h-4 text-emerald-400" />}
          trend={{
            value: `${stats.total > 0 ? Math.round((stats.vouchersClaimed / stats.total) * 100) : 0}% nhận mã`,
            direction: 'up',
            label: 'Đã mở khóa ưu đãi',
          }}
        />
        <StatCard
          title="Điểm trung bình"
          value={stats.averageScore.toLocaleString('vi-VN')}
          icon={<Award className="w-4 h-4 text-primary-400" />}
          subtitle="Thang 2.000 điểm chuẩn"
        />
        <StatCard
          title="Kỷ lục cao nhất"
          value={stats.highestScore.toLocaleString('vi-VN')}
          icon={<Award className="w-4 h-4 text-amber-300" />}
          subtitle="Thành tích dẫn đầu"
        />
      </div>

      {/* Stripe / Linear Data Ledger Card */}
      <Card className="overflow-hidden">
        {/* Ledger Header & Action Toolbar */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-4 sm:p-5 border-b border-border-subtle">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-sm sm:text-base font-semibold text-foreground leading-snug">
                Danh sách Khách hàng Tham gia (Leads)
              </h2>
              <Badge variant="secondary" shape="compact" tabularNums className="font-mono shrink-0 whitespace-nowrap">
                {filteredLeads.length} / {leads.length}
              </Badge>
            </div>
            <p className="text-xs text-content-secondary mt-0.5">
              Số điện thoại được ẩn danh tự động theo chuẩn bảo mật quyền riêng tư.
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <Button
              type="button"
              variant="secondary"
              size="compact"
              onClick={handleExportCsv}
              className="gap-1.5 text-emerald-300 border-success/30 hover:border-success/50 whitespace-nowrap"
              aria-label="Xuất file Excel (CSV)"
              title="Xuất danh sách khách hàng ra file Excel CSV (UTF-8 BOM)"
            >
              <Download className="w-3.5 h-3.5 text-success" />
              <span>Xuất file Excel (CSV)</span>
            </Button>

            {leads.length > 0 && (
              <Button
                type="button"
                variant="outline"
                size="compact"
                onClick={(e) => openClearAllModal(e.currentTarget)}
                className="gap-1.5 text-rose-300 border-destructive/30 hover:bg-destructive/15 hover:border-destructive/50 hover:text-rose-200 whitespace-nowrap"
                aria-label="Xóa toàn bộ danh sách lead"
              >
                <Trash2 className="w-3.5 h-3.5 text-destructive" />
                <span>Xóa toàn bộ</span>
              </Button>
            )}
          </div>
        </div>

        {/* Filter, Search & Sort Control Bar */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-2.5 p-4 sm:px-5 bg-canvas/40 border-b border-border-subtle">
          {/* Search Input */}
          <div className="sm:col-span-2 lg:col-span-5">
            <SearchInput
              value={searchQuery}
              onChange={(val) => setSearchQuery(val)}
              placeholder="Tìm theo họ tên hoặc số điện thoại..."
              shortcutBadge="/"
              aria-label="Tìm kiếm lead theo tên hoặc số điện thoại"
            />
          </div>

          {/* Campaign Filter Dropdown */}
          <div className="sm:col-span-1 lg:col-span-3">
            <select
              value={campaignFilter}
              onChange={(e) => setCampaignFilter(e.target.value)}
              className="flex h-9 w-full rounded-admin border border-input bg-recessed px-2.5 py-1.5 text-xs sm:text-sm text-foreground leading-snug shadow-inset-well focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring cursor-pointer"
              aria-label="Lọc theo chiến dịch"
            >
              <option value="all">Tất cả chiến dịch</option>
              {availableCampaigns.map((cId) => (
                <option key={cId} value={cId}>
                  {cId === currentCampaign?.id ? `Đang chạy: ${currentCampaign.title}` : cId}
                </option>
              ))}
            </select>
          </div>

          {/* Score Range Filter */}
          <div className="sm:col-span-1 lg:col-span-2">
            <select
              value={scoreFilter}
              onChange={(e) => setScoreFilter(e.target.value as ScoreFilterType)}
              className="flex h-9 w-full rounded-admin border border-input bg-recessed px-2.5 py-1.5 text-xs sm:text-sm text-foreground leading-snug shadow-inset-well focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring cursor-pointer"
              aria-label="Lọc theo mức điểm"
            >
              <option value="all">Mọi mức điểm</option>
              <option value="ge1500">&ge; 1.500 (Xuất sắc)</option>
              <option value="1000to1499">1.000 - 1.499 (Tốt)</option>
              <option value="lt1000">&lt; 1.000 (Cần cố gắng)</option>
            </select>
          </div>

          {/* Sort & Reset */}
          <div className="sm:col-span-2 lg:col-span-2 flex items-center gap-1.5">
            <div className="relative flex-1">
              <ArrowUpDown className="w-3 h-3 text-content-muted absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as SortOptionType)}
                className="flex h-9 w-full rounded-admin border border-input bg-recessed pl-7 pr-2 py-1.5 text-xs text-foreground leading-snug shadow-inset-well focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring cursor-pointer"
                aria-label="Sắp xếp danh sách lead"
              >
                <option value="newest">Mới nhất</option>
                <option value="score_desc">Điểm cao nhất</option>
                <option value="time_asc">Nhanh nhất</option>
              </select>
            </div>

            {hasActiveFilters && (
              <Button
                type="button"
                variant="secondary"
                size="compact"
                onClick={handleResetFilters}
                className="px-2.5 shrink-0"
                title="Đặt lại bộ lọc"
                aria-label="Đặt lại toàn bộ bộ lọc"
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </Button>
            )}
          </div>
        </div>

        {/* 1. Global Empty State */}
        {leads.length === 0 ? (
          <div className="p-6 sm:p-10">
            <EmptyState
              title="Chưa có dữ liệu lead khách hàng"
              description="Khi khách hàng hoàn thành 5 câu hỏi minigame và đăng ký nhận mã ưu đãi, danh sách liên hệ và điểm số sẽ hiển thị tại đây."
              icon={<Users className="w-6 h-6 text-content-muted" />}
            />
          </div>
        ) : filteredLeads.length === 0 ? (
          /* 2. Filter No Results State */
          <div className="p-6 sm:p-10">
            <EmptyState
              title="Không tìm thấy lead phù hợp"
              description="Không có khách hàng nào khớp với điều kiện tìm kiếm và bộ lọc hiện tại."
              icon={<Filter className="w-6 h-6 text-content-muted" />}
              action={{
                label: 'Xóa bộ lọc',
                onClick: handleResetFilters,
                icon: <RotateCcw className="w-3.5 h-3.5" />,
                variant: 'secondary',
              }}
            />
          </div>
        ) : (
          /* 3. Populated State: Desktop Ledger Table (>= lg) & Responsive Cards (< lg) */
          <div>
            {/* Desktop Table View (>= lg) */}
            <div className="hidden lg:block">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="w-14 text-center">STT</TableHead>
                    <TableHead>Họ và Tên</TableHead>
                    <TableHead>Số điện thoại</TableHead>
                    <TableHead className="text-right">Điểm số</TableHead>
                    <TableHead className="text-right">Thời gian</TableHead>
                    <TableHead>Ngày tham gia</TableHead>
                    <TableHead>Mã Voucher</TableHead>
                    <TableHead className="w-16 text-center">Thao tác</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredLeads.map((lead, index) => (
                    <TableRow key={lead.id}>
                      <TableCell tabularNums className="text-center font-mono text-xs text-content-muted">
                        {(index + 1).toString().padStart(2, '0')}
                      </TableCell>
                      <TableCell className="font-medium text-foreground max-w-[180px] truncate">
                        {lead.fullName}
                      </TableCell>
                      <TableCell tabularNums className="font-mono text-xs text-content-secondary">
                        {maskPhoneNumber(lead.phoneNumber)}
                      </TableCell>
                      <TableCell tabularNums className="text-right font-mono font-semibold text-amber-300">
                        {lead.score.toLocaleString('vi-VN')}
                      </TableCell>
                      <TableCell tabularNums className="text-right font-mono text-xs text-content-secondary">
                        {typeof lead.timeTakenSeconds === 'number' ? `${lead.timeTakenSeconds}s` : '--'}
                      </TableCell>
                      <TableCell tabularNums className="text-xs text-content-secondary whitespace-nowrap">
                        {formatDateTime(lead.submittedAt)}
                      </TableCell>
                      <TableCell tabularNums>
                        {lead.voucherCode ? (
                          <Badge variant="success" shape="compact" tabularNums className="font-mono gap-1">
                            <Ticket className="w-3 h-3" />
                            <span>{lead.voucherCode}</span>
                          </Badge>
                        ) : (
                          <span className="text-content-muted font-mono text-xs">---</span>
                        )}
                      </TableCell>
                      <TableCell className="text-center">
                        <button
                          type="button"
                          onClick={(e) => openDeleteModal(lead, e.currentTarget)}
                          className="inline-flex items-center justify-center rounded-md p-1.5 text-content-muted hover:text-destructive hover:bg-destructive/10 transition-colors cursor-pointer"
                          aria-label={`Xóa lead của ${lead.fullName}`}
                          title={`Xóa lead của ${lead.fullName}`}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {/* Tablet & Mobile Card Layout (< lg: 2-col on 768px tablet, 1-col on 390px mobile) */}
            <div className="lg:hidden grid grid-cols-1 sm:grid-cols-2 gap-3 p-4">
              {filteredLeads.map((lead, index) => (
                <div
                  key={lead.id}
                  className="rounded-lg border border-border-subtle bg-recessed/60 p-3.5 space-y-2.5"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded bg-recessed border border-border-subtle text-[10px] font-mono tabular-nums text-content-secondary">
                        {(index + 1).toString().padStart(2, '0')}
                      </span>
                      <h4 className="text-sm font-semibold text-foreground truncate">
                        {lead.fullName}
                      </h4>
                    </div>

                    <div className="flex items-center gap-1 shrink-0 font-mono tabular-nums font-bold text-amber-300 text-xs">
                      <Award className="w-3.5 h-3.5 text-warning" />
                      <span>{lead.score.toLocaleString('vi-VN')} điểm</span>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs text-content-secondary pt-1">
                    <div>
                      <span className="text-content-muted block text-[11px] font-medium">
                        Số điện thoại
                      </span>
                      <span className="font-mono tabular-nums text-foreground font-medium">
                        {maskPhoneNumber(lead.phoneNumber)}
                      </span>
                    </div>
                    <div>
                      <span className="text-content-muted block text-[11px] font-medium">
                        Thời gian trả lời
                      </span>
                      <span className="font-mono tabular-nums text-foreground flex items-center gap-1">
                        <Clock className="w-3 h-3 text-content-muted" />
                        {typeof lead.timeTakenSeconds === 'number' ? `${lead.timeTakenSeconds}s` : '--'}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-border-subtle/60">
                    <div className="flex items-center gap-2">
                      <span className="flex items-center gap-1 text-[11px] text-content-muted tabular-nums">
                        <Calendar className="w-3 h-3" />
                        {formatDateTime(lead.submittedAt)}
                      </span>
                      {lead.voucherCode && (
                        <Badge variant="success" shape="compact" tabularNums className="font-mono">
                          {lead.voucherCode}
                        </Badge>
                      )}
                    </div>

                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={(e) => openDeleteModal(lead, e.currentTarget)}
                      className="gap-1 text-rose-300 border-destructive/30 hover:bg-destructive/15"
                      aria-label={`Xóa lead của ${lead.fullName}`}
                    >
                      <Trash2 className="w-3 h-3 text-destructive" />
                      <span>Xóa</span>
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </Card>

      {/* Individual Lead Deletion Confirmation Modal */}
      {deletingLead && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-canvas/85 p-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-lead-modal-title"
          onClick={(e) => {
            if (e.target === e.currentTarget) setDeletingLead(null);
          }}
        >
          <Card
            className="w-full max-w-md p-5 sm:p-6 shadow-elevated space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3 border-b border-border-subtle pb-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-destructive/15 border border-destructive/30 text-destructive">
                <Trash2 className="h-4 w-4" />
              </div>
              <div>
                <h3 id="delete-lead-modal-title" className="text-base font-semibold text-foreground">
                  Xác nhận xóa Lead khách hàng
                </h3>
                <p className="text-xs text-content-secondary">
                  Hành động này sẽ xóa vĩnh viễn bản ghi lead
                </p>
              </div>
            </div>

            <p className="text-xs sm:text-sm text-content-secondary leading-relaxed">
              Bạn có chắc chắn muốn xóa lead của khách hàng{' '}
              <strong className="text-foreground">"{deletingLead.fullName}"</strong> (
              <span className="font-mono tabular-nums">{maskPhoneNumber(deletingLead.phoneNumber)}</span>) với điểm số{' '}
              <strong className="text-amber-300 tabular-nums">
                {deletingLead.score.toLocaleString('vi-VN')} điểm
              </strong>
              ?
            </p>

            <div className="rounded-lg border border-warning/30 bg-warning/10 p-3 text-xs text-amber-200">
              * Lưu ý: Nếu khách hàng này đang có tên trong Bảng Xếp Hạng Top 10, vị trí sẽ tự động được đồng bộ và tính toán lại.
            </div>

            <div className="grid grid-cols-2 gap-2.5 pt-2">
              <Button
                ref={cancelDeleteBtnRef}
                type="button"
                variant="secondary"
                onClick={() => setDeletingLead(null)}
              >
                Hủy
              </Button>
              <Button
                type="button"
                variant="destructive"
                onClick={handleConfirmDeleteLead}
                className="gap-1.5"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Xác nhận xóa</span>
              </Button>
            </div>
          </Card>
        </div>
      )}

      {/* Clear All Leads Confirmation Modal */}
      {showClearAllModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-canvas/85 p-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-labelledby="clear-all-modal-title"
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowClearAllModal(false);
          }}
        >
          <Card
            className="w-full max-w-md border-destructive/40 p-5 sm:p-6 shadow-elevated space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3 border-b border-border-subtle pb-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-destructive/20 border border-destructive/40 text-destructive">
                <AlertTriangle className="h-4 w-4" />
              </div>
              <div>
                <h3 id="clear-all-modal-title" className="text-base font-semibold text-foreground">
                  Xác nhận xóa TOÀN BỘ lead
                </h3>
                <p className="text-xs text-rose-300 font-medium">
                  Cảnh báo: Hành động không thể hoàn tác
                </p>
              </div>
            </div>

            <p className="text-xs sm:text-sm text-content-secondary leading-relaxed">
              Bạn có chắc chắn muốn xóa vĩnh viễn toàn bộ{' '}
              <strong className="text-foreground tabular-nums">{leads.length} lead</strong> khách hàng đang lưu trữ trong hệ thống?
            </p>

            <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-xs text-rose-200 space-y-1">
              <p>&bull; Toàn bộ thông tin khách hàng và số điện thoại sẽ bị xóa sạch.</p>
              <p>&bull; Dữ liệu Bảng Xếp Hạng Top 10 cũng sẽ được làm mới hoàn toàn.</p>
            </div>

            <div className="grid grid-cols-2 gap-2.5 pt-2">
              <Button
                ref={cancelClearAllBtnRef}
                type="button"
                variant="secondary"
                onClick={() => setShowClearAllModal(false)}
              >
                Hủy
              </Button>
              <Button
                type="button"
                variant="destructive"
                onClick={handleConfirmClearAll}
                className="gap-1.5"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Xác nhận xóa hết</span>
              </Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
};

export default LeadDashboard;
