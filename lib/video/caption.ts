import { createWriteStream } from "node:fs";
import path from "node:path";
import * as PImage from "pureimage";
import type { StyleProfile } from "../types";

const FONT = path.join(process.cwd(), "public/fonts/DejaVuSans-Bold.ttf");
let ready: Promise<void> | null = null;

function loadFont() {
  ready ??= PImage.registerFont(FONT, "Caption").load();
  return ready;
}

export async function writeCaptionCard(file: string, text: string, style: Pick<StyleProfile, "captions" | "captionPosition">) {
  const lines = text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  if (!lines.length) return false;
  await loadFont();
  const image = PImage.make(1080, 1920);
  image.data.fill(0);
  const ctx = image.getContext("2d");
  const size = style.captions === "editorial" ? 52 : style.captions === "minimal" ? 34 : 64;
  ctx.font = `${size}pt Caption`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  const widths = lines.map((line) => ctx.measureText(line).width);
  const widest = Math.max(...widths, 40);
  const lineHeight = Math.round(size * 1.28);
  const block = lines.length * lineHeight;
  const top = style.captionPosition === "center" ? (1920 - block) / 2 : 1920 * 0.73;
  if (style.captions === "bold-block") {
    ctx.fillStyle = "rgba(0,0,0,0.58)";
    ctx.fillRect(540 - widest / 2 - 28, top - 12, widest + 56, block + 20);
  }
  ctx.fillStyle = "#ffffff";
  lines.forEach((line, index) => {
    ctx.fillText(line, 540, top + lineHeight * index + lineHeight / 2);
  });
  const stream = createWriteStream(file);
  await PImage.encodePNGToStream(image, stream);
  return true;
}
