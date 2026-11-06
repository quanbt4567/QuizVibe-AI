# BÁO CÁO PHÂN TÍCH YÊU CẦU CUỘC THI VIBE CODING 2026
**Bảng thi**: Bảng A – Công nghệ | **Đề tài**: Đề số 3 – Minigame quiz thu lead cho fanpage  
**Đội thi**: Superstar K22 | **Dự án**: QuizVibe AI  
**Ngày lập**: 02/11/2026  

---

## 1. NGUỒN TÀI LIỆU VÀ CĂN CỨ KIỂM TRA

Toàn bộ các tài liệu trong thư mục `competition/` đã được đọc và phân tích chi tiết:
1. `competition/official-brief.png` (Hình ảnh công bố chính thức Đề số 3 từ Ban Tổ Chức).
2. `competition/topic-3.png` (Giao diện portal bốc thăm đề của đội Superstar K22 - Bảng Công nghệ).
3. `competition/scoring-rubric.png` (Quy chế, thang điểm chi tiết Bảng A/B và nguyên tắc chấm thi vòng loại).
4. `competition/submission-requirements.png` (Hướng dẫn nộp bài, thời hạn, điều kiện bảng Công nghệ và quy định Mock).
5. `competition/README.md` (Mẫu README chuẩn bàn giao vòng loại).

---

## 2. 05 TÍNH NĂNG BẮT BUỘC CỦA SẢN PHẨM (ĐỀ SỐ 3)

*Căn cứ trích xuất*: `competition/topic-3.png` & `competition/official-brief.png`.

| STT | Tính năng bắt buộc | Chi tiết yêu cầu kỹ thuật & nghiệp vụ | Ghi chú thiết kế cho QuizVibe AI |
| :--- | :--- | :--- | :--- |
| **F1** | **Trang tạo quiz** | - Nhập thủ công 05 câu hỏi trắc nghiệm (mỗi câu đúng 04 đáp án, đánh dấu đáp án đúng).<br>- Hoặc nhờ **AI gợi ý 05 câu hỏi** theo chủ đề cho trước. | Cung cấp 2 tab/chế độ: Nhập tay (Form Builder) và AI Generator (Prompt/Topic selector). |
| **F2** | **Trang chơi quiz** | - Hiển thị lần lượt từng câu hỏi trong bộ 05 câu.<br>- Bộ đếm ngược **30 giây** cho mỗi câu hỏi.<br>- Cơ chế tính điểm: kết hợp giữa **đáp án đúng** và **tốc độ trả lời** (trả lời càng nhanh điểm càng cao). | Giao diện tập trung, hiệu ứng âm thanh/đồng hồ trực quan, thanh tiến trình câu hỏi (1/5 -> 5/5). |
| **F3** | **Màn hình kết quả & Form thu Lead** | - Hiển thị tổng điểm và thống kê số câu đúng/sai/thời gian.<br>- Form thu thập thông tin người chơi: **Họ tên** và **Số điện thoại** để nhận quà.<br>- Lưu trữ dữ liệu: Lưu vào `localStorage` trình duyệt. | Validation định dạng số điện thoại VN (10 chữ số). Ngăn chặn submit trùng hoặc spam. |
| **F4** | **Bảng xếp hạng (Leaderboard)** | - Hiển thị danh sách **Top 10 người chơi có điểm cao nhất**.<br>- Sắp xếp theo: Điểm số giảm dần, thời gian hoàn thành (ưu tiên tốc độ nếu bằng điểm). | Cập nhật real-time ngay sau khi người chơi nộp form thu lead. |
| **F5** | **Chia sẻ kết quả lên Facebook** | - Nút chia sẻ kết quả với tính năng: **Copy nội dung soạn sẵn** (kèm điểm, danh hiệu, link quiz) để người chơi dễ dàng dán đăng lên Facebook.<br>- Hỗ trợ Web Share API trên mobile nếu khả dụng. | Soạn sẵn template content viral, kèm hashtag bắt mắt và icon sinh động. |

---

