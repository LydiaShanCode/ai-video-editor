import path from "node:path";
import fs from "node:fs/promises";
import { ffmpegPath, ffprobePath } from "./bin";
import { ffmpegError, run } from "./run";
import type { AssetMetrics } from "../types";

export type Probe = {
  duration: number;
  width: number;
  height: number;
  fps: number;
  hasAudio: boolean;
  videoCodec: string;
};

export async function probeFile(file: string): Promise<Probe> {
  const result = await run(ffprobePath(), [
    "-v",
    "error",
    "-print_format",
    "json",
    "-show_format",
    "-show_streams",
    file,
  ]);
  if (result.code !== 0) throw new Error("That file doesn't look like a video.");
  const parsed = JSON.parse(result.stdout) as {
    format?: { duration?: string };
    streams?: { codec_type?: string; codec_name?: string; width?: number; height?: number; avg_frame_rate?: string }[];
  };
  const video = parsed.streams?.find((stream) => stream.codec_type === "video");
  if (!video?.width || !video.height) throw new Error("That file doesn't have a picture track.");
  const audio = parsed.streams?.some((stream) => stream.codec_type === "audio") ?? false;
  return {
    duration: Number(parsed.format?.duration ?? 0),
    width: video.width,
    height: video.height,
    fps: parseFps(video.avg_frame_rate),
    hasAudio: audio,
    videoCodec: video.codec_name ?? "",
  };
}

export async function transcodeToMp4(input: string, output: string) {
  await fs.mkdir(path.dirname(output), { recursive: true });
  const result = await run(
    ffmpegPath(),
    [
      "-y",
      "-i",
      input,
      "-map",
      "0:v:0",
      "-map",
      "0:a?",
      "-vf",
      "scale=min(1920\\,iw):-2",
      "-c:v",
      "libx264",
      "-preset",
      "veryfast",
      "-crf",
      "22",
      "-pix_fmt",
      "yuv420p",
      "-c:a",
      "aac",
      "-ac",
      "2",
      "-ar",
      "48000",
      "-movflags",
      "+faststart",
      output,
    ],
    240000,
  );
  if (result.code !== 0) {
    const fallback = await run(
      ffmpegPath(),
      [
        "-y",
        "-i",
        input,
        "-map",
        "0:v:0",
        "-vf",
        "scale=min(1920\\,iw):-2",
        "-c:v",
        "libx264",
        "-preset",
        "veryfast",
        "-crf",
        "22",
        "-pix_fmt",
        "yuv420p",
        "-an",
        "-movflags",
        "+faststart",
        output,
      ],
      240000,
    );
    if (fallback.code !== 0) throw new Error(ffmpegError(fallback.stderr || result.stderr));
  }
}

export async function analyzeVideo(file: string, duration: number): Promise<AssetMetrics> {
  const [scenes, energy, color] = await Promise.all([
    detectScenes(file).catch(() => [] as { time: number; score: number }[]),
    detectEnergy(file, duration).catch(() => [] as number[]),
    detectColor(file).catch(() => ({ yavg: null, satavg: null, uavg: null, vavg: null })),
  ]);
  const cuts = [0, ...scenes.map((scene) => scene.time).filter((time) => time > 0.05 && time < duration - 0.05), duration];
  const unique = [...new Set(cuts)].sort((a, b) => a - b);
  const shots = [];
  for (let index = 0; index < unique.length - 1; index += 1) {
    const length = unique[index + 1]! - unique[index]!;
    if (length > 0.05) shots.push(length);
  }
  const avgShot = shots.length ? shots.reduce((sum, length) => sum + length, 0) / shots.length : duration;
  return {
    scenes,
    avgShot,
    shotCount: Math.max(1, shots.length),
    energy,
    ...color,
  };
}

