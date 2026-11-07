# Storyboard and project contract

## Files

| File | Purpose |
|---|---|
| `demo.config.json` | Service-neutral video, caption, and recording defaults |
| `feature-inventory.json` | Verified product features and their narrative value |
| `recording-plan.json` | Data-driven Playwright actions and marker placement |
| `recording-markers.json` | Recorder timestamps relative to video start |
| `storyboard.json` | Ordered render timeline |

## Feature inventory

Each feature entry supports:

- `id`: stable kebab-case identifier.
- `order`: intended narrative order.
- `title`: internal human-readable label.
- `purpose`: why the feature belongs in the video.
- `caption`: optional audience-facing caption; keep it independent of implementation terminology.
- `required`: whether the runtime planner may omit it.
- `priority`: larger values win when optional scenes compete for time.
- `estimated_seconds`: fallback duration before a real recording exists.
- `start_marker` and `end_marker`: names emitted by the recorder.
- `focus`: optional normalized `x` and `y`, `max_zoom`, `zoom_in_seconds`, and `zoom_out_seconds`.

The inventory describes observed product behavior. Do not add a feature until its entry point, action, and result have been verified.

## Recording plan

The recorder executes actions in order. Supported action types are:

- `goto`: navigate to `url`.
- `click`: click `selector`.
- `fill`: fill `selector` with `text`.
- `type`: type `text` into `selector`, optionally using `delay_ms`.
- `press`: press `key` on `selector` or the page.
- `wait_for`: wait for `selector` and optional `state`.
- `wait`: wait `milliseconds`; keep these waits in raw footage and cut them from the storyboard.
- `scroll`: scroll by `x` and `y` pixels.
- `marker`: emit a named timestamp.
- `screenshot`: save a diagnostic image.

Use `${ENV_NAME}` as an exact string value to resolve a secret or environment-specific URL at runtime. Do not embed secrets in surrounding text.

## Recording markers

Markers are seconds relative to recorder start. Place a start marker after the UI has settled and immediately before the meaningful action. Place the end marker after the result is visibly understandable. The generated storyboard trims from `start_marker - pre_roll_seconds` to `end_marker + post_roll_seconds`.

## Storyboard

The root object contains `version`, `video`, `caption_style`, and `scenes`.

Each scene contains:

- `id`, `purpose`, and `source`.
- `kind`: `video` or `still`.
- `trim.start` and `trim.end` for video scenes.
- `duration` for still scenes.
- `caption`: `null` or an object with `text` and `placement` (`bottom` or `raised`).
- `camera`: `null` or a normalized focus point plus zoom timing.
- `transition`: currently `cut` only.

The renderer resolves relative `source` paths from the storyboard directory. A still scene may use an image or freeze the first frame of a video.

## Time budget

The storyboard generator keeps all required features. It chooses optional features by priority while respecting `duration_limit`. If required features alone exceed the limit, generation fails and requires a narrative decision; it never silently truncates required content.
