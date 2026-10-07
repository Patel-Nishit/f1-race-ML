import numpy as np
import pytest

from src.race_store import RaceData
from src.snapshot import build_snapshot, lap_start_times


def make_race():
    """Two cars, 3 seconds at 10 Hz. HAM retires at 2.0 s."""
    n, fps = 31, 10
    t = np.arange(n) / fps
    x = np.stack([t * 100, t * 50], axis=1)  # VER moves 100 units/s, HAM 50
    zeros = np.zeros((n, 2))
    arrays = {
        "t": t,
        "x": x, "y": zeros.copy(),
        "speed": np.full((n, 2), 250.0), "throttle": zeros.copy(), "brake": zeros.copy(),
        "lap": np.tile([2, 1], (n, 1)),
        "tyre": np.tile([1, 3], (n, 1)),
        "gear": np.tile([7, 6], (n, 1)),
        "drs": np.tile([12, 0], (n, 1)),
        "position": np.tile([1, 2], (n, 1)),
        "leader_lap": np.array([1] * 10 + [2] * 21),
        "track_status": np.ones(n, dtype=np.int8),
        "sc_state": np.zeros(n, dtype=np.int8),
        "sc_x": np.full(n, np.nan), "sc_y": np.full(n, np.nan),
    }
    arrays["sc_state"][20:] = 2
    arrays["sc_x"][20:] = 7.0
    arrays["sc_y"][20:] = 8.0
    arrays["track_status"][20:] = 4
    meta = {
        "fps": fps, "total_laps": 2,
        "drivers": [
            {"code": "VER", "name": "Max Verstappen", "team": "Red Bull", "color": "#3671c6"},
            {"code": "HAM", "name": "Lewis Hamilton", "team": "Mercedes", "color": "#27f4d2"},
        ],
        "retirements": {"HAM": 2.0},
    }
    return RaceData(arrays=arrays, meta=meta)


def test_positions_interpolate_between_frames():
    snap = build_snapshot(make_race(), 0.15)  # halfway between frames 1 and 2
    ver = snap["drivers"][0]
    assert ver["code"] == "VER" and ver["position"] == 1
    assert ver["x"] == pytest.approx(15.0)


def test_discrete_fields_and_names():
    ver = build_snapshot(make_race(), 1.0)["drivers"][0]
    assert ver["tyre"] == "SOFT"
    assert ver["gear"] == 7
    assert ver["drs_open"] is True


def test_out_and_laps_down():
    race = make_race()
    ham_before = build_snapshot(race, 1.5)["drivers"][1]
    ham_after = build_snapshot(race, 2.5)["drivers"][1]
    assert not ham_before["out"] and ham_before["laps_down"] == 1
    assert ham_after["out"] and ham_after["laps_down"] == 0


def test_safety_car_and_status():
    race = make_race()
    assert build_snapshot(race, 1.0)["safety_car"] is None
    snap = build_snapshot(race, 2.5)
    assert snap["safety_car"] == {"x": 7.0, "y": 8.0, "state": "LEADING"}
    assert snap["track_status_name"] == "SAFETY_CAR"


def test_time_is_clamped():
    race = make_race()
    assert build_snapshot(race, -10)["drivers"][0]["x"] == 0
    assert build_snapshot(race, 999)["drivers"][0]["x"] == pytest.approx(300)


def test_lap_start_times():
    assert lap_start_times(make_race()) == [0.0, pytest.approx(1.0)]
