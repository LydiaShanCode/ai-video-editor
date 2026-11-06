import { formatCaption } from "../grade";
import { uid } from "../ids";
import { mean } from "../text";
import type { Asset, ConformNote, Project, StyleProfile, TimelineClip } from "../types";

export function reviewCut(project: Project): { pass: boolean; notes: ConformNote[]; timeline: TimelineClip[] } {
  const style = project.style;
  const script = project.script;
  const timeline = project.timeline.map((clip) => ({ ...clip }));
  const notes: ConformNote[] = [];
  if (!style || !script) {
    return {
      pass: false,
      timeline,
      notes: [note("fix", false, "Style and script both have to exist before the cut can be checked.")],
    };
  }
  if (!timeline.length) {
    return {
      pass: false,
      timeline,
      notes: [note("fix", false, "The timeline is empty, so there is nothing to match against the reference.")],
    };
  }

  const assets = new Map(project.assets.map((asset) => [asset.id, asset]));
  tightenOrExtend(timeline, style, assets, notes);
  fixCaptions(timeline, style, script, notes);
  fixHook(timeline, style, notes);
  fixDuration(timeline, script.targetDuration, notes);

  const durations = timeline.map((clip) => clip.outSec - clip.inSec);
  const average = mean(durations);
  const total = durations.reduce((sum, value) => sum + value, 0);
  const changed = JSON.stringify(timeline) !== JSON.stringify(project.timeline);
  if (!changed) {
    notes.unshift(
      note(
        "note",
        false,
        `Shots average ${average.toFixed(1)}s against a ${style.avgShotSec.toFixed(1)}s reference. Runtime ${total.toFixed(1)}s. Hook is ${(timeline[0]!.outSec - timeline[0]!.inSec).toFixed(1)}s.`,
      ),
    );
  }
  const unresolved = notes.some((item) => item.severity === "fix" && !item.applied);
  return { pass: !changed && !unresolved, notes, timeline };
}

function tightenOrExtend(
  timeline: TimelineClip[],
  style: StyleProfile,
  assets: Map<string, Asset>,
  notes: ConformNote[],
) {
  const average = mean(timeline.map((clip) => clip.outSec - clip.inSec));
  if (style.cutRhythm === "rapid" && average > style.avgShotSec * 1.5) {
    let touched = 0;
    for (const clip of timeline) {
      const length = clip.outSec - clip.inSec;
      const goal = Math.max(0.55, style.avgShotSec * 1.15);
      if (length <= goal * 1.2) continue;
      const mid = (clip.inSec + clip.outSec) / 2;
      clip.inSec = round(mid - goal / 2);
      clip.outSec = round(mid + goal / 2);
      touched += 1;
    }
    if (touched) {
      notes.push(
        note(
          "fix",
          true,
          `Shots averaged ${average.toFixed(1)}s. The reference cuts closer to ${style.avgShotSec.toFixed(1)}s, so ${touched} long shot${touched === 1 ? "" : "s"} got tightened.`,
        ),
      );
    }
  }
  if (style.cutRhythm === "lingering" && average < style.avgShotSec * 0.6) {
    let touched = 0;
    for (const clip of timeline) {
      const asset = assets.get(clip.assetId);
      if (!asset) continue;
      const length = clip.outSec - clip.inSec;
      const goal = style.avgShotSec;
      if (length >= goal * 0.85) continue;
      const add = Math.min(asset.duration - clip.outSec, goal - length);
      if (add > 0.2) {
        clip.outSec = round(clip.outSec + add);
        touched += 1;
      }
    }
    if (touched) {
      notes.push(
        note(
          "fix",
          true,
          `The reference lingers around ${style.avgShotSec.toFixed(1)}s and this cut was chopped faster. I lengthened ${touched} shot${touched === 1 ? "" : "s"} where the source still had picture.`,
        ),
      );
    }
  }
}

function fixCaptions(
  timeline: TimelineClip[],
  style: StyleProfile,
  script: Project["script"],
  notes: ConformNote[],
) {
  if (!script || style.captions === "minimal") return;
  let filled = 0;
  let recased = 0;
  timeline.forEach((clip, index) => {
    if (!clip.caption.trim()) {
      const beat = script.beats.find((item) => item.id === clip.beatId) ?? script.beats[index] ?? script.beats[0];
      clip.caption = formatCaption(beat?.onScreenText || script.title, style);
      filled += 1;
    } else {
      const next = formatCaption(clip.caption, style);
      if (next !== clip.caption) {
        clip.caption = next;
        recased += 1;
      }
    }
  });
  if (filled) notes.push(note("fix", true, `The reference uses captions. ${filled} shot${filled === 1 ? "" : "s"} had none, so the script line went on screen.`));
  if (recased) {
    notes.push(
      note(
        "fix",
        true,
        style.captionCase === "upper"
          ? "Captions were recased to upper, matching the reference."
          : "Captions were put back into sentence case.",
      ),
    );
  }
}

function fixHook(timeline: TimelineClip[], style: StyleProfile, notes: ConformNote[]) {
  const hook = timeline[0];
  if (!hook) return;
  const length = hook.outSec - hook.inSec;
  const limit = style.hookSec * 1.8;
  if (length > limit && length - style.hookSec > 0.25) {
    hook.outSec = round(hook.inSec + style.hookSec);
    notes.push(
      note(
        "fix",
        true,
        `The hook ran ${length.toFixed(1)}s. The reference lands by ${style.hookSec.toFixed(1)}s, so the first shot was shortened.`,
      ),
    );
  }
}

function fixDuration(timeline: TimelineClip[], target: number, notes: ConformNote[]) {
  const total = timeline.reduce((sum, clip) => sum + (clip.outSec - clip.inSec), 0);
  if (total <= target * 1.15 || timeline.length < 2) return;
  let over = total - target;
  const order = timeline
    .map((clip, index) => ({ clip, index }))
    .filter((item) => item.index !== 0)
    .sort((a, b) => b.clip.outSec - b.clip.inSec - (a.clip.outSec - a.clip.inSec));
  for (const item of order) {
    if (over <= 0.15) break;
    const length = item.clip.outSec - item.clip.inSec;
    const cut = Math.min(over, Math.max(0, length - 0.7));
    if (cut <= 0) continue;
    item.clip.outSec = round(item.clip.outSec - cut);
    over -= cut;
  }
  const next = timeline.reduce((sum, clip) => sum + (clip.outSec - clip.inSec), 0);
  if (next < total - 0.2) {
    notes.push(note("fix", true, `The cut ran ${total.toFixed(1)}s against a ${target}s outline. Later shots were trimmed to ${next.toFixed(1)}s.`));
  }
}

function note(severity: "fix" | "note", applied: boolean, text: string): ConformNote {
  return { id: uid("note"), severity, applied, text };
}

function round(value: number) {
  return Math.round(value * 100) / 100;
}
