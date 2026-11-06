---
status: final
stepsCompleted: ["step-01-validate-prerequisites", "step-02-design-epics", "step-03-create-stories", "step-04-final-validation"]
inputDocuments:
  - "_bmad-output/prd.md"
  - "_bmad-output/architecture.md"
  - "_bmad-output/DESIGN.md"
  - "_bmad-output/EXPERIENCE.md"
  - "_bmad-output/competition-requirements-analysis.md"
---

# QuizVibe AI - Epic Breakdown

## Overview

This document provides the complete epic and story breakdown for QuizVibe AI, decomposing the requirements from the PRD, UX Design specifications, and Architecture decisions into implementable, testable user stories.

---

## Requirements Inventory

### Functional Requirements

* **FR-101**: Manual Quiz Authoring — Admin can manually input 5 questions with 4 distinct options each and designate 1 correct answer index (0-3).
* **FR-102**: Real AI Quiz Generation via Google Gemini — Admin can generate 5 questions using preset industries (Fashion, Cosmetics, Tech, F&B) or custom topic with difficulty selector, invoking Gemini 3.8 Flash via serverless proxy.
* **FR-103**: AI Resilience, Repair & Transparent Mock Mode — Proxy performs JSON schema validation with 1-shot repair. On failure, UI presents retry or manual mode. Offline mock mode is explicitly labeled: *"Bản demo vòng loại - Dữ liệu mô phỏng AI"*.
* **FR-104**: Mandatory Admin Review Gate — AI-generated questions are loaded into an interactive review editor where Admin can edit text, options, or answer keys before activating.
* **FR-105**: Voucher Campaign Configuration — Admin configures voucher reward: code, discount percentage/amount, minimum order, expiration days, and terms.
* **FR-201**: Single-Question Progression — Players view questions one at a time with visible progress indicator (e.g. `Câu 1/5`), with past questions locked.
* **FR-202**: 30-Second Countdown Timer — Real-time 30-second countdown per question with color-coded urgency states.
* **FR-203**: Mathematical Speed Scoring — Points awarded per correct answer: $\text{Score} = 100 + (10 \times T_{\text{rem}})$. Wrong answer or timeout = 0 pts. Total maximum = 2,000 pts.
* **FR-204**: Timeout & Race-Condition Lock — At `00:00`, buttons lock immediately, awards 0 pts, flashes 1s feedback, and advances; late clicks rejected.
* **FR-301**: Performance Breakdown — Results screen displays total score, correct/incorrect count, and total active answering time.
* **FR-302**: Vietnamese Phone Lead Capture Form — Captures Full Name ($\ge 2$ chars) and Vietnamese Phone Number (`/^(03|05|07|08|09)\d{8}$/`) with explicit privacy notice.
* **FR-303**: Instant Voucher Unlock Display — Valid lead submission displays unlocked voucher code, terms, one-click copy button, and demo label.
* **FR-401**: Gated Leaderboard Qualification — Only players who submit a valid name and phone qualify for Top 10 leaderboard; anonymous players see score but do not rank.
* **FR-402**: Deterministic Ranking & Tie-Breaking — Top 10 ranked by Total Score DESC, tie-broken by Total Active Answering Time ASC, then submission time.
* **FR-501**: Dynamic Share Content Generation — Formats boast-worthy viral message with player score, shop name, discount voucher, and quiz link.
* **FR-502**: Progressive Social Sharing — Uses `navigator.share()` on supported mobile devices; falls back to clipboard copy with confirmation toast.
* **FR-601**: Lead Management Dashboard — Admin can view, search by name/phone, delete individual lead records, or clear all records with a confirmation prompt.
* **FR-602**: UTF-8 BOM CSV Export — Admin can download leads as CSV prepended with `\uFEFF` for Excel compatibility.

### NonFunctional Requirements

* **NFR-1**: Performance — First Contentful Paint $\le 1.5\text{s}$ on mobile 4G; question transitions within $\le 100\text{ms}$.
* **NFR-2**: Mobile-First Responsiveness — Viewports 360px–430px optimized for Facebook in-app browser webview; desktop-responsive for Admin.
* **NFR-3**: Security & Key Isolation — `GEMINI_API_KEY` stored strictly on serverless proxy on Vercel; zero client-side key exposure.
* **NFR-4**: Robustness & XSS Prevention — Sanitizes all user-submitted text (names, topics) before rendering.
* **NFR-5**: Zero External Database — Pure `localStorage` persistence without external DB dependencies.

