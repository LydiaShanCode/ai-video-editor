"use client";

import { useEffect, useMemo, useRef } from "react";
import { cssCaption, gradeCss, wrapCaption } from "@/lib/grade";
import { timecode } from "@/lib/text";
import type { Project, TimelineClip } from "@/lib/types";

type Span = { clip: TimelineClip; start: number; end: number };

export function PhonePreview({
  project,
  time,
  playing,
  seekNonce,
  mode,
  safe,
  onTime,
  onPlaying,
}: {
  project: Project;
  time: number;
  playing: boolean;
  seekNonce: number;
  mode: "timeline" | "export";
  safe: boolean;
  onTime: (time: number) => void;
  onPlaying: (playing: boolean) => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const playingRef = useRef(playing);
  playingRef.current = playing;
  const indexRef = useRef(0);
  const spans = useMemo(() => buildSpans(project.timeline), [project.timeline]);
  const total = spans.at(-1)?.end ?? 0;
  const render = project.renders[0];
  const current = spanAt(spans, time) ?? spans[0];
  const caption = current ? wrapCaption(current.clip.caption) : "";
  const look = project.style ? cssCaption(project.style) : null;

  useEffect(() => {
    if (mode !== "timeline") return;
    const span = spanAt(spans, time) ?? spans[0];
    if (!span) return;
    indexRef.current = spans.indexOf(span);
    loadSpan(videoRef.current, project.id, span, time, playingRef.current, () => onPlaying(false));
    // Seek only when the user scrubs, playback starts, or the cut changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seekNonce, playing, mode, project.id, spans]);

  function onTimeUpdate() {
    const video = videoRef.current;
    const span = spans[indexRef.current];
    if (!video || !span || !playingRef.current || mode !== "timeline") return;
    if (video.currentTime >= span.clip.outSec - 0.07) {
      const next = spans[indexRef.current + 1];
      if (!next) {
        onPlaying(false);
        onTime(0);
        indexRef.current = 0;
        return;
      }
      indexRef.current += 1;
      onTime(next.start);
      loadSpan(video, project.id, next, next.start, true, () => onPlaying(false));
      return;
    }
    onTime(span.start + Math.max(0, video.currentTime - span.clip.inSec));
  }

  return (
    <div className="flex min-h-[420px] flex-col items-center justify-center gap-4 bg-[radial-gradient(ellipse_at_center,rgba(255,77,28,0.08),transparent_62%)] px-4 py-6">
      <div className="relative aspect-[9/16] h-[min(62vh,640px)] overflow-hidden rounded-[1.6rem] border border-border bg-black shadow-[0_30px_80px_rgba(0,0,0,0.35)]">
        {mode === "export" && render ? (
          <video
            key={render.id}
            className="size-full bg-black object-cover"
            controls
            playsInline
            src={`/api/projects/${project.id}/renders/${render.id}`}
          />
        ) : current ? (
          <video
            ref={videoRef}
            className="size-full bg-black object-cover"
            playsInline
            style={{ filter: project.style ? gradeCss(project.style) : undefined }}
            onTimeUpdate={onTimeUpdate}
          />
        ) : (
          <div className="flex size-full flex-col items-center justify-center px-8 text-center">
            <p className="font-serif text-3xl">No cut yet</p>
            <p className="mt-2 text-sm text-white/70">Assemble the timeline and the phone plays it here.</p>
          </div>
        )}
        {mode === "timeline" && caption && look ? (
          <div className={`pointer-events-none absolute inset-x-6 text-center ${look.position}`}>
            <p className={look.face}>
              {caption.split("\n").map((line) => (
                <span key={line} className="block">
                  {line}
                </span>
              ))}
            </p>
          </div>
        ) : null}
        {safe ? (
          <div className="pointer-events-none absolute inset-0">
            <div className="absolute inset-x-0 top-0 h-[12%] border-b border-dashed border-white/25" />
            <div className="absolute inset-y-0 right-0 w-[14%] border-l border-dashed border-white/25" />
            <div className="absolute inset-x-0 bottom-0 h-[20%] border-t border-dashed border-white/25" />
          </div>
        ) : null}
      </div>
      <div className="flex items-center gap-3 text-xs text-muted-foreground">
        <button
          className="rounded-full border border-border px-3 py-1 text-foreground"
          onClick={() => onPlaying(!playing)}
          disabled={mode === "export" || !spans.length}
        >
          {playing ? "Pause" : "Play"}
        </button>
        <span className="font-mono tabular-nums">
          {timecode(mode === "export" ? render?.duration ?? 0 : time)} / {timecode(mode === "export" ? render?.duration ?? 0 : total)}
        </span>
      </div>
    </div>
  );
}

function buildSpans(clips: TimelineClip[]): Span[] {
  let cursor = 0;
  return clips.map((clip) => {
    const start = cursor;
    cursor += Math.max(0.05, clip.outSec - clip.inSec);
    return { clip, start, end: cursor };
  });
}

function spanAt(spans: Span[], time: number) {
  return spans.find((span) => time >= span.start && time < span.end) ?? null;
}

function loadSpan(
  video: HTMLVideoElement | null,
  projectId: string,
  span: Span,
  time: number,
  shouldPlay: boolean,
  onBlocked: () => void,
) {
  if (!video) return;
  const src = `/api/projects/${projectId}/media/${span.clip.assetId}`;
  const local = span.clip.inSec + Math.max(0, time - span.start);
  const seek = () => {
    const target = Math.min(span.clip.outSec - 0.05, Math.max(span.clip.inSec, local));
    if (Math.abs(video.currentTime - target) > 0.08) video.currentTime = target;
    if (shouldPlay) void video.play().catch(() => onBlocked());
    else video.pause();
  };
  if (video.dataset.src !== src) {
    video.dataset.src = src;
    video.src = src;
    video.onloadeddata = seek;
  } else {
    seek();
  }
}
