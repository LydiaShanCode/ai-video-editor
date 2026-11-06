import path from "node:path";
import fs from "node:fs/promises";
import { gradeFilter, wrapCaption } from "../grade";
import type { Asset, StyleProfile, TimelineClip } from "../types";
import { probeFile } from "./analyze";
import { ffmpegPath } from "./bin";
import { writeCaptionCard } from "./caption";
import { ffmpegError, run } from "./run";

export async function renderTimeline(options: {
  projectDir: string;
  clips: TimelineClip[];
  assets: Asset[];
  style: StyleProfile;
  outPath: string;
}) {
  if (!options.clips.length) throw new Error("The timeline is empty.");
  const work = path.join(options.projectDir, "work");
  await fs.rm(work, { recursive: true, force: true });
  await fs.mkdir(work, { recursive: true });
  const parts: string[] = [];
  let total = 0;

  for (let index = 0; index < options.clips.length; index += 1) {
    const clip = options.clips[index]!;
    const asset = options.assets.find((item) => item.id === clip.assetId);
    if (!asset) throw new Error("A timeline clip points at footage that is gone.");
    const duration = Math.max(0.35, clip.outSec - clip.inSec);
    if (total + duration > 90.2) break;
    total += duration;
    const part = path.join(work, `part-${index}.mp4`);
    const caption = wrapCaption(clip.caption || "");
    const card = path.join(work, `cap-${index}.png`);
    const drew = caption.trim() ? await writeCaptionCard(card, caption, options.style) : false;
    const source = path.join(options.projectDir, "media", `${asset.id}.mp4`);
    const fade =
      options.style.transitions === "fade" && duration > 0.45
        ? `,fade=t=in:st=0:d=0.08,fade=t=out:st=${Math.max(0, duration - 0.08).toFixed(3)}:d=0.08`
        : "";
    const base = `scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,setsar=1,fps=30,${gradeFilter(options.style)}${fade}`;
    const silent = clip.muted || !asset.hasAudio;
    const args = ["-y", "-ss", clip.inSec.toFixed(3), "-t", duration.toFixed(3), "-i", source];
    if (silent) {
      args.push("-f", "lavfi", "-t", duration.toFixed(3), "-i", "anullsrc=channel_layout=stereo:sample_rate=48000");
    }
    if (drew) args.push("-loop", "1", "-i", card);
    const audioMap = silent ? "1:a:0" : "0:a:0";
    const cardIndex = silent ? 2 : 1;
    if (drew) {
      args.push(
        "-filter_complex",
        `[0:v]${base}[base];[base][${cardIndex}:v]overlay=0:0:format=auto[v]`,
        "-map",
        "[v]",
        "-map",
        audioMap,
      );
    } else {
      args.push("-vf", base, "-map", "0:v:0", "-map", audioMap);
    }
    args.push(
      "-r",
      "30",
      "-c:v",
      "libx264",
      "-preset",
      "veryfast",
      "-crf",
      "20",
      "-pix_fmt",
      "yuv420p",
      "-c:a",
      "aac",
      "-b:a",
      "160k",
      "-ar",
      "48000",
      "-ac",
      "2",
      "-shortest",
      "-movflags",
      "+faststart",
      part,
    );
    const result = await run(ffmpegPath(), args, 180000);
    if (result.code !== 0) throw new Error(ffmpegError(result.stderr));
    parts.push(part);
  }

  if (!parts.length) throw new Error("Nothing in the timeline was long enough to export.");
  const list = path.join(work, "list.txt");
  await fs.writeFile(list, parts.map((part) => `file '${part.replace(/'/g, "'\\''")}'`).join("\n"), "utf8");
  await fs.mkdir(path.dirname(options.outPath), { recursive: true });
  const loud = await run(
    ffmpegPath(),
    [
      "-y",
      "-f",
      "concat",
      "-safe",
      "0",
      "-i",
      list,
      "-c:v",
      "libx264",
      "-preset",
      "veryfast",
      "-crf",
      "20",
      "-pix_fmt",
      "yuv420p",
      "-c:a",
      "aac",
      "-b:a",
      "160k",
      "-ar",
      "48000",
      "-ac",
      "2",
      "-af",
      "loudnorm=I=-14:TP=-1.5:LRA=11",
      "-movflags",
      "+faststart",
      options.outPath,
    ],
    180000,
  );
  if (loud.code !== 0) {
    const plain = await run(
      ffmpegPath(),
      [
        "-y",
        "-f",
        "concat",
        "-safe",
        "0",
        "-i",
        list,
        "-c:v",
        "libx264",
        "-preset",
        "veryfast",
        "-crf",
        "20",
        "-pix_fmt",
        "yuv420p",
        "-c:a",
        "aac",
        "-b:a",
        "160k",
        "-ar",
        "48000",
        "-ac",
        "2",
        "-movflags",
        "+faststart",
        options.outPath,
      ],
      180000,
    );
    if (plain.code !== 0) throw new Error(ffmpegError(plain.stderr || loud.stderr));
  }
  await fs.rm(work, { recursive: true, force: true });
  const probed = await probeFile(options.outPath);
  return { duration: probed.duration, width: probed.width, height: probed.height };
}
