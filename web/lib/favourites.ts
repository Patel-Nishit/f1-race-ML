// The site owner's favourites: one driver and one team, spotlighted in every
// replay and summed up on the home page. Change these two lines to make the
// site yours. The team name must match the race data exactly (FastF1's
// "TeamName", e.g. "Red Bull Racing", "Ferrari", "McLaren"). The live
// standings use a different source with its own team ids ("red_bull",
// "ferrari", "mclaren"): that's `standingsId`.
import type { ConstructorStanding, DriverMeta, DriverStanding, RaceMeta, Standings } from "./types";

export const FAVOURITE_DRIVER = { code: "VER", name: "Max Verstappen", first: "Max" };
export const FAVOURITE_TEAM = { name: "Red Bull Racing", short: "Red Bull", standingsId: "red_bull" };

export const isFavouriteDriver = (code: string) => code === FAVOURITE_DRIVER.code;
export const isFavouriteTeam = (team: string | undefined) => team === FAVOURITE_TEAM.name;

export interface DriverResult {
  year: number;
  round: number;
  event_name: string;
  grid: number;
  finish: number;
  finished: boolean; // false for retirements (DNF / DSQ)
}

export interface FavouriteStats {
  races: number;
  wins: number;
  podiums: number;
  bestFinish: number | null;
  placesGained: number; // grid minus finish, summed over finished races
  number: string | null; // car number in the most recent race
  results: DriverResult[]; // newest first
  teamPodiums: number; // podiums by either team car
  teamBest: { finish: number; code: string; event_name: string } | null;
}

/**
 * Sum up the favourite driver and team over the races that are prepared.
 * Only what the race metadata really holds: grid, final position, status.
 */
export function favouriteStats(races: RaceMeta[]): FavouriteStats {
  const sorted = [...races].sort((a, b) => b.year - a.year || b.round - a.round);
  const results: DriverResult[] = [];
  let number: string | null = null;
  let teamPodiums = 0;
  let teamBest: FavouriteStats["teamBest"] = null;

  for (const race of sorted) {
    const me = race.drivers.find((d) => isFavouriteDriver(d.code));
    if (me) {
      number ??= me.number;
      results.push({
        year: race.year, round: race.round, event_name: race.event_name,
        grid: me.grid, finish: me.final_position, finished: finished(me),
      });
    }
    for (const d of race.drivers.filter((d) => isFavouriteTeam(d.team) && finished(d))) {
      if (d.final_position <= 3) teamPodiums++;
      if (!teamBest || d.final_position < teamBest.finish)
        teamBest = { finish: d.final_position, code: d.code, event_name: race.event_name };
    }
  }

  const done = results.filter((r) => r.finished);
  return {
    races: results.length,
    wins: done.filter((r) => r.finish === 1).length,
    podiums: done.filter((r) => r.finish <= 3).length,
    bestFinish: done.length ? Math.min(...done.map((r) => r.finish)) : null,
    // a pit-lane start is grid 0 in the data; count it as starting last
    placesGained: done.reduce((sum, r) => sum + ((r.grid || 20) - r.finish), 0),
    number,
    results,
    teamPodiums,
    teamBest,
  };
}

/** "Finished" or "+1 Lap" both count as a classified finish. */
function finished(d: DriverMeta) {
  return d.final_position > 0 && (d.status === "Finished" || d.status.startsWith("+") || d.status === "Lapped");
}

/** One favourite's place in a championship table, with the rows around it. */
export interface StandingSpot<Row> {
  row: Row;
  leader: Row;
  ladder: Row[]; // leader, the one ahead, the favourite, the one behind (no repeats)
  ahead: Row | null; // the one directly ahead (null for the leader)
  behindLeader: number; // points
  behindNext: number | null; // points to the one ahead (null for the leader)
}

function spot<Row extends { points: number }>(rows: Row[], isFavourite: (r: Row) => boolean): StandingSpot<Row> | null {
  const i = rows.findIndex(isFavourite);
  if (i < 0) return null;
  const picks = [...new Set([0, i - 1, i, i + 1])].filter((j) => j >= 0 && j < rows.length).sort((a, b) => a - b);
  return {
    row: rows[i],
    leader: rows[0],
    ladder: picks.map((j) => rows[j]),
    ahead: i > 0 ? rows[i - 1] : null,
    behindLeader: rows[0].points - rows[i].points,
    behindNext: i > 0 ? rows[i - 1].points - rows[i].points : null,
  };
}

/** Where the favourite driver and team stand in the live championship. */
export function favouriteStandings(s: Standings): {
  driver: StandingSpot<DriverStanding> | null;
  team: StandingSpot<ConstructorStanding> | null;
} {
  return {
    driver: spot(s.drivers, (d) => isFavouriteDriver(d.code)),
    team: spot(s.constructors, (c) => c.team_id === FAVOURITE_TEAM.standingsId),
  };
}
