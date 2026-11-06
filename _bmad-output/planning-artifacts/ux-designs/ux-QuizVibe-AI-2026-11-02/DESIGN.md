---
title: "Design System Specification: QuizVibe AI"
status: final
created: 2026-11-02
updated: 2026-11-02
project: QuizVibe AI
version: 1.0.0
tokens:
  colors:
    primary:
      50: "#EEF2FF"
      100: "#E0E7FF"
      500: "#6366F1"
      600: "#4F46E5"
      700: "#4338CA"
    secondary:
      50: "#FDF4FF"
      500: "#D946EF"
      600: "#C026D3"
    accent:
      amber: "#F59E0B"
      emerald: "#10B981"
      rose: "#F43F5E"
    neutral:
      50: "#F8FAFC"
      100: "#F1F5F9"
      200: "#E2E8F0"
      400: "#94A3B8"
      700: "#334155"
      800: "#1E293B"
      900: "#0F172A"
  typography:
    fontFamily:
      sans: "Plus Jakarta Sans, Inter, system-ui, sans-serif"
      mono: "JetBrains Mono, monospace"
    fontSize:
      xs: ["0.75rem", "1rem"]
      sm: ["0.875rem", "1.25rem"]
      base: ["1rem", "1.5rem"]
      lg: ["1.125rem", "1.75rem"]
      xl: ["1.25rem", "1.75rem"]
      "2xl": ["1.5rem", "2rem"]
      "3xl": ["1.875rem", "2.25rem"]
  rounded:
    sm: "0.375rem"
    md: "0.5rem"
    lg: "0.75rem"
    xl: "1rem"
    "2xl": "1.5rem"
    full: "9999px"
  spacing:
    xs: "0.25rem"
    sm: "0.5rem"
    md: "1rem"
    lg: "1.5rem"
    xl: "2rem"
---

# Design System Specification: QuizVibe AI

## 1. Brand & Visual Style

**QuizVibe AI** embraces an energetic, modern, gamified visual identity tailored for high-conversion social commerce on Facebook. It balances the playful thrill of an arcade trivia game with the credibility and clarity of a legitimate retail voucher promotion.

### Key Visual Pillars
* **Vibrant Gamification**: High-contrast, radiant gradients (Electric Indigo to Vivid Fuchsia) paired with glowing accent cards, creating excitement and stopping Facebook scroll fatigue.
* **Instant Clarity & Scannability**: Large legible typography (`Plus Jakarta Sans`), generous tap targets ($\ge 48\text{px}$ touch targets), and unambiguous color cues for question timers, points, and score states.
* **Voucher Trust & Elegance**: Golden amber highlights and dashed ticket borders for promotional rewards, making vouchers feel authentic and valuable.

---

## 2. Color Palette & Semantics

| Token | Hex | Tailwind Class | Semantic Role |
| :--- | :--- | :--- | :--- |
| `primary.600` | `#4F46E5` | `bg-indigo-600` | Primary action buttons, brand accents, selected question state |
| `primary.50` | `#EEF2FF` | `bg-indigo-50` | Soft highlight badges, active question indicator backgrounds |
| `accent.emerald` | `#10B981` | `text-emerald-500` | Correct answers, voucher unlock confirmations, positive feedback |
| `accent.amber` | `#F59E0B` | `text-amber-500` | Golden voucher badges, Top 3 leaderboard medals, speed points |
| `accent.rose` | `#F43F5E` | `text-rose-500` | Wrong answers, timer urgency ($<5\text{s}$), destructive actions |
| `neutral.900` | `#0F172A` | `bg-slate-900` | Dark mode surface background, primary text in light mode |
| `neutral.50` | `#F8FAFC` | `bg-slate-50` | Clean light surface background |
| `neutral.200` | `#E2E8F0` | `border-slate-200`| Card outlines, divider rules, subtle input borders |

### Dynamic Timer State Colors
* **Safe (16–30s)**: Emerald glow (`#10B981`)
* **Caution (6–15s)**: Amber glow (`#F59E0B`)
* **Urgent (0–5s)**: Pulsing Crimson (`#F43F5E`)

---

## 3. Typography

