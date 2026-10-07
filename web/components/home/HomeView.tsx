"use client";

// The home page's live parts: hero (with a real mini replay), the races that
// are ready to watch, and the season calendar.
import Link from "next/link";
import { ArrowRightIcon, WarningCircleIcon } from "@phosphor-icons/react";
import { MotionConfig, motion, useReducedMotion } from "motion/react";
import { useEffect, useState } from "react";
import { api, ApiError } from "@/lib/api";
import { EASE_OUT, from } from "@/lib/motion";
import { useReplayStore } from "@/lib/replayStore";
import type { PreparedRace, RaceMeta } from "@/lib/types";
import { useUiStore } from "@/lib/uiStore";
import { TrackCanvas } from "../TrackCanvas";
import { SeasonCalendar } from "./SeasonCalendar";
import { TrackOutline } from "./TrackOutline";


interface ReadyRace extends PreparedRace {
  meta: RaceMeta;
}

function useReadyRaces() {
  const [races, setRaces] = useState<ReadyRace[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    api.races()
      .then((list) => Promise.all(list.map(async (r) => ({ ...r, meta: await api.meta(r.year, r.round) }))))
      .then((withMeta) => !cancelled && setRaces(withMeta.sort((a, b) => b.year - a.year || a.round - b.round)))
      .catch((e: ApiError) => !cancelled && (setError(e.message), setRaces([])));
    return () => {
      cancelled = true;
    };
  }, []);
  return { races, error };
}

/** Saudi Arabia 2024 when available (safety car, retirements), else the first ready race. */
function pickFeatured(races: ReadyRace[]) {
  return races.find((r) => r.year === 2024 && r.round === 2) ?? races[0];
}

export function HomeView() {
  const { races, error } = useReadyRaces();
  const featured = races && races.length ? pickFeatured(races) : null;

  return (
    <MotionConfig reducedMotion="user">
      <Hero featured={featured} loading={races === null} error={error} />
      <ReadyToWatch races={races} />
      <SeasonCalendar />
    </MotionConfig>
  );
}

function Hero({ featured, loading, error }: { featured: ReadyRace | null; loading: boolean; error: string | null }) {
  const reduce = useReducedMotion();
  const enter = (delay: number) => ({
    "data-enter": true,
    // full transform strings run on the compositor; Motion's y shorthand runs on
    // the main thread, which is busy here (canvas, socket, fetches) (plans/003)
    initial: { opacity: 0, transform: from("translateY(16px)", reduce) },
    animate: { opacity: 1, transform: from("translateY(0px)", reduce) },
    transition: { duration: 0.6, delay, ease: EASE_OUT },
  });
  return (
    <section className="mx-auto grid w-full max-w-[1400px] items-center gap-10 px-4 pb-16 pt-8 md:px-8 md:pt-16 lg:grid-cols-12">
      <div className="lg:col-span-5">
        <motion.h1 {...enter(0)}
          className="pb-1 text-5xl font-bold italic leading-[1.1] tracking-tight md:text-6xl xl:text-7xl">
          Every lap, replayed.
        </motion.h1>
        <motion.p {...enter(0.08)} className="mt-5 max-w-[46ch] text-lg leading-relaxed text-dim">
          Watch any Formula 1 race since 2018 unfold car by car, with positions, tyres, the safety car and telemetry.
        </motion.p>
        <motion.div {...enter(0.16)} className="mt-8 flex items-center gap-4">
          {featured ? (
            <Link href={`/replay/${featured.year}/${featured.round}`}
              className="pressable group inline-flex items-center gap-2 whitespace-nowrap rounded-ui bg-f1 px-6 py-3 font-semibold text-white hover:bg-f1-hover">
              Watch replay
              <ArrowRightIcon size={18} weight="bold" aria-hidden="true"
                className="transition-transform group-hover:translate-x-0.5" />
            </Link>
          ) : loading ? (
            <span className="skeleton block h-12 w-44" />
          ) : null}
        </motion.div>
      </div>

      <motion.div {...enter(0.12)} className="lg:col-span-7">
        {featured ? (
          <MiniReplay race={featured} />
        ) : loading ? (
          <div className="skeleton aspect-[16/10] w-full" />
        ) : (
          <div className="flex aspect-[16/10] w-full flex-col items-center justify-center gap-3 rounded-ui border border-dashed border-line p-8 text-center">
            <WarningCircleIcon size={28} className="text-dim" aria-hidden="true" />
            <p className="max-w-[40ch] text-dim">
              {error ?? "No races are prepared yet."} Prepare one from the calendar below.
            </p>
          </div>
        )}
      </motion.div>
    </section>
  );
}

