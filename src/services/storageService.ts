import {
  Campaign,
  Lead,
  LeaderboardEntry,
  LeadSubmissionPayload,
  StorageResult,
  StorageErrorCode,
  STORAGE_KEYS,
  CURRENT_SCHEMA_VERSION,
  PresetIndustry,
} from '../types';
import {
  isCampaign,
  isLead,
  isLeaderboardEntry,
  maskPhoneNumber,
  validateLeadSubmission,
} from './validators';
import {
  COSMETICS_DEFAULT_CAMPAIGN,
  ALL_MOCK_PRESETS,
  MOCK_PRESET_LIST,
} from '../data/mockPresets';
import {
  generateLeadsCsv,
  generateCsvFilename,
  downloadCsvFile,
  CsvExportOptions,
} from './csvExport';

/**
 * StorageService provides an isolated, resilient storage abstraction over browser localStorage
 * with runtime schema validation, quota defense, in-memory recovery, and versioning.
 * Invariant AD-1: All application persistence must pass through this service. No external DB.
 */
class StorageServiceImplementation {
  private memoryStore: Map<string, string> = new Map();
  private isAvailable: boolean | null = null;

  constructor() {
    this.checkStorageAvailability();
    this.ensureSchemaVersion();
  }

  /**
   * Diagnostic check to verify whether window.localStorage is present and writable.
   */
  private checkStorageAvailability(): boolean {
    if (this.isAvailable !== null) {
      return this.isAvailable;
    }

    try {
      if (typeof window === 'undefined' || !window.localStorage) {
        this.isAvailable = false;
        return false;
      }
      // Accessing length tests whether SecurityError occurs in private browsing or sandboxed iframes
      void window.localStorage.length;
      this.isAvailable = true;
      return true;
    } catch (e) {
      console.warn('[StorageService] localStorage is unavailable (private mode or restricted). Falling back to memory.', e);
      this.isAvailable = false;
      return false;
    }
  }

  /**
   * Safe raw getItem with in-memory fallback.
   */
  private rawGet(key: string): { value: string | null; fromMemory: boolean } {
    if (!this.checkStorageAvailability()) {
      return { value: this.memoryStore.get(key) ?? null, fromMemory: true };
    }

    try {
      const val = window.localStorage.getItem(key);
      return { value: val, fromMemory: false };
    } catch (e) {
      console.warn(`[StorageService] Failed to read key "${key}" from localStorage. Reading from memory.`, e);
      return { value: this.memoryStore.get(key) ?? null, fromMemory: true };
    }
  }

  /**
   * Safe raw setItem with QuotaExceededError handling and in-memory persistence.
   */
  private rawSet(key: string, value: string): { success: boolean; isQuotaExceeded: boolean; fromMemory: boolean } {
    if (!this.checkStorageAvailability()) {
      this.memoryStore.set(key, value);
      return { success: true, isQuotaExceeded: false, fromMemory: true };
    }

    try {
      window.localStorage.setItem(key, value);
      // Keep memory mirror in sync
      this.memoryStore.set(key, value);
      return { success: true, isQuotaExceeded: false, fromMemory: false };
    } catch (error: unknown) {
      const err = error as { name?: string; code?: number } | null | undefined;
      const isQuota = Boolean(
        err &&
        (err.name === 'QuotaExceededError' ||
          err.name === 'NS_ERROR_DOM_QUOTA_REACHED' ||
          err.code === 22 ||
          err.code === 1014)
      );

      console.warn(`[StorageService] Failed to set "${key}". Quota exceeded: ${isQuota}. Preserving in memory.`, error);
      // Preserve user input in memoryStore so data is not lost during session
      this.memoryStore.set(key, value);

      return {
        success: false,
        isQuotaExceeded: isQuota,
        fromMemory: true,
      };
    }
  }

  /**
   * Safe raw removeItem with explicit failure reporting.
   */
  private rawRemove(key: string): { success: boolean; error?: string } {
    this.memoryStore.delete(key);
    if (this.checkStorageAvailability()) {
      try {
        window.localStorage.removeItem(key);
        return { success: true };
      } catch (e) {
        console.warn(`[StorageService] Failed to remove "${key}" from localStorage.`, e);
        return {
          success: false,
          error: e instanceof Error ? e.message : 'REMOVE_ERROR',
        };
      }
    }
    return { success: true };
  }

