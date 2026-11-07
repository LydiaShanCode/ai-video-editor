import { spawn } from "node:child_process";
import { releaseJob, takeJob } from "../quota";

export async function run(bin: string, args: string[], timeoutMs = 120000) {
  await takeJob();
  try {
    return await runOnce(bin, args, timeoutMs);
  } finally {
    releaseJob();
  }
}

function runOnce(bin: string, args: string[], timeoutMs: number) {
  return new Promise<{ stdout: string; stderr: string; code: number }>((resolve, reject) => {
    const child = spawn(bin, args, { stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    const timer = setTimeout(() => {
      child.kill("SIGKILL");
      reject(new Error("The cutter took too long and was stopped."));
    }, timeoutMs);
    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
      if (stdout.length > 1_500_000) stdout = stdout.slice(-750_000);
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
      if (stderr.length > 2_000_000) stderr = stderr.slice(-1_000_000);
    });
    child.on("error", (error) => {
      clearTimeout(timer);
      reject(error);
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      resolve({ stdout, stderr, code: code ?? 1 });
    });
  });
}

export function ffmpegError(stderr: string) {
  const lines = stderr
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("frame=") && !line.startsWith("size="));
  const tail = lines.slice(-6).join(" ");
  return tail.slice(0, 380) || "FFmpeg couldn't finish that cut.";
}
