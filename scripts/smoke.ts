import assert from "node:assert/strict";
import { seedDemo } from "../lib/demo";
import { hex } from "../lib/ids";
import { runStage } from "../lib/pipeline";
import { timelineDuration } from "../lib/status";

async function main() {
const sessionId = hex(16);
let project = await seedDemo(sessionId);
assert.ok(project.assets.some((asset) => asset.role === "style"));
assert.ok(project.assets.filter((asset) => asset.role === "footage").length >= 4);

project = await runStage(sessionId, project.id, "style");
assert.equal(project.style?.cutRhythm, "rapid");
assert.equal(project.style?.grade, "warm");

project = await runStage(sessionId, project.id, "script");
assert.match(project.script?.title ?? "", /pour/i);
assert.ok(project.script && project.script.beats.length >= 3);

project = await runStage(sessionId, project.id, "selects");
assert.ok(project.selects.length >= 4);

project = await runStage(sessionId, project.id, "assemble");
const names = project.timeline.map((clip) => project.assets.find((asset) => asset.id === clip.assetId)?.name);
assert.ok(names.includes("Pour"), `expected the pour, got ${names.join(", ")}`);
assert.equal(names.includes("Counter"), false, `counter leaked into ${names.join(", ")}`);
assert.ok(project.timeline.length >= 3);

project = await runStage(sessionId, project.id, "render");
const render = project.renders[0];
assert.ok(render);
assert.equal(render?.width, 1080);
assert.equal(render?.height, 1920);
assert.ok((render?.duration ?? 0) > 5);

project = await runStage(sessionId, project.id, "conform", { apply: true });
if (project.conform?.notes.some((note) => note.applied)) {
  project = await runStage(sessionId, project.id, "render");
  project = await runStage(sessionId, project.id, "conform", { apply: false });
}

console.log(
  JSON.stringify(
    {
      style: project.style?.cutRhythm,
      beats: project.script?.beats.map((beat) => beat.role),
      shots: names,
      duration: Number(timelineDuration(project).toFixed(1)),
      export: project.renders[0],
      conform: project.conform?.pass,
      notes: project.conform?.notes.map((note) => note.text),
    },
    null,
    2,
  ),
);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