  /**
   * Ensures schema version exists and executes migration if version is obsolete.
   */
  public ensureSchemaVersion(): void {
    const { value } = this.rawGet(STORAGE_KEYS.SCHEMA_VERSION);
    if (!value) {
      this.rawSet(STORAGE_KEYS.SCHEMA_VERSION, String(CURRENT_SCHEMA_VERSION));
      return;
    }

    const version = parseInt(value, 10);
    if (isNaN(version) || version < CURRENT_SCHEMA_VERSION) {
      this.migrateSchema(isNaN(version) ? 0 : version, CURRENT_SCHEMA_VERSION);
    }
  }

  /**
   * Upgrades schemas between versions.
   */
  private migrateSchema(fromVersion: number, toVersion: number): void {
    console.info(`[StorageService] Migrating schema from v${fromVersion} to v${toVersion}`);
    // Future migrations will transform stored records here.
    this.rawSet(STORAGE_KEYS.SCHEMA_VERSION, String(toVersion));
  }

  // ==========================================
  // Campaign Persistence Operations
  // ==========================================

  /**
   * Retrieves active quiz campaign. Validates schema before returning.
   */
  public getCampaign(): StorageResult<Campaign | null> {
    const { value, fromMemory } = this.rawGet(STORAGE_KEYS.ACTIVE_CAMPAIGN);
    if (!value) {
      return { success: true, data: null, isMemoryFallback: fromMemory };
    }

    try {
      const parsed = JSON.parse(value);
      if (isCampaign(parsed)) {
        return { success: true, data: parsed, isMemoryFallback: fromMemory };
      }

      console.warn('[StorageService] Active campaign in storage failed schema validation. Returning null.');
      return {
        success: false,
        data: null,
        error: 'VALIDATION_FAILED',
        message: 'Dữ liệu chiến dịch trong bộ nhớ không đúng định dạng chuẩn.',
        isMemoryFallback: fromMemory,
      };
    } catch (e) {
      console.warn('[StorageService] Malformed JSON encountered for active campaign.', e);
      return {
        success: false,
        data: null,
        error: 'PARSE_ERROR',
        message: 'Không thể giải mã dữ liệu chiến dịch.',
        isMemoryFallback: fromMemory,
      };
    }
  }

  /**
   * Saves active campaign after validating schema.
   */
  public saveCampaign(campaign: Campaign): StorageResult<Campaign> {
    if (!isCampaign(campaign)) {
      return {
        success: false,
        error: 'VALIDATION_FAILED',
        message: 'Cấu trúc chiến dịch không hợp lệ.',
      };
    }

    const json = JSON.stringify(campaign);
    const result = this.rawSet(STORAGE_KEYS.ACTIVE_CAMPAIGN, json);

    if (result.isQuotaExceeded) {
      return {
        success: false,
        data: campaign,
        error: 'QUOTA_EXCEEDED',
        message: 'Bộ nhớ trình duyệt đã đầy. Dữ liệu chỉ được lưu tạm thời trong phiên làm việc.',
        isMemoryFallback: true,
      };
    }

    return {
      success: true,
      data: campaign,
      isMemoryFallback: result.fromMemory,
    };
  }

  /**
   * Bootstraps the default quiz campaign (Cosmetics & Skincare with voucher VIBE20).
   * Idempotent: If a valid campaign already exists in storage, preserves it without overwriting.
   * If forceReset is true, re-seeds the default campaign.
   */
  public initializeDefaults(forceReset: boolean = false): StorageResult<Campaign> {
    this.ensureSchemaVersion();

    if (!forceReset) {
      const existing = this.getCampaign();
      if (existing.success && existing.data) {
        return {
          success: true,
          data: existing.data,
          isMemoryFallback: existing.isMemoryFallback,
        };
      }
    }

    return this.saveCampaign(COSMETICS_DEFAULT_CAMPAIGN);
  }

