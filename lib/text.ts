const STOP = new Set([
  "this", "that", "with", "from", "your", "have", "just", "about", "into", "they",
  "them", "then", "than", "were", "will", "what", "when", "where", "which", "while",
  "because", "there", "their", "around", "almost", "until", "only", "does", "doing",
  "film", "video", "short", "story", "reel", "part", "whole", "here", "make",
]);

export function tokens(value: string) {
  return value
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((word) => word.length > 3 && !STOP.has(word));
}

export function overlapCount(a: string, b: string) {
  const right = new Set(tokens(b));
  let count = 0;
  for (const word of tokens(a)) if (right.has(word)) count += 1;
  return count;
}

export function card(value: string, max = 26) {
  const words = value
    .replace(/[^\w\s']/g, " ")
    .split(/\s+/)
    .filter(Boolean);
  const kept: string[] = [];
  for (const word of words) {
    if (STOP.has(word.toLowerCase()) && kept.length) continue;
    const next = [...kept, word].join(" ");
    if (next.length > max) break;
    kept.push(word);
    if (kept.length >= 4) break;
  }
  const line = (kept.length ? kept : words.slice(0, 3)).join(" ");
  return line.replace(/\s+/g, " ").trim();
}

export function subjectFrom(brief: string) {
  const stripped = brief
    .replace(/^(a |an )?(short )?(film|video|reel|tiktok|story)\s+(about|on)\s+/i, "")
    .trim();
  const clause = stripped.split(/[.]/)[0]?.trim() || stripped;
  if (clause.length <= 90) return clause.replace(/[.:]$/, "");
  return clause.slice(0, 86).replace(/\s+\S*$/, "");
}

export function sentences(brief: string) {
  return brief
    .split(/(?<=[.!?])\s+/)
    .map((line) => line.trim())
    .filter(Boolean);
}

export function slug(value: string) {
  const cleaned = value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  return cleaned || "reel";
}

export function timecode(seconds: number) {
  const safe = Math.max(0, seconds);
  const minutes = Math.floor(safe / 60);
  const rest = safe - minutes * 60;
  return `${minutes}:${rest.toFixed(1).padStart(4, "0")}`;
}

export function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

export function mean(values: number[]) {
  if (!values.length) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}
