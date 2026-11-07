import fs from "node:fs/promises";
import path from "node:path";
import { probeFile, transcodeToMp4 } from "./video/analyze";

const MAX_DURATION = 12 * 60;

export async function ingestCopy(tempFile: string, destination: string) {
  await rejectPlaylist(tempFile);
  const probed = await probeFile(tempFile);
  if (!Number.isFinite(probed.duration) || probed.duration <= 0.2) {
    throw new Error("That clip is too short to cut.");
  }
  if (probed.duration > MAX_DURATION) {
    throw new Error("Keep each file under 12 minutes.");
  }
  await fs.mkdir(path.dirname(destination), { recursive: true });
  const friendly = probed.videoCodec === "h264" && tempFile.endsWith(".mp4") && probed.width <= 1920 && probed.height <= 1920;
  if (friendly) await fs.copyFile(tempFile, destination);
  else await transcodeToMp4(tempFile, destination);
  return probeFile(destination);
}

export async function rejectPlaylist(file: string) {
  const handle = await fs.open(file, "r");
  try {
    const buffer = Buffer.alloc(256);
    await handle.read(buffer, 0, buffer.length, 0);
    const text = buffer.toString("utf8").replace(/^\uFEFF/, "").trimStart().slice(0, 80).toLowerCase();
    if (text.startsWith("#extm3u") || text.startsWith("#ext-x-") || text.startsWith("http://") || text.startsWith("https://")) {
      throw new Error("That file isn't a video.");
    }
  } finally {
    await handle.close();
  }
}