### Additional Requirements (Architecture & Storage Reliability)

* **ARCH-1**: Starter Template — React 19 + TypeScript + Vite 6 + Tailwind CSS + Lucide Icons greenfield starter scaffold.
* **ARCH-2 (AD-1)**: `StorageService` encapsulation — Single source of truth for `localStorage` (`quizvibe_active_campaign`, `quizvibe_leads`, `quizvibe_leaderboard`).
* **ARCH-3 (AD-2)**: Vercel Serverless Function — `/api/generate-quiz` handles Gemini 3.8 Flash calls without leaking secrets.
* **ARCH-4 (AD-3)**: Deterministic Quiz Engine Hook — `useQuizEngine` manages state, timer, speed scoring, and atomic `isLocked` flag.
* **ARCH-5 (AD-5)**: Schema Validator & Error Envelope — Strict 5 Qs $\times$ 4 options schema check with 1-shot repair; fallback envelope.
* **ARCH-6 (AD-6)**: UTF-8 BOM CSV Serializer — Prepend `\uFEFF` before generating Blob for CSV download.
* **ARCH-7 (Storage Reliability)**: Storage Validation & Quota Defense — Schema validation before reading/writing, schema versioning/migration, graceful handling of storage quotas and corrupt JSON, preserving user inputs on write failure.

### UX Design Requirements

* **UX-DR1**: Visual Tokens & Typography — Electric Indigo/Fuchsia/Amber/Emerald/Slate color palette; `Plus Jakarta Sans` for UI and `font-mono` tabular figures for countdown timer.
* **UX-DR2**: Touch Target Standard — Minimum 52px tap height for all answer option buttons and primary CTAs.
* **UX-DR3**: Dynamic Timer Visuals — Smooth color transition: Green ($>15\text{s}$) $\to$ Amber ($6\text{--}15\text{s}$) $\to$ Pulsing Crimson ($\le 5\text{s}$).
* **UX-DR4**: Voucher Ticket Styling — Dashed coupon ticket styling (`border-dashed`), copy button icon feedback with clipboard toast.
* **UX-DR5**: Comprehensive States — Skeleton loading state for AI generation; empty podium illustration for empty leaderboard; inline red validation errors for phone input; tactile tap feedback (`scale-[0.98]`).
* **UX-DR6**: Accessibility Floor — WCAG 2.1 AA contrast ratio ($\ge 4.5:1$), full keyboard navigation, ARIA `polite` timer announcements.

---

### FR Coverage Map

| Requirement | Epic Assignment | Story Assignment | Description |
| :--- | :--- | :--- | :--- |
| **ARCH-1, ARCH-2, ARCH-7** | **Epic 1** | Story 1.1, 1.2, 1.3 | Project foundation, storage service, default campaign |
| **FR-101** | **Epic 2** | Story 2.1 | Manual Quiz Authoring Form (5 questions $\times$ 4 options) |
| **FR-102** | **Epic 2** | Story 2.2 | Gemini 3.8 Flash AI generation via serverless proxy |
| **FR-103** | **Epic 2** | Story 2.3 | AI resilience, 1-shot repair, and transparent Mock Mode label |
| **FR-104** | **Epic 2** | Story 2.4 | Mandatory Admin Review Gate with visual question editing |
| **FR-105** | **Epic 2** | Story 2.1 | Voucher campaign configuration |
| **FR-201** | **Epic 3** | Story 3.1, 3.3 | Landing screen & single-question progression (1/5 to 5/5) |
| **FR-202** | **Epic 3** | Story 3.2 | Real-time 30-second countdown with visual urgency states |
| **FR-203** | **Epic 3** | Story 3.4 | Speed scoring formula $100 + (10 \times T_{\text{rem}})$ |
| **FR-204** | **Epic 3** | Story 3.4 | 00:00 timeout locking and anti-cheat race condition guard |
| **FR-301** | **Epic 4** | Story 4.1 | Game results card and performance statistics breakdown |
| **FR-302** | **Epic 4** | Story 4.2 | Vietnamese 10-digit phone regex lead capture form |
| **FR-303** | **Epic 4** | Story 4.3 | Instant copyable voucher unlock display with demo terms |
| **FR-401** | **Epic 4** | Story 4.4 | Gated leaderboard write pipeline (valid leads only) |
| **FR-402** | **Epic 4** | Story 4.4 | Deterministic Top 10 ranking (Score DESC, Time ASC) |
| **FR-501** | **Epic 4** | Story 4.5 | Dynamic boast message generation for Facebook |
| **FR-502** | **Epic 4** | Story 4.5 | Web Share API with clipboard fallback toast |
| **FR-601** | **Epic 4** | Story 4.6 | Admin lead dashboard (view, filter/search, delete single/all) |
| **FR-602** | **Epic 4** | Story 4.7 | Microsoft Excel compatible UTF-8 BOM CSV export |

