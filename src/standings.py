"""Live championship standings for the current season.

The replays come from FastF1 timing data, but standings are a different
question ("who leads the championship today?"), answered by the Jolpica API:
the community successor of the Ergast API, and the same server FastF1's own
`fastf1.ergast` module talks to. It updates a few hours after each race.

We fetch both tables (drivers and constructors), reshape them into small
dicts, and cache the result for CACHE_SECONDS so the site doesn't call
Jolpica on every page view (it is rate limited: about 4 requests a second).
If Jolpica is down, we keep serving the last good copy, marked stale.
"""

import json
import threading
import time
import urllib.request

BASE_URL = "https://api.jolpi.ca/ergast/f1"
CACHE_SECONDS = 30 * 60
TIMEOUT_SECONDS = 10
RETRY_SECONDS = 60  # after a failed fetch, wait this long before trying again


def _fetch_json(url: str) -> dict:
    request = urllib.request.Request(url, headers={"User-Agent": "f1-race-replay"})
    with urllib.request.urlopen(request, timeout=TIMEOUT_SECONDS) as response:
        return json.load(response)


def _position(row: dict) -> int | None:
    # "position" is missing for drivers who aren't classified (rare, e.g. a
    # disqualification for the whole season); positionText is then "-"
    value = row.get("position") or row.get("positionText")
    return int(value) if value and value.isdigit() else None


def parse_standings(drivers_json: dict, constructors_json: dict) -> dict:
    """Ergast-format JSON (both tables) -> one compact dict."""
    driver_table = drivers_json["MRData"]["StandingsTable"]
    team_table = constructors_json["MRData"]["StandingsTable"]
    driver_lists = driver_table["StandingsLists"]
    team_lists = team_table["StandingsLists"]
    if not driver_lists or not team_lists:
        # a new season before its first race: no standings yet
        return {"season": int(driver_table["season"]), "round": 0, "drivers": [], "constructors": []}

    drivers = []
    for row in driver_lists[0]["DriverStandings"]:
        d = row["Driver"]
        # a driver who changed teams mid-season lists every team; the last is current
        team = row["Constructors"][-1] if row["Constructors"] else {"constructorId": "", "name": ""}
        drivers.append({
            "position": _position(row),
            "code": d.get("code") or d["familyName"][:3].upper(),
            "name": f'{d["givenName"]} {d["familyName"]}',
            "number": d.get("permanentNumber"),
            "team": team["name"],
            "team_id": team["constructorId"],
            "points": float(row["points"]),
            "wins": int(row["wins"]),
        })

    constructors = [{
        "position": _position(row),
        "team": row["Constructor"]["name"],
        "team_id": row["Constructor"]["constructorId"],
        "points": float(row["points"]),
        "wins": int(row["wins"]),
    } for row in team_lists[0]["ConstructorStandings"]]

    return {
        "season": int(driver_lists[0]["season"]),
        "round": int(driver_lists[0]["round"]),
        "drivers": drivers,
        "constructors": constructors,
    }


class StandingsCache:
    """Fetch at most once per CACHE_SECONDS; fall back to the last good copy."""

    def __init__(self, fetch=_fetch_json, ttl: float = CACHE_SECONDS, clock=time.time):
        self._fetch = fetch
        self._ttl = ttl
        self._clock = clock
        self._lock = threading.Lock()  # two page views at once -> one fetch
        self._value: dict | None = None
        self._fetched_at = 0.0
        self._retry_at = 0.0

    def get(self) -> dict:
        with self._lock:
            now = self._clock()
            if self._value is not None and now - self._fetched_at < self._ttl:
                return {**self._value, "fetched_at": self._fetched_at, "stale": False}
            if self._value is not None and now < self._retry_at:
                return {**self._value, "fetched_at": self._fetched_at, "stale": True}
            try:
                value = parse_standings(
                    self._fetch(f"{BASE_URL}/current/driverStandings.json?limit=100"),
                    self._fetch(f"{BASE_URL}/current/constructorStandings.json?limit=100"),
                )
            except Exception:
                self._retry_at = now + RETRY_SECONDS
                if self._value is None:
                    raise  # nothing to fall back on
                return {**self._value, "fetched_at": self._fetched_at, "stale": True}
            self._value, self._fetched_at = value, now
            return {**value, "fetched_at": now, "stale": False}