## 3. THANG ĐIỂM BẢNG A – CÔNG NGHỆ (TỔNG 100 ĐIỂM)

*Căn cứ trích xuất*: `competition/scoring-rubric.png` (Mục 1 & Mục 4).

| Tiêu chí | Điểm tối đa | Trọng số | Yêu cầu thể hiện của đội thi |
| :--- | :---: | :---: | :--- |
| **A1. Hoàn thành chức năng & độ đúng nghiệp vụ** | **25 điểm** | 25% | Hoàn thành đủ cả 5 tính năng bắt buộc; luồng trải nghiệm mượt mà, thông suốt từ tạo quiz -> chơi -> nộp lead -> BXH -> chia sẻ; kết quả tính điểm đúng nghiệp vụ. |
| **A2. Thiết kế kỹ thuật & chất lượng mã nguồn** | **20 điểm** | 20% | Code có cấu trúc rõ ràng, module hóa tốt; quản lý state và dữ liệu nhất quán; kiểm soát an toàn cơ bản (XSS, validation); lựa chọn tech stack hiện đại, gọn gàng, hiệu quả. |
| **A3. Tích hợp AI & kiểm soát đầu ra** | **15 điểm** | 15% | AI phù hợp với ngữ cảnh đầu vào (prompting chuẩn); tích hợp luồng gọi API và parse kết quả rõ ràng (JSON schema); có xử lý fallback chống lỗi. *(Lưu ý giới hạn điểm Mock bên dưới).* |
| **A4. Kiểm thử độ ổn định & xử lý lỗi** | **15 điểm** | 15% | Có cơ chế validation chặt chẽ, chặn dữ liệu sai (form lead, quiz input); xử lý ngoại lệ và sự cố mạng/AI timeout mượt mà; lập bảng kiểm thử tối thiểu 6 ca theo chuẩn. |
| **A5. Làm chủ Vibe Coding & phản biện kỹ thuật** | **15 điểm** | 15% | Có tài liệu minh chứng quá trình cộng tác với AI; trả lời phản biện tự tin trong 5 phút vấn đáp; giải thích sâu sắc về kiến trúc, quyết định kỹ thuật và mã nguồn. |
| **A6. Giao diện & trải nghiệm người dùng (UI/UX)** | **5 điểm** | 5% | Giao diện hiện đại, trực quan, dễ thao tác, typography chuẩn; tối ưu responsive 100% trên thiết bị di động (mobile-friendly). |
| **A7. Triển khai & bàn giao** | **5 điểm** | 5% | Có đường dẫn demo online đang hoạt động ổn định; mã nguồn sạch trong ZIP; hướng dẫn chạy local rõ ràng; video demo đúng yêu cầu. |

---

## 4. QUY ĐỊNH TÍCH HỢP AI & GIỚI HẠN ĐIỂM MOCK

*Căn cứ trích xuất*: `competition/scoring-rubric.png` (Mục 1, Mục 2) & `competition/README.md` (Mục 4).

1. **Giới hạn điểm Mock tại Bảng A (Rất quan trọng)**:
   * **Quy định BTC**: Bảng A đánh giá năng lực công nghệ thực thụ. Nếu đội thi **chỉ dùng Mock Data**, tiêu chí A3 (Tích hợp AI) chỉ đạt **tối đa 4/15 điểm** (bị mất 11/15 điểm trực tiếp).
   * **Bắt buộc nếu dùng Mock**: Trên giao diện phải hiển thị thông báo rõ ràng: *"Bản demo vòng loại - Dữ liệu mô phỏng AI"*.
   * **Chiến lược cho QuizVibe AI**: Để tối đa hóa điểm số (đạt 15/15 ở mục A3), dự án **phải tích hợp API thật** (Google Gemini API / OpenAI API) qua kiến trúc Serverless/Proxy an toàn, đồng thời xây dựng chế độ Mock Fallback thông minh khi mất mạng hoặc hết quota API.

