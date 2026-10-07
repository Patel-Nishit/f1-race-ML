"use client";

// The replay page: loads race metadata over REST, opens the WebSocket, and
// lays out the HUD around the track.
import Link from "next/link";
import { MotionConfig } from "motion/react";
import { useEffect, useState } from "react";
import { api, ApiError } from "@/lib/api";
import { useReplayStore } from "@/lib/replayStore";
import type { RaceMeta } from "@/lib/types";
import { useUiStore } from "@/lib/uiStore";
import { ControlBar } from "./ControlBar";
import { Leaderboard } from "./Leaderboard";
import { Legend } from "./Legend";
import { StatusBanner } from "./StatusBanner";
import { TopBar } from "./TopBar";
import { TrackCanvas } from "./TrackCanvas";
import { useKeyboardShortcuts } from "./useKeyboardShortcuts";

export function ReplayView({ year, round }: { year: number; round: number }) {
  const [meta, setMeta] = useState<RaceMeta | null>(null);
  const [error, setError] = useState<string | null>(null);
  const connect = useReplayStore((s) => s.connect);
  const disconnect = useReplayStore((s) => s.disconnect);
  useKeyboardShortcuts();

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
    useUiStore.getState().clearSelection();
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
    // reducedMotion="user": skip row/banner animations if the OS asks for less motion
    <MotionConfig reducedMotion="user">
      <main className="grid h-screen grid-cols-[1fr_20rem] grid-rows-[auto_1fr_auto]
        [grid-template-areas:'top_top''track_side''bottom_side']">
        <TopBar meta={meta} />
        <section className="relative min-h-0 [grid-area:track]" aria-label="Track">
          <TrackCanvas meta={meta} />
          <StatusBanner />
          <Legend />
        </section>
        <Leaderboard drivers={meta.drivers} />
        <ControlBar meta={meta} />
      </main>
    </MotionConfig>
  );
}
