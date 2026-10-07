"""Tyre strategy: which compound each driver ran, lap by lap, as stints."""

import pandas as pd

from src.lib.tyres import get_tyre_compound_name


def stints_from_laps(laps: pd.DataFrame) -> dict:
    """{code: [{"compound", "start_lap", "end_lap"}, ...]} from session.laps.

    Uses FastF1's own Stint numbers, so a pit stop onto the *same* compound
    (Medium -> Medium) still starts a new stint.
    """
    result = {}
    for code, driver_laps in laps.groupby("Driver"):
        stints = []
        for _, stint_laps in driver_laps.sort_values("LapNumber").groupby("Stint", sort=True):
            compound = stint_laps["Compound"].dropna()
            stints.append({
                "compound": str(compound.iloc[0]).upper() if len(compound) else "UNKNOWN",
                "start_lap": int(stint_laps["LapNumber"].min()),
                "end_lap": int(stint_laps["LapNumber"].max()),
            })
        result[str(code)] = stints
    return result


def stints_from_arrays(race) -> dict:
    """Fallback for races prepared before stints were saved: rebuild them from
    the per-frame lap and tyre columns. Can't see same-compound pit stops."""
    lap, tyre = race.arrays["lap"], race.arrays["tyre"]
    result = {}
    for d, code in enumerate(race.codes):
        stints = []
        for lap_no in sorted(set(int(x) for x in lap[:, d] if x > 0)):
            first = int((lap[:, d] == lap_no).argmax())
            compound = get_tyre_compound_name(tyre[first, d])
            if stints and stints[-1]["compound"] == compound and stints[-1]["end_lap"] == lap_no - 1:
                stints[-1]["end_lap"] = lap_no
            else:
                stints.append({"compound": compound, "start_lap": lap_no, "end_lap": lap_no})
        result[code] = stints
    return result


def race_stints(race) -> dict:
    return race.meta.get("stints") or stints_from_arrays(race)
