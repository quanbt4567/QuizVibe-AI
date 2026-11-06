---
name: premium-saas-ui
description: Guide the creation, architecture, and refinement of professional, high-density SaaS interfaces. Use when building admin dashboards, data tables, complex forms, analytics views, sidebars, and command navigation.
license: MIT
metadata:
  author: QuizVibe AI Core Team
  version: "1.0.0"
  tags: saas-ui dashboard data-tables form-design information-density
---

# Premium SaaS UI Engineering Guide

## 1. Purpose
Establish the engineering patterns, structural layout principles, and UX standards for building enterprise-grade, high-density SaaS interfaces for QuizVibe AI. This guide draws proven architectural patterns from **Shadcn Dashboard**, **Origin UI**, and **Blocks.so**, while eliminating generic AI-generated interface tropes.

---

## 2. When to Use
Invoke this skill when:
- Designing or restructuring Admin Dashboard layouts (`Sidebar`, `Header`, `Breadcrumbs`, `Navigation`).
- Implementing data tables with sorting, filtering, selection, and pagination.
- Building multi-step forms, campaign builders, or configuration panels.
- Creating KPI summary cards, analytics grids, or empty states.
- Refactoring loose cards or scattered views into cohesive SaaS workspaces.

---

## 3. Reference Repositories & What to Extract
1. **Shadcn Dashboard (`design-references/shadcndashboard`):**
   - **Extract:** Unified sidebar architecture (`SidebarProvider`, `SidebarContent`, `SidebarMenu`, `SidebarMenuButton`, collapsible states, cookie persistence), top navigation bar with breadcrumbs and user profile triggers.
2. **Origin UI (`design-references/originui`):**
   - **Extract:** Precision input groups, search inputs with clear button (`X`) and shortcut badge (`⌘K`), inline status indicators, accessible fieldsets, copy buttons with animated checkmarks, password strength meters.
3. **Blocks.so (`design-references/blocks`):**
   - **Extract:** KPI metric cards (`stats-01` to `stats-05`) with value + delta badge + contextual comparison text; professional data table toolbars with search, filter badges, bulk actions, and pagination footer (`tables/table-01` to `table-05`).

---

## 4. Architectural Patterns & Rules

### 4.1 Dashboard Layout Composition
Every administrative interface must follow a disciplined 3-zone structure:
```
+--------------------------------------------------------------------------+
| Top Command Bar: Breadcrumb | Global Search (⌘K) | Active Campaign | User|
+--------------------------------------------------------------------------+
| Collapsible Sidebar | Main Content Workspace                             |
| - Brand Logo        | - Page Header (Title + Description + Primary Action)|
| - Main Navigation   | - KPI Metrics Grid (1 to 4 cards)                   |
| - Filter Presets    | - Tabbed Sub-navigation / Secondary Filters         |
| - Workspace Switch  | - Main Data View (Table or Workflow Form)           |
| - Collapse Toggle   | - Contextual Drawer / Detail Pane (when selected)   |
+---------------------+----------------------------------------------------+
```

### 4.2 KPI Metric Card Standards
Metric cards must communicate actual business signal, not decorative eye-candy:
- **Card Container:** `bg-card border border-border rounded-xl p-4 sm:p-5`.
- **Top Row:** Metric label in `text-xs font-medium text-content-secondary` + subtle relevant icon in `text-content-muted`.
- **Primary Value:** Large, bold number in `text-2xl sm:text-3xl font-bold font-mono tabular-nums text-content-primary`.
- **Delta Indicator:** Inline badge with trend arrow:
  - Positive trend: `bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 text-[11px] font-semibold px-1.5 py-0.5 rounded`.
  - Negative trend: `bg-rose-500/15 text-rose-300 border border-rose-500/30 text-[11px] font-semibold px-1.5 py-0.5 rounded`.
- **Contextual Comparison:** Accompanying text (e.g. `so với 7 ngày trước`) in `text-xs text-content-muted`.