* **Primary Sans**: `Plus Jakarta Sans`, falling back to `Inter` and `system-ui`.
* **Numbers & Timers**: `JetBrains Mono` or tabular figures (`font-variant-numeric: tabular-nums`) to prevent layout jitter as the 30-second countdown decrements.

| Hierarchy | Size | Weight | Line Height | Usage |
| :--- | :--- | :--- | :--- | :--- |
| **Display Heading** | `1.875rem` (30px) | Bold (700) | 2.25rem | Welcome title, Final Score highlight |
| **Section Heading** | `1.5rem` (24px) | Semi-Bold (600) | 2rem | Quiz Question prompt, Leaderboard title |
| **Card / Label** | `1.125rem` (18px) | Medium (500) | 1.75rem | Quiz option cards, Voucher value |
| **Body Text** | `1rem` (16px) | Regular (400) | 1.5rem | Campaign descriptions, lead form labels |
| **Microcopy / Badges**| `0.75rem` (12px) | Medium (500) | 1rem | Timers, rank numbers, disclaimer text |

---

## 4. Layout & Spacing System

* **Container Width**: Max `440px` on mobile (matches standard smartphone viewports); centered with max `800px` for Admin Desktop views.
* **Padding System**:
  * Screen horizontal padding: `1.25rem` (20px).
  * Component gap: `0.75rem` (12px) between answer options.
  * Section spacing: `1.5rem` (24px) between distinct interaction blocks.
* **Safe Areas**: `padding-bottom: env(safe-area-inset-bottom, 20px)` to avoid overlapping mobile browser navigation bars.

---

## 5. Elevation & Depth

* **Flat (Default)**: `shadow-none` with `border border-slate-200` for crisp readability.
* **Elevated Card**: `shadow-md shadow-indigo-500/5` for question cards and voucher containers.
* **Glow State**: `shadow-lg shadow-indigo-500/20` for selected answers and active primary buttons.
* **Urgent Glow**: `shadow-lg shadow-rose-500/25 animate-pulse` for the last 5 seconds of the countdown timer.

---

## 6. Shapes & Border Radius

* **Buttons & Inputs**: `rounded-xl` (12px) for a soft, friendly, tactile feel.
* **Quiz Answer Tiles**: `rounded-2xl` (16px) with an inner `4px` colored accent indicator.
* **Voucher Ticket**: `rounded-2xl` with subtle decorative dashed cutouts (`border-dashed border-2 border-amber-300`).
* **Pill Badges**: `rounded-full` for timer chips, question trackers, and difficulty tags.

---

## 7. Component Visual Specifications

### 7.1 Quiz Answer Option Tile
* **Default**: `bg-white border-2 border-slate-200 text-slate-800 hover:border-indigo-300 hover:bg-indigo-50/30`
* **Selected / Active**: `bg-indigo-50 border-2 border-indigo-600 text-indigo-900 font-semibold ring-2 ring-indigo-500/20`
* **Correct Feedback**: `bg-emerald-50 border-2 border-emerald-500 text-emerald-900`
* **Incorrect Feedback**: `bg-rose-50 border-2 border-rose-500 text-rose-900`
* **Disabled / Locked**: `opacity-60 cursor-not-allowed`

### 7.2 Voucher Ticket Component
* Amber gradient header (`from-amber-400 to-amber-500`), white coupon body with serrated edge styling.
* Large copyable voucher code with a distinct "Copy" button icon that transforms into a green checkmark when clicked.

---

## 8. Do's & Don'ts

### Do's
* **DO** use tabular numerical fonts (`font-mono`) for the 30-second timer to avoid layout shifts.
* **DO** ensure touch targets for quiz options are at least `52px` tall for easy thumb tapping on smartphones.
* **DO** show an instant visual state change (tap highlight) immediately upon touching an answer option.
* **DO** provide clear feedback when copying text or voucher codes.

### Don'ts
* **DON'T** use multi-column answer layouts on mobile screens; always stack the 4 answer choices vertically.
* **DON'T** display tiny links or hidden terms; voucher expiration and minimum order rules must be clearly legible.
* **DON'T** hide the 30-second timer; it must remain anchored and clearly visible throughout gameplay.

