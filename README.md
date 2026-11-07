# QuizVibe AI

**QuizVibe AI** là nền tảng tạo và vận hành minigame trắc nghiệm (quiz) phục vụ tương tác với người dùng và thu thập khách hàng tiềm năng (Lead) cho Fanpage. Dự án được xây dựng cho **VIBE-CODING 2026 – Bảng A: Công nghệ, Đề 3: Minigame Quiz thu Lead cho Fanpage**.

- **Demo Production:** https://quiz-vibe-ai.vercel.app/
- **Source:** https://github.com/quanbt4567/QuizVibe-AI
- **Bảng thi:** Bảng A – Công nghệ
- **Đề bài:** Đề 3 – Minigame quiz thu Lead cho Fanpage

> README này mô tả cấu trúc và cấu hình theo source hiện tại. Các thông tin như trạng thái API key, kết quả kiểm thử, cấu hình Production và các thao tác triển khai phải được đội dự thi tự xác minh; không coi việc có mã nguồn tích hợp là bằng chứng dịch vụ đang hoạt động.

---

## 1. Tổng quan sản phẩm

QuizVibe AI hỗ trợ quản trị viên tạo chiến dịch quiz, công bố đường dẫn riêng cho từng chiến dịch và theo dõi kết quả người chơi.

### 5 chức năng theo đề bài

1. **Tạo quiz:** nhập câu hỏi thủ công hoặc yêu cầu AI gợi ý câu hỏi theo chủ đề. Bộ quiz mục tiêu gồm 05 câu, mỗi câu có 04 phương án.
2. **Chơi quiz:** hiển thị từng câu hỏi, đếm ngược 30 giây cho mỗi câu và tính điểm dựa trên đáp án đúng cùng tốc độ trả lời.
3. **Kết quả và thu thập Lead:** hiển thị kết quả, tiếp nhận thông tin người chơi và liên kết dữ liệu với chiến dịch/phiên chơi.
4. **Bảng xếp hạng:** hiển thị Top 10 người chơi theo chiến dịch.
5. **Chia sẻ kết quả:** tạo nội dung chia sẻ kết quả, hỗ trợ sao chép và các phương thức chia sẻ khả dụng trên trình duyệt.

### Chức năng quản trị bổ sung trong source

- Quản lý nhiều chiến dịch và trạng thái chiến dịch.
- Cấu hình nội dung quiz, ngành hàng và voucher.
- Theo dõi Lead và dữ liệu chiến dịch trong khu vực quản trị.
- Xác thực quản trị viên bằng phiên đăng nhập phía server.

---

## 2. Công nghệ sử dụng

| Thành phần | Công nghệ |
|---|---|
| Frontend | React 19, TypeScript |
| Build tool / Dev server | Vite 6 |
| Giao diện | Tailwind CSS 3, CSS |
| Backend API | Vercel Serverless Functions (Node.js) |
| Database | Supabase PostgreSQL |
| Database client | `@supabase/supabase-js` |
| AI gateway | Google Gemini, Groq; Cerebras tùy chọn |
| Kiểm thử | Vitest, happy-dom |
| Triển khai | Vercel |

### Kiến trúc tổng quát

```text
Người quản trị / Người chơi
          |
          v
React + TypeScript + Vite
          |
          | HTTPS /api/*
          v
Vercel Serverless Functions
      |             |
      |             +------> AI Provider Router
      |                         |--> Gemini
      |                         |--> Groq
      |                         +--> Cerebras (optional)
      |
      +----------------------> Supabase PostgreSQL
```

**Ranh giới bảo mật:** các khóa bí mật và thao tác database đặc quyền được đặt ở server trong `api/`. Không đưa `SUPABASE_SERVICE_ROLE_KEY`, `ADMIN_PASSWORD`, `ADMIN_SESSION_SECRET` hoặc khóa AI vào biến môi trường có tiền tố `VITE_`.

---

## 3. Yêu cầu môi trường

- Node.js phiên bản LTS còn được hỗ trợ.
- npm.
- Git.
- Một project Supabase.
- Tài khoản Vercel nếu muốn triển khai.
- API key của ít nhất một AI provider nếu muốn sử dụng tính năng tạo câu hỏi bằng AI thật.

Phiên bản package cụ thể được quản lý trong `package.json` và lockfile của repository.

---

## 4. Cài đặt và chạy local

### Bước 1: Clone repository

```bash
git clone https://github.com/quanbt4567/QuizVibe-AI.git
cd QuizVibe-AI
```

### Bước 2: Cài dependencies

Nếu repository có `package-lock.json`, ưu tiên:

```bash
npm ci
```

