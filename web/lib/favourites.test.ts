import { describe, expect, it } from "vitest";
import { favouriteStandings, favouriteStats } from "./favourites";
import type { DriverMeta, RaceMeta } from "./types";

const driver = (code: string, team: string, grid: number, final_position: number, status = "Finished"): DriverMeta =>
  ({ code, number: code === "VER" ? "1" : "11", name: code, team, color: "#3671c6", grid, status, final_position });

const race = (round: number, drivers: DriverMeta[]) =>
  ({ year: 2024, round, event_name: `Race ${round} Grand Prix`, drivers }) as RaceMeta;

describe("favouriteStats", () => {
  // the real 2024 results of the demo races: Bahrain, Saudi Arabia, Australia
  const races = [
    race(1, [driver("VER", "Red Bull Racing", 1, 1), driver("PER", "Red Bull Racing", 5, 2)]),
    race(2, [driver("VER", "Red Bull Racing", 1, 1), driver("PER", "Red Bull Racing", 3, 2)]),
    race(3, [driver("VER", "Red Bull Racing", 1, 19, "Retired"), driver("PER", "Red Bull Racing", 6, 5),
      driver("SAI", "Ferrari", 2, 1)]),
  ];

  it("counts wins and podiums, and a retirement is not a finish", () => {
    const s = favouriteStats(races);
    expect(s).toMatchObject({ races: 3, wins: 2, podiums: 2, bestFinish: 1, number: "1" });
    expect(s.results.map((r) => [r.round, r.finished])).toEqual([[3, false], [2, true], [1, true]]); // newest first
  });

  it("sums the team over both cars, ignoring other teams", () => {
    const s = favouriteStats(races);
    expect(s.teamPodiums).toBe(4);
    expect(s.teamBest).toMatchObject({ finish: 1, code: "VER" });
  });

  it("counts places gained only for finished races, pit-lane start as last", () => {
    const s = favouriteStats([race(1, [driver("VER", "Red Bull Racing", 0, 6), driver("X", "Red Bull Racing", 4, 2)])]);
    expect(s.placesGained).toBe(14); // 20 -> 6
  });

  it("copes with no races", () => {
    expect(favouriteStats([])).toMatchObject({ races: 0, wins: 0, bestFinish: null, teamBest: null });
  });
});

describe("favouriteStandings", () => {
  const d = (position: number, code: string, points: number) =>
    ({ position, code, name: code, number: null, team: "", team_id: "", points, wins: 0 });
  const c = (position: number, team_id: string, points: number) => ({ position, team: team_id, team_id, points, wins: 0 });
  const standings = (drivers: ReturnType<typeof d>[], constructors: ReturnType<typeof c>[] = []) =>
    ({ season: 2026, round: 17, drivers, constructors, fetched_at: 0, stale: false });

  it("finds the favourite with the leader and neighbours, and the gaps", () => {
    const s = favouriteStandings(standings(
      [d(1, "ANT", 340), d(2, "RUS", 238), d(3, "LEC", 230), d(4, "VER", 221), d(5, "NOR", 200), d(6, "HAM", 150)],
      [c(1, "mercedes", 578), c(4, "red_bull", 332)]));
    expect(s.driver!.ladder.map((r) => r.code)).toEqual(["ANT", "LEC", "VER", "NOR"]);
    expect(s.driver).toMatchObject({ behindLeader: 119, behindNext: 9 });
    expect(s.team).toMatchObject({ behindLeader: 246, behindNext: 246 });
  });

  it("leader: no gap ahead and no repeated rows", () => {
    const s = favouriteStandings(standings([d(1, "VER", 400), d(2, "NOR", 300)]));
    expect(s.driver!.ladder.map((r) => r.code)).toEqual(["VER", "NOR"]);
    expect(s.driver).toMatchObject({ behindLeader: 0, behindNext: null });
  });

  it("not in the table (or a season with no races yet) gives null", () => {
    expect(favouriteStandings(standings([d(1, "NOR", 10)]))).toEqual({ driver: null, team: null });
  });
});
