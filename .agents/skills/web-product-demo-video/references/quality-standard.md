# Product demo video quality standard

## Narrative

- Establish context quickly and spend most of the runtime on meaningful product behavior.
- Show the user's action and the product's result in the same sequence.
- Use real product data or approved demo data. Never imply a result the application did not produce.
- Remove duplicate navigation and nonessential setup.

## Motion

- Keep a stable camera by default.
- Use direct cuts for chapter changes.
- Apply zoom only to clarify a small target or preserve readability.
- Limit zoom to roughly 1.2-1.3 and ease both entry and exit.
- Avoid flashes, spins, heavy blur, simulated handheld motion, and decorative movement.

## Captions

- Delay the first caption until after any opening hold.
- Describe user value or the current action, not framework or protocol names.
- Keep captions short enough to read once.
- Use no more than two lines.
- Move the caption upward when bottom UI is active.
- Use a consistent white typeface on a semitransparent black box.

## Product UI

- Preserve the normal application frame and preview hierarchy.
- Avoid sudden full-screen result changes unless explicitly required.
- Do not include skeletons, blank states, broken assets, notifications, test overlays, or long spinners.
- Keep click targets and results visible long enough to understand.

## Technical acceptance

- MP4 container with H.264 video.
- 1920x1080 unless another size was requested.
- Constant 60fps unless another frame rate was requested.
- No audio stream unless audio was requested.
- Duration does not exceed the configured limit.
- Complete FFmpeg decode succeeds.
- Contact sheet shows the opening, every required feature, and final state.

## Security

- Keep credentials and browser state outside the project archive.
- Scan source, logs, subtitles, marker data, and generated artifacts for tokens or passwords.
- Do not automatically mask ordinary names or team labels. Avoid sensitive screens during recording instead.
- Stop and request direction when sensitive data is essential to the requested flow.
