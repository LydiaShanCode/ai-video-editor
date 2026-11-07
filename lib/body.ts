export function assertContentLength(request: { headers: { get(name: string): string | null } }, maxBytes: number) {
  const raw = request.headers.get("content-length");
  if (!raw) throw new Error("Say how large the request is.");
  const length = Number(raw);
  if (!Number.isInteger(length) || length < 0 || length > maxBytes) {
    throw new Error("That request is too large.");
  }
}
