# Progress

- [x] **Phase 1 — Make the existing code run.** Added `src/lib/tyres.py`,
  `src/lib/time.py`, package `__init__` files, `main.py` CLI (`list-rounds`,
  `prepare`), updated `requirements.txt` and `.gitignore`.
  *Learned:* venvs, packages & imports, argparse, FastF1 basics, caching.
- [x] **Phase 2 — Data core refactor.** `prepare_race()` pipeline; new modules
  `transform.py`, `track.py`, `race_status.py`, `safety_car.py`,
  `race_store.py`; 29 pytest tests. Bahrain file 322 MB → 20.2 MB; start and
  finish order verified against grid and official results; Saudi 2024 safety
  car and OUT drivers verified.
  *Learned:* numpy vectorisation & broadcasting, resampling, ETL,
  multiprocessing, columnar storage, caching layers, state machines, easing,
  testing with synthetic data, validating against reality.
- [x] **Phase 3 — Arcade desktop viewer.** `python main.py desktop`. Shared
  `src/playback.py` + `src/snapshot.py`; track, cars, SC glow, leaderboard
  with tyres/OUT, lap & clock, status banner, buttons + timeline, keyboard
  shortcuts, legend, Insights menu, telemetry cards. 44 tests incl. simulated
  input. Profiled 22 → 26 fps (41 with `--no-antialias`) on GPU-less WSL.
  *Learned:* game loop, interpolation, coordinate transforms, hitboxes,
  draw calls, batching, sprite lists, profiling.
- [ ] **Phase 4 — FastAPI backend + WebSocket stream.**
- [ ] **Phase 5 — Next.js skeleton + track canvas.**
- [ ] **Phase 6 — Web HUD (leaderboard, clock, controls, legend, OUT).**
- [ ] **Phase 7 — Safety car, Insights menu, Telemetry panel.**
- [ ] **Phase 8 — Polish, deploy, resume.**

## Open questions

- Public live demo (Vercel + hosted API), or local + screen recording?
