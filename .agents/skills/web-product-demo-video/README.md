# Web Product Demo Video — an Agent Skill for Codex

Turn any web app into a polished, reproducible **product-demo video** — automatically.

This is a [Codex](https://openai.com/codex/) **agent skill** (`web-product-demo-video`). Point Codex at a live or local web application and it will inspect the real UI, plan a service-specific storyboard, generate Playwright recording code, and assemble a silent, captioned, 60fps MP4 with FFmpeg — no hand-editing in a video tool required.

> Everything the agent produces is derived from the target app's **real behavior**. Service-specific selectors, actions, captions, and timing live in the generated project — never hard-coded into the skill — so the same skill works across completely different products.

---

## What it does

```
inspect real UI  →  plan storyboard  →  validate  →  record (Playwright)
        →  trim to real interaction  →  render (FFmpeg)  →  validate + contact sheet
```

- **Inspects the real UI** with Playwright and records only verified routes, selectors, states, and results into `feature-inventory.json` / `recording-plan.json`.
- **Plans a storyboard** that shows cause and effect — entry, user action, visible response, useful result — with short, value-oriented captions.
- **Records the real interaction**, then trims waiting, skeleton, error, and blank states out of the edited timeline.
- **Renders a clean film**: direct cuts, restrained 1.0→1.2–1.3 zoom only where a small target needs emphasis, burned-in cinema-style captions, constant 60fps H.264.
- **Validates the output**: decodes the entire file, checks technical acceptance (container, resolution, fps, duration, no stray audio), and generates a contact sheet so you can *see* the opening, every required feature, and the final state.

Silent, captioned, 1920×1080, CFR 60fps, H.264 by default.

## Why it's built for Codex

The skill is a workflow contract, not a one-off script. Codex reads `SKILL.md`, runs the bundled Python scripts, inspects the target app, and iterates until the validators pass — so you get a **reproducible** demo pipeline instead of a manual editing session.

### Use it in Codex

1. Add this repository to the folder Codex loads skills from (or reference it as `$web-product-demo-video`).
2. Prompt Codex against your app, e.g.:

   > Use `$web-product-demo-video` to inspect this web service and build a polished, reproducible product demo video.

3. Confirm the target URL, runtime limit, required features, auth method, and output directory when Codex asks. Codex handles the rest: scaffold → inspect → storyboard → record → render → validate.

## Requirements

- Node.js + Playwright (browser recording)
- FFmpeg + FFprobe (render + validate)
- Python 3 (bundled orchestration scripts)

Project dependencies are reused when the target repo already provides them.

## Repository layout

```
SKILL.md                        # the workflow contract Codex follows
agents/openai.yaml              # Codex skill metadata (display name, default prompt)
scripts/
  init_demo_project.py          # scaffold an isolated demo project from templates
  create_storyboard.py          # feature inventory (+ markers) → timed storyboard
  validate_storyboard.py        # schema, timing, caption, zoom, media checks
  render_video.py               # FFmpeg assembly: cuts, holds, zoom, ASS captions
  validate_video.py             # decode check + technical acceptance + contact sheet
assets/
  record-demo.mjs               # data-driven Playwright recorder copied per project
  package.json                  # minimal Node dependency manifest
  *.json                        # service-neutral project templates
references/
  storyboard-schema.md          # project file contracts + marker semantics
  quality-standard.md           # visual, editorial, security & acceptance criteria
```

## Quality & security guarantees

- **Truthful demos** — real product data or approved demo data only; never implies a result the app did not produce.
- **Stable recording** — selectors come from the live DOM (roles, labels, test IDs) rather than guessed coordinates; missing targets fail loudly.
- **Secrets stay out** — credentials live in environment variables or a Playwright storage-state file *outside* the package; source, logs, subtitles, and artifacts are scanned for tokens before delivery.
- **Verified completion** — no "done" from metadata alone; the pipeline decodes representative frames and the full file before claiming success.

See [`references/quality-standard.md`](references/quality-standard.md) for the full editorial and acceptance criteria.

## What you get back

The final MP4 plus everything needed to reproduce and audit it: storyboard, feature inventory, recording plan, Playwright source, render command/script, subtitles, marker file, validation report, and contact sheet.

---

*Built as an agent skill for Codex.*