2. **Kiểm soát đầu ra AI (AI Output Control)**:
   * Prompting kỹ thuật số (System Prompting + Structured Outputs/JSON Mode) để ép AI sinh đúng định dạng 5 câu hỏi trắc nghiệm, mỗi câu 4 đáp án và vị trí đáp án đúng.
   * Xử lý lỗi parse JSON, tự động retry hoặc validate dữ liệu trước khi nạp vào bộ quiz.

3. **Bảo mật khóa API (API Key Security)**:
   * Tuyệt đối **không commit file `.env`** chứa API Key thật lên repository/ZIP.
   * Không để API key lộ ở mã nguồn phía client (trình duyệt).
   * Sử dụng biến môi trường và cung cấp file `.env.example` với hướng dẫn cấu hình chi tiết trong README.

---

## 5. YÊU CẦU VỀ KIỂM THỬ (TESTING)

*Căn cứ trích xuất*: `competition/scoring-rubric.png` (Mục 1, Mục 3) & `competition/README.md` (Mục 11).

* **Số lượng ca kiểm thử**: Tối thiểu **06 test cases** (bắt buộc cho Bảng A).
* **Phân bổ loại ca thử nghiệm**:
  1. **02 ca bình thường (Normal / Happy Path)**:
     - Tạo quiz thành công với 5 câu hỏi hợp lệ (thủ công hoặc bằng AI).
     - Người chơi hoàn thành 5 câu, ghi nhận điểm và nộp lead thành công vào Top 10.
  2. **02 ca đầu vào không hợp lệ (Invalid Inputs)**:
     - Người chơi nhập số điện thoại sai định dạng (chứa chữ, thiếu số, quá 11 số) -> Hệ thống phải chặn và báo lỗi rõ ràng.
     - Tạo quiz thủ công thiếu trường, thiếu câu trả lời hoặc không chọn đáp án đúng -> Bị chặn submit.
  3. **02 ca biên / sự cố (Edge Cases & Failure Modes)**:
     - Hết 30 giây thời gian trả lời câu hỏi -> Tự động ghi nhận sai (0 điểm) và chuyển câu tiếp theo.
     - Gọi AI tạo quiz khi mất kết nối mạng hoặc API key hết hạn -> Hệ thống báo lỗi thân thiện hoặc kích hoạt cơ chế fallback dữ liệu mẫu kèm thông báo minh bạch.
* **Hình thức**: Chấp nhận kiểm thử thủ công; lập bảng Test Matrix gồm: `Mã ca | Loại ca | Dữ liệu & bước thử | Kết quả kỳ vọng | Kết quả thực tế | Đạt/Chưa đạt`.

---

## 6. YÊU CẦU VIDEO DEMO & BÀN GIAO NỘP BÀI

*Căn cứ trích xuất*: `competition/submission-requirements.png`, `competition/scoring-rubric.png` & `competition/README.md`.

* **Thời gian cổng nộp bài**:
  * **Mở cổng**: 00:00 ngày 09/11/2026 (Giờ Việt Nam).
  * **Đóng cổng**: 23:59 ngày 09/11/2026 (Giờ Việt Nam).
  * **Nguyên tắc**: Bài nộp trước hạn là căn cứ chấm điểm duy nhất; không được sửa tính năng sau hạn nộp.
* **Video Demo**:
  * Thời lượng: **Tối đa 02 phút** (<= 120 giây).
  * Nội dung: Quay thao tác thực tế trên giao diện, chứng minh đầy đủ **cả 5 tính năng** của Đề số 3.
* **Hồ sơ bàn giao (Submission Package)**:
  1. **Source ZIP**: Chứa mã nguồn hoàn chỉnh, sạch, kèm file `README.md` theo template chuẩn của BTC; chỉ đính kèm file cấu hình mẫu (`.env.example`), không chứa key bí mật.
  2. **Link Demo Online**: Deploy trên nền tảng ổn định (Vercel / Netlify / GitHub Pages). Có điểm riêng trong thang chấm Bảng A.
  3. **Tài liệu Minh chứng dùng AI**: Tối đa 1 trang, tối đa 5 hình ảnh hoặc đoạn prompt chọn lọc, thể hiện quy trình Vibe Coding: `Mục tiêu` → `Yêu cầu cho AI` → `Vấn đề phát hiện khi thử` → `Yêu cầu AI sửa` → `Kết quả kiểm tra lại`.
  4. **Bảng kiểm thử (Test Matrix)**: Tối thiểu 6 ca kiểm thử kèm kết quả thực nghiệm.
