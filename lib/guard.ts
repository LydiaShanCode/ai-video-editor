import { requireIdentity } from "@/cursor/identity";
import { assertContentLength } from "./body";
import { assertSameOrigin } from "./session";

const JSON_LIMIT = 1_000_000;
export const UPLOAD_LIMIT = 260 * 1024 * 1024;

export async function gate(request: Request, maxBytes?: number) {
  const viewer = await requireIdentity(request);
  if (viewer instanceof Response) return viewer;
  assertSameOrigin(request);
  if (maxBytes !== undefined) assertContentLength(request, maxBytes);
  return null;
}

export { JSON_LIMIT };
