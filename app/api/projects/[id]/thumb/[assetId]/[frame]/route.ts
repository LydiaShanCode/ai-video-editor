import { assertAssetId, assertProjectId } from "@/lib/ids";
import { thumbPath } from "@/lib/paths";
import { ensureSession, jsonError, serveFile } from "@/lib/session";
import { loadProject } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string; assetId: string; frame: string }> },
) {
  try {
    const sessionId = await ensureSession();
    const { id, assetId, frame } = await params;
    assertProjectId(id);
    assertAssetId(assetId);
    const project = await loadProject(sessionId, id);
    if (!project.assets.some((asset) => asset.id === assetId)) throw new Error("Unknown clip.");
    return serveFile(request, thumbPath(sessionId, id, assetId, frame), "image/jpeg");
  } catch (error) {
    return jsonError(error);
  }
}
