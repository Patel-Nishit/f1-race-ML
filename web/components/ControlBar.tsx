"use client";

// The control dock: the race timeline on top, transport and speed below.
import { useRef, useState } from "react";
import {
  ArrowCounterClockwiseIcon, FastForwardIcon, MinusIcon, PauseIcon, PlayIcon, PlusIcon, RewindIcon,
  SkipBackIcon, SkipForwardIcon,
} from "@phosphor-icons/react";
import { formatRaceTime } from "@/lib/format";
import { useReplayStore } from "@/lib/replayStore";
import { SKIP_SECONDS } from "@/lib/shortcuts";
import { TRACK_STATUS } from "@/lib/status";
import { lapAt, lapTicks, neutralisedPeriods } from "@/lib/timeline";
import type { Command, RaceMeta } from "@/lib/types";

export function ControlBar({ meta, className = "" }: { meta: RaceMeta; className?: string }) {
  const send = useReplayStore((s) => s.send);
  const playing = useReplayStore((s) => s.buffer.latest?.playing ?? false);
  const speed = useReplayStore((s) => s.buffer.latest?.speed ?? 1);

  const button = (label: string, keys: string, command: Command, icon: React.ReactNode) => (
    <button
      onClick={() => send(command)}
      aria-label={label}
      title={`${label} (${keys})`}
      className="grid h-9 w-9 place-items-center rounded-ui text-ink hover:bg-panel-light"
    >
      {icon}
    </button>
  );

  return (
    <footer className={`px-4 pb-2.5 pt-2 ${className}`}>
      <Timeline meta={meta} />
      <div className="mt-1.5 flex items-center justify-center gap-1 sm:gap-2">
        {button("Restart", "R", { type: "restart" }, <ArrowCounterClockwiseIcon size={18} weight="bold" />)}
        {button("Previous lap", "Shift+Left", { type: "skip_laps", value: -1 }, <SkipBackIcon size={18} weight="fill" />)}
        {button(`Back ${SKIP_SECONDS} seconds`, "Left", { type: "skip", value: -SKIP_SECONDS }, <RewindIcon size={18} weight="fill" />)}
        <button
          onClick={() => send({ type: "toggle" })}
          aria-label={playing ? "Pause" : "Play"}
          title={`${playing ? "Pause" : "Play"} (Space)`}
          className="mx-1 grid h-11 w-11 place-items-center rounded-ui bg-f1 text-white hover:bg-f1-hover"
        >
          {playing ? <PauseIcon size={20} weight="fill" /> : <PlayIcon size={20} weight="fill" className="translate-x-px" />}
        </button>
        {button(`Forward ${SKIP_SECONDS} seconds`, "Right", { type: "skip", value: SKIP_SECONDS }, <FastForwardIcon size={18} weight="fill" />)}
        {button("Next lap", "Shift+Right", { type: "skip_laps", value: 1 }, <SkipForwardIcon size={18} weight="fill" />)}
        <span className="mx-1 h-6 w-px bg-line sm:mx-2" />
        <div className="flex items-center rounded-ui border border-line">
          {button("Slower", "Down", { type: "slower" }, <MinusIcon size={16} weight="bold" />)}
          <span className="w-11 text-center font-mono text-sm font-bold tabular-nums" aria-label="Playback speed">
            {speed}×
          </span>
          {button("Faster", "Up", { type: "faster" }, <PlusIcon size={16} weight="bold" />)}
        </div>
      </div>
    </footer>
  );
}

/**
 * The whole race as a bar. Click or drag to jump. While dragging we only
 * move the knob locally and send one seek when the pointer is released, so a
 * drag doesn't flood the server with dozens of seeks. Hovering shows the
 * time and lap you would jump to.
 */
function Timeline({ meta }: { meta: RaceMeta }) {
  const t = useReplayStore((s) => Math.round((s.buffer.latest?.t ?? 0) * 2) / 2);
  const send = useReplayStore((s) => s.send);
  const ref = useRef<HTMLDivElement>(null);
  const [dragT, setDragT] = useState<number | null>(null);
  const [hoverT, setHoverT] = useState<number | null>(null);
  const duration = meta.duration;
  const shown = dragT ?? t;
  const pct = (x: number) => `${(100 * x) / duration}%`;
  const preview = dragT ?? hoverT;

  const timeAt = (clientX: number) => {
    const box = ref.current!.getBoundingClientRect();
    return Math.min(1, Math.max(0, (clientX - box.left) / box.width)) * duration;
  };

  return (
    <div className="flex items-center gap-3">
      <span className="w-14 text-right font-mono text-xs tabular-nums text-dim">{formatRaceTime(shown)}</span>
      <div
        ref={ref}
        role="slider"
        aria-label="Race timeline"
        aria-valuemin={0}
        aria-valuemax={Math.round(duration)}
        aria-valuenow={Math.round(shown)}
        aria-valuetext={`${formatRaceTime(shown)}, lap ${lapAt(meta.lap_starts, shown)}`}
        tabIndex={-1}
        className="group relative h-5 flex-1 cursor-pointer touch-none"
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture(e.pointerId);
          setDragT(timeAt(e.clientX));
        }}
        onPointerMove={(e) => (dragT !== null ? setDragT : setHoverT)(timeAt(e.clientX))}
        onPointerLeave={() => setHoverT(null)}
        onPointerUp={(e) => {
          if (dragT === null) return;
          send({ type: "seek", t: timeAt(e.clientX) });
          setDragT(null);
        }}
      >
        <div className="absolute inset-x-0 top-1/2 h-2 -translate-y-1/2 rounded-[2px] bg-panel-light" />
        {neutralisedPeriods(meta.track_status_changes, duration).map((s) => (
          <div key={s.start} className="absolute top-1/2 h-2 -translate-y-1/2 opacity-90"
            style={{ left: pct(s.start), width: pct(s.end - s.start), background: TRACK_STATUS[s.status].color }}
            title={`${TRACK_STATUS[s.status].label} ${formatRaceTime(s.start)} to ${formatRaceTime(s.end)}`} />
        ))}
        {lapTicks(meta.lap_starts).map(({ lap, t: lt }) => (
          <div key={lap} className="absolute top-1/2 h-3.5 w-px -translate-y-1/2 bg-line" style={{ left: pct(lt) }} />
        ))}
        <div className="absolute left-0 top-1/2 h-2 -translate-y-1/2 rounded-l-[2px] bg-f1" style={{ width: pct(shown) }} />
        <div className="absolute top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-f1 bg-white shadow"
          style={{ left: pct(shown) }} />
        {preview !== null && (
          <div className="pointer-events-none absolute bottom-full mb-2 -translate-x-1/2 whitespace-nowrap rounded-ui border border-line bg-panel px-2 py-1 text-xs shadow"
            style={{ left: pct(preview) }}>
            <span className="font-mono tabular-nums">{formatRaceTime(preview)}</span>
            <span className="text-dim"> lap {lapAt(meta.lap_starts, preview)}</span>
          </div>
        )}
      </div>
      <span className="w-14 font-mono text-xs tabular-nums text-faint">{formatRaceTime(duration)}</span>
    </div>
  );
}
