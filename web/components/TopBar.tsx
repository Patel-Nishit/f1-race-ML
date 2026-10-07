"use client";

// Replay header: back link + race on the left, the broadcast-style "lap bug"
// in the centre, playback state, connection and shortcuts on the right.
import Link from "next/link";
import { ArrowLeftIcon, KeyboardIcon, WifiSlashIcon } from "@phosphor-icons/react";
import { formatRaceTime } from "@/lib/format";
import { useReplayStore } from "@/lib/replayStore";
import { TRACK_STATUS } from "@/lib/status";
import type { RaceMeta } from "@/lib/types";
import { useUiStore } from "@/lib/uiStore";

export function TopBar({ meta }: { meta: RaceMeta }) {
  const toggleLegend = useUiStore((s) => s.toggleLegend);
  const legendOpen = useUiStore((s) => s.legendOpen);
  return (
    <header className="relative z-20 flex h-16 shrink-0 items-center gap-3 px-3 lg:px-4">
      <div className="flex min-w-0 flex-1 items-center gap-2">
        <Link href="/" aria-label="Back to races"
          className="grid h-9 w-9 shrink-0 place-items-center rounded-ui text-dim hover:bg-panel-light hover:text-ink">
          <ArrowLeftIcon size={18} weight="bold" aria-hidden="true" />
        </Link>
        <div className="min-w-0 leading-tight">
          <h1 className="truncate font-bold">{meta.event_name} {meta.year}</h1>
          <p className="hidden truncate text-xs text-dim sm:block">{meta.country}, round {meta.round}</p>
        </div>
      </div>

      <LapBug totalLaps={meta.total_laps} />

      <div className="flex flex-1 items-center justify-end gap-3">
        <PausedFlag />
        <ConnectionBadge />
        <button onClick={toggleLegend} aria-expanded={legendOpen} title="Shortcuts (L)"
          className="hidden h-9 items-center gap-2 rounded-ui px-2.5 text-sm text-dim hover:bg-panel-light hover:text-ink sm:flex">
          <KeyboardIcon size={18} aria-hidden="true" /> Shortcuts
        </button>
      </div>
    </header>
  );
}

function LapBug({ totalLaps }: { totalLaps: number }) {
  // Subscribe to the lap and the whole second only: re-render once per
  // second, not on every frame.
  const lap = useReplayStore((s) => s.buffer.latest?.lap ?? 1);
  const seconds = useReplayStore((s) => Math.floor(s.buffer.latest?.t ?? 0));
  const status = useReplayStore((s) => s.buffer.latest?.status ?? 1);
  const info = TRACK_STATUS[status] ?? { label: String(status), color: "var(--ink-2)" };
  return (
    <div className="flex shrink-0 items-center gap-2">
      <div aria-label="Race progress" className="flex items-center gap-2.5">
        <span className="chip-slant bg-f1 px-2.5 py-1 font-mono text-sm font-bold text-white md:text-base">
          <span className="chip-slant-text tabular-nums">
            LAP {Math.min(lap, totalLaps)}<span className="opacity-75">/{totalLaps}</span>
          </span>
        </span>
        <span className="font-mono text-sm tabular-nums text-ink md:text-base">{formatRaceTime(seconds)}</span>
      </div>
      <span aria-label={`Track status: ${info.label}`}
        className="chip-slant hidden px-2 py-0.5 text-xs font-bold text-black sm:inline-block"
        style={{ background: info.color }}>
        <span className="chip-slant-text">{info.label}</span>
      </span>
    </div>
  );
}

function PausedFlag() {
  const playing = useReplayStore((s) => s.buffer.latest?.playing ?? true);
  if (playing) return null;
  return <span className="hidden text-xs font-semibold text-dim md:inline">Paused</span>;
}

function ConnectionBadge() {
  const connection = useReplayStore((s) => s.connection);
  const detail = useReplayStore((s) => s.connectionDetail);
  // the dot is real state (live / retrying / failed), not decoration
  const colour = connection === "open" ? "bg-ok" : connection === "failed" ? "bg-f1" : "bg-sc";
  const label = { open: "Live", connecting: "Connecting", reconnecting: "Reconnecting",
    closed: "Closed", failed: "Failed", idle: "Idle" }[connection];
  return (
    <span className="flex items-center gap-2 text-xs text-dim" title={detail} aria-live="polite">
      <span className={`h-2 w-2 rounded-full ${colour}`} />
      {label}
    </span>
  );
}

/** Over the track while the stream is down: say what's happening and when we retry. */
export function ConnectionBanner() {
  const connection = useReplayStore((s) => s.connection);
  const detail = useReplayStore((s) => s.connectionDetail);
  if (connection !== "reconnecting" && connection !== "failed") return null;
  return (
    <div className="pointer-events-none absolute inset-x-0 top-1/2 z-10 flex -translate-y-1/2 justify-center px-4">
      <p role="status" className="glass flex items-center gap-2.5 px-4 py-2.5 text-sm">
        <WifiSlashIcon size={18} className="text-f1-ink" aria-hidden="true" />
        {connection === "failed" ? "The replay stream is unavailable." : `Connection lost, ${detail || "retrying"}.`}
      </p>
    </div>
  );
}
