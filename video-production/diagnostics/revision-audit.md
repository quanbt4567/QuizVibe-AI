# BÁO CÁO AUDIT ĐỒNG BỘ VIDEO DEMO QUIZVIBE AI (BẢN GỐC V1)

**Dự án**: QuizVibe AI — Minigame Quiz Thu Lead Fanpage Thông Minh  
**Mục tiêu**: Đánh giá toàn diện sự đồng bộ giữa Kịch bản, Hình ảnh thực tế, AI Voiceover, Subtitle và Timeline dựng phim.  
**Video nguồn kiểm tra**: `video-production/output/quizvibe-ai-demo-final.mp4` (Thời lượng 79.30s, 1920x1080 @ 60 FPS).  
**Ngày audit**: 08/11/2026.

---

## 1. TỔNG HỢP VẤN ĐỀ CỐT LÕI PHÁT HIỆN

Qua rà soát từng khung hình, waveform âm thanh và tệp phụ đề ASS:

1. **Âm thanh bị ép tốc độ bất thường (Sped-up Voiceover)**:
   - Do thời lượng ghi hình một số cảnh quá ngắn (Scene 7 chỉ 5.4s, Scene 8 chỉ 6.1s, Scene 1 chỉ 4.0s), script `master_production.py` đã dùng bộ lọc `atempo=1.20` đến `atempo=1.35` để ép giọng đọc.
   - Hậu quả: Giọng đọc gTTS vốn đã có ngữ điệu đều nay bị dồn chữ, mất tự nhiên, nuốt âm cuối, tạo cảm giác người đọc đang cố chạy đua với khung hình.
2. **Âm thanh bị đè lên nhau (Voiceover Overlap)**:
   - Tại `0:00:04.00`, Scene 1 (`opening-hold`) dù đã hết 4 giây hình ảnh tĩnh nhưng giọng đọc (thời lượng gốc 8.16s, sau khi tăng tốc vẫn dài ~6.04s) vẫn đang tiếp tục đọc đến `0:00:06.04`.
   - Trong khi đó, Scene 2 (`landing-overview`) bắt đầu đọc ngay tại `0:00:04.00`.
   - Kết quả: Từ giây 04 đến giây 06 có **2 giọng đọc nói đè lên nhau** đồng thời!
3. **Phụ đề không khớp với lời thoại**:
   - Tệp phụ đề `quizvibe-ai-silent.ass` hiển thị tiêu đề tóm tắt dạng khẩu hiệu (lấy từ trường `caption.text` trong `storyboard.json`), trong khi Voiceover đọc câu văn hoàn chỉnh khác biệt hoàn toàn về từ ngữ.
4. **Bố cục khung hình chưa tối ưu độ rõ nét**:
   - Giao diện Quiz Gameplay trên màn hình 1920x1080 là layout trung tâm dạng cột dọc (`max-w-xl`), chiếm khoảng 500px giữa màn hình, để lại hai dải đen lớn hai bên (~700px mỗi bên), khiến chữ câu hỏi và nút đáp án bị nhỏ khi xem trên màn hình thông thường.
   - Giao diện Admin Studio (`/admin` và `/admin/campaigns`) chưa có camera zoom/crop tập trung vào khu vực thao tác chính (bảng danh sách và nút điều hướng).
5. **Thao tác then chốt diễn ra quá nhanh**:
   - Scene 7 (Thu thập Lead & Nhận Voucher): Chỉ diễn ra trong 5.4s cho toàn bộ các bước (điền tên, điền số điện thoại, nhấn nhận voucher, mở thẻ quà tặng). Người xem chưa kịp định hình form lead thì đã biến mất sang Leaderboard.
   - Scene 8 (Leaderboard Top 10): Mở modal và đóng chỉ trong 6.1s, không đủ thời gian để quan sát danh sách top 10 và số điện thoại ẩn danh.

---

## 2. BẢNG CHI TIẾT AUDIT TỪNG PHÂN ĐOẠN

