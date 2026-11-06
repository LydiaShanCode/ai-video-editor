import { timecode } from "../text";
import type { Project } from "../types";

export function styleMarkdown(project: Project) {
  const style = project.style;
  if (!style) return "# Style\n\nNo reference has been read yet.\n";
  return `# Style — ${style.name}

The editor and the conform pass both follow this note.

## Pace
- Rhythm: ${style.cutRhythm}
- Average shot: ${style.avgShotSec.toFixed(2)}s
- Hook lands by: ${style.hookSec.toFixed(2)}s

## Picture
- Grade: ${style.grade}
- Contrast: ${style.contrast}
- Saturation: ${style.saturation}
- Vignette: ${style.vignette ? "yes" : "no"}

## Words
- Captions: ${style.captions}
- Case: ${style.captionCase}
- Position: ${style.captionPosition === "lower" ? "lower third" : "center"}

## Cuts
- Transitions: ${style.transitions}
- Loudness target: ${style.targetLufs} LUFS
- Finish: 1080×1920, H.264, AAC, 30 fps

## Notes
${style.notes.map((line) => `- ${line}`).join("\n")}

\`\`\`json
${JSON.stringify(style, null, 2)}
\`\`\`
`;
}

export function scriptMarkdown(project: Project) {
  const script = project.script;
  if (!script) return "# Script\n\nNo outline yet.\n";
  const beats = script.beats
    .map(
      (beat, index) => `### ${index + 1}. ${beat.role} · ${beat.durationSec.toFixed(1)}s
- Voiceover: ${beat.voiceover}
- On screen: ${beat.onScreenText}
- Picture: ${beat.visualNote}`,
    )
    .join("\n\n");
  return `# Script — ${script.title}

${script.logline}

- Platform: ${script.platform}
- Target: ${script.targetDuration}s
- Tone: ${script.tone}
${script.avoid.length ? `- Keep out: ${script.avoid.join(", ")}` : ""}

${beats}

\`\`\`json
${JSON.stringify(script, null, 2)}
\`\`\`
`;
}

export function selectsMarkdown(project: Project) {
  if (!project.selects.length) return "# Selects\n\nNo windows pulled yet.\n";
  const lines = project.selects
    .map((select) => {
      const asset = project.assets.find((item) => item.id === select.assetId);
      return `- ${asset?.name ?? "Clip"} ${timecode(select.inSec)}–${timecode(select.outSec)} · score ${select.score.toFixed(2)} · ${select.reason}`;
    })
    .join("\n");
  return `# Selects

Windows are scored on motion, a cut in the picture, and loudness. The story comes from the brief and the clip notes.

${lines}
`;
}

export function conformMarkdown(project: Project) {
  const report = project.conform;
  if (!report) return "# Conform\n\nThe cut has not been checked against the style yet.\n";
  return `# Conform

${report.pass ? "The cut matches the style." : "The style pass wants changes."}

${report.notes.map((item) => `- ${item.applied ? "Applied" : item.severity === "fix" ? "Fix" : "Note"}: ${item.text}`).join("\n")}
`;
}
