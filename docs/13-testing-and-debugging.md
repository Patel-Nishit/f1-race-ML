# 13 — Testing and debugging

This chapter grows as the project does. Phase 2 added the Python test suite.

## Running the tests

```bash
source venv/bin/activate
python -m pytest            # all tests
python -m pytest -q         # quieter
python -m pytest tests/test_transform.py -k positions   # just some
```

67 Python tests run in a few seconds, with no internet and no FastF1 download.
`tests/test_desktop.py` opens a real window; it skips itself when there's no
display or the Saudi 2024 race isn't prepared.

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

Web app tests (from `web/`):

```bash
npm test             # vitest: decoding, ack handling, interpolation, transforms
npm run typecheck    # TypeScript
npm run lint         # ESLint (Next.js rules)
npm run build        # production build (catches Next.js rule violations)
```

## End-to-end tests with a real browser

Unit tests can't tell you the page actually works. We drove Chromium with
**Playwright**: open the race picker, click "Watch replay", wait for "Live",
check the clock advances and the canvas changes, press Pause and check
everything freezes. Then we **killed the API server mid-replay** and checked
the page reconnects and resumes at the same time. These now live in
`e2e/` (15 tests, see below).

**Flaky tests.** A test that sometimes fails usually waits a *fixed* time
(`sleep(0.4)`) for something that *usually* takes less. Poll for the
condition with a timeout instead (`until(lambda: lap() == l0 + 1)`). After
that change, the 16-check HUD test passed 9 runs out of 9.

Lesson from writing them: `pgrep -f "main.py serve"` also matched our own
shell command (its text contained that string) and killed it. Finding the
server by its **port** (`ss -ltnp 'sport = :8000'`) was reliable.

## The browser suite (`e2e/`)

```bash
python -m venv .venv-e2e && .venv-e2e/bin/pip install -r e2e/requirements.txt
.venv-e2e/bin/python -m playwright install chromium
python main.py serve & (cd web && npm run dev) &
.venv-e2e/bin/python -m pytest e2e
```

- Playwright stays out of the app's dependencies (its own small venv).
- Without running servers every test is **skipped**, not failed. Careful:
  `pytest_collection_modifyitems` sees *every* test in the session, so the
  hook only marks tests under `e2e/`. Our first version would have skipped
  the unit tests too.
- A plain `pytest` runs only `tests/` (`pytest.ini`), so the browser suite
  never slows down normal runs.
- Point it at a deployment with `E2E_WEB_URL` and `E2E_API_URL`.
- It passed 15/15 on three runs against a production build talking to the
  slim API in "public mode".

## Continuous integration

`.github/workflows/ci.yml` runs on every push: Python unit tests, then
lint, typecheck, Vitest and a production build of the web app. Two things we
checked before trusting it:

- **A clean checkout:** we exported only the committed files into a fresh
  environment and ran the Python job: 64 passed, 3 skipped (the desktop
  window tests, which skip without a display, as they will on CI).
- **Generated types:** `tsc` failed on the clean checkout because Next.js
  generates the `PageProps`/`LayoutProps` route types. `npm run typecheck` now
  runs `next typegen` first.

## What the tests cover

| File | Covers |
|------|--------|
| `test_lib.py` | Time parsing/formatting, tyre compound mapping |
| `test_transform.py` | Timeline, linear vs step resampling, ranking rules, lap-1 grid correction, status expansion |
| `test_race_status.py` | Which statuses count as finished; retirement times |
| `test_safety_car.py` | Run detection, easing, wrap-around, full SC lifecycle, very short SC periods |
| `test_race_store.py` | Save/load round trip, dtypes, OUT mask, frame lookup |
| `test_playback.py` | Play/pause, speed limits, seeking, lap skipping |
| `test_snapshot.py` | Interpolation, discrete fields, OUT, safety car, clamping |
| `test_desktop.py` | Simulated key presses and clicks on the real window |
| `test_backend.py` | REST endpoints, validation, CORS (incl. preview-URL regex), prepare switch, WebSocket protocol, background jobs |
| `test_strategy.py` | Stints from FastF1's Stint column (same-compound stops), fallback from arrays |

`tests/conftest.py` holds shared **fixtures**: `make_full_race()` builds a
3-car, 3-lap fake race, and `data_dir` points the app at a temporary folder so
tests never touch your real `computed_data/`.

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
- **Check what git ignores.** The standard Python `.gitignore` ignores every
  folder named `lib/`, and it silently dropped both `src/lib/` and `web/lib/`
  from commits. `git status --ignored` shows what's being skipped; we
  un-ignore our folders with `!src/lib/` and `!web/lib/`.
- **Count the weird.** "How many frames does the order change?" turned a vague
  "the leaderboard looks jumpy" into a number we could drive down.

## Exercises

1. Break `compute_positions` on purpose (e.g. remove the `-` in
   `np.argsort(-key)`) and run the tests. Read the failure message.
2. Add a test that `resample_step` works when the timeline starts before the
   first sample.
