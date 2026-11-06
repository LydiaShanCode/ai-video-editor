import path from "node:path";
import { reviewCut } from "./agents/conform";
import { assembleTimeline } from "./agents/editor";
import { conformMarkdown, scriptMarkdown, selectsMarkdown, styleMarkdown } from "./agents/markdown";
import { workshopScript } from "./agents/script";
import { buildSelects } from "./agents/selects";
import { inferStyle } from "./agents/style";
import { hex, nowIso, uid } from "./ids";
import { projectDir, renderPath } from "./paths";
import { loadProject, saveProject, withProjectLock } from "./store";
import type { LogLine, Project } from "./types";
import { renderTimeline } from "./video/render";

export type Stage = "style" | "script" | "selects" | "assemble" | "conform" | "render" | "undo";

export async function runStage(
  sessionId: string,
  projectId: string,
  stage: Stage,
  options: { message?: string; apply?: boolean } = {},
) {
  return withProjectLock(`${sessionId}:${projectId}`, async () => {
    const project = await loadProject(sessionId, projectId);
    try {
      if (stage === "style") await applyStyle(project);
      else if (stage === "script") applyScript(project, options.message ?? "");
      else if (stage === "selects") applySelects(project);
      else if (stage === "assemble") applyAssemble(project);
      else if (stage === "conform") applyConform(project, Boolean(options.apply));
      else if (stage === "render") await applyRender(sessionId, project);
      else if (stage === "undo") applyUndo(project);
      project.updatedAt = nowIso();
      await saveProject(sessionId, project);
      return project;
    } catch (error) {
      log(project, "Room", error instanceof Error ? error.message : "The room stopped.");
      project.updatedAt = nowIso();
      await saveProject(sessionId, project).catch(() => undefined);
      throw error;
    }
  });
}

async function applyStyle(project: Project) {
  const references = project.assets.filter((asset) => asset.role === "style");
  project.style = inferStyle(references);
  project.styleMd = styleMarkdown(project);
  const rhythm = project.style.cutRhythm;
  const source = references.length
    ? `Read ${references.length} reference${references.length === 1 ? "" : "s"}. `
    : "No reference yet. ";
  log(project, "Style", `${source}${project.style.name} is ${rhythm}, ${project.style.grade}, ${project.style.transitions} cuts, hook by ${project.style.hookSec.toFixed(1)}s. Wrote STYLE.md.`);
}

function applyScript(project: Project, message: string) {
  const footage = project.assets
    .filter((asset) => asset.role === "footage")
    .map((asset) => ({ name: asset.name, description: asset.description, duration: asset.duration }));
  const input = {
    brief: project.brief,
    platform: project.platform,
    targetDuration: project.targetDuration,
    footage,
    tone: project.script?.tone,
  };
  const trimmed = message.trim();
  if (trimmed) {
    project.messages.push({ id: uid("msg"), role: "user", text: trimmed, at: nowIso() });
  }
  const next = workshopScript(trimmed ? project.script : null, input, trimmed);
  project.script = next.script;
  project.targetDuration = next.script.targetDuration;
  project.scriptMd = scriptMarkdown(project);
  project.messages.push({ id: uid("msg"), role: "agent", text: next.reply, at: nowIso() });
  log(project, "Script", `“${next.script.title}”, ${next.script.beats.length} beats, ${next.script.targetDuration}s. Wrote SCRIPT.md.`);
}

function applySelects(project: Project) {
  if (!project.style) project.style = inferStyle(project.assets.filter((asset) => asset.role === "style"));
  const footage = project.assets.filter((asset) => asset.role === "footage");
  if (!footage.length) throw new Error("Add raw footage before pulling selects.");
  project.selects = footage.flatMap((asset) => buildSelects(asset, project.style!));
  project.selectsMd = selectsMarkdown(project);
  const held = project.selects.filter((select) => select.score < 0.12).length;
  log(
    project,
    "Selects",
    `Pulled ${project.selects.length} windows from ${footage.length} clips.${held ? ` Held ${held} that barely move.` : ""} Wrote SELECTS.md.`,
  );
}