Hoặc:

```bash
npm install
```

### Bước 3: Tạo file môi trường

Sao chép `.env.example` thành `.env.local`:

**Windows PowerShell**
```powershell
Copy-Item .env.example .env.local
```

**macOS / Linux**
```bash
cp .env.example .env.local
```

Điền các biến môi trường cần thiết theo phần [Cấu hình môi trường](#5-cấu-hình-môi-trường). Không commit `.env.local` lên Git.

### Bước 4: Chạy ứng dụng

```bash
npm run dev
```

Mở địa chỉ Vite hiển thị trong terminal (mặc định: http://localhost:5173).

### Các lệnh dự án

| Lệnh | Mục đích |
|---|---|
| `npm run dev` | Chạy môi trường phát triển |
| `npm run build` | Chạy TypeScript compiler và build frontend |
| `npm run preview` | Preview bản build Vite |
| `npm test` | Chạy bộ test bằng Vitest |

Trước khi đóng gói bài dự thi, nên chạy:

```bash
npm run build
npm test
```

Chỉ ghi nhận kết quả Đạt khi lệnh thực sự chạy thành công trên môi trường kiểm thử của đội.

---

## 5. Cấu hình môi trường

Mẫu biến môi trường đầy đủ nằm trong file `.env.example`. Các giá trị bên dưới là tên biến, không phải giá trị bí mật.

### 5.1. Supabase – bắt buộc cho backend database

| Biến | Bắt buộc | Mô tả |
|---|---:|---|
| `SUPABASE_URL` | Có | Project URL của Supabase |
| `SUPABASE_SERVICE_ROLE_KEY` | Có | Service Role Key, chỉ sử dụng phía server |
| `SUPABASE_ANON_KEY` | Tùy luồng | Anon/Publishable Key dùng cho kiểm tra RLS phía server |

### 5.2. Xác thực quản trị viên

| Biến | Bắt buộc | Mô tả |
|---|---:|---|
| `ADMIN_PASSWORD` | Có | Mật khẩu quản trị, tối thiểu 8 ký tự |
| `ADMIN_SESSION_SECRET` | Có | Secret ngẫu nhiên độc lập, tối thiểu 32 ký tự |

Có thể tạo secret ngẫu nhiên bằng:

```bash
openssl rand -hex 32
```

Không dùng lại mật khẩu quản trị hoặc Supabase Service Role Key làm session secret.

### 5.3. AI providers

| Biến | Mô tả |
|---|---|
| `GEMINI_API_KEY` | API key Gemini |
| `GEMINI_MODEL` | Tên model Gemini; mẫu hiện tại: `gemini-3.8-flash` |
| `GROQ_API_KEY` | API key Groq |
| `GROQ_MODEL` | Tên model Groq; mẫu hiện tại: `openai/gpt-oss-20b` |
| `ENABLE_CEREBRAS` | Bật/tắt Cerebras; mẫu mặc định `false` |
| `CEREBRAS_API_KEY` | API key Cerebras nếu bật |
| `CEREBRAS_MODEL` | Tên model Cerebras; mẫu hiện tại: `llama3.1-8b` |

AI gateway thử các provider theo thứ tự Gemini → Groq → Cerebras. Provider chưa cấu hình hoặc bị tắt sẽ được bỏ qua. Cerebras chỉ được sử dụng khi được bật và cấu hình hợp lệ.

**Lưu ý:** tên model và quota phụ thuộc nhà cung cấp, tài khoản và thời điểm sử dụng. Hãy kiểm tra model/API key đang được hỗ trợ tại dashboard chính thức của nhà cung cấp trước khi triển khai. Không ghi API key thật vào README, source code, ảnh minh chứng hoặc video.

### 5.4. Tương thích session token

| Biến | Mô tả |
|---|---|
| `ENABLE_LEGACY_SESSION_TOKEN_WRITE` | Cờ tương thích dual-write/hash-only trong quá trình chuyển đổi session token. Mẫu hiện tại đặt `true`. |

Không tự ý thay đổi cờ này hoặc thứ tự migration trên Production. Chỉ thay đổi khi đã đối chiếu migration, trạng thái database và kế hoạch triển khai tương ứng.

---

## 6. Thiết lập Supabase database

Các migration của dự án nằm trong:

```text
supabase/migrations/
```

Các file hiện có theo thứ tự:

1. `20261105000001_initial_quizvibe_schema.sql`
2. `20261105000002_admin_sessions.sql`
3. `20261105000003_admin_save_campaign_rpc.sql`
4. `20261105000004_quiz_sessions_phase4.sql`
5. `20261105000005_player_session_token_hash.sql`
6. `20261105000006_player_session_token_contract.sql`
7. `20261106000007_enforce_session_token_hash_not_null.sql`
8. `20261106000008_fix_leads_masked_phone_check.sql`

Đây là danh sách file migration trong repository, **không phải xác nhận rằng tất cả migration đã được áp dụng trên một Supabase project cụ thể**.

Khi thiết lập một môi trường database mới:

1. Tạo Supabase project riêng cho môi trường đó.
2. Đọc kỹ từng migration và các điều kiện tiên quyết.
3. Áp dụng migration theo thứ tự tên file trên môi trường mới.
4. Kiểm tra schema, constraint, index, function, trigger và RLS sau khi chạy.
5. Cấu hình biến môi trường server tương ứng.
6. Chạy kiểm thử tích hợp trước khi đưa môi trường vào sử dụng.

**Production:** không chạy lại migration, không reset database và không thay đổi dữ liệu Production chỉ dựa trên hướng dẫn trong README. Cần có backup, kế hoạch migration và xác nhận của người phụ trách database.

---

## 7. Luồng sử dụng sản phẩm

### 7.1. Quản trị viên

1. Truy cập khu vực quản trị.
2. Đăng nhập bằng tài khoản quản trị đã cấu hình.
3. Tạo chiến dịch mới.
4. Nhập câu hỏi thủ công hoặc yêu cầu AI tạo câu hỏi theo chủ đề.
5. Kiểm tra, chỉnh sửa và xác nhận nội dung câu hỏi.
6. Cấu hình các thông tin cần thiết của chiến dịch.
7. Xuất bản chiến dịch và lấy đường dẫn dành cho người chơi.
8. Theo dõi kết quả, Lead và bảng xếp hạng.

### 7.2. Người chơi

1. Mở đường dẫn chiến dịch.
2. Bắt đầu chơi quiz.
3. Trả lời lần lượt 05 câu hỏi, mỗi câu có thời gian giới hạn 30 giây.
4. Xem kết quả.
5. Nhập thông tin theo form nhận quà/ghi nhận Lead.
6. Xem thứ hạng và chia sẻ kết quả.

Đường dẫn public của chiến dịch có dạng:

```text
/quiz/<campaign-slug>
```

Ví dụ cấu trúc URL: `https://quiz-vibe-ai.vercel.app/quiz/ten-chien-dich`. Slug thực tế phụ thuộc chiến dịch đã tạo và được xuất bản.

---

## 8. API overview

Các endpoint chính trong source:

| Endpoint | Phương thức | Chức năng |
|---|---|---|
| `/api/generate-quiz` | POST | Tạo câu hỏi thông qua AI gateway |
| `/api/public/campaign` | GET | Lấy thông tin chiến dịch public |
| `/api/quiz/session` | POST | Khởi tạo phiên chơi |
| `/api/quiz/answer` | POST | Gửi và chấm đáp án |
| `/api/quiz/complete` | POST | Hoàn tất phiên chơi |
| `/api/quiz/lead` | POST | Ghi nhận Lead |
| `/api/quiz/leaderboard` | GET | Lấy bảng xếp hạng |
| `/api/admin/login` | POST | Đăng nhập quản trị |
| `/api/admin/session` | GET | Kiểm tra phiên quản trị |
| `/api/admin/logout` | POST | Đăng xuất |
| `/api/admin/manage` | Theo handler | Các thao tác quản trị chiến dịch |
| `/api/health` | GET | Kiểm tra tình trạng API |

Chi tiết request/response, validation và quyền truy cập được định nghĩa trong các handler tương ứng ở thư mục `api/`.

---

## 9. Kiểm thử và nghiệm thu

Chạy toàn bộ test:

```bash
npm test
```

Build kiểm tra:

```bash
npm run build
```

Các test hiện được cấu hình trong `vite.config.ts`, sử dụng Vitest với môi trường `happy-dom`, bao gồm test trong `src/` và `api/`.

### Test matrix đề xuất theo Đề 3 – Bảng A

| ID | Loại kiểm thử | Kịch bản | Kết quả cần xác nhận |
|---|---|---|---|
| TC01 | Bình thường | Tạo quiz thủ công đủ 05 câu, mỗi câu 04 đáp án | Lưu và xuất bản thành công |
| TC02 | Bình thường | Tạo quiz bằng AI theo chủ đề | AI trả về đúng cấu trúc 05 câu, 04 đáp án/câu |
| TC03 | Đầu vào không hợp lệ | Bỏ trống câu hỏi hoặc đáp án | Hệ thống từ chối và hiển thị lỗi phù hợp |
| TC04 | Đầu vào không hợp lệ | Nhập số điện thoại sai định dạng | Không ghi nhận Lead không hợp lệ |
| TC05 | Biên | Trả lời đúng khi còn 01 giây | Điểm được tính đúng theo quy tắc |
| TC06 | Sự cố/biên | Hết 30 giây không trả lời | Câu được xử lý timeout và trò chơi tiếp tục |
| TC07 | Tích hợp | Nhiều người chơi cùng một chiến dịch | Session, kết quả và leaderboard không bị lẫn |
| TC08 | Tích hợp | Chia sẻ kết quả | Nội dung và đường dẫn chia sẻ chính xác |

Với Bảng A, cần có tối thiểu 06 ca kiểm thử gồm 02 ca bình thường, 02 ca đầu vào không hợp lệ và 02 ca biên/sự cố. Bảng trên là bộ ca đề xuất; đội phải thực thi và ghi kết quả thực tế trước khi nộp.

Mẫu ghi nhận kết quả:

| ID | Ngày chạy | Môi trường | Kết quả (Pass/Fail) | Bằng chứng / Ghi chú |
|---|---|---|---|---|
| TC01 | Chưa chạy | Chưa xác nhận | Chưa xác nhận | Bổ sung sau kiểm thử |
| TC02 | Chưa chạy | Chưa xác nhận | Chưa xác nhận | Bổ sung sau kiểm thử |
| TC03 | Chưa chạy | Chưa xác nhận | Chưa xác nhận | Bổ sung sau kiểm thử |
| TC04 | Chưa chạy | Chưa xác nhận | Chưa xác nhận | Bổ sung sau kiểm thử |
| TC05 | Chưa chạy | Chưa xác nhận | Chưa xác nhận | Bổ sung sau kiểm thử |
| TC06 | Chưa chạy | Chưa xác nhận | Chưa xác nhận | Bổ sung sau kiểm thử |

Không giữ nguyên trạng thái “Chưa xác nhận” trong hồ sơ cuối cùng; cập nhật theo kết quả thực tế.

---

## 10. AI: vai trò, cơ chế và giới hạn

AI được sử dụng để hỗ trợ người quản trị tạo nội dung câu hỏi trắc nghiệm theo chủ đề, ngành hàng và độ khó.

### Cơ chế

1. Frontend gửi chủ đề, ngành hàng và độ khó tới `/api/generate-quiz`.
2. Server-side AI gateway kiểm tra request và lựa chọn provider đã được cấu hình.
3. Provider tạo nội dung câu hỏi.
4. Kết quả được chuẩn hóa/kiểm tra cấu trúc trước khi trả về frontend.
5. Quản trị viên xem xét nội dung trước khi lưu và xuất bản.

### Provider được hỗ trợ trong source

- Google Gemini.
- Groq.
- Cerebras (tùy chọn, mặc định tắt trong file môi trường mẫu).

### Giới hạn

- AI có thể tạo câu hỏi chưa chính xác, mơ hồ hoặc không phù hợp ngữ cảnh.
- Chất lượng kết quả phụ thuộc prompt, chủ đề, model và dịch vụ AI.
- API có thể gặp lỗi, timeout, hết quota hoặc không khả dụng.
- Quản trị viên cần kiểm tra nội dung trước khi sử dụng.
- Chế độ fallback sang bộ câu hỏi mẫu chỉ được mô tả là đã nghiệm thu sau khi đội kiểm tra thực tế luồng đó.

### Minh chứng AI cần chuẩn bị

Đối với hồ sơ dự thi, nên chuẩn bị tối đa 01 trang thể hiện:

- Chủ đề đầu vào.
- Kết quả AI tạo ra (05 câu, mỗi câu 04 đáp án).
- Provider/model thực tế được sử dụng.
- Ảnh hoặc đoạn hội thoại minh chứng.
- Ví dụ đội đã kiểm tra, chỉnh sửa hoặc loại bỏ nội dung AI chưa phù hợp.

Không đưa API key, access token, mật khẩu hoặc dữ liệu cá nhân thật vào minh chứng.

---

## 11. Triển khai Vercel

Repository có `vercel.json` cấu hình framework Vite, rewrite các đường dẫn SPA và route API.

Quy trình triển khai tổng quát:

1. Import repository vào Vercel.
2. Chọn framework preset Vite (đã khai báo trong `vercel.json`).
3. Cấu hình các biến môi trường server cần thiết trong Project Settings → Environment Variables.
4. Kiểm tra các biến môi trường theo từng môi trường Preview/Production.
5. Deploy.
6. Kiểm tra trang chủ, route `/quiz/<slug>`, đăng nhập quản trị và các API cần thiết.
7. Kiểm tra log và chạy thử một chiến dịch trước khi công bố.

Không đặt các secret server-side dưới dạng biến `VITE_*`. Không đưa file `.env.local` vào ZIP công khai hoặc Git.

---

## 12. Cấu trúc thư mục

Các thư mục chính:

```text
QuizVibe-AI/
├── api/
│   ├── _lib/
│   │   ├── auth/          # Xác thực quản trị và session
│   │   ├── db/            # Supabase server client, repository
│   │   ├── providers/     # Gemini, Groq, Cerebras
│   │   └── quiz/          # Nghiệp vụ quiz, chấm điểm, session
│   ├── admin/             # API quản trị
│   ├── public/            # API public campaign
│   └── quiz/              # API chơi quiz, Lead, leaderboard
├── src/
│   ├── components/
│   │   ├── admin/         # Giao diện quản trị
│   │   ├── player/        # Giao diện người chơi
│   │   └── common/        # Thành phần dùng chung
│   ├── hooks/             # React hooks
│   ├── router/            # Điều hướng ứng dụng
│   ├── services/          # Client API, scoring, sharing
│   ├── types/             # TypeScript types
│   └── data/              # Dữ liệu/preset mẫu
├── supabase/
│   └── migrations/        # SQL migrations
├── .env.example           # Mẫu biến môi trường
├── package.json
├── vite.config.ts
└── vercel.json
```

---

## 13. Bảo mật và dữ liệu

- Supabase Service Role Key và các secret quản trị chỉ được sử dụng phía server.
- Admin session sử dụng cookie có thuộc tính HttpOnly và SameSite; ở môi trường HTTPS/Production cookie được cấu hình Secure.
- Session quản trị được lưu/đối chiếu với database khi Supabase được cấu hình.
- API server kiểm tra dữ liệu đầu vào trước khi xử lý.
- Không commit file môi trường chứa secret.
- Không đưa thông tin cá nhân hoặc dữ liệu Lead thật vào ảnh/video minh chứng công khai.

Đội dự thi cần tự rà soát chính sách RLS, quyền truy cập từng endpoint và cách xử lý dữ liệu cá nhân trên môi trường triển khai trước khi bàn giao.

---

## 14. Hướng dẫn demo và bàn giao dự thi

Theo hướng dẫn nộp bài Bảng A, bộ hồ sơ nên bao gồm:

- **Demo online:** đường dẫn HTTPS của sản phẩm.
- **Source ZIP:** source code đầy đủ kèm README.
- **Video demo:** tối đa 02 phút, thể hiện thao tác thực tế và đủ 05 tính năng theo đề.
- **Minh chứng AI:** tối đa 01 trang, kèm tối đa 05 ảnh/đoạn hội thoại.
- **Kiểm thử:** tối thiểu 06 ca, gồm 02 bình thường, 02 đầu vào không hợp lệ và 02 biên/sự cố.

### Gợi ý kịch bản video tối đa 02 phút

| Thời lượng | Nội dung |
|---|---|
| 0:00–0:15 | Giới thiệu QuizVibe AI và mục tiêu sản phẩm |
| 0:15–0:40 | Tạo chiến dịch, nhập chủ đề và tạo quiz bằng AI |
| 0:40–1:05 | Người chơi tham gia, trả lời câu hỏi và timer 30 giây |
| 1:05–1:25 | Hiển thị kết quả và form thu thập Lead |
| 1:25–1:40 | Bảng xếp hạng Top 10 |
| 1:40–1:55 | Chia sẻ kết quả |
| 1:55–2:00 | Kết thúc, hiển thị URL demo |

Chỉ quay các luồng đã được đội kiểm tra thành công. Không dùng dữ liệu cá nhân thật khi quay video.

---

## 15. Nguồn tham khảo

- Repository: https://github.com/quanbt4567/QuizVibe-AI
- Demo: https://quiz-vibe-ai.vercel.app/
- React: https://react.dev/
- Vite: https://vite.dev/
- TypeScript: https://www.typescriptlang.org/
- Supabase: https://supabase.com/docs
- Vercel: https://vercel.com/docs
- Google AI for Developers: https://ai.google.dev/
- Groq: https://console.groq.com/docs
- Cerebras: https://inference-docs.cerebras.ai/

---

**Thông tin cần đội dự thi cập nhật trước khi nộp:** kết quả build/test thực tế, provider/model AI đang hoạt động, các ca kiểm thử đã chạy, liên kết Source ZIP, liên kết video demo và minh chứng AI. README không thay thế cho việc nghiệm thu sản phẩm.
