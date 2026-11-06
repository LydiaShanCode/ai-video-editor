import fs from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import { assertAssetId, assertProjectId } from "@/lib/ids";
import { nowIso, uid } from "@/lib/ids";
import { mediaPath, projectDir } from "@/lib/paths";
import { assertSameOrigin, ensureSession, jsonError } from "@/lib/session";
import { loadProject, saveProject, withProjectLock } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string; assetId: string }> }) {
  try {
    assertSameOrigin(request);
    const sessionId = await ensureSession();
    const { id, assetId } = await params;
    assertProjectId(id);
    assertAssetId(assetId);
    const project = await withProjectLock(`${sessionId}:${id}`, async () => {
      const current = await loadProject(sessionId, id);
      if (!current.assets.some((asset) => asset.id === assetId)) throw new Error("Unknown clip.");
      current.assets = current.assets.filter((asset) => asset.id !== assetId);
      current.selects = current.selects.filter((select) => select.assetId !== assetId);
      current.timeline = current.timeline.filter((clip) => clip.assetId !== assetId);
      current.updatedAt = nowIso();
      current.log.push({ id: uid("log"), agent: "Room", text: "Removed a clip from the bench.", at: current.updatedAt });
      await saveProject(sessionId, current);
      await fs.rm(mediaPath(sessionId, id, assetId), { force: true });
      await fs.rm(path.join(projectDir(sessionId, id), "thumbs", assetId), { recursive: true, force: true });
      return current;
    });
    return NextResponse.json(project);
  } catch (error) {
    return jsonError(error);
  }
}
