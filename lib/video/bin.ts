import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);

let binary: string | null = null;
let drawtext: boolean | null = null;

export function ffmpegPath() {
  if (binary) return binary;
  const system = spawnSync("ffmpeg", ["-version"], { encoding: "utf8" });
  if (system.status === 0) {
    binary = "ffmpeg";
    return binary;
  }
  try {
    const bundled = require("ffmpeg-static") as string | null;
    if (bundled) {
      binary = bundled;
      return binary;
    }
  } catch {
    /* use the name and let the caller fail clearly */
  }
  binary = "ffmpeg";
  return binary;
}

export function supportsDrawtext() {
  if (drawtext != null) return drawtext;
  const result = spawnSync(ffmpegPath(), ["-hide_banner", "-filters"], { encoding: "utf8" });
  drawtext = `${result.stdout}\n${result.stderr}`.includes("drawtext");
  return drawtext;
}

export function ffprobePath() {
  try {
    const bundled = require("ffprobe-static") as { path?: string };
    if (bundled?.path) return bundled.path;
  } catch {
    /* fall through */
  }
  return "ffprobe";
}
