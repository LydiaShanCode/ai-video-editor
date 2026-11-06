"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { timecode } from "@/lib/text";
import type { Project, Script, Select, StyleProfile } from "@/lib/types";

export type Step = "style" | "script" | "selects" | "edit" | "conform";

export function StepPanel({
  step,
  project,
  busy,
  draft,
  onDraft,
  onRun,
  onStyle,
  onScript,
  onUpload,
  onRemoveAsset,
  onAddSelect,
  onApplyConform,
}: {
  step: Step;
  project: Project;
  busy: string;
  draft: string;
  onDraft: (value: string) => void;
  onRun: (stage: "style" | "script" | "selects" | "assemble" | "conform" | "render" | "undo", extra?: { message?: string; apply?: boolean }) => void;
  onStyle: (patch: Partial<StyleProfile>) => void;
  onScript: (script: Script) => void;
  onUpload: (file: File, role: "style" | "footage", description: string) => void;
  onRemoveAsset: (id: string) => void;
  onAddSelect: (select: Select) => void;
  onApplyConform: () => void;
}) {
  return (
    <div className="flex flex-col gap-5 p-4">
      {step === "style" ? <StylePanel project={project} busy={busy} onRun={onRun} onStyle={onStyle} onUpload={onUpload} /> : null}
      {step === "script" ? (
        <ScriptPanel project={project} busy={busy} draft={draft} onDraft={onDraft} onRun={onRun} onScript={onScript} />
      ) : null}
      {step === "selects" ? <SelectsPanel project={project} busy={busy} onRun={onRun} onAddSelect={onAddSelect} /> : null}
      {step === "edit" ? <EditPanel project={project} busy={busy} onRun={onRun} /> : null}
      {step === "conform" ? <ConformPanel project={project} busy={busy} onRun={onRun} onApply={onApplyConform} /> : null}
      <ClipNotes project={project} onUpload={onUpload} onRemove={onRemoveAsset} />
    </div>
  );
}

function StylePanel({
  project,
  busy,
  onRun,
  onStyle,
  onUpload,
}: {
  project: Project;
  busy: string;
  onRun: (stage: "style") => void;
  onStyle: (patch: Partial<StyleProfile>) => void;
  onUpload: (file: File, role: "style" | "footage", description: string) => void;
}) {
  const style = project.style;
  return (
    <div className="grid gap-4">
      <div>
        <p className="text-xs tracking-[0.18em] text-muted-foreground uppercase">Style agent</p>
        <h2 className="font-serif text-3xl">Read the reference</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Drop a video whose pace you want. The agent measures shot length, color, and how the cuts land, then writes STYLE.md.
        </p>
      </div>
      <UploadField label="Reference video" role="style" onUpload={onUpload} />
      <Button disabled={busy !== ""} onClick={() => onRun("style")}>
        {busy === "style" ? "Reading…" : style ? "Read again" : "Use the house style"}
      </Button>
      {style ? (
        <div className="grid gap-3 rounded-xl border border-border p-3">
          <div className="flex flex-wrap gap-2">
            <Badge>{style.cutRhythm}</Badge>
            <Badge variant="secondary">{style.grade}</Badge>
            <Badge variant="outline">{style.captions}</Badge>
            <Badge variant="outline">{style.transitions}</Badge>
          </div>
          <Choice
            label="Rhythm"
            value={style.cutRhythm}
            options={["rapid", "measured", "lingering"]}
            onChange={(cutRhythm) => onStyle({ cutRhythm: cutRhythm as StyleProfile["cutRhythm"] })}
          />
          <Choice
            label="Grade"
            value={style.grade}
            options={["warm", "neutral", "cool"]}
            onChange={(grade) => onStyle({ grade: grade as StyleProfile["grade"] })}
          />
          <Choice
            label="Captions"
            value={style.captions}
            options={["bold-block", "minimal", "editorial"]}
            onChange={(captions) => onStyle({ captions: captions as StyleProfile["captions"] })}
          />
          <Choice
            label="Cuts"
            value={style.transitions}
            options={["hard", "fade"]}
            onChange={(transitions) => onStyle({ transitions: transitions as StyleProfile["transitions"] })}
          />
          <p className="text-xs text-muted-foreground">Hook by {style.hookSec.toFixed(1)}s · shots near {style.avgShotSec.toFixed(1)}s · -14 LUFS</p>
          <ul className="grid gap-1 text-sm">
            {style.notes.map((note) => (
              <li key={note}>{note}</li>
            ))}
          </ul>
          <AgentNote title="STYLE.md" body={project.styleMd} />
        </div>
      ) : null}
    </div>
  );
}

