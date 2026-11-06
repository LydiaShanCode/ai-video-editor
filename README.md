# Reelroom

Reelroom is a cutting room for Instagram Reels and TikTok. You bring a reference and raw footage. Five agents turn that into a 1080×1920 video, and you can change any of it by hand before the export.

## The room

1. **Style** reads a reference and writes the pace, grade, captions, and cut type.
2. **Script** drafts an outline from your brief and the notes on each clip, then workshops it with you.
3. **Selects** keeps the windows where the picture changes or the sound shows up.
4. **Editor** stitches the script, the selects, and the style into a timeline.
5. **Conform** checks the cut against the style and can send it back to the editor.

The agent contracts live in [`agents/AGENTS.md`](agents/AGENTS.md). Each project also keeps `STYLE.md`, `SCRIPT.md`, `SELECTS.md`, and `CONFORM.md`.

The picture agents measure cuts, loudness, and color. They do not recognize what is in the frame. Write a brief, and a one-line note on each clip, or the script stays a structure instead of a story.

## Run it

```bash
npm install
npm run dev
```

Open the app and start with **Morning pour**. That project is generated footage, so the whole room can run before your rushes arrive. The dull counter clip should stay out of the cut.

Export is an H.264 MP4, 1080×1920, AAC, aimed at -14 LUFS. Use the same file for Reels and TikTok. Safe-zone guides mark the top, the right rail, and the caption area.

Your projects stay with this browser on the machine running the server.

## Checks

```bash
npm test
npm run smoke
```

`npm test` covers the story logic. `npm run smoke` generates the sample, assembles it, and exports a real vertical file.
