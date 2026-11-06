import { NextResponse } from "next/server";
import { emptyProject } from "@/lib/pipeline";
import { assertSameOrigin, ensureSession, jsonError } from "@/lib/session";
import { listProjects, saveProject } from "@/lib/store";
import type { Platform } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const sessionId = await ensureSession();
    const projects = await listProjects(sessionId);
    return NextResponse.json({ projects });
  } catch (error) {
    return jsonError(error);
  }
}

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const sessionId = await ensureSession();
    const existing = await listProjects(sessionId);
    if (existing.length >= 20) throw new Error("Twenty projects is the limit in this browser.");
    const body = (await request.json()) as {
      title?: string;
      brief?: string;
      platform?: Platform;
      targetDuration?: number;
    };
    const platform: Platform = body.platform === "instagram" || body.platform === "tiktok" ? body.platform : "both";
    const lengths = new Set([15, 24, 30, 45, 60]);
    const project = emptyProject({
      title: (body.title || "Untitled cut").slice(0, 80),
      brief: (body.brief || "").slice(0, 600),
      platform,
      targetDuration: body.targetDuration && lengths.has(body.targetDuration) ? body.targetDuration : 24,
    });
    await saveProject(sessionId, project);
    return NextResponse.json(project);
  } catch (error) {
    return jsonError(error);
  }
}
