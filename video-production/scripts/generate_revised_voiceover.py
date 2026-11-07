#!/usr/bin/env python3
"""
Generate revised Vietnamese voiceover using Edge TTS Neural Voice.
Generates 10 clips sequentially and measures exact durations.
"""

import asyncio
import os
import subprocess
import sys
from pathlib import Path
import edge_tts

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")
    sys.stderr.reconfigure(encoding="utf-8")

VOICE = "vi-VN-NamMinhNeural"  # Professional Vietnamese male neural voice

CLIPS = [
    {
        "id": "opening-hold",
        "text": "Chào mừng bạn đến với QuizVibe AI — giải pháp biến minigame tương tác thành quy trình thu thập khách hàng tiềm năng cho Fanpage."
    },
    {
        "id": "landing-overview",
        "text": "Trên trang công khai, người chơi dễ dàng theo dõi thể lệ ba mươi giây mỗi câu hỏi cùng cơ hội nhận ngay voucher ưu đãi hấp dẫn."
    },
    {
        "id": "admin-dashboard",
        "text": "Khu vực Admin Studio được bảo vệ bằng phiên làm việc máy chủ, giúp nhà quản trị theo dõi chiến dịch và quản lý danh sách người tham gia tập trung."
    },
    {
        "id": "ai-quiz-generation",
        "text": "Trong môi trường thử nghiệm, hệ thống mô phỏng tạo bộ năm câu hỏi theo chủ đề. Quản trị viên luôn có Cổng kiểm duyệt để hiệu đính nội dung trước khi xuất bản."
    },
    {
        "id": "quiz-gameplay-timer",
        "text": "Người chơi lần lượt trả lời năm câu hỏi với đồng hồ đếm ngược ba mươi giây. Thuật toán chấm điểm tự động cộng điểm thưởng cho các lượt phản xạ nhanh và chính xác."
    },
    {
        "id": "result-breakdown",
        "text": "Màn hình kết quả tổng hợp điểm số minh bạch, đồng thời cho phép mở rộng để xem giải thích kiến thức chi tiết cho từng câu hỏi."
    },
    {
        "id": "lead-voucher-claim",
        "text": "Để nhận voucher, người chơi gửi họ tên và số điện thoại. Hệ thống tự động đối soát chống trùng lặp, đảm bảo dữ liệu khách hàng chất lượng cao."
    },
    {
        "id": "leaderboard-top10",
        "text": "Bảng xếp hạng Top mười cập nhật theo thời gian thực, ẩn danh số điện thoại để bảo vệ quyền riêng tư và thúc đẩy người chơi cạnh tranh."
    },
    {
        "id": "social-sharing",
        "text": "Tính năng chia sẻ mạng xã hội và sao chép mã ưu đãi giúp minigame lan tỏa tự nhiên, mở rộng tệp khách hàng tiềm năng."
    },
    {
        "id": "closing-summary",
        "text": "QuizVibe AI — Giải pháp minigame thông minh, bứt phá chuyển đổi và tương tác cho Fanpage của bạn."
    }
]

OUTPUT_DIR = Path("video-production/project/recordings/audio_revised")
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

def get_duration(file_path: Path) -> float:
    cmd = [
        "ffprobe", "-v", "error", "-show_entries", "format=duration",
        "-of", "default=noprint_wrappers=1:nokey=1", str(file_path)
    ]
    res = subprocess.run(cmd, capture_output=True, text=True, check=True)
    return float(res.stdout.strip())

async def main():
    print(f"Generating 10 revised neural voiceover clips with {VOICE}...")
    durations = {}
    
    for i, clip in enumerate(CLIPS):
        clip_path = OUTPUT_DIR / f"clip_revised_{i+1:02d}.mp3"
        print(f"[{i+1}/10] Generating {clip['id']}...")
        
        # Rate: +0% (standard, natural human pacing)
        communicate = edge_tts.Communicate(clip["text"], VOICE, rate="+0%")
        await communicate.save(str(clip_path))
        
        dur = get_duration(clip_path)
        durations[clip["id"]] = dur
        print(f" -> Generated: {dur:.2f}s | Text: {clip['text'][:40]}...")
        await asyncio.sleep(0.4)
    
    print("\n=== SUMMARY OF VOICE DURATIONS ===")
    total = sum(durations.values())
    for cid, d in durations.items():
        print(f"{cid:22s}: {d:.2f}s")
    print(f"Total Speech Time: {total:.2f}s")

if __name__ == "__main__":
    asyncio.run(main())