* **Vòng vấn đáp (Q&A)**:
  * Thời lượng: **05 phút hỏi đáp trực tiếp** với hội đồng giám khảo.
  * Trọng tâm Bảng A: Giải thích cấu trúc code, bảo mật dữ liệu, nguyên lý tích hợp AI và làm chủ giải pháp.

---

## 7. RÀNG BUỘC KỸ THUẬT VÀ BẢO MẬT

*Căn cứ trích xuất*: `competition/README.md` & `competition/scoring-rubric.png`.

1. **Lưu trữ dữ liệu**:
   - Sử dụng `localStorage` trên trình duyệt để lưu: danh sách quiz đã tạo, dữ liệu lead khách hàng (họ tên, SĐT), bảng xếp hạng top 10.
   - Không bắt buộc backend hay database server thật; không cộng điểm vì đưa thêm backend phức tạp nếu không phục vụ giải quyết bài toán cốt lõi.
2. **Quyền truy cập và quản trị**:
   - Không yêu cầu hệ thống đăng nhập tài khoản phức tạp.
   - Cung cấp nút chuyển đổi linh hoạt ngay trên giao diện giữa:
     - **Màn hình Người chơi / Khách hàng**: Chơi quiz, nộp lead, xem BXH, chia sẻ.
     - **Màn hình Quản trị viên (Admin)**: Quản lý/tạo quiz, xem danh sách lead đã thu thập, xuất dữ liệu hoặc xoá dữ liệu trong `localStorage`.
3. **Responsive Mobile First**:
   - Giao diện phải tương thích hoàn hảo trên màn hình điện thoại di động vì minigame fanpage chủ yếu được người dùng Facebook truy cập từ smartphone.

---

## 8. ĐÁNH GIÁ THÔNG TIN ĐÃ THU THẬP VÀ CÁC ĐIỂM CẦN LƯU Ý

### Các tài liệu đã kiểm tra thành công:
- [x] Đề bài chính thức số 3 và bối cảnh fanpage (`official-brief.png`, `topic-3.png`).
- [x] Thang điểm chi tiết Bảng A (7 tiêu chí, 100 điểm) và Bảng B (`scoring-rubric.png`).
- [x] Quy chế nộp bài, thời hạn 09/11/2026, quy định Mock vs API thật (`submission-requirements.png`).
- [x] Cấu trúc mẫu README bàn giao 12 mục tiêu chuẩn (`competition/README.md`).

### Các thông tin Ban tổ chức để mở / cần xác định nội bộ đội thi:
1. **API Key & Nhà cung cấp AI**: BTC không cấp sẵn API key hay token riêng; các đội tự chọn nhà cung cấp mô hình (khuyến nghị dùng Gemini 1.5 Flash hoặc GPT-4o-mini vì tốc độ cao và chi phí thấp/miễn phí).
2. **Chủ đề Quiz mẫu**: Đề bài yêu cầu AI gợi ý câu hỏi theo "chủ đề cho trước" nhưng không giới hạn cứng danh mục chủ đề -> QuizVibe AI nên cung cấp sẵn một số chủ đề thịnh hành của Fanpage (Công nghệ, Đố vui viral, Marketing, Kiến thức sản phẩm) kèm ô cho phép Fanpage Admin tự nhập chủ đề tuỳ ý.
3. **Cơ chế tính điểm tốc độ**: Đề bài yêu cầu "tính điểm theo đáp án đúng và tốc độ trả lời" với đồng hồ 30 giây -> Cần định nghĩa công thức tính điểm rõ ràng (ví dụ: `Điểm = Điểm_cơ_bản (100) + Điểm_thời_gian_còn_lại (ví dụ 10 điểm/giây còn lại)`).

