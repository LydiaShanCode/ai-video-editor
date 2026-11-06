import { assertProjectId, assertRenderId } from "@/lib/ids";
import { renderPath } from "@/lib/paths";
import { ensureSession, jsonError, serveFile } from "@/lib/session";
import { slug } from "@/lib/text";
import { loadProject } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request, { params }: { params: Promise<{ id: string; renderId: string }> }) {
  try {
    const sessionId = await ensureSession();
    const { id, renderId } = await params;
    assertProjectId(id);
    assertRenderId(renderId);
    const project = await loadProject(sessionId, id);
    if (!project.renders.some((render) => render.id === renderId)) throw new Error("Unknown export.");
    const download = new URL(request.url).searchParams.get("download") === "1";
    return serveFile(
      request,
      renderPath(sessionId, id, renderId),
      "video/mp4",
      download ? `${slug(project.title)}-reel.mp4` : undefined,
    );
  } catch (error) {
    return jsonError(error);
  }
}
