---
title: "Product Brief: QuizVibe AI"
status: finalized
created: 2026-11-02
updated: 2026-11-02
project: QuizVibe AI
competition: "Vibe Coding 2026"
track: "Table A – Technology"
topic: "Topic 3: Minigame Quiz thu lead cho fanpage"
team: "Superstar K22"
---

# Product Brief: QuizVibe AI

## 1. Executive Summary

**QuizVibe AI** is an AI-powered interactive minigame web application engineered specifically for small e-commerce shop owners and social media marketing managers (fashion, cosmetics, consumer tech, F&B, retail). It converts passive Facebook fanpage traffic into qualified, high-intent sales leads through fast-paced, 5-question trivia quizzes coupled with instant, transparent discount voucher rewards.

In the 2026 marketing landscape, traditional lead-capture forms and static Facebook posts suffer from abysmal conversion rates and high user friction. QuizVibe AI solves this by eliminating the technical and financial barrier of game development: fanpage admins can author a customized promotional quiz in under 60 seconds using real AI prompt presets or manual input. Players engage in a mobile-optimized 30-second-per-question challenge, compete for a spot on a dynamic Top 10 leaderboard, and unlock a copyable discount voucher immediately upon submitting their name and phone number.

Targeting **Table A – Technology** of the Vibe Coding 2026 competition, QuizVibe AI couples strict adherence to all 5 mandatory competition features and the 100-point Table A scoring rubric with robust architectural principles: real Google Gemini AI integration via secure Vercel Serverless proxy, strict JSON Schema output validation, deterministic scoring mechanics, and zero-server `localStorage` data persistence.

---

## 2. Problem Statement & Opportunity

### The Problem
* **Low Fanpage Engagement & Lead Conversion**: Small e-commerce brands on Facebook struggle with falling organic reach and low interaction on standard promotional posts.
* **Prohibitive Cost of Minigames**: Custom interactive minigames usually require specialized development teams, weeks of turnaround, and costly infrastructure.
* **Lead Capture Distrust**: Vietnamese consumers are reluctant to give out personal phone numbers on anonymous websites without an immediate, transparent, and tangible incentive.

### The Solution: QuizVibe AI
* **Zero-Code Instant Generation**: Admins generate thematic 5-question quizzes in seconds using pre-tuned industry templates (Fashion, Cosmetics, Tech, F&B) powered by real LLM APIs.
* **Instant Gratification Lead Mechanism**: Instead of vague promises ("we will call you"), players receive an immediate, copyable discount voucher with clear terms right on their screen upon submitting their contact information.
* **Viral Social Loop**: Seamless Web Share API integration generates boast-worthy score snippets for Facebook feeds, drawing in friends and organic traffic.

---

## 3. Target Audience & User Personas

| Dimension | Primary Creator Persona (The Admin) | Primary Player Persona (The Shopper) |
| :--- | :--- | :--- |
| **Identity** | Fanpage Admin / Small E-Commerce Shop Owner | Facebook Follower / Mobile Social Media Shopper |
| **Demographics** | 22–38 years old, non-technical, running online shops | 18–35 years old, active smartphone user, bargain/trivia lover |
| **Pain Points** | High customer acquisition cost, low post engagement, manual contest tallying | Boring ads, spammy lead forms, lack of immediate reward |
| **Core Goal** | Capture genuine customer phone numbers & drive store sales | Have quick fun (30s timer), challenge peers on leaderboard, earn discounts |
| **Success Metric**| Number of qualified leads collected in admin dashboard | Instant receipt of usable discount voucher code |

---

## 4. Product Direction & Value Proposition

### Strategic Positioning: Direction A (Primary) + Direction B (Supporting)
1. **Primary Mechanism: "Voucher Hunt / Promotional Minigame" (Direction A)**:
   * Focuses on transactional conversion. Answering 5 questions unlocks an instant voucher reward (e.g., 20% OFF, free shipping, VIP gift) with explicit terms (expiry date, minimum spend, applicable products).
   * Lead capture transparency: Players are explicitly informed that their phone number is used exclusively to issue and track their voucher claim.
