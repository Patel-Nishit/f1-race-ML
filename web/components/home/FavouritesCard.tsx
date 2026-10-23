"use client";

// "My favourites": the site owner's driver and team (lib/favourites.ts),
// with stats computed from the races prepared on this server. Nothing is
// invented: every number comes from the race metadata the API already sends.
import Link from "next/link";
import { StarIcon } from "@phosphor-icons/react";
import { motion, useReducedMotion } from "motion/react";
import { FAVOURITE_DRIVER, FAVOURITE_TEAM, favouriteStats, isFavouriteTeam } from "@/lib/favourites";
import { EASE_OUT, from } from "@/lib/motion";
import type { RaceMeta } from "@/lib/types";
import { TeamThemeToggle } from "./TeamThemeToggle";

export function FavouritesCard({ races }: { races: RaceMeta[] | null }) {
  const reduce = useReducedMotion();
  if (races === null) {
    return (
      <section className="mx-auto w-full max-w-[1400px] px-4 pb-20 md:px-8">
        <div className="skeleton h-72" />
      </section>
    );
  }
  const stats = favouriteStats(races);
  // the team colour from the data (FastF1's), falling back to Red Bull blue
  const teamColour = races.flatMap((r) => r.drivers).find((d) => isFavouriteTeam(d.team))?.color ?? "#3671c6";
  const pct = (n: number) => (stats.races ? Math.round((n / stats.races) * 100) : 0);

  return (
    <motion.section
      aria-labelledby="favourites-heading"
      data-enter
      initial={{ opacity: 0, transform: from("translateY(20px)", reduce) }}
      whileInView={{ opacity: 1, transform: from("translateY(0px)", reduce) }}
      viewport={{ once: true, amount: 0.2 }}
      transition={{ duration: 0.5, ease: EASE_OUT }}
      className="mx-auto w-full max-w-[1400px] px-4 pb-20 md:px-8"
    >
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <h2 id="favourites-heading" className="text-3xl font-bold tracking-tight">My favourites</h2>
        <TeamThemeToggle label={`Wear the ${FAVOURITE_TEAM.short} colours`} className="-mr-2" />
      </div>

      <div className="grid gap-4 lg:grid-cols-12">
        {/* the driver */}
        <article
          className="relative overflow-hidden rounded-ui border border-line bg-panel p-6 md:p-8 lg:col-span-8"
          style={{ backgroundImage: `radial-gradient(circle at 90% 10%, color-mix(in srgb, ${teamColour} 22%, transparent), transparent 60%)` }}
        >
          {/* the car number, huge and outlined, like a livery */}
          {stats.number && (
            <span aria-hidden="true"
              className="pointer-events-none absolute right-6 top-2 hidden select-none pr-4 sm:block text-[9rem] font-bold italic leading-none text-transparent md:right-10 md:text-[12rem]"
              style={{ WebkitTextStroke: `2px color-mix(in srgb, ${teamColour} 55%, transparent)` }}>
              {stats.number}
            </span>
          )}
          <p className="flex items-center gap-1.5 text-sm font-semibold text-fav-ink">
            <StarIcon size={14} weight="fill" aria-hidden="true" /> Favourite driver
          </p>
          <h3 className="mt-2 pb-1 text-4xl font-bold italic leading-[1.1] md:text-5xl">{FAVOURITE_DRIVER.name}</h3>
          <p className="mt-1 flex items-center gap-2 text-dim">
            <span className="h-4 w-1 rounded-[1px]" style={{ background: teamColour }} />
            {FAVOURITE_TEAM.name}{stats.number && <> · <span className="font-mono">#{stats.number}</span></>}
          </p>

          {stats.races ? (
            <>
              <dl className="relative mt-8 grid grid-cols-2 gap-x-6 gap-y-5 sm:grid-cols-4">
                <Stat label="Wins" value={stats.wins} detail={`${pct(stats.wins)}% of races`} />
                <Stat label="Podiums" value={stats.podiums} detail={`${pct(stats.podiums)}% of races`} />
                <Stat label="Best finish" value={stats.bestFinish ? `P${stats.bestFinish}` : "–"} />
                <Stat label="Places gained" value={signed(stats.placesGained)} detail="grid to flag" />
              </dl>
              <div className="relative mt-8">
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-faint">
                  His races here ({stats.races})
                </p>
                <ul className="flex flex-wrap gap-2">
                  {stats.results.map((r) => (
                    <li key={`${r.year}-${r.round}`}>
                      <Link href={`/replay/${r.year}/${r.round}`}
                        title={`Watch ${r.event_name} ${r.year}: started ${r.grid ? `P${r.grid}` : "from the pit lane"}, ${
                          r.finished ? `finished P${r.finish}` : "did not finish"}`}
                        className="pressable flex items-center gap-2 rounded-ui border border-line bg-panel-light px-2.5 py-1.5 text-sm hover:border-f1">
                        <span className={`chip-slant px-1.5 font-mono text-xs font-bold ${
                          !r.finished ? "bg-line text-dim" : r.finish === 1 ? "bg-f1 text-white" : r.finish <= 3 ? "bg-fav text-black" : "bg-line"}`}>
                          <span className="chip-slant-text">{r.finished ? `P${r.finish}` : "DNF"}</span>
                        </span>
                        {r.event_name.replace(" Grand Prix", "")} <span className="text-faint">{r.year}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            </>
          ) : (
            <p className="relative mt-8 max-w-[44ch] text-dim">
              None of the prepared races include {FAVOURITE_DRIVER.first} yet. Prepare one from the calendar below to see his stats.
            </p>
          )}
        </article>

        {/* the team */}
        <article className="relative flex flex-col overflow-hidden rounded-ui border border-line bg-panel p-6 md:p-8 lg:col-span-4">
          {/* livery stripes: team blue, Red Bull red, yellow */}
          <div aria-hidden="true" className="absolute inset-x-0 top-0 flex h-1.5">
            <span className="flex-[3]" style={{ background: teamColour }} />
            <span className="flex-1 bg-f1" />
            <span className="flex-1 bg-fav" />
          </div>
          <p className="text-sm font-semibold text-dim">Favourite team</p>
          <h3 className="mt-2 pb-1 text-3xl font-bold italic leading-[1.1]">{FAVOURITE_TEAM.name}</h3>
          {stats.races ? (
            <dl className="mt-8 grid gap-5">
              <Stat label="Team podiums" value={stats.teamPodiums} detail="both cars" />
              {stats.teamBest && (
                <Stat label="Best result" value={`P${stats.teamBest.finish}`}
                  detail={`${stats.teamBest.code}, ${stats.teamBest.event_name.replace(" Grand Prix", "")}`} />
              )}
            </dl>
          ) : null}
          <p className="mt-auto pt-8 text-xs leading-relaxed text-faint">
            Counted from the {races.length} race{races.length === 1 ? "" : "s"} prepared on this server, not whole seasons.
            In every replay, {FAVOURITE_DRIVER.first} has a yellow ring and a star.
          </p>
        </article>
      </div>
    </motion.section>
  );
}

function Stat({ label, value, detail }: { label: string; value: string | number; detail?: string }) {
  return (
    <div>
      <dt className="text-xs font-semibold uppercase tracking-wide text-faint">{label}</dt>
      <dd className="mt-1 font-mono text-3xl font-bold tabular-nums">{value}</dd>
      {detail && <dd className="text-xs text-dim">{detail}</dd>}
    </div>
  );
}

const signed = (n: number) => (n > 0 ? `+${n}` : String(n));
