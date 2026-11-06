---
title: "User Experience Specification: QuizVibe AI"
status: final
created: 2026-11-02
updated: 2026-11-02
project: QuizVibe AI
version: 1.0.0
---

# User Experience Specification: QuizVibe AI

## 1. Foundation & Form Factor

* **Primary Form Factor**: Mobile Webview (360px–430px width) running inside the **Facebook In-App Browser** on iOS and Android smartphones.
* **Secondary Form Factor**: Desktop / Tablet Webview for Fanpage Admins running the Quiz Builder and Lead Management Dashboard.
* **Core Philosophy**: Zero-friction onboarding, instant visual feedback, thumb-friendly tap zones ($\ge 48\text{px}$), and extreme clarity regarding privacy and rewards.

---

## 2. Information Architecture (IA)

```
┌────────────────────────────────────────────────────────────────────────┐
│                      QUIZVIBE AI SCREEN TAXONOMY                       │
├────────────────────────────────────────────────────────────────────────┤
│  [PLAYER EXPERIENCE - MOBILE FIRST]                                    │
│  ├── S1: Campaign Welcome Landing (Brand header, voucher lure, CTA)    │
│  ├── S2: Game Screen (Timer, Question tracker, 4 vertical options)     │
│  ├── S3: Results & Lead Capture (Score breakdown, Name + VN Phone form)│
│  ├── S4: Voucher Reward Unlocked (Copyable voucher code & conditions)  │
│  ├── S5: Top 10 Leaderboard (Gated rank list, tie-break stats)        │
│  └── S6: Viral Share Drawer (Native share / Clipboard feedback)        │
├────────────────────────────────────────────────────────────────────────┤
│  [ADMIN DASHBOARD - DESKTOP / TABLET OPTIMIZED]                        │
│  ├── A1: Quiz Builder & Campaign Setup (Preset industries & AI prompt) │
│  ├── A2: AI Output Review Gate (Question & answer editor)              │
│  ├── A3: Voucher Configuration (Discount value, code, expiry terms)    │
│  └── A4: Lead Operations (Search/filter, delete confirm, CSV export)   │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Screen-by-Screen Behavioral Specifications & Wireframes

### Screen S1: Campaign Welcome Landing (Mobile)
* **Goal**: Hook the user within 3 seconds of clicking from a Facebook post.
* **Wireframe**:
  ```text
  ┌────────────────────────────────────────┐
  │  [SHOP LOGO / AVATAR]                  │
  │  ⚡ THỬ THÁCH TRẮC NGHIỆM FANPAGE      │
  │                                        │
  │  🎁 Phần thưởng: VOUCHER GIẢM 20%      │
  │  áp dụng cho mọi đơn hàng hôm nay!     │
  │                                        │
  │  ┌──────────────────────────────────┐  │
  │  │ ⏱️ 5 Câu hỏi • 30s mỗi câu        │  │
  │  │ 🏆 Đua top 10 nhận thêm quà VIP  │  │
  │  └──────────────────────────────────┘  │
  │                                        │
  │  [ 🔥 BẮT ĐẦU CHƠI NGAY (CTA) ]        │
  │                                        │
  │  [ 🏆 Xem Bảng Xếp Hạng ]              │
  └────────────────────────────────────────┘
  ```
* **Interaction**: Tapping CTA transitions directly into Question 1 with no account creation.

---

### Screen S2: Quiz Gameplay Screen (Mobile)
* **Goal**: Deliver a high-energy, focused 30-second trivia challenge.
* **Wireframe**:
  ```text
  ┌────────────────────────────────────────┐
  │  Câu 3/5               ⏱️ [ 18s ] 🟢   │
  │  ═══════════════════                   │
  │  Điểm hiện tại: 580                    │
  ├────────────────────────────────────────┤
  │  Đâu là bước dưỡng da quan trọng nhất  │
  │  trước khi thoa kem chống nắng?       │
  │                                        │
  │  ┌──────────────────────────────────┐  │
  │  │ A. Tẩy tế bào chết hoá học       │  │
  │  ├──────────────────────────────────┤  │
  │  │ B. Thoa kem dưỡng ẩm cấp nước    │  │
  │  ├──────────────────────────────────┤  │
  │  │ C. Rửa mặt bằng nước nóng        │  │
  │  ├──────────────────────────────────┤  │
  │  │ D. Đắp mặt nạ đất sét            │  │
  │  └──────────────────────────────────┘  │
  └────────────────────────────────────────┘
  ```
* **Timer Dynamics**:
  * $30\text{s} \to 16\text{s}$: Green pill background, calm tick.
  * $15\text{s} \to 6\text{s}$: Amber pill background, increased awareness.
  * $5\text{s} \to 0\text{s}$: Crimson pulse animation (`animate-pulse`).
* **Answer Tap Action**:
  * Selected answer highlights instantly with indigo ring.
  * System locks all 4 buttons to prevent double-tap.
  * Correct/incorrect feedback flashes for `800ms`.
  * Auto-advances to next question smoothly (`fade-in`).
* **Timeout Behavior at 00:00**:
  * All buttons disabled immediately.
  * Red banner flashes: *"Hết giờ! (0 điểm)"*.
  * Pauses for 1.0 second, then auto-advances to the next question.

---

### Screen S3: Results & Lead Capture Screen (Mobile)
* **Goal**: Reveal score and exchange the discount voucher for valid contact info.
* **Wireframe**:
  ```text
  ┌────────────────────────────────────────┐
  │  🎉 HOÀN THÀNH THỬ THÁCH!              │
  │                                        │
  │  Điểm số của bạn:                      │
  │  ⭐ 1,450 / 2,000 ĐIỂM                 │
  │  ⏱️ Tổng thời gian: 42 giây           │
  │  ✅ Đúng 4/5 câu                       │
  ├────────────────────────────────────────┤
  │  🎁 NHẬP THÔNG TIN ĐỂ NHẬN VOUCHER     │
  │  (Đồng thời ghi tên vào Bảng xếp hạng) │
  │                                        │
  │  Họ và tên của bạn:                    │
  │  [ Nguyễn Văn A                    ]   │
  │                                        │
  │  Số điện thoại (nhận mã ưu đãi):       │
  │  [ 0987654321                      ]   │
  │  * Cam kết không spam, chỉ gửi voucher │
  │                                        │
  │  [ 🎁 NHẬN VOUCHER & XẾP HẠNG ]        │
  │                                        │
  │  [ Bỏ qua (Chỉ xem điểm, không lưu) ]  │
  └────────────────────────────────────────┘
  ```
* **Validation Behavior**:
  * Real-time phone regex check on blur and submit: `/^(03|05|07|08|09)\d{8}$/`.
  * If invalid, border turns red and displays inline message: *"Vui lòng nhập số điện thoại Việt Nam hợp lệ (10 chữ số)"*.
  * Tapping "Bỏ qua" allows the user to see the voucher as a demo, but explicitly warns: *"Bạn sẽ không được ghi danh trên Bảng xếp hạng Top 10"*.

---

### Screen S4: Voucher Reward Unlocked & Viral Loop (Mobile)
* **Goal**: Deliver immediate gratification and trigger Facebook viral sharing.
* **Wireframe**:
  ```text
  ┌────────────────────────────────────────┐
  │  ✨ CHÚC MỪNG BẠN ĐÃ NHẬN ĐƯỢC:        │
  │  ┌ - - - - - - - - - - - - - - - - - ┐ │
  │  │  VOUCHER GIẢM 20% TOÀN BỘ ĐƠN     │ │
  │  │                                   │ │
  │  │  Mã: [ GLOW20 ] [ 📋 SAO CHÉP ]   │ │
  │  │                                   │ │
  │  │  • Đơn tối thiểu: 200.000đ        │ │
  │  │  • Hạn dùng: 14 ngày kể từ hôm nay│ │
  │  │  • Áp dụng khi mua tại Fanpage    │ │
  │  └ - - - - - - - - - - - - - - - - - ┘ │
  │                                        │
  │  🏆 Thứ hạng hiện tại: #3 / Top 10     │
  │                                        │
  │  [ 📲 CHIA SẺ LÊN FACEBOOK ]           │
  │  [ 🏆 Xem Bảng Xếp Hạng Top 10 ]       │
  │  [ 🔄 Chơi lại thử thách ]             │
  └────────────────────────────────────────┘
  ```
* **Copy Action**: Tapping "Sao chép" changes the button icon to a green checkmark and displays: *"Đã sao chép mã GLOW20!"*.
* **Share Action**: Invokes `navigator.share()` with the dynamic boast text. If unsupported, copies the snippet and shows: *"Đã sao chép nội dung chia sẻ! Bạn có thể dán lên Facebook ngay."*

---

### Screen S5: Top 10 Leaderboard (Mobile/Desktop)
* **Goal**: Foster competition, community rivalry, and transparent ranking.
* **Wireframe**:
  ```text
  ┌────────────────────────────────────────┐
  │  🏆 BẢNG XẾP HẠNG TOP 10 CAO THỦ       │
  ├────────────────────────────────────────┤
  │  #1 🥇 Lê Minh Tuấn   1,850đ (34s)    │
  │  #2 🥈 Trần Thị Mai   1,620đ (39s)    │
  │  #3 🥉 Nam Nguyen     1,450đ (42s)    │
  │  #4    Hoàng Anh      1,450đ (48s)    │
  │  ...                                   │
  │  #10   Đỗ Gia Bảo     1,100đ (52s)    │
  ├────────────────────────────────────────┤
  │  * Tiêu chí: Điểm cao hơn xếp trước.   │
  │    Nếu bằng điểm, ai làm nhanh hơn     │
  │    (thời gian ít hơn) sẽ xếp trên.     │
  │                                        │
  │  [ ← Quay lại ]                        │
  └────────────────────────────────────────┘
  ```

---

### Screen A1 & A2: Admin Quiz Creator & Review Gate (Desktop)
* **Goal**: Fast, intuitive authoring with AI generation presets and safe human review.
* **Tabs**:
  1. **Tab 1: Tạo bằng AI**:
     * Industry Preset Chips: `[ 👗 Thời trang ] [ 💄 Mỹ phẩm ] [ 📱 Công nghệ ] [ ☕ F&B ]`
     * Custom prompt box: *"Nhập chủ đề tùy ý (vd: Kem chống nắng mùa hè cho da dầu)..."*
     * Difficulty dropdown: Dễ | Trung bình | Khó.
     * Primary Button: `[ ⚡ Tạo 5 câu hỏi bằng AI ]`
  2. **Tab 2: Nhập thủ công**:
     * Form builder with 5 accordion cards for manual entry.
* **Review Gate Interface (Screen A2)**:
  * When AI returns 5 questions, an interactive list appears.
  * Admin can directly click and edit question text, click radio buttons to change the correct answer, or reword choices.
  * Status badge: Displays `🟢 Kết nối AI Gemini 3.8 Flash` or `🟡 Chế độ mô phỏng (Mock)` clearly.
  * Campaign Voucher Settings Card: Admin sets Voucher Code, Discount %, Min Spend, Expiry Days.
  * Save Button: `[ 💾 Lưu & Kích hoạt chiến dịch ]`

---

### Screen A3: Admin Lead Management & Export (Desktop)
* **Goal**: Inspect, filter, and export captured customer leads.
* **Controls**:
  * Search Input: Filter by Name or Phone Number.
  * Action Buttons: `[ 📥 Xuất file Excel (CSV UTF-8) ]` `[ 🗑️ Xóa toàn bộ ]`
  * Table:
    | STT | Họ và Tên | Số điện thoại | Điểm số | Thời gian | Ngày tham gia | Thao tác |
    | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
    | 1 | Nam Nguyen | 0912345678 | 1,450 | 42s | 02/11/2026 | [Xóa] |
* **Confirmation Dialog**: Clicking "Xóa toàn bộ" opens a modal: *"Hành động này sẽ xóa toàn bộ dữ liệu lead trong trình duyệt. Bạn có chắc chắn không?"*.

---

## 4. Interaction States & Edge Cases

| State Category | Screen / Component | Visual & Behavioral Treatment |
| :--- | :--- | :--- |
| **Loading State** | AI Generation Button | Button disabled, spinner rotates, text changes to *"Đang gọi Gemini 3.8 Flash để sinh câu hỏi (khoảng 3-5s)..."*. Skeleton shimmer on question cards. |
| **Empty State** | Leaderboard | Shows an empty podium illustration with: *"Chưa có ai ghi danh! Hãy là người đầu tiên vượt qua thử thách để nhận vị trí số 1!"*. |
| **Empty State** | Admin Leads Table | Shows empty box icon with: *"Chưa có lượt chơi nào hoàn thành. Hãy chia sẻ link quiz lên fanpage để thu thập lead!"*. |
| **Error State** | Lead Form Phone Input | Input border changes to `accent.rose` (`#F43F5E`), microcopy underneath: *"Số điện thoại phải gồm 10 chữ số với đầu số di động VN (03, 05, 07, 08, 09)"*. |
| **Error State** | AI API Timeout / Network | Toast banner: *"Không thể kết nối đến máy chủ AI. Bạn có muốn thử lại hay chuyển sang chế độ câu hỏi mẫu?"* with `[Thử lại]` and `[Dùng mẫu có sẵn]`. |
| **Active Tap State** | Quiz Answer Options | Instant scale micro-animation (`scale-[0.98]`) and indigo background fill on touch, giving tactile confirmation. |

