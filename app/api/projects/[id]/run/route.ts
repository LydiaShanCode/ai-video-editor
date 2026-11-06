import { NextResponse } from "next/server";
import { assertProjectId } from "@/lib/ids";
import { runStage, type Stage } from "@/lib/pipeline";
import { assertSameOrigin, ensureSession, jsonError } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

const STAGES = new Set<Stage>(["style", "script", "selects", "assemble", "conform", "render", "undo"]);

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    assertSameOrigin(request);
    const sessionId = await ensureSession();
    const { id } = await params;
    assertProjectId(id);
    const body = (await request.json()) as { stage?: Stage; message?: string; apply?: boolean };
    if (!body.stage || !STAGES.has(body.stage)) throw new Error("Unknown stage.");
    const project = await runStage(sessionId, id, body.stage, {
      message: typeof body.message === "string" ? body.message.slice(0, 1000) : "",
      apply: Boolean(body.apply),
    });
    return NextResponse.json(project);
  } catch (error) {
    return jsonError(error);
  }
}
