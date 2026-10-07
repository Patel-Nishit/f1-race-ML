import numpy as np

from src.transform import (compute_positions, expand_intervals, make_timeline,
                           resample_linear, resample_step)


def test_make_timeline():
    tl = make_timeline(100.0, 101.0, fps=10)
    assert tl[0] == 0.0
    assert len(tl) == 11
    assert np.allclose(np.diff(tl), 0.1)


def test_resample_linear_interpolates_and_holds_edges():
    t = np.array([0.0, 1.0, 2.0])
    v = np.array([0.0, 10.0, 20.0])
    out = resample_linear(np.array([-1.0, 0.5, 1.5, 5.0]), t, v)
    assert np.allclose(out, [0.0, 5.0, 15.0, 20.0])


def test_resample_step_keeps_last_value():
    t = np.array([0.0, 1.0, 2.0])
    gear = np.array([3, 4, 5])
    out = resample_step(np.array([0.0, 0.9, 1.0, 1.5, 9.0]), t, gear)
    assert out.tolist() == [3, 3, 4, 4, 5]  # never 3.5


def _positions(progress, out=None, finished=None, final=None):
    progress = np.array(progress, dtype=float)
    shape = progress.shape
    out = np.zeros(shape, bool) if out is None else np.array(out)
    finished = np.zeros(shape, bool) if finished is None else np.array(finished)
    final = np.arange(1, shape[1] + 1, dtype=float) if final is None else np.array(final, float)
    return compute_positions(progress, out, finished, final)


def test_positions_by_progress():
    # three cars, one frame: car 1 is furthest round, then car 2, then car 0
    pos = _positions([[1.2, 3.5, 2.0]])
    assert pos.tolist() == [[3, 1, 2]]


def test_ties_keep_column_order():
    # on the grid everyone is at 0: column order (= grid order) wins
    assert _positions([[0.0, 0.0, 0.0]]).tolist() == [[1, 2, 3]]


def test_retired_driver_goes_to_the_back():
    pos = _positions([[10.0, 5.0, 2.0]], out=[[True, False, False]])
    assert pos.tolist() == [[3, 1, 2]]


def test_finished_drivers_use_official_order():
    # both finished; car 1 has slightly more progress but was classified 2nd
    pos = _positions([[57.0, 57.001]], finished=[[True, True]], final=[1, 2])
    assert pos.tolist() == [[1, 2]]


def test_finished_driver_ahead_of_running_driver():
    pos = _positions([[57.0, 56.9]], finished=[[True, False]])
    assert pos.tolist() == [[1, 2]]


def test_expand_intervals():
    timeline = np.arange(0, 10, 1.0)
    status = expand_intervals(np.array([2.0, 5.0]), np.array([4, 1]), timeline, default=1)
    assert status.tolist() == [1, 1, 4, 4, 4, 1, 1, 1, 1, 1]


def test_expand_intervals_empty():
    assert expand_intervals(np.array([]), np.array([]), np.zeros(3), 1).tolist() == [1, 1, 1]


def test_lap1_progress_accounts_for_grid_slot():
    from src.transform import correct_lap1_progress
    lap_length = 5000.0
    progress = np.array([[0.0, 0.0], [0.5, 0.5], [1.0, 1.0], [1.5, 1.4]])
    lap = np.array([[1, 1], [1, 1], [1, 1], [2, 2]])
    grid = np.array([1, 11])  # P11 starts 80 m behind pole
    out = correct_lap1_progress(progress, lap, grid, lap_length)
    assert out[0, 0] == 0.0 and np.isclose(out[0, 1], -80 / 5000)  # behind at the start
    assert out[1, 0] > out[1, 1]  # same raw fraction -> pole car ahead
    assert np.allclose(out[2], [1.0, 1.0])  # everyone reaches the line at 1.0
    assert np.allclose(out[3], [1.5, 1.4])  # later laps untouched
