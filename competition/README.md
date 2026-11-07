# QUIZVIBE AI — BÀI DỰ THI VIBE CODING 2026

Nền tảng Minigame Quiz tương tác tự động tạo câu hỏi bằng AI, kích hoạt động lực người chơi bằng Timer & Speed Bonus, thu thập Lead chất lượng cao và phát hành Voucher độc quyền cho Fanpage.

---

## 1. Thông tin chung

| Hạng mục | Nội dung |
|---|---|
| **Tên đội thi** | **QuizVibe Team** |
| **Bảng thi** | **Bảng A — Công nghệ** |
| **Đề bài bốc thăm** | **Đề số 3 — Minigame Quiz thu Lead cho Fanpage** |
| **Demo online** | https://quiz-vibe-ai.vercel.app |
| **Video demo (≤ 02 phút)** | `video-production/output/quizvibe-ai-demo-revised.mp4` *(1920×1080 @ 60 FPS CFR, thời lượng 93.65 giây, có giọng đọc tiếng Việt và phụ đề ASS)* |
| **Source ZIP** | Gói mã nguồn đính kèm bài thi |
| **Minh chứng dùng AI** | [MINH_CHUNG_AI.md](./MINH_CHUNG_AI.md) *(Đúng 1 trang, 5 vòng cộng tác AI tiêu biểu)* |
| **Bảng kiểm thử** | [BANG_KIEM_THU.md](./BANG_KIEM_THU.md) *(7 ca kiểm thử tiêu biểu kèm kết quả 767/767 automated tests passed)* |

---

## 2. 5 Tính năng cốt lõi (Đề 3 — Bảng A)

1. **AI Quiz Builder & Cổng kiểm duyệt (Review Gate):** Phân tích ngữ cảnh bài đăng/thương hiệu Fanpage, tự động sinh 5 câu hỏi trắc nghiệm chất lượng cao kèm 4 phương án, 1 đáp án đúng và lời giải thích văn hóa. Admin có toàn quyền chỉnh sửa và duyệt trước khi xuất bản.
2. **Minigame Quiz Gameplay & Đếm ngược 30s:** Trải nghiệm chơi mượt mà với đồng hồ đếm ngược 30 giây/câu, âm thanh phản hồi, hiệu ứng pháo hoa ăn mừng và cơ chế chống double-submit khi thao tác.
3. **Cơ chế tính điểm thưởng tốc độ (Speed Bonus Engine):** Điểm số kết hợp giữa 100 điểm trả lời đúng cơ bản + tối đa 100 điểm thưởng phản xạ nhanh dựa trên mili-giây còn lại trên đồng hồ, tối đa 200 điểm/câu (1000 điểm toàn trận).
4. **Thu thập Lead & Nhận Voucher nguyên tử (Atomic Claim):** Người chơi điền Họ tên, SĐT, Email để mở khóa mã ưu đãi độc quyền; hệ thống tích hợp RPC nguyên tử chống spam đăng ký trùng lặp SĐT trên cùng một chiến dịch.
5. **Bảng xếp hạng Top 10 Realtime & Lan tỏa mạng xã hội:** Bảng xếp hạng vinh danh người chơi điểm cao (tự động ẩn danh 3 số giữa của SĐT để bảo mật thông tin cá nhân) và tính năng chia sẻ thành tích lên Facebook với ảnh Open Graph tùy biến.

---

## 3. Công nghệ sử dụng

