export function hex(bytes = 16) {
  const buf = new Uint8Array(bytes);
  crypto.getRandomValues(buf);
  return [...buf].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export function uid(prefix: string) {
  return `${prefix}_${hex(6)}`;
}

export function nowIso() {
  return new Date().toISOString();
}

const HEX_32 = /^[a-f0-9]{32}$/;
const PREFIXED = /^(ast|rnd|clp|sel|beat|msg|note|log)_[a-f0-9]{12}$/;

export function assertSessionId(id: string) {
  if (!HEX_32.test(id)) throw new Error("Unknown cutting room.");
  return id;
}

export function assertProjectId(id: string) {
  if (!HEX_32.test(id)) throw new Error("Unknown project.");
  return id;
}

export function assertAssetId(id: string) {
  if (!/^ast_[a-f0-9]{12}$/.test(id)) throw new Error("Unknown clip.");
  return id;
}

export function assertRenderId(id: string) {
  if (!/^rnd_[a-f0-9]{12}$/.test(id)) throw new Error("Unknown export.");
  return id;
}

export function assertPrefixedId(id: string) {
  if (!PREFIXED.test(id) && !HEX_32.test(id)) throw new Error("Bad id.");
  return id;
}
