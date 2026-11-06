"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PhonePreview } from "@/components/studio/preview";
import { StepPanel, type Step } from "@/components/studio/panels";
import { Timeline } from "@/components/studio/timeline";
import { uid } from "@/lib/ids";
import { timelineDuration } from "@/lib/status";
import type { Project, Script, Select, StyleProfile, TimelineClip } from "@/lib/types";

export function Studio({ projectId }: { projectId: string }) {
  const [project, setProject] = useState<Project | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState("");
  const [step, setStep] = useState<Step>("style");
  const [time, setTime] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [seekNonce, setSeekNonce] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  const [mode, setMode] = useState<"timeline" | "export">("timeline");
  const [safe, setSafe] = useState(true);
  const [draft, setDraft] = useState("");
  const saveSeq = useRef(0);
  const saveChain = useRef(Promise.resolve());

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/projects/${projectId}`, { cache: "no-store" })
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "This project isn't on the bench.");
        if (!cancelled) setProject(data);
      })
      .catch((reason: Error) => {
        if (!cancelled) setError(reason.message);
      });
    return () => {
      cancelled = true;
    };
  }, [projectId]);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA")) return;
      if (event.code === "Space") {
        event.preventDefault();
        setPlaying((value) => !value);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  async function call(stage: string, extra?: { message?: string; apply?: boolean }) {
    const response = await fetch(`/api/projects/${projectId}/run`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ stage, ...extra }),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "The room stopped.");
    setProject(data);
    return data as Project;
  }

  async function run(stage: "style" | "script" | "selects" | "assemble" | "conform" | "render" | "undo", extra?: { message?: string; apply?: boolean }) {
    setBusy(stage);
    setError("");
    try {
      const next = await call(stage, extra);
      if (stage === "assemble" || stage === "undo") {
        setMode("timeline");
        setTime(0);
        setSeekNonce((value) => value + 1);
        setSelected(next.timeline[0]?.id ?? null);
      }
      if (stage === "render") setMode("export");
      if (stage === "script") setStep("script");
      if (stage === "conform") setStep("conform");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "The room stopped.");
    } finally {
      setBusy("");
    }
  }

  async function runRoom() {
    setBusy("room");
    setError("");
    try {
      await call("style");
      await call("script");
      await call("selects");
      await call("assemble");
      await call("render");
      const checked = await call("conform", { apply: true });
      if (checked.conform?.notes.some((note) => note.applied)) {
        await call("render");
        await call("conform", { apply: false });
      }
      setStep("conform");
      setMode("export");
      setPlaying(false);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "The room stopped.");
    } finally {
      setBusy("");
    }
  }

  function persist(patch: object, optimistic: Project) {
    const seq = ++saveSeq.current;
    setProject(optimistic);
    saveChain.current = saveChain.current
      .then(async () => {
        const response = await fetch(`/api/projects/${projectId}`, {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(patch),
        });
        const data = await response.json();
        if (seq !== saveSeq.current) return;
        if (!response.ok) {
          setError(data.error || "Couldn't save that change.");
          return;
        }
        setProject(data);
      })
      .catch((reason: unknown) => {
        if (seq !== saveSeq.current) return;
        setError(reason instanceof Error ? reason.message : "Couldn't save that change.");
      });
  }

  async function upload(file: File, role: "style" | "footage", description: string) {
    if (file.size > 250 * 1024 * 1024) {
      setError("Keep each file under 250 MB.");
      return;
    }
    setBusy("upload");
    setError("");
    try {
      const body = new FormData();
      body.set("file", file);
      body.set("role", role);
      body.set("description", description);
      body.set("name", file.name.replace(/\.[^.]+$/, ""));
      const response = await fetch(`/api/projects/${projectId}/upload`, { method: "POST", body });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Upload failed.");
      setProject(data);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Upload failed.");
    } finally {
      setBusy("");
    }
  }

  async function removeAsset(id: string) {
    setBusy("upload");
    setError("");
    try {
      const response = await fetch(`/api/projects/${projectId}/assets/${id}`, { method: "DELETE" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Couldn't remove that clip.");
      setProject(data);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Couldn't remove that clip.");
    } finally {
      setBusy("");
    }
  }

  if (!project && !error) {
    return <main className="grid min-h-dvh place-items-center text-sm text-muted-foreground">Opening the room…</main>;
  }
  if (!project) {
    return (
      <main className="grid min-h-dvh place-items-center px-6 text-center">
        <div>
          <p className="font-serif text-4xl">This cut isn&apos;t on the bench.</p>
          <p className="mt-2 text-sm text-muted-foreground">{error}</p>
          <Link href="/" className="mt-4 inline-block text-sm underline underline-offset-2">
            Back to projects
          </Link>
        </div>
      </main>
    );
  }

  const duration = timelineDuration(project);
  const steps: { id: Step; label: string; detail: string }[] = [
    { id: "style", label: "Style", detail: project.style ? `${project.style.cutRhythm} · ${project.style.grade}` : "Not read" },
    { id: "script", label: "Script", detail: project.script ? `${project.script.beats.length} beats` : "No outline" },
    { id: "selects", label: "Selects", detail: project.selects.length ? `${project.selects.length} windows` : "Not pulled" },
    { id: "edit", label: "Edit", detail: project.timeline.length ? `${project.timeline.length} shots · ${duration.toFixed(0)}s` : "Empty" },
    { id: "conform", label: "Conform", detail: project.conform ? (project.conform.pass ? "Matched" : "Needs a pass") : "Not checked" },
  ];

  function updateClip(id: string, patch: Partial<TimelineClip>) {
    const timeline = project!.timeline.map((clip) => (clip.id === id ? { ...clip, ...patch } : clip));
    void persist({ timeline }, { ...project!, timeline });
    setMode("timeline");
  }

  function moveClip(id: string, direction: -1 | 1) {
    const index = project!.timeline.findIndex((clip) => clip.id === id);
    const next = index + direction;
    if (index < 0 || next < 0 || next >= project!.timeline.length) return;
    const timeline = [...project!.timeline];
    const [item] = timeline.splice(index, 1);
    if (!item) return;
    timeline.splice(next, 0, item);
    void persist({ timeline }, { ...project!, timeline });
  }

  function addSelect(select: Select) {
    const clip: TimelineClip = {
      id: uid("clp"),
      assetId: select.assetId,
      inSec: select.inSec,
      outSec: select.outSec,
      caption: project?.script?.beats[0]?.onScreenText ?? "",
      muted: false,
    };
    const timeline = [...project!.timeline, clip];
    void persist({ timeline }, { ...project!, timeline });
    setSelected(clip.id);
    setStep("edit");
    setMode("timeline");
  }

  return (
    <main className="flex min-h-dvh flex-col bg-background text-foreground lg:h-dvh lg:overflow-hidden">
      <header className="flex min-h-14 shrink-0 flex-wrap items-center gap-2 border-b border-border px-3 py-2 sm:gap-3 sm:px-4">
        <Link href="/" className="flex items-center gap-2 text-sm">
          <span className={`size-2 rounded-full bg-primary ${busy ? "animate-pulse shadow-[0_0_12px_var(--primary)]" : ""}`} />
          <span className="font-serif text-lg">Reelroom</span>
        </Link>
        <p className="hidden truncate font-serif text-xl sm:block">{project.title}</p>
        {project.sample ? <Badge variant="secondary">Sample</Badge> : null}
        <div className="ml-auto flex items-center gap-2">
          <Button size="sm" variant="outline" disabled={busy !== ""} onClick={() => void runRoom()}>
            {busy === "room" ? "Running the room…" : "Run the room"}
          </Button>
          <Button
            size="sm"
            disabled={busy !== ""}
            onClick={() => {
              setStep("conform");
              void run("render");
            }}
          >
            {busy === "render" ? "Exporting…" : "Export"}
          </Button>
        </div>
      </header>
      {error ? <p className="border-b border-destructive/30 bg-destructive/10 px-4 py-2 text-sm">{error}</p> : null}
      <div className="flex min-h-0 flex-1 flex-col lg:grid lg:grid-cols-[232px_minmax(0,1fr)_360px] lg:grid-rows-[minmax(0,1fr)_12.5rem]">
        <aside className="flex gap-2 overflow-x-auto border-b border-border p-3 lg:col-start-1 lg:row-span-2 lg:flex-col lg:overflow-y-auto lg:border-r lg:border-b-0">
          {steps.map((item, index) => (
            <button
              key={item.id}
              onClick={() => setStep(item.id)}
              className={`min-w-36 rounded-xl border px-3 py-2 text-left lg:min-w-0 ${step === item.id ? "border-primary bg-accent" : "border-border"}`}
            >
              <p className="text-[10px] tracking-[0.16em] text-muted-foreground uppercase">0{index + 1}</p>
              <p className="font-medium">{item.label}</p>
              <p className="text-xs text-muted-foreground">{item.detail}</p>
            </button>
          ))}
          <div className="hidden min-h-0 flex-1 lg:block" />
          <div className="hidden lg:grid lg:gap-1">
            {project.log.slice(-5).map((line) => (
              <p key={line.id} className="text-[11px] leading-snug text-muted-foreground">
                <span className="text-foreground">{line.agent}.</span> {line.text}
              </p>
            ))}
          </div>
        </aside>
        <section className="lg:col-start-2 lg:row-start-1 lg:min-h-0">
          <div className="flex items-center justify-center gap-2 pt-3">
            <Button size="sm" variant={mode === "timeline" ? "default" : "outline"} onClick={() => setMode("timeline")}>
              Timeline
            </Button>
            <Button size="sm" variant={mode === "export" ? "default" : "outline"} onClick={() => setMode("export")} disabled={!project.renders.length}>
              Finished file
            </Button>
            <Button size="sm" variant={safe ? "secondary" : "outline"} onClick={() => setSafe((value) => !value)}>
              Safe zones
            </Button>
          </div>
          <PhonePreview
            project={project}
            time={time}
            playing={playing}
            seekNonce={seekNonce}
            mode={mode}
            safe={safe}
            onTime={setTime}
            onPlaying={(value) => {
              setPlaying(value);
              if (value) setSeekNonce((nonce) => nonce + 1);
            }}
          />
        </section>
        <aside className="border-t border-border lg:col-start-3 lg:row-span-2 lg:row-start-1 lg:overflow-y-auto lg:border-t-0 lg:border-l">
          <StepPanel
            step={step}
            project={project}
            busy={busy}
            draft={draft}
            onDraft={setDraft}
            onRun={(stage, extra) => void run(stage, extra)}
            onStyle={(patch: Partial<StyleProfile>) => {
              if (!project.style) return;
              const style = { ...project.style, ...patch };
              void persist({ style }, { ...project, style });
            }}
            onScript={(script: Script) => void persist({ script }, { ...project, script })}
            onUpload={(file, role, description) => void upload(file, role, description)}
            onRemoveAsset={(id) => void removeAsset(id)}
            onAddSelect={addSelect}
            onApplyConform={() => void run("conform", { apply: true })}
          />
        </aside>
        <section className="border-t border-border lg:col-start-2 lg:row-start-2 lg:min-h-0">
          <Timeline
            project={project}
            time={time}
            selected={selected}
            onSeek={(next) => {
              setTime(next);
              setSeekNonce((value) => value + 1);
              setPlaying(false);
              setMode("timeline");
            }}
            onSelect={(id) => {
              setSelected(id);
              const index = project.timeline.findIndex((clip) => clip.id === id);
              let cursor = 0;
              for (let item = 0; item < index; item += 1) {
                const clip = project.timeline[item];
                if (clip) cursor += clip.outSec - clip.inSec;
              }
              setTime(cursor);
              setSeekNonce((value) => value + 1);
              setMode("timeline");
            }}
            onChange={updateClip}
            onMove={moveClip}
            onRemove={(id) => {
              const timeline = project.timeline.filter((clip) => clip.id !== id);
              void persist({ timeline }, { ...project, timeline });
              if (selected === id) setSelected(timeline[0]?.id ?? null);
            }}
          />
        </section>
      </div>
    </main>
  );
}
