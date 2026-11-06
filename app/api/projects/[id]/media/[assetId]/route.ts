import { assertAssetId, assertProjectId } from "@/lib/ids";
import { mediaPath } from "@/lib/paths";
import { ensureSession, jsonError, serveFile } from "@/lib/session";
import { loadProject } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request, { params }: { params: Promise<{ id: string; assetId: string }> }) {
  try {
    const sessionId = await ensureSession();
    const { id, assetId } = await params;
    assertProjectId(id);
    assertAssetId(assetId);
    const project = await loadProject(sessionId, id);
    if (!project.assets.some((asset) => asset.id === assetId)) throw new Error("Unknown clip.");
    return serveFile(request, mediaPath(sessionId, id, assetId), "video/mp4");
  } catch (error) {
    return jsonError(error);
  }
}
