import fs from "node:fs/promises";
import path from "node:path";
import { probeFile, transcodeToMp4 } from "./video/analyze";

const MAX_DURATION = 12 * 60;

export async function ingestCopy(tempFile: string, destination: string) {
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