function ScriptPanel({
  project,
  busy,
  draft,
  onDraft,
  onRun,
  onScript,
}: {
  project: Project;
  busy: string;
  draft: string;
  onDraft: (value: string) => void;
  onRun: (stage: "script", extra?: { message?: string }) => void;
  onScript: (script: Script) => void;
}) {
  const script = project.script;
  return (
    <div className="grid gap-4">
      <div>
        <p className="text-xs tracking-[0.18em] text-muted-foreground uppercase">Script agent</p>
        <h2 className="font-serif text-3xl">Workshop the outline</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The agent uses your brief and the clip notes. It does not pretend to watch the story in the pixels. Push back in the box.
        </p>
      </div>
      <Button disabled={busy !== ""} onClick={() => onRun("script", { message: "" })}>
        {busy === "script" ? "Writing…" : script ? "Redraft from the brief" : "Draft from the footage"}
      </Button>
      {script ? (
        <div className="grid gap-3">
          <Input
            value={script.title}
            onChange={(event) => onScript({ ...script, title: event.target.value })}
            aria-label="Title"
          />
          <Textarea
            value={script.logline}
            onChange={(event) => onScript({ ...script, logline: event.target.value })}
            aria-label="Logline"
          />
          {script.beats.map((beat, index) => (
            <div key={beat.id} className="grid gap-2 rounded-xl border border-border p-3">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span className="uppercase">{beat.role}</span>
                <span>{beat.durationSec.toFixed(1)}s</span>
              </div>
              <Input
                value={beat.onScreenText}
                aria-label="On-screen text"
                onChange={(event) => {
                  const beats = script.beats.map((item, itemIndex) =>
                    itemIndex === index ? { ...item, onScreenText: event.target.value } : item,
                  );
                  onScript({ ...script, beats });
                }}
              />
              <Textarea
                value={beat.voiceover}
                aria-label="Voiceover"
                onChange={(event) => {
                  const beats = script.beats.map((item, itemIndex) =>
                    itemIndex === index ? { ...item, voiceover: event.target.value } : item,
                  );
                  onScript({ ...script, beats });
                }}
              />
            </div>
          ))}
          <AgentNote title="SCRIPT.md" body={project.scriptMd} />
        </div>
      ) : null}
      <div className="grid gap-2">
        {project.messages.slice(-6).map((message) => (
          <p key={message.id} className={message.role === "agent" ? "text-sm" : "text-sm text-muted-foreground"}>
            <span className="mr-2 text-[10px] tracking-widest uppercase">{message.role === "agent" ? "Script" : "You"}</span>
            {message.text}
          </p>
        ))}
        <Textarea
          value={draft}
          placeholder="Make the hook about the sound. Cut it to 15 seconds. Lose the grinder."
          onChange={(event) => onDraft(event.target.value)}
        />
        <Button
          variant="secondary"
          disabled={busy !== "" || !draft.trim()}
          onClick={() => {
            onRun("script", { message: draft });
            onDraft("");
          }}
        >
          Send to the script agent
        </Button>
      </div>
    </div>
  );
}

function SelectsPanel({
  project,
  busy,
  onRun,
  onAddSelect,
}: {
  project: Project;
  busy: string;
  onRun: (stage: "selects") => void;
  onAddSelect: (select: Select) => void;
}) {
  return (
    <div className="grid gap-4">
      <div>
        <p className="text-xs tracking-[0.18em] text-muted-foreground uppercase">Selects</p>
        <h2 className="font-serif text-3xl">The frames worth keeping</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Each window is scored on a cut in the picture and how much sound is in it. Quiet clips stay available when the script asks for stillness.
        </p>
      </div>
      <Button disabled={busy !== ""} onClick={() => onRun("selects")}>
        {busy === "selects" ? "Scoring…" : "Pull selects"}
      </Button>
      <ul className="grid gap-2">
        {project.selects.map((select) => {
          const asset = project.assets.find((item) => item.id === select.assetId);
          return (
            <li key={select.id} className="rounded-xl border border-border p-3">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-medium">{asset?.name}</p>
                <span className="font-mono text-[11px] text-muted-foreground">
                  {timecode(select.inSec)}–{timecode(select.outSec)} · {select.score.toFixed(2)}
                </span>
              </div>
              <p className="mt-1 text-sm text-muted-foreground">{select.reason}</p>
              <Button className="mt-2" size="sm" variant="outline" onClick={() => onAddSelect(select)}>
                Place on timeline
              </Button>
            </li>
          );
        })}
      </ul>
      {!project.selects.length ? <p className="text-sm text-muted-foreground">No windows yet.</p> : null}
      {project.selectsMd ? <AgentNote title="SELECTS.md" body={project.selectsMd} /> : null}
    </div>
  );
}

function EditPanel({
  project,
  busy,
  onRun,
}: {
  project: Project;
  busy: string;
  onRun: (stage: "assemble" | "undo", extra?: { message?: string; apply?: boolean }) => void;
}) {
  const total = project.timeline.reduce((sum, clip) => sum + (clip.outSec - clip.inSec), 0);
  return (
    <div className="grid gap-4">
      <div>
        <p className="text-xs tracking-[0.18em] text-muted-foreground uppercase">Editor</p>
        <h2 className="font-serif text-3xl">Stitch the cut</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Assembly follows the script, the selects, and the style. Anything you trim by hand stays until you assemble again or apply a style pass. Undo puts the last timeline back.
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button disabled={busy !== ""} onClick={() => onRun("assemble")}>
          {busy === "assemble" ? "Assembling…" : "Assemble"}
        </Button>
        <Button variant="outline" disabled={busy !== "" || !project.timelinePast.length} onClick={() => onRun("undo")}>
          Undo
        </Button>
      </div>
      <p className="text-sm text-muted-foreground">
        {project.timeline.length ? `${project.timeline.length} shots · ${total.toFixed(1)}s` : "Nothing on the timeline yet."}
      </p>
    </div>
  );
}