  /**
   * Returns the list of all approved industry presets (Cosmetics, Fashion, Tech Gadgets, F&B).
   */
  public getPresets(): Campaign[] {
    return MOCK_PRESET_LIST;
  }

  /**
   * Retrieves a specific industry mock preset without saving it to storage.
   */
  public getPreset(industryKey: PresetIndustry | string): Campaign | undefined {
    const key = industryKey.toLowerCase().trim();
    return (
      ALL_MOCK_PRESETS[key] ??
      MOCK_PRESET_LIST.find(
        (p) =>
          p.industry.toLowerCase() === key ||
          p.id.toLowerCase() === key ||
          p.title.toLowerCase().includes(key)
      )
    );
  }

  /**
   * Applies an industry mock preset as the active campaign.
   */
  public applyPreset(industryKey: PresetIndustry | string): StorageResult<Campaign> {
    const key = industryKey.toLowerCase().trim();
    const preset =
      ALL_MOCK_PRESETS[key] ??
      MOCK_PRESET_LIST.find(
        (p) =>
          p.industry.toLowerCase() === key ||
          p.id.toLowerCase() === key ||
          p.title.toLowerCase().includes(key)
      );

    if (!preset) {
      return {
        success: false,
        error: 'NOT_FOUND',
        message: `Không tìm thấy preset ngành hàng "${industryKey}".`,
      };
    }

    return this.saveCampaign(preset);
  }

  // ==========================================
  // Leads Persistence Operations
  // ==========================================

  /**
   * Retrieves all registered leads. Filters out corrupt records.
   */
  public getLeads(): StorageResult<Lead[]> {
    const { value, fromMemory } = this.rawGet(STORAGE_KEYS.LEADS);
    if (!value) {
      return { success: true, data: [], isMemoryFallback: fromMemory };
    }

    try {
      const parsed = JSON.parse(value);
      if (!Array.isArray(parsed)) {
        console.warn('[StorageService] Leads storage is not an array. Resetting to empty array.');
        return { success: true, data: [], isMemoryFallback: fromMemory };
      }

      const validLeads = parsed.filter(isLead);
      return { success: true, data: validLeads, isMemoryFallback: fromMemory };
    } catch (e) {
      console.warn('[StorageService] Malformed JSON in leads storage. Falling back to empty array.', e);
      return {
        success: false,
        data: [],
        error: 'PARSE_ERROR',
        message: 'Lỗi định dạng danh sách leads.',
        isMemoryFallback: fromMemory,
      };
    }
  }

  /**
   * Appends or updates a lead directly.
   */
  public saveLead(lead: Lead): StorageResult<Lead> {
    if (!isLead(lead)) {
      return {
        success: false,
        error: 'VALIDATION_FAILED',
        message: 'Dữ liệu lead không hợp lệ.',
      };
    }

    const currentLeadsRes = this.getLeads();
    const leads = currentLeadsRes.data ?? [];
    const index = leads.findIndex((l) => l.id === lead.id);

    if (index >= 0) {
      leads[index] = lead;
    } else {
      leads.unshift(lead); // latest lead on top
    }

    const setResult = this.rawSet(STORAGE_KEYS.LEADS, JSON.stringify(leads));
    if (setResult.isQuotaExceeded) {
      return {
        success: false,
        data: lead,
        error: 'QUOTA_EXCEEDED',
        message: 'Bộ nhớ trình duyệt đã đầy. Lead được lưu tạm trong bộ nhớ.',
        isMemoryFallback: true,
      };
    }

    return {
      success: true,
      data: lead,
      isMemoryFallback: setResult.fromMemory,
    };
  }

