import { NextResponse } from "next/server";
import { seedDemo } from "@/lib/demo";
import { gate } from "@/lib/guard";
import { assertCapacity } from "@/lib/quota";
import { ensureSession, jsonError } from "@/lib/session";
import { listProjects } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function POST(request: Request) {
  try {
    const denied = await gate(request);
    if (denied) return denied;
    const sessionId = await ensureSession();
    await assertCapacity(sessionId, 2_000_000);
    const existing = await listProjects(sessionId);
    if (existing.length >= 20) throw new Error("Twenty projects is the limit in this browser.");
    const project = await seedDemo(sessionId);
    return NextResponse.json(project);
  } catch (error) {
    return jsonError(error);
  }
}
