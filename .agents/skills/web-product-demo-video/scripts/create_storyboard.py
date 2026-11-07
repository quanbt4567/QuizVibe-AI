#!/usr/bin/env python3
"""Create a timed storyboard from a verified feature inventory and recording markers."""

from __future__ import annotations

import argparse
import json
from pathlib import Path
from typing import Any


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--config", type=Path, default=Path("demo.config.json"))
    parser.add_argument("--inventory", type=Path, default=Path("feature-inventory.json"))
    parser.add_argument("--markers", type=Path)
    parser.add_argument("--output", type=Path, default=Path("storyboard.json"))
    return parser.parse_args()


def read_json(path: Path) -> dict[str, Any]:
    try:
        value = json.loads(path.read_text(encoding="utf-8"))
    except FileNotFoundError as error:
        raise ValueError(f"Missing input file: {path}") from error
    except json.JSONDecodeError as error:
        raise ValueError(f"Invalid JSON in {path}: {error}") from error
    if not isinstance(value, dict):
        raise ValueError(f"Expected a JSON object in {path}")
    return value


def marker_map(marker_document: dict[str, Any] | None) -> dict[str, float]:
    if marker_document is None:
        return {}
    markers = marker_document.get("markers", [])
    if not isinstance(markers, list):
        raise ValueError("markers must be a list")
    result: dict[str, float] = {}
    for marker in markers:
        if not isinstance(marker, dict) or not isinstance(marker.get("name"), str):
            raise ValueError("Each marker must contain a string name")
        seconds = marker.get("seconds")
        if not isinstance(seconds, (int, float)) or seconds < 0:
            raise ValueError(f"Marker {marker['name']} has invalid seconds")
        if marker["name"] in result:
            raise ValueError(f"Duplicate marker name: {marker['name']}")
        result = {**result, marker["name"]: float(seconds)}
    return result


def validate_feature(feature: dict[str, Any]) -> None:
    required_fields = ("id", "order", "title", "purpose", "required", "priority", "estimated_seconds")
    missing = [field for field in required_fields if field not in feature]
    if missing:
        raise ValueError(f"Feature is missing fields {missing}: {feature}")
    if not isinstance(feature["id"], str) or not feature["id"]:
        raise ValueError("Feature id must be a non-empty string")
    if not isinstance(feature["estimated_seconds"], (int, float)) or feature["estimated_seconds"] <= 0:
        raise ValueError(f"Feature {feature['id']} has invalid estimated_seconds")


def feature_duration(feature: dict[str, Any], markers: dict[str, float], pre_roll: float, post_roll: float) -> float:
    start_name = feature.get("start_marker")
    end_name = feature.get("end_marker")
    if markers:
        if start_name not in markers or end_name not in markers:
            raise ValueError(f"Feature {feature['id']} is missing start or end recording markers")
        duration = markers[end_name] - markers[start_name] + pre_roll + post_roll
        if duration <= 0:
            raise ValueError(f"Feature {feature['id']} has non-positive marker duration")
        return duration
    return float(feature["estimated_seconds"])


def choose_features(
    features: list[dict[str, Any]],
    durations: dict[str, float],
    opening_duration: float,
    duration_limit: float,
) -> list[dict[str, Any]]:
    required = [feature for feature in features if feature["required"]]
    optional = sorted(
        (feature for feature in features if not feature["required"]),
        key=lambda item: (-float(item["priority"]), int(item["order"])),
    )
    required_duration = opening_duration + sum(durations[feature["id"]] for feature in required)
    if required_duration > duration_limit:
        raise ValueError(
            f"Required scenes need {required_duration:.2f}s, exceeding the {duration_limit:.2f}s limit"
        )
    selected = tuple(required)
    used = required_duration
    for feature in optional:
        duration = durations[feature["id"]]
        if used + duration <= duration_limit:
            selected = (*selected, feature)
            used += duration
    return sorted(selected, key=lambda item: int(item["order"]))


def build_camera(feature: dict[str, Any]) -> dict[str, float] | None:
    focus = feature.get("focus")
    if focus is None:
        return None
    if not isinstance(focus, dict):
        raise ValueError(f"Feature {feature['id']} focus must be an object or null")
    return {
        "x": float(focus.get("x", 0.5)),
        "y": float(focus.get("y", 0.5)),
        "max_zoom": float(focus.get("max_zoom", 1.25)),
        "zoom_in_seconds": float(focus.get("zoom_in_seconds", 0.6)),
        "zoom_out_seconds": float(focus.get("zoom_out_seconds", 0.6)),
    }