  /**
   * Deletes a lead by ID and synchronizes the Top 10 leaderboard.
   * Reconciliation strategy:
   * 1. quizvibe_leads is the canonical persistent source of truth.
   * 2. Treats any failed lead write (quota or general failure) as an explicit error.
   * 3. Preserves original canonical leads in both localStorage and memoryStore on write failure.
   * 4. Does not execute leaderboard reconciliation if canonical write fails.
   * 5. Guarantees promotion: if a Top 10 lead is deleted and > 10 leads exist,
   *    the 11th lead advances into the Top 10 deterministically.
   */
  public deleteLead(leadId: string): StorageResult<boolean> {
    const currentLeadsRes = this.getLeads();
    if (!currentLeadsRes.success) {
      return {
        success: false,
        data: false,
        error: currentLeadsRes.error,
        message: currentLeadsRes.message || 'Không thể đọc danh sách lead từ bộ nhớ.',
      };
    }

    const currentLeads = currentLeadsRes.data ?? [];
    const leadExists = currentLeads.some((l) => l.id === leadId);
    if (!leadExists) {
      // Reconcile in case of orphaned leaderboard records
      this.reconcileLeaderboard();
      return { success: true, data: true };
    }

    const updated = currentLeads.filter((l) => l.id !== leadId);
    const setResult = this.rawSet(STORAGE_KEYS.LEADS, JSON.stringify(updated));

    if (!setResult.success) {
      // Restore original canonical data into memoryStore to prevent state corruption on failed write
      this.memoryStore.set(STORAGE_KEYS.LEADS, JSON.stringify(currentLeads));
      return {
        success: false,
        data: false,
        error: setResult.isQuotaExceeded ? 'QUOTA_EXCEEDED' : 'STORAGE_FAILURE',
        message: setResult.isQuotaExceeded
          ? 'Bộ nhớ trình duyệt đã đầy khi lưu danh sách lead.'
          : 'Lỗi khi lưu danh sách lead vào bộ nhớ.',
      };
    }

    // Reconcile Top 10 leaderboard from updated canonical leads
    const reconcileRes = this.reconcileLeaderboard();
    if (!reconcileRes.success) {
      return {
        success: false,
        data: false,
        error: reconcileRes.error || 'LEADERBOARD_SYNC_FAILED',
        message: 'Đã xóa lead nhưng không thể đồng bộ bảng xếp hạng.',
      };
    }

    return {
      success: true,
      data: true,
      isMemoryFallback: setResult.fromMemory || reconcileRes.isMemoryFallback,
    };
  }

  /**
   * Clears all leads and synchronizes the leaderboard.
   * Consistency & Recovery Strategy:
   * - Browser localStorage does not provide multi-key atomic transactions.
   * - Explicitly removes quizvibe_leads and quizvibe_leaderboard.
   * - If removing either key encounters an exception/failure, reports success: false.
   * - Invokes recovery reconciliation and propagates recovery failure status if both fail.
   * - Ensures campaign settings, voucher configuration, and other keys remain untouched.
   */
  public clearLeads(): StorageResult<boolean> {
    try {
      const leadsBackup = this.rawGet(STORAGE_KEYS.LEADS);
      const lbBackup = this.rawGet(STORAGE_KEYS.LEADERBOARD);

      const leadsRemove = this.rawRemove(STORAGE_KEYS.LEADS);
      const lbRemove = this.rawRemove(STORAGE_KEYS.LEADERBOARD);

      // Explicit post-deletion verification:
      // Canonical leads read must succeed and data must be a valid array with length exactly 0
      const currentLeadsRes = this.getLeads();
      const isVerifiedEmpty = Boolean(
        currentLeadsRes.success &&
        Array.isArray(currentLeadsRes.data) &&
        currentLeadsRes.data.length === 0
      );

      // clearLeads must never report success if raw removals failed or verification was not confirmed empty
      if (!leadsRemove.success || !lbRemove.success || !isVerifiedEmpty) {
        // If leads removal failed, preserve recoverable data in memoryStore
        if (!leadsRemove.success && leadsBackup.value !== null) {
          this.memoryStore.set(STORAGE_KEYS.LEADS, leadsBackup.value);
        }
        if (!lbRemove.success && lbBackup.value !== null) {
          this.memoryStore.set(STORAGE_KEYS.LEADERBOARD, lbBackup.value);
        }

        // Avoid destructive recovery actions if canonical leads read failed:
        // Only attempt reconcileLeaderboard if currentLeadsRes succeeded (meaning we know the canonical leads state)
        let recoveryRes: StorageResult<LeaderboardEntry[]> | null = null;
        if (currentLeadsRes.success) {
          recoveryRes = this.reconcileLeaderboard();
        } else {
          // If canonical leads could not be verified, restore leaderboard backup if available
          if (lbBackup.value !== null) {
            this.memoryStore.set(STORAGE_KEYS.LEADERBOARD, lbBackup.value);
          }
        }

        let message = 'Lỗi khi xóa dữ liệu lead hoặc bảng xếp hạng từ bộ nhớ trình duyệt.';
        let errorCode: StorageErrorCode = 'STORAGE_FAILURE';

        if (!currentLeadsRes.success) {
          message = currentLeadsRes.message || 'Không thể xác thực trạng thái danh sách lead sau khi xóa.';
          errorCode = currentLeadsRes.error || 'STORAGE_FAILURE';
        } else if (!leadsRemove.success || (currentLeadsRes.data && currentLeadsRes.data.length > 0)) {
          message = 'Không thể xóa dữ liệu lead từ bộ nhớ trình duyệt.';
        } else if (!lbRemove.success) {
          message = 'Đã xóa dữ liệu lead nhưng không thể xóa bảng xếp hạng từ bộ nhớ trình duyệt.';
        }

        if (recoveryRes && !recoveryRes.success) {
          message = 'Lỗi khi xóa dữ liệu lead và không thể đồng bộ phục hồi bảng xếp hạng.';
        }

        return {
          success: false,
          data: false,
          error: errorCode,
          message,
        };
      }

      return { success: true, data: true };
    } catch (err) {
      console.error('[StorageService] Unexpected error in clearLeads:', err);
      return {
        success: false,
        data: false,
        error: 'STORAGE_FAILURE',
        message: 'Lỗi không xác định khi xoá danh sách leads.',
      };
    }
  }

