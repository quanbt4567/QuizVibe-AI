---
name: web-product-demo-video
description: Build reproducible product-demo videos for arbitrary web applications by inspecting the real UI, planning a service-specific storyboard, generating Playwright recording code, and assembling silent captioned 60fps MP4s with FFmpeg. Use when Codex is asked to create, revise, automate, or package a web-service introduction, demo-day video, feature walkthrough, or UI product film from a live or local web app.
---

# Web Product Demo Video

Create the demo from the target application's real behavior. Keep service-specific facts, selectors, actions, captions, and timing in the generated project; never add them to this Skill.

## Required workflow

1. Read the target repository instructions and inspect its run commands.
2. Confirm the target URL, runtime limit, required features, authentication method, output directory, and whether captions or audio are wanted. Default to 1920x1080, CFR 60fps, H.264, captions on, and no audio.
3. Check for Node.js, Playwright, FFmpeg, FFprobe, and a usable Python 3 runtime. Reuse project dependencies when available.
4. Run `scripts/init_demo_project.py OUTPUT_DIR` to create an isolated demo project.
5. Inspect the real UI with Playwright or an existing signed-in browser. Record only verified routes, selectors, states, actions, and results in `feature-inventory.json` and `recording-plan.json`.
6. Run `scripts/create_storyboard.py` and then refine `storyboard.json`. Read `references/storyboard-schema.md` when editing the data contract.
7. Run `scripts/validate_storyboard.py` before recording. If it fails, fix the inventory or storyboard instead of bypassing the check.
8. Adapt the generated `record-demo.mjs` only where the target application needs custom interaction logic. Keep credentials in environment variables or a Playwright storage-state file outside the package.
9. Record the complete real interaction. Preserve action markers, but remove waiting, skeleton, error, and blank states from the edited timeline.
10. Rebuild the storyboard with `--markers recording-markers.json`, verify every trim visually, and run the storyboard validator with `--require-media`.
11. Render with `scripts/render_video.py`. Use direct cuts by default and restrained zoom only when a small interaction needs emphasis.
12. Validate with `scripts/validate_video.py`, inspect the generated contact sheet, and rerender until all checks pass.

## Storyboard rules

- Derive the narrative from the requested outcome and the application's verified user flow.
- Show cause and effect: entry, user action, visible response, and useful result.
- Give required features enough time to be understood; remove optional scenes before over-compressing required scenes.
- Start with an optional one-second still hold. Do not show a caption during that hold.
- Use short value-oriented captions. Avoid internal implementation terms unless the audience needs them.
- Raise captions when bottom controls or inputs would be covered.
- Keep previews in the application's normal context unless full screen is itself the feature.
- Show repeated content only when the interaction matters, such as paging or comparing states.
- Cut long waits. Retain at most a brief progress beat when generation behavior is part of the product value.

Read `references/quality-standard.md` before making editorial decisions.

## Recording rules

- Use stable selectors discovered from the current DOM. Prefer roles, labels, test IDs, and durable attributes over positional CSS.
- Fail with a clear error when a target is missing. Do not click guessed coordinates.
- Record at the final aspect ratio. Keep the browser viewport and device scale factor fixed.
- Type visibly only when typing communicates the workflow; otherwise fill instantly.
- Store secrets only in environment variables. Never write tokens, cookies, passwords, or storage state into source files, logs, subtitles, or the final archive.
- Do not hide or mask ordinary UI unless explicitly requested. Stop if the flow exposes sensitive data that cannot safely be avoided.

## Editing rules

- Prefer direct cuts and native application motion.
- Do not add white flashes, aggressive transitions, continuous camera motion, cursor wandering, or sound effects.
- Use a smooth 1.0 to 1.2-1.3 zoom around the active control, hold it briefly, then return to 1.0.
- Burn captions with a readable white-on-semitransparent-black cinema style when captions are requested.
- Keep the output silent unless audio is explicitly requested. Absence of an audio stream is preferred over a muted track.
- Render CFR 60fps and verify the entire file decodes.

## Bundled resources

- `scripts/init_demo_project.py`: scaffold a reusable demo project from packaged assets.
- `scripts/create_storyboard.py`: convert a feature inventory and optional recording markers into a timed storyboard.
- `scripts/validate_storyboard.py`: validate schema, timing, captions, zoom, and source media.
- `scripts/render_video.py`: assemble clips, still holds, zooms, direct cuts, and ASS captions with FFmpeg.
- `scripts/validate_video.py`: inspect media properties, decode the file, and produce a contact sheet.
- `assets/record-demo.mjs`: data-driven Playwright recorder copied into each project.
- `assets/package.json`: minimal Node dependency manifest.
- `assets/*.json`: service-neutral project templates.
- `references/storyboard-schema.md`: project file contracts and marker semantics.
- `references/quality-standard.md`: visual, editorial, security, and acceptance criteria.

## Completion contract

Return the final MP4, storyboard, feature inventory, recording plan, Playwright source, render command or script, subtitles, marker file, validation report, and contact sheet. Report any unverified flow explicitly. Do not claim completion from metadata checks alone; inspect representative frames and the complete decode result.