2. **Supporting Mechanism: "Viral Trivia & Fan Rivalry" (Direction B)**:
   * Dynamic Top 10 leaderboard combining correct answers and remaining time.
   * One-click boastable share templates to challenge friends on Facebook.
3. **Explicitly Excluded from MVP**:
   * *Direction C (Consultative Product Matcher)* is deferred to future post-competition roadmaps to keep the MVP laser-focused and lightweight.

---

## 5. Scope: Mandatory Features vs. Enhancements

```
┌────────────────────────────────────────────────────────────────────────┐
│                        QUIZVIBE AI PRODUCT SCOPE                       │
├────────────────────────────────────────────────────────────────────────┤
│  [MANDATORY COMPETITION FEATURES - 100% REQUIRED FOR TABLE A]          │
│  ├── F1: Quiz Creator (Manual 5 Qs x 4 options OR Real AI Generation)  │
│  ├── F2: Game Screen (Single question display, 30s timer, Speed score) │
│  ├── F3: Result Screen & Lead Form (Score, Name + VN Phone, Voucher)  │
│  ├── F4: Top 10 Leaderboard (Rank by score, tie-break by time)         │
│  └── F5: Social Share Button (Dynamic copyable Facebook snippet)       │
├────────────────────────────────────────────────────────────────────────┤
│  [SUPPORTING ADMIN ENHANCEMENTS - NO BACKEND / STRICT LOCALSTORAGE]    │
│  ├── E1: Search & Filter Lead Records by name, phone, campaign         │
│  ├── E2: Single & Batch Delete with confirmation dialogue              │
│  ├── E3: Export Leads to CSV (with UTF-8 BOM for Microsoft Excel)      │
│  └── E4: Preset Industry Prompt Templates (Fashion, Cosmetics, Tech)   │
├────────────────────────────────────────────────────────────────────────┤
│  [EXCLUDED FROM COMPETITION MVP]                                       │
│  └── Multi-user auth, RDBMS/SQL backend, SMS OTP verification, Native app │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 6. Functional Specifications

### Feature 1: Quiz Creator (Admin Mode)
* **Creation Modes**:
  1. *Manual Entry*: Form builder for 5 questions, 4 answers per question, and 1 designated correct answer.
  2. *AI Generation*: One-click preset industries (Fashion, Cosmetics, Tech Gadgets, F&B) or custom topic input + difficulty selector (Easy, Medium, Hard).
* **Mandatory Admin Review Gate**: AI-generated questions are loaded into an interactive review editor. The admin can edit text, swap answers, change the correct key, or regenerate before publishing.
* **Voucher Campaign Configuration**: Admin configures the reward associated with the quiz: Discount value/percent, voucher code, expiration date, minimum purchase requirement, and usage terms.

### Feature 2: Quiz Gameplay Engine
* **Single Question Focus**: Questions displayed one at a time with clear progress indicators (e.g. `Question 3 of 5`).
* **30-Second Countdown**: Real-time timer starting at 30 seconds for each question.
* **Mathematical Scoring Formula**:
  $$\text{Question Score} = \begin{cases} 100 + (10 \times \text{remaining whole seconds}), & \text{if correct} \\ 0, & \text{if incorrect or timeout} \end{cases}$$
  * Maximum score per question: $400 \text{ points}$ (at $30\text{s}$).
  * Total maximum game score: $2,000 \text{ points}$ ($5 \times 400$).
* **Timeout Behavior**: When clock hits `00:00`, question locks immediately, awards 0 points, displays a 1-second visual indicator, and auto-advances. Duplicate submissions and late click events are strictly blocked.

### Feature 3: Result Screen & Lead Capture
* **Performance Summary**: Displays total score, correct/incorrect count, and total answering time.
* **Lead Capture Form**:
  * Input fields: Full Name & Vietnamese Phone Number.
  * Validation: Name $\ge 2$ characters; Phone must match Vietnamese 10-digit mobile standards (`/^(03|05|07|08|09)\d{8}$/`).
  * Transparency notice: Explains clearly that the phone number is used for voucher claiming and customer support.
* **Voucher Reward Presentation**:
  * Success banner with unlocked voucher code.
  * One-click "Copy Voucher Code" button with clipboard feedback.
  * Clearly presented terms: discount value, expiry date, min spend.
  * Clear indicator that this is a competition demo voucher code.

### Feature 4: Top 10 Leaderboard
* **Qualification Gate**: Only players who submit valid name and phone contact info qualify for the Top 10 leaderboard. Anonymous players can view their score but are not ranked.
* **Ranking & Tie-Breaking Rules**:
  1. Primary: Highest total score.
  2. Secondary (Tie-break): Lowest total question-answering time (sum of active answer times across 5 questions, excluding transition pauses).
* **Display Details**: Rank (#1 to #10), Player Name, Total Score, Total Answering Time, Date.

### Feature 5: Facebook Social Sharing
* **Dynamic Content Template**:
  ```text
  🔥 Tôi vừa đạt {SCORE}/2,000 điểm tại Thử thách Quiz của {SHOP_NAME} và nhận ngay Voucher giảm {DISCOUNT}!
  Liệu bạn có phá được kỷ lục của tôi? Thử sức ngay tại: {QUIZ_URL}
  #QuizVibeAI #VibeCoding2026 #{SHOP_SLUG}
  ```
* **Progressive Sharing Mechanism**:
  1. Primary: Uses `navigator.share()` (Web Share API) on supported mobile browsers to invoke the native share sheet.
  2. Fallback: Automatically copies the full formatted snippet to clipboard with a toast notification: *"Đã sao chép nội dung! Bạn có thể dán lên Facebook ngay."*

---

## 7. Technical Architecture & Constraints

```
┌────────────────────────────────────────────────────────────────────────┐
│                      QUIZVIBE AI ARCHITECTURE                          │
└────────────────────────────────────────────────────────────────────────┘
                                    │
               ┌────────────────────┴────────────────────┐
               ▼                                         ▼
      [Player Experience]                       [Admin Dashboard]
      ├── Game Engine (Timer & Scoring)         ├── Manual Quiz Builder
      ├── Lead Capture Form                     ├── AI Prompt Presets
      ├── Result & Voucher Screen               ├── Question Review Gate
      ├── Top 10 Leaderboard                    ├── Voucher Configurator
      └── Social Share (Web Share / Copy)       └── Lead Management (CSV)
               │                                         │
               └────────────────────┬────────────────────┘
                                    ▼
                     [Data Access Layer (localStorage)]
                     ├── quizvibe_quizzes
                     ├── quizvibe_leads
                     └── quizvibe_leaderboard
                                    │
                                    ▼
                     [Vercel Serverless Function]
                     ├── Endpoint: /api/generate-quiz
                     ├── Secure Server-Side Env: GEMINI_API_KEY
                     └── JSON Schema Validation & One-shot Repair
                                    │
                                    ▼
                        [Google Gemini 1.5 Flash]