---

## Epic List

* **Epic 1**: Project Foundation, Design Tokens & Resilient Storage Substrate
* **Epic 2**: Admin Quiz Campaign Builder & Secure AI Question Generator
* **Epic 3**: Mobile Gameplay Engine & 30-Second Speed Scoring
* **Epic 4**: Lead Capture, Voucher Unlock, Top 10 Leaderboard & Social Sharing

---

## Epic 1: Project Foundation, Design Tokens & Resilient Storage Substrate

**Goal**: Establish the React 19 + TypeScript + Vite 6 + Tailwind CSS application scaffold, configure `DESIGN.md` visual tokens, and implement the hardened `StorageService` for `localStorage` (schema validation, corruption recovery, quota defense, and default campaign bootstrapping).

### Story 1.1: Greenfield Project Scaffold & Base App Shell
As a developer and system user,  
I want a clean, typed React 19 + Vite 6 + Tailwind CSS foundation with top navigation and role-switching,  
So that the application has a responsive, accessible shell ready for player and admin experiences.

**Acceptance Criteria:**
* **Given** a new repository workspace,
  * **When** `npm install` and `npm run dev` are executed,
  * **Then** the application starts cleanly on `http://localhost:5173` without TypeScript or bundle errors.
* **Given** the app shell loads,
  * **When** viewing on viewports between 360px and 1280px,
  * **Then** the header provides a persistent brand logo ("QuizVibe AI") and a role toggle button between "Màn hình Người chơi" and "Màn hình Quản trị".
* **Given** Tailwind CSS configuration,
  * **When** classes are applied,
  * **Then** the color palette matches `DESIGN.md` tokens (Electric Indigo `#4F46E5`, Golden Amber `#F59E0B`, Emerald `#10B981`, Slate `#0F172A`).
* **And** fonts are configured with `Plus Jakarta Sans` as sans-serif and tabular monospace figures for timers.

### Story 1.2: Resilient LocalStorage Service with Schema Validation & Quota Defense
As a player and admin,  
I want all application data (campaigns, leads, leaderboard) managed through a secure, validated storage service,  
So that my quiz data and leads persist safely in the browser without data corruption or crashes from storage limits.

**Acceptance Criteria:**
* **Given** `StorageService`,
  * **When** reading from storage keys `quizvibe_active_campaign`, `quizvibe_leads`, or `quizvibe_leaderboard`,
  * **Then** data is validated against TypeScript schemas using safe runtime guards before returning.
* **Given** corrupted JSON or missing fields in `localStorage`,
  * **When** `StorageService` encounters parsing errors,
  * **Then** it logs a warning, falls back to safe default structures, and never crashes the application.
* **Given** a browser with disabled storage or full quota (`QuotaExceededError`),
  * **When** write operations fail,
  * **Then** `StorageService` catches the error, returns `{ success: false, error: "QUOTA_EXCEEDED" }`, and preserves user input in memory.
* **And** storage operations expose clean async/sync CRUD methods (`getCampaign`, `saveCampaign`, `getLeads`, `saveLead`, `getLeaderboard`, `saveLeaderboard`).

### Story 1.3: Default Campaign Bootstrapping & Industry Mock Presets
As an admin or first-time player,  
I want pre-loaded quiz campaigns across popular fanpage industries (Fashion, Cosmetics, Tech, F&B),  
So that the application is immediately playable out of the box even before custom quizzes are created.

