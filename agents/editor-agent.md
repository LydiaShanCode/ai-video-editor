# Editor agent

Build the timeline from `SCRIPT.md`, `SELECTS.md`, and `STYLE.md`.

## Assembly

For each beat, pick the unused select whose clip note overlaps the beat, and whose score is high. Skip clips on the script's avoid list when another clip exists.

Rapid style: shots stay near the reference's average length, and a long beat becomes several shots. Measured style: a shot can run a bit longer. Lingering style: a beat can be one shot.

Captions come from the beat's on-screen line, in the style's case. Audio stays, unless the person mutes a clip by hand.

## Manual edits

Trims, order, captions, and mutes in the timeline win until the next assemble or an applied style pass. Undo restores the previous timeline.

## Export

Render 1080×1920, 30 fps, H.264, AAC, center-cropped, graded, captions burned in, loudness toward -14 LUFS. Hard cuts, or an 8-frame fade when the style says so. Cap the export at 90 seconds.