  /**
   * Generates an RFC 4180 compliant CSV string for leads, with UTF-8 BOM readiness.
   * If leads are not explicitly provided, reads canonical leads from storage.
   * Does not mutate stored leads or leaderboard data (Story 4.7, ARCH-6, AD-6).
   */
  public exportLeadsToCsv(
    leads?: Lead[],
    options?: CsvExportOptions
  ): StorageResult<string> {
    try {
      let targetLeads: Lead[] = [];
      if (leads) {
        targetLeads = leads;
      } else {
        const leadsRes = this.getLeads();
        if (!leadsRes.success) {
          return {
            success: false,
            data: '',
            error: leadsRes.error || 'STORAGE_FAILURE',
            message: leadsRes.message || 'Không thể đọc danh sách lead để xuất file CSV.',
          };
        }
        targetLeads = leadsRes.data || [];
      }

      const csvContent = generateLeadsCsv(targetLeads, options);
      return {
        success: true,
        data: csvContent,
      };
    } catch (err) {
      console.error('[StorageService] Failed to export leads to CSV:', err);
      return {
        success: false,
        data: '',
        error: 'STORAGE_FAILURE',
        message: 'Lỗi không xác định khi xuất file CSV.',
      };
    }
  }

  /**
   * Triggers download of the leads CSV file in the browser with UTF-8 BOM prepended.
   */
  public downloadLeadsCsv(
    leads?: Lead[],
    options?: CsvExportOptions & { filename?: string }
  ): StorageResult<boolean> {
    try {
      const csvRes = this.exportLeadsToCsv(leads, options);
      if (!csvRes.success || csvRes.data === undefined) {
        return {
          success: false,
          data: false,
          error: csvRes.error,
          message: csvRes.message,
        };
      }

      const filename = options?.filename || generateCsvFilename();
      const downloaded = downloadCsvFile(csvRes.data, filename);

      if (!downloaded) {
        return {
          success: false,
          data: false,
          error: 'STORAGE_FAILURE',
          message: 'Không thể tải file CSV về trình duyệt.',
        };
      }

      return {
        success: true,
        data: true,
      };
    } catch (err) {
      console.error('[StorageService] Error triggering CSV download:', err);
      return {
        success: false,
        data: false,
        error: 'STORAGE_FAILURE',
        message: 'Lỗi khi kích hoạt tải file CSV.',
      };
    }
  }

  // ==========================================
  // Leaderboard Persistence Operations
  // ==========================================

