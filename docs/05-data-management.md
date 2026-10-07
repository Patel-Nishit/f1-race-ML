# 05 — Data management: caching and columnar storage

"Data management" here means three practical questions: **where does data
live, in what shape, and how do we avoid redoing slow work?**

## Three cache layers

| Layer | Where | Cost to rebuild | Saves us from |
|-------|-------|-----------------|---------------|
| 1. FastF1 cache | `.fastf1-cache/` | Minutes (download) | Re-downloading raw data |
| 2. Prepared race | `computed_data/2024_01_R.npz` + `.json` | ~3 min (pipeline) | Re-running extraction and resampling |
| 3. In-memory | `load_race_cached()` (`functools.lru_cache`) | ~1 s (file read) | Re-reading the file for every viewer |

Each layer is faster than the one before it and is checked first. This
"check the cache, otherwise compute and store" idea is everywhere in real
systems (CDNs, databases, browsers).

Layer 3 uses an **LRU** (least recently used) cache with `maxsize=4`. The four
most recently opened races stay in memory, and opening a fifth drops the one
nobody has used for longest. That bounds memory to about 4 × 40 MB.

Both cache folders are in `.gitignore`. Generated data never goes in git:
anyone can regenerate it, and it would bloat the repository.

## Rows vs columns

The original code stored **rows**: a Python list with one dict per frame, each
holding a dict per driver:

```python
frames[1800]["drivers"]["VER"]["speed"]   # row-oriented
```

We now store **columns**: one array per field, shaped `(frames, drivers)`:

```python
arrays["speed"][1800, ver_index]           # column-oriented
```

| | Rows (list of dicts) | Columns (numpy arrays) |
|---|---|---|
| Memory per number | A Python float object + dict entry (dozens of bytes) | 1–4 bytes |
| "VER's speed all race" | Loop over 140k dicts | One slice: `speed[:, j]` |
| "Everyone at 1800 s" | One lookup | One slice: `speed[i]` |
| Readable by other languages | No (pickle is Python-only) | Yes |

Analytics databases (BigQuery, Parquet files, DuckDB) are columnar for the
same reason: most questions read a few fields across many rows.

### Measured on Bahrain 2024

| Version | Frames | File size |
|---------|--------|-----------|
| Original: 25 Hz, list of dicts, pickle | 139,957 | **322 MB** |
| New: 10 Hz, columnar, compressed `.npz` | 55,983 | **20.2 MB** |

In memory, the new arrays take 39.9 MB. Back-of-envelope check: 55,983 frames ×
20 drivers × (7 float32 fields × 4 bytes + 1 int16 × 2 + 4 int8 × 1) ≈ 38 MB,
plus a few per-frame arrays. Doing this kind of size maths before building
something is a great habit.

## The file format: `.npz` + JSON

- **`.npz`** is numpy's zip of arrays. `np.savez_compressed` compresses it.
  We load with `allow_pickle=False`, so the file can only contain plain
  numbers.
- **JSON** holds the small, structured metadata: drivers, colours, track
  outline, retirements, status changes. It's human-readable; open
  `computed_data/2024_01_R.json` in your editor.

**Why not pickle?** `pickle.load` can execute arbitrary code hidden in the
file. It's fine for files you made yourself, but a bad habit for anything
shared or downloaded. It's also Python-only, and the web app's backend will
read these files from many places.

## dtypes per field

`race_store.py` lists each field with the smallest type that fits it:

```python
"speed": np.float32,   # needs decimals; float32 has ~7 significant digits
"lap":   np.int16,     # up to 32,767
"gear":  np.int8,      # 0..8
"tyre":  np.int8,      # 0..5
```

`float64` → `float32` halves the size with no visible loss for positions in
decimetres or speeds in km/h.

## Naming and keys

`race_key(2024, 1, "R") == "2024_01_R"`. A predictable key means every part of
the system (CLI, desktop app, API) finds the same file without searching. The
old filename contained spaces and a colon (`Round_1:_Bahrain`), which is
illegal on Windows.

## Exercises

1. Compare `du -h computed_data/` with `du -h .fastf1-cache/`. Which layer is
   bigger, and why?
2. Time `load_race(2024, 1)` versus `load_race_cached(2024, 1)` called twice
   (`import time; time.perf_counter()`).
3. Try saving with `np.savez` (uncompressed). How much bigger is it? When
   might you choose speed over size?

## Interview angle

"I replaced a 322 MB row-oriented pickle with a 20 MB compressed columnar
format, chose per-field dtypes, and added a three-layer cache: raw API data,
prepared races on disk, and an in-memory LRU. I also moved off pickle for
safety and language independence."
