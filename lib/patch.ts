import { scriptMarkdown, styleMarkdown } from "./agents/markdown";
import { formatCaption } from "./grade";
import { nowIso, uid } from "./ids";
import type { Platform, Project, Script, StyleProfile, TimelineClip } from "./types";

const PLATFORMS = new Set<Platform>(["instagram", "tiktok", "both"]);
const RHYTHMS = new Set<StyleProfile["cutRhythm"]>(["rapid", "measured", "lingering"]);
const GRADES = new Set<StyleProfile["grade"]>(["warm", "neutral", "cool"]);
const CAPTIONS = new Set<StyleProfile["captions"]>(["bold-block", "minimal", "editorial"]);
const CASES = new Set<StyleProfile["captionCase"]>(["upper", "sentence"]);
const POSITIONS = new Set<StyleProfile["captionPosition"]>(["lower", "center"]);
const TRANSITIONS = new Set<StyleProfile["transitions"]>(["hard", "fade"]);
const LENGTHS = new Set([15, 24, 30, 45, 60]);

export type ProjectPatch = {
  title?: string;
  brief?: string;
  platform?: Platform;
  targetDuration?: number;
  style?: Partial<StyleProfile>;
  script?: Script;
  timeline?: TimelineClip[];
  assets?: { id: string; description?: string; name?: string }[];
};

export function applyProjectPatch(project: Project, patch: ProjectPatch) {
  if (typeof patch.title === "string") project.title = clean(patch.title, 80) || project.title;
  if (typeof patch.brief === "string") project.brief = clean(patch.brief, 600);
  if (patch.platform && PLATFORMS.has(patch.platform)) project.platform = patch.platform;
  if (patch.targetDuration && LENGTHS.has(patch.targetDuration)) project.targetDuration = patch.targetDuration;
  if (patch.style && project.style) project.style = mergeStyle(project.style, patch.style);
  if (patch.script) project.script = sanitizeScript(patch.script, project.platform, project.targetDuration);
  if (patch.assets) {
    for (const update of patch.assets) {
      const asset = project.assets.find((item) => item.id === update.id);
      if (!asset) continue;
      if (typeof update.description === "string") asset.description = clean(update.description, 400);
      if (typeof update.name === "string" && clean(update.name, 80)) asset.name = clean(update.name, 80);
    }
  }
  if (patch.timeline) {
    const next = sanitizeTimeline(project, patch.timeline);
    if (JSON.stringify(next) !== JSON.stringify(project.timeline)) {
      project.timelinePast.push(project.timeline.map((clip) => ({ ...clip })));
      if (project.timelinePast.length > 20) project.timelinePast.shift();
      project.timeline = next;
      if (project.conform) project.conform = { ...project.conform, pass: false, suggested: null };
    }
  }
  if (project.style) project.styleMd = styleMarkdown(project);
  if (project.script) {
    project.scriptMd = scriptMarkdown(project);
    project.script.platform = project.platform;
  }
  project.updatedAt = nowIso();
  return project;
}

function mergeStyle(style: StyleProfile, patch: Partial<StyleProfile>): StyleProfile {
  const next = { ...style };
  if (patch.name) next.name = clean(patch.name, 60);
  if (patch.cutRhythm && RHYTHMS.has(patch.cutRhythm)) next.cutRhythm = patch.cutRhythm;
  if (typeof patch.avgShotSec === "number") next.avgShotSec = clamp(patch.avgShotSec, 0.4, 8);
  if (typeof patch.hookSec === "number") next.hookSec = clamp(patch.hookSec, 0.4, 4);
  if (patch.grade && GRADES.has(patch.grade)) next.grade = patch.grade;
  if (patch.captions && CAPTIONS.has(patch.captions)) next.captions = patch.captions;
  if (patch.captionCase && CASES.has(patch.captionCase)) next.captionCase = patch.captionCase;
  if (patch.captionPosition && POSITIONS.has(patch.captionPosition)) next.captionPosition = patch.captionPosition;
  if (patch.transitions && TRANSITIONS.has(patch.transitions)) next.transitions = patch.transitions;
  if (typeof patch.vignette === "boolean") next.vignette = patch.vignette;
  if (typeof patch.contrast === "number") next.contrast = clamp(patch.contrast, 0.8, 1.4);
  if (typeof patch.saturation === "number") next.saturation = clamp(patch.saturation, 0.6, 1.6);
  return next;
}

function sanitizeScript(script: Script, platform: Platform, fallbackDuration: number): Script {
  const roles = new Set(["hook", "context", "turn", "proof", "payoff", "cta"]);
  const beats = (script.beats ?? []).slice(0, 8).map((beat) => ({
    id: typeof beat.id === "string" && beat.id.startsWith("beat_") ? beat.id : uid("beat"),
    role: roles.has(beat.role) ? beat.role : "turn" as const,
    voiceover: clean(beat.voiceover ?? "", 240),
    onScreenText: clean(beat.onScreenText ?? "", 80),
    visualNote: clean(beat.visualNote ?? "", 400),
    durationSec: clamp(Number(beat.durationSec) || 2, 0.6, 15),
  }));
  return {
    title: clean(script.title || "Untitled cut", 80),
    logline: clean(script.logline || "", 220),
    platform,
    targetDuration: LENGTHS.has(script.targetDuration) ? script.targetDuration : fallbackDuration,
    tone: script.tone === "playful" || script.tone === "quiet" ? script.tone : "direct",
    avoid: Array.isArray(script.avoid) ? script.avoid.map((word) => clean(String(word), 32)).filter(Boolean).slice(0, 8) : [],
    beats,
  };
}

function sanitizeTimeline(project: Project, timeline: TimelineClip[]) {
  const assets = new Map(project.assets.map((asset) => [asset.id, asset]));
  return timeline.slice(0, 40).flatMap((clip) => {
    const asset = assets.get(clip.assetId);
    if (!asset) return [];
    const inSec = clamp(Number(clip.inSec) || 0, 0, Math.max(0, asset.duration - 0.35));
    let outSec = clamp(Number(clip.outSec) || inSec + 0.5, inSec + 0.35, asset.duration);
    if (outSec <= inSec) outSec = Math.min(asset.duration, inSec + 0.35);
    const caption = project.style ? formatCaption(clean(clip.caption ?? "", 80), project.style) : clean(clip.caption ?? "", 80);
    return [
      {
        id: typeof clip.id === "string" && /^clp_[a-f0-9]{12}$/.test(clip.id) ? clip.id : uid("clp"),
        assetId: asset.id,
        inSec: round(inSec),
        outSec: round(outSec),
        caption,
        beatId: clip.beatId,
        muted: Boolean(clip.muted),
      },
    ];
  });
}

function clean(value: string, max: number) {
  return value.replace(/\s+/g, " ").trim().slice(0, max);
}

function clamp(value: number, min: number, max: number) {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, value));
}

function round(value: number) {
  return Math.round(value * 100) / 100;
}
