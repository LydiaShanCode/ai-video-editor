import type { Project } from "./types";

export function projectStatus(project: Project) {
  if (!project.assets.some((asset) => asset.role === "footage")) {
    return { label: "Needs footage", tone: "muted" as const };
  }
  if (!project.style) return { label: "Style not read", tone: "muted" as const };
  if (!project.script) return { label: "Script open", tone: "muted" as const };
  if (!project.timeline.length) return { label: "Not assembled", tone: "amber" as const };
  if (project.renders.length && project.conform?.pass) {
    return { label: "Export ready", tone: "pass" as const };
  }
  if (project.conform && !project.conform.pass) {
    return { label: "Style pass open", tone: "amber" as const };
  }
  if (project.renders.length) return { label: "Rendered", tone: "pass" as const };
  return { label: "In the room", tone: "amber" as const };
}

export function timelineDuration(project: Pick<Project, "timeline">) {
  return project.timeline.reduce((sum, clip) => sum + Math.max(0, clip.outSec - clip.inSec), 0);
}