**Acceptance Criteria:**
* **Given** an empty `localStorage` on first application visit,
  * **When** `StorageService.initializeDefaults()` runs,
  * **Then** a verified default quiz campaign (Cosmetics & Skincare, 5 questions, voucher `VIBE20`) is seeded into `quizvibe_active_campaign`.
* **Given** default mock datasets in `src/data/mockPresets.ts`,
  * **When** inspected,
  * **Then** presets exist for Fashion, Cosmetics, Tech Gadgets, and F&B, each containing exactly 5 questions, 4 options, 1 correct index, and realistic voucher terms.
* **And** resetting or clearing storage re-applies the default campaign gracefully.

---

## Epic 2: Admin Quiz Campaign Builder & Secure AI Question Generator

**Goal**: Enable Fanpage Admins to author or AI-generate promotional 5-question quizzes using Gemini 3.8 Flash via a secure Vercel Serverless proxy, review/edit questions in a mandatory review gate, configure voucher details, and activate campaigns with transparent Mock Mode fallbacks.

### Story 2.1: Manual Quiz Creation Form & Voucher Configuration
As a fanpage admin,  
I want to manually input 5 multiple-choice questions with 4 options each and configure the voucher reward,  
So that I can tailor specific quiz campaigns for my shop's products without relying on AI.

**Acceptance Criteria:**
* **Given** the Admin Dashboard on "Tạo thủ công",
  * **When** viewing the quiz builder,
  * **Then** 5 question accordion cards are rendered, each containing an input for question text, 4 answer inputs (A, B, C, D), and a radio selector for the correct answer index (0–3).
* **Given** incomplete fields (e.g. only 4 questions or empty option fields),
  * **When** clicking "Lưu & Kích hoạt chiến dịch",
  * **Then** submission is blocked with inline red validation errors indicating which questions are incomplete (`TC-04`).
* **Given** the Voucher Settings card,
  * **When** entering Campaign Name, Voucher Code (`GLOW20`), Discount (`20%`), Min Spend (`200.000đ`), and Expiry Days (`14`),
  * **Then** clicking "Lưu" validates that code and discount are non-empty and persists the full campaign via `StorageService.saveCampaign()` (`TC-01`).
* **And** a toast notification confirms: *"Chiến dịch đã được kích hoạt thành công!"*.

### Story 2.2: Vercel Serverless Gateway for Gemini 3.8 Flash
As a system architect and developer,  
I want a serverless function (`/api/generate-quiz`) that securely communicates with the Google Gemini API,  
So that `GEMINI_API_KEY` is never exposed in client-side code and questions conform strictly to the required JSON schema.

**Acceptance Criteria:**
* **Given** a POST request to `/api/generate-quiz` with `{ topic: string, difficulty: string }`,
  * **When** the handler executes on Vercel Node.js runtime,
  * **Then** it reads `process.env.GEMINI_API_KEY` and calls Google Gemini API targeting model `gemini-3.8-flash` (or `process.env.GEMINI_MODEL`).
* **Given** the prompt configuration,
  * **When** Gemini generates content,
  * **Then** it uses JSON schema mode enforcing a top-level `questions` array of length 5, each object containing `question` (string), `options` (array of 4 strings), and `correctIndex` (integer 0–3).
* **Given** client-side build artifacts,
  * **When** inspecting Vite environment variables and JS bundles,
  * **Then** zero Gemini API keys or `VITE_`-prefixed secret keys exist in the frontend code.
* **And** the server returns HTTP 200 with `{ success: true, questions: [...] }` upon successful validation.

### Story 2.3: AI Resilience, One-Shot Self-Repair & Mock Mode Fallback
As an admin running a live demo or campaign,  
I want the AI generator to automatically recover from malformed responses and provide an explicit Mock Mode fallback,  
So that API errors or network outages never crash the builder or leave me stranded.

**Acceptance Criteria:**
* **Given** Gemini returns slightly invalid JSON (e.g. markdown backticks or minor syntax flaws),
  * **When** parsed in `/api/generate-quiz`,
  * **Then** the proxy runs a programmatic sanitizer/repair before rejecting the request.
* **Given** an invalid API key, network timeout (>10s), or quota error from Gemini,
  * **When** the proxy fails,
  * **Then** it returns HTTP 502 with `{ success: false, error: string, canFallback: true }` (`TC-06`).