| Timecode | Hình ảnh thực tế | Lời thoại đã phát | Vấn đề phát hiện | Cách sửa chi tiết |
| :--- | :--- | :--- | :--- | :--- |
| **0:00 - 0:04** (Scene 1) | Khung hình tĩnh nhận diện thương hiệu QuizVibe AI trên Landing Page. | *"Chào mừng bạn đến với QuizVibe AI, nền tảng minigame trắc nghiệm thu hút khách hàng tiềm năng cho Fanpage."* | Giọng đọc gốc 8.16s bị ép tốc độ 1.35x vẫn kéo dài 6.04s, tràn sang Scene 2 và đè lên giọng Scene 2 trong 2.04 giây. | Viết lại câu mở đầu cô đọng, tự nhiên; tăng thời lượng cảnh lên **5.0 giây**, dùng Edge TTS neural tiếng Việt tự nhiên tốc độ 1.0x, ngắt nghỉ rõ ràng. |
| **0:04 - 0:13.5** (Scene 2) | Trang Landing chiến dịch "Ẩm thực Hà Nội", cuộn xem thẻ voucher rồi cuộn lên. | *"Tại trang minigame, người chơi khám phá thử thách ẩm thực, đếm ngược ba mươi giây và nhận ngay voucher ưu đãi."* | Bắt đầu bị đè bởi đuôi câu Scene 1. Phụ đề hiển thị khẩu hiệu chung chung chứ không khớp lời thoại. | Tách biệt điểm dừng của Scene 1 trước khi bắt đầu Scene 2; đồng bộ phụ đề verbatim theo lời đọc; giữ thời lượng **10 - 11 giây**. |
| **0:13.5 - 0:21.5** (Scene 3) | Trang đăng nhập Admin -> nhập password -> vào Admin Dashboard -> chuyển sang danh sách chiến dịch. | *"Khu vực Admin Studio bảo mật cao, giúp theo dõi tổng quan các chiến dịch và khách hàng tham gia."* | Chuyển trang quá nhanh (login 1.5s, dashboard 2.5s, list 4.0s). Bảng điều khiển bị xa, chữ nhỏ trên 1080p. | Tăng thời lượng cảnh lên **12 - 14 giây**; áp dụng camera zoom nhẹ (1.15x - 1.2x) vào khu vực bảng điều khiển và danh sách chiến dịch; lời thoại nhấn mạnh tính quản trị tập trung. |
| **0:21.5 - 0:34.0** (Scene 4) | Nhập chủ đề "Đặc sản Ẩm thực..." -> bấm Tạo AI -> Review Gate hiện ra -> cuộn xem câu hỏi. | *"Trí tuệ nhân tạo tự động biên soạn năm câu hỏi trắc nghiệm, kèm Cổng kiểm duyệt nội dung trực quan trước khi kích hoạt."* | Lời thoại chưa làm rõ tính chất Mock AI trong môi trường thử nghiệm; thao tác cuộn trên Review Gate hơi vội, chưa dừng lại ở một câu hỏi cụ thể để người xem đọc nội dung. | Viết lại lời thoại minh bạch về Mock AI Demo; tăng thời gian dừng trên Cổng kiểm duyệt (Review Gate) lên **16 - 18 giây** để người xem thấy rõ tính năng biên tập trước khi xuất bản. |
| **0:34.0 - 0:48.1** (Scene 5) | Bấm bắt đầu chơi -> trả lời liên tiếp 5 câu hỏi ẩm thực với đồng hồ 30s. | *"Người chơi trả lời năm câu hỏi với đồng hồ đếm ngược ba mươi giây, nhận thêm điểm thưởng phản xạ tốc độ."* | Giao diện dọc chiếm 30% chiều ngang màn hình, hai bên tối đen; bấm chọn đáp án quá nhanh (mỗi câu ~2.5s), chưa kịp nhìn đồng hồ đếm ngược chạy. | Áp dụng camera crop/zoom trung tâm (1.3x) tập trung vào giao diện quiz; tăng thời lượng mỗi câu hỏi lên 3.5 - 4.0s (tổng cảnh **18 - 20 giây**); làm nổi bật đồng hồ đếm ngược và hiệu ứng cộng điểm tốc độ. |
| **0:48.1 - 0:58.2** (Scene 6) | Màn hình kết quả tổng điểm -> click mở accordion câu 1 xem giải thích chi tiết. | *"Màn hình kết quả hiển thị tổng điểm minh bạch và mở rộng xem giải thích chi tiết kiến thức từng câu."* | Accordion mở ra nhưng lướt qua quá nhanh; điểm số tổng chưa được highlight đủ lâu. | Kéo dài thời gian hiển thị điểm và giải thích văn hóa lên **10 giây**; camera zoom nhẹ vào ô điểm số và nội dung giải thích. |
| **0:58.2 - 1:03.6** (Scene 7) | Điền form Lead (Họ tên, SĐT) -> bấm nhận voucher -> thẻ voucher AMTHUC50K xuất hiện. | *"Nhập họ tên và số điện thoại để mở khóa ngay thẻ voucher ưu đãi độc quyền."* | Toàn bộ quy trình chỉ có 5.4 giây, giọng đọc bị ép 1.26x. Đây là tính năng cốt lõi thu Lead nhưng lại trôi qua nhanh nhất! | Kéo dài cảnh lên **9.0 - 10.0 giây**; thể hiện rõ thao tác điền form -> click nhận -> voucher bung ra rực rỡ; lời thoại nhấn mạnh cơ chế thu Lead chống trùng lặp số điện thoại. |
| **1:03.6 - 1:09.7** (Scene 8) | Click xem Bảng Xếp Hạng -> Modal Top 10 hiện lên -> đóng modal. | *"Bảng xếp hạng Top mười vinh danh người chơi xuất sắc nhất theo thời gian thực với bảo mật số điện thoại."* | Modal mở ra rồi đóng lại chỉ trong 6 giây, giọng đọc bị tăng tốc 1.33x dồn dập, người xem chưa kịp đọc thứ hạng #1 hay số điện thoại ẩn danh. | Giữ modal mở trong 6.5s (tổng cảnh **8 - 9 giây**); zoom nhẹ vào top 3 và số điện thoại ẩn danh `096***4433`; giọng đọc thong thả, rõ ràng. |
| **1:09.7 - 1:15.4** (Scene 9) | Bấm "Chia sẻ lên Facebook" -> bấm "Sao chép mã". | *"Dễ dàng chia sẻ kết quả lên Facebook và sao chép mã voucher ưu đãi."* | Chỉ có 5.6 giây, nút sao chép vừa đổi thành "Đã sao chép!" thì chuyển cảnh ngay lập tức. | Tăng thời lượng lên **7.0 - 8.0 giây**; giữ trạng thái "Đã sao chép!" và popup chia sẻ Facebook rõ ràng; lời dẫn giải thích giá trị lan tỏa tự nhiên cho Fanpage. |
| **1:15.4 - 1:19.3** (Scene 10) | Giữ khung hình kết thúc với thông điệp và logo. | *"QuizVibe AI: Đột phá tương tác, bứt phá chuyển đổi cho Fanpage!"* | Chỉ có 3.9 giây, giọng đọc bị tăng tốc 1.35x. Chưa có thông tin URL và lời kết thúc chuyên nghiệp. | Kéo dài khung hình kết thúc lên **5.0 giây**; lời dẫn tự nhiên, truyền cảm hứng, nêu bật thông điệp giá trị cốt lõi của QuizVibe AI. |

