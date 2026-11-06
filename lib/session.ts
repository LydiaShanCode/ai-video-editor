import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { Readable } from "node:stream";
import { hex } from "./ids";

const COOKIE = "reelroom_session";

export async function ensureSession() {
  const jar = await cookies();
  const current = jar.get(COOKIE)?.value;
  if (current && /^[a-f0-9]{32}$/.test(current)) return current;
  const id = hex(16);
  jar.set(COOKIE, id, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 400,
  });
  return id;
}

export function sameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  const host = request.headers.get("host");
  if (!origin) {
    const site = request.headers.get("sec-fetch-site");
    return !site || site === "same-origin" || site === "none";
  }
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}

export function assertSameOrigin(request: Request) {
  if (!sameOrigin(request)) {
    const error = new Error("Cross-origin request blocked.");
    throw error;
  }
}

export function jsonError(error: unknown) {
  const message = error instanceof Error ? error.message : "Something went wrong.";
  if (message.includes("Cross-origin")) {
    return NextResponse.json({ error: message }, { status: 403 });
  }
  if (/isn't in this browser|Unknown project|Unknown clip|Unknown export|Unknown cutting|Unknown frame/.test(message)) {
    return NextResponse.json({ error: message }, { status: 404 });
  }
  const client = /empty|under 12|under 250|look like a video|picture track|Keep each|Nothing to undo|have to exist|Add raw|before pulling|before assembling|before exporting|too short|too large|MP4, MOV|limit|Choose a video|Use an MP4|Unknown stage/.test(message);
  if (!client) console.error(error);
  return NextResponse.json({ error: message.slice(0, 400) }, { status: client ? 400 : 500 });
}

export async function serveFile(request: Request, file: string, contentType: string, downloadName?: string) {
  const info = await stat(file);
  const range = request.headers.get("range");
  const headers: Record<string, string> = {
    "Content-Type": contentType,
    "Accept-Ranges": "bytes",
    "Cache-Control": "private, max-age=3600",
  };
  if (downloadName) {
    headers["Content-Disposition"] = `attachment; filename="${downloadName.replace(/[^a-zA-Z0-9._-]/g, "")}"`;
  }
  if (!range) {
    const stream = Readable.toWeb(createReadStream(file)) as ReadableStream;
    headers["Content-Length"] = String(info.size);
    return new Response(stream, { headers });
  }
  const match = /bytes=(\d+)-(\d*)/.exec(range);
  if (!match) return new Response(null, { status: 416 });
  const start = Number(match[1]);
  const end = match[2] ? Math.min(Number(match[2]), info.size - 1) : Math.min(start + 1024 * 1024 - 1, info.size - 1);
  if (!Number.isFinite(start) || start >= info.size || end < start) {
    return new Response(null, { status: 416 });
  }
  const stream = Readable.toWeb(createReadStream(file, { start, end })) as ReadableStream;
  return new Response(stream, {
    status: 206,
    headers: {
      ...headers,
      "Content-Range": `bytes ${start}-${end}/${info.size}`,
      "Content-Length": String(end - start + 1),
    },
  });
}
