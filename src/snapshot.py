"""What the race looks like at any replay time t.

Data is stored 10 times per second, but screens refresh 60 times per second.
build_snapshot() blends the two stored frames either side of t so cars glide
instead of jumping (linear interpolation). Discrete values (gear, tyre, lap)
come from the earlier frame.

Used by the desktop viewer and by the backend's WebSocket stream.
"""

import math

import numpy as np

from src.lib.tyres import get_tyre_compound_name
from src.race_status import TRACK_STATUS
from src.safety_car import HIDDEN, STATE_NAMES

LAPPED_TOLERANCE = 0.01  # laps (~50 m); see build_snapshot


def lap_start_times(race) -> list:
    """Replay time at which the leader starts each lap (index 0 = lap 1)."""
    leader_lap = race.arrays["leader_lap"]
    t = race.arrays["t"]
    starts = []
    for lap in range(1, race.meta["total_laps"] + 1):
        idx = np.flatnonzero(leader_lap >= lap)
        if len(idx) == 0:
            break
        starts.append(float(t[idx[0]]))
    return starts


def build_snapshot(race, t: float) -> dict:
    a = race.arrays
    fps = race.meta["fps"]
    n = race.n_frames

    f = min(max(t * fps, 0.0), n - 1)
    i = int(math.floor(f))
    j = min(i + 1, n - 1)
    w = f - i  # weight of the later frame, 0..1

    def blend(name, d=None):
        if d is None:
            return float(a[name][i] * (1 - w) + a[name][j] * w)
        return float(a[name][i, d] * (1 - w) + a[name][j, d] * w)

    drivers = []
    retirements = race.meta["retirements"]
    for d, info in enumerate(race.meta["drivers"]):
        code = info["code"]
        out = code in retirements and t >= retirements[code]
        drivers.append({
            "code": code,
            "name": info["name"],
            "team": info["team"],
            "color": info["color"],
            "position": int(a["position"][i, d]),
            "x": blend("x", d),
            "y": blend("y", d),
            "lap": int(a["lap"][i, d]),
            "tyre": get_tyre_compound_name(a["tyre"][i, d]),
            "speed": round(blend("speed", d), 1),
            "gear": int(a["gear"][i, d]),
            "drs": int(a["drs"][i, d]),
            "drs_open": bool(a["drs"][i, d] >= 10),
            "throttle": round(blend("throttle", d), 1),
            # FastF1's brake channel is on/off (0 or 1); show it as 0-100 %
            # like throttle. Blending gives in-between values for smoothness.
            "brake": round(blend("brake", d) * 100, 1),
            "out": bool(out),
        })
    drivers.sort(key=lambda r: r["position"])

    leader_lap = int(a["leader_lap"][i])
    # "Lapped" means a full lap behind the leader, not merely on a lower lap
    # number: right after the leader crosses the line, everyone else is still
    # on the previous lap without being lapped. progress = laps as a float.
    # Each lap's last telemetry sample lands a few metres before the line
    # (lap fractions top out around 0.996), so a car exactly one lap down can
    # measure 0.996 laps behind; LAPPED_TOLERANCE absorbs that.
    progress = a["progress"][i]
    leader_progress = progress[int(np.argmin(a["position"][i]))]
    index = {info["code"]: d for d, info in enumerate(race.meta["drivers"])}
    for row in drivers:
        behind = leader_progress - progress[index[row["code"]]]
        row["laps_down"] = int(max(0.0, math.floor(behind + LAPPED_TOLERANCE))) if not row["out"] else 0

    status = int(a["track_status"][i])
    sc_state = int(a["sc_state"][i])
    sc = None
    if sc_state != HIDDEN:
        if a["sc_state"][j] != HIDDEN:
            sc_x, sc_y = blend("sc_x"), blend("sc_y")
        else:
            sc_x, sc_y = float(a["sc_x"][i]), float(a["sc_y"][i])
        sc = {"x": sc_x, "y": sc_y, "state": STATE_NAMES[sc_state]}

    weather = None
    if "air_temp" in a:
        weather = {
            "air_temp": round(blend("air_temp"), 1),
            "track_temp": round(blend("track_temp"), 1) if "track_temp" in a else None,
            "humidity": round(blend("humidity"), 1) if "humidity" in a else None,
            "raining": bool(a["rainfall"][i]) if "rainfall" in a else False,
        }

    return {
        "t": float(t),
        "lap": leader_lap,
        "total_laps": race.meta["total_laps"],
        "track_status": status,
        "track_status_name": TRACK_STATUS.get(status, "UNKNOWN"),
        "safety_car": sc,
        "weather": weather,
        "drivers": drivers,
    }
