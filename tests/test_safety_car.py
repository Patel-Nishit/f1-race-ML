import numpy as np

from src.safety_car import (DEPLOYING, HIDDEN, LEADING, RETURNING,
                            compute_safety_car, find_runs, smoothstep)
from src.track import point_at_fraction

FPS = 10


def circle_track(n=400, radius=1000.0):
    """A round test track; lap fraction f sits at angle 2*pi*f."""
    frac = np.arange(n) / n
    return {
        "x": (radius * np.cos(2 * np.pi * frac)).tolist(),
        "y": (radius * np.sin(2 * np.pi * frac)).tolist(),
        "frac": frac.tolist(),
        "lap_length": 2 * np.pi * radius / 10,  # metres (x/y are 1/10 m)
    }


def test_find_runs():
    mask = np.array([0, 1, 1, 0, 0, 1, 0, 1, 1, 1], bool)
    assert [tuple(map(int, r)) for r in find_runs(mask)] == [(1, 3), (5, 6), (7, 10)]


def test_smoothstep_endpoints():
    assert smoothstep(0.0) == 0.0
    assert smoothstep(1.0) == 1.0
    assert smoothstep(0.5) == 0.5


def test_point_at_fraction_wraps():
    track = circle_track()
    x1, y1 = point_at_fraction(track, 0.25)
    x2, y2 = point_at_fraction(track, 1.25)
    assert np.allclose([x1, y1], [x2, y2])
    assert np.allclose([x1, y1], [0.0, 1000.0], atol=1.0)


def test_safety_car_lifecycle():
    track = circle_track()
    n = 120 * FPS  # two minutes
    status = np.ones(n, dtype=np.int8)
    status[20 * FPS:100 * FPS] = 4  # SC from 20 s to 100 s
    leader = np.linspace(3.0, 4.0, n)  # leader does one lap
    pit_exit = [1000.0, 50.0]
    pit_entry = [1000.0, -50.0]

    x, y, state = compute_safety_car(status, leader, track, pit_exit, pit_entry, FPS)

    # Hidden outside the SC period
    assert (state[:20 * FPS] == HIDDEN).all() and np.isnan(x[:20 * FPS]).all()
    assert (state[100 * FPS:] == HIDDEN).all()
    # Phases in order: deploy, lead, return
    period = state[20 * FPS:100 * FPS]
    assert period[0] == DEPLOYING and period[-1] == RETURNING
    assert (period[15 * FPS:65 * FPS] == LEADING).all()
    # Starts at the pit exit, ends at the pit entry
    assert np.allclose([x[20 * FPS], y[20 * FPS]], pit_exit, atol=5)
    assert np.allclose([x[100 * FPS - 1], y[100 * FPS - 1]], pit_entry, atol=5)
    # While leading it's on the track, just ahead of the leader
    i = 50 * FPS
    ahead = point_at_fraction(track, leader[i] + 200 / track["lap_length"])
    assert np.allclose([x[i], y[i]], ahead, atol=1)


def test_short_safety_car_period_still_has_all_phases():
    track = circle_track()
    status = np.ones(100, dtype=np.int8)
    status[10:25] = 4  # only 1.5 s
    _, _, state = compute_safety_car(status, np.zeros(100), track, [1000, 0], [1000, 0], FPS)
    assert set(state[10:25]) == {DEPLOYING, LEADING, RETURNING}
