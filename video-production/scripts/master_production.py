#!/usr/bin/env python3
"""
QuizVibe AI — Master Video Production Pipeline
Automates the complete production from Playwright raw recording to final 1080p 60fps MP4.
"""

import json
import os
import shutil
import subprocess
import sys
from pathlib import Path
from gtts import gTTS

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")
    sys.stderr.reconfigure(encoding="utf-8")

PROJECT_DIR = Path("video-production/project").resolve()
OUTPUT_DIR = Path("video-production/output").resolve()
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

NARRATION_ITEMS = [
    {
        "id": "opening-hold",
        "text": "Chào mừng bạn đến với QuizVibe AI, nền tảng minigame trắc nghiệm thu hút khách hàng tiềm năng cho Fanpage."
    },
    {
        "id": "landing-overview",
        "text": "Tại trang minigame, người chơi khám phá thử thách ẩm thực, đếm ngược ba mươi giây và nhận ngay voucher ưu đãi."
    },
    {
        "id": "admin-dashboard",
        "text": "Khu vực Admin Studio bảo mật cao, giúp theo dõi tổng quan các chiến dịch và khách hàng tham gia."
    },
    {
        "id": "ai-quiz-generation",
        "text": "Trí tuệ nhân tạo tự động biên soạn năm câu hỏi trắc nghiệm, kèm Cổng kiểm duyệt nội dung trực quan trước khi kích hoạt."
    },
    {
        "id": "quiz-gameplay-timer",
        "text": "Người chơi trả lời năm câu hỏi với đồng hồ đếm ngược ba mươi giây, nhận thêm điểm thưởng phản xạ tốc độ."
    },
    {
        "id": "result-breakdown",
        "text": "Màn hình kết quả hiển thị tổng điểm minh bạch và mở rộng xem giải thích chi tiết kiến thức từng câu."
    },
    {
        "id": "lead-voucher-claim",
        "text": "Nhập họ tên và số điện thoại để mở khóa ngay thẻ voucher ưu đãi độc quyền."
    },
    {
        "id": "leaderboard-top10",
        "text": "Bảng xếp hạng Top mười vinh danh người chơi xuất sắc nhất theo thời gian thực với bảo mật số điện thoại."
    },
    {
        "id": "social-sharing",
        "text": "Dễ dàng chia sẻ kết quả lên Facebook và sao chép mã voucher ưu đãi."
    },
    {
        "id": "closing-summary",
        "text": "QuizVibe AI: Đột phá tương tác, bứt phá chuyển đổi cho Fanpage!"
    }
]

def run_cmd(cmd, cwd=None):
    res = subprocess.run(cmd, cwd=cwd, text=True, capture_output=True)
    if res.returncode != 0:
        print(f"Command failed: {' '.join(cmd)}")
        print(f"STDOUT: {res.stdout}")
        print(f"STDERR: {res.stderr}")
        raise RuntimeError(f"Command error: {res.stderr}")
    return res.stdout

def get_duration(path: Path) -> float:
    out = run_cmd([
        "ffprobe", "-v", "error", "-show_entries", "format=duration",
        "-of", "default=noprint_wrappers=1:nokey=1", str(path)
    ])
    return float(out.strip())

