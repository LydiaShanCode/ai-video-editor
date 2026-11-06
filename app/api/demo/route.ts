import { NextResponse } from "next/server";
import { seedDemo } from "@/lib/demo";
import { assertSameOrigin, ensureSession, jsonError } from "@/lib/session";
import { listProjects } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const sessionId = await ensureSession();
    const existing = await listProjects(sessionId);
    if (existing.length >= 20) throw new Error("Twenty projects is the limit in this browser.");
    const project = await seedDemo(sessionId);
    return NextResponse.json(project);
  } catch (error) {
    return jsonError(error);
  }
}
