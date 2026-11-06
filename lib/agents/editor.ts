import { formatCaption } from "../grade";
import { uid } from "../ids";
import { overlapCount } from "../text";
import type { Asset, Script, Select, StyleProfile, TimelineClip } from "../types";

export function assembleTimeline(input: {
  assets: Asset[];
  selects: Select[];
  script: Script;
  style: StyleProfile;
}): { clips: TimelineClip[]; selects: Select[] } {
  const assets = new Map<string, Asset>(input.assets.map((asset) => [asset.id, asset]));
  const selects = input.selects.map((select) => ({ ...select, used: false }));
  const used = new Set<string>();
  const clips: TimelineClip[] = [];

  for (const beat of input.script.beats) {
    let remaining = beat.durationSec;
    let guard = 0;
    while (remaining > 0.35 && guard < 6) {
      guard += 1;
      const chosen = choose(selects, used, assets, beat.visualNote, beat.voiceover, input.script.avoid);
      if (!chosen) break;
      const asset = assets.get(chosen.assetId);
      if (!asset) break;
      const shot = shotLength(input.style, beat.durationSec);
      const want = remaining - shot < 0.4 ? remaining : Math.min(remaining, shot);
      const prior = clips.filter((clip) => clip.assetId === asset.id).length;
      const range = fitRange(asset.duration, chosen, want, prior);
      used.add(chosen.id);
      chosen.used = true;
      clips.push({
        id: uid("clp"),
        assetId: asset.id,
        inSec: range.inSec,
        outSec: range.outSec,
        caption: formatCaption(beat.onScreenText, input.style),
        beatId: beat.id,
        muted: false,
      });
      remaining -= range.outSec - range.inSec;
      if (range.outSec - range.inSec < 0.3) break;
    }
  }

  return { clips, selects };
}

function choose(
  selects: Select[],
  used: Set<string>,
  assets: Map<string, Asset>,
  visualNote: string,
  voiceover: string,
  avoid: string[],
): Select | null {
  const label = (select: Select) => {
    const asset = assets.get(select.assetId);
    return asset ? `${asset.name} ${asset.description}` : "";
  };
  const avoided = (select: Select) => {
    const text = label(select).toLowerCase();
    if (!text) return true;
    return avoid.some((word) => word.length > 2 && text.includes(word.toLowerCase()));
  };
  const haystack = `${visualNote} ${voiceover}`;
  const ranked = selects.map((select) => ({
    select,
    overlap: overlapCount(label(select), haystack),
    used: used.has(select.id),
    avoided: avoided(select),
  }));
  const open = ranked.filter((item) => !item.avoided);
  const pool = open.length ? open : ranked;
  const bestOverlap = pool.reduce((best, item) => Math.max(best, item.overlap), 0);
  const matching = bestOverlap > 0 ? pool.filter((item) => item.overlap === bestOverlap) : pool;
  const fresh = matching.filter((item) => !item.used);
  const list = (fresh.length ? fresh : matching).map((item) => item.select);
  let best: Select | null = null;
  let bestScore = -Infinity;
  for (const select of list) {
    const asset = assets.get(select.assetId);
    if (!asset) continue;
    const text = `${asset.name} ${asset.description}`;
    const rank = select.score + overlapCount(text, `${visualNote} ${voiceover}`) * 0.22;
    if (rank > bestScore) {
      best = select;
      bestScore = rank;
    }
  }
  if (best && best.score < 0.08 && overlapCount(assets.get(best.assetId)?.description ?? "", visualNote) === 0) {
    return null;
  }
  return best;
}

function shotLength(style: StyleProfile, beatDuration: number) {
  if (style.cutRhythm === "rapid") return Math.min(beatDuration, Math.max(0.55, style.avgShotSec * 1.2));
  if (style.cutRhythm === "measured") return Math.min(beatDuration, Math.max(style.avgShotSec, 1.5));
  return beatDuration;
}

function fitRange(duration: number, select: Select, want: number, prior: number) {
  const center = prior === 0 ? (select.inSec + select.outSec) / 2 : ((prior + 0.5) / (prior + 3)) * duration;
  let inSec = center - want / 2;
  let outSec = center + want / 2;
  if (inSec < 0) {
    outSec -= inSec;
    inSec = 0;
  }
  if (outSec > duration) {
    inSec -= outSec - duration;
    outSec = duration;
  }
  inSec = Math.max(0, inSec);
  outSec = Math.max(inSec + 0.35, Math.min(duration, outSec));
  return { inSec: round(inSec), outSec: round(outSec) };
}

function round(value: number) {
  return Math.round(value * 100) / 100;
}
