import type { StyleProfile } from "./types";

export function gradeFilter(style: Pick<StyleProfile, "grade" | "contrast" | "saturation" | "vignette">) {
  const temperature =
    style.grade === "warm"
      ? "colorbalance=rs=0.07:gs=0.02:bs=-0.06"
      : style.grade === "cool"
        ? "colorbalance=rs=-0.05:gs=0.01:bs=0.08"
        : "colorbalance=rs=0:gs=0:bs=0";
  const parts = [
    `eq=contrast=${style.contrast.toFixed(2)}:saturation=${style.saturation.toFixed(2)}:gamma=${style.grade === "warm" ? "0.97" : "1"}`,
    temperature,
  ];
  if (style.vignette) parts.push("vignette=PI/5");
  return parts.join(",");
}

export function gradeCss(style: Pick<StyleProfile, "grade" | "contrast" | "saturation">) {
  const contrast = style.contrast.toFixed(2);
  const saturation = style.saturation.toFixed(2);
  if (style.grade === "warm") return `contrast(${contrast}) saturate(${saturation}) sepia(0.18)`;
  if (style.grade === "cool") return `contrast(${contrast}) saturate(${Math.max(0.7, style.saturation - 0.15).toFixed(2)}) hue-rotate(12deg)`;
  return `contrast(${contrast}) saturate(${saturation})`;
}

export function formatCaption(text: string, style: Pick<StyleProfile, "captionCase">) {
  const clean = text.replace(/\s+/g, " ").trim();
  if (!clean) return "";
  if (style.captionCase === "upper") return clean.toUpperCase();
  return clean.charAt(0).toUpperCase() + clean.slice(1);
}

export function wrapCaption(text: string) {
  const clean = text.replace(/\s+/g, " ").trim();
  if (!clean) return "";
  const words = clean.split(" ");
  if (words.length <= 3 && clean.length <= 18) return clean;
  let lines: string[] = [];
  let current = "";
  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (next.length > 16 && current) {
      lines.push(current);
      current = word;
    } else {
      current = next;
    }
  }
  if (current) lines.push(current);
  if (lines.length > 3) {
    lines = [lines[0], lines.slice(1).join(" ")];
  }
  return lines.join("\n");
}

export function cssCaption(style: Pick<StyleProfile, "captions" | "captionPosition">) {
  const position = style.captionPosition === "center" ? "top-1/2 -translate-y-1/2" : "bottom-[18%]";
  const face =
    style.captions === "editorial"
      ? "font-serif text-[1.15rem] leading-tight tracking-tight text-white drop-shadow-[0_2px_8px_rgba(0,0,0,0.85)]"
      : style.captions === "minimal"
        ? "text-xs tracking-[0.16em] text-white/90"
        : "bg-black/60 px-3 py-2 text-[1.05rem] font-semibold leading-tight tracking-wide text-white";
  return { position, face };
}
