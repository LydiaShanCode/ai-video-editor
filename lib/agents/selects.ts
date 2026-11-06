import { uid } from "../ids";
import { clamp } from "../text";
import type { Asset, Select, StyleProfile } from "../types";

export function buildSelects(asset: Asset, style: StyleProfile): Select[] {
  const duration = asset.duration;
  if (duration < 0.4) return [];
  const target = clamp(style.avgShotSec || 1.2, 0.6, 4.5);
  const scenes = asset.metrics?.scenes ?? [];
  const cuts = [0, ...scenes.map((scene) => scene.time).filter((time) => time > 0.15 && time < duration - 0.15), duration];
  const points = [...new Set(cuts.map((time) => Math.round(time * 100) / 100))].sort((a, b) => a - b);
  const windows: { inSec: number; outSec: number; scene: boolean }[] = [];

  for (let index = 0; index < points.length - 1; index += 1) {
    const start = points[index]!;
    const end = points[index + 1]!;
    if (end - start < 0.45) continue;
    if (end - start <= target * 2.1) {
      windows.push({ inSec: start, outSec: end, scene: hasScene(scenes, start, end) });
      continue;
    }
    const length = target;
    for (let time = start; time + 0.55 < end; time += length * 0.85) {
      const outSec = Math.min(end, time + length);
      windows.push({ inSec: time, outSec, scene: hasScene(scenes, time, outSec) });
    }
  }
  if (!windows.length) {
    windows.push({ inSec: 0, outSec: Math.min(duration, Math.max(target, 1)), scene: false });
  }

  const scored = windows.map((window) => {
    const energy = averageEnergy(asset.metrics?.energy ?? [], window.inSec, window.outSec);
    const silent = energy < 0.02 && !window.scene;
    const lengthPenalty = Math.min(0.2, Math.abs(window.outSec - window.inSec - target) * 0.04);
    const score = silent
      ? 0.05
      : clamp(0.34 + energy * 0.48 + (window.scene ? 0.14 : 0) - lengthPenalty, 0, 1);
    return { ...window, energy, score };
  });

  return spread(scored, duration, 3).map((window) => ({
    id: uid("sel"),
    assetId: asset.id,
    inSec: round(window.inSec),
    outSec: round(window.outSec),
    score: round(window.score),
    reason: reason(window.energy, window.scene, window.score),
    used: false,
  }));
}

function spread<T extends { inSec: number; outSec: number; score: number }>(windows: T[], duration: number, count: number) {
  const picked: T[] = [];
  for (let third = 0; third < 3; third += 1) {
    const group = windows
      .filter((window) => {
        const mid = ((window.inSec + window.outSec) / 2) / duration;
        return mid >= third / 3 && mid < (third + 1) / 3;
      })
      .sort((a, b) => b.score - a.score);
    if (group[0]) picked.push(group[0]);
  }
  const rest = [...windows].sort((a, b) => b.score - a.score || a.inSec - b.inSec);
  for (const window of rest) {
    if (picked.length >= count) break;
    if (picked.some((item) => overlaps(item, window))) continue;
    picked.push(window);
  }
  return picked.sort((a, b) => a.inSec - b.inSec).slice(0, count);
}

function hasScene(scenes: { time: number }[], start: number, end: number) {
  return scenes.some((scene) => scene.time >= start - 0.05 && scene.time <= end + 0.05);
}

function averageEnergy(energy: number[], start: number, end: number) {
  if (!energy.length) return 0.2;
  const from = Math.max(0, Math.floor(start));
  const to = Math.min(energy.length - 1, Math.max(from, Math.ceil(end) - 1));
  let sum = 0;
  let count = 0;
  for (let index = from; index <= to; index += 1) {
    sum += energy[index] ?? 0;
    count += 1;
  }
  return count ? sum / count : 0;
}

function overlaps(a: { inSec: number; outSec: number }, b: { inSec: number; outSec: number }) {
  const start = Math.max(a.inSec, b.inSec);
  const end = Math.min(a.outSec, b.outSec);
  if (end <= start) return false;
  const shared = end - start;
  const shorter = Math.min(a.outSec - a.inSec, b.outSec - b.inSec);
  return shared / shorter > 0.45;
}

function reason(energy: number, scene: boolean, score: number) {
  if (score < 0.12) return "Almost still and silent. Held unless the script asks for nothing.";
  if (scene && energy > 0.4) return "The frame changes and the sound shows up. This is a keeper.";
  if (energy > 0.55) return "The busiest passage in the clip.";
  if (scene) return "A real cut point, even if the sound is thin.";
  if (energy < 0.12) return "Quiet on purpose. Useful when the script wants stillness.";
  return "Usable, but not the moment the eye stays on.";
}

function round(value: number) {
  return Math.round(value * 100) / 100;
}
