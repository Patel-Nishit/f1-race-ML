# 04 — The data pipeline (ETL)

The pipeline is `prepare_race()` in `src/f1_data.py`. It follows the classic
**Extract → Transform → Load** pattern, and prints its stages as it goes:

```
[  0%] Loading session from FastF1
[ 30%] Extracting telemetry for 20 drivers
[ 70%] Resampling onto a 10 Hz timeline
[ 85%] Building track and safety car
[ 95%] Saving to computed_data/
[100%] Done
```

The `progress` callback that produces these lines will later drive a
progress bar in the web app.

## 1. Extract (FastF1 → raw per-driver arrays)

`_process_single_driver()` handles one driver. It walks their laps, gets each
lap's telemetry, and glues the laps into long arrays. Two running totals turn
"within this lap" values into "whole race" values:

- `dist = total_dist_so_far + Distance`: metres since the start.
- `progress = (lap - 1) + RelativeDistance`: laps completed as a float
  (`12.25` = a quarter of the way round lap 13).

Finally it sorts by time and removes duplicate timestamps. A lap's last sample
and the next lap's first can share a time, and interpolation needs strictly
increasing times.

### Parallelism with `multiprocessing`

Drivers don't depend on each other, so we process them at the same time:

```python
with Pool(processes=min(cpu_count(), len(drivers))) as pool:
    results = pool.map(_process_single_driver, driver_args)
```

`Pool.map` is like a normal `map`, but each call runs in a separate Python
process on its own CPU core. The function must be defined at the top level of
the module, because each worker process has to be able to import it.

## 2. Transform

### a. One shared clock (resampling)

Every car's samples arrive at slightly different, uneven times. To draw "all
cars at 1800.0 s", we need every car's values *at exactly the same moments*.
So we build one timeline (`0.0, 0.1, 0.2, ...`: 10 Hz) and resample:

- **Continuous** fields (x, y, speed, throttle, progress) use
  `resample_linear` (`np.interp`).
- **Discrete** fields (gear, lap, tyre, DRS) use `resample_step`: keep the
  latest value. Interpolating gear 3 → 4 would give a meaningless 3.5.

Why 10 Hz and not the original 25? Merged raw telemetry arrives roughly 7–8
times a second (VER's fastest Bahrain lap: 703 samples in about 92 s), so 25 Hz
mostly stored made-up in-between points. The viewers will
interpolate to 60 fps anyway (chapter 11). 10 Hz cut the frame count from
139,957 to 55,983.

### b. Race order (positions)

The leader is the car furthest round the race. `compute_positions()` ranks
every frame in one vectorised step, with three rules:

1. Finished drivers come first, **in official classification order**. Tiny
   measurement errors can't reshuffle the podium after the flag.
2. Running drivers are ranked by `progress`.
3. Retired drivers come last, by how far they got.

**Two bugs we found and fixed (worth telling in an interview):**

- *Ranking by metres was wrong.* A car starting P20 is ~150 m behind the line,
  so its lap 1 is ~150 m longer. With total metres, that 150 m stayed in its
  total for the whole race, and back-markers looked further ahead than they
  were. Ranking by laps + lap fraction fixed it.
- *Lap 1 still looked random.* FastF1 measures lap 1 from each car's own grid
  slot, so at the start every car is at "0.0 laps".
  `correct_lap1_progress()` shifts each car back by its grid gap (8 m per
  slot) and stretches lap 1 so it still ends at exactly 1.0.

Result on Bahrain 2024: the frames where the order changes dropped from 4,602
to 421 (−91%), the order at the start equals the grid, and the order at the
flag equals the official classification. Saudi Arabia 2024 checks out the
same way.

### c. Derived data

- **OUT drivers**: `src/race_status.py` (chapter 06).
- **Track status** per frame: `expand_intervals()` turns "changed to 4 at
  t = 812 s" events into one code per frame.
- **Track outline and pit lane**: `src/track.py` (chapter 06).
- **Safety car** position: `src/safety_car.py` (chapter 06).
- **Weather**, sampled about once a minute, resampled onto the same timeline.
- **Tyre stints**, from FastF1's `Stint` column (`src/strategy.py`), saved in
  the JSON metadata (phase 7).

## 3. Load

`save_race()` writes `computed_data/2024_01_R.npz` (arrays) and
`2024_01_R.json` (metadata). Chapter 05 explains the format choices.

## Separation of concerns

`src/transform.py` holds the pure maths and never imports FastF1. That's why
`tests/test_transform.py` can test resampling and ranking with three fake cars
in milliseconds. Keeping I/O (FastF1, files) apart from logic is the single
most useful habit for testable code.

## Exercises

1. Run `python main.py prepare --year 2024 --round 1 --refresh-data` and time
   each stage. Which is slowest, and why?
2. Change `FPS` to 5. What happens to file size? Would the replay still look
   smooth? (Think about chapter 11's interpolation.)
3. Write a test in `tests/test_transform.py` for a car that retires while
   leading. Where should it end up?

## Interview angle

"The pipeline extracts per-driver telemetry in parallel, resamples it onto a
common 10 Hz clock with linear or step interpolation depending on the signal,
and ranks drivers per frame with a vectorised argsort. I caught a systematic
bias from grid-slot distance and fixed it by ranking on normalised lap
progress, which cut leaderboard flicker by about 91%."
