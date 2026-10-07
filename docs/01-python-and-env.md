# 01 — Python, virtual environments and project layout

## What we built in Phase 1

- `src/lib/tyres.py` and `src/lib/time.py` — small helpers that `src/f1_data.py`
  imported but that didn't exist yet (so nothing could run).
- `src/__init__.py`, `src/lib/__init__.py` — empty files that mark folders as
  Python **packages**, so `from src.lib.tyres import ...` works.
- `main.py` — a command-line interface (CLI) with `list-rounds` and `prepare`.
- `requirements.txt` — the libraries the project needs.
- `.gitignore` — keeps caches and generated data out of git.

## Concept: the virtual environment (venv)

Different projects need different library versions. A **virtual environment**
is a private folder of Python libraries just for this project (`venv/`).

```bash
python3 -m venv venv              # create it (once)
source venv/bin/activate          # turn it on (each new terminal)
pip install -r requirements.txt   # install the libraries listed in the file
deactivate                        # turn it off
```

When it's active, your prompt shows `(venv)` and `python` means *this* project's
Python. You can also call it directly without activating: `venv/bin/python`.

`venv/` is in `.gitignore`: you never commit it. Anyone can recreate it from
`requirements.txt`.

## Concept: modules and packages

- A **module** is one `.py` file (`src/lib/time.py`).
- A **package** is a folder of modules with an `__init__.py` file (`src/lib/`).
- `from src.lib.time import format_time` means: in package `src`, sub-package
  `lib`, module `time`, get the function `format_time`.

Imports are resolved from the folder you run Python in. That's why we always
run commands from the project root: `python main.py ...`.

## Concept: a CLI with argparse

`main.py` uses Python's built-in `argparse` to turn

```bash
python main.py prepare --year 2024 --round 1
```

into an object `args` with `args.year == 2024` and `args.round == 1`.
**Sub-commands** (`prepare`, `list-rounds`, later `serve` and `desktop`) each get
their own options and a function to run (`set_defaults(func=...)`).

Notice the imports inside each command function (`from src.f1_data import ...`).
FastF1 and pandas are slow to import; doing it lazily keeps `--help` instant.

## Walkthrough: `src/lib/tyres.py`

Numpy arrays hold numbers, not strings, so we turn tyre names into integers:

```python
TYRE_COMPOUNDS = ["UNKNOWN", "SOFT", "MEDIUM", "HARD", "INTERMEDIATE", "WET"]
get_tyre_compound_int("MEDIUM")   # -> 2
get_tyre_compound_name(2.4)       # -> "MEDIUM"  (rounds interpolated values)
```

Missing data in pandas is `NaN` (a float, not a string), which is why
`get_tyre_compound_int` checks `isinstance(compound, str)` first.

## Walkthrough: `src/lib/time.py`

pandas prints time spans like `0 days 00:01:31.447000`. A **regular expression**
(`re` module) picks that string apart into days, hours, minutes and seconds.
`format_time` goes the other way: `91.447 -> "1:31.447"`, or with
`decimals=0`, `3733 -> "1:02:13"` for the race clock.

## Exercises

1. Run `python main.py --help` and `python main.py prepare --help`.
2. In a Python shell, try `format_time(5025.3, 0)` and `parse_time_string("1:05.2")`.
3. Add a `--verbose` flag to `prepare` that prints each driver's lap count.

## Interview angle

"I structured the project as packages with a thin CLI on top, pinned
dependencies in `requirements.txt`, and kept generated data out of version
control."
