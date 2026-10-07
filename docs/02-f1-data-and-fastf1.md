# 02 — F1 data and FastF1

## Where the data comes from

F1 publishes live timing during every session. The open-source library
**FastF1** downloads the archived version of that feed (2018 onwards) and gives
it to you as pandas tables. No API key required.

```python
import fastf1
fastf1.Cache.enable_cache('.fastf1-cache')   # cache layer 1
session = fastf1.get_session(2024, 1, 'R')     # season, round, session type
session.load(telemetry=True, weather=True)
```

The first `load()` downloads a lot of data and takes minutes. After that the
cache makes it take seconds. This is the single most important performance
trick in the project: **never download the same thing twice**.

## What a loaded session gives us

| Object | What it holds | We use it for |
|--------|---------------|---------------|
| `session.drivers`, `session.get_driver(num)` | Car numbers, 3-letter codes, team | Names, colours |
| `session.laps` | One row per driver per lap: `LapNumber`, `LapTime`, `Compound`, `Stint` | Tyres, lap counter |
| `lap.get_telemetry()` | Samples within that lap: `X`, `Y`, `Distance`, `Speed`, `nGear`, `DRS`, `Throttle`, `Brake`, `SessionTime` | Car positions & telemetry panel |
| `session.track_status` | `Time` + `Status` code each time the flag state changes | Safety car, VSC |
| `session.results` | Final classification, `Status` ("Finished", "+1 Lap", "Engine"...) | Marking drivers OUT |
| `session.weather_data` | Air/track temperature, rain, wind | Weather strip |
| `session.get_circuit_info()` | `rotation`, corners | Turning the map the right way up |

### Track status codes

| Code | Meaning |
|------|---------|
| 1 | Track clear (green) |
| 2 | Yellow flag |
| 4 | Safety Car deployed |
| 5 | Red flag |
| 6 | Virtual Safety Car deployed |
| 7 | VSC ending |

### Two telemetry quirks to remember

- **X/Y are in 1/10 metre units** in a coordinate system unique to each circuit.
  We'll rotate and scale them to fit the screen.
- **DRS is a code, not on/off.** Values of 10, 12 or 14 mean the flap is open.

## What FastF1 does *not* give us

- **The safety car's position.** We know when it's out, not where. We'll model
  it (chapter 06).
- **A per-instant race order.** We compute it ourselves: sort cars by total
  distance driven (chapter 04).

## Walkthrough: how `src/f1_data.py` uses it

1. `load_session(year, round, 'R')` — get + load the session.
2. `_process_single_driver(...)` — for one driver: loop over their laps, get
   each lap's telemetry, glue the laps together, and keep a running total
   distance (`total_dist_so_far`) so distance keeps growing across laps.
3. `get_race_telemetry(session)` — runs step 2 for all drivers **in parallel**
   (`multiprocessing.Pool`), then aligns everyone on one shared clock.

## Measured: our first real run

`python main.py prepare --year 2024 --round 1` on this machine:

- 231 s total (first run, including the download)
- 139,957 frames (25 per second × ~93 minutes), 57 laps, 20 drivers
- Track status changes: `1, 2, 1, 2, 1, 2, 1` (green and yellow only)
- Output pickle: **322 MB**. Keep that number in mind: chapter 05 shrinks it.

## Exercises

1. In a Python shell (inside the venv), load 2024 round 1 and print
   `session.results[["Abbreviation", "Position", "Status"]]`.
2. Print `session.track_status`. Bahrain 2024 only shows codes 1 and 2 (no
   safety car). Use `python main.py list-rounds --year 2024`, pick another
   race, and look for code 4.
3. Pick one lap: `session.laps.pick_drivers("VER").iloc[10].get_telemetry()`
   and look at the columns. How many samples per second do you get?

## Interview angle

"FastF1 gives raw timing data; I learned which parts are reliable (telemetry,
lap data, track status) and which are missing (safety car position, live
running order), and designed the pipeline to derive the missing pieces."
