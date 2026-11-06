# Reelroom agents

Reelroom cuts a vertical short for Instagram Reels and TikTok. Five agents share one project. Each one writes a markdown note in the project folder, and the editor UI can override any of them.

The finish is always a 1080×1920 H.264 MP4 with AAC audio, normalized toward -14 LUFS, safe for Reels and TikTok.

## Order

1. **Style** reads reference videos and writes `STYLE.md`.
2. **Script** reads the brief, the clip notes, and the workshop chat, and writes `SCRIPT.md`.
3. **Selects** scores windows inside the raw footage and writes `SELECTS.md`.
4. **Editor** assembles a timeline from the script, the selects, and the style.
5. **Conform** checks that timeline against `STYLE.md`. If it drifts, it says what to change and can hand the fixed timeline back to the editor. It writes `CONFORM.md`.

Run them again after a manual edit. Undo restores the previous timeline.

## What the picture agents can and cannot see

Style and Selects measure duration, scene cuts, loudness, and average color. They do not recognize faces, products, or words burned into the picture.

The story comes from the project brief and the one-line note on each clip. If those are empty, the script agent asks before it invents a plot.

## Files

- `agents/style-agent.md`
- `agents/script-agent.md`
- `agents/selects-agent.md`
- `agents/editor-agent.md`
- `agents/conform-agent.md`