* **Given** the client receives the failure response,
  * **When** the error toast displays,
  * **Then** admin prompt inputs are preserved, a "Thử lại" button is shown, and a "Sử dụng bộ câu hỏi mẫu (Mock)" button is provided.
* **Given** the admin switches to or uses Mock Mode,
  * **When** questions load,
  * **Then** the UI prominently displays the required badge: *"Bản demo vòng loại - Dữ liệu mô phỏng AI"*.

### Story 2.4: Interactive Visual Admin Review Gate
As a fanpage admin,  
I want to review and edit all AI-generated questions before publishing,  
So that I can verify accuracy, adjust brand phrasing, and ensure the quiz is 100% correct.

**Acceptance Criteria:**
* **Given** successful AI generation,
  * **When** the questions arrive on the client,
  * **Then** they are loaded into an editable Review Gate interface; zero questions are published automatically.
* **Given** the Review Gate interface,
  * **When** the admin clicks on any question prompt, option text, or radio button,
  * **Then** they can edit the wording, swap distractor options, or change the designated correct answer.
* **Given** the admin reviews all 5 questions and configures the voucher,
  * **When** clicking "Lưu & Kích hoạt chiến dịch",
  * **Then** the campaign is verified against FR-101 rules, saved to `localStorage`, and marked active.
* **And** the status badge clearly shows whether questions originated from `🟢 Google Gemini 3.8 Flash` or `🟡 Chế độ mô phỏng (Mock)`.

---

## Epic 3: Mobile Gameplay Engine & 30-Second Speed Scoring

**Goal**: Deliver a high-energy, mobile-first player quiz experience inside the Facebook in-app browser, featuring single-question progression, an animated 30-second countdown with urgency color shifts, deterministic mathematical speed scoring ($100 + 10 \times T_{\text{rem}}$), and 00:00 timeout protection against race conditions.

### Story 3.1: Campaign Welcome Landing Screen
As a Facebook follower clicking a fanpage quiz link,  
I want an enticing welcome screen explaining the 20% voucher reward and 5-question contest rules,  
So that I feel motivated to tap start and take the challenge.

**Acceptance Criteria:**
* **Given** the player loads the application home route,
  * **When** the welcome screen renders,
  * **Then** it displays the active shop name, campaign title, voucher reward card (e.g. "Voucher Giảm 20%"), and rule pills (5 Câu hỏi • 30s mỗi câu).
* **Given** the "Bắt đầu chơi ngay" CTA button,
  * **When** tapped,
  * **Then** it transitions immediately to Question 1 with a smooth fade animation; no login or signup is requested.
* **And** a secondary button allows viewing the Top 10 Leaderboard before starting.

### Story 3.2: 30-Second Countdown Timer & Color Urgency Transitions
As a quiz player,  
I want a clear 30-second countdown timer for each question with visual urgency cues,  
So that I feel the excitement of answering quickly to earn maximum points.

**Acceptance Criteria:**
* **Given** a new question renders,
  * **When** the timer starts,
  * **Then** it counts down synchronously from 30.0s to 0.0s using tabular figures (`font-mono`) to prevent layout shift.
* **Given** remaining time thresholds,
  * **When** time is between 30s and 16s, timer pill is calm emerald green (`bg-emerald-50 text-emerald-700`).
  * **When** time is between 15s and 6s, timer pill transitions to amber caution (`bg-amber-50 text-amber-700`).
  * **When** time is 5s or less, timer pill pulses in crimson red (`bg-rose-50 text-rose-700 animate-pulse`).
* **And** the timer pauses immediately when an option is selected.

### Story 3.3: Question Interaction, Tap Feedback & Single Progression
As a mobile player,  
I want large, thumb-friendly answer choices that provide instant visual feedback upon tapping,  
So that I can comfortably play one question at a time on my phone.

**Acceptance Criteria:**
* **Given** Question screen ($N$ of 5),
  * **When** options render,
  * **Then** each option tile is vertically stacked with minimum height of 52px and clear letter labels (A, B, C, D).
* **Given** a player taps an option,
  * **When** touch is detected,
  * **Then** an instant tactile animation occurs (`scale-[0.98]`), and all 4 buttons lock immediately to prevent double-tap.
