#!/usr/bin/env python3
"""Create a service-neutral web product demo project."""

from __future__ import annotations

import argparse
import shutil
from pathlib import Path


ASSET_FILES = (
    "demo.config.json",
    "feature-inventory.json",
    "recording-plan.json",
    "record-demo.mjs",
    "package.json",
)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("output_dir", type=Path)
    parser.add_argument("--force", action="store_true", help="replace packaged template files")
    return parser.parse_args()


def copy_template(source: Path, destination: Path, force: bool) -> None:
    if destination.exists() and not force:
        raise FileExistsError(f"Refusing to replace {destination}; pass --force to replace templates")
    shutil.copy2(source, destination)


def main() -> int:
    args = parse_args()
    skill_dir = Path(__file__).resolve().parent.parent
    asset_dir = skill_dir / "assets"
    output_dir = args.output_dir.resolve()
    output_dir.mkdir(parents=True, exist_ok=True)
    for directory in ("recordings", "output", "diagnostics"):
        (output_dir / directory).mkdir(exist_ok=True)
    for filename in ASSET_FILES:
        copy_template(asset_dir / filename, output_dir / filename, args.force)
    gitignore = output_dir / ".gitignore"
    if not gitignore.exists() or args.force:
        gitignore.write_text(
            "node_modules/\nrecordings/\noutput/\ndiagnostics/\nrecording-markers.json\n*.ass\n*.filter\n",
            encoding="utf-8",
        )
    print(f"Created demo project at {output_dir}")
    print("Next: inspect the target app, replace template values, then run npm install and npm run record.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
