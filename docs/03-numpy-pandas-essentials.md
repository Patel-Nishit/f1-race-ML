# 03 — numpy & pandas essentials

You only need a handful of ideas to read every line of our data core. Each one
below is shown with the place we use it.

## pandas: tables

FastF1 hands us **DataFrames** — tables with named columns.

```python
laps = session.laps                       # one row per driver per lap
laps["LapTime"]                           # one column (a Series)
laps[laps["PitInTime"].notna()]           # filter rows: laps that ended in the pits
laps.pick_drivers("VER")                  # FastF1 helper: one driver's laps
for _, lap in laps.iterrows(): ...        # loop rows (slow; fine for ~1,000 laps)
```

Missing values are `NaN` (numbers) or `NaT` ("not a time"). Check them with
`pd.isna(x)` or `.notna()`. Never compare with `== NaN`; it is always False.

**Timedeltas.** Times like `SessionTime` are durations. We turn them into plain
seconds as soon as possible, because numpy works on numbers:

```python
seconds = lap_tel["SessionTime"].dt.total_seconds().to_numpy()
```

`.to_numpy()` is the bridge from pandas to numpy.

## numpy: arrays

A numpy array is a block of numbers of the same type, stored side by side in
memory. That's why it's fast.

```python
import numpy as np
speed = np.array([280.0, 290.5, 301.2])
speed * 1000 / 3600          # km/h -> m/s, all at once ("vectorised")
speed.max(), speed.mean()
```

**Vectorisation** means doing an operation on a whole array at once instead of
in a Python `for` loop. It's often 10–100× faster. Most of the pipeline is
written this way.

### Shapes and axes

Our race arrays are 2-D: `(frames, drivers)`, e.g. `(55983, 20)` for Bahrain.

```python
speed[1800]           # all 20 drivers at frame 1800  -> shape (20,)
speed[:, 3]           # driver #3 for the whole race   -> shape (55983,)
speed[1000:1100]      # 10 seconds of everyone          -> shape (100, 20)
speed.max(axis=0)     # top speed of each driver        -> shape (20,)
```

`axis=0` means "collapse the frames", `axis=1` "collapse the drivers".

### Broadcasting

Arrays of different shapes combine if their sizes line up. We use it to
compare every frame's time with every driver's retirement time:

```python
t = timeline[:, np.newaxis]         # (frames, 1)
t_out = np.array([...])             # (drivers,)
out = t >= t_out                    # (frames, drivers)  True once retired
```

### Boolean masks and `np.where`

```python
mask = track_status == 4                  # True where the safety car is out
np.where(out, progress - 1e6, progress)   # pick per element: if out, push to the back
```

### Sorting and ranking

`np.argsort` returns the *indices* that would sort an array. Using it twice
turns an order into ranks. This is how `compute_positions` works:

```python
key   = np.array([1.2, 3.5, 2.0])   # progress of cars 0, 1, 2
order = np.argsort(-key)            # [1, 2, 0]  car 1 leads, then 2, then 0
ranks = np.argsort(order) + 1       # [3, 1, 2]  car 0 is P3, car 1 P1, car 2 P2
```

### Interpolation

`np.interp(x_new, x_known, y_known)` draws straight lines between known points
and reads off values at new x positions. It is the heart of resampling
(chapter 04).

```python
np.interp([0.5, 1.5], [0, 1, 2], [0, 10, 20])   # -> [5., 15.]
```

`np.searchsorted(sorted, values)` finds where each value would be inserted
into a sorted array. We use it for "the most recent sample before time t".

### dtypes

Every array has one type: `float64` (8 bytes), `float32` (4), `int16` (2),
`int8` (1). A gear (0–8) fits in `int8`, which uses 1/8 the memory of
`float64`. `race_store.py` chooses a dtype per field.

## Exercises

1. Load a race: `from src.race_store import load_race; r = load_race(2024, 1)`.
   Print `r.arrays["speed"].shape` and `r.arrays["speed"].dtype`.
2. Which driver had the highest top speed? (Hint: `max(axis=0)`, then
   `r.codes[...]` with `argmax`.)
3. How many seconds did VER spend above 300 km/h? (Hint: a boolean mask,
   `.sum()`, and divide by `r.meta["fps"]`.)

## Interview angle

"I wrote the pipeline in a vectorised style with numpy: 2-D arrays of
frames × drivers, broadcasting for per-driver thresholds, and argsort-based
ranking, so the whole race is processed without slow Python loops."
