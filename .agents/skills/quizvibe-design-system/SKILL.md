---
name: quizvibe-design-system
description: Establish and maintain the visual identity, tokens, typography, dark theme, and design language of QuizVibe AI. Use when designing, building, or styling any UI component, screen, or layout across Admin and Player interfaces.
license: MIT
metadata:
  author: QuizVibe AI Core Team
  version: "1.0.0"
  tags: design-system tokens dark-theme tailwind ui-components accessibility
---

# QuizVibe AI Design System Specification

## 1. Purpose
Define the canonical design tokens, visual hierarchy, color palette, typography rules, component standards, and accessibility requirements for QuizVibe AI. This skill ensures visual consistency, prevents design drift, and enforces a refined, dark-mode-first aesthetic across all Admin and Player views.

---

## 2. When to Use
Invoke this skill whenever:
- Creating new screens, dialogs, drawers, sidebars, or cards.
- Restyling or modernizing existing Admin or Player views.
- Auditing UI code for design consistency or anti-patterns.
- Defining or modifying CSS tokens in `tailwind.config.js` or `src/index.css`.

---

## 3. Brand Identity & Visual Language
QuizVibe AI combines two complementary design moods:
1. **Admin Console (Raycast + Linear + Stripe):**
   - High information density, precision hairline borders (1px), subtle specular highlights, restrained brand accents.
   - Designed for efficiency, clarity, fast keyboard navigation, and data oversight.
