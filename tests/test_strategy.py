import numpy as np
import pandas as pd

from src.strategy import stints_from_arrays, stints_from_laps
from tests.conftest import make_full_race


def test_stints_from_laps_uses_stint_numbers():
    laps = pd.DataFrame({
        "Driver": ["VER"] * 6,
        "LapNumber": [1, 2, 3, 4, 5, 6],
        "Stint": [1, 1, 2, 2, 3, 3],
        "Compound": ["MEDIUM", "MEDIUM", "MEDIUM", "MEDIUM", "HARD", None],
    })
    # a Medium -> Medium stop still splits the stint
    assert stints_from_laps(laps) == {"VER": [
        {"compound": "MEDIUM", "start_lap": 1, "end_lap": 2},
        {"compound": "MEDIUM", "start_lap": 3, "end_lap": 4},
        {"compound": "HARD", "start_lap": 5, "end_lap": 6},
    ]}


def test_stints_from_arrays_fallback():
    race = make_full_race()
    a = race.arrays
    a["tyre"] = a["tyre"].copy()
    a["tyre"][a["lap"][:, 0] == 3, 0] = 3  # car 0 switches to HARD on lap 3
    stints = stints_from_arrays(race)["AAA"]
    assert [(s["compound"], s["start_lap"], s["end_lap"]) for s in stints] == [("MEDIUM", 1, 2), ("HARD", 3, 3)]
