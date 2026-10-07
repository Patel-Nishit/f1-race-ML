"use client";

import Link from "next/link";
import { formatRaceTime } from "@/lib/format";
import { useReplayStore } from "@/lib/replayStore";
import { TRACK_STATUS } from "@/lib/status";
import type { RaceMeta } from "@/lib/types";

export function TopBar({ meta }: { meta: RaceMeta }) {
  return (
    <header className="flex items-center gap-5 border-b border-line/60 bg-panel px-5 py-2.5 [grid-area:top]">
      <Link href="/" className="text-sm text-dim hover:text-ink">← Races</Link>
      <div className="border-l-4 border-f1 pl-3 leading-tight">
        <h1 className="font-bold uppercase">{meta.year} {meta.event_name}</h1>
        <p className="text-xs text-dim">{meta.country}</p>
      </div>
      <RaceClock totalLaps={meta.total_laps} />
      <div className="ml-auto flex items-center gap-4">
        <StatusPill />
        <PlaybackState />
        <ConnectionBadge />
      </div>
    </header>
  );
}

function RaceClock({ totalLaps }: { totalLaps: number }) {
  // Subscribe to the lap and the whole second only: re-render once per
  // second, not on every frame.
  const lap = useReplayStore((s) => s.buffer.latest?.lap ?? 1);
  const seconds = useReplayStore((s) => Math.floor(s.buffer.latest?.t ?? 0));
  return (
    <div className="ml-6 flex items-baseline gap-4 font-mono tabular-nums" aria-label="Race progress">
      <span className="text-xl font-bold">LAP {Math.min(lap, totalLaps)}<span className="text-dim">/{totalLaps}</span></span>
      <span className="text-xl text-dim">{formatRaceTime(seconds)}</span>
    </div>
  );
}

function StatusPill() {
  const status = useReplayStore((s) => s.buffer.latest?.status ?? 1);
  const info = TRACK_STATUS[status] ?? { label: String(status), color: "#969aaa" };
  return (
    <span className="rounded px-3 py-0.5 text-xs font-bold text-black" style={{ background: info.color }}
      aria-label={`Track status: ${info.label}`}>
      {info.label}
    </span>
  );
}

function PlaybackState() {
  const speed = useReplayStore((s) => s.buffer.latest?.speed ?? 1);
  const playing = useReplayStore((s) => s.buffer.latest?.playing ?? false);
  return (
    <span className="font-mono text-sm font-bold text-dim">
      {speed}×{!playing && <span className="ml-2">PAUSED</span>}
    </span>
  );
}

function ConnectionBadge() {
  const connection = useReplayStore((s) => s.connection);
  const detail = useReplayStore((s) => s.connectionDetail);
  const colour = connection === "open" ? "bg-ok" : connection === "failed" ? "bg-f1" : "bg-sc";
  const label = { open: "Live", connecting: "Connecting", reconnecting: "Reconnecting",
    closed: "Closed", failed: "Failed", idle: "Idle" }[connection];
  return (
    <span className="flex items-center gap-2 text-xs text-dim" title={detail} aria-live="polite">
      <span className={`h-2 w-2 rounded-full ${colour}`} />
      {label}
      {detail && connection !== "open" ? ` · ${detail}` : ""}
    </span>
  );
}
