import fs from "node:fs/promises";
import path from "node:path";

const ROOT = path.join(process.cwd(), "data", "sessions");
const MAX_SESSIONS = 24;
const MAX_BYTES = 8 * 1024 * 1024 * 1024;
const MAX_JOBS = 2;

let running = 0;
const waiting: Array<() => void> = [];
let cachedBytes = 0;
let cachedAt = 0;

export async function assertCapacity(sessionId: string, extraBytes = 0) {
  await fs.mkdir(ROOT, { recursive: true });
  const names = (await fs.readdir(ROOT)).filter((name) => /^[a-f0-9]{32}$/.test(name));
  if (!names.includes(sessionId) && names.length >= MAX_SESSIONS) {
    throw new Error("The cutting room is full.");
  }
  const used = await directoryBytes();
  if (used + Math.max(0, extraBytes) > MAX_BYTES) {
    throw new Error("The cutting room is full.");
  }
  cachedBytes += Math.max(0, extraBytes);
}

export async function takeJob() {
  if (running < MAX_JOBS) {
    running += 1;
    return;
  }
  await new Promise<void>((resolve) => {
    waiting.push(() => {
      running += 1;
      resolve();
    });
  });
}

export function releaseJob() {
  running -= 1;
  const next = waiting.shift();
  if (next) next();
}

async function directoryBytes() {
  if (Date.now() - cachedAt < 10_000) return cachedBytes;
  cachedBytes = await walk(ROOT);
  cachedAt = Date.now();
  return cachedBytes;
}

async function walk(dir: string): Promise<number> {
  let total = 0;
  let entries;
  try {
    entries = await fs.readdir(dir, { withFileTypes: true });
  } catch {
    return 0;
  }
  for (const entry of entries) {
    const child = path.join(dir, entry.name);
    if (entry.isSymbolicLink()) continue;
    if (entry.isDirectory()) total += await walk(child);
    else if (entry.isFile()) {
      const info = await fs.stat(child);
      total += info.size;
    }
  }
  return total;
}
