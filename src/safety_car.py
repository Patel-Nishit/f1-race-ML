"""Synthetic safety car position.

FastF1 tells us *when* the safety car is out (track status 4) but not *where*
it is. We model it as a small state machine, evaluated for every frame:

    HIDDEN -> DEPLOYING -> LEADING -> RETURNING -> HIDDEN

* DEPLOYING: drive along the track from the pit exit to a slot ahead of the
  leader, easing in so it doesn't teleport.
* LEADING: stay LEAD_GAP_M metres ahead of the race leader.
* RETURNING: (the last seconds of the period) drive on to the pit entry.

Positions are worked out as a *fraction of the lap* and turned into X/Y with
track.point_at_fraction, so the car always follows the racing line.
"""

import numpy as np

from src.track import point_at_fraction

HIDDEN, DEPLOYING, LEADING, RETURNING = 0, 1, 2, 3
STATE_NAMES = {HIDDEN: "HIDDEN", DEPLOYING: "DEPLOYING", LEADING: "LEADING", RETURNING: "RETURNING"}

DEPLOY_S = 10.0
RETURN_S = 10.0
LEAD_GAP_M = 200.0


def smoothstep(u):
    """Ease-in-out curve: 0 -> 1 with zero speed at both ends."""
    u = np.clip(u, 0.0, 1.0)
    return u * u * (3.0 - 2.0 * u)


def nearest_fraction(track: dict, point) -> float:
    """Lap fraction of the outline point closest to `point` (x, y)."""
    x = np.asarray(track["x"])
    y = np.asarray(track["y"])
    i = int(np.argmin((x - point[0]) ** 2 + (y - point[1]) ** 2))
    return float(track["frac"][i])


def find_runs(mask: np.ndarray) -> list:
    """[(start, end), ...] index ranges (end exclusive) where mask is True."""
    padded = np.concatenate([[False], mask, [False]]).astype(np.int8)
    edges = np.flatnonzero(np.diff(padded))
    return list(zip(edges[0::2], edges[1::2]))


def compute_safety_car(track_status, leader_progress, track, pit_exit, pit_entry, fps):
    """Safety car X, Y and state for every frame.

    Args:
        track_status: (N,) status code per frame.
        leader_progress: (N,) laps completed by the leader as a float
            (e.g. 12.25 = a quarter of the way round lap 13).
        track: outline dict from track.build_track_outline.
        pit_exit, pit_entry: [x, y] or None.
        fps: frames per second of the timeline.

    Returns (sc_x, sc_y, sc_state); x/y are NaN while HIDDEN.
    """
    n = len(track_status)
    sc_x = np.full(n, np.nan, dtype=np.float32)
    sc_y = np.full(n, np.nan, dtype=np.float32)
    sc_state = np.full(n, HIDDEN, dtype=np.int8)

    gap = LEAD_GAP_M / track["lap_length"]
    exit_frac = nearest_fraction(track, pit_exit) if pit_exit else None
    entry_frac = nearest_fraction(track, pit_entry) if pit_entry else None

    for i0, i1 in find_runs(np.asarray(track_status) == 4):
        length = i1 - i0
        n_deploy = min(int(DEPLOY_S * fps), length // 3)
        n_return = min(int(RETURN_S * fps), length // 3)

        # Where the SC should be while leading: just ahead of the leader.
        target = np.mod(leader_progress[i0:i1] + gap, 1.0)
        frac = target.copy()
        state = np.full(length, LEADING, dtype=np.int8)

        if n_deploy > 0 and exit_frac is not None:
            u = smoothstep(np.arange(1, n_deploy + 1) / n_deploy)
            # Always drive *forwards* from the pit exit to the target.
            ahead = np.mod(target[:n_deploy] - exit_frac, 1.0)
            frac[:n_deploy] = exit_frac + ahead * u
            state[:n_deploy] = DEPLOYING

        if n_return > 0 and entry_frac is not None:
            u = smoothstep(np.arange(1, n_return + 1) / n_return)
            start = target[-n_return]
            ahead = np.mod(entry_frac - start, 1.0)
            frac[-n_return:] = start + ahead * u
            state[-n_return:] = RETURNING

        x, y = point_at_fraction(track, frac)

        # Blend from the exact pit-lane points onto/off the track line so the
        # car visibly comes out of (and goes back into) the pits.
        if n_deploy > 0 and pit_exit:
            w = 1.0 - smoothstep(np.arange(n_deploy) / max(1, n_deploy * 0.3))
            x[:n_deploy] = x[:n_deploy] * (1 - w) + pit_exit[0] * w
            y[:n_deploy] = y[:n_deploy] * (1 - w) + pit_exit[1] * w
        if n_return > 0 and pit_entry:
            k = np.arange(n_return)
            w = smoothstep((k - n_return * 0.7) / max(1, n_return * 0.3))
            x[-n_return:] = x[-n_return:] * (1 - w) + pit_entry[0] * w
            y[-n_return:] = y[-n_return:] * (1 - w) + pit_entry[1] * w

        sc_x[i0:i1] = x
        sc_y[i0:i1] = y
        sc_state[i0:i1] = state

    return sc_x, sc_y, sc_state
