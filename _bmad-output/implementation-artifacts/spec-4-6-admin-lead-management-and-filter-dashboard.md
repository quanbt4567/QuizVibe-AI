# Technical Implementation Artifact — Story 4.6: Admin Lead Management & Filter Dashboard

## 1. Context & Business Value
Fanpage admins need an intuitive, responsive, and privacy-preserving dashboard to inspect, search, filter, and manage customer leads collected via QuizVibe AI promotions. This administrative tool operates completely client-side in localStorage without external databases or server backends, strictly abiding by Architectural Invariant AD-1.

## 2. Architecture & Data Flow
- **Canonical Source of Truth:** `quizvibe_leads` is the sole persistent canonical source of truth for all leads.
- **Derived Top 10 Cache:** `quizvibe_leaderboard` is a derived materialized view strictly computed from valid leads in `quizvibe_leads`.
- **Consistency & Recovery Strategy:**
  - Browser `localStorage` does not support multi-key atomic transactions. Therefore, operations report `success: false` if any storage write/delete operation fails.
  - `deleteLead(leadId)` verifies write success explicitly: any write failure (quota or general) restores original canonical leads in memory, reports typed failure (`QUOTA_EXCEEDED` or `STORAGE_FAILURE`), and halts before mutating leaderboard.
  - `clearLeads()` explicitly removes `quizvibe_leads` and `quizvibe_leaderboard`. If removal or recovery fails, failure is reported without claiming success.
  - `StorageService.reconcileLeaderboard()` rebuilds the Top 10 leaderboard deterministically from canonical leads using `compareLeaderboardEntries`.
  - Self-healing on read: `StorageService.getLeaderboard()` implements full consistency verification:
    1. Reconciles if leaderboard is empty while eligible leads exist.
    2. Reconciles if eligible leads are missing from the Top 10.
    3. Reconciles if entries are out of order according to `compareLeaderboardEntries`.
    4. Reconciles if any entry contains stale data (drift in score, time, or name) or ghost entries.
    5. Avoids unnecessary writes on read when the cache is already consistent.
  - Promotion: When a Top 10 lead is deleted, the next eligible player outside the Top 10 automatically advances into rank 10.
  - Isolation: Campaign settings (`quizvibe_active_campaign`), voucher configurations, and presets remain untouched during lead operations.
- **Privacy Enforcement:** Raw phone numbers are **never** rendered directly in DOM markup, text, titles, or tooltips. Displayed contact info is strictly formatted via `maskPhoneNumber()` (e.g. `091***5678`). Search queries internally support digits matching while maintaining zero visual leakage.
- **Score Formatting:** Score filter options and score badges strictly use score values without currency suffix `đ` (e.g. `≥ 1.500 (Xuất sắc)`).
- **Component Hierarchy:**
  - `AdminDashboard.tsx`
    - Tab 3 ("Quản lý Leads") $\rightarrow$ `LeadDashboard.tsx`
      - KPI Summary Cards (Total leads, Avg score, Max record, Claimed vouchers)
      - Filter Toolbar (Search input, Campaign dropdown, Score tier dropdown, Reset button)
      - Responsive Data View:
        - Desktop ($\ge$ md): Responsive HTML table with STT, Name, Masked Phone, Score, Time, Date, Voucher Code, Actions.
        - Mobile ($<$ md, 360px & 390px): Touch-friendly card view with $\ge 44$px touch targets.
      - Confirmation Modals:
        - Individual Lead Deletion Dialog (with focus management and Escape key dismissal).
        - Bulk Clear All Leads Dialog (with double-confirmation warning).

## 3. Acceptance Criteria Verification Matrix

| AC # | Requirement | Implementation / Test Verification | Status |
|---|---|---|---|
| **AC-1** | Leads table lists all collected records with Name, Phone, Score, Time, Date, Voucher Claimed | Rendered in both desktop table and mobile cards with readable vi-VN formatting. | **PASS** |
| **AC-2** | Real-time search filters by customer name or phone number | `filteredLeads` pipeline dynamically filters case-insensitively by name and digit-matching for phone. | **PASS** |
| **AC-3** | Individual "Xóa" removes lead from `quizvibe_leads` and `quizvibe_leaderboard` | Requires confirmation modal; calls `StorageService.deleteLead()`, which synchronizes both keys. | **PASS** |
| **AC-4** | "Xóa toàn bộ" opens confirmation modal; confirms clean wipe | Requires destructive confirmation dialog; calls `StorageService.clearLeads()`. | **PASS** |
| **AC-5** | Empty states for both no leads and no filter matches | Displays dedicated zero-state cards with reset actions. | **PASS** |
| **AC-6** | Strict phone number privacy | `maskPhoneNumber` used across all rendered states; no raw numbers exposed. | **PASS** |

## 4. Quality Gates Result
- **Unit & Integration Tests:** 263 tests passed across 17 test files (`npm test`).
- **TypeScript Typecheck:** 0 errors (`npx --no-install tsc --noEmit`).
- **Production Build:** Succeeded in 7.73s (`npm run build`).
- **Scope Boundary:** Story 4.7 (Excel CSV Export) has NOT been started.

