"use client";

import { useEffect, useRef, useState } from "react";
import { Slider } from "@/components/ui/slider";
import { timecode } from "@/lib/text";
import type { Project, TimelineClip } from "@/lib/types";

const PX = 72;

export function Timeline({
  project,
  time,
  selected,
  onSeek,
  onSelect,
  onChange,
  onMove,
  onRemove,
}: {
  project: Project;
  time: number;
  selected: string | null;
  onSeek: (time: number) => void;
  onSelect: (id: string) => void;
  onChange: (id: string, patch: Partial<TimelineClip>) => void;
  onMove: (id: string, direction: -1 | 1) => void;
  onRemove: (id: string) => void;
}) {
  let cursor = 0;
  const spans = project.timeline.map((clip) => {
    const start = cursor;
    const dur = Math.max(0.05, clip.outSec - clip.inSec);
    cursor += dur;
    return { clip, start, dur };
  });
  const total = cursor;
  const clip = project.timeline.find((item) => item.id === selected) ?? null;
  const asset = clip ? project.assets.find((item) => item.id === clip.assetId) : null;

  return (
    <div className="flex h-full min-h-44 flex-col bg-card">
      <div
        className="relative min-h-0 flex-1 overflow-x-auto overflow-y-hidden"
        onClick={(event) => {
          const bounds = event.currentTarget.getBoundingClientRect();
          const x = event.clientX - bounds.left + event.currentTarget.scrollLeft;
          onSeek(Math.max(0, Math.min(total, x / PX)));
        }}
      >
        <div className="relative h-full min-w-full" style={{ width: Math.max(640, total * PX + 24) }}>
          <div className="absolute top-0 bottom-0 w-px bg-primary" style={{ left: time * PX }} />
          <div className="flex h-full items-stretch gap-1 px-2 py-3">
            {spans.map(({ clip: item, dur }) => {
              const source = project.assets.find((asset) => asset.id === item.assetId);
              const thumb = source && source.thumbCount ? Math.min(source.thumbCount - 1, Math.floor((item.inSec / source.duration) * source.thumbCount)) : 0;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    onSelect(item.id);
                  }}
                  className={`relative h-full overflow-hidden rounded-md border text-left ${item.id === selected ? "border-primary" : "border-border"}`}
                  style={{ width: Math.max(84, dur * PX) }}
                >
                  {source ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      alt=""
                      src={`/api/projects/${project.id}/thumb/${source.id}/${thumb}`}
                      className="absolute inset-0 size-full object-cover opacity-80"
                    />
                  ) : null}
                  <span className="relative z-10 flex h-full flex-col justify-between bg-gradient-to-t from-black/80 via-black/10 to-black/30 p-2">
                    <span className="text-[11px] font-medium">{source?.name ?? "Clip"}</span>
                    <span className="truncate text-[10px] text-white/80">{item.caption || "No caption"}</span>
                  </span>
                </button>
              );
            })}
            {!spans.length ? <p className="self-center px-2 text-sm text-muted-foreground">The timeline is empty.</p> : null}
          </div>
        </div>
      </div>
      {clip && asset ? (
        <div className="grid gap-3 border-t border-border px-3 py-2 md:grid-cols-[1.3fr_1fr_auto]">
          <label className="grid gap-1 text-[11px] text-muted-foreground">
            In {timecode(clip.inSec)}
            <Slider
              min={0}
              max={Math.max(0.4, asset.duration)}
              step={0.1}
              value={[clip.inSec]}
              onValueChange={(value) => {
                const next = Array.isArray(value) ? value[0] : value;
                if (typeof next === "number") onChange(clip.id, { inSec: Math.min(next, clip.outSec - 0.35) });
              }}
            />
            <span>Out {timecode(clip.outSec)}</span>
            <Slider
              min={0}
              max={Math.max(0.4, asset.duration)}
              step={0.1}
              value={[clip.outSec]}
              onValueChange={(value) => {
                const next = Array.isArray(value) ? value[0] : value;
                if (typeof next === "number") onChange(clip.id, { outSec: Math.max(next, clip.inSec + 0.35) });
              }}
            />
          </label>
          <label className="grid gap-1 text-[11px] text-muted-foreground">
            Caption
            <CaptionField key={clip.id} value={clip.caption} onChange={(caption) => onChange(clip.id, { caption })} />
          </label>
          <div className="flex items-end gap-2">
            <button className="text-xs underline-offset-2 hover:underline" onClick={() => onMove(clip.id, -1)}>
              Earlier
            </button>
            <button className="text-xs underline-offset-2 hover:underline" onClick={() => onMove(clip.id, 1)}>
              Later
            </button>
            <button className="text-xs underline-offset-2 hover:underline" onClick={() => onChange(clip.id, { muted: !clip.muted })}>
              {clip.muted ? "Unmute" : "Mute"}
            </button>
            <button className="text-xs underline-offset-2 hover:underline" onClick={() => onRemove(clip.id)}>
              Lift
            </button>
          </div>
        </div>
      ) : (
        <p className="border-t border-border px-3 py-2 text-xs text-muted-foreground">Select a shot to trim it, rewrite the caption, or lift it.</p>
      )}
    </div>
  );
}

function CaptionField({ value, onChange }: { value: string; onChange: (caption: string) => void }) {
  const [draft, setDraft] = useState(value);
  const focused = useRef(false);

  useEffect(() => {
    if (!focused.current) setDraft(value);
  }, [value]);

  return (
    <input
      className="h-8 rounded-lg border border-input bg-transparent px-2 text-sm text-foreground"
      value={draft}
      onFocus={() => {
        focused.current = true;
      }}
      onBlur={() => {
        focused.current = false;
        if (draft !== value) onChange(draft);
      }}
      onChange={(event) => {
        const next = event.target.value;
        setDraft(next);
        onChange(next);
      }}
    />
  );
}
