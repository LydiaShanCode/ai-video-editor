import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { NextResponse } from "next/server";
import { attachUpload } from "@/lib/demo";
import { gate, UPLOAD_LIMIT } from "@/lib/guard";
import { assertProjectId } from "@/lib/ids";
import { assertCapacity } from "@/lib/quota";
import { ensureSession, jsonError } from "@/lib/session";
import { loadProject, saveProject, withProjectLock } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

const MAX_BYTES = 250 * 1024 * 1024;
const EXTENSIONS = new Set(["mp4", "mov", "m4v", "webm", "mkv"]);

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const scratch = await mkdtemp(path.join(os.tmpdir(), "reelroom-"));
  try {
    const denied = await gate(request, UPLOAD_LIMIT);
    if (denied) return denied;
    const sessionId = await ensureSession();
    const { id } = await params;
    assertProjectId(id);
    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) throw new Error("Choose a video file.");
    if (file.size > MAX_BYTES) throw new Error("Keep each file under 250 MB.");
    await assertCapacity(sessionId, file.size);
    const ext = (file.name.split(".").pop() || "").toLowerCase();
    if (!EXTENSIONS.has(ext)) throw new Error("Use an MP4, MOV, M4V, WEBM, or MKV.");
    const role = form.get("role") === "style" ? "style" : "footage";
    const name = String(form.get("name") || file.name.replace(/\.[^.]+$/, "")).slice(0, 80);
    const description = String(form.get("description") || "").slice(0, 400);
    const temp = path.join(scratch, `upload.${ext}`);
    await writeFile(temp, Buffer.from(await file.arrayBuffer()));
    const project = await withProjectLock(`${sessionId}:${id}`, async () => {
      const current = await loadProject(sessionId, id);
      if (current.assets.length >= 12) throw new Error("Twelve clips is the limit for one project.");
      await attachUpload({
        sessionId,
        project: current,
        tempFile: temp,
        role,
        name,
        description,
      });
      await saveProject(sessionId, current);
      return current;
    });
    return NextResponse.json(project);
  } catch (error) {
    return jsonError(error);
  } finally {
    await rm(scratch, { recursive: true, force: true });
  }
}
