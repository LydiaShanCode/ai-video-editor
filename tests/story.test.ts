import assert from "node:assert/strict";
import test from "node:test";
import { reviewCut } from "../lib/agents/conform";
import { assembleTimeline } from "../lib/agents/editor";
import { draftScript, workshopScript } from "../lib/agents/script";
import { buildSelects } from "../lib/agents/selects";
import { inferStyle } from "../lib/agents/style";
import { formatCaption, wrapCaption } from "../lib/grade";
import { assertProjectId } from "../lib/ids";
import type { Asset, Project, StyleProfile } from "../lib/types";

const style: StyleProfile = {
  name: "Reference",
  cutRhythm: "rapid",
  avgShotSec: 0.8,
  hookSec: 1.2,
  grade: "warm",
  contrast: 1.08,
  saturation: 1.2,
  vignette: false,
  captions: "bold-block",
  captionCase: "upper",
  captionPosition: "lower",
  transitions: "hard",
  targetLufs: -14,
  notes: [],
  sourceAssetIds: ["ast_aaaaaaaaaaaa"],
};

test("a typed caption keeps every letter", () => {
  assert.equal(wrapCaption("TEST CAPTION"), "TEST CAPTION");
  assert.equal(formatCaption("TEST CAPTION", style), "TEST CAPTION");
  assert.equal(wrapCaption("DON'T RUSH THIS"), "DON'T RUSH THIS");
});

test("style reads a fast warm reference as rapid", () => {
  const profile = inferStyle([
    asset({
      id: "ast_aaaaaaaaaaaa",
      role: "style",
      name: "Reference",
      duration: 8,
      metrics: { scenes: [], avgShot: 0.7, shotCount: 10, energy: [0.4], yavg: 90, satavg: 50, uavg: 100, vavg: 140 },
    }),
  ]);
  assert.equal(profile.cutRhythm, "rapid");
  assert.equal(profile.grade, "warm");
  assert.equal(profile.captionCase, "upper");
  assert.equal(profile.transitions, "hard");
});

test("a morning brief drafts a pour and leaves the counter out", () => {
  const script = draftScript({
    brief: "A short film about the ten seconds that make a morning worth getting up for: the pour.",
    platform: "both",
    targetDuration: 24,
    footage: [
      { name: "Window", description: "Wide, slow. Blue morning light on an empty oak table. Quiet on purpose.", duration: 12 },
      { name: "Grind", description: "The grinder chatters. Texture, not the hero.", duration: 9 },
      { name: "Pour", description: "The hero. Coffee leaves the kettle in a ribbon.", duration: 11 },
      { name: "Sip", description: "Payoff. The cup comes up, a pause, a small exhale.", duration: 7 },
      { name: "Counter", description: "Accidental recording. Mostly nothing.", duration: 12 },
    ],
  });
  assert.match(script.beats[0]?.voiceover ?? "", /rush|pour/i);
  assert.ok(script.avoid.includes("counter"));
  assert.ok(!script.beats.some((beat) => /accidental/i.test(beat.visualNote)));
  const total = script.beats.reduce((sum, beat) => sum + beat.durationSec, 0);
  assert.ok(Math.abs(total - 24) < 2, String(total));
});

test("workshop can shorten a cut and keep a quoted hook", () => {
  const current = draftScript({
    brief: "A film about the pour.",
    platform: "tiktok",
    targetDuration: 30,
    footage: [{ name: "Pour", description: "The hero pour.", duration: 8 }],
  });
  const next = workshopScript(current, {
    brief: "A film about the pour.",
    platform: "tiktok",
    targetDuration: 30,
    footage: [{ name: "Pour", description: "The hero pour.", duration: 8 }],
  }, 'Cut it to 15 seconds and the hook is "Listen to the pour."');
  assert.equal(next.script.targetDuration, 15);
  assert.match(next.script.beats[0]?.voiceover ?? "", /Listen to the pour/);
  assert.match(next.reply, /15s/);
});

test("assemble prefers the clip the beat describes and skips an avoided name", () => {
  const pour = asset({ id: "ast_111111111111", name: "Pour", description: "The hero. Coffee leaves the kettle in a ribbon." });
  const counter = asset({ id: "ast_222222222222", name: "Counter", description: "Accidental recording on the counter." });
  const script = draftScript({
    brief: "A film about the pour.",
    platform: "both",
    targetDuration: 15,
    footage: [
      { name: pour.name, description: pour.description, duration: 8 },
      { name: counter.name, description: counter.description, duration: 8 },
    ],
  });
  const selects = [pour, counter].flatMap((item) => buildSelects(item, style));
  const timeline = assembleTimeline({ assets: [pour, counter], selects, script, style });
  const used = new Set(timeline.clips.map((clip) => clip.assetId));
  assert.ok(used.has(pour.id));
  assert.equal(used.has(counter.id), false);
  assert.match(timeline.clips[0]?.caption ?? "", /[A-Z]/);
});

test("conform tightens a slow timeline once, then passes", () => {
  const source = asset({ id: "ast_333333333333", duration: 20 });
  const project = blankProject([source], style);
  project.script = draftScript({
    brief: "A film about the pour.",
    platform: "both",
    targetDuration: 15,
    footage: [{ name: source.name, description: source.description, duration: 20 }],
  });
  project.timeline = [
    { id: "clp_aaaaaaaaaaaa", assetId: source.id, inSec: 0, outSec: 6, caption: "wait for it", beatId: project.script.beats[0]?.id, muted: false },
    { id: "clp_bbbbbbbbbbbb", assetId: source.id, inSec: 6, outSec: 12, caption: "still waiting", beatId: project.script.beats[1]?.id, muted: false },
  ];
  const first = reviewCut(project);
  assert.equal(first.pass, false);
  assert.ok(first.notes.some((note) => note.applied));
  project.timeline = first.timeline;
  const second = reviewCut(project);
  assert.equal(second.pass, true);
});

test("project ids reject path traversal", () => {
  assert.throws(() => assertProjectId("../etc/passwd"));
  assert.throws(() => assertProjectId("not-a-real-id"));
});

function asset(overrides: Partial<Asset> & { id: string }): Asset {
  return {
    role: "footage",
    name: "Clip",
    description: "The hero pour.",
    duration: 10,
    width: 1280,
    height: 720,
    fps: 30,
    hasAudio: true,
    thumbCount: 1,
    ...overrides,
  };
}

function blankProject(assets: Asset[], profile: StyleProfile): Project {
  return {
    id: "a".repeat(32),
    title: "Test",
    brief: "A film about the pour.",
    platform: "both",
    targetDuration: 15,
    sample: false,
    createdAt: "2026-11-06T00:00:00.000Z",
    updatedAt: "2026-11-06T00:00:00.000Z",
    assets,
    style: profile,
    styleMd: "",
    script: null,
    scriptMd: "",
    messages: [],
    selects: [],
    selectsMd: "",
    timeline: [],
    timelinePast: [],
    conform: null,
    conformMd: "",
    renders: [],
    log: [],
  };
}
