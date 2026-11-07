import { NextResponse } from "next/server";
import { gate, JSON_LIMIT } from "@/lib/guard";
import { assertProjectId } from "@/lib/ids";
import { applyProjectPatch, type ProjectPatch } from "@/lib/patch";
import { ensureSession, jsonError } from "@/lib/session";
import { deleteProject, loadProject, saveProject, withProjectLock } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Ctx) {
  try {
    const sessionId = await ensureSession();
    const { id } = await params;
    assertProjectId(id);
    return NextResponse.json(await loadProject(sessionId, id));
  } catch (error) {
    return jsonError(error);
  }
}

export async function PATCH(request: Request, { params }: Ctx) {
  try {
    const denied = await gate(request, JSON_LIMIT);
    if (denied) return denied;
    const sessionId = await ensureSession();
    const { id } = await params;
    assertProjectId(id);
    const patch = (await request.json()) as ProjectPatch;
    const project = await withProjectLock(`${sessionId}:${id}`, async () => {
      const current = await loadProject(sessionId, id);
      applyProjectPatch(current, patch);
      await saveProject(sessionId, current);
      return current;
    });
    return NextResponse.json(project);
  } catch (error) {
    return jsonError(error);
  }
}

export async function DELETE(request: Request, { params }: Ctx) {
  try {
    const denied = await gate(request);
    if (denied) return denied;
    const sessionId = await ensureSession();
    const { id } = await params;
    assertProjectId(id);
    await deleteProject(sessionId, id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return jsonError(error);
  }
}
