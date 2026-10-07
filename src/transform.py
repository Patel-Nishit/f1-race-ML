"""Pure numpy transforms used by the race pipeline.

Nothing in here talks to FastF1, so every function can be unit-tested with
small fake arrays (see tests/test_transform.py).
"""

import numpy as np


def make_timeline(t_min: float, t_max: float, fps: int) -> np.ndarray:
    """Evenly spaced sample times from 0 to (t_max - t_min), `fps` per second."""
    n = int(np.floor((t_max - t_min) * fps)) + 1
    return np.arange(n, dtype=np.float64) / fps


def resample_linear(timeline: np.ndarray, t: np.ndarray, values: np.ndarray) -> np.ndarray:
    """Continuous signals (x, y, speed...): straight line between neighbours.

    Before the first sample / after the last one the edge value is held.
    """
    return np.interp(timeline, t, values)


def resample_step(timeline: np.ndarray, t: np.ndarray, values: np.ndarray) -> np.ndarray:
    """Discrete signals (gear, lap, tyre, DRS): keep the most recent value.

    Interpolating a gear between 3 and 4 would give a meaningless 3.5, so we
    look up the last sample at or before each timeline instant instead.
    """
    idx = np.searchsorted(t, timeline, side="right") - 1
    idx = np.clip(idx, 0, len(t) - 1)
    return values[idx]


GRID_SLOT_M = 8.0  # distance between consecutive grid slots


def correct_lap1_progress(progress: np.ndarray, lap: np.ndarray, grid: np.ndarray, lap_length: float) -> np.ndarray:
    """Make lap-1 progress comparable between cars.

    FastF1 measures lap 1 from each car's own grid slot, so P1 and P20 both
    start at "0.0 laps" although P20 is ~150 m further back. We shift each car
    back by its grid gap and stretch lap 1 so it still ends at exactly 1.0:

        corrected = -offset + raw * (1 + offset)

    Args: progress, lap (frames, drivers); grid (drivers,) 1 = pole.
    """
    grid = np.clip(grid, 1, 25)
    offset = ((grid - 1) * GRID_SLOT_M / lap_length)[np.newaxis, :]
    corrected = -offset + progress * (1 + offset)
    return np.where(lap == 1, corrected, progress)


def compute_positions(
    progress: np.ndarray,
    out: np.ndarray,
    finished: np.ndarray,
    final_position: np.ndarray,
) -> np.ndarray:
    """Race order for every frame.

    Args (all shaped (frames, drivers) except final_position (drivers,)):
        progress: how far round the race each car is (laps as a float).
        out: True once a driver has retired.
        finished: True once a classified driver has taken the chequered flag.
        final_position: official classification (1 = winner).

    Returns int8 array (frames, drivers) with 1 = leader.

    The ranking key, highest first:
      * finished drivers, in official order (avoids tiny distance errors
        reshuffling the podium after the flag),
      * running drivers, by progress,
      * retired drivers, by how far they got before stopping.
    """
    key = np.where(out, progress - 1e6, progress)
    key = np.where(finished, 1e12 - final_position[np.newaxis, :], key)
    order = np.argsort(-key, axis=1, kind="stable")  # driver indices, leader first
    positions = np.argsort(order, axis=1) + 1  # inverse permutation -> rank
    return positions.astype(np.int8)


def expand_intervals(starts: np.ndarray, codes: np.ndarray, timeline: np.ndarray, default: int) -> np.ndarray:
    """Turn "status changed to X at time T" events into one value per frame."""
    if len(starts) == 0:
        return np.full(len(timeline), default, dtype=np.int8)
    order = np.argsort(starts)
    starts = np.asarray(starts)[order]
    codes = np.asarray(codes)[order]
    idx = np.searchsorted(starts, timeline, side="right") - 1
    result = np.where(idx >= 0, codes[np.clip(idx, 0, None)], default)
    return result.astype(np.int8)