  /**
   * Reconciles and rebuilds the Top 10 leaderboard strictly from the canonical leads storage.
   * Canonical ordering (Story 4.4, TC-02, FR-402):
   * 1. Score DESC (higher score ranks higher)
   * 2. Time Taken Seconds ASC (faster answering time ranks higher)
   * 3. Submitted At ASC (earlier submission date ranks higher)
   */
  public reconcileLeaderboard(): StorageResult<LeaderboardEntry[]> {
    const leadsRes = this.getLeads();
    if (!leadsRes.success) {
      return {
        success: false,
        data: [],
        error: leadsRes.error,
        message: leadsRes.message || 'Không thể đọc danh sách lead từ bộ nhớ.',
        isMemoryFallback: leadsRes.isMemoryFallback,
      };
    }
    const leads = leadsRes.data ?? [];

    const candidates: LeaderboardEntry[] = leads.map((l) => ({
      id: `lb_${l.id}`,
      leadId: l.id,
      fullName: l.fullName,
      phoneNumber: l.phoneNumber,
      maskedPhone: maskPhoneNumber(l.phoneNumber),
      score: l.score,
      timeTakenSeconds: typeof l.timeTakenSeconds === 'number' && !isNaN(l.timeTakenSeconds) ? l.timeTakenSeconds : 0,
      rank: 0,
      submittedAt: l.submittedAt,
    }));

    candidates.sort(compareLeaderboardEntries);

    const top10: LeaderboardEntry[] = candidates.slice(0, 10).map((entry, idx) => ({
      ...entry,
      rank: idx + 1,
    }));

    return this.saveLeaderboard(top10);
  }

  /**
   * Retrieves the Top 10 leaderboard entries, deterministically sorted.
   * Full consistency criteria against canonical leads:
   * 1. If reading canonical leads fails, returns failure without mutating storage or clearing cache.
   * 2. If canonical leads is empty, leaderboard must be empty.
   * 3. Validates duplicate leadId detection: every entry must reference a unique eligible lead.
   * 4. Compares actual leaderboard against expected ordered Top 10 (Story 4.4 compareLeaderboardEntries).
   * 5. Reconciles if entries are duplicated, missing, unexpected, out of order, or stale.
   * 6. Avoids unnecessary writes when the cached leaderboard exactly matches expected result.
   */
  public getLeaderboard(): StorageResult<LeaderboardEntry[]> {
    // 1. Safe canonical read check (Issue 1)
    const canonicalLeadsRes = this.getLeads();
    if (!canonicalLeadsRes.success) {
      return {
        success: false,
        data: [],
        error: canonicalLeadsRes.error,
        message: canonicalLeadsRes.message || 'Không thể đọc danh sách lead từ bộ nhớ.',
        isMemoryFallback: canonicalLeadsRes.isMemoryFallback,
      };
    }
    const canonicalLeads = canonicalLeadsRes.data ?? [];

    // 2. Compute canonical expected Top 10 using Story 4.4 rules & canonical comparator
    const expectedCandidates: LeaderboardEntry[] = canonicalLeads.map((l) => ({
      id: `lb_${l.id}`,
      leadId: l.id,
      fullName: l.fullName,
      phoneNumber: l.phoneNumber,
      maskedPhone: maskPhoneNumber(l.phoneNumber),
      score: l.score,
      timeTakenSeconds: typeof l.timeTakenSeconds === 'number' && !isNaN(l.timeTakenSeconds) ? l.timeTakenSeconds : 0,
      rank: 0,
      submittedAt: l.submittedAt,
    }));
    expectedCandidates.sort(compareLeaderboardEntries);
    const expectedTop10 = expectedCandidates.slice(0, 10).map((entry, idx) => ({
      ...entry,
      rank: idx + 1,
    }));

    const { value, fromMemory } = this.rawGet(STORAGE_KEYS.LEADERBOARD);
    if (!value) {
      if (expectedTop10.length > 0) {
        // Case 1: Leaderboard is empty while eligible leads exist
        return this.reconcileLeaderboard();
      }
      return { success: true, data: [], isMemoryFallback: fromMemory };
    }

    try {
      const parsed = JSON.parse(value);
      if (!Array.isArray(parsed)) {
        return this.reconcileLeaderboard();
      }

      const validEntries = parsed.filter(isLeaderboardEntry);

      // Verify count
      if (validEntries.length !== expectedTop10.length) {
        return this.reconcileLeaderboard();
      }

      if (expectedTop10.length === 0) {
        return { success: true, data: [], isMemoryFallback: fromMemory };
      }

      // Detect duplicate leadId entries (Issue 2)
      const leadIdSet = new Set(validEntries.map((e) => e.leadId));
      if (leadIdSet.size !== validEntries.length) {
        return this.reconcileLeaderboard();
      }

      // Compare actual vs expected ordered Top 10 item by item (Issue 2: missing, unexpected, out-of-order, or stale data including submittedAt)
      for (let i = 0; i < expectedTop10.length; i++) {
        const actual = validEntries[i];
        const expected = expectedTop10[i];
        if (
          actual.leadId !== expected.leadId ||
          actual.score !== expected.score ||
          actual.timeTakenSeconds !== expected.timeTakenSeconds ||
          actual.fullName !== expected.fullName ||
          actual.submittedAt !== expected.submittedAt ||
          actual.rank !== expected.rank
        ) {
          return this.reconcileLeaderboard();
        }
      }

      // Cache is completely consistent with expected Top 10 - return with zero storage writes
      return { success: true, data: validEntries, isMemoryFallback: fromMemory };
    } catch (e) {
      console.warn('[StorageService] Malformed JSON in leaderboard storage. Returning empty list.', e);
      return {
        success: false,
        data: [],
        error: 'PARSE_ERROR',
        message: 'Lỗi định dạng dữ liệu bảng xếp hạng.',
        isMemoryFallback: fromMemory,
      };
    }
  }

