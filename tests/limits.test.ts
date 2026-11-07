import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { assertContentLength } from "../lib/body";
import { rejectPlaylist } from "../lib/ingest";

function request(length?: string) {
  return { headers: { get: (name: string) => (name === "content-length" ? (length ?? null) : null) } };
}

test("a request without a size is refused before it is read", () => {
  assert.throws(() => assertContentLength(request(), 1000), /how large/);
  assert.throws(() => assertContentLength(request("5000"), 1000), /too large/);
  assert.doesNotThrow(() => assertContentLength(request("40"), 1000));
});

test("a playlist renamed as a video is refused", async () => {
  const file = path.join(os.tmpdir(), `reelroom-playlist-${process.pid}.mp4`);
  await fs.writeFile(file, "#EXTM3U\n#EXT-X-STREAM-INF:BANDWIDTH=1\nhttp://example.test/a.m3u8\n");
  try {
    await assert.rejects(() => rejectPlaylist(file), /isn't a video/);
  } finally {
    await fs.rm(file, { force: true });
  }
});
