"use client";

// "My favourites": the site owner's driver and team (lib/favourites.ts).
// Two kinds of numbers, labelled apart: their live championship position
// (GET /api/standings, refreshed after every race) and stats from the races
// prepared on this server. Nothing is invented.
import Link from "next/link";
import { StarIcon } from "@phosphor-icons/react";
import { motion, useReducedMotion } from "motion/react";
import { useEffect, useState, type ReactNode } from "react";
import { api } from "@/lib/api";
import { FAVOURITE_DRIVER, FAVOURITE_TEAM, favouriteStandings, favouriteStats, isFavouriteTeam,
  type StandingSpot } from "@/lib/favourites";
import { EASE_OUT, from } from "@/lib/motion";
import type { ConstructorStanding, DriverStanding, RaceMeta, Standings } from "@/lib/types";
import { TeamThemeToggle } from "./TeamThemeToggle";

/** The live standings, fetched once per visit. undefined = loading, null = unavailable. */
function useStandings() {
  const [standings, setStandings] = useState<Standings | null | undefined>(undefined);
  useEffect(() => {
    let cancelled = false;
    api.standings()
      .then((s) => !cancelled && setStandings(s))
      .catch(() => !cancelled && setStandings(null));
    return () => {
      cancelled = true;
    };
  }, []);
  return standings;
}

