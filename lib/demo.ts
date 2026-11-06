import fs from "node:fs/promises";
import path from "node:path";
import { DEMO_PROJECT, ensureDemoMedia } from "./demo-media";
import { nowIso, uid } from "./ids";
import { mediaPath, projectDir, thumbPath } from "./paths";
import { emptyProject } from "./pipeline";
import { saveProject } from "./store";
import type { Asset, Project } from "./types";
import { analyzeVideo, probeFile, writeThumbs } from "./video/analyze";

export async function seedDemo(sessionId: string) {
  const demoDir = await ensureDemoMedia();
  const project = emptyProject({
    title: DEMO_PROJECT.title,
    brief: DEMO_PROJECT.brief,
    platform: DEMO_PROJECT.platform,
    targetDuration: DEMO_PROJECT.targetDuration,
    sample: true,
  });
  const dir = projectDir(sessionId, project.id);
  await fs.mkdir(path.join(dir, "media"), { recursive: true });
  for (const spec of DEMO_PROJECT.assets) {
    const id = uid("ast");
    const destination = mediaPath(sessionId, project.id, id);
    await fs.copyFile(path.join(demoDir, spec.file), destination);
    const probed = await probeFile(destination);
    const metrics = await analyzeVideo(destination, probed.duration);
    const frame = "0";
    const thumb = thumbPath(sessionId, project.id, id, frame);
    const thumbCount = await writeThumbs(destination, path.dirname(thumb), probed.duration);
    const asset: Asset = {
      id,
      role: spec.role,
      name: spec.name,
      description: spec.description,
      duration: probed.duration,
      width: probed.width,
      height: probed.height,
      fps: probed.fps,
      hasAudio: probed.hasAudio,
      thumbCount,
      metrics,
    };
    project.assets.push(asset);
  }
  project.updatedAt = nowIso();
  project.log.push({
    id: uid("log"),
    agent: "Room",
    text: "Sample morning pour is on the bench. The pictures are generated, so you can run the room before your rushes arrive.",
    at: nowIso(),
  });
  await saveProject(sessionId, project);
  return project;
}

export async function attachUpload(options: {
  sessionId: string;
  project: Project;
  tempFile: string;
  role: "style" | "footage";
  name: string;
  description: string;
}) {
  const id = uid("ast");
  const destination = mediaPath(options.sessionId, options.project.id, id);
  const { ingestCopy } = await import("./ingest");
  const probed = await ingestCopy(options.tempFile, destination);
  const metrics = await analyzeVideo(destination, probed.duration);
  const thumbCount = await writeThumbs(destination, path.dirname(thumbPath(options.sessionId, options.project.id, id, "0")), probed.duration);
  const asset: Asset = {
    id,
    role: options.role,
    name: options.name,
    description: options.description,
    duration: probed.duration,
    width: probed.width,
    height: probed.height,
    fps: probed.fps,
    hasAudio: probed.hasAudio,
    thumbCount,
    metrics,
  };
  options.project.assets.push(asset);
  options.project.updatedAt = nowIso();
  options.project.log.push({
    id: uid("log"),
    agent: "Room",
    text: `Added ${asset.role === "style" ? "reference" : "footage"} “${asset.name}”, ${asset.duration.toFixed(1)}s.`,
    at: nowIso(),
  });
  return options.project;
}
