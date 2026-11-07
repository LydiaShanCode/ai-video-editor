"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { projectStatus } from "@/lib/status";
import type { AssetRole, Project } from "@/lib/types";

const LENGTHS = [15, 24, 30, 45, 60];
const VIDEO = /\.(mp4|mov|m4v|webm|mkv)$/i;
const MAX_BYTES = 250 * 1024 * 1024;
const MAX_CLIPS = 12;

type Queued = {
  id: string;
  file: File;
  role: AssetRole;
  note: string;
  url: string;
};

export function Lobby() {
  const router = useRouter();
  const [projects, setProjects] = useState<Project[] | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState("");
  const [progress, setProgress] = useState("");
  const [recoverId, setRecoverId] = useState("");
  const [brief, setBrief] = useState("");
  const [targetDuration, setTargetDuration] = useState(24);
  const [clips, setClips] = useState<Queued[]>([]);
  const urls = useRef<string[]>([]);

  const references = clips.filter((clip) => clip.role === "style");
  const footage = clips.filter((clip) => clip.role === "footage");

  async function refresh() {
    const response = await fetch("/api/projects", { cache: "no-store" });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Couldn't open the room.");
    setProjects(data.projects);
  }

  useEffect(() => {
    refresh().catch((reason: Error) => setError(reason.message));
  }, []);

  useEffect(() => {
    const current = urls.current;
    return () => {
      for (const url of current) URL.revokeObjectURL(url);
    };
  }, []);

  function addFiles(role: AssetRole, list: FileList | File[]) {
    const incoming = [...list];
    const next: Queued[] = [];
    const problems: string[] = [];
    for (const file of incoming) {
      if (clips.length + next.length >= MAX_CLIPS) {
        problems.push("Twelve clips is the limit for one cut.");
        break;
      }
      if (!VIDEO.test(file.name)) {
        problems.push(`${file.name} needs to be an MP4, MOV, M4V, WEBM, or MKV.`);
        continue;
      }
      if (file.size > MAX_BYTES) {
        problems.push(`${file.name} is over 250 MB.`);
        continue;
      }
      const url = URL.createObjectURL(file);
      urls.current.push(url);
      next.push({ id: crypto.randomUUID(), file, role, note: "", url });
    }
    if (next.length) setClips((current) => [...current, ...next]);
    setError(problems[0] || "");
    setRecoverId("");
  }

  function removeClip(id: string) {
    setClips((current) => {
      const clip = current.find((item) => item.id === id);
      if (clip) URL.revokeObjectURL(clip.url);
      return current.filter((item) => item.id !== id);
    });
  }

  function noteClip(id: string, note: string) {
    setClips((current) => current.map((clip) => (clip.id === id ? { ...clip, note } : clip)));
  }

  async function openSample() {
    setBusy("sample");
    setError("");
    try {
      const response = await fetch("/api/demo", { method: "POST" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Couldn't load the sample.");
      router.push(`/project/${data.id}`);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Couldn't load the sample.");
      setBusy("");
    }
  }

  async function openCut() {
    if (!footage.length) {
      setError("Drop the raw footage first.");
      return;
    }
    setBusy("open");
    setError("");
    setRecoverId("");
    const title = footage[0]?.file.name.replace(/\.[^.]+$/, "").slice(0, 80) || "Untitled cut";
    try {
      const response = await fetch("/api/projects", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          title,
          brief: brief.trim(),
          platform: "both",
          targetDuration,
        }),
      });
      const project = await response.json();
      if (!response.ok) throw new Error(project.error || "Couldn't open the editor.");
      const queue = [...references, ...footage];
      for (let index = 0; index < queue.length; index += 1) {
        const clip = queue[index];
        if (!clip) continue;
        setProgress(`${clip.file.name} · ${index + 1} of ${queue.length}`);
        const body = new FormData();
        body.set("file", clip.file);
        body.set("role", clip.role);
        body.set("name", clip.file.name.replace(/\.[^.]+$/, ""));
        body.set("description", clip.note);
        const uploaded = await fetch(`/api/projects/${project.id}/upload`, { method: "POST", body });
        const data = await uploaded.json();
        if (!uploaded.ok) {
          setRecoverId(project.id);
          throw new Error(data.error || `Couldn't read ${clip.file.name}.`);
        }
      }
      router.push(`/project/${project.id}`);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Couldn't open the editor.");
      setBusy("");
      setProgress("");
    }
  }

  async function removeProject(id: string) {
    setError("");
    const response = await fetch(`/api/projects/${id}`, { method: "DELETE" });
    const data = await response.json();
    if (!response.ok) {
      setError(data.error || "Couldn't delete that cut.");
      return;
    }
    await refresh();
  }

  return (
    <main className="flex min-h-dvh flex-col bg-background text-foreground">
      <header className="flex h-14 shrink-0 items-center gap-3 px-4 sm:px-6">
        <span className="size-2.5 rounded-full bg-primary shadow-[0_0_12px_var(--primary)]" />
        <span className="font-serif text-2xl tracking-tight">Reelroom</span>
        <span className="hidden text-sm text-muted-foreground sm:inline">1080×1920</span>
        <Button className="ml-auto" size="sm" variant="outline" disabled={busy !== ""} onClick={() => void openSample()}>
          {busy === "sample" ? "Loading sample…" : "Morning pour"}
        </Button>
      </header>

      <div className="grid min-h-0 flex-1 gap-3 px-4 pb-3 sm:px-6 lg:grid-cols-2">
        <Bin
          title="References"
          hint="A finished reel whose pace you want."
          empty="Drop the edits you want this to feel like."
          clips={references}
          disabled={busy !== ""}
          onFiles={(files) => addFiles("style", files)}
          onRemove={removeClip}
          onNote={noteClip}
        />
        <Bin
          title="Raw footage"
          hint="The rushes this cut is made from."
          empty="Drop the clips. Several is fine."
          clips={footage}
          disabled={busy !== ""}
          onFiles={(files) => addFiles("footage", files)}
          onRemove={removeClip}
          onNote={noteClip}
        />
      </div>

      <footer className="shrink-0 border-t border-border px-4 py-3 sm:px-6">
        {error ? <p className="mb-3 rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm">{error}</p> : null}
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end">
          <label className="grid min-w-0 flex-1 gap-1 text-[11px] text-muted-foreground">
            What is this about?
            <input
              value={brief}
              onChange={(event) => setBrief(event.target.value)}
              placeholder="The ten seconds that make the morning. Not the gear."
              className="h-9 rounded-lg border border-input bg-transparent px-3 text-sm text-foreground"
            />
          </label>
          <div className="flex flex-wrap items-center gap-2">
            {LENGTHS.map((length) => (
              <Button
                key={length}
                type="button"
                size="sm"
                variant={targetDuration === length ? "default" : "outline"}
                onClick={() => setTargetDuration(length)}
              >
                {length}s
              </Button>
            ))}
            <Button disabled={busy !== "" || footage.length === 0} onClick={() => void openCut()}>
              {busy === "open" ? progress || "Opening the editor…" : footage.length === 0 ? "Drop footage to open" : "Open the editor"}
            </Button>
            {recoverId ? (
              <Button variant="outline" onClick={() => router.push(`/project/${recoverId}`)}>
                Open what landed
              </Button>
            ) : null}
          </div>
        </div>
        <div className="mt-3 flex gap-2 overflow-x-auto">
          {projects === null ? <p className="text-xs text-muted-foreground">Opening recent cuts…</p> : null}
          {projects?.length === 0 ? <p className="text-xs text-muted-foreground">No cuts yet.</p> : null}
          {projects?.map((project) => {
            const status = projectStatus(project);
            return (
              <div key={project.id} className="flex shrink-0 items-center gap-2 rounded-lg border border-border px-3 py-2">
                <button className="text-left" onClick={() => router.push(`/project/${project.id}`)}>
                  <span className="block font-serif text-base leading-none">{project.title}</span>
                  <span className="mt-1 block text-[11px] text-muted-foreground">
                    {status.label} · {when(project.updatedAt)}
                  </span>
                </button>
                <button className="text-[11px] text-muted-foreground underline-offset-2 hover:underline" onClick={() => void removeProject(project.id)}>
                  Delete
                </button>
              </div>
            );
          })}
        </div>
      </footer>
    </main>
  );
}

