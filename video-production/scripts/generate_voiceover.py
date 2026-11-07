"""
QuizVibe AI — Studio Voiceover Generator (Vietnamese Neural TTS)
Generates synchronized voiceover audio for the 10 demo scenes.
"""

import asyncio
import json
import os
import subprocess
from pathlib import Path
import edge_tts

VOICE = "vi-VN-NamMinhNeural"  # Professional Vietnamese male neural voice
# Alternative: "vi-VN-HoaiMyNeural" (Vietnamese female neural voice)

SCENES = [
    {
        "id": "opening-hold",
        "start": 0.0,
        "max_duration": 4.0,
        "text": "Chào mừng bạn đến với QuizVibe AI — nền tảng minigame trắc nghiệm thu hút khách hàng tiềm năng cho Fanpage."
    },
    {
        "id": "landing-overview",
        "start": 4.0,
        "max_duration": 12.0,
        "text": "Tại trang minigame công khai, người chơi dễ dàng nắm bắt tiêu đề chiến dịch ẩm thực, quy định ba mươi giây mỗi câu hỏi cùng cơ hội nhận ngay mã voucher ưu đãi độc quyền."
    },
    {
        "id": "admin-dashboard",
        "start": 16.0,
        "max_duration": 12.0,
        "text": "Khu vực quản trị được bảo vệ an toàn bằng phiên làm việc máy chủ. Bảng điều khiển giúp nhà quản trị theo dõi tổng quan các chiến dịch, tỷ lệ hoàn thành và danh sách khách hàng tham gia."
    },
    {
        "id": "ai-quiz-generation",
        "start": 28.0,
        "max_duration": 20.0,
        "text": "Chỉ cần nhập chủ đề mong muốn, trí tuệ nhân tạo sẽ tự động biên soạn năm câu hỏi trắc nghiệm kèm giải thích chuẩn xác. Trước khi kích hoạt, quản trị viên dễ dàng rà soát qua Cổng kiểm duyệt nội dung, chỉnh sửa phương án và thiết lập mức ưu đãi cho voucher."
    },
    {
        "id": "quiz-gameplay-timer",
        "start": 48.0,
        "max_duration": 24.0,
        "text": "Khi bắt đầu thử thách, người chơi trả lời lần lượt năm câu hỏi với đồng hồ đếm ngược ba mươi giây sinh động. Thuật toán chấm điểm thông minh tính toán dựa trên độ chính xác và thời gian phản xạ, tự động cộng điểm thưởng cho các lượt trả lời nhanh, tạo nên không khí tranh tài kịch tính."
    },
    {
        "id": "result-breakdown",
        "start": 72.0,
        "max_duration": 12.0,
        "text": "Màn hình kết quả hiển thị tổng điểm minh bạch cùng chi tiết từng câu hỏi. Người chơi có thể mở rộng để khám phá những nét văn hóa ẩm thực độc đáo phía sau mỗi đáp án."
    },
    {
        "id": "lead-voucher-claim",
        "start": 84.0,
        "max_duration": 14.0,
        "text": "Người chơi chỉ cần nhập họ tên và số điện thoại để mở khóa ngay thẻ voucher ưu đãi độc quyền. Hệ thống tự động đối soát chống trùng lặp, giúp doanh nghiệp thu thập dữ liệu khách hàng chất lượng cao."
    },
    {
        "id": "leaderboard-top10",
        "start": 98.0,
        "max_duration": 10.0,
        "text": "Bảng xếp hạng Top mười vinh danh những người chơi xuất sắc nhất theo thời gian thực với số điện thoại được ẩn danh bảo mật, kích thích tinh thần đua top sôi nổi."
    },
    {
        "id": "social-sharing",
        "start": 108.0,
        "max_duration": 9.0,
        "text": "Chức năng chia sẻ Facebook và sao chép mã ưu đãi giúp lan tỏa minigame mạnh mẽ, gia tăng tương tác tự nhiên và thu hút thêm hàng ngàn người tham gia mới."
    },
    {
        "id": "closing-summary",
        "start": 117.0,
        "max_duration": 3.0,
        "text": "QuizVibe AI — Đột phá tương tác, bứt phá chuyển đổi cho Fanpage của bạn!"
    }
]

AUDIO_DIR = Path("video-production/project/recordings/audio")
AUDIO_DIR.mkdir(parents=True, exist_ok=True)

def get_duration(file_path: Path) -> float:
    cmd = [
        "ffprobe", "-v", "error", "-show_entries", "format=duration",
        "-of", "default=noprint_wrappers=1:nokey=1", str(file_path)
    ]
    res = subprocess.run(cmd, capture_output=True, text=True, check=True)
    return float(res.stdout.strip())

async def generate_scene_audio(scene, index):
    raw_path = AUDIO_DIR / f"scene_{index + 1:02d}_{scene['id']}.mp3"
    rate = "+0%"
    communicate = edge_tts.Communicate(scene["text"], VOICE, rate=rate)
    await communicate.save(str(raw_path))
    dur = get_duration(raw_path)
    print(f"[{index + 1}/10] {scene['id']}: {dur:.2f}s (Allocated window: {scene['max_duration']:.1f}s)")
    return raw_path, dur

async def main():
    print(f"Generating Vietnamese voiceover using {VOICE}...")
    tasks = []
    for i, sc in enumerate(SCENES):
        tasks.append(generate_scene_audio(sc, i))
    
    results = await asyncio.gather(*tasks)
    
    # Assemble master voiceover track with accurate timing
    # We use FFmpeg filter_complex with adelay for each scene
    inputs = []
    filter_parts = []
    
    for i, (path, dur) in enumerate(results):
        sc = SCENES[i]
        delay_ms = int(sc["start"] * 1000)
        inputs.extend(["-i", str(path)])
        filter_parts.append(f"[{i}:a]adelay={delay_ms}|{delay_ms}[a{i}]")
    
    mix_inputs = "".join(f"[a{i}]" for i in range(len(SCENES)))
    filter_parts.append(f"{mix_inputs}amix=inputs={len(SCENES)}:duration=first:dropout_transition=0,volume=1.0[outa]")
    
    master_audio = AUDIO_DIR / "master_voiceover.wav"
    filter_script = AUDIO_DIR / "voiceover_filter.txt"
    filter_script.write_text(";\n".join(filter_parts), encoding="utf-8")
    
    cmd = [
        "ffmpeg", "-y",
        *inputs,
        "-filter_complex_script", str(filter_script),
        "-map", "[outa]",
        "-t", "120.0",
        "-ar", "48000",
        "-ac", "2",
        str(master_audio)
    ]
    subprocess.run(cmd, check=True)
    total_dur = get_duration(master_audio)
    print(f"\n Master Voiceover created: {master_audio} (duration: {total_dur:.2f}s)")

if __name__ == "__main__":
    asyncio.run(main())

