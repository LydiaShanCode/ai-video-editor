import fs from "node:fs/promises";
import path from "node:path";
import { projectDir, projectsDir } from "./paths";
import type { Project } from "./types";

const tails = new Map<string, Promise<unknown>>();

export function withProjectLock<T>(key: string, fn: () => Promise<T>) {
  const previous = tails.get(key) ?? Promise.resolve();
  const run = previous.then(fn, fn);
  tails.set(
    key,
    run.then(
      () => undefined,
      () => undefined,
    ),
  );
  return run;
}

export async function loadProject(sessionId: string, projectId: string) {
  const file = path.join(projectDir(sessionId, projectId), "project.json");
  try {
    const raw = await fs.readFile(file, "utf8");
    return JSON.parse(raw) as Project;
  } catch {
    throw new Error("That project isn't in this browser's cutting room.");
  }
}

export async function saveProject(sessionId: string, project: Project) {
  const dir = projectDir(sessionId, project.id);
  await fs.mkdir(dir, { recursive: true });
  const file = path.join(dir, "project.json");
  const temp = path.join(dir, "project.json.tmp");
  await fs.writeFile(temp, JSON.stringify(project), "utf8");
  await fs.rename(temp, file);
  await writeNotes(dir, project);
}

export async function listProjects(sessionId: string) {
  const dir = projectsDir(sessionId);
  await fs.mkdir(dir, { recursive: true });
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const projects: Project[] = [];
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    try {
      projects.push(await loadProject(sessionId, entry.name));
    } catch {
      /* skip a half-written folder */
    }
  }
  return projects.sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1));
}

export async function deleteProject(sessionId: string, projectId: string) {
  await fs.rm(projectDir(sessionId, projectId), { recursive: true, force: true });
}

async function writeNotes(dir: string, project: Project) {
  await Promise.all([
    fs.writeFile(path.join(dir, "STYLE.md"), project.styleMd || "# Style\n", "utf8"),
    fs.writeFile(path.join(dir, "SCRIPT.md"), project.scriptMd || "# Script\n", "utf8"),
    fs.writeFile(path.join(dir, "SELECTS.md"), project.selectsMd || "# Selects\n", "utf8"),
    fs.writeFile(path.join(dir, "CONFORM.md"), project.conformMd || "# Conform\n", "utf8"),
  ]);
}
