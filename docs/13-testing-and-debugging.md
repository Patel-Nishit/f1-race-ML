# 13 — Testing and debugging

This chapter grows as the project does. Phase 2 added the Python test suite.

## Running the tests

```bash
source venv/bin/activate
python -m pytest            # all tests
python -m pytest -q         # quieter
python -m pytest tests/test_transform.py -k positions   # just some
```

29 tests run in under a second, with no internet and no FastF1 download.

## How pytest works

- Any file named `test_*.py` in `tests/` is collected.
- Any function named `test_*` in it is a test.
- `assert` checks a condition; if it's false, the test fails and pytest shows
  the values involved.

```python
def test_positions_by_progress():
    pos = _positions([[1.2, 3.5, 2.0]])
    assert pos.tolist() == [[3, 1, 2]]
```

Useful pytest features we use:

| Feature | Where | What it does |
|---------|-------|--------------|
| `@pytest.mark.parametrize` | `test_lib.py` | Run one test with many inputs |
| `pytest.approx` | `test_lib.py` | Compare floats without rounding trouble |
| `tmp_path` fixture | `test_race_store.py` | A fresh temporary folder per test |
| helper functions | `circle_track()` in `test_safety_car.py` | Build fake data once, reuse it |

## Testing with synthetic data

Real races take minutes to prepare, so tests use **tiny made-up data that
makes the right answer obvious**:

- three cars with progress `[1.2, 3.5, 2.0]` → positions must be `[3, 1, 2]`;
- a perfectly round track where fraction 0.25 must be at the top;
- a 2-minute fake race with a safety car from 20 s to 100 s.

This only works because the logic lives in pure functions
(`src/transform.py`, `src/safety_car.py`) that take arrays and return arrays.
Code that mixes downloading, computing and saving is very hard to test.

## What the tests cover

| File | Covers |
|------|--------|
| `test_lib.py` | Time parsing/formatting, tyre compound mapping |
| `test_transform.py` | Timeline, linear vs step resampling, ranking rules, lap-1 grid correction, status expansion |
| `test_race_status.py` | Which statuses count as finished; retirement times |
| `test_safety_car.py` | Run detection, easing, wrap-around, full SC lifecycle, very short SC periods |
| `test_race_store.py` | Save/load round trip, dtypes, OUT mask, frame lookup |

## Checking against reality

Unit tests prove the code does what *we think* it should. They can't tell us
if what we think is right. For that we compared the output against known
facts:

- The order at the start equals the starting grid.
- The order at the flag equals the official classification.
- In Saudi Arabia 2024, crash → yellow → safety car happen in the right order.
- Rendered frames *look* right (SC ahead of the pack, leaving and entering
  the pits).

These checks found two real bugs that every unit test missed: the grid-slot
distance bias, and the last finisher being one frame short of "finished"
(chapter 04).

## Debugging tips

- **Print shapes first.** Most numpy bugs are shape bugs: `print(arr.shape, arr.dtype)`.
- **Look at the edges.** First frame, last frame, lap 1, the last lap, the
  moment of a retirement. Bugs live at boundaries.
- **Plot it.** A 10-line matplotlib script showed the safety car's behaviour
  faster than any number could.
- **Count the weird.** "How many frames does the order change?" turned a vague
  "the leaderboard looks jumpy" into a number we could drive down.

## Exercises

1. Break `compute_positions` on purpose (e.g. remove the `-` in
   `np.argsort(-key)`) and run the tests. Read the failure message.
2. Add a test that `resample_step` works when the timeline starts before the
   first sample.
