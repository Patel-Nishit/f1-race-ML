import json

import numpy as np

from src.race_store import RaceData, is_prepared, load_race, race_key, save_race


def make_race():
    n, d = 50, 2
    arrays = {
        "t": np.arange(n) / 10,
        "x": np.random.default_rng(0).normal(size=(n, d)),
        "gear": np.full((n, d), 7),
        "position": np.tile([1, 2], (n, 1)),
    }
    meta = {
        "fps": 10,
        "drivers": [{"code": "VER"}, {"code": "HAM"}],
        "retirements": {"HAM": 2.0},
    }
    return RaceData(arrays=arrays, meta=meta)


def test_race_key():
    assert race_key(2024, 1) == "2024_01_R"
    assert race_key(2023, 12, "S") == "2023_12_S"


def test_round_trip(tmp_path):
    race = make_race()
    assert not is_prepared(2024, 1, data_dir=tmp_path)
    save_race(race, 2024, 1, data_dir=tmp_path)
    assert is_prepared(2024, 1, data_dir=tmp_path)

    loaded = load_race(2024, 1, data_dir=tmp_path)
    assert loaded.meta == race.meta
    assert np.allclose(loaded.arrays["x"], race.arrays["x"], atol=1e-6)
    # small integers are stored compactly
    assert loaded.arrays["gear"].dtype == np.int8
    assert loaded.arrays["x"].dtype == np.float32
    # metadata is plain JSON anyone can read
    json.loads((tmp_path / "2024_01_R.json").read_text())


def test_out_mask_and_frame_index():
    race = make_race()
    out = race.out_mask()
    assert out.shape == (50, 2)
    assert not out[:, 0].any()  # VER never out
    assert not out[19, 1] and out[20, 1]  # HAM out from t = 2.0 s
    assert race.frame_index(2.05) == 20
    assert race.frame_index(-5) == 0
    assert race.frame_index(1e9) == 49