function applyAssemble(project: Project) {
  if (!project.script) throw new Error("Workshop a script before assembling.");
  if (!project.selects.length) applySelects(project);
  if (!project.style) project.style = inferStyle(project.assets.filter((asset) => asset.role === "style"));
  remember(project);
  const result = assembleTimeline({
    assets: project.assets,
    selects: project.selects,
    script: project.script,
    style: project.style!,
  });
  project.timeline = result.clips;
  project.selects = result.selects;
  project.selectsMd = selectsMarkdown(project);
  const total = result.clips.reduce((sum, clip) => sum + (clip.outSec - clip.inSec), 0);
  log(project, "Editor", `Assembled ${result.clips.length} shots, ${total.toFixed(1)}s, ${project.style!.transitions} cuts, ${project.style!.captionCase} captions.`);
}

function applyConform(project: Project, apply: boolean) {
  const first = reviewCut(project);
  if (apply && !first.pass) {
    remember(project);
    project.timeline = first.timeline;
    const second = reviewCut(project);
    const applied = first.notes.filter((item) => item.applied);
    project.conform = {
      pass: second.pass,
      notes: [...applied, ...second.notes],
      suggested: second.pass ? null : second.timeline,
      checkedAt: nowIso(),
    };
  } else {
    project.conform = {
      pass: first.pass,
      notes: first.notes,
      suggested: first.pass ? null : first.timeline,
      checkedAt: nowIso(),
    };
  }
  project.conformMd = conformMarkdown(project);
  const headline = project.conform.pass ? "The cut matches the style." : "The style pass wants changes.";
  log(project, "Conform", `${headline} ${project.conform.notes[0]?.text ?? ""}`.trim());
}

async function applyRender(sessionId: string, project: Project) {
  if (!project.style) throw new Error("Read a style before exporting.");
  if (!project.timeline.length) throw new Error("Assemble a timeline before exporting.");
  const id = uid("rnd");
  const output = renderPath(sessionId, project.id, id);
  const probed = await renderTimeline({
    projectDir: projectDir(sessionId, project.id),
    clips: project.timeline,
    assets: project.assets,
    style: project.style,
    outPath: output,
  });
  if (probed.width !== 1080 || probed.height !== 1920) {
    throw new Error(`Export came out ${probed.width}×${probed.height} instead of 1080×1920.`);
  }
  project.renders.unshift({
    id,
    createdAt: nowIso(),
    duration: probed.duration,
    width: probed.width,
    height: probed.height,
    label: "1080×1920",
  });
  project.renders = project.renders.slice(0, 8);
  log(project, "Editor", `Exported ${probed.duration.toFixed(1)}s at 1080×1920 for Reels and TikTok.`);
}

function applyUndo(project: Project) {
  const previous = project.timelinePast.pop();
  if (!previous) throw new Error("Nothing to undo.");
  project.timeline = previous;
  log(project, "Editor", "Restored the previous timeline.");
}

function remember(project: Project) {
  const last = project.timelinePast[project.timelinePast.length - 1];
  if (last && JSON.stringify(last) === JSON.stringify(project.timeline)) return;
  project.timelinePast.push(project.timeline.map((clip) => ({ ...clip })));
  if (project.timelinePast.length > 20) project.timelinePast.shift();
}

function log(project: Project, agent: string, text: string) {
  const line: LogLine = { id: uid("log"), agent, text, at: nowIso() };
  project.log.push(line);
  if (project.log.length > 80) project.log.splice(0, project.log.length - 80);
}

export function emptyProject(input: {
  title: string;
  brief: string;
  platform: Project["platform"];
  targetDuration: number;
  sample?: boolean;
}): Project {
  const stamp = nowIso();
  return {
    id: hex(16),
    title: input.title,
    brief: input.brief,
    platform: input.platform,
    targetDuration: input.targetDuration,
    sample: Boolean(input.sample),
    createdAt: stamp,
    updatedAt: stamp,
    assets: [],
    style: null,
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

export function projectFile(sessionId: string, projectId: string, name: string) {
  return path.join(projectDir(sessionId, projectId), name);
}