---

## 3. KẾ HOẠCH HÀNH ĐỘNG CẢI TIẾN TOÀN DIỆN

1. **Giai đoạn 2 (Viết lại kịch bản)**: Soạn thảo `narration-revised.txt` với phong văn công nghệ hiện đại, tự nhiên, tập trung vào hành trình thu Lead Fanpage, phân bố nhịp thở và câu từ vừa vặn từng khung cảnh.
2. **Giai đoạn 3 (Đồng bộ Voiceover)**: Sử dụng giọng đọc Neural tiếng Việt cao cấp (`vi-VN-NamMinhNeural` / `vi-VN-HoaiMyNeural` từ Edge TTS) với tốc độ chuẩn 1.0x, tuyệt đối không dùng bộ lọc `atempo` ép tốc độ.
3. **Giai đoạn 4 (Ghi hình & Storyboard)**: Điều chỉnh `recording-plan.json` tăng thời gian dừng tại các thao tác quan trọng (Lead, Voucher, Leaderboard, Gameplay) với tổng thời lượng chuẩn ~85 - 95 giây; thiết lập camera framing (zoom/crop) để các thành phần dọc và bảng quản trị hiển thị lớn và sắc nét.
4. **Giai đoạn 5 (Subtitle chuẩn xác)**: Tạo phụ đề ASS đồng bộ verbatim 100% với từng câu thoại, 1 - 2 dòng gọn gàng, viền nét mềm rạp phim.
5. **Giai đoạn 6 (Dựng và kiểm thử)**: Render `quizvibe-ai-demo-revised.mp4` và chạy kiểm định đa tiêu chí, bảo đảm chất lượng xuất sắc phục vụ cuộc thi.