2. **Player Experience (Duolingo #2 + Quizlet + Linear):**
   - Tactile depth with 3D bottom lips (`border-b-[3px]` or `[4px]`), satisfying button presses (`translate-y-[2px]`), crystal-clear question typography, zero cognitive clutter.
   - Obsidian dark palette with vibrant feedback states (Emerald for correct, Rose for danger, Amber for vouchers/rewards).

---

## 4. Design Tokens & Color Architecture

All colors are defined as HSL channel variables in `src/index.css` and extended via `tailwind.config.js`. This architecture enables seamless Tailwind opacity modifiers (e.g. `bg-primary/15`, `border-border/60`).

### 4.1 Surface Hierarchy (Dark Mode Only)
| Token | CSS Variable | Hex Reference | Usage |
| :--- | :--- | :--- | :--- |
| **Canvas** | `--background: 223 37% 4%` | `#06080D` | Base page canvas background |
| **Card Surface** | `--card: 225 35% 7%` | `#0B0E17` | Primary elevated cards & modal panels |
| **Recessed Well** | `--recessed: 222 32% 10%` | `#121723` | Form input wells, table filter bars, track backgrounds |
| **Interactive** | `--interactive: 221 30% 15%` | `#1A2130` | Hover states, active tabs, subtle row highlight |
| **Hairline Border** | `--border: 223 26% 16%` | `#1E2433` | Subtle 1px structural dividing lines |
| **Tactile Border** | `--border-tactile: 223 25% 22%` | `#2A3246` | Tactile 3D button border perimeter |
| **Tactile Lip Depth** | `--border-tactile-depth: 222 30% 15%` | `#1B2232` | 3D button/card bottom lip depth |

### 4.2 Brand & Semantic Accents
| Accent Role | Token | Hex Reference | Semantic Meaning |
| :--- | :--- | :--- | :--- |
| **Primary Brand** | `--primary: 239 84% 67%` | `#6366F1` (Indigo 500) | Primary CTAs, active indicators, focus rings |
| **Primary Depth** | `--primary-depth: 245 58% 51%`| `#4338CA` (Indigo 700) | 3D bottom lip for primary tactile buttons |
| **Success** | `--success: 160 84% 39%` | `#10B981` (Emerald 500) | Correct answer, active campaign, lead submitted |
| **Success Depth** | `--success-depth: 163 94% 24%` | `#047857` (Emerald 700) | 3D tactile lip for success state |
| **Warning / Reward** | `--warning: 38 92% 50%` | `#F59E0B` (Amber 500) | Vouchers, leaderboard trophy, timer caution |
| **Danger / Destructive** | `--destructive: 350 89% 60%` | `#F43F5E` (Rose 500) | Wrong answer, deletion, fatal errors |

### 4.3 Typography Scale
- **UI Font:** `'Plus Jakarta Sans'`, system-ui, sans-serif.
- **Monospace Font:** `'JetBrains Mono'`, monospace (for numbers, timers, code, phone numbers, scores).
- **Headings Rule:** Vietnamese diacritics require a minimum line-height of `1.35` (`line-height: 1.35` on headings).
- **Numeric Rule:** Always apply `font-mono tabular-nums` to scores, timestamps, counters, vouchers, and table figures.

### 4.4 Corner Radius
- **Admin Controls:** `rounded-lg` / `--radius-admin: 0.5rem` (8px).
- **Standard Cards / Dialogs:** `rounded-xl` / `--radius: 0.75rem` (12px).
- **Player Question Cards:** `rounded-2xl` / `--radius-player: 1rem` (16px).
- **Badges & Pills:** `rounded-full` (9999px) or `rounded-md` (6px).

### 4.5 Elevation & Specular Highlights
- **Key Surface (`surface-key`):**
  `box-shadow: inset 0 1px 0 0 rgba(255, 255, 255, 0.05), 0 4px 16px -4px rgba(0, 0, 0, 0.5);`
- **Elevated Modal/Drawer (`surface-elevated`):**
  `box-shadow: inset 0 1px 0 0 rgba(255, 255, 255, 0.07), 0 16px 40px -8px rgba(0, 0, 0, 0.65);`

---

## 5. Technical Rules & Guidelines
1. **Dark Mode Only:** Never introduce pure white `#FFFFFF` canvases or light-gray backgrounds. Always use `canvas` (`#06080D`), `card` (`#0B0E17`), and `recessed` (`#121723`).
2. **Restrained Accents:** The dominant interface color is slate/obsidian (85%+ of visual area). Indigo `#6366F1` is an intentional accent, never a full-screen wash.
3. **Hairline Separation:** Separate content surfaces using 1px `border-border` (`#1E2433`) rather than heavy shadow drops.
4. **Accessible Contrast (WCAG AA):**
   - Text secondary: `#94A3B8` (contrast ratio 8.2:1 against canvas).
   - Text muted: `#8494AA` (contrast ratio 6.4:1 against canvas, exceeds AA 4.5:1 requirement).
5. **Icon Consistency:** Use `lucide-react` exclusively. Use `w-4 h-4` for compact admin actions, `w-5 h-5` for standard navigation, and `w-6 h-6` for hero badges. Maintain consistent `stroke-[1.75]` or `stroke-[2]`.

---

## 6. Anti-Patterns to Avoid ("Anti-AI Slop")
- ❌ **No Purple/Violet Hero Gradients:** Avoid `bg-gradient-to-r from-purple-600 to-indigo-600` washes.
- ❌ **No Random Sparkle Icons:** Do not prepend `Sparkles` or `Zap` icons to every title or button. Reserve sparkles strictly for AI generation actions.
- ❌ **No Neon Glow Overkill:** Avoid `shadow-[0_0_50px_rgba(99,102,241,0.5)]` blurry blobs.
- ❌ **No Decorative 01/02/03 Badges:** Avoid unmotivated step counters placed solely for visual filler.
- ❌ **No Untouched Shadcn Defaults:** Always bind components to QuizVibe AI's obsidian HSL tokens.

---

## 7. Quality Checklist
- [ ] Color classes map to QuizVibe AI tokens (`bg-canvas`, `bg-card`, `bg-recessed`, `border-border`, `text-content-primary`, `text-content-secondary`).
- [ ] Tabular numerals applied to numeric data (`font-mono tabular-nums`).
- [ ] Focus ring applied to interactive elements (`focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background`).
- [ ] Reduced motion media query respected (`motion-reduce:animate-none`).
- [ ] Mobile responsive layout verified (compact controls on small screens, no horizontal scroll).