function Bin({
  title,
  hint,
  empty,
  clips,
  disabled,
  onFiles,
  onRemove,
  onNote,
}: {
  title: string;
  hint: string;
  empty: string;
  clips: Queued[];
  disabled: boolean;
  onFiles: (files: FileList | File[]) => void;
  onRemove: (id: string) => void;
  onNote: (id: string, note: string) => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);
  const label = useMemo(() => `${title} videos`, [title]);

  return (
    <section
      className={`flex min-h-72 flex-col rounded-2xl border bg-card p-3 ${over ? "border-primary bg-accent" : "border-border"}`}
      onDragOver={(event) => {
        event.preventDefault();
        if (!disabled) setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(event) => {
        event.preventDefault();
        setOver(false);
        if (!disabled && event.dataTransfer.files.length) onFiles(event.dataTransfer.files);
      }}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="font-serif text-3xl">{title}</h2>
          <p className="text-sm text-muted-foreground">{hint}</p>
        </div>
        <Button type="button" size="sm" variant="outline" disabled={disabled} onClick={() => input.current?.click()}>
          Browse
        </Button>
        <input
          ref={input}
          className="sr-only"
          type="file"
          multiple
          accept="video/mp4,video/quicktime,video/webm,video/x-matroska,.mp4,.mov,.m4v,.webm,.mkv"
          aria-label={label}
          onChange={(event) => {
            if (event.target.files?.length) onFiles(event.target.files);
            event.target.value = "";
          }}
        />
      </div>
      {clips.length === 0 ? (
        <button
          type="button"
          disabled={disabled}
          onClick={() => input.current?.click()}
          className="mt-3 grid flex-1 place-items-center rounded-xl border border-dashed border-border px-6 text-center text-sm text-muted-foreground"
        >
          {empty}
        </button>
      ) : (
        <ul className="mt-3 grid flex-1 auto-rows-min grid-cols-2 gap-2 sm:grid-cols-3">
          {clips.map((clip) => (
            <li key={clip.id} className="overflow-hidden rounded-xl border border-border bg-background">
              <div className="relative aspect-[9/16] bg-black">
                <video
                  src={clip.url}
                  muted
                  playsInline
                  preload="metadata"
                  className="size-full object-cover"
                  onLoadedMetadata={(event) => {
                    const video = event.currentTarget;
                    if (video.duration > 0.3) video.currentTime = Math.min(0.4, video.duration / 3);
                  }}
                />
                <button
                  type="button"
                  className="absolute top-1.5 right-1.5 rounded-full bg-black/70 px-2 py-0.5 text-[11px] text-white"
                  onClick={() => onRemove(clip.id)}
                >
                  Lift
                </button>
              </div>
              <div className="grid gap-1 p-2">
                <p className="truncate text-xs">{clip.file.name}</p>
                <input
                  value={clip.note}
                  onChange={(event) => onNote(clip.id, event.target.value)}
                  placeholder={clip.role === "style" ? "What to borrow" : "What are we looking at?"}
                  className="h-7 rounded-md border border-input bg-transparent px-2 text-[11px]"
                  aria-label={`Note for ${clip.file.name}`}
                />
              </div>
            </li>
          ))}
          <li>
            <button
              type="button"
              disabled={disabled}
              onClick={() => input.current?.click()}
              className="grid aspect-[9/16] w-full place-items-center rounded-xl border border-dashed border-border text-sm text-muted-foreground"
            >
              Add
            </button>
          </li>
        </ul>
      )}
    </section>
  );
}

function when(iso: string) {
  return (
    new Intl.DateTimeFormat("en-US", {
      timeZone: "America/New_York",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    }).format(new Date(iso)) + " ET"
  );
}
