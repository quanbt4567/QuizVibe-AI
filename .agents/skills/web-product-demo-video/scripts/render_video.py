#!/usr/bin/env python3
"""Render a storyboard into a silent CFR H.264 MP4 with restrained zoom and ASS captions."""

from __future__ import annotations

import argparse
import json
import math
import shutil
import subprocess
from pathlib import Path
from typing import Any


IMAGE_SUFFIXES = {".png", ".jpg", ".jpeg", ".webp", ".bmp"}


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("storyboard", type=Path, nargs="?", default=Path("storyboard.json"))
    parser.add_argument("--output", type=Path, default=Path("output/product-demo.mp4"))
    parser.add_argument("--ffmpeg", default="ffmpeg")
    parser.add_argument("--crf", type=int, default=18)
    parser.add_argument("--preset", default="medium")
    return parser.parse_args()


def read_json(path: Path) -> dict[str, Any]:
    try:
        value = json.loads(path.read_text(encoding="utf-8"))
    except (FileNotFoundError, json.JSONDecodeError) as error:
        raise ValueError(f"Cannot read storyboard {path}: {error}") from error
    if not isinstance(value, dict):
        raise ValueError("Storyboard root must be an object")
    return value


def scene_duration(scene: dict[str, Any]) -> float:
    if scene.get("kind") == "still":
        return float(scene["duration"])
    return float(scene["trim"]["end"]) - float(scene["trim"]["start"])


def ass_time(seconds: float) -> str:
    centiseconds = max(0, int(round(seconds * 100)))
    hours, remainder = divmod(centiseconds, 360_000)
    minutes, remainder = divmod(remainder, 6_000)
    whole_seconds, fraction = divmod(remainder, 100)
    return f"{hours}:{minutes:02d}:{whole_seconds:02d}.{fraction:02d}"


def ass_text(value: str) -> str:
    return value.replace("\\", r"\\").replace("{", r"\{").replace("}", r"\}").replace("\n", r"\N")


def write_ass(path: Path, storyboard: dict[str, Any]) -> bool:
    style = storyboard.get("caption_style", {})
    if not style.get("enabled", True):
        return False
    video = storyboard["video"]
    width = int(video["width"])
    height = int(video["height"])
    font_name = str(style.get("font_name", "Arial"))
    font_size = int(style.get("font_size", 44))
    bottom_margin = int(style.get("bottom_margin", 58))
    raised_margin = int(style.get("raised_margin", 210))
    lines = [
        "[Script Info]",
        "ScriptType: v4.00+",
        f"PlayResX: {width}",
        f"PlayResY: {height}",
        "ScaledBorderAndShadow: yes",
        "WrapStyle: 2",
        "",
        "[V4+ Styles]",
        "Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, "
        "Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, "
        "Shadow, Alignment, MarginL, MarginR, MarginV, Encoding",
        f"Style: Cinema,{font_name},{font_size},&H00FFFFFF,&H00FFFFFF,&H80000000,&H80000000,"
        f"0,0,0,0,100,100,0,0,3,0,0,2,40,40,{bottom_margin},1",
        "",
        "[Events]",
        "Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text",
    ]
    cursor = 0.0
    event_count = 0
    for scene in storyboard["scenes"]:
        duration = scene_duration(scene)
        caption = scene.get("caption")
        if isinstance(caption, dict) and caption.get("text"):
            override = ""
            if caption.get("placement") == "raised":
                override = rf"{{\an2\pos({width // 2},{height - raised_margin})}}"
            lines.append(
                "Dialogue: 0,"
                f"{ass_time(cursor)},{ass_time(cursor + duration)},Cinema,,0,0,0,,"
                f"{override}{ass_text(str(caption['text']))}"
            )
            event_count += 1
        cursor += duration
    if event_count == 0:
        return False
    path.write_text("\n".join(lines) + "\n", encoding="utf-8-sig")
    return True


def escape_filter_path(path: Path) -> str:
    return str(path.resolve()).replace("\\", "/").replace(":", r"\:").replace("'", r"\'")


def normalize_filter(width: int, height: int, fps: int) -> str:
    return (
        f"scale={width}:{height}:force_original_aspect_ratio=decrease,"
        f"pad={width}:{height}:(ow-iw)/2:(oh-ih)/2:color=black,setsar=1,fps={fps}"
    )


