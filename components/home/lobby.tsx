"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { projectStatus } from "@/lib/status";
import type { Platform, Project } from "@/lib/types";

const LENGTHS = [15, 24, 30, 45, 60];

export function Lobby() {
  const router = useRouter();
  const [projects, setProjects] = useState<Project[] | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState("");
  const [title, setTitle] = useState("");
  const [brief, setBrief] = useState("");
  const [platform, setPlatform] = useState<Platform>("both");
  const [targetDuration, setTargetDuration] = useState(24);

  async function refresh() {
    const response = await fetch("/api/projects", { cache: "no-store" });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Couldn't open the room.");
    setProjects(data.projects);
  }

  useEffect(() => {
    refresh().catch((reason: Error) => setError(reason.message));
  }, []);

  async function createProject() {
    setBusy("create");
    setError("");
    try {
      const response = await fetch("/api/projects", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          title: title.trim() || "Untitled cut",
          brief: brief.trim(),
          platform,
          targetDuration,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Couldn't start that project.");
      router.push(`/project/${data.id}`);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Couldn't start that project.");
      setBusy("");
    }
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

  async function remove(id: string) {
    setError("");
    const response = await fetch(`/api/projects/${id}`, { method: "DELETE" });
    const data = await response.json();
    if (!response.ok) {
      setError(data.error || "Couldn't delete that project.");
      return;
    }
    await refresh();
  }

  return (
    <main className="min-h-dvh bg-background text-foreground">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-10 px-5 py-8 sm:px-8">
        <header className="flex items-center gap-3">
          <span className="size-2.5 rounded-full bg-primary shadow-[0_0_12px_var(--primary)]" />
          <span className="font-serif text-2xl tracking-tight">Reelroom</span>
        </header>

        <section className="grid items-end gap-8 lg:grid-cols-[1.2fr_0.8fr]">
          <div className="max-w-xl">
            <p className="text-xs tracking-[0.22em] text-muted-foreground uppercase">Instagram Reels · TikTok</p>
            <h1 className="mt-3 font-serif text-5xl leading-[0.95] text-balance sm:text-6xl">
              Raw footage in. A vertical short out.
            </h1>
            <p className="mt-5 max-w-lg text-base leading-relaxed text-muted-foreground">
              Five agents share one timeline. Style reads a reference. Script workshops the outline with you.
              Selects pulls the frames that can carry a beat. The editor stitches. Conform sends the cut back
              if it doesn&apos;t match.
            </p>
          </div>
          <ol className="grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-1">
            {[
              ["01 Style", "Pace, grade, captions, and how hard the cuts are."],
              ["02 Script", "A hook, a turn, a payoff. You can argue with it."],
              ["03 Selects", "Motion, a change in the frame, and the loud parts."],
              ["04 Edit", "Trim, reorder, and rewrite any line by hand."],
              ["05 Conform", "The style agent checks the cut, then the export is 1080×1920."],
            ].map(([title, body]) => (
              <li key={title} className="border-t border-border pt-3">
                <p className="font-medium">{title}</p>
                <p className="text-muted-foreground">{body}</p>
              </li>
            ))}
          </ol>
        </section>

        {error ? <p className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm">{error}</p> : null}

        <section className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
          <article className="flex flex-col justify-between rounded-2xl border border-border bg-card p-5">
            <div>
              <Badge variant="secondary">Sample footage</Badge>
              <h2 className="mt-4 font-serif text-4xl">Morning pour</h2>
              <p className="mt-3 max-w-md text-sm leading-relaxed text-muted-foreground">
                A generated reference and five raw clips about coffee. Run the whole room, then replace the
                pictures with yours. The counter clip is dull on purpose. The cut should leave it out.
              </p>
            </div>
            <Button className="mt-6 w-fit" disabled={busy !== ""} onClick={openSample}>
              {busy === "sample" ? "Putting the rushes on the bench…" : "Open the sample"}
            </Button>
          </article>

          <form
            className="rounded-2xl border border-border bg-card p-5"
            onSubmit={(event) => {
              event.preventDefault();
              void createProject();
            }}
          >
            <h2 className="font-serif text-3xl">New project</h2>
            <div className="mt-4 grid gap-3">
              <div className="grid gap-1.5">
                <Label htmlFor="title">Title</Label>
                <Input id="title" value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Saturday market" />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="brief">What is this about?</Label>
                <Textarea
                  id="brief"
                  value={brief}
                  onChange={(event) => setBrief(event.target.value)}
                  placeholder="Who it's for, and what should be true by the last frame."
                />
              </div>
              <div className="grid gap-1.5">
                <Label>Platform</Label>
                <div className="flex flex-wrap gap-2">
                  {(
                    [
                      ["both", "Reels and TikTok"],
                      ["instagram", "Instagram"],
                      ["tiktok", "TikTok"],
                    ] as const
                  ).map(([value, label]) => (
                    <Button
                      key={value}
                      type="button"
                      variant={platform === value ? "default" : "outline"}
                      onClick={() => setPlatform(value)}
                    >
                      {label}
                    </Button>
                  ))}
                </div>
              </div>
              <div className="grid gap-1.5">
                <Label>Length</Label>
                <div className="flex flex-wrap gap-2">
                  {LENGTHS.map((length) => (
                    <Button
                      key={length}
                      type="button"
                      variant={targetDuration === length ? "default" : "outline"}
                      onClick={() => setTargetDuration(length)}
                    >
                      {length}s
                    </Button>
                  ))}
                </div>
              </div>
            </div>
            <Button className="mt-5" type="submit" disabled={busy !== ""}>
              {busy === "create" ? "Opening…" : "Open the room"}
            </Button>
          </form>
        </section>

        <section>
          <h2 className="font-serif text-3xl">On the bench</h2>
          {projects === null ? <p className="mt-3 text-sm text-muted-foreground">Opening the bench…</p> : null}
          {projects?.length === 0 ? (
            <p className="mt-3 max-w-md text-sm text-muted-foreground">
              Nothing cut yet. Start a project, or open the morning pour and run the room.
            </p>
          ) : null}
          <ul className="mt-4 grid gap-3 sm:grid-cols-2">
            {projects?.map((project) => {
              const status = projectStatus(project);
              return (
                <li key={project.id} className="rounded-xl border border-border bg-card p-4">
                  <div className="flex items-start justify-between gap-3">
                    <button className="text-left" onClick={() => router.push(`/project/${project.id}`)}>
                      <p className="font-serif text-2xl">{project.title}</p>
                      <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
                        {project.brief || "No brief yet."}
                      </p>
                    </button>
                    <Badge variant={status.tone === "pass" ? "default" : "outline"}>{status.label}</Badge>
                  </div>
                  <div className="mt-4 flex items-center justify-between text-xs text-muted-foreground">
                    <span>{when(project.updatedAt)}</span>
                    <button className="underline-offset-2 hover:underline" onClick={() => void remove(project.id)}>
                      Delete
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      </div>
    </main>
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
