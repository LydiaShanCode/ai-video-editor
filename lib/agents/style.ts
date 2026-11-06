import { mean } from "../text";
import type { Asset, StyleProfile } from "../types";

const HOUSE: StyleProfile = {
  name: "House reel",
  cutRhythm: "rapid",
  avgShotSec: 1.1,
  hookSec: 1.4,
  grade: "warm",
  contrast: 1.08,
  saturation: 1.18,
  vignette: false,
  captions: "bold-block",
  captionCase: "upper",
  captionPosition: "lower",
  transitions: "hard",
  targetLufs: -14,
  notes: [
    "No reference uploaded. This is the house style for Reels and TikToks: fast, warm, captioned, hard cuts.",
    "Upload a video whose pace you want, then read the reference again.",
  ],
  sourceAssetIds: [],
};

export function inferStyle(references: Asset[]): StyleProfile {
  const readable = references.filter((asset) => asset.metrics && asset.duration > 0);
  if (!readable.length) return { ...HOUSE, notes: [...HOUSE.notes] };

  const weight = readable.reduce((sum, asset) => sum + asset.duration, 0);
  const avgShot =
    readable.reduce((sum, asset) => sum + (asset.metrics?.avgShot ?? 1.2) * asset.duration, 0) / weight;
  const cutRhythm = avgShot < 1.25 ? "rapid" : avgShot < 2.7 ? "measured" : "lingering";
  const sats = readable.map((asset) => asset.metrics?.satavg).filter((value): value is number => value != null);
  const us = readable.map((asset) => asset.metrics?.uavg).filter((value): value is number => value != null);
  const vs = readable.map((asset) => asset.metrics?.vavg).filter((value): value is number => value != null);
  const sat = sats.length ? mean(sats) : null;
  const warmScore = vs.length && us.length ? mean(vs) - mean(us) : 0;
  const grade = warmScore > 6 ? "warm" : warmScore < -6 ? "cool" : "neutral";
  const saturation = sat == null ? (cutRhythm === "lingering" ? 1 : 1.16) : sat > 40 ? 1.28 : sat > 18 ? 1.12 : 0.96;
  const landscape = readable.some((asset) => asset.width > asset.height);

  const notes = [
    `Average shot is ${avgShot.toFixed(2)}s across ${readable.length} reference${readable.length === 1 ? "" : "s"}.`,
    grade === "neutral"
      ? "Color reads neutral, so the grade stays quiet."
      : `Color sits ${grade}.`,
    cutRhythm === "rapid"
      ? "Captions are bold, upper case, and parked in the lower third."
      : cutRhythm === "measured"
        ? "Captions stay bold, in sentence case."
        : "Captions are editorial and the cuts are allowed to breathe.",
    "No music bed is added. Source audio is kept and normalized to -14 LUFS.",
  ];
  if (landscape) {
    notes.push("The reference is not vertical. Pace and grade carry over. The finish is still 1080×1920.");
  }
  if (sat == null) notes.push("Saturation couldn't be read, so it follows the pace.");

  return {
    name: readable[0]?.name || "Reference",
    cutRhythm,
    avgShotSec: round(avgShot),
    hookSec: round(Math.min(2.2, Math.max(0.8, avgShot * 1.6))),
    grade,
    contrast: cutRhythm === "lingering" ? 1.04 : 1.08,
    saturation: round(saturation),
    vignette: cutRhythm === "lingering",
    captions: cutRhythm === "lingering" ? "editorial" : cutRhythm === "measured" ? "bold-block" : "bold-block",
    captionCase: cutRhythm === "rapid" ? "upper" : "sentence",
    captionPosition: cutRhythm === "lingering" ? "center" : "lower",
    transitions: cutRhythm === "lingering" ? "fade" : "hard",
    targetLufs: -14,
    notes,
    sourceAssetIds: readable.map((asset) => asset.id),
  };
}

function round(value: number) {
  return Math.round(value * 100) / 100;
}
