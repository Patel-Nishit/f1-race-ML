"use client";

// The replay page: loads race metadata over REST, opens the WebSocket,
// and shows the track. (Leaderboard, controls and the rest arrive in phase 6.)
import Link from "next/link";
import { useEffect, useState } from "react";
import { api, ApiError } from "@/lib/api";
import { formatRaceTime } from "@/lib/format";
import { useReplayStore } from "@/lib/replayStore";
import type { RaceMeta } from "@/lib/types";
import { TrackCanvas } from "./TrackCanvas";

export function ReplayView({ year, round }: { year: number; round: number }) {
  const [meta, setMeta] = useState<RaceMeta | null>(null);
  const [error, setError] = useState<string | null>(null);
  const connect = useReplayStore((s) => s.connect);
  const disconnect = useReplayStore((s) => s.disconnect);

  useEffect(() => {
    let cancelled = false;
    api.meta(year, round)
      .then((m) => !cancelled && setMeta(m))
      .catch((e: ApiError) => {
        if (cancelled) return;
        setError(e.status === 404
          ? `${year} round ${round} hasn't been prepared yet. Prepare it from the race list first.`
          : e.message);
      });
    return () => {
      cancelled = true;
    };
  }, [year, round]);

  // Open the stream once we know the race exists; close it when leaving.
  useEffect(() => {
    if (!meta) return;
    connect(year, round);
    return () => disconnect();
  }, [meta, year, round, connect, disconnect]);

  if (error) {
    return (
      <main className="flex flex-1 flex-col items-center justify-center gap-3 p-10 text-center">
        <p className="text-dim">{error}</p>
        <Link href="/" className="font-semibold underline">Back to races</Link>
      </main>
    );
  }
  if (!meta) return <main className="flex flex-1 items-center justify-center text-dim">Loading race…</main>;

  return (
    <main className="flex h-screen flex-col">
      <header className="flex items-center gap-6 border-b border-line/60 bg-panel px-5 py-3">
        <Link href="/" className="text-sm text-dim hover:text-ink">← Races</Link>
        <h1 className="border-l-4 border-f1 pl-3 text-lg font-bold uppercase">
          {meta.year} {meta.event_name}
        </h1>
        <ClockReadout totalLaps={meta.total_laps} />
        <div className="ml-auto flex items-center gap-4">
          <PlayPause />
          <ConnectionBadge />
        </div>
      </header>
      <div className="relative min-h-0 flex-1">
        <TrackCanvas meta={meta} />
      </div>
    </main>
  );
}

function ClockReadout({ totalLaps }: { totalLaps: number }) {
  // Subscribing to just these two numbers: this component re-renders when
  // the lap or the whole second changes, not on every frame.
  const lap = useReplayStore((s) => s.buffer.latest?.lap ?? 1);
  const seconds = useReplayStore((s) => Math.floor(s.buffer.latest?.t ?? 0));
  return (
    <p className="font-mono text-sm">
      <span className="font-bold">LAP {Math.min(lap, totalLaps)}/{totalLaps}</span>
      <span className="ml-3 text-dim">{formatRaceTime(seconds)}</span>
    </p>
  );
}

function PlayPause() {
  const playing = useReplayStore((s) => s.buffer.latest?.playing ?? false);
  const send = useReplayStore((s) => s.send);
  return (
    <button
      onClick={() => send({ type: "toggle" })}
      className="rounded bg-f1 px-4 py-1 text-sm font-bold text-white hover:bg-red-700"
      aria-label={playing ? "Pause" : "Play"}
    >
      {playing ? "Pause" : "Play"}
    </button>
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
