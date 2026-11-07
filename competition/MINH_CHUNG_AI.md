# MINH CHỨNG SỬ DỤNG AI XÂY DỰNG SẢN PHẨM — QUIZVIBE AI
**Cuộc thi Vibe Coding 2026 — Bảng A (Công nghệ) — Đề 3: Minigame Quiz thu Lead**
*Đơn vị phát triển: QuizVibe Team | Công cụ AI: Antigravity AI Agent (Gemini 2.5 Pro & Flash)*

---

### Vòng 1: Thiết kế kiến trúc phân tách ranh giới bảo mật Vercel Serverless & Supabase
- **Mục tiêu:** Xây dựng kiến trúc full-stack bảo mật, tuyệt đối không lộ Supabase Service Role Key hay DB secret ra Client.
- **Yêu cầu cho AI:** *"Tạo kiến trúc phân tách giữa `src/` (Client React) và `api/` (Serverless Function). Client chỉ nhận session token và public payload; mọi quyền ghi và truy vấn DB bảo mật phải chạy qua API nội bộ."*
- **Vấn đề phát hiện khi thử:** Bản nháp ban đầu import trực tiếp Supabase client ở một số component phía client, có nguy cơ lộ quyền truy cập database trực tiếp.
- **Yêu cầu sửa:** *"Refactor toàn bộ: Client chỉ gọi HTTP API nội bộ (`/api/*`); Serverless sử dụng HttpOnly Cookie (`quizvibe_admin_token`) cho Admin và Row Level Security (RLS) cho Supabase."*
- **Kết quả kiểm tra lại:** Vượt qua Security Audit; 0 secret bị lộ; Cookie phiên đăng nhập bảo mật với cờ `HttpOnly`, `SameSite=Strict`.

---

### Vòng 2: Xây dựng Game Engine, Timer 30s & Thuật toán thưởng tốc độ
- **Mục tiêu:** Hoàn thiện trải nghiệm chơi quiz 5 câu hỏi mượt mà, timer đếm ngược 30s/câu và tính điểm thưởng theo tốc độ phản xạ.
- **Yêu cầu cho AI:** *"Viết hook `useCountdownTimer` và thuật toán tính điểm: 100 điểm cơ bản + tối đa 100 điểm thưởng tốc độ dựa trên mili-giây còn lại."*
- **Vấn đề phát hiện khi thử:** Xảy ra race condition khi người dùng click liên tiếp hoặc timer kết thúc đúng lúc bấm chọn; thời gian bị lệch khi chuyển tab trình duyệt.
- **Yêu cầu sửa:** *"Khóa ngay nút chọn khi gửi (`isSubmitting = true`), đồng bộ tính thời gian qua `performance.now()` và timestamp server ghi nhận, chống double-submit."*
- **Kết quả kiểm tra lại:** Vượt qua 34 automated tests (`QuizGameScreen.test.ts`, `useCountdownTimer.test.ts`); tính điểm chính xác đến mili-giây; không còn double-submit.

---

### Vòng 3: Cơ chế chống đăng ký trùng lặp SĐT & Phát Voucher nguyên tử (Atomic Claim)
- **Mục tiêu:** Mỗi số điện thoại chỉ được nhận voucher 1 lần duy nhất cho mỗi chiến dịch (chống spam/fraud), tự động mở khóa mã ưu đãi độc quyền.
- **Yêu cầu cho AI:** *"Xây dựng API `/api/quiz/lead` và bảng quan hệ để kiểm tra và chặn SĐT đã nhận voucher trên cùng chiến dịch."*
- **Vấn đề phát hiện khi thử:** Thao tác kiểm tra SELECT rồi mới INSERT thông thường bị lỗi race condition khi người dùng mở 2 tab submit cùng lúc, dẫn đến tạo lead trùng.
- **Yêu cầu sửa:** *"Chuyển toàn bộ thao tác sang PostgreSQL RPC nguyên tử `register_quiz_lead` với transaction lock và bảng ràng buộc unique `(campaign_id, phone)`, trả về mã lỗi `DUPLICATE_PHONE` nếu trùng."*
- **Kết quả kiểm tra lại:** Chặn 100% spam trùng SĐT; test tích hợp `campaignPhoneRegistration.test.ts` pass; người chơi nhận mã voucher ngay trên giao diện.

---

### Vòng 4: Bộ kiểm thử tự động toàn diện với In-Memory FakePostgrest (767 Tests)
- **Mục tiêu:** Xây dựng bộ test tự động đạt độ bao phủ cao cho toàn bộ luồng nghiệp vụ API và UI mà không làm ô nhiễm DB Production.
- **Yêu cầu cho AI:** *"Tạo module `fakePostgrest.ts` mô phỏng đầy đủ PostgREST REST API, RPC calls, bộ lọc `eq`, `order`, `limit` và fail-closed network interceptor."*
- **Vấn đề phát hiện khi thử:** Một số endpoint phức tạp (như RPC `admin_save_campaign` và quan hệ bảng lồng nhau) khiến mock bị crash hoặc trả sai schema.
- **Yêu cầu sửa:** *"Bổ sung AST parser đơn giản cho query chains, hỗ trợ mock RPC và cơ chế fail-closed chặn toàn bộ outbound network ra ngoài."*
- **Kết quả kiểm tra lại:** **767/767 tests passed 100%** trên 44 test suites (Vitest), thời gian thực thi chỉ 10.78s, đảm bảo an toàn dữ liệu tuyệt đối.

---

### Vòng 5: Pipeline tự động hóa quay video demo 1080p 60FPS đồng bộ âm thanh & phụ đề
- **Mục tiêu:** Tự động hóa quá trình ghi hình website thật, lồng tiếng AI tiếng Việt và phụ đề ASS chuẩn 1080p 60fps dưới 2 phút.
- **Yêu cầu cho AI:** *"Viết script Playwright điều khiển Chromium tự động thao tác 10 cảnh, dùng Edge TTS tạo audio và FFmpeg ghép video với sub ASS."*
- **Vấn đề phát hiện khi thử:** Video ban đầu bị lệch timing 3 cảnh: lời thuyết minh đọc xong trước khi UI load xong, chuột ảo click trượt modal do animation.
- **Yêu cầu sửa:** *"Bổ sung đồng bộ hóa theo sự kiện (`waitForSelector`), tăng tốc độ đọc (+15%), căn chỉnh timing từng micro-second và nhúng phụ đề ASS verbatim."*
- **Kết quả kiểm tra lại:** Xuất bản video `quizvibe-ai-demo-revised.mp4` chuẩn 1920×1080 @ 60 FPS, thời lượng 93.65 giây (đạt chuẩn ≤ 120s), khớp hình và tiếng 100%.