function ConformPanel({
  project,
  busy,
  onRun,
  onApply,
}: {
  project: Project;
  busy: string;
  onRun: (stage: "conform" | "render", extra?: { apply?: boolean }) => void;
  onApply: () => void;
}) {
  const report = project.conform;
  const render = project.renders[0];
  return (
    <div className="grid gap-4">
      <div>
        <p className="text-xs tracking-[0.18em] text-muted-foreground uppercase">Conform</p>
        <h2 className="font-serif text-3xl">Does it match?</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The style agent checks pace, the hook, captions, and length. If the cut drifts, it writes the change and can hand it back to the editor.
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button disabled={busy !== ""} onClick={() => onRun("conform", { apply: false })}>
          {busy === "conform" ? "Checking…" : "Check the cut"}
        </Button>
        <Button variant="secondary" disabled={busy !== ""} onClick={() => onRun("render")}>
          {busy === "render" ? "Exporting…" : "Export 1080×1920"}
        </Button>
      </div>
      {report ? (
        <div className="grid gap-2 rounded-xl border border-border p-3">
          <Badge variant={report.pass ? "default" : "outline"}>{report.pass ? "Matches the reference" : "Style pass open"}</Badge>
          <ul className="grid gap-2 text-sm">
            {report.notes.map((note) => (
              <li key={note.id}>{note.text}</li>
            ))}
          </ul>
          {report.suggested ? (
            <Button variant="outline" disabled={busy !== ""} onClick={onApply}>
              Apply the style pass
            </Button>
          ) : null}
          <AgentNote title="CONFORM.md" body={project.conformMd} />
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">No check yet.</p>
      )}
      {render ? (
        <p className="text-xs text-muted-foreground">
          Latest export {render.duration.toFixed(1)}s · {render.width}×{render.height}
          <a className="ml-2 underline underline-offset-2" href={`/api/projects/${project.id}/renders/${render.id}?download=1`}>
            Download
          </a>
        </p>
      ) : null}
    </div>
  );
}

function ClipNotes({
  project,
  onUpload,
  onRemove,
}: {
  project: Project;
  onUpload: (file: File, role: "style" | "footage", description: string) => void;
  onRemove: (id: string) => void;
}) {
  return (
    <div className="grid gap-3 border-t border-border pt-4">
      <h3 className="font-serif text-2xl">Clip notes</h3>
      <p className="text-sm text-muted-foreground">Say what the camera is looking at. The script agent uses these words.</p>
      <UploadField label="Raw footage" role="footage" onUpload={onUpload} />
      <ul className="grid gap-2">
        {project.assets.map((asset) => (
          <li key={asset.id} className="rounded-lg border border-border p-2 text-sm">
            <div className="flex items-center justify-between gap-2">
              <span>
                {asset.name} · {asset.role === "style" ? "reference" : "footage"} · {asset.duration.toFixed(1)}s
              </span>
              <button className="text-xs underline-offset-2 hover:underline" onClick={() => onRemove(asset.id)}>
                Remove
              </button>
            </div>
            <p className="mt-1 text-muted-foreground">{asset.description || "No note yet."}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}

function UploadField({
  label,
  role,
  onUpload,
}: {
  label: string;
  role: "style" | "footage";
  onUpload: (file: File, role: "style" | "footage", description: string) => void;
}) {
  return (
    <form
      className="grid gap-2 rounded-xl border border-dashed border-border p-3"
      onSubmit={(event) => {
        event.preventDefault();
        const data = new FormData(event.currentTarget);
        const file = data.get("file");
        if (file instanceof File && file.size) onUpload(file, role, String(data.get("description") || ""));
        event.currentTarget.reset();
      }}
    >
      <Label>{label}</Label>
      <Input name="file" type="file" accept="video/mp4,video/quicktime,video/webm,.mkv,.m4v" />
      <Input name="description" placeholder={role === "style" ? "Optional note" : "What are we looking at?"} />
      <Button type="submit" variant="outline" size="sm">
        Add
      </Button>
    </form>
  );
}

function Choice({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: string[];
  onChange: (value: string) => void;
}) {
  return (
    <div className="grid gap-1">
      <span className="text-[11px] text-muted-foreground">{label}</span>
      <div className="flex flex-wrap gap-1">
        {options.map((option) => (
          <Button key={option} type="button" size="sm" variant={option === value ? "default" : "outline"} onClick={() => onChange(option)}>
            {option}
          </Button>
        ))}
      </div>
    </div>
  );
}

function AgentNote({ title, body }: { title: string; body: string }) {
  if (!body) return null;
  return (
    <details className="text-xs">
      <summary className="cursor-pointer text-muted-foreground">{title}</summary>
      <pre className="mt-2 max-h-48 overflow-auto font-mono whitespace-pre-wrap text-muted-foreground">{body}</pre>
    </details>
  );
}
