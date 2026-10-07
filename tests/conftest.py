"""Shared pytest fixtures."""

import numpy as np
import pytest

from src.race_store import RaceData


def make_full_race(year=2030, round_number=1, seconds=60, fps=10):
    """A small but complete fake race: 3 cars, every field the app uses."""
    n, d = seconds * fps + 1, 3
    t = np.arange(n) / fps
    progress = np.stack([t / 20, t / 21, t / 22], axis=1)  # laps; car 0 fastest
    angle = 2 * np.pi * progress
    lap = np.minimum(np.floor(progress).astype(int) + 1, 3)  # a 3-lap race
    arrays = {
        "t": t,
        "x": 1000 * np.cos(angle), "y": 1000 * np.sin(angle),
        "dist": progress * 600, "progress": progress,
        "speed": np.full((n, d), 250.0), "throttle": np.full((n, d), 80.0), "brake": np.zeros((n, d)),
        "lap": lap, "tyre": np.full((n, d), 2), "gear": np.full((n, d), 7), "drs": np.zeros((n, d)),
        "position": np.tile([1, 2, 3], (n, 1)),
        "leader_lap": lap[:, 0],
        "track_status": np.ones(n, dtype=np.int8),
        "sc_x": np.full(n, np.nan), "sc_y": np.full(n, np.nan), "sc_state": np.zeros(n, dtype=np.int8),
        "air_temp": np.full(n, 25.0), "track_temp": np.full(n, 35.0),
        "humidity": np.full(n, 50.0), "rainfall": np.zeros(n, dtype=np.int8),
    }
    meta = {
        "year": year, "round": round_number, "session": "R",
        "event_name": "Test Grand Prix", "country": "Testland",
        "fps": fps, "n_frames": n, "duration": float(t[-1]), "total_laps": int(lap.max()),
        "drivers": [
            {"code": "AAA", "name": "Driver A", "team": "Team 1", "color": "#ff0000", "status": "Finished"},
            {"code": "BBB", "name": "Driver B", "team": "Team 2", "color": "#00ff00", "status": "Finished"},
            {"code": "CCC", "name": "Driver C", "team": "Team 3", "color": "#0000ff", "status": "Retired"},
        ],
        "retirements": {"CCC": 30.0},
        "track": {"x": [1000, 0, -1000, 0], "y": [0, 1000, 0, -1000], "frac": [0, .25, .5, .75],
                  "lap_length": 600.0, "rotation": 0.0, "pit_exit": None, "pit_entry": None},
        "track_status_changes": [{"t": 0.0, "status": 1}],
    }
    return RaceData(arrays=arrays, meta=meta)


@pytest.fixture
def data_dir(tmp_path, monkeypatch):
    """Point the app at an empty temporary data folder."""
    from src import race_store

    monkeypatch.setattr(race_store, "DATA_DIR", tmp_path)
    monkeypatch.setenv("F1_DATA_DIR", str(tmp_path))  # for spawned job processes
    race_store.load_race_cached.cache_clear()
    yield tmp_path
    race_store.load_race_cached.cache_clear()