  /**
   * Saves updated leaderboard entries.
   */
  public saveLeaderboard(entries: LeaderboardEntry[]): StorageResult<LeaderboardEntry[]> {
    const valid = entries.filter(isLeaderboardEntry);
    const setResult = this.rawSet(STORAGE_KEYS.LEADERBOARD, JSON.stringify(valid));

    if (!setResult.success) {
      return {
        success: false,
        data: valid,
        error: setResult.isQuotaExceeded ? 'QUOTA_EXCEEDED' : 'STORAGE_FAILURE',
        message: setResult.isQuotaExceeded ? 'Bộ nhớ trình duyệt đã đầy.' : 'Lỗi khi lưu bảng xếp hạng vào bộ nhớ.',
        isMemoryFallback: true,
      };
    }

    return {
      success: true,
      data: valid,
      isMemoryFallback: setResult.fromMemory,
    };
  }

  // ==========================================
  // Gated Lead Submission Pipeline (AD-4)
  // ==========================================

  /**
   * Submits a new lead with atomic validation, persisting to both leads list
   * and updating the Top 10 Leaderboard ranking deterministically.
   * Invariant AD-4: Unverified or invalid leads CANNOT write to quizvibe_leaderboard.
   */
  public submitLead(payload: LeadSubmissionPayload): StorageResult<{
    lead: Lead;
    leaderboard: LeaderboardEntry[];
    rank: number;
  }> {
    // 1. Strict validation
    const validation = validateLeadSubmission(payload);
    if (!validation.valid || !validation.sanitized) {
      return {
        success: false,
        error: 'INVALID_LEAD',
        message: validation.errors.join(' '),
      };
    }

    const { fullName, phoneNumber, score, timeTakenSeconds, voucherCode, campaignId } = validation.sanitized;
    const nowIso = new Date().toISOString();
    const leadId = `lead_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

    // 2. Construct Lead record
    const newLead: Lead = {
      id: leadId,
      fullName,
      phoneNumber,
      score,
      voucherCode,
      campaignId,
      submittedAt: nowIso,
      timeTakenSeconds,
    };

    // 3. Save Lead to Leads list
    const saveLeadRes = this.saveLead(newLead);
    if (!saveLeadRes.success && saveLeadRes.error !== 'QUOTA_EXCEEDED') {
      return {
        success: false,
        error: saveLeadRes.error,
        message: saveLeadRes.message,
      };
    }

    // 4. Update Leaderboard (Deterministic sorting: Score DESC, TimeTakenSeconds ASC, SubmittedAt ASC)
    const currentLeaderboard = this.getLeaderboard().data ?? [];

    const newLeaderboardCandidate: LeaderboardEntry = {
      id: `lb_${leadId}`,
      leadId,
      fullName,
      phoneNumber,
      maskedPhone: maskPhoneNumber(phoneNumber),
      score,
      timeTakenSeconds,
      rank: 0, // calculated below
      submittedAt: nowIso,
    };

    // Merge and re-rank deterministically without duplicate lead entries
    const existingFiltered = currentLeaderboard.filter((e) => e.leadId !== leadId);
    const combined = [...existingFiltered, newLeaderboardCandidate];
    combined.sort(compareLeaderboardEntries);

    // Assign rank 1..N and slice to Top 10
    const rankedTop10: LeaderboardEntry[] = combined.slice(0, 10).map((entry, index) => ({
      ...entry,
      rank: index + 1,
    }));

    // Find rank of the newly submitted player
    const playerRankIndex = rankedTop10.findIndex((e) => e.leadId === leadId);
    const assignedRank = playerRankIndex >= 0 ? playerRankIndex + 1 : combined.findIndex((e) => e.leadId === leadId) + 1;

    // Persist Top 10
    this.saveLeaderboard(rankedTop10);

    return {
      success: true,
      data: {
        lead: newLead,
        leaderboard: rankedTop10,
        rank: assignedRank,
      },
      isMemoryFallback: saveLeadRes.isMemoryFallback,
    };
  }

  // ==========================================
  // Maintenance & Testing Utilities
  // ==========================================

  /**
   * Resets all QuizVibe keys (for testing or full reset).
   */
  public clearAll(): void {
    Object.values(STORAGE_KEYS).forEach((k) => this.rawRemove(k));
  }

  /**
   * Inspects current memory fallback store (for unit tests).
   */
  public getMemoryStoreValue(key: string): string | undefined {
    return this.memoryStore.get(key);
  }

  /**
   * Directly injects simulated localStorage availability (for unit tests).
   */
  public _setStorageAvailableForTest(available: boolean | null): void {
    this.isAvailable = available;
  }
}

export const StorageService = new StorageServiceImplementation();

/**
 * Canonical deterministic leaderboard sorting comparator (TC-02, FR-402):
 * 1. Score DESC (higher score ranks higher)
 * 2. Time Taken Seconds ASC (faster answering time ranks higher)
 * 3. Submitted At ASC (earlier submission date ranks higher)
 *
 * Defensively handles missing, NaN, or invalid date values,
 * guaranteeing no NaN comparator returns and returning 0 when all fields are identical.
 */
export function compareLeaderboardEntries(a: LeaderboardEntry, b: LeaderboardEntry): number {
  // 1. Score DESC (higher score wins)
  const scoreA = typeof a?.score === 'number' && !isNaN(a.score) ? a.score : 0;
  const scoreB = typeof b?.score === 'number' && !isNaN(b.score) ? b.score : 0;
  if (scoreB !== scoreA) {
    return scoreB - scoreA;
  }

  // 2. Time Taken Seconds ASC (faster time wins)
  const timeA =
    typeof a?.timeTakenSeconds === 'number' && !isNaN(a.timeTakenSeconds)
      ? a.timeTakenSeconds
      : Number.MAX_SAFE_INTEGER;
  const timeB =
    typeof b?.timeTakenSeconds === 'number' && !isNaN(b.timeTakenSeconds)
      ? b.timeTakenSeconds
      : Number.MAX_SAFE_INTEGER;
  if (timeA !== timeB) {
    return timeA - timeB;
  }

  // 3. Submitted At ASC (earlier submission date wins)
  const dateA = a?.submittedAt ? new Date(a.submittedAt).getTime() : NaN;
  const dateB = b?.submittedAt ? new Date(b.submittedAt).getTime() : NaN;
  const validDateA = !isNaN(dateA) ? dateA : Number.MAX_SAFE_INTEGER;
  const validDateB = !isNaN(dateB) ? dateB : Number.MAX_SAFE_INTEGER;
  if (validDateA !== validDateB) {
    return validDateA - validDateB;
  }

  return 0;
}