```

### Key Technical Decisions
* **Frontend Core**: React 19 + TypeScript + Vite + Tailwind CSS + Lucide React.
* **Persistence**: Client-side `localStorage` with distinct, namespaced keys. Zero database required.
* **API Security (Criterion A3)**: 
  * API Key is strictly stored in server environment variables on Vercel (`GEMINI_API_KEY`).
  * Never exposed in client code or Vite bundle (`VITE_` prefix forbidden for secrets).
  * Proxy endpoint `/api/generate-quiz` handles prompt formatting, temperature tuning, and schema validation.
* **AI Output Control & Resilience**:
  * Gemini JSON Mode with strict schema: `questions` array of length 5, each containing `question` (string), `options` (array of 4 strings), and `correctIndex` (integer 0–3).
  * In case of API failure/timeout, existing user input is preserved, a retry button is provided, and a manual creation fallback is offered. Offline mock fallback is clearly labeled (*"Bản demo vòng loại - Dữ liệu mô phỏng AI"*).
* **Excel Compatibility**: CSV export prepends UTF-8 BOM (`\uFEFF`) to prevent Vietnamese accent corruption when opened in Microsoft Excel.

---

## 8. Alignment with Table A Scoring Rubric (100 Points)

| Table A Criterion | Pts | How QuizVibe AI Guarantees Maximum Score |
| :--- | :---: | :--- |
| **A1. Chức năng & Nghiệp vụ** | **25** | Complete implementation of all 5 mandatory features; seamless flow from creation $\to$ gameplay $\to$ lead submission $\to$ voucher claim $\to$ leaderboard $\to$ sharing; correct mathematical scoring. |
| **A2. Thiết kế kỹ thuật & Code** | **20** | Clean, modular React 19 + TypeScript architecture; strict type safety; clear separation of concerns (engine, storage, proxy, UI); resilient client validation. |
| **A3. Tích hợp AI & Kiểm soát đầu ra** | **15** | Real Gemini API integration via secure Vercel Serverless proxy; structured JSON output schema; automated one-shot repair; zero silent mocks; full 15/15 potential (avoiding the 4/15 mock penalty). |
| **A4. Kiểm thử & Xử lý lỗi** | **15** | Comprehensive Test Matrix with $\ge 6$ test cases (2 normal, 2 invalid, 2 edge cases); phone regex enforcement; timeout race-condition prevention; graceful network degradation. |
| **A5. Làm chủ Vibe Coding** | **15** | Exhaustive AI collaboration evidence log (`Mục tiêu $\to$ Prompt $\to$ Lỗi phát hiện $\to$ Sửa prompt $\to$ Kết quả`); deep technical defense readiness for the 5-minute Q&A. |
| **A6. UI & Trải nghiệm (UI/UX)** | **5** | Mobile-first responsive layout tailored for Facebook in-app browser; clean typography; intuitive gamified feedback (timer colors, score animations). |
| **A7. Triển khai & Bàn giao** | **5** | Live production deployment on Vercel; clean source ZIP; fully documented README matching BTC template; $\le 2$-minute demonstration video. |

---

## 9. Assumptions, System Limitations & Handover Risks

### Known System Limitations (To document in README)
1. **Device-Specific Storage**: Because data persists in `localStorage`, switching devices or clearing browser cache will reset quiz campaigns and lead records.
2. **No Backend Authentication**: Role toggling between Player and Admin is handled on the interface without password authentication, as permitted by competition rules.
3. **No SMS OTP Verification**: Phone numbers are validated structurally via regex, but active SIM ownership is not checked via telecommunication gateways.
4. **Demo Voucher Codes**: Voucher codes are generated client-side for demonstration and do not sync with external POS or e-commerce inventory backends.

### Risks & Mitigations
* **Risk 1: AI API Rate Limits or Network Outages during Live Judging**
  * *Mitigation*: The Serverless function includes timeout handling and one-shot repair. If the external API is unreachable, the system displays an explicit retry option and allows switching to manual creation or transparently labeled offline sample data.
* **Risk 2: Online Link Unavailability (10-minute remediation rule)**
  * *Mitigation*: Deployed on high-availability Vercel edge network; source code package is completely standalone and can run locally in seconds via `npm run dev` or `npm run build && npx serve dist`.

---

## 10. Handover Deliverables Checklist

- [x] **Product Brief**: `_bmad-output/product-brief.md`
- [ ] **PRD & Functional Specifications**: `_bmad-output/planning-artifacts/prd.md`
- [ ] **System Architecture Document**: `_bmad-output/planning-artifacts/architecture.md`
- [ ] **Test Matrix ($\ge 6$ Test Cases)**: Bounded in PRD and README section 11.
- [ ] **AI Evidence Log**: 1-page document with $\le 5$ prompt/dialogue iterations.
- [ ] **Source ZIP & README.md**: Conforming to `competition/README.md` 12-section standard.
- [ ] **Live Vercel URL & $\le 2$-Minute Demo Video**.