export function FavouritesCard({ races }: { races: RaceMeta[] | null }) {
  const reduce = useReducedMotion();
  const standings = useStandings();
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
  const live = standings ? favouriteStandings(standings) : null;
  // the number he races with this season beats the one in older replays
  const number = live?.driver?.row.number ?? stats.number;

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
          {number && (
            <span aria-hidden="true"
              className="pointer-events-none absolute right-6 top-2 hidden select-none pr-4 sm:block text-[9rem] font-bold italic leading-none text-transparent md:right-10 md:text-[12rem]"
              style={{ WebkitTextStroke: `2px color-mix(in srgb, ${teamColour} 55%, transparent)` }}>
              {number}
            </span>
          )}
          <p className="flex items-center gap-1.5 text-sm font-semibold text-fav-ink">
            <StarIcon size={14} weight="fill" aria-hidden="true" /> Favourite driver
          </p>
          <h3 className="mt-2 pb-1 text-4xl font-bold italic leading-[1.1] md:text-5xl">{FAVOURITE_DRIVER.name}</h3>
          <p className="mt-1 flex items-center gap-2 text-dim">
            <span className="h-4 w-1 rounded-[1px]" style={{ background: teamColour }} />
            {FAVOURITE_TEAM.name}{number && <> · <span className="font-mono">#{number}</span></>}
          </p>

          <LiveStanding standings={standings} spot={live?.driver ?? null} kind="driver" />

          <SubHeading>In the replays here</SubHeading>
          {stats.races ? (
            <>
              <dl className="relative grid grid-cols-2 gap-x-6 gap-y-5 sm:grid-cols-4">
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

          <LiveStanding standings={standings} spot={live?.team ?? null} kind="team" />

          {stats.races ? (
            <>
            <SubHeading>In the replays here</SubHeading>
            <dl className="grid grid-cols-2 gap-5">
              <Stat label="Team podiums" value={stats.teamPodiums} detail="both cars" />
              {stats.teamBest && (
                <Stat label="Best result" value={`P${stats.teamBest.finish}`}
                  detail={`${stats.teamBest.code}, ${stats.teamBest.event_name.replace(" Grand Prix", "")}`} />
              )}
            </dl>
            </>
          ) : null}
          <p className="mt-auto pt-8 text-xs leading-relaxed text-faint">
            Championship: live from the Jolpica F1 API, updated after each race. Replay stats: counted from
            the {races.length} race{races.length === 1 ? "" : "s"} prepared on this server.
            In every replay, {FAVOURITE_DRIVER.first} has a yellow ring and a star.
          </p>
        </article>
      </div>
    </motion.section>
  );
}

function SubHeading({ children }: { children: ReactNode }) {
  return (
    <h4 className="relative mb-4 mt-8 border-t border-line pt-5 text-xs font-semibold uppercase tracking-wide text-faint">
      {children}
    </h4>
  );
}

/**
 * Live championship position: a big "P4", points and the gaps, and a mini
 * ladder (leader, the one ahead, the favourite, the one behind).
 */
function LiveStanding({ standings, spot, kind }: {
  standings: Standings | null | undefined;
  spot: StandingSpot<DriverStanding> | StandingSpot<ConstructorStanding> | null;
  kind: "driver" | "team";
}) {
  if (standings === undefined) return <div className="skeleton relative mt-8 h-32" aria-label="Loading the live standings" />;
  if (standings === null || !spot) {
    return (
      <p className="relative mt-8 text-sm text-dim">
        {standings === null ? "Live standings are unavailable right now."
          : standings.round === 0 ? `The ${standings.season} season hasn't started yet.`
          : `Not in the ${standings.season} championship.`}
      </p>
    );
  }
  const label = (r: DriverStanding | ConstructorStanding) => ("code" in r ? r.code : r.team);
  const isMe = (r: DriverStanding | ConstructorStanding) => r === spot.row;
  const updated = new Date(standings.fetched_at * 1000).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

  return (
    <div className="relative mt-8">
      <p className="mb-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs font-semibold uppercase tracking-wide text-faint">
        <span className={`h-2 w-2 rounded-full ${standings.stale ? "bg-sc" : "bg-ok"}`} aria-hidden="true" />
        {standings.season} {kind === "driver" ? "drivers'" : "constructors'"} championship
        <span className="font-normal normal-case tracking-normal">
          · after round {standings.round}{standings.stale && `, last updated ${updated}`}
        </span>
      </p>
      <div className={`grid items-center gap-x-8 gap-y-5 ${kind === "driver" ? "sm:grid-cols-[auto_1fr]" : ""}`}>
        <div>
          <p className="font-mono text-6xl font-bold leading-none tabular-nums">
            P{spot.row.position ?? "–"}
          </p>
          <p className="mt-2 text-sm">
            <span className="font-mono font-semibold tabular-nums">{fmtPoints(spot.row.points)}</span> pts ·{" "}
            <span className="font-mono tabular-nums">{spot.row.wins}</span> win{spot.row.wins === 1 ? "" : "s"}
          </p>
          <p className="mt-0.5 text-xs text-dim">
            {spot.behindNext === null ? "Leading the championship"
              : <>{fmtPoints(spot.behindLeader)} behind the leader{spot.ahead && spot.ahead !== spot.leader
                && <>, {fmtPoints(spot.behindNext)} behind P{spot.ahead.position}</>}</>}
          </p>
        </div>
        <ol aria-label={`${standings.season} ${kind === "driver" ? "driver" : "constructor"} standings around ${label(spot.row)}`}
          className="grid w-full max-w-sm gap-1 text-sm">
          {spot.ladder.map((r, i) => (
            <li key={label(r)}>
              {/* a gap in the ranking (leader, then P3...) gets a small break */}
              {i > 0 && r.position !== null && spot.ladder[i - 1].position !== null && r.position - spot.ladder[i - 1].position! > 1 && (
                <span className="block h-1.5" aria-hidden="true" />
              )}
              <span className={`grid grid-cols-[2.4rem_1fr_auto] items-center gap-2 rounded-ui px-2 py-1 ${
                isMe(r) ? "bg-panel-light font-semibold" : "text-dim"}`}>
                <span className="font-mono text-xs tabular-nums">P{r.position ?? "–"}</span>
                <span className="flex min-w-0 items-center gap-1.5 truncate">
                  {label(r)}
                  {isMe(r) && <StarIcon size={12} weight="fill" className="shrink-0 text-fav-ink" aria-label="favourite" role="img" />}
                </span>
                <span className="font-mono text-xs tabular-nums">{fmtPoints(r.points)}</span>
              </span>
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}

// half points exist (shortened races), so keep a decimal only when there is one
const fmtPoints = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1));

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
