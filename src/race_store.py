"""Saving and loading prepared races (cache layer 2 + layer 3).

Each race is two files in computed_data/:

    2024_01_R.npz   numpy arrays, one per field (columnar storage)
    2024_01_R.json  metadata: drivers, colours, track outline, retirements...

Arrays shaped (frames, drivers) use the driver order in meta["drivers"].
"""

import json
import os
from dataclasses import dataclass
from functools import lru_cache
from pathlib import Path

import numpy as np

# Where prepared races live. Override with the F1_DATA_DIR environment variable.
DATA_DIR = Path(os.environ.get("F1_DATA_DIR", "computed_data"))

# Per-driver arrays (frames, drivers) and their on-disk dtypes. Smaller dtypes
# for small integers keep files and memory compact.
DRIVER_FIELDS = {
    "x": np.float32,
    "y": np.float32,
    "dist": np.float32,
    "progress": np.float32,
    "speed": np.float32,
    "throttle": np.float32,
    "brake": np.float32,
    "lap": np.int16,
    "tyre": np.int8,
    "gear": np.int8,
    "drs": np.int8,
    "position": np.int8,
}

# Per-frame arrays (frames,)
FRAME_FIELDS = {
    "t": np.float32,
    "leader_lap": np.int16,
    "track_status": np.int8,
    "sc_x": np.float32,
    "sc_y": np.float32,
    "sc_state": np.int8,
    "air_temp": np.float32,
    "track_temp": np.float32,
    "humidity": np.float32,
    "rainfall": np.int8,
    "wind_speed": np.float32,
}


def race_key(year: int, round_number: int, session_type: str = "R") -> str:
    return f"{year}_{round_number:02d}_{session_type}"


def race_paths(year, round_number, session_type="R", data_dir=None):
    base = Path(data_dir or DATA_DIR) / race_key(year, round_number, session_type)
    return base.with_suffix(".npz"), base.with_suffix(".json")


def list_prepared(data_dir=None) -> list:
    """[(year, round, session), ...] for every race in the data folder."""
    races = []
    for npz in sorted(Path(data_dir or DATA_DIR).glob("*_*_*.npz")):
        year, round_number, session_type = npz.stem.split("_")
        if npz.with_suffix(".json").exists():
            races.append((int(year), int(round_number), session_type))
    return races


def is_prepared(year, round_number, session_type="R", data_dir=None) -> bool:
    npz, meta = race_paths(year, round_number, session_type, data_dir)
    return npz.exists() and meta.exists()


@dataclass
class RaceData:
    arrays: dict  # field name -> np.ndarray
    meta: dict

    @property
    def n_frames(self) -> int:
        return len(self.arrays["t"])

    @property
    def codes(self) -> list:
        return [d["code"] for d in self.meta["drivers"]]

    def out_mask(self) -> np.ndarray:
        """(frames, drivers) bool: True once that driver has retired."""
        t = self.arrays["t"][:, np.newaxis]
        t_out = np.array(
            [self.meta["retirements"].get(code, np.inf) for code in self.codes]
        )[np.newaxis, :]
        return t >= t_out

    def frame_index(self, t: float) -> int:
        """Index of the frame at (or just before) replay time t seconds."""
        i = int(t * self.meta["fps"])
        return max(0, min(self.n_frames - 1, i))


def save_race(race: RaceData, year, round_number, session_type="R", data_dir=None):
    npz_path, meta_path = race_paths(year, round_number, session_type, data_dir)
    npz_path.parent.mkdir(parents=True, exist_ok=True)

    dtypes = {**DRIVER_FIELDS, **FRAME_FIELDS}
    arrays = {name: np.asarray(arr).astype(dtypes.get(name, arr.dtype)) for name, arr in race.arrays.items()}
    np.savez_compressed(npz_path, **arrays)
    meta_path.write_text(json.dumps(race.meta))
    return npz_path, meta_path


def load_race(year, round_number, session_type="R", data_dir=None) -> RaceData:
    npz_path, meta_path = race_paths(year, round_number, session_type, data_dir)
    # allow_pickle=False: an .npz can only contain plain arrays, never code.
    with np.load(npz_path, allow_pickle=False) as npz:
        arrays = {name: npz[name] for name in npz.files}
    meta = json.loads(meta_path.read_text())
    return RaceData(arrays=arrays, meta=meta)


@lru_cache(maxsize=4)
def load_race_cached(year, round_number, session_type="R") -> RaceData:
    """Layer 3: keep the 4 most recently used races in memory."""
    return load_race(year, round_number, session_type)