* **Given** answer validation,
  * **When** selection is registered,
  * **Then** the selected tile flashes green if correct or red if wrong for `800ms`.
* **And** the interface advances automatically to Question $N+1$ (or results screen after Question 5); previous questions cannot be revisited.

### Story 3.4: Deterministic Speed Scoring & 00:00 Timeout Mutual Exclusion Lock
As a competitive player,  
I want my points accurately calculated based on my answer and speed, with fair timeout rules,  
So that fast, correct answers are rewarded and the game cannot be cheated.

**Acceptance Criteria:**
* **Given** a correct answer submitted with $T_{\text{rem}}$ whole seconds remaining ($0 \le T_{\text{rem}} \le 30$),
  * **When** scored,
  * **Then** points awarded equal exactly $100 + (10 \times T_{\text{rem}})$ (`TC-02`).
  * E.g., correct at 30s = 400 pts; correct at 18s = 280 pts; correct at 0s = 100 pts.
* **Given** an incorrect answer,
  * **When** scored,
  * **Then** 0 points are awarded regardless of remaining time.
* **Given** the timer reaches `00:00` without selection,
  * **When** timeout triggers,
  * **Then** the question locks atomically, 0 points are awarded, a 1-second "Hết giờ!" banner displays, and the game auto-advances (`TC-05`).
* **And** late tap events received after 00:00 or after selection are discarded; duplicate score events are impossible.

---

## Epic 4: Lead Capture, Voucher Unlock, Top 10 Leaderboard & Social Sharing

**Goal**: Complete the conversion loop: players view score cards, submit their name and Vietnamese phone number to claim an instant copyable voucher and rank on the Top 10 Leaderboard, share achievements to Facebook via Web Share/Clipboard, while admins inspect leads and export UTF-8 BOM CSV files.

### Story 4.1: Results Screen & Performance Breakdown
As a player finishing the 5th question,  
I want to see my final score, correct answer count, and total active time,  
So that I understand my achievement before claiming my reward.

**Acceptance Criteria:**
* **Given** completion of Question 5,
  * **When** the results screen loads,
  * **Then** it prominently displays Total Score (out of 2,000 pts), correct count (e.g. `Đúng 4/5 câu`), and total answering time in seconds.
* **Given** total time calculation,
  * **When** recorded,
  * **Then** it represents the exact sum of active answering seconds across all 5 questions, excluding transition pauses.
* **And** an encouraging message based on score tier is displayed (e.g. "Xuất sắc!", "Rất tốt!").

### Story 4.2: Vietnamese Phone Lead Capture Form
As a player on the results screen,  
I want to enter my name and phone number in a clean, transparent form,  
So that I can claim my shop discount voucher and record my score on the leaderboard.

**Acceptance Criteria:**
* **Given** the lead form on the results screen,
  * **When** rendering,
  * **Then** it includes inputs for "Họ và tên" and "Số điện thoại nhận voucher", along with a clear privacy notice: *"Thông tin chỉ dùng để nhận mã ưu đãi từ shop, cam kết không spam"*.
* **Given** a user enters invalid phone inputs (e.g. `0912345`, `0123456789`, `0987abc123`),
  * **When** clicking "Nhận Voucher & Xếp Hạng",
  * **Then** submission is rejected with inline red error: *"Số điện thoại không hợp lệ (10 số, đầu số di động VN)"* (`TC-03`).
* **Given** valid inputs (Name $\ge 2$ chars, Phone matching `/^(03|05|07|08|09)\d{8}$/`),
  * **When** submitted,
  * **Then** the lead is persisted to `quizvibe_leads` and passed to the leaderboard engine.
* **And** a secondary "Bỏ qua" button allows viewing personal score without submitting contact info (with a warning that the score will not be ranked).

### Story 4.3: Instant Copyable Voucher Reward Unlock
As a player who just submitted their contact details,  
I want to immediately view and copy my unlocked discount voucher with clear usage terms,  
So that I get instant gratification and can shop with a discount right away.

**Acceptance Criteria:**
* **Given** a valid lead submission,
  * **When** the voucher screen unlocks,
  * **Then** a dashed ticket component displays the voucher code (e.g. `GLOW20`), discount amount (`20% OFF`), expiration date, minimum spend, and terms.