---

## 5. Microcopy & Tone of Voice (Vietnamese)

* **Personality**: Thân thiện, hào hứng, kích thích sự tò mò và tạo cảm giác nhận được giá trị thực.
* **Key Copy Lines**:
  * Welcome CTA: *"Bắt đầu thử thách ngay • Nhận voucher 20%"*
  * Speed Incentive: *"Trả lời càng nhanh, điểm càng cao!"*
  * Timeout Notice: *"Hết 30 giây! Đừng nản, tiếp tục câu sau nhé!"*
  * Lead Consent: *"Thông tin của bạn được bảo mật và chỉ dùng để gửi mã ưu đãi giảm giá từ Shop."*
  * Social Share Boast: *"🔥 Tôi vừa đạt {SCORE}/2,000 điểm tại Thử thách Quiz của {SHOP_NAME} và nhận ngay Voucher giảm {DISCOUNT}! Liệu bạn có phá được kỷ lục của tôi?"*

---

## 6. Accessibility Floor (WCAG 2.1 AA)

* **Color Contrast**: All text elements adhere to $\ge 4.5:1$ contrast ratio against backgrounds.
* **Touch Target Sizing**: All answer buttons and CTA bars have a minimum height of `52px` and minimum width of `100%` on mobile viewports.
* **Keyboard Navigability**: Full tab order traversal (`Tab`, `Shift+Tab`, `Enter`, `Space`) across quiz options and form inputs.
* **Screen Reader Semantic Markup**: Use proper `<fieldset>`, `<legend>`, `<button>`, and `aria-live="polite"` on the countdown timer so vision-impaired users are notified of time milestones.

---

## 7. Responsive Breakpoint Specs

* **Mobile (Default, 360px – 639px)**:
  * Full width container, single column vertical stack for all questions and options.
  * Sticky bottom action buttons where necessary.
* **Tablet / Desktop ($\ge 640px$)**:
  * Centered card container (max width 480px for player quiz; max width 840px for Admin dashboard).
  * 2-column grid layout for Admin Quiz Builder inputs and side-by-side voucher preview.