def zoom_filter(camera: dict[str, Any], width: int, height: int, fps: int, duration: float) -> str:
    max_zoom = float(camera.get("max_zoom", 1.25))
    focus_x = float(camera.get("x", 0.5))
    focus_y = float(camera.get("y", 0.5))
    frames = max(2, int(round(duration * fps)))
    zoom_in = max(1, min(frames // 2, int(round(float(camera.get("zoom_in_seconds", 0.6)) * fps))))
    zoom_out = max(1, min(frames // 2, int(round(float(camera.get("zoom_out_seconds", 0.6)) * fps))))
    final_frame = frames - 1
    z_expression = (
        f"if(lte(on,{zoom_in}),1+({max_zoom}-1)*(1-cos(PI*on/{zoom_in}))/2,"
        f"if(gte(on,{final_frame - zoom_out}),1+({max_zoom}-1)*"
        f"(1-cos(PI*({final_frame}-on)/{zoom_out}))/2,{max_zoom}))"
    )
    source_width = width * 2
    source_height = height * 2
    return (
        f"scale={source_width}:{source_height}:force_original_aspect_ratio=decrease,"
        f"pad={source_width}:{source_height}:(ow-iw)/2:(oh-ih)/2:color=black,setsar=1,"
        f"zoompan=z='{z_expression}':x='(iw-iw/zoom)*{focus_x}':"
        f"y='(ih-ih/zoom)*{focus_y}':d=1:s={width}x{height}:fps={fps}"
    )


def source_filter(scene: dict[str, Any], input_index: int, width: int, height: int, fps: int) -> str:
    duration = scene_duration(scene)
    source = Path(scene["source"])
    if scene["kind"] == "still":
        if source.suffix.lower() in IMAGE_SUFFIXES:
            start = f"[{input_index}:v]trim=duration={duration},setpts=PTS-STARTPTS"
        else:
            frame_at = float(scene.get("frame_at", 0.0))
            start = (
                f"[{input_index}:v]trim=start={frame_at}:end={frame_at + 0.05},setpts=PTS-STARTPTS,"
                f"fps={fps},tpad=stop_mode=clone:stop_duration={duration},trim=duration={duration}"
            )
    else:
        trim = scene["trim"]
        start = f"[{input_index}:v]trim=start={trim['start']}:end={trim['end']},setpts=PTS-STARTPTS"
    camera = scene.get("camera")
    transform = zoom_filter(camera, width, height, fps, duration) if camera else normalize_filter(width, height, fps)
    return f"{start},{transform},trim=duration={duration},setpts=PTS-STARTPTS[v{input_index}]"


def find_executable(command: str) -> str:
    resolved = shutil.which(command)
    if not resolved:
        raise ValueError(f"Executable not found: {command}")
    return resolved


def main() -> int:
    args = parse_args()
    storyboard_path = args.storyboard.resolve()
    root = storyboard_path.parent
    storyboard = read_json(storyboard_path)
    scenes = storyboard.get("scenes")
    if not isinstance(scenes, list) or not scenes:
        raise ValueError("Storyboard has no scenes")
    video = storyboard["video"]
    width = int(video["width"])
    height = int(video["height"])
    fps = int(video["fps"])
    output = args.output if args.output.is_absolute() else root / args.output
    output = output.resolve()
    output.parent.mkdir(parents=True, exist_ok=True)

    command = [find_executable(args.ffmpeg), "-y", "-hide_banner"]
    filters: list[str] = []
    for index, scene in enumerate(scenes):
        source = (root / scene["source"]).resolve()
        if not source.is_file():
            raise ValueError(f"Scene source does not exist: {source}")
        if scene["kind"] == "still" and source.suffix.lower() in IMAGE_SUFFIXES:
            command.extend(["-loop", "1", "-t", str(scene_duration(scene)), "-i", str(source)])
        else:
            command.extend(["-i", str(source)])
        filters.append(source_filter(scene, index, width, height, fps))

    labels = "".join(f"[v{index}]" for index in range(len(scenes)))
    if len(scenes) == 1:
        filters.append("[v0]null[joined]")
    else:
        filters.append(f"{labels}concat=n={len(scenes)}:v=1:a=0[joined]")

    ass_path = output.with_suffix(".ass")
    has_captions = write_ass(ass_path, storyboard)
    if has_captions:
        filters.append(f"[joined]subtitles=filename='{escape_filter_path(ass_path)}'[outv]")
    else:
        filters.append("[joined]null[outv]")

    filter_path = output.with_suffix(".filter")
    filter_path.write_text(";\n".join(filters) + "\n", encoding="utf-8")
    command.extend(
        [
            "-filter_complex_script",
            str(filter_path),
            "-map",
            "[outv]",
            "-an",
            "-c:v",
            "libx264",
            "-preset",
            args.preset,
            "-crf",
            str(args.crf),
            "-pix_fmt",
            "yuv420p",
            "-r",
            str(fps),
            "-fps_mode",
            "cfr",
            "-movflags",
            "+faststart",
            str(output),
        ]
    )
    result = subprocess.run(command, cwd=root, text=True, capture_output=True, check=False)
    if result.returncode != 0:
        raise RuntimeError(f"FFmpeg render failed:\n{result.stderr[-6000:]}")
    if not math.isfinite(output.stat().st_size) or output.stat().st_size <= 0:
        raise RuntimeError("FFmpeg returned success but did not create a video")
    print(f"Rendered {output}")
    print(f"Filter graph {filter_path}")
    if has_captions:
        print(f"Captions {ass_path}")
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except (ValueError, RuntimeError) as error:
        raise SystemExit(str(error)) from error
