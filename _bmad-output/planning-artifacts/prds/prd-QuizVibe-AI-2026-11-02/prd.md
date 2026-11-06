---
title: "Product Requirements Document (PRD): QuizVibe AI"
status: final
created: 2026-11-02
updated: 2026-11-02
project: QuizVibe AI
competition: "Vibe Coding 2026"
track: "Table A – Technology"
topic: "Topic 3: Minigame Quiz thu lead cho fanpage"
team: "Superstar K22"
---

# Product Requirements Document (PRD): QuizVibe AI

## 0. Document Purpose

This Product Requirements Document (PRD) establishes the authoritative functional, technical, and quality requirements for **QuizVibe AI**, an AI-driven interactive minigame web application built for the **Vibe Coding 2026** competition under **Table A – Technology (Topic 3: Minigame Quiz thu lead cho fanpage)**. 

This document synthesizes and supersedes prior discovery artifacts:
* Baseline Analysis: [`_bmad-output/competition-requirements-analysis.md`](file:///d:/VibeCoding/QuizVibe-AI/_bmad-output/competition-requirements-analysis.md)
* Product Brief: [`_bmad-output/product-brief.md`](file:///d:/VibeCoding/QuizVibe-AI/_bmad-output/product-brief.md)
* Decision Audit Trail: `_bmad-output/planning-artifacts/briefs/brief-QuizVibe-AI-2026-11-02/.memlog.md`

All functional requirements (FRs) and non-functional requirements (NFRs) are numbered with globally stable identifiers to guide downstream Architecture, UX Design, and Implementation.

---

## 1. Vision & Strategy

### 1.1 Product Vision
**QuizVibe AI** empowers Facebook fanpage administrators and small e-commerce merchants to turn casual social media scrollers into high-intent sales leads. By providing a frictionless zero-code quiz builder powered by modern Google Gemini AI and instant promotional discount vouchers, it creates a win-win loop: players enjoy an entertaining 30-second trivia challenge and receive immediate discounts, while merchants effortlessly capture verified customer leads.

### 1.2 Competition & Track Strategy (Table A – Technology)
To maximize the 100-point rubric for Table A:
1. **Full Feature Delivery (25 pts - Criterion A1)**: 100% completion of all 5 mandatory features with deterministic business logic.
2. **Technical Architecture (20 pts - Criterion A2)**: Modular React 19 + TypeScript architecture, client-side data isolation, and clean separation of concerns.
3. **Real AI Integration (15 pts - Criterion A3)**: Direct integration with active Google Gemini API (`gemini-3.8-flash`) via a secure Vercel Serverless proxy to bypass the 4/15 Mock scoring penalty.
4. **Testing Rigor (15 pts - Criterion A4)**: Systematic validation with $\ge 6$ test cases covering happy paths, input errors, and boundary/failure modes.
5. **Vibe Coding Mastery (15 pts - Criterion A5)**: Transparent AI development lineage and technical defense readiness.
6. **Mobile UX & Delivery (10 pts - Criteria A6 & A7)**: Fast mobile loading within Facebook in-app browser and production deployment on Vercel.

---

## 2. Target Users & User Journeys

### 2.1 Jobs To Be Done (JTBD)
* **JTBD-1 (Merchant/Admin)**: *"When I run a promotional campaign on Facebook, I want to deploy an interactive quiz in under 60 seconds without coding, so that I can collect customer phone numbers and boost fanpage sales."*
* **JTBD-2 (Shopper/Player)**: *"When I see a brand's trivia challenge on Facebook, I want to play a fun, fast quiz and see my rank, so that I can prove my knowledge and instantly claim a discount voucher for shopping."*

### 2.2 Key User Journeys

#### UJ-1: Admin Generates & Publishes an AI Quiz Campaign
* **Persona**: Linh, owner of a cosmetics fanpage.
* **Entry State**: Opens QuizVibe AI on desktop/tablet, navigates to "Admin Dashboard".
* **Path**:
  1. Linh selects the "Cosmetics & Skincare" preset and chooses "Medium" difficulty.
  2. Clicks "Tạo câu hỏi bằng AI". The Vercel Serverless proxy invokes Gemini 3.8 Flash and returns 5 structured questions.
  3. The system presents the questions in the Admin Review Editor. Linh edits Question 3's wording and verifies the correct answer keys.
  4. Linh configures the voucher: `GLOW20` (20% OFF, orders over 250,000 VND, expires in 14 days).
  5. Clicks "Lưu & Kích hoạt Chiến dịch".
* **Climax**: The quiz is active in `localStorage`, and the system provides a copyable campaign URL for Facebook.
* **Resolution**: Linh copies the link, pastes it into a Facebook fanpage post, and monitors incoming leads.

#### UJ-2: Player Completes Quiz, Claims Voucher & Ranks on Leaderboard
* **Persona**: Nam, a mobile Facebook user scrolling his newsfeed.
* **Entry State**: Taps Linh's post link, opening QuizVibe AI inside the Facebook in-app browser.
* **Path**:
  1. Nam views the welcome screen showing the 20% voucher incentive and taps "Bắt đầu chơi".
  2. Question 1 appears with a 30-second countdown. Nam answers correctly with 22s remaining, earning 320 points.
  3. On Question 4, time runs out (`00:00`). The question locks, displays a brief timeout notice, awards 0 points, and advances to Question 5.
  4. Upon completing Question 5, Nam sees his score card: `1,450 / 2,000 điểm`.
  5. The lead capture form appears: Nam enters "Nam Nguyen" and `0912345678`.
  6. The system validates the phone number format, saves the lead, unlocks voucher `GLOW20`, and enters Nam onto the Top 10 Leaderboard at Rank #3.
* **Climax**: Nam taps "Sao chép mã voucher" to save it, then taps "Chia sẻ Facebook" to copy his viral score snippet.
* **Resolution**: Nam leaves feeling rewarded, posts his score to challenge friends, and uses the voucher to buy from the shop.

---

## 3. Glossary

* **Campaign**: A published quiz unit consisting of 5 questions, scoring configuration, and associated voucher reward.
* **Lead**: A player record containing `fullName`, `phoneNumber`, `score`, `totalTime`, and `submittedAt`.
* **Voucher**: A promotional coupon reward containing `code`, `discountValue`, `conditions`, and `expiryDate`.
* **Top 10 Leaderboard**: The sorted list of the 10 highest-scoring verified leads.
* **Speed Bonus**: Additional points awarded based on whole seconds remaining on the timer: $10 \times \text{seconds}$.
* **Timeout**: Timer reaching `00:00`, terminating question interaction with 0 points.
* **Mock Mode**: Fallback operation using bundled static quiz templates when the real AI API is offline or unconfigured.

---

## 4. System Architecture & Constraints

```
┌────────────────────────────────────────────────────────────────────────┐
│                        QUIZVIBE AI ARCHITECTURE                        │
└────────────────────────────────────────────────────────────────────────┘
                                    │
               ┌────────────────────┴────────────────────┐
               ▼                                         ▼
      [Player Interface]                        [Admin Dashboard]
      ├── Quiz Welcome & Rules                  ├── Manual Quiz Builder
      ├── Game Engine & Timer (30s)             ├── Preset & Custom Prompt UI
      ├── Result & Voucher Display              ├── AI Output Review Gate
      ├── Top 10 Leaderboard                    ├── Voucher Campaign Config
      └── Social Sharing (Web Share/Copy)       └── Lead Management (CSV Export)
               │                                         │
               └────────────────────┬────────────────────┘
                                    ▼
                     [Data Access Layer (localStorage)]
                     ├── quizvibe_active_quiz (5 questions)
                     ├── quizvibe_leads (lead entries)
                     └── quizvibe_leaderboard (top scores)
                                    │
                                    ▼
                     [Vercel Serverless Function]
                     ├── Route: /api/generate-quiz
                     ├── Env: GEMINI_API_KEY (Server-side only)
                     ├── Model: gemini-3.8-flash (via GEMINI_MODEL env)
                     └── Schema Validator & One-Shot Repair
                                    │
                                    ▼
                   [Google Gemini AI (REST/SDK)]
```

### 4.1 Architecture Mandates
1. **Strictly No Persistent Backend Database**: All campaign, lead, and leaderboard state resides exclusively in the browser's `localStorage`.
2. **Serverless Proxy Solely for AI Security**: The Vercel Serverless Function (`/api/generate-quiz`) exists solely to keep `GEMINI_API_KEY` hidden from client-side bundles. No business data passes through or persists on the server.
3. **No User Authentication**: Role switching between Player and Admin occurs directly via top navigation controls, meeting the competition guidelines.

---

## 5. Functional Requirements (FRs)

### 5.1 Feature 1: Quiz Creator & AI Integration (Mandatory)

#### FR-101: Manual Quiz Authoring
* **Actor**: Admin. Realizes UJ-1.
* **Capability**: The admin can manually input exactly 5 multiple-choice questions.
* **Acceptance Criteria**:
  * Each question must have non-empty prompt text.
  * Each question must provide exactly 4 distinct answer options.
  * Exactly 1 option must be designated as the correct answer (index 0 to 3).
  * System blocks submission if any question or option is blank.

#### FR-102: Real AI Quiz Generation via Google Gemini
* **Actor**: Admin. Realizes UJ-1.
* **Capability**: The admin can request AI-generated questions by selecting a preset industry (Fashion, Cosmetics, Tech Gadgets, F&B) or typing a custom topic, with a chosen difficulty (Easy, Medium, Hard).
* **Acceptance Criteria**:
  * Request is dispatched to `/api/generate-quiz` without exposing client API keys.
  * Active model is **`gemini-3.8-flash`** (configurable via server `GEMINI_MODEL`).
  * System applies a strict JSON schema:
    ```json
    {
      "questions": [
        {
          "question": "string",
          "options": ["string", "string", "string", "string"],
          "correctIndex": 0
        }
      ]
    }
    ```
  * System validates that `questions.length === 5`, each `options.length === 4`, and `0 <= correctIndex <= 3`.

#### FR-103: AI Resilience & One-Shot Repair
* **Actor**: System.
* **Capability**: Handles malformed JSON, network latency, and API errors gracefully.
* **Acceptance Criteria**:
  * If the AI response fails JSON parsing or schema validation, the proxy automatically attempts one self-repair request before failing.
  * If the AI service fails or times out (>10s), admin inputs are preserved, an error message is displayed, and a retry button is offered.
  * System allows the admin to switch to offline Mock Mode or manual entry.
  * When Mock Mode is active, the UI displays: *"Bản demo vòng loại - Dữ liệu mô phỏng AI"*.

#### FR-104: Mandatory Admin Review Gate
* **Actor**: Admin. Realizes UJ-1.
* **Capability**: AI-generated questions are loaded into an editable preview; auto-publishing is strictly prohibited.
* **Acceptance Criteria**:
  * Admin can edit any question text, replace any option, and reassign the correct answer.
  * Changes are validated against FR-101 rules before activating the campaign.

#### FR-105: Voucher Campaign Configuration
* **Actor**: Admin. Realizes UJ-1.
* **Capability**: Admin configures the voucher attached to the quiz.
* **Acceptance Criteria**:
  * Configurable fields: Campaign Name, Voucher Code (e.g. `VIBE20`), Discount Description (e.g. `20% OFF`), Minimum Order (e.g. `200.000đ`), Expiration Days (e.g. `7`), and Terms.

---

### 5.2 Feature 2: Quiz Gameplay Engine (Mandatory)

#### FR-201: Single-Question Progression
* **Actor**: Player. Realizes UJ-2.
* **Capability**: Presents questions one at a time with a visible step tracker (`Câu 1/5` to `Câu 5/5`).
* **Acceptance Criteria**:
  * Player cannot view upcoming questions until answering or timing out on the current question.
  * Previous questions cannot be revisited.

#### FR-202: 30-Second Countdown Timer
* **Actor**: System / Player. Realizes UJ-2.
* **Capability**: Each question runs an independent 30.0-second countdown.
* **Acceptance Criteria**:
  * Timer decrements every second from 30 down to 0.
  * Visual indicator changes color (e.g., green $>15\text{s}$, amber $6\text{--}15\text{s}$, red $\le 5\text{s}$).

#### FR-203: Mathematical Speed Scoring
* **Actor**: System. Realizes UJ-2.
* **Capability**: Calculates points using:
  $$\text{Score} = \begin{cases} 100 + (10 \times T_{\text{rem}}), & \text{if correct} \\ 0, & \text{if incorrect or timeout} \end{cases}$$
  where $T_{\text{rem}}$ is the remaining whole seconds on the clock ($0 \le T_{\text{rem}} \le 30$).
* **Acceptance Criteria**:
  * Correct answer at 30s: 400 pts.
  * Correct answer at 18s: 280 pts.
  * Correct answer at 1s: 110 pts.
  * Correct answer at 0s: 100 pts.
  * Incorrect answer: 0 pts regardless of time.
  * Maximum 5-question total: 2,000 pts.

#### FR-204: Timeout & Race-Condition Lock
* **Actor**: System. Realizes UJ-2.
* **Capability**: Automatically transitions question upon timer expiration.
* **Acceptance Criteria**:
  * When timer reaches `00:00`, question input is immediately locked.
  * Question is recorded as timed out (0 pts).
  * System displays a 1.0-second timeout feedback notice.
  * System advances to the next question automatically (or results screen after Question 5).
  * Late clicks after 00:00 are rejected; duplicate transitions are prevented.

---

### 5.3 Feature 3: Result Screen & Lead Collection (Mandatory)

#### FR-301: Performance Breakdown
* **Actor**: Player. Realizes UJ-2.
* **Capability**: Displays game outcome: Total Score, Correct/Incorrect count, and Total Active Time.

#### FR-302: Vietnamese Phone Lead Capture Form
* **Actor**: Player. Realizes UJ-2.
* **Capability**: Captures Full Name and Vietnamese Phone Number to unlock the voucher and qualify for the leaderboard.
* **Acceptance Criteria**:
  * Full Name required (length $\ge 2$ characters).
  * Phone Number validated against official Vietnamese 10-digit mobile prefixes:
    $$\text{Regex: } \texttt{^(03|05|07|08|09)\d\{8\}\$}$$
  * Rejects letters, special characters, spaces, and non-VN prefixes.
  * Explicit privacy label states the number is collected to claim the voucher.

#### FR-303: Instant Voucher Unlock Display
* **Actor**: Player. Realizes UJ-2.
* **Capability**: Upon submitting a valid lead, the voucher is rendered on screen.
* **Acceptance Criteria**:
  * Displays voucher code, discount percentage/amount, and usage conditions.
  * Provides a "Sao chép mã" button that copies the code to clipboard with visual confirmation.
  * Shows a label: *"Mã ưu đãi demo phục vụ cuộc thi"*.

---

### 5.4 Feature 4: Top 10 Leaderboard (Mandatory)

#### FR-401: Gated Leaderboard Qualification
* **Actor**: System. Realizes UJ-2.
* **Capability**: Only players who submit a valid name and phone number qualify for the leaderboard.
* **Acceptance Criteria**:
  * Players who skip or do not submit the lead form can view their personal score card, but **never appear on the public leaderboard**.

#### FR-402: Deterministic Ranking & Tie-Breaking
* **Actor**: System.
* **Capability**: Ranks leads dynamically.
* **Acceptance Criteria**:
  * Primary Sort: Total Score in descending order.
  * Secondary Sort (Tie-break): Total question-answering time in ascending order (sum of active seconds spent on questions, excluding UI transition delays).
  * Tertiary Sort: Submission timestamp (earlier ranks higher).
  * Display limited to exactly the Top 10 records.

---

### 5.5 Feature 5: Facebook Social Sharing (Mandatory)

#### FR-501: Dynamic Share Content Generation
* **Actor**: Player. Realizes UJ-2.
* **Capability**: Generates a customized viral message:
  ```text
  🔥 Tôi vừa đạt {SCORE}/2,000 điểm tại Thử thách Quiz của {SHOP_NAME} và nhận ngay Voucher giảm {DISCOUNT}!
  Liệu bạn có phá được kỷ lục của tôi? Thử sức ngay tại: {QUIZ_URL}
  #QuizVibeAI #VibeCoding2026 #{SHOP_SLUG}
  ```

#### FR-502: Progressive Social Sharing (Web Share API + Clipboard)
* **Actor**: Player. Realizes UJ-2.
* **Capability**: 
  * On supported mobile devices, triggers `navigator.share()` native sheet.
  * On desktop or unsupported browsers, copies text to clipboard and displays a toast notification: *"Đã sao chép nội dung chia sẻ!"*.

---

### 5.6 Admin Operations & Enhancements (Supporting)

#### FR-601: Lead Management Dashboard
* **Actor**: Admin.
* **Capability**: View, search by name/phone, delete individual lead records, or clear all records with a confirmation prompt.

#### FR-602: UTF-8 BOM CSV Export
* **Actor**: Admin.
* **Capability**: Downloads all collected leads as a `.csv` file.
* **Acceptance Criteria**:
  * File prepended with UTF-8 BOM (`\uFEFF`) to ensure Vietnamese accents render correctly in Microsoft Excel.
  * Headers: `STT, Họ và Tên, Số điện thoại, Điểm số, Thời gian (giây), Ngày tham gia, Mã Voucher`.

---

## 6. Data Models & LocalStorage Schemas

All browser storage keys are prefixed with `quizvibe_`:

```typescript
// 1. Storage Key: 'quizvibe_active_campaign'
interface QuizCampaign {
  id: string;
  title: string;
  industry: 'fashion' | 'cosmetics' | 'tech' | 'fnb' | 'custom';
  difficulty: 'easy' | 'medium' | 'hard';
  createdAt: string; // ISO string
  voucher: {
    code: string;
    discount: string;
    minSpend: string;
    expiryDays: number;
    terms: string;
  };
  questions: Array<{
    id: string;
    question: string;
    options: [string, string, string, string];
    correctIndex: 0 | 1 | 2 | 3;
  }>;
}

// 2. Storage Key: 'quizvibe_leads'
interface PlayerLead {
  id: string;
  campaignId: string;
  fullName: string;
  phoneNumber: string; // Validated 10-digit VN format
  score: number;       // 0 to 2,000
  totalTimeSeconds: number; // Sum of answering times
  voucherClaimed: string;
  submittedAt: string; // ISO string
}

// 3. Storage Key: 'quizvibe_leaderboard'
interface LeaderboardEntry {
  rank: number;
  leadId: string;
  fullName: string;
  score: number;
  totalTimeSeconds: number;
  submittedAt: string;
}
```

---

## 7. Non-Functional Requirements (NFRs)

* **NFR-1 (Performance)**: First Contentful Paint (FCP) $\le 1.5\text{s}$ on 4G mobile connections. Question transitions occur within $\le 100\text{ms}$.
* **NFR-2 (Mobile Responsiveness)**: 100% responsive design optimized for viewport widths 360px–430px (standard smartphones) and verified inside the Facebook in-app browser webview.
* **NFR-3 (Security & Key Isolation)**: API keys must never appear in client bundles, Git commits, or URL query parameters. Calls must pass through server-side environment variables on Vercel.
* **NFR-4 (Robustness & XSS Prevention)**: All user-submitted text (names, custom topics) is sanitized before rendering to prevent cross-site scripting in the leaderboard or admin screens.
* **NFR-5 (Zero External Database)**: Complete functionality without MongoDB, PostgreSQL, Supabase, or Firebase. Zero database connection failures possible.

---

## 8. Test Matrix & Validation (Mandatory $\ge 6$ Cases)

| Test ID | Category | Scenario / Steps | Expected Outcome | Pass Criteria |
| :---: | :--- | :--- | :--- | :--- |
| **TC-01** | **Happy Path** | **Manual Quiz Creation & Publishing**<br>Admin enters 5 complete questions, 4 options each, sets correct answers, configures voucher `DISC20`, and publishes. | Quiz saves to `quizvibe_active_campaign`. Welcome screen reflects new campaign title and voucher terms. | All 5 questions and voucher loaded into state without error. |
| **TC-02** | **Happy Path** | **Full Gameplay, Scoring & Leaderboard Entry**<br>Player answers all 5 questions correctly with 18s left on each. Submits name "Tran Van A", phone `0987654321`. | Score calculated: $5 \times (100 + 180) = 1,400$ pts. Voucher displayed. Player added to Top 10 Leaderboard. | Score equals 1,400. Rank correctly reflects 1,400 pts and 60s total time. |
| **TC-03** | **Invalid Input** | **Invalid Phone Number Formats**<br>Player attempts to submit lead with: (a) `0912345` (too short), (b) `091234567890` (too long), (c) `0123456789` (invalid prefix), (d) `0987abc123`. | Form blocks submission with inline error message: *"Số điện thoại không hợp lệ (10 số, đầu số VN)"*. | No data written to `localStorage`. Voucher code and leaderboard qualification withheld. |
| **TC-04** | **Invalid Input** | **Incomplete Quiz Creation**<br>Admin attempts to publish a quiz with only 4 questions or leaves options blank in Question 2. | System highlights missing fields and disables the "Lưu & Kích hoạt" button. | Active campaign in `localStorage` remains untouched until all 5 questions are complete. |
| **TC-05** | **Edge / Failure** | **Question Timer Expiration (Timeout at 00:00)**<br>Player lets the timer run out without selecting an answer on Question 3. | At 00:00, buttons lock. 0 points awarded. Visual "Hết giờ!" indicator displays for 1s. System auto-advances to Question 4. | Score does not increment. Late click events ignored. Total time logs 30.0s for Q3. |
| **TC-06** | **Edge / Failure** | **AI Proxy Failure & Graceful Degradation**<br>Admin triggers AI generation when network is disconnected or server API key is invalid. | Serverless function returns error; client displays toast notification with "Thử lại" button and an option to switch to "Chế độ mô phỏng (Mock)" or manual input. | Application does not crash; admin input text is preserved; UI transparently indicates mock status if chosen. |

---

## 9. Alignment with Table A Rubric

```
┌───────────────────────────────────────────────────────────────┐
│              TABLE A SCORING AUDIT: 100/100 PLAN              │
├───────────────────────────────────────────────────────────────┤
│ A1. Chức năng & Nghiệp vụ (25 pts)  ──> FR-101 to FR-502     │
│ A2. Thiết kế kỹ thuật (20 pts)      ──> React 19, TS, Vite    │
│ A3. Tích hợp AI (15 pts)            ──> Gemini 3.8 Flash API  │
│ A4. Kiểm thử & Độ ổn định (15 pts)  ──> TC-01 to TC-06 Matrix │
│ A5. Làm chủ Vibe Coding (15 pts)    ──> Audit trail & Defense │
│ A6. Giao diện & Trải nghiệm (5 pts) ──> Mobile-First Tailwind │
│ A7. Triển khai & Bàn giao (5 pts)   ──> Vercel Edge + README  │
└───────────────────────────────────────────────────────────────┘
```

---

## 10. Handover Deliverables & Next Steps

* **PRD Location**: [`_bmad-output/prd.md`](file:///d:/VibeCoding/QuizVibe-AI/_bmad-output/prd.md) and [`_bmad-output/planning-artifacts/prds/prd-QuizVibe-AI-2026-11-02/prd.md`](file:///d:/VibeCoding/QuizVibe-AI/_bmad-output/planning-artifacts/prds/prd-QuizVibe-AI-2026-11-02/prd.md)
* **Status**: Complete & Decision-Locked.
* **Next Workflow**: Transition to **`bmad-ux`** (UX Design & Experience Specs) or **`bmad-architecture`** (Technical Architecture Specification with Winston).

