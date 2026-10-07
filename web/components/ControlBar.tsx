"use client";

import { useRef, useState } from "react";
import { formatRaceTime } from "@/lib/format";
import { useReplayStore } from "@/lib/replayStore";
import { SKIP_SECONDS } from "@/lib/shortcuts";
import { TRACK_STATUS } from "@/lib/status";
import { lapTicks, neutralisedPeriods } from "@/lib/timeline";
import type { Command, RaceMeta } from "@/lib/types";
import {
  ArrowCounterClockwiseIcon, MinusIcon, PauseIcon, PlayIcon, PlusIcon, RewindIcon, FastForwardIcon,
  SkipBackIcon, SkipForwardIcon,
} from "@phosphor-icons/react";

export function ControlBar({ meta }: { meta: RaceMeta }) {
  const send = useReplayStore((s) => s.send);
  const playing = useReplayStore((s) => s.buffer.latest?.playing ?? false);
  const speed = useReplayStore((s) => s.buffer.latest?.speed ?? 1);

  const button = (label: string, keys: string, command: Command, icon: React.ReactNode, main = false) => (
    <button
      onClick={() => send(command)}
      aria-label={label}
      title={`${label} (${keys})`}
      className={`flex h-9 w-11 items-center justify-center rounded transition-colors ${
        main ? "bg-f1 text-white hover:bg-f1-hover" : "bg-panel-light text-ink hover:bg-line"}`}
    >
      {icon}
    </button>
  );

  return (
    <footer className="border-t border-line/60 bg-panel px-5 pb-3 pt-2 [grid-area:bottom]">
      <Timeline meta={meta} />
      <div className="mt-2 flex items-center justify-center gap-2">
        {button("Restart", "R", { type: "restart" }, <ArrowCounterClockwiseIcon size={18} weight="bold" />)}
        {button("Previous lap", "Shift+←", { type: "skip_laps", value: -1 }, <SkipBackIcon size={18} weight="fill" />)}
        {button(`Back ${SKIP_SECONDS} seconds`, "←", { type: "skip", value: -SKIP_SECONDS }, <RewindIcon size={18} weight="fill" />)}
        {button(playing ? "Pause" : "Play", "Space", { type: "toggle" },
          playing ? <PauseIcon size={20} weight="fill" /> : <PlayIcon size={20} weight="fill" />, true)}
        {button(`Forward ${SKIP_SECONDS} seconds`, "→", { type: "skip", value: SKIP_SECONDS }, <FastForwardIcon size={18} weight="fill" />)}
        {button("Next lap", "Shift+→", { type: "skip_laps", value: 1 }, <SkipForwardIcon size={18} weight="fill" />)}
        <span className="mx-2 h-6 w-px bg-line" />
        {button("Slower", "↓", { type: "slower" }, <MinusIcon size={18} weight="bold" />)}
        <span className="w-12 text-center font-mono text-sm font-bold tabular-nums" aria-label="Playback speed">
          {speed}×
        </span>
        {button("Faster", "↑", { type: "faster" }, <PlusIcon size={18} weight="bold" />)}
      </div>
    </footer>
  );
}

/**
 * The whole race as a bar. Click or drag to jump. While dragging we only
 * move the knob locally and send one seek when the pointer is released, so a
 * drag doesn't flood the server with dozens of seeks.
 */
function Timeline({ meta }: { meta: RaceMeta }) {
  const t = useReplayStore((s) => Math.round((s.buffer.latest?.t ?? 0) * 2) / 2);
  const send = useReplayStore((s) => s.send);
  const ref = useRef<HTMLDivElement>(null);
  const [dragT, setDragT] = useState<number | null>(null);
  const duration = meta.duration;
  const shown = dragT ?? t;
  const pct = (x: number) => `${(100 * x) / duration}%`;

  const timeAt = (clientX: number) => {
    const box = ref.current!.getBoundingClientRect();
    return Math.min(1, Math.max(0, (clientX - box.left) / box.width)) * duration;
  };

  return (
    <div className="flex items-center gap-3">
      <span className="w-16 text-right font-mono text-xs tabular-nums text-dim">{formatRaceTime(shown)}</span>
      <div
        ref={ref}
        role="slider"
        aria-label="Race timeline"
        aria-valuemin={0}
        aria-valuemax={Math.round(duration)}
        aria-valuenow={Math.round(shown)}
        aria-valuetext={formatRaceTime(shown)}
        tabIndex={-1}
        className="relative h-5 flex-1 cursor-pointer touch-none"
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture(e.pointerId);
          setDragT(timeAt(e.clientX));
        }}
        onPointerMove={(e) => dragT !== null && setDragT(timeAt(e.clientX))}
        onPointerUp={(e) => {
          if (dragT === null) return;
          send({ type: "seek", t: timeAt(e.clientX) });
          setDragT(null);
        }}
      >
        <div className="absolute inset-x-0 top-1/2 h-1 -translate-y-1/2 rounded bg-panel-light" />
        {neutralisedPeriods(meta.track_status_changes, duration).map((s) => (
          <div key={s.start} className="absolute top-1/2 h-2 -translate-y-1/2 rounded-sm opacity-80"
            style={{ left: pct(s.start), width: pct(s.end - s.start), background: TRACK_STATUS[s.status].color }}
            title={`${TRACK_STATUS[s.status].label} ${formatRaceTime(s.start)} to ${formatRaceTime(s.end)}`} />
        ))}
        {lapTicks(meta.lap_starts).map(({ lap, t: lt }) => (
          <div key={lap} className="absolute top-1/2 h-3 w-px -translate-y-1/2 bg-line" style={{ left: pct(lt) }}
            title={`Lap ${lap}`} />
        ))}
        <div className="absolute left-0 top-1/2 h-1 -translate-y-1/2 rounded bg-f1" style={{ width: pct(shown) }} />
        <div className="absolute top-1/2 h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-ink shadow"
          style={{ left: pct(shown) }} />
      </div>
      <span className="w-16 font-mono text-xs tabular-nums text-faint">{formatRaceTime(duration)}</span>
    </div>
  );
}
