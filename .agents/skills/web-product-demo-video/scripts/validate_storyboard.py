#!/usr/bin/env python3
"""Validate a web product demo storyboard before recording or rendering."""

from __future__ import annotations

import argparse
import json
from pathlib import Path
from typing import Any


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("storyboard", type=Path, nargs="?", default=Path("storyboard.json"))
    parser.add_argument("--require-media", action="store_true")
    parser.add_argument("--require-markers", action="store_true")
    return parser.parse_args()


def read_storyboard(path: Path) -> dict[str, Any]:
    try:
        value = json.loads(path.read_text(encoding="utf-8"))
    except (FileNotFoundError, json.JSONDecodeError) as error:
        raise ValueError(f"Cannot read storyboard {path}: {error}") from error
    if not isinstance(value, dict):
        raise ValueError("Storyboard root must be an object")
    return value


def scene_duration(scene: dict[str, Any]) -> float:
    if scene.get("kind") == "still":
        return float(scene.get("duration", 0))
    trim = scene.get("trim", {})
    return float(trim.get("end", 0)) - float(trim.get("start", 0))


def validate(storyboard: dict[str, Any], root: Path, require_media: bool, require_markers: bool) -> list[str]:
    errors: list[str] = []
    video = storyboard.get("video")
    scenes = storyboard.get("scenes")
    if storyboard.get("version") != 1:
        errors.append("version must be 1")
    if require_markers and storyboard.get("timing_source") != "recording-markers":
        errors.append("final storyboard must be rebuilt from recording markers")
    if not isinstance(video, dict):
        errors.append("video must be an object")
        video = {}
    if not isinstance(scenes, list) or not scenes:
        errors.append("scenes must be a non-empty list")
        return errors
    width = video.get("width")
    height = video.get("height")
    fps = video.get("fps")
    limit = video.get("duration_limit")
    if not isinstance(width, int) or width <= 0 or width % 2:
        errors.append("video.width must be a positive even integer")
    if not isinstance(height, int) or height <= 0 or height % 2:
        errors.append("video.height must be a positive even integer")
    if not isinstance(fps, int) or fps <= 0:
        errors.append("video.fps must be a positive integer")
    if not isinstance(limit, (int, float)) or limit <= 0:
        errors.append("video.duration_limit must be positive")
        limit = 0

    ids: set[str] = set()
    total = 0.0
    for index, scene in enumerate(scenes):
        prefix = f"scene {index + 1}"
        if not isinstance(scene, dict):
            errors.append(f"{prefix} must be an object")
            continue
        scene_id = scene.get("id")
        if not isinstance(scene_id, str) or not scene_id:
            errors.append(f"{prefix} needs a non-empty id")
        elif scene_id in ids:
            errors.append(f"duplicate scene id: {scene_id}")
        else:
            ids.add(scene_id)
        if scene.get("kind") not in {"video", "still"}:
            errors.append(f"{prefix} kind must be video or still")
        duration = scene_duration(scene)
        if duration <= 0:
            errors.append(f"{prefix} must have a positive duration")
        total += max(0.0, duration)
        if scene.get("transition", "cut") != "cut":
            errors.append(f"{prefix} uses unsupported transition; only cut is allowed")
        source = scene.get("source")
        if not isinstance(source, str) or not source:
            errors.append(f"{prefix} needs a source")
        elif require_media and not (root / source).resolve().is_file():
            errors.append(f"{prefix} source does not exist: {source}")
        caption = scene.get("caption")
        if caption is not None:
            if not isinstance(caption, dict) or not isinstance(caption.get("text"), str):
                errors.append(f"{prefix} caption must contain text")
            else:
                if len(caption["text"]) > 120:
                    errors.append(f"{prefix} caption exceeds 120 characters")
                if caption.get("placement", "bottom") not in {"bottom", "raised"}:
                    errors.append(f"{prefix} caption placement must be bottom or raised")
        camera = scene.get("camera")
        if camera is not None:
            if not isinstance(camera, dict):
                errors.append(f"{prefix} camera must be an object or null")
            else:
                if not 0 <= float(camera.get("x", -1)) <= 1 or not 0 <= float(camera.get("y", -1)) <= 1:
                    errors.append(f"{prefix} camera x and y must be normalized")
                if not 1 <= float(camera.get("max_zoom", 0)) <= 1.5:
                    errors.append(f"{prefix} max_zoom must be between 1.0 and 1.5")
    if scenes[0].get("id") == "opening-hold" and scenes[0].get("caption") is not None:
        errors.append("opening hold must not have a caption")
    if limit and total > float(limit) + 0.001:
        errors.append(f"planned runtime {total:.3f}s exceeds limit {float(limit):.3f}s")
    return errors


def main() -> int:
    args = parse_args()
    storyboard_path = args.storyboard.resolve()
    storyboard = read_storyboard(storyboard_path)
    errors = validate(storyboard, storyboard_path.parent, args.require_media, args.require_markers)
    if errors:
        print("Storyboard validation failed:")
        for error in errors:
            print(f"- {error}")
        return 1
    total = sum(scene_duration(scene) for scene in storyboard["scenes"])
    print(f"Storyboard valid: {len(storyboard['scenes'])} scenes, {total:.3f}s")
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except ValueError as error:
        raise SystemExit(f"Storyboard validation failed: {error}") from error
