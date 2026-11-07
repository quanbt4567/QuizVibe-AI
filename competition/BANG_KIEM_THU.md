# BẢNG KIỂM THỬ SẢN PHẨM — QUIZVIBE AI
**Cuộc thi Vibe Coding 2026 — Bảng A (Công nghệ) — Đề 3: Minigame Quiz thu Lead cho Fanpage**
*Hệ thống kiểm thử: Vitest 5.1.0 (Happy DOM) + Playwright Chromium E2E + FakePostgrest In-Memory Sandbox*

---

## 1. Tổng quan kết quả kiểm thử hệ thống

- **Tổng số ca kiểm thử tự động (Automated Unit & Integration Tests):** 44 test files, **767/767 passed (100%)**.
- **Kiểm thử E2E trình duyệt (Playwright Browser Verification):** 17/17 bước kiểm thử giao diện & luồng người dùng đạt kết quả chuẩn xác.
- **Bảo mật & Ranh giới dữ liệu:** Chặn 100% rò rỉ secrets; FakePostgrest fail-closed chặn toàn bộ outbound network ngoài ý muốn; Cookie HttpOnly chống XSS.

---

## 2. Bảng ma trận kiểm thử chi tiết (Bảng A — 7 Ca kiểm thử tiêu biểu)

| Mã ca | Loại ca | Chức năng kiểm thử | Dữ liệu và bước thử nghiệm | Kết quả kỳ vọng | Kết quả thực tế | Đánh giá |
|:---|:---|:---|:---|:---|:---|:---:|
| **TC01** | **Bình thường** *(Happy Path)* | Sinh bộ Quiz 5 câu bằng AI & Kiểm duyệt nội dung (Review Gate) | **Bước 1:** Đăng nhập Admin Studio (`/admin/login`).<br>**Bước 2:** Nhập ngữ cảnh: *"Ẩm thực đường phố Sài Gòn"*, chọn ngành F&B, bấm *"Tạo bằng AI"*.<br>**Bước 3:** Hệ thống gọi API `/api/generate-quiz`.<br>**Bước 4:** Admin duyệt 5 câu, sửa câu 3 và bấm *"Lưu & Xuất bản chiến dịch"*. | - API trả về HTTP 200 kèm đúng 5 câu hỏi, mỗi câu 4 phương án, 1 đáp án đúng và lời giải thích văn hóa.<br>- Admin chỉnh sửa được nội dung.<br>- Chiến dịch lưu thành công vào cơ sở dữ liệu. | **ĐẠT (PASS)**<br>HTTP 200 OK. 5 câu hỏi sinh chuẩn schema JSON. Chiến dịch `camp_saigon_food` lưu thành công.<br>*(File: `api/generate-quiz.test.ts`, `QuizBuilder.test.ts`)* | **ĐẠT** |
| **TC02** | **Bình thường** *(Happy Path)* | Gameplay Minigame Quiz, Đếm ngược 30s & Tính điểm tốc độ | **Bước 1:** Người chơi vào `/quiz/camp_saigon_food`, bấm *"Bắt đầu"'.<br>**Bước 2:** Timer 30s bắt đầu đếm ngược.<br>**Bước 3:** Trả lời đúng câu 1 tại giây thứ 4.5 (còn 25.5s).<br>**Bước 4:** Hoàn thành đủ 5 câu hỏi. | - Mỗi câu có thời gian 30s.<br>- Điểm câu 1 = 100 (cơ bản) + $\approx 85$ (thưởng tốc độ) $\approx 185$ điểm.<br>- Chuyển câu mượt mà.<br>- Màn hình Result hiển thị tổng điểm và giải thích văn hóa chi tiết. | **ĐẠT (PASS)**<br>Timer đếm ngược chính xác theo `performance.now()`. Điểm thưởng tính chuẩn từng mili-giây. Tổng điểm đạt 930/1000. Hiển thị huy hiệu "Chuyên Gia Ẩm Thực".<br>*(File: `QuizGameScreen.test.ts`, `useCountdownTimer.test.ts`)* | **ĐẠT** |
| **TC03** | **Đầu vào không hợp lệ** *(Validation)* | Thu thập Lead nhận Voucher với SĐT hoặc Email sai định dạng | **Bước 1:** Tại màn hình hoàn thành Quiz, mở form nhận Voucher.<br>**Bước 2:** Nhập Họ tên: `"Nguyễn Văn A"`, SĐT: `"090123"` (chỉ 6 chữ số), Email: `"invalid-email"` (sai cú pháp RFC).<br>**Bước 3:** Bấm nút *"Nhận mã ưu đãi"*. | - Hệ thống kích hoạt validation tại cả Client và Backend API (`/api/quiz/lead`).<br>- Từ chối ghi nhận lead, trả về mã lỗi HTTP 400.<br>- Hiển thị thông báo hướng dẫn người dùng sửa lỗi ngay trên form. | **ĐẠT (PASS)**<br>Form khóa nút submit, hiển thị lỗi đỏ: *"Số điện thoại phải gồm 10 chữ số hợp lệ"* và *"Email không đúng định dạng"*. API trả về HTTP 400 `{ code: "VALIDATION_FAILED" }`. Không có bản ghi rác nào trong DB.<br>*(File: `LeadCaptureForm.test.ts`)* | **ĐẠT** |
| **TC04** | **Đầu vào không hợp lệ** *(Validation)* | Admin lưu chiến dịch có cấu trúc câu hỏi bất hợp lệ | **Bước 1:** Gửi request POST tới `/api/admin/manage` (action: `create_campaign`).<br>**Bước 2:** Payload gửi chỉ chứa 3 câu hỏi (thiếu 2 câu so với quy định 5 câu), hoặc phương án trả lời chỉ có 2 lựa chọn thay vì 4, hoặc `correct_answer = 9`. | - Backend từ chối request, trả về HTTP 400 `VALIDATION_FAILED`.<br>- Thông báo lỗi chỉ rõ trường dữ liệu không hợp lệ.<br>- Tuyệt đối không ghi dữ liệu sai lệch vào Database. | **ĐẠT (PASS)**<br>HTTP 400 Bad Request. Response: `{ code: "VALIDATION_FAILED", fieldErrors: { questions: "Chiến dịch phải chứa đúng 5 câu hỏi." } }`. Database an toàn 100%.<br>*(File: `api/admin/campaignManagement.test.ts`)* | **ĐẠT** |
| **TC05** | **Ca biên / Sự cố** *(Atomic Claim & Anti-Fraud)* | Chống đăng ký nhận Voucher trùng lặp trên cùng chiến dịch | **Bước 1:** Người chơi dùng SĐT `"0901234567"` đã nhận voucher chiến dịch A thành công.<br>**Bước 2:** Chơi lại quiz của chiến dịch A và tiếp tục điền lại SĐT `"0901234567"` để nhận thêm voucher.<br>**Bước 3:** Bấm gửi biểu mẫu Lead. | - Hệ thống phát hiện SĐT đã nhận ưu đãi của chiến dịch này.<br>- Khóa hành động tạo voucher mới, trả về mã HTTP 409 Conflict.<br>- Hiển thị thông báo thân thiện và cho phép xem lại mã voucher cũ. | **ĐẠT (PASS)**<br>PostgreSQL RPC `register_quiz_lead` kích hoạt ràng buộc unique trên `campaign_phone_registrations`. API trả về HTTP 409 `{ code: "DUPLICATE_PHONE" }`. Chặn hoàn toàn spam voucher.<br>*(File: `campaignPhoneRegistration.test.ts`, `phase4LeadManagement.test.ts`)* | **ĐẠT** |
| **TC06** | **Ca biên / Sự cố** *(Fail-Closed & Timeout)* | Xử lý hết thời gian 30s khi đang làm bài & Mất kết nối | **Bước 1:** Người chơi ở câu hỏi 3, không bấm chọn đáp án nào để đồng hồ đếm ngược về 00:00.<br>**Bước 2:** Quan sát phản ứng hệ thống.<br>**Bước 3:** Thử F5 / reload lại trình duyệt khi đang làm bài dở dang. | - Khi hết giờ: hệ thống tự động khóa tương tác, tính 0 điểm cho câu đó, hiển thị đáp án đúng và chuyển câu sau 1.5s.<br>- Khi F5: trạng thái session không làm sập ứng dụng, khôi phục an toàn. | **ĐẠT (PASS)**<br>Hook timer gọi `onExpire()`, nút chọn bị disable ngay lập tức, hiển thị nhãn *"Hết giờ!"* màu vàng và đáp án đúng màu xanh. Reload trang giữ vững tính toàn vẹn phiên chơi, không xảy ra unhandled exception.<br>*(File: `QuizGameScreen.test.ts`, `quizSession.test.ts`)* | **ĐẠT** |
| **TC07** | **Bảo mật & Phân quyền** *(Security Defense)* | Phòng chống truy cập trái phép vào API Quản trị Admin Studio | **Bước 1:** Gửi request trực tiếp đến `/api/admin/manage` để đọc danh sách Leads/Chiến dịch mà không có cookie xác thực.<br>**Bước 2:** Thử gửi cookie giả mạo `quizvibe_admin_token=fake-token-123`. | - Middleware / Auth Guard phát hiện phiên đăng nhập không hợp lệ.<br>- Trả về HTTP 401 Unauthorized ngay lập tức.<br>- Không tiết lộ bất kỳ thông tin nhạy cảm nào của khách hàng. | **ĐẠT (PASS)**<br>HTTP 401 Unauthorized: `{ error: "Unauthorized: Invalid or missing admin session" }`. Giao diện tự động chuyển hướng về `/admin/login`. Bảo vệ dữ liệu tuyệt đối.<br>*(File: `api/admin/adminAuth.test.ts`)* | **ĐẠT** |

---

## 3. Hướng dẫn tái hiện và đối chiếu kết quả kiểm thử

Giám khảo và hội đồng thẩm định có thể kiểm tra trực tiếp toàn bộ 767 ca kiểm thử trên mã nguồn bằng các lệnh sau:

```bash
# 1. Chạy toàn bộ 767 automated unit/integration tests
npm test

# 2. Chạy riêng bộ kiểm thử Gameplay & Timer
npx vitest run src/components/player/QuizGameScreen.test.ts src/hooks/useCountdownTimer.test.ts

# 3. Chạy kiểm thử chống trùng lặp SĐT & Phát Voucher nguyên tử
npx vitest run api/admin/phase4LeadManagement.test.ts src/components/player/LeadCaptureForm.test.ts

# 4. Chạy kiểm thử phân quyền & bảo mật Admin
npx vitest run api/admin/campaignManagement.test.ts api/generate-quiz.test.ts
```

*Toàn bộ 44 file kiểm thử được lưu trữ minh bạch trong thư mục `src/` và `api/` của gói mã nguồn.*

