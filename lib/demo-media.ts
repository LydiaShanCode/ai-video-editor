import fs from "node:fs/promises";
import path from "node:path";
import type { AssetRole, Platform } from "./types";
import { ffmpegPath, supportsDrawtext } from "./video/bin";
import { ffmpegError, run } from "./video/run";

const DEMO = path.join(process.cwd(), "public", "demo");
const FONT = path.join(process.cwd(), "public", "fonts", "LiberationSans-Bold.ttf");

export type DemoAsset = {
  file: string;
  role: AssetRole;
  name: string;
  description: string;
};

export const DEMO_PROJECT: {
  title: string;
  brief: string;
  platform: Platform;
  targetDuration: number;
  assets: DemoAsset[];
} = {
  title: "Morning pour",
  brief:
    "A short film about the ten seconds that make a morning worth getting up for: the pour. Not the gear. Just the sound and the steam.",
  platform: "both",
  targetDuration: 24,
  assets: [
    {
      file: "style-punchy.mp4",
      role: "style",
      name: "Punchy reference",
      description: "Fast creator reference. Hard cuts, warm grade, bold captions, hook in the first second.",
    },
    {
      file: "raw-window.mp4",
      role: "footage",
      name: "Window",
      description: "Wide, slow. Blue morning light on an empty oak table. Almost still. Quiet on purpose.",
    },
    {
      file: "raw-grind.mp4",
      role: "footage",
      name: "Grind",
      description: "Close, rhythmic. The grinder chatters. Hands are a little clumsy. Texture, not the hero.",
    },
    {
      file: "raw-pour.mp4",
      role: "footage",
      name: "Pour",
      description: "The hero. Coffee leaves the kettle in a ribbon. Steam. The best frame is the middle of the pour.",
    },
    {
      file: "raw-sip.mp4",
      role: "footage",
      name: "Sip",
      description: "Payoff. The cup comes up, a pause, a small exhale. End on the cup lowering.",
    },
    {
      file: "raw-counter.mp4",
      role: "footage",
      name: "Counter",
      description: "Accidental recording. The phone sat on the counter. Mostly nothing. One cupboard around eight seconds.",
    },
  ],
};

export async function ensureDemoMedia() {
  await fs.mkdir(DEMO, { recursive: true });
  const marker = path.join(DEMO, "style-punchy.mp4");
  try {
    await fs.access(marker);
  } catch {
    await generateDemoMedia();
  }
  await fs.writeFile(path.join(DEMO, "manifest.json"), JSON.stringify(DEMO_PROJECT, null, 2), "utf8");
  return DEMO;
}