### 4.3 High-Density Data Table Architecture
A production data table must never be a raw HTML `<table>` dumped onto a page:
1. **Toolbar Header:**
   - Search input (`w-64 sm:w-80`) with leading search icon and trailing clear button.
   - Status / Filter dropdown buttons with active count badge.
   - Column visibility toggle or view presets.
   - Primary action button (e.g. `"Tạo mới"`, `"Xuất CSV"`).
2. **Table Header (`<thead>`):**
   - Compact height (`py-2.5 px-3.5`).
   - Sticky top with subtle translucent background (`bg-card/95 backdrop-blur-sm`).
   - Uppercase or small-caps typography in `text-[11px] font-semibold tracking-wider text-content-muted`.
3. **Table Body (`<tbody>`):**
   - Row height: Compact (`py-2.5` to `py-3` on desktop).
   - Alternating or subtle hover highlight (`hover:bg-interactive/40 transition-colors`).
   - Text aligned with column data type: text left-aligned, numbers right-aligned with `font-mono tabular-nums`.
4. **Empty State:**
   - Centered container within table body (`py-12 text-center`).
   - Muted icon in rounded container + clear title + 1-sentence explanation + primary action button.
5. **Pagination Footer:**
   - Left: Row count selection + total results (`Hiển thị 1-10 của 142 bản ghi`).
   - Right: Previous / Next buttons + numeric page pills.

### 4.4 Form & Input Group Standards (Origin UI Model)
- **Input Well:** Recessed surface (`bg-recessed border border-border rounded-lg text-content-primary placeholder:text-content-muted/60`).
- **Focus State:** 2px ring with crisp offset (`focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent`).
- **Input Groups:**
  - Leading addons (icon, country code, prefix): `border-r border-border bg-card/60 px-2.5 text-content-muted text-xs flex items-center`.
  - Trailing actions (clear button, copy trigger, unit badge): compact icon buttons with hover background.
- **Labels:** Crisp `text-xs font-medium text-content-primary mb-1.5 flex items-center justify-between`. Optional / required tags aligned right.
- **Validation Messages:** Inline below input with an `AlertCircle` icon in `text-xs text-destructive flex items-center gap-1.5 mt-1.5`.

---

## 5. Micro-Interactions & State Polish
- **Button Pressed State:** Tactile 3D buttons drop `translate-y-[1px]` or `[2px]` on active press.
- **Loading State:** Replace static buttons with a spinning `<Loader2 className="w-4 h-4 animate-spin" />` and disabled cursor.
- **Skeleton Loaders:** Match the exact dimensions of data tables and cards during asynchronous fetching.
- **Toast Notifications:** Use non-blocking bottom-right notifications for transient updates (`"Đã sao chép"`, `"Đã lưu bản nháp"`).

---

## 6. Anti-Patterns to Ban
- ❌ **No Floating Detached Glassmorphism Modals:** Avoid ungrounded floating modals with high-blur frosted glass that hurts legibility.
- ❌ **No Sprawling Low-Density Cards:** Do not waste vertical space with 80px padded empty cards. Keep admin controls concise and scannable.
- ❌ **No Decorative Line Charts Without Values:** Every chart must feature accessible tooltips, real axis values, and descriptive legends.
- ❌ **No Giant Dropdown Menus Without Search:** Select menus with more than 6 items must support search/filtering (like `IndustrySelect`).

---

## 7. Quality Checklist
- [ ] Interface features distinct Top Bar, Sidebar, and Content areas.
- [ ] Tables include sticky header, search filter, status badges, and pagination footer.
- [ ] Number columns are right-aligned and use `font-mono tabular-nums`.
- [ ] Forms group related fields with clear labels, helper text, and inline error states.
- [ ] Empty and loading states are handled explicitly.
- [ ] Responsive design verified: Sidebar collapses cleanly on screens < 1024px.
