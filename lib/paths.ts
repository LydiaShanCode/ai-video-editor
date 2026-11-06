import path from "node:path";
import { assertAssetId, assertProjectId, assertRenderId, assertSessionId } from "./ids";

const ROOT = path.join(process.cwd(), "data", "sessions");

function inside(child: string, parent: string) {
  const resolved = path.resolve(child);
  const base = path.resolve(parent);
  if (resolved !== base && !resolved.startsWith(base + path.sep)) {
    throw new Error("That path is not in the cutting room.");
  }
  return resolved;
}

export function sessionDir(sessionId: string) {
  assertSessionId(sessionId);
  return inside(path.join(ROOT, sessionId), ROOT);
}

export function projectsDir(sessionId: string) {
  return inside(path.join(sessionDir(sessionId), "projects"), sessionDir(sessionId));
}

export function projectDir(sessionId: string, projectId: string) {
  assertProjectId(projectId);
  return inside(path.join(projectsDir(sessionId), projectId), projectsDir(sessionId));
}

export function mediaPath(sessionId: string, projectId: string, assetId: string) {
  assertAssetId(assetId);
  return inside(path.join(projectDir(sessionId, projectId), "media", `${assetId}.mp4`), projectDir(sessionId, projectId));
}

export function thumbPath(sessionId: string, projectId: string, assetId: string, frame: string) {
  if (!/^\d{1,2}$/.test(frame)) throw new Error("Unknown frame.");
  assertAssetId(assetId);
  return inside(
    path.join(projectDir(sessionId, projectId), "thumbs", assetId, `${frame}.jpg`),
    projectDir(sessionId, projectId),
  );
}

export function renderPath(sessionId: string, projectId: string, renderId: string) {
  assertRenderId(renderId);
  return inside(
    path.join(projectDir(sessionId, projectId), "renders", `${renderId}.mp4`),
    projectDir(sessionId, projectId),
  );
}
