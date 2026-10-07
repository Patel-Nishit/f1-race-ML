"use client";

// The replay page. Desktop (>= 1024 px): the track is full-bleed and the UI
// floats over it (timing tower left, Insights right, controls at the bottom).
// Phone/tablet: a column, track on top, a Tower / Insights switch below and
// the controls pinned at the bottom.
import Link from "next/link";
import { MotionConfig } from "motion/react";
import { useEffect, useState, useSyncExternalStore } from "react";
import { api, ApiError } from "@/lib/api";
import { useReplayStore } from "@/lib/replayStore";
import type { RaceMeta } from "@/lib/types";
import { useUiStore } from "@/lib/uiStore";
import { ControlBar } from "./ControlBar";
import { INSIGHTS_WIDTH, InsightsMenu } from "./InsightsMenu";
import { Leaderboard } from "./Leaderboard";
import { Legend } from "./Legend";
import { StatusBanner } from "./StatusBanner";
import { ConnectionBanner, TopBar } from "./TopBar";
import { TrackCanvas } from "./TrackCanvas";
import { useKeyboardShortcuts } from "./useKeyboardShortcuts";

// Desktop layout (px): panels float this far from the edges
const EDGE = 16;
const HEADER = 64;
const DOCK = 112; // control dock height
const TOWER = 300;

function useIsDesktop() {
  return useSyncExternalStore(
    (onChange) => {
      const q = window.matchMedia("(min-width: 1024px)");
      q.addEventListener("change", onChange);
      return () => q.removeEventListener("change", onChange);
    },
    () => window.matchMedia("(min-width: 1024px)").matches,
    () => true,
  );
}

export function ReplayView({ year, round }: { year: number; round: number }) {
  const [meta, setMeta] = useState<RaceMeta | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<"tower" | "insights">("tower");
  const connect = useReplayStore((s) => s.connect);
  const disconnect = useReplayStore((s) => s.disconnect);
  const insightsOpen = useUiStore((s) => s.insightsOpen);
  const desktop = useIsDesktop();
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
    useUiStore.setState({ insightsOpen: true }); // the menu launches with every replay
    connect(year, round);
    return () => disconnect();
  }, [meta, year, round, connect, disconnect]);

  if (error) {
    return (
      <main id="main" className="mx-auto flex min-h-[100dvh] max-w-xl flex-col justify-center gap-4 px-6">
        <h1 className="pb-1 text-3xl font-bold italic leading-[1.1]">No replay here yet.</h1>
        <p className="text-dim">{error}</p>
        <Link href="/" className="pressable w-fit rounded-ui bg-f1 px-5 py-2 font-semibold text-white hover:bg-f1-hover">
          Back to races
        </Link>
      </main>
    );
  }
  if (!meta) return <ReplaySkeleton />;

  // On desktop, keep the track clear of the floating panels.
  const insets = desktop
    ? {
      left: EDGE + TOWER + 8,
      right: insightsOpen ? EDGE + INSIGHTS_WIDTH + 8 : EDGE + 160,
      top: HEADER + 40, // header + status banner
      bottom: DOCK + EDGE * 2,
    }
    : { top: 36 };

  return (
    // reducedMotion="user": skip row/banner animations if the OS asks for less motion
    <MotionConfig reducedMotion="user">
      <main id="main" className="relative flex h-[100dvh] flex-col overflow-hidden lg:block">
        <TopBar meta={meta} />

        {/* the track: its own box on phones, the whole stage on desktop */}
        <section aria-label="Track" className="relative h-[40dvh] shrink-0 lg:absolute lg:inset-0 lg:h-auto">
          <TrackCanvas meta={meta} insets={insets} />
          <div className="pointer-events-none absolute inset-x-0 top-1 lg:top-[68px]">
            <StatusBanner />
          </div>
          <ConnectionBanner />
        </section>

        {/* phone/tablet: switch between the tower and Insights */}
        <div role="tablist" aria-label="Panels" className="flex shrink-0 gap-1 border-b border-line px-3 lg:hidden">
          {(["tower", "insights"] as const).map((id) => (
            <button key={id} role="tab" aria-selected={tab === id} onClick={() => setTab(id)}
              className={`relative px-3 py-2.5 text-sm font-semibold ${tab === id ? "text-ink" : "text-dim"}`}>
              {id === "tower" ? "Timing tower" : "Insights"}
              {tab === id && <span aria-hidden="true" className="chip-slant absolute inset-x-2 bottom-0 h-0.5 bg-f1" />}
            </button>
          ))}
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto lg:contents">
          <Leaderboard drivers={meta.drivers}
            className={`${tab === "tower" ? "" : "hidden"} lg:glass lg:absolute lg:flex lg:left-4 lg:top-16 lg:bottom-[144px] lg:w-[300px]`} />
          <InsightsMenu meta={meta}
            className={`${tab === "insights" ? "" : "hidden"} p-3 lg:absolute lg:flex lg:right-4 lg:top-16 lg:bottom-[144px] lg:w-[336px] lg:overflow-y-auto lg:p-0`} />
        </div>

        <ControlBar meta={meta}
          className="shrink-0 border-t border-line bg-panel lg:glass lg:absolute lg:bottom-4 lg:left-4 lg:right-4 lg:border-t" />

        <Legend />
      </main>
    </MotionConfig>
  );
}

/** Loading state in the shape of the real layout (no spinner). */
function ReplaySkeleton() {
  return (
    <main id="main" aria-label="Loading race" className="relative h-[100dvh] overflow-hidden">
      <div className="flex h-16 items-center justify-between px-4">
        <div className="skeleton h-6 w-56" />
        <div className="skeleton h-7 w-40" />
        <div className="skeleton h-6 w-24" />
      </div>
      <div className="hidden lg:block">
        <div className="skeleton absolute bottom-[144px] left-4 top-16 w-[300px]" />
        <div className="skeleton absolute right-4 top-16 h-64 w-[336px]" />
        <div className="skeleton absolute bottom-4 left-4 right-4 h-[112px]" />
      </div>
      <div className="flex flex-col gap-3 p-3 lg:hidden">
        <div className="skeleton h-[40dvh]" />
        <div className="skeleton h-10" />
        <div className="skeleton h-64" />
      </div>
    </main>
  );
}