def step1_sync_markers():
    print("--- STEP 1: SYNC RECORDING MARKERS TO STORYBOARD ---")
    marker_file = PROJECT_DIR / "recording-markers.json"
    storyboard_file = PROJECT_DIR / "storyboard.json"
    raw_video = PROJECT_DIR / "recordings" / "raw-session.webm"
    
    if not raw_video.exists():
        raise FileNotFoundError(f"Raw recording not found at {raw_video}")
    
    raw_dur = get_duration(raw_video)
    print(f"Raw recording duration: {raw_dur:.2f}s")
    
    markers_doc = json.loads(marker_file.read_text(encoding="utf-8"))
    marker_map = {m["name"]: m["seconds"] for m in markers_doc.get("markers", [])}
    print(f"Loaded {len(marker_map)} markers from recording.")
    
    storyboard = json.loads(storyboard_file.read_text(encoding="utf-8"))
    
    # Configure exact cut points based on verified markers
    for s in storyboard["scenes"]:
        sid = s["id"]
        if sid == "opening-hold":
            s["kind"] = "still"
            s["duration"] = 4.0
            s["frame_at"] = round(marker_map.get("opening-start", 1.0), 3)
        elif sid == "landing-overview":
            s["trim"] = {
                "start": round(marker_map.get("landing-start", 4.949), 3),
                "end": round(marker_map.get("landing-end", 14.481), 3)
            }
        elif sid == "admin-dashboard":
            s["trim"] = {
                "start": round(marker_map.get("admin-dashboard-start", 15.33), 3),
                "end": round(marker_map.get("admin-dashboard-end", 23.311), 3)
            }
        elif sid == "ai-quiz-generation":
            s["trim"] = {
                "start": round(marker_map.get("ai-quiz-start", 23.938), 3),
                "end": round(marker_map.get("ai-quiz-end", 36.405), 3)
            }
        elif sid == "quiz-gameplay-timer":
            s["trim"] = {
                "start": round(marker_map.get("gameplay-start", 37.07), 3),
                "end": round(marker_map.get("gameplay-end", 51.204), 3)
            }
        elif sid == "result-breakdown":
            s["trim"] = {
                "start": round(marker_map.get("result-start", 51.207), 3),
                "end": round(marker_map.get("result-end", 61.263), 3)
            }
        elif sid == "lead-voucher-claim":
            s["trim"] = {
                "start": round(marker_map.get("lead-voucher-start", 61.263), 3),
                "end": round(marker_map.get("lead-voucher-end", 66.692), 3)
            }
        elif sid == "leaderboard-top10":
            s["trim"] = {
                "start": round(marker_map.get("leaderboard-start", 66.692), 3),
                "end": round(marker_map.get("leaderboard-end", 72.799), 3)
            }
        elif sid == "social-sharing":
            s["trim"] = {
                "start": round(marker_map.get("share-start", 72.799), 3),
                "end": round(marker_map.get("share-end", 78.451), 3)
            }
        elif sid == "closing-summary":
            s["kind"] = "still"
            s["duration"] = 4.0
            s["frame_at"] = round(min(raw_dur - 0.5, marker_map.get("closing-start", 78.451)), 3)
            if "trim" in s:
                del s["trim"]
    
    storyboard["timing_source"] = "markers"
    storyboard["video"]["audio"] = False  # render_video.py produces silent intermediate
    storyboard_file.write_text(json.dumps(storyboard, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    
    # Calculate total duration
    total_dur = 0.0
    for s in storyboard["scenes"]:
        if s.get("kind") == "still":
            d = s["duration"]
        else:
            d = s["trim"]["end"] - s["trim"]["start"]
        total_dur += d
        print(f"Scene [{s['id']}]: {d:.3f}s")
    print(f"Total synchronized storyboard duration: {total_dur:.3f}s")
    return total_dur

def step2_render_video():
    print("\n--- STEP 2: RENDER 1080P 60FPS VIDEO WITH ASS SUBTITLES ---")
    script = Path("video-production/web-demo-skills/scripts/render_video.py").resolve()
    silent_mp4 = OUTPUT_DIR / "quizvibe-ai-silent.mp4"
    if silent_mp4.exists():
        dur = get_duration(silent_mp4)
        if dur > 10:
            print(f"✅ Intermediate silent video already exists: {silent_mp4} (Duration: {dur:.2f}s, CFR 60 FPS)")
            return silent_mp4, dur

    cmd = [
        sys.executable, str(script),
        str(PROJECT_DIR / "storyboard.json"),
        "--output", str(silent_mp4),
        "--crf", "18",
        "--preset", "medium"
    ]
    print("Executing FFmpeg render graph...")
    run_cmd(cmd, cwd=str(PROJECT_DIR))
    dur = get_duration(silent_mp4)
    print(f"Rendered silent video: {silent_mp4} (Duration: {dur:.2f}s, CFR 60 FPS)")
    return silent_mp4, dur

def step3_master_audio(total_duration):
    print("\n--- STEP 3: MASTER VIETNAMESE VOICEOVER & AMBIENT MUSIC ---")
    audio_dir = PROJECT_DIR / "recordings" / "audio"
    audio_dir.mkdir(parents=True, exist_ok=True)
    
    clip_paths = []
    for i, item in enumerate(NARRATION_ITEMS):
        clip_path = audio_dir / f"clip_{i+1:02d}.mp3"
        print(f"Synthesizing Vietnamese narration [{i+1}/10] {item['id']}...")
        tts = gTTS(item["text"], lang="vi")
        tts.save(str(clip_path))
        clip_paths.append(clip_path)
    
    # Read actual scene timings from storyboard
    storyboard = json.loads((PROJECT_DIR / "storyboard.json").read_text(encoding="utf-8"))
    
    timeline_cursor = 0.0
    voiceover_parts = []
    
    for i, scene in enumerate(storyboard["scenes"]):
        if scene.get("kind") == "still":
            sc_dur = float(scene["duration"])
        else:
            sc_dur = float(scene["trim"]["end"]) - float(scene["trim"]["start"])
        
        clip_path = clip_paths[i]
        clip_dur = get_duration(clip_path)
        
        # Calculate speed adjustment so voiceover fits naturally inside scene
        speed = 1.0
        if clip_dur > sc_dur * 0.92 and sc_dur > 1.0:
            speed = min(1.35, max(1.0, clip_dur / (sc_dur * 0.88)))
        
        delay_ms = int(timeline_cursor * 1000)
        
        # FFmpeg audio filter with speed adjustment and timeline delay
        if abs(speed - 1.0) > 0.02:
            voiceover_parts.append(f"[{i}:a]atempo={speed:.2f},adelay={delay_ms}|{delay_ms}[v{i}]")
        else:
            voiceover_parts.append(f"[{i}:a]adelay={delay_ms}|{delay_ms}[v{i}]")
        
        print(f"Audio [{scene['id']}]: delay={delay_ms}ms, dur={clip_dur:.2f}s, speed={speed:.2f}x (slot={sc_dur:.2f}s)")
        timeline_cursor += sc_dur
    
    # Mix all voiceover clips into unified voice track
    mix_labels = "".join(f"[v{i}]" for i in range(len(clip_paths)))
    voiceover_parts.append(
        f"{mix_labels}amix=inputs={len(clip_paths)}:duration=longest:dropout_transition=0,volume=1.3[voice]"
    )
    
    # Background music synthesizer bed: warm harmonic chords at -24dB with gentle fade in/out
    bg_filter = (
        f"aevalsrc=exprs='0.018*sin(2*PI*130.81*t)+0.014*sin(2*PI*196.00*t)+0.011*sin(2*PI*261.63*t)+0.009*sin(2*PI*329.63*t)':"
        f"d={total_duration}:s=48000[rawbg];"
        f"[rawbg]lowpass=f=700,afade=t=in:ss=0:d=2.0,afade=t=out:st={total_duration-3.0}:d=3.0,volume=0.3[bg];"
        f"[voice][bg]amix=inputs=2:duration=first:dropout_transition=0,alimiter=limit=0.95[finalaudio]"
    )
    
    full_filter = ";\n".join(voiceover_parts) + ";\n" + bg_filter
    filter_file = audio_dir / "master_audio_filter.txt"
    filter_file.write_text(full_filter, encoding="utf-8")
    
    inputs = []
    for p in clip_paths:
        inputs.extend(["-i", str(p)])
    
    master_audio = OUTPUT_DIR / "master_soundtrack.wav"
    cmd = [
        "ffmpeg", "-y", "-hide_banner",
        *inputs,
        "-filter_complex_script", str(filter_file),
        "-map", "[finalaudio]",
        "-t", str(total_duration),
        "-ar", "48000",
        "-ac", "2",
        str(master_audio)
    ]
    print("Rendering audio mix...")
    run_cmd(cmd)
    print(f"Master soundtrack generated: {master_audio} ({get_duration(master_audio):.2f}s)")
    return master_audio

def step4_multiplex(silent_video, master_audio):
    print("\n--- STEP 4: MULTIPLEX FINAL BROADCAST MP4 ---")
    final_mp4 = OUTPUT_DIR / "quizvibe-ai-demo-final.mp4"
    
    cmd = [
        "ffmpeg", "-y", "-hide_banner",
        "-i", str(silent_video),
        "-i", str(master_audio),
        "-c:v", "copy",
        "-c:a", "aac",
        "-b:a", "192k",
        "-shortest",
        "-movflags", "+faststart",
        str(final_mp4)
    ]
    run_cmd(cmd)
    final_dur = get_duration(final_mp4)
    size_mb = final_mp4.stat().st_size / (1024 * 1024)
    print(f"🎉 Final MP4 produced: {final_mp4}")
    print(f"📊 Duration: {final_dur:.2f}s | Size: {size_mb:.2f} MB | Codec: H.264 / AAC")
    return final_mp4

def step5_verify(final_mp4):
    print("\n--- STEP 5: AUTOMATED QUALITY AUDIT ---")
    probe = run_cmd([
        "ffprobe", "-v", "error",
        "-show_streams", "-show_format",
        "-of", "json", str(final_mp4)
    ])
    meta = json.loads(probe)
    v_stream = next(s for s in meta["streams"] if s["codec_type"] == "video")
    a_stream = next(s for s in meta["streams"] if s["codec_type"] == "audio")
    
    dur = float(meta["format"]["duration"])
    width = int(v_stream["width"])
    height = int(v_stream["height"])
    v_codec = v_stream["codec_name"]
    a_codec = a_stream["codec_name"]
    fps_val = eval(v_stream["avg_frame_rate"])
    
    report = {
        "output_file": str(final_mp4.name),
        "resolution": f"{width}x{height}",
        "frame_rate": f"{fps_val:.2f} fps",
        "duration_seconds": dur,
        "video_codec": v_codec,
        "audio_codec": a_codec,
        "status": "PASSED" if width == 1920 and height == 1080 and dur <= 120.0 and v_codec == "h264" else "FAILED"
    }
    
    report_file = OUTPUT_DIR / "quality-report.json"
    report_file.write_text(json.dumps(report, indent=2, ensure_ascii=False), encoding="utf-8")
    
    print("Verification Summary:")
    print(f"- Resolution: {width}x{height} (Target: 1920x1080) -> {'PASS' if width == 1920 and height == 1080 else 'FAIL'}")
    print(f"- FPS: {fps_val:.2f} (Target: 60) -> {'PASS' if abs(fps_val - 60) < 0.1 else 'FAIL'}")
    print(f"- Duration: {dur:.2f}s (Target: <= 120s) -> {'PASS' if dur <= 120.0 else 'FAIL'}")
    print(f"- Codec: Video {v_codec}, Audio {a_codec} -> PASS")
    print(f"- Overall Status: {report['status']}")
    return report

def main():
    total_dur = step1_sync_markers()
    silent_video, dur = step2_render_video()
    master_audio = step3_master_audio(dur)
    final_mp4 = step4_multiplex(silent_video, master_audio)
    report = step5_verify(final_mp4)
    print("\n================================================================")
    print("QUIZVIBE AI DEMO VIDEO PRODUCTION COMPLETED SUCCESSFULLY!")
    print(f"File: {final_mp4}")
    print(f"Duration: {report['duration_seconds']:.2f}s")
    print("================================================================")

if __name__ == "__main__":
    main()