* **Given** the "Sao chép mã" button,
  * **When** tapped,
  * **Then** the code is copied to the system clipboard, the icon toggles to a green checkmark, and a toast confirms: *"Đã sao chép mã GLOW20!"*.
* **And** a disclaimer note states: *"Mã ưu đãi demo phục vụ cuộc thi"*.

### Story 4.4: Gated Top 10 Leaderboard & Deterministic Tie-Breaking
As a player and fanpage follower,  
I want to see the Top 10 highest-scoring players and my position among them,  
So that I can compare my trivia skills with other shoppers.

**Acceptance Criteria:**
* **Given** the leaderboard storage,
  * **When** a player submits a valid lead,
  * **Then** their entry is evaluated against `quizvibe_leaderboard`; players who skipped lead submission never enter the leaderboard (`FR-401`).
* **Given** ranking calculation,
  * **When** entries are sorted,
  * **Then** Primary Sort is Total Score DESC, and Secondary Sort (Tie-break) is Total Answering Time ASC (lowest time ranks higher) (`TC-02`).
* **Given** the Leaderboard Modal,
  * **When** opened,
  * **Then** it renders exactly the Top 10 entries with Rank (#1 to #10), Name, Score, Time, and Gold/Silver/Bronze medals for the Top 3.
* **And** an empty podium illustration is shown if no leads exist yet (`UX-DR5`).

### Story 4.5: Progressive Facebook Social Sharing
As a proud quiz player,  
I want to easily share my score and voucher achievement to Facebook,  
So that I can brag to my friends and challenge them to beat my record.

**Acceptance Criteria:**
* **Given** the "Chia sẻ lên Facebook" button on the voucher screen,
  * **When** tapped on a mobile device supporting Web Share API (`navigator.share`),
  * **Then** the native sharing sheet opens with the formatted message, shop name, score, and quiz link.
* **Given** a desktop browser or device where `navigator.share` is unavailable,
  * **When** tapped,
  * **Then** the full boast message is copied to the clipboard, and a toast displays: *"Đã sao chép nội dung! Bạn có thể dán đăng lên Facebook ngay."*.
* **And** the share text matches the template: `"🔥 Tôi vừa đạt {SCORE}/2,000 điểm tại Thử thách Quiz của {SHOP_NAME} và nhận ngay Voucher {DISCOUNT}! Liệu bạn có phá được kỷ lục của tôi? Thử sức tại: {QUIZ_URL}"`.

### Story 4.6: Admin Lead Management & Filter Dashboard
As a fanpage admin,  
I want to view, search, and delete collected customer leads in my dashboard,  
So that I can manage my promotion campaign records and clean up test data.

**Acceptance Criteria:**
* **Given** the Admin Dashboard on "Quản lý Lead",
  * **When** the leads table loads,
  * **Then** it lists all collected records showing Name, Phone, Score, Time, Participation Date, and Voucher Claimed.
* **Given** the search input,
  * **When** typing a query,
  * **Then** the table filters in real-time by customer name or phone number.
* **Given** the delete actions,
  * **When** clicking "Xóa" on a row, the individual record is removed from `quizvibe_leads` and `quizvibe_leaderboard`.
  * **When** clicking "Xóa toàn bộ", a confirmation modal opens; upon confirmation, all lead records are wiped cleanly.
* **And** an empty state is shown if no leads exist yet.

### Story 4.7: Excel-Compatible UTF-8 BOM CSV Export
As a fanpage shop owner,  
I want to export the collected leads to a CSV file that opens correctly in Microsoft Excel,  
So that I can import customer phone numbers into my tele-sales or SMS marketing tools without corrupted Vietnamese characters.

**Acceptance Criteria:**
* **Given** the "Xuất file Excel (CSV)" button in the Admin Lead Dashboard,
  * **When** clicked,
  * **Then** a CSV file named `quizvibe_leads_{YYYYMMDD}.csv` is generated and downloaded to the user's computer.
* **Given** the CSV data content,
  * **When** inspected in a byte viewer or Microsoft Excel on Windows,
  * **Then** the file begins with the UTF-8 Byte Order Mark (`\uFEFF`), preventing mojibake/accent corruption on Vietnamese names (`ARCH-6`).
* **And** headers include: `STT, Họ và Tên, Số điện thoại, Điểm số, Thời gian (giây), Ngày tham gia, Mã Voucher`.
