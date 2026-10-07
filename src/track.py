"""Track geometry: outline, "where is fraction f of the lap", pit lane points."""

import numpy as np


def build_track_outline(session) -> dict:
    """Outline from the race's fastest lap.

    Returns plain lists/floats so the result can go straight into meta.json:
        x, y   - outline points (FastF1 units: 1/10 metre)
        frac   - how far round the lap each point is, 0.0 .. 1.0
        lap_length - metres
        rotation   - degrees the map should be turned for display
    """
    lap = session.laps.pick_fastest()
    tel = lap.get_telemetry()
    frac = tel["RelativeDistance"].to_numpy(dtype=float)
    x = tel["X"].to_numpy(dtype=float)
    y = tel["Y"].to_numpy(dtype=float)

    # Keep frac strictly increasing so np.interp can use it as the x-axis.
    keep = np.concatenate([[True], np.diff(frac) > 0])
    frac, x, y = frac[keep], x[keep], y[keep]

    return {
        "x": np.round(x, 1).tolist(),
        "y": np.round(y, 1).tolist(),
        "frac": np.round(frac, 6).tolist(),
        "lap_length": float(tel["Distance"].max()),
        "rotation": float(session.get_circuit_info().rotation),
    }


def point_at_fraction(track: dict, frac) -> tuple:
    """(x, y) of the point `frac` of the way round the lap. Works on arrays.

    Values outside 0..1 wrap around (1.25 == 0.25), so "150 m ahead of the
    leader" works even when that's past the start/finish line.
    """
    f = np.asarray(track["frac"], dtype=float)
    x = np.asarray(track["x"], dtype=float)
    y = np.asarray(track["y"], dtype=float)
    # Close the loop: after the last point comes the first one again at 1.0.
    f = np.append(f, 1.0)
    x = np.append(x, x[0])
    y = np.append(y, y[0])
    q = np.mod(frac, 1.0)
    return np.interp(q, f, x), np.interp(q, f, y)


def find_pit_points(session, driver_raw: dict) -> dict:
    """Locate pit exit / entry from where cars actually were at pit events.

    FastF1 doesn't publish pit lane coordinates, but every lap row records
    PitOutTime / PitInTime. Looking up each car's X/Y at those moments and
    taking the median gives a robust estimate.

    driver_raw: {code: {"t": session seconds, "x": ..., "y": ...}} (unshifted)
    Returns {"pit_exit": [x, y] | None, "pit_entry": [x, y] | None}
    """
    laps = session.laps
    return {
        # Lap 1's PitOutTime can be the grid start, so skip it.
        "pit_exit": _median_point(laps, driver_raw, "PitOutTime", min_lap=2),
        "pit_entry": _median_point(laps, driver_raw, "PitInTime", min_lap=1),
    }


def _median_point(laps, driver_raw, column, min_lap):
    xs, ys = [], []
    rows = laps[laps[column].notna() & (laps["LapNumber"] >= min_lap)]
    for _, row in rows.iterrows():
        raw = driver_raw.get(row["Driver"])
        if raw is None:
            continue
        when = row[column].total_seconds()
        if when < raw["t"][0] or when > raw["t"][-1]:
            continue
        xs.append(np.interp(when, raw["t"], raw["x"]))
        ys.append(np.interp(when, raw["t"], raw["y"]))
    if not xs:
        return None
    return [round(float(np.median(xs)), 1), round(float(np.median(ys)), 1)]
