"""Live standings: parsing Jolpica's JSON and the cache (no network: fake fetches)."""

import pytest
from fastapi.testclient import TestClient

from src.standings import StandingsCache, parse_standings


def driver_row(pos, code, family, team_id, team, points, wins, constructors=None):
    return {"position": str(pos), "positionText": str(pos), "points": str(points), "wins": str(wins),
            "Driver": {"code": code, "givenName": "X", "familyName": family, "permanentNumber": "3"},
            "Constructors": constructors or [{"constructorId": team_id, "name": team}]}


def tables(season="2026", round_="17", drivers=None, teams=None):
    d = {"MRData": {"StandingsTable": {"season": season, "StandingsLists": [] if drivers is None else [
        {"season": season, "round": round_, "DriverStandings": drivers}]}}}
    c = {"MRData": {"StandingsTable": {"season": season, "StandingsLists": [] if teams is None else [
        {"season": season, "round": round_, "ConstructorStandings": teams}]}}}
    return d, c


DRIVERS = [
    driver_row(1, "ANT", "Antonelli", "mercedes", "Mercedes", 340, 8),
    # changed teams mid-season: the last constructor listed is the current one
    driver_row(4, "VER", "Verstappen", "red_bull", "Red Bull", 221, 2,
               constructors=[{"constructorId": "rb", "name": "RB"}, {"constructorId": "red_bull", "name": "Red Bull"}]),
]
TEAMS = [{"position": "4", "points": "332", "wins": "2",
          "Constructor": {"constructorId": "red_bull", "name": "Red Bull"}}]


def test_parse_standings():
    s = parse_standings(*tables(drivers=DRIVERS, teams=TEAMS))
    assert (s["season"], s["round"]) == (2026, 17)
    assert s["drivers"][1] == {"position": 4, "code": "VER", "name": "X Verstappen", "number": "3",
                               "team": "Red Bull", "team_id": "red_bull", "points": 221.0, "wins": 2}
    assert s["constructors"][0]["team_id"] == "red_bull" and s["constructors"][0]["points"] == 332.0


def test_new_season_before_first_race_is_empty():
    s = parse_standings(*tables(season="2027"))
    assert s == {"season": 2027, "round": 0, "drivers": [], "constructors": []}


class FakeSource:
    def __init__(self):
        self.calls = 0
        self.fail = False

    def __call__(self, url):
        self.calls += 1
        if self.fail:
            raise OSError("Jolpica is down")
        d, c = tables(drivers=DRIVERS, teams=TEAMS)
        return d if "driverStandings" in url else c


def test_cache_fetches_once_per_ttl_and_serves_stale_on_failure():
    now = [1000.0]
    source = FakeSource()
    cache = StandingsCache(fetch=source, ttl=60, clock=lambda: now[0])
    assert cache.get()["stale"] is False
    cache.get()
    assert source.calls == 2  # one fetch per table, then from the cache

    now[0] += 61
    source.fail = True
    stale = cache.get()  # expired and the source is down: last good copy, marked stale
    assert stale["stale"] is True and stale["round"] == 17
    calls = source.calls
    cache.get()  # within the retry wait: no new attempt
    assert source.calls == calls


def test_cache_raises_when_nothing_to_fall_back_on():
    source = FakeSource()
    source.fail = True
    with pytest.raises(OSError):
        StandingsCache(fetch=source).get()


def test_standings_endpoint(data_dir, monkeypatch):
    import backend.app
    source = FakeSource()
    monkeypatch.setattr(backend.app, "standings_cache", StandingsCache(fetch=source))
    client = TestClient(backend.app.app)
    body = client.get("/api/standings").json()
    assert body["season"] == 2026 and body["drivers"][1]["code"] == "VER"

    source.fail = True
    monkeypatch.setattr(backend.app, "standings_cache", StandingsCache(fetch=source))
    assert client.get("/api/standings").status_code == 502