| Lớp | Công nghệ triển khai |
|---|---|
| **Giao diện (Frontend)** | React 19, TypeScript, Tailwind CSS, Lucide Icons, Canvas Confetti |
| **Backend & API** | Vercel Serverless Functions (`api/`), Node.js, Express/Connect Adapter |
| **Cơ sở dữ liệu** | PostgreSQL / Supabase, Stored Procedures (RPC nguyên tử), Row Level Security (RLS) |
| **Xác thực & Bảo mật** | HttpOnly Cookie (`quizvibe_admin_token`, `SameSite=Strict`), SHA-256 Signature, Fail-closed network sandbox |
| **Kiểm thử tự động** | Vitest 5.1.0, Happy DOM, Playwright Chromium E2E, In-memory FakePostgrest (**767/767 tests passed 100%**) |
| **Triển khai hạ tầng** | Vercel Serverless Platform (Production URL: https://quiz-vibe-ai.vercel.app) |

---

## 4. Tích hợp AI

- **Chế độ hỗ trợ:** 
  - **API thật:** Tích hợp Google Gemini 2.5 Pro / Flash & OpenRouter AI Gateway thông qua Serverless Function bảo mật.
  - **Mock / Preset thông minh:** Tích hợp bộ tạo câu hỏi chuyên sâu theo từng ngành nghề (F&B, Thời trang, Công nghệ, Giáo dục), sẵn sàng hoạt động ngay cả khi không có internet hoặc khi kiểm thử tự động.
- **Mục đích:** Đọc hiểu ngữ cảnh Fanpage, tự động tạo câu hỏi trắc nghiệm thông minh, gợi ý phương án gây nhiễu hợp lý và đính kèm kiến thức văn hóa ẩm thực / sản phẩm.
- **Bảo mật khóa API:** Tuyệt đối không lưu khóa API phía client. Khóa được quản lý qua biến môi trường máy chủ (`GEMINI_API_KEY`) và chỉ được gọi thông qua API `/api/generate-quiz`.

---

## 5. Cài đặt và chạy thử nghiệm tại Local

Yêu cầu: Node.js ≥ 18.

```bash
# 1. Cài đặt các thư viện phụ thuộc
npm install

# 2. Khởi chạy máy chủ phát triển
npm run dev
# Ứng dụng chạy tại: http://localhost:5173 (hoặc port được chỉ định)

# 3. Chạy toàn bộ 767 ca kiểm thử tự động
npm test

# 4. Build sản phẩm cho môi trường Production
npm run build
```

---

## 6. Cấu trúc thư mục dự án

```text
QuizVibe-AI/
├── api/                    # Vercel Serverless Functions & Backend API
│   ├── _lib/               # Module xử lý nghiệp vụ, database client, fakePostgrest sandbox
│   ├── admin/              # API đăng nhập, quản lý chiến dịch, quản lý leads
│   ├── quiz/               # API phiên chơi, chấm điểm, thu lead, bảng xếp hạng
│   └── generate-quiz.ts    # API tích hợp AI tạo bộ câu hỏi
├── competition/            # Hồ sơ nộp bài Vibe Coding 2026
│   ├── README.md           # Tài liệu tổng quan dự án
│   ├── MINH_CHUNG_AI.md    # Minh chứng sử dụng AI (Tối đa 1 trang, 5 vòng lặp)
│   └── BANG_KIEM_THU.md    # Bảng kiểm thử Bảng A (7 ca tiêu biểu kèm kết quả thực tế)
├── src/                    # Ứng dụng Frontend React 19
│   ├── components/admin/   # Admin Studio, QuizBuilder, LeadDashboard
│   ├── components/player/  # Giao diện chơi game, đếm ngược, Result, Voucher, Leaderboard
│   ├── hooks/              # Custom hooks: useCountdownTimer, useQuizSession
│   └── services/           # AI Service, Storage Service, Social Share
├── video-production/       # Pipeline ghi hình video demo 1080p 60fps tự động
│   └── output/             # File video demo hoàn chỉnh (quizvibe-ai-demo-revised.mp4)
├── package.json            # Cấu hình dự án & scripts kiểm thử
└── vite.config.ts          # Cấu hình Vite & Vitest environment
```

---

## 7. Phân quyền và truy cập

- **Khu vực Người chơi:** Truy cập công khai, tham gia trả lời câu hỏi trực tiếp, lưu kết quả phiên chơi và đăng ký nhận voucher.
- **Khu vực Quản trị (Admin Studio):** Truy cập tại `/admin/login`, bảo vệ bằng HttpOnly Cookie. Hỗ trợ xem thống kê chiến dịch, tạo câu hỏi AI, xuất danh sách Lead và quản lý Voucher.

---

## 8. Minh chứng sử dụng AI

Chi tiết xem tại tài liệu riêng: **[competition/MINH_CHUNG_AI.md](./MINH_CHUNG_AI.md)**

*Tóm tắt quy trình cộng tác AI:*
1. **Vòng 1 (Kiến trúc & Bảo mật):** AI thiết kế phân tách ranh giới an toàn giữa Client và Serverless Function; khắc phục nguy cơ rò rỉ secret bằng Cookie HttpOnly.
2. **Vòng 2 (Game Engine & Timer):** Xây dựng thuật toán tính điểm thưởng tốc độ và hook đếm ngược 30s; giải quyết triệt để lỗi race condition và double-submit.
3. **Vòng 3 (Atomic Voucher Claim):** Thiết kế Stored Procedure `register_quiz_lead` chống gian lận đăng ký trùng SĐT trên cùng chiến dịch.
4. **Vòng 4 (Kiểm thử tự động):** Phát triển sandbox In-Memory FakePostgrest, kiểm thử tự động toàn diện **767/767 tests passed**.
5. **Vòng 5 (Video Demo Pipeline):** Tự động hóa ghi hình Playwright 1080p 60fps, lồng tiếng AI tiếng Việt và phụ đề ASS đồng bộ 100%.

---

## 9. Bảng kiểm thử (Bảng A — Kết quả thực tế)

Chi tiết xem tại tài liệu riêng: **[competition/BANG_KIEM_THU.md](./BANG_KIEM_THU.md)**

| Mã ca | Loại ca | Chức năng kiểm thử | Dữ liệu và bước thử | Kết quả kỳ vọng | Kết quả thực tế | Đạt/Chưa đạt |
|:---:|:---:|:---|:---|:---|:---|:---:|
| **TC01** | Bình thường | Sinh Quiz 5 câu bằng AI & Review Gate | Nhập ngữ cảnh Fanpage F&B, bấm tạo câu hỏi, duyệt và lưu | Sinh đủ 5 câu hỏi kèm giải thích, Admin lưu thành công | HTTP 200 OK, JSON chuẩn schema, lưu DB thành công | **ĐẠT** |
| **TC02** | Bình thường | Gameplay, Timer 30s & Tính điểm tốc độ | Trả lời đúng câu hỏi tại giây thứ 4.5/30s | Điểm = 100 cơ bản + $\approx 85$ điểm thưởng $\approx 185$đ | Điểm tính chuẩn mili-giây, animation mượt mà, tổng 930đ | **ĐẠT** |
| **TC03** | Không hợp lệ | Thu thập Lead với SĐT/Email sai cú pháp | Điền SĐT 6 số, Email sai cú pháp RFC | Client & Backend từ chối, báo lỗi đỏ hướng dẫn | HTTP 400 `VALIDATION_FAILED`, không lưu rác vào DB | **ĐẠT** |
| **TC04** | Không hợp lệ | Admin lưu chiến dịch thiếu số lượng câu hỏi | Gửi payload chỉ có 3 câu hỏi (quy định 5 câu) | Backend từ chối lưu, trả về mã lỗi 400 | HTTP 400 Bad Request, DB được bảo vệ an toàn | **ĐẠT** |
| **TC05** | Ca biên | Chống đăng ký trùng SĐT (Atomic Claim) | Dùng 1 SĐT đăng ký nhận Voucher 2 lần trên 1 chiến dịch | Khóa nhận voucher lần 2, thông báo thân thiện | HTTP 409 `DUPLICATE_PHONE`, chặn 100% spam | **ĐẠT** |
| **TC06** | Ca biên | Xử lý hết giờ 30s & Reload trang đột ngột | Để đồng hồ về 0s; thử F5 khi đang chơi | Tính 0 điểm câu hết giờ, F5 không làm crash ứng dụng | Tự động khóa nút, hiển thị đáp án, session an toàn | **ĐẠT** |
| **TC07** | Bảo mật | Chống truy cập trái phép API Quản trị | Gửi request `/api/admin/manage` khi chưa đăng nhập | Chặn request, chuyển hướng đăng nhập | HTTP 401 Unauthorized, không rò rỉ dữ liệu Leads | **ĐẠT** |

---

## 10. Hồ sơ bàn giao dự án

- **Source ZIP:** Đầy đủ mã nguồn, cấu hình mẫu, bộ kiểm thử 767 ca test.
- **Video demo:** `video-production/output/quizvibe-ai-demo-revised.mp4` (93.65 giây, 1920×1080 @ 60 FPS CFR, giọng đọc tiếng Việt và phụ đề ASS).
- **Minh chứng AI:** [MINH_CHUNG_AI.md](./MINH_CHUNG_AI.md) (Tối đa 1 trang).
- **Bảng kiểm thử:** [BANG_KIEM_THU.md](./BANG_KIEM_THU.md) (Ít nhất 6 ca có kết quả thực tế).
- **Tài khoản Demo Admin:** `admin` / `quizvibe2026` (Môi trường Demo Sandbox độc lập).
