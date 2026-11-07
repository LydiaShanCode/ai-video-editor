import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const JSON_LIMIT = 1_000_000;
const UPLOAD_LIMIT = 260 * 1024 * 1024;

export function middleware(request: NextRequest) {
  const method = request.method;
  if (method === "GET" || method === "HEAD" || method === "DELETE" || method === "OPTIONS") {
    return NextResponse.next();
  }
  const path = request.nextUrl.pathname;
  const upload = path.endsWith("/upload");
  const readsBody = upload || method === "PATCH" || (method === "POST" && !path.endsWith("/demo"));
  if (!readsBody) return NextResponse.next();
  const raw = request.headers.get("content-length");
  const max = upload ? UPLOAD_LIMIT : JSON_LIMIT;
  if (!raw) {
    return NextResponse.json({ error: "Say how large the request is." }, { status: 411 });
  }
  const length = Number(raw);
  if (!Number.isInteger(length) || length < 0 || length > max) {
    return NextResponse.json({ error: "That request is too large." }, { status: 413 });
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/api/:path*"],
};