def build_caption(feature: dict[str, Any]) -> dict[str, str] | None:
    caption = feature.get("caption")
    if caption is None:
        return None
    if not isinstance(caption, str) or not caption.strip():
        raise ValueError(f"Feature {feature['id']} caption must be a non-empty string or null")
    return {"text": caption.strip(), "placement": feature.get("caption_placement", "bottom")}


def main() -> int:
    args = parse_args()
    config = read_json(args.config)
    inventory = read_json(args.inventory)
    marker_document = read_json(args.markers) if args.markers else None
    markers = marker_map(marker_document)
    features = inventory.get("features")
    if not isinstance(features, list) or not features:
        raise ValueError("feature-inventory.json must contain at least one feature")
    for feature in features:
        if not isinstance(feature, dict):
            raise ValueError("Each feature must be an object")
        validate_feature(feature)
    ids = [feature["id"] for feature in features]
    if len(ids) != len(set(ids)):
        raise ValueError("Feature ids must be unique")

    video = config.get("video", {})
    editing = config.get("editing", {})
    recording = config.get("recording", {})
    duration_limit = float(video.get("duration_limit", 60.0))
    opening_duration = float(video.get("opening_hold_seconds", 1.0))
    pre_roll = float(editing.get("pre_roll_seconds", 0.2))
    post_roll = float(editing.get("post_roll_seconds", 0.4))
    durations = {
        feature["id"]: feature_duration(feature, markers, pre_roll, post_roll) for feature in features
    }
    selected = choose_features(features, durations, opening_duration, duration_limit)
    source = marker_document.get("video") if marker_document else recording.get("output_video", "recordings/raw-session.webm")
    scenes: list[dict[str, Any]] = []
    if opening_duration > 0:
        scenes.append(
            {
                "id": "opening-hold",
                "purpose": "Establish the application context before captions begin",
                "kind": "still",
                "source": source,
                "duration": opening_duration,
                "frame_at": 0.0,
                "caption": None,
                "camera": None,
                "transition": "cut",
            }
        )

    estimated_cursor = 0.0
    for feature in selected:
        duration = durations[feature["id"]]
        if markers:
            start = max(0.0, markers[feature["start_marker"]] - pre_roll)
            end = markers[feature["end_marker"]] + post_roll
        else:
            start = estimated_cursor
            end = start + duration
            estimated_cursor = end
        scenes.append(
            {
                "id": feature["id"],
                "purpose": feature["purpose"],
                "kind": "video",
                "source": source,
                "trim": {"start": round(start, 3), "end": round(end, 3)},
                "caption": build_caption(feature),
                "camera": build_camera(feature),
                "transition": "cut",
            }
        )

    caption_config = config.get("captions", {})
    storyboard = {
        "version": 1,
        "timing_source": "recording-markers" if markers else "estimated",
        "video": {
            "width": int(video.get("width", 1920)),
            "height": int(video.get("height", 1080)),
            "fps": int(video.get("fps", 60)),
            "duration_limit": duration_limit,
            "audio": bool(video.get("audio", False)),
        },
        "caption_style": {
            "enabled": bool(caption_config.get("enabled", True)),
            "font_name": caption_config.get("font_name", "Arial"),
            "font_size": int(caption_config.get("font_size", 44)),
            "bottom_margin": int(caption_config.get("bottom_margin", 58)),
            "raised_margin": int(caption_config.get("raised_margin", 210)),
        },
        "scenes": scenes,
    }
    args.output.write_text(f"{json.dumps(storyboard, ensure_ascii=False, indent=2)}\n", encoding="utf-8")
    total = opening_duration + sum(durations[feature["id"]] for feature in selected)
    print(f"Wrote {args.output} with {len(scenes)} scenes and {total:.2f}s planned runtime")
    if not markers:
        print("Timing is estimated. Re-run with --markers after recording before final render.")
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except ValueError as error:
        raise SystemExit(f"Storyboard generation failed: {error}") from error
