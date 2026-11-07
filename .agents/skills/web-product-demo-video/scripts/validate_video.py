#!/usr/bin/env python3
"""Validate the rendered product demo and generate a visual contact sheet."""

from __future__ import annotations

import argparse
import json
import re
import shutil
import subprocess
from fractions import Fraction
from pathlib import Path
from typing import Any


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("video", type=Path)
    parser.add_argument("--storyboard", type=Path)
    parser.add_argument("--ffmpeg", default="ffmpeg")
    parser.add_argument("--ffprobe", default="ffprobe")
    parser.add_argument("--report", type=Path)
    parser.add_argument("--contact-sheet", type=Path)
    return parser.parse_args()


def executable(name: str) -> str:
    resolved = shutil.which(name)
    if not resolved:
        raise ValueError(f"Executable not found: {name}")
    return resolved


def run(command: list[str]) -> subprocess.CompletedProcess[str]:
    return subprocess.run(
        command,
        text=True,
        encoding="utf-8",
        errors="replace",
        capture_output=True,
        check=False,
    )


def read_json(path: Path) -> dict[str, Any]:
    value = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(value, dict):
        raise ValueError(f"Expected JSON object in {path}")
    return value


def frame_rate(value: str) -> float:
    return float(Fraction(value)) if value and value != "0/0" else 0.0


def probe_with_ffmpeg(ffmpeg: str, video_path: Path) -> dict[str, Any]:
    probe = run([ffmpeg, "-hide_banner", "-i", str(video_path)])
    output = probe.stderr
    duration_match = re.search(r"Duration:\s*(\d+):(\d+):(\d+(?:\.\d+)?)", output)
    video_match = re.search(
        r"Stream #[^\n]+Video:\s*([^,\s]+)[^\n]*?(\d{2,5})x(\d{2,5})[^\n]*?(\d+(?:\.\d+)?)\s*fps",
        output,
    )
    if not duration_match or not video_match:
        raise RuntimeError(f"FFmpeg metadata fallback could not parse the video:\n{output[-3000:]}")
    hours, minutes, seconds = duration_match.groups()
    duration = int(hours) * 3600 + int(minutes) * 60 + float(seconds)
    codec, width, height, fps = video_match.groups()
    audio_count = len(re.findall(r"Stream #[^\n]+Audio:", output))
    return {
        "streams": [
            {
                "codec_type": "video",
                "codec_name": codec,
                "width": int(width),
                "height": int(height),
                "avg_frame_rate": f"{fps}/1",
            },
            *({"codec_type": "audio"} for _ in range(audio_count)),
        ],
        "format": {"duration": duration},
        "probe_backend": "ffmpeg-fallback",
    }


def main() -> int:
    args = parse_args()
    video_path = args.video.resolve()
    if not video_path.is_file():
        raise ValueError(f"Video does not exist: {video_path}")
    ffmpeg = executable(args.ffmpeg)
    ffprobe = shutil.which(args.ffprobe)
    if ffprobe:
        probe = run(
            [
                ffprobe,
                "-v",
                "error",
                "-show_streams",
                "-show_format",
                "-of",
                "json",
                str(video_path),
            ]
        )
        if probe.returncode != 0:
            raise RuntimeError(f"FFprobe failed:\n{probe.stderr}")
        metadata = {**json.loads(probe.stdout), "probe_backend": "ffprobe"}
    else:
        metadata = probe_with_ffmpeg(ffmpeg, video_path)
    streams = metadata.get("streams", [])
    video_streams = [stream for stream in streams if stream.get("codec_type") == "video"]
    audio_streams = [stream for stream in streams if stream.get("codec_type") == "audio"]
    errors: list[str] = []
    if len(video_streams) != 1:
        errors.append(f"expected one video stream, found {len(video_streams)}")
        video_stream = {}
    else:
        video_stream = video_streams[0]
    expected = {
        "width": 1920,
        "height": 1080,
        "fps": 60,
        "duration_limit": None,
        "audio": False,
    }
    if args.storyboard:
        expected = {**expected, **read_json(args.storyboard.resolve()).get("video", {})}
    actual_fps = frame_rate(video_stream.get("avg_frame_rate", "0/0"))
    duration = float(metadata.get("format", {}).get("duration", 0))
    if video_stream.get("codec_name") != "h264":
        errors.append(f"expected H.264, found {video_stream.get('codec_name')}")
    if video_stream.get("width") != int(expected["width"]):
        errors.append(f"expected width {expected['width']}, found {video_stream.get('width')}")
    if video_stream.get("height") != int(expected["height"]):
        errors.append(f"expected height {expected['height']}, found {video_stream.get('height')}")
    if abs(actual_fps - float(expected["fps"])) > 0.01:
        errors.append(f"expected {expected['fps']}fps, found {actual_fps:.4f}fps")
    if not expected.get("audio", False) and audio_streams:
        errors.append(f"expected no audio stream, found {len(audio_streams)}")
    if expected.get("duration_limit") is not None and duration > float(expected["duration_limit"]) + 0.05:
        errors.append(f"duration {duration:.3f}s exceeds limit {float(expected['duration_limit']):.3f}s")

    decode = run([ffmpeg, "-v", "error", "-i", str(video_path), "-f", "null", "-"])
    if decode.returncode != 0:
        errors.append(f"complete decode failed: {decode.stderr[-2000:]}")

    contact_sheet = (args.contact_sheet or video_path.with_suffix(".contact-sheet.jpg")).resolve()
    contact_sheet.parent.mkdir(parents=True, exist_ok=True)
    sample_rate = 12 / max(duration, 0.1)
    sheet = run(
        [
            ffmpeg,
            "-y",
            "-v",
            "error",
            "-i",
            str(video_path),
            "-vf",
            f"fps={sample_rate:.8f},scale=480:-2,tile=4x3:padding=4:margin=4",
            "-frames:v",
            "1",
            str(contact_sheet),
        ]
    )
    if sheet.returncode != 0:
        errors.append(f"contact sheet generation failed: {sheet.stderr[-1000:]}")

    report = {
        "video": str(video_path),
        "valid": not errors,
        "actual": {
            "probe_backend": metadata.get("probe_backend"),
            "codec": video_stream.get("codec_name"),
            "width": video_stream.get("width"),
            "height": video_stream.get("height"),
            "fps": actual_fps,
            "duration": duration,
            "audio_streams": len(audio_streams),
            "decode_ok": decode.returncode == 0,
        },
        "expected": expected,
        "contact_sheet": str(contact_sheet),
        "errors": errors,
    }
    report_path = (args.report or video_path.with_suffix(".validation.json")).resolve()
    report_path.write_text(f"{json.dumps(report, ensure_ascii=False, indent=2)}\n", encoding="utf-8")
    if errors:
        print("Video validation failed:")
        for error in errors:
            print(f"- {error}")
        print(f"Report {report_path}")
        return 1
    print(f"Video valid: {duration:.3f}s, {actual_fps:.2f}fps, {video_stream.get('width')}x{video_stream.get('height')}")
    print(f"Report {report_path}")
    print(f"Contact sheet {contact_sheet}")
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except (ValueError, RuntimeError, json.JSONDecodeError) as error:
        raise SystemExit(f"Video validation failed: {error}") from error