export async function generateDemoMedia() {
  await fs.mkdir(DEMO, { recursive: true });
  await makeClip({
    file: "style-punchy.mp4",
    size: "720x1280",
    audio: "noise",
    volume: 0.45,
    segments: [
      ["0x1A0D08", "STOP"],
      ["0x3D1A10", "RUSHING"],
      ["0x6A2E16", "THE POUR"],
      ["0x8C3D1C", "STEAM"],
      ["0xC46A32", "HARD CUT"],
      ["0xE0A15C", "ON THE"],
      ["0x5A2814", "CUP"],
      ["0x140C09", "END"],
    ].map(([color, label]) => ({ color, label, dur: 0.7, font: 78 })),
  });
  await makeClip({
    file: "raw-window.mp4",
    size: "720x1280",
    audio: "sine",
    volume: 0.08,
    freq: 110,
    segments: [{ color: "0x1A2836", label: "WINDOW LIGHT", dur: 12, font: 64 }],
  });
  await makeClip({
    file: "raw-grind.mp4",
    size: "720x1280",
    audio: "noise",
    volume: 0.85,
    segments: [
      ["0x2A2118", "HANDS"],
      ["0x3A2A1C", "CHATTER"],
      ["0x241910", "AGAIN"],
      ["0x4A3424", "MESS"],
    ].map(([color, label]) => ({ color, label, dur: 2.25, font: 78 })),
  });
  await makeClip({
    file: "raw-pour.mp4",
    size: "720x1280",
    audio: "sine",
    volume: 0.75,
    freq: 220,
    segments: [
      ["0x4A2414", "RIBBON"],
      ["0x6A3018", "STEAM"],
      ["0x8A4020", "HOLD"],
      ["0x5A2812", "AGAIN"],
      ["0x3A1C10", "CUP"],
    ].map(([color, label]) => ({ color, label, dur: 2.2, font: 84 })),
  });
  await makeClip({
    file: "raw-sip.mp4",
    size: "720x1280",
    audio: "sine",
    volume: 0.28,
    freq: 174,
    segments: [
      ["0x3A2418", "LIFT"],
      ["0x2A1C14", "PAUSE"],
      ["0x1A1410", "DOWN"],
    ].map(([color, label]) => ({ color, label, dur: 2.4, font: 84 })),
  });
  await makeClip({
    file: "raw-counter.mp4",
    size: "720x1280",
    audio: "silent",
    volume: 0,
    segments: [
      { color: "0x12110F", label: "COUNTER", dur: 8, font: 64 },
      { color: "0x3A3834", label: "CUPBOARD", dur: 0.5, font: 64 },
      { color: "0x12110F", label: "COUNTER", dur: 3.5, font: 64 },
    ],
  });
}

async function makeClip(options: {
  file: string;
  size: string;
  segments: { color: string; dur: number; label: string; font: number }[];
  audio: "noise" | "sine" | "silent";
  volume: number;
  freq?: number;
}) {
  const total = options.segments.reduce((sum, segment) => sum + segment.dur, 0);
  const args = ["-y"];
  for (const segment of options.segments) {
    args.push("-f", "lavfi", "-i", `color=c=${segment.color}:s=${options.size}:r=30:d=${segment.dur}`);
  }
  if (options.audio === "sine") {
    args.push("-f", "lavfi", "-i", `sine=frequency=${options.freq ?? 196}:sample_rate=48000:duration=${total.toFixed(2)}`);
  } else if (options.audio === "noise") {
    args.push("-f", "lavfi", "-i", `anoisesrc=color=brown:sample_rate=48000:duration=${total.toFixed(2)}:amplitude=0.45`);
  } else {
    args.push("-f", "lavfi", "-i", "anullsrc=channel_layout=stereo:sample_rate=48000");
  }
  const font = FONT.replace(/\\/g, "\\\\").replace(/:/g, "\\:");
  const labeled = supportsDrawtext();
  const filters = options.segments.map((segment, index) => {
    if (!labeled) return `[${index}:v]null[v${index}]`;
    const label = segment.label.replace(/'/g, "");
    return `[${index}:v]drawtext=fontfile=${font}:text='${label}':fontsize=${segment.font}:fontcolor=white:borderw=6:bordercolor=black@0.55:x=(w-text_w)/2:y=(h-text_h)/2[v${index}]`;
  });
  const inputs = options.segments.map((_, index) => `[v${index}]`).join("");
  const filter = `${filters.join(";")};${inputs}concat=n=${options.segments.length}:v=1:a=0[v]`;
  args.push(
    "-filter_complex",
    filter,
    "-map",
    "[v]",
    "-map",
    `${options.segments.length}:a`,
    "-t",
    total.toFixed(3),
    "-af",
    `volume=${options.volume}`,
    "-c:v",
    "libx264",
    "-pix_fmt",
    "yuv420p",
    "-preset",
    "veryfast",
    "-crf",
    "30",
    "-c:a",
    "aac",
    "-b:a",
    "96k",
    "-movflags",
    "+faststart",
    path.join(DEMO, options.file),
  );
  const result = await run(ffmpegPath(), args, 120000);
  if (result.code !== 0) throw new Error(ffmpegError(result.stderr));
}