export async function writeThumbs(file: string, directory: string, duration: number) {
  await fs.rm(directory, { recursive: true, force: true });
  await fs.mkdir(directory, { recursive: true });
  const count = Math.min(6, Math.max(1, Math.round(duration / 2)));
  for (let index = 0; index < count; index += 1) {
    const at = Math.min(duration - 0.05, Math.max(0, duration * ((index + 0.5) / count)));
    const output = path.join(directory, `${index}.jpg`);
    const result = await run(ffmpegPath(), [
      "-y",
      "-ss",
      at.toFixed(3),
      "-i",
      file,
      "-frames:v",
      "1",
      "-vf",
      "scale=320:-2",
      output,
    ]);
    if (result.code !== 0) break;
  }
  const files = await fs.readdir(directory);
  return files.filter((name) => name.endsWith(".jpg")).length;
}

async function detectScenes(file: string) {
  const result = await run(ffmpegPath(), [
    "-hide_banner",
    "-i",
    file,
    "-filter:v",
    "select='gt(scene,0.28)',metadata=print:file=-",
    "-an",
    "-f",
    "null",
    "-",
  ]);
  const text = `${result.stdout}\n${result.stderr}`;
  const scenes: { time: number; score: number }[] = [];
  const blocks = text.split(/frame:\d+/);
  for (const block of blocks) {
    const time = /pts_time:([0-9.]+)/.exec(block);
    const score = /lavfi\.scene_score=([0-9.]+)/.exec(block);
    if (!time) continue;
    scenes.push({ time: Number(time[1]), score: score ? Number(score[1]) : 0.4 });
  }
  return scenes;
}

async function detectEnergy(file: string, duration: number) {
  const result = await run(ffmpegPath(), [
    "-hide_banner",
    "-i",
    file,
    "-af",
    "astats=metadata=1:reset=1,ametadata=print:key=lavfi.astats.Overall.RMS_level:file=-",
    "-vn",
    "-f",
    "null",
    "-",
  ]);
  const buckets = Array.from({ length: Math.max(1, Math.ceil(duration)) }, () => ({ sum: 0, count: 0 }));
  const text = `${result.stdout}\n${result.stderr}`;
  const pattern = /pts_time:([0-9.]+)[\s\S]{0,180}?lavfi\.astats\.Overall\.RMS_level=([-\d.inf]+)/g;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(text))) {
    const time = Number(match[1]);
    const raw = match[2] ?? "";
    const db = raw.includes("inf") ? -80 : Number(raw);
    const index = Math.min(buckets.length - 1, Math.max(0, Math.floor(time)));
    const bucket = buckets[index];
    if (!bucket) continue;
    bucket.sum += dbToUnit(db);
    bucket.count += 1;
  }
  return buckets.map((bucket) => (bucket.count ? bucket.sum / bucket.count : 0));
}

async function detectColor(file: string) {
  const result = await run(ffmpegPath(), [
    "-hide_banner",
    "-i",
    file,
    "-vf",
    "fps=1,scale=16:16,signalstats,metadata=print:file=-",
    "-frames:v",
    "6",
    "-an",
    "-f",
    "null",
    "-",
  ]);
  const text = `${result.stdout}\n${result.stderr}`;
  return {
    yavg: averageKey(text, "lavfi.signalstats.YAVG"),
    satavg: averageKey(text, "lavfi.signalstats.SATAVG"),
    uavg: averageKey(text, "lavfi.signalstats.UAVG"),
    vavg: averageKey(text, "lavfi.signalstats.VAVG"),
  };
}

function averageKey(text: string, key: string) {
  const values: number[] = [];
  const pattern = new RegExp(`${key}=([-\\d.]+)`, "g");
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(text))) values.push(Number(match[1]));
  if (!values.length) return null;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function dbToUnit(db: number) {
  if (!Number.isFinite(db)) return 0;
  return Math.max(0, Math.min(1, (db + 48) / 48));
}

function parseFps(value?: string) {
  if (!value || value === "0/0") return 30;
  const [num, den] = value.split("/").map(Number);
  if (!den) return num || 30;
  return Math.round((num / den) * 100) / 100;
}