/**
 * The hero visual is the product itself: the real track canvas, streaming a
 * real race at 4x. It starts 20 s before the race's first safety car or VSC,
 * read from the race's own flag history, so the first thing you see is the
 * field bunching up. Under reduced motion it shows a still frame.
 */
function MiniReplay({ race }: { race: ReadyRace }) {
  const reduce = useReducedMotion();
  const connect = useReplayStore((s) => s.connect);
  const disconnect = useReplayStore((s) => s.disconnect);
  const lap = useReplayStore((s) => s.buffer.latest?.lap);

  useEffect(() => {
    const firstNeutralised = race.meta.track_status_changes.find((c) => c.t > 60 && [4, 6].includes(c.status));
    useUiStore.getState().clearSelection();
    connect(race.year, race.round, { t: firstNeutralised ? firstNeutralised.t - 20 : 120, speed: 4, autoplay: !reduce });
    return () => disconnect();
  }, [race, reduce, connect, disconnect]);

  return (
    <figure>
      <div className="pointer-events-none relative aspect-[16/10] overflow-hidden rounded-ui border border-line bg-panel shadow-[var(--shadow)]">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_70%_20%,color-mix(in_srgb,var(--accent)_10%,transparent),transparent_60%)]" />
        <TrackCanvas meta={race.meta} />
      </div>
      <figcaption className="mt-3 text-sm text-dim">
        {race.event_name} {race.year}{lap ? `, lap ${Math.min(lap, race.total_laps)} of ${race.total_laps}` : ""}, replaying at 4x
      </figcaption>
    </figure>
  );
}

function ReadyToWatch({ races }: { races: ReadyRace[] | null }) {
  if (races && races.length === 0) return null;
  const bento = races && races.length >= 3;
  return (
    <section aria-labelledby="ready-heading" className="mx-auto w-full max-w-[1400px] px-4 pb-20 md:px-8">
      <h2 id="ready-heading" className="mb-6 text-3xl font-bold tracking-tight">Ready to watch</h2>
      {races === null ? (
        <div className="grid gap-4 md:grid-cols-3">
          {[0, 1, 2].map((i) => <div key={i} className="skeleton h-56" />)}
        </div>
      ) : (
        <div className={`grid gap-4 ${bento ? "md:grid-cols-3 md:grid-rows-2" : races.length === 2 ? "md:grid-cols-2" : ""}`}>
          {races.map((race, i) => (
            <RaceTile key={`${race.year}-${race.round}`} race={race} index={i}
              large={Boolean(bento) && i === 0} />
          ))}
        </div>
      )}
    </section>
  );
}

function RaceTile({ race, index, large }: { race: ReadyRace; index: number; large: boolean }) {
  const reduce = useReducedMotion();
  // a subtle tint that moves per tile, so the bento isn't a wall of identical cards
  const tint = ["at_85%_15%", "at_15%_85%", "at_80%_80%", "at_20%_20%"][index % 4];
  return (
    <motion.div
      data-enter
      initial={{ opacity: 0, transform: from("translateY(20px)", reduce) }}
      whileInView={{ opacity: 1, transform: from("translateY(0px)", reduce) }}
      viewport={{ once: true, amount: 0.15 }}
      transition={{ duration: 0.5, delay: index * 0.07, ease: EASE_OUT }}
      className={large ? "md:col-span-2 md:row-span-2" : ""}
    >
      <Link
        href={`/replay/${race.year}/${race.round}`}
        aria-label={`Watch replay: ${race.event_name} ${race.year}`}
        className="pressable-soft group relative flex h-full min-h-56 flex-col justify-between overflow-hidden rounded-ui border border-line bg-panel p-6 transition-[transform,border-color] duration-200 hover:-translate-y-0.5 hover:border-f1 motion-reduce:hover:translate-y-0"
        style={{ backgroundImage: `radial-gradient(circle ${tint.replace(/_/g, " ")}, color-mix(in srgb, var(--accent) ${large ? 11 : 6}%, transparent), transparent 55%)` }}
      >
        <TrackOutline track={race.meta.track} strokeWidth={large ? 3.5 : 3}
          className={`self-end transition-colors ${large ? "h-64 w-full max-w-[34rem] text-f1" : "h-28 w-40 text-faint group-hover:text-f1"}`} />
        <div>
          <h3 className={`font-bold ${large ? "pb-1 text-3xl italic leading-[1.1]" : "text-xl leading-tight"}`}>{race.event_name}</h3>
          <p className="mt-1 text-sm text-dim">
            {race.country}, round {race.round} · <span className="font-mono">{race.total_laps}</span> laps
          </p>
          <span className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-f1-ink">
            Watch replay <ArrowRightIcon size={16} weight="bold" aria-hidden="true"
              className="transition-transform group-hover:translate-x-0.5" />
          </span>
        </div>
      </Link>
    </motion.div>
  );
}
