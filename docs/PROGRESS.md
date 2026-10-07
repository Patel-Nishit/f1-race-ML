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
- [x] **Phase 4 — FastAPI backend + WebSocket stream.** `python main.py serve`.
  REST (races, calendar, status, prepare, meta, telemetry) + `/ws/replay`.
  Background preparation in a spawned process with progress (Australia 2024
  prepared via the API in 167 s). Compact frames (1.5 KB, 10/s at any
  speed), acks for commands (1.9 ms seek), silent when paused. 59 tests.
  *Learned:* HTTP/REST, status codes, FastAPI validation, async vs threads,
  background jobs, processes & queues, CORS, WebSockets, protocol design,
  backpressure.
- [x] **Phase 5 — Next.js skeleton + track canvas.** `web/`: Next.js 16 +
  TypeScript + Tailwind + Zustand. Race picker with prepare + progress
  polling; replay page with WebSocket client (acks, reconnect with backoff,
  resume), 60 fps canvas with interpolation. 10 vitest tests; Playwright
  end-to-end checks incl. killing the server mid-replay.
  *Learned:* TypeScript, React components/state/effects, race conditions,
  Zustand selectors, App Router, Suspense & Cache Components, canvas,
  requestAnimationFrame, interpolation, reconnect strategies.
- [x] **Phase 6 — Web HUD (leaderboard, clock, controls, legend, OUT).**
  Top bar (lap, clock, status, speed, connection), SC/VSC/red banner,
  animated leaderboard with tyres/OUT/+N LAP/DRS, controls + scrubbable
  timeline with SC bands, keyboard shortcuts, legend, click-to-select on
  leaderboard and map. Fixed "+1 LAP" bug (now matches official results for
  3 races). 15 vitest + 61 pytest; 16-check browser test, stable over 9 runs.
  *Learned:* CSS grid areas, layout (FLIP) animations, pointer events and
  drag, keyboard handling and focus, accessibility basics, flaky tests.
- [x] **Phase 7 — Safety car, Insights menu, Telemetry panel.** Insights menu
  (auto-opens) with driver telemetry, speed trace, tyre strategy, gaps to
  leader, race control & weather; SC glow + fades on the map. Backend: gap to
  leader (time at the same place), real tyre stints (15 Hard→Hard stops in
  Australia), `/strategy` endpoint. Fixed: shortcuts dead after ticking a
  checkbox. 65 pytest, 22 vitest; browser suites 20/20 and 16/16, stable.
  *Learned:* chart design rules, palette validation & secondary encoding,
  WCAG contrast, inverse interpolation, abort controllers, derived state,
  canvas alpha.
- [x] **Phase 8 — Polish, deploy, resume.** Deployment-ready API (`Dockerfile`
  that bakes in demo races, `render.yaml`, `requirements-api.txt`, `PORT`/
  `HOST`, CORS regex, prepare switch); web shows "Not in this demo";
  packaged Playwright suite in `e2e/` (15 tests, passing against a
  production build); GitHub Actions CI; README with demo GIF; deployment
  guide, resume bullets and interview prep (chapter 14). Not verified here:
  `docker build` (no Docker in this environment).
  *Learned:* serverless vs long-running servers, containers, build-time vs
  runtime config, CORS in production, securing expensive endpoints, CI.

- [x] **Redesign ("pit wall").** Audit and plan first (docs/REDESIGN_PLAN.md),
  then foundations (light + dark tokens, contrast-checked), race picker
  (live mini-replay hero, bento, grouped calendar) and replay (full-bleed
  track, floating panels, phone layout). Taste pre-flight recorded per page.
  *Learned:* design tokens, WCAG contrast, responsive layout, measuring
  rendering cost, CSS pipeline quirks, keeping tests honest during a redesign.

## Open questions

- ~~Public live demo or local + recording?~~ Decided: web on Vercel, API on a container host (chapter 14).
