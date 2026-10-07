"""FastAPI application: REST endpoints + the replay WebSocket.

Run it with:  python main.py serve      (then open http://localhost:8000/docs)
"""

import json
import os
from functools import lru_cache
from typing import Literal

import numpy as np
from fastapi import FastAPI, HTTPException, Path, Query, WebSocket
from fastapi.middleware.cors import CORSMiddleware
from starlette.concurrency import run_in_threadpool

from backend.jobs import PrepareJobs
from backend.replay import DRIVER_FIELDS
from backend.ws import replay_socket
from src.race_store import is_prepared, list_prepared, load_race_cached, race_paths
from src.snapshot import lap_start_times
from src.strategy import race_stints

app = FastAPI(
    title="F1 Race Replay API",
    description="Prepared F1 races over REST, and replays streamed over WebSocket.",
    version="0.1.0",
)

# The Next.js dev server runs on another origin (port 3000), so the browser
# needs explicit permission (CORS) to call this API. In production, set
# F1_CORS_ORIGINS to your site (https://your-app.vercel.app) and optionally
# F1_CORS_ORIGIN_REGEX for preview deployments (https://.*\.vercel\.app).
app.add_middleware(
    CORSMiddleware,
    allow_origins=os.environ.get("F1_CORS_ORIGINS", "http://localhost:3000").split(","),
    allow_origin_regex=os.environ.get("F1_CORS_ORIGIN_REGEX") or None,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Preparing a race costs minutes of CPU and hundreds of MB of downloads. On a
# public deployment, anyone could trigger that, so it can be switched off
# (F1_ALLOW_PREPARE=false) and the server only replays races shipped with it.
ALLOW_PREPARE = os.environ.get("F1_ALLOW_PREPARE", "true").lower() not in ("0", "false", "no")

jobs = PrepareJobs()

Year = Path(ge=2018, le=2100, description="Season, 2018 onwards")
Round = Path(ge=1, le=30, description="Round number in the season")
Session = Query("R", description="R = race, S = sprint")
SessionType = Literal["R", "S"]


def _require_prepared(year, round_number, session):
    if not is_prepared(year, round_number, session):
        raise HTTPException(404, f"{year} round {round_number} ({session}) is not prepared yet. "
                                 f"POST /api/races/{year}/{round_number}/prepare first.")


def _read_meta(year, round_number, session) -> dict:
    _, meta_path = race_paths(year, round_number, session)
    return json.loads(meta_path.read_text())


@app.get("/api/health")
def health():
    return {"status": "ok", "prepare_enabled": ALLOW_PREPARE}


@app.get("/api/races")
def prepared_races():
    """Races that are ready to replay."""
    races = []
    for year, round_number, session in list_prepared():
        meta = _read_meta(year, round_number, session)
        races.append({
            "year": year, "round": round_number, "session": session,
            "event_name": meta["event_name"], "country": meta["country"],
            "total_laps": meta["total_laps"], "duration": meta["duration"],
        })
    return races


@lru_cache(maxsize=16)
def _schedule(year: int) -> list:
    from src.f1_data import get_race_weekends_by_year
    return get_race_weekends_by_year(year)


@app.get("/api/seasons/{year}/events")
async def season_events(year: int = Year):
    """The season calendar, with each race's preparation status."""
    try:
        # FastF1 may hit the network: run it in a thread, not on the event loop
        weekends = await run_in_threadpool(_schedule, year)
    except Exception as e:
        raise HTTPException(502, f"Could not load the {year} schedule from FastF1: {e}")
    return [{**w, "round_number": int(w["round_number"]),
             "status": jobs.status(year, int(w["round_number"]))["state"]}
            for w in weekends]


@app.get("/api/races/{year}/{round_number}/status")
def race_status(year: int = Year, round_number: int = Round, session: SessionType = Session):
    return jobs.status(year, round_number, session)


@app.post("/api/races/{year}/{round_number}/prepare", status_code=202)
def prepare(year: int = Year, round_number: int = Round, session: SessionType = Session):
    """Start preparing a race in the background. Poll /status for progress."""
    if not ALLOW_PREPARE:
        raise HTTPException(403, "Preparing new races is disabled on this server.")
    return jobs.start(year, round_number, session)


@app.get("/api/races/{year}/{round_number}/meta")
async def race_meta(year: int = Year, round_number: int = Round, session: SessionType = Session):
    """Everything that doesn't change during the race: drivers, track, laps."""
    _require_prepared(year, round_number, session)
    race = await run_in_threadpool(load_race_cached, year, round_number, session)
    return {**race.meta, "lap_starts": [round(t, 2) for t in lap_start_times(race)],
            "driver_fields": DRIVER_FIELDS}


@app.get("/api/races/{year}/{round_number}/telemetry/{code}")
async def driver_telemetry(
    code: str,
    year: int = Year,
    round_number: int = Round,
    session: SessionType = Session,
    start: float = Query(0.0, ge=0, description="From this replay time (s)"),
    end: float = Query(None, ge=0, description="Up to this replay time (s)"),
    max_points: int = Query(1000, ge=10, le=5000),
):
    """One driver's telemetry over a time window, as columns.

    Columnar storage makes this a single slice per field; we then thin it to
    at most max_points samples so the response stays small.
    """
    _require_prepared(year, round_number, session)
    race = await run_in_threadpool(load_race_cached, year, round_number, session)
    code = code.upper()
    if code not in race.codes:
        raise HTTPException(404, f"No driver {code} in this race")
    d = race.codes.index(code)
    i0 = race.frame_index(start)
    i1 = race.frame_index(end if end is not None else race.meta["duration"]) + 1
    step = max(1, (i1 - i0) // max_points)
    a = race.arrays
    rows = slice(i0, i1, step)
    return {
        "code": code,
        "t": np.round(a["t"][rows], 2).tolist(),
        "speed": np.round(a["speed"][rows, d].astype(float), 1).tolist(),
        "throttle": np.round(a["throttle"][rows, d].astype(float), 1).tolist(),
        # the brake channel is on/off; send it as a percentage like throttle
        "brake": (a["brake"][rows, d] * 100).round().astype(int).tolist(),
        "gear": a["gear"][rows, d].astype(int).tolist(),
        "drs_open": (a["drs"][rows, d] >= 10).tolist(),
    }


@app.get("/api/races/{year}/{round_number}/strategy")
async def tyre_strategy(year: int = Year, round_number: int = Round, session: SessionType = Session):
    """Every driver's tyre stints for the whole race.

    The client only draws stints up to the current lap, so nothing is spoiled.
    """
    _require_prepared(year, round_number, session)
    race = await run_in_threadpool(load_race_cached, year, round_number, session)
    return race_stints(race)


@app.websocket("/ws/replay/{year}/{round_number}")
async def replay(websocket: WebSocket, year: int, round_number: int,
                 session: str = "R", t: float = 0.0, speed: float = 1.0, autoplay: bool = True):
    await replay_socket(websocket, year, round_number, session, t, speed, autoplay)
