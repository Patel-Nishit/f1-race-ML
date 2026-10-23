# 08 — The backend with FastAPI

```bash
python main.py serve            # http://127.0.0.1:8000
# open http://127.0.0.1:8000/docs for interactive API docs
```

## What we built

| Method + path | What it does |
|---------------|--------------|
| `GET /api/health` | "Is the server up?" |
| `GET /api/races` | Races that are prepared and ready to replay |
| `GET /api/seasons/{year}/events` | The season calendar, with each race's status |
| `GET /api/races/{year}/{round}/status` | `missing`, `preparing` (+ stage and progress), `ready` or `error` |
| `POST /api/races/{year}/{round}/prepare` | Start preparing a race in the background (202) |
| `GET /api/races/{year}/{round}/meta` | Drivers, colours, track outline, lap start times |
| `GET /api/races/{year}/{round}/telemetry/{code}` | One driver's speed/throttle/brake/gear/DRS for a time window |
| `GET /api/races/{year}/{round}/strategy` | Every driver's tyre stints (phase 7) |
| `GET /api/standings` | Live driver and constructor standings for the current season (from Jolpica, cached 30 min) |
| `WS /ws/replay/{year}/{round}` | The live replay stream (chapter 09) |

Files: `backend/app.py` (routes), `backend/jobs.py` (background preparation),
`backend/replay.py` (one viewer's session), `backend/ws.py` (the stream).

## Concept: HTTP and REST

The browser and the server talk over **HTTP**: the browser sends a *request*
(a method like `GET` or `POST`, plus a path) and gets a *response* (a status
code plus a body, here JSON).

**REST** is a convention for naming things: paths are *nouns*
(`/api/races/2024/2/meta`), and the method is the *verb*:

- `GET` reads and never changes anything, so it's safe to repeat.
- `POST` does something: here, start a preparation job.

Status codes tell the client what happened without reading the body:

| Code | Meaning | Where we use it |
|------|---------|-----------------|
| 200 | OK | Most reads |
| 202 | Accepted: started, not finished | `POST .../prepare` |
| 404 | Not found | Race not prepared, unknown driver |
| 422 | Your input is invalid | Round 99, session "Q" |
| 502 | An upstream service failed | FastF1 couldn't load the schedule |

## Concept: FastAPI basics

A route is a normal Python function with a decorator:

```python
@app.get("/api/races/{year}/{round_number}/status")
def race_status(year: int = Year, round_number: int = Round, session: SessionType = Session):
    return jobs.status(year, round_number, session)
```

FastAPI reads the **type hints** and does a lot of work for you:

- `year: int` turns `"2024"` from the URL into the number 2024.
- `Year = Path(ge=2018, le=2100)` rejects 2010 or 2200 with a 422 and a
  clear message. We never write that check by hand.
- `SessionType = Literal["R", "S"]` only accepts those two values.
- The return value (a dict or list) becomes JSON.
- It all appears in the generated docs at `/docs`, where you can try every
  endpoint in the browser.

## Concept: async, and why we use threads in some places

FastAPI runs on an **event loop**: one thread juggling many connections. A
function marked `async def` can pause at `await` and let other requests run.

The catch: slow *non-async* work (reading a 20 MB file, calling FastF1)
inside an `async def` **freezes every connection** until it's done. So we
hand that work to a thread:

```python
race = await run_in_threadpool(load_race_cached, year, round_number, session)
```

Rule of thumb: `async def` for waiting on the network, and a thread pool (or
a plain `def` route, which FastAPI runs in a thread for you) for blocking work.

## Concept: background jobs with progress

Preparing a race takes ~3 minutes, but browsers and proxies give up on a
request after ~30–60 s. So the work is split:

```
browser                    server                         child process
POST .../prepare  ───────► start Process ───────────────► prepare_race()
       ◄── 202 {"state": "preparing"}                          │ progress(...)
GET .../status (every 1 s)                                      │
       ◄── {"stage": "Extracting telemetry", "progress": 0.3} ◄─┘ via a Queue
```

Design choices in `backend/jobs.py`:

- **A separate process, not a thread.** The pipeline is CPU-heavy and starts
  its own process pool. If it crashes, the web server survives, and the job
  just shows `error`.
- **`spawn`, not `fork`.** Forking a server that has threads can copy a
  locked lock into the child and deadlock. Spawning starts a clean
  interpreter.
- **A Queue for progress.** Processes don't share memory. The child puts
  `("progress", stage, fraction)` messages on a queue, and a watcher thread
  copies them into the job's state.
- **A lock around the jobs dict.** Request handlers and watcher threads both
  touch it.
- **No duplicate jobs.** A second `POST` while one is running just returns
  its status.

Measured: preparing Australia 2024 through the API took 167 s. Meanwhile
`/api/health` kept answering instantly.

## Concept: CORS

The web app (port 3000) and the API (port 8000) are different **origins**. By
default a browser blocks a page from reading responses from another origin.
`CORSMiddleware` tells the browser that `http://localhost:3000` (and `http://127.0.0.1:3000`) is allowed.
Set `F1_CORS_ORIGINS` for a deployed site.

## Concept: columnar data pays off again

The telemetry endpoint returns one driver's data for a time window. With
columnar storage that's one slice per field:

```python
rows = slice(i0, i1, step)            # time window, thinned to max_points
a["speed"][rows, d]                   # this driver's speeds in that window
```

It returns **columns** (`{"t": [...], "speed": [...]}`), which is exactly
what chart libraries want, and is much smaller than a list of row objects.

## Testing the API

`tests/test_backend.py` uses FastAPI's `TestClient`, which calls the app
directly without starting a server. A fake 3-car race is saved to a temporary
folder (`tests/conftest.py`), and the `data_dir` fixture points the app at it.
The background-job tests swap in a fake `target` function, so they run in
under a second instead of three minutes.

## Exercises

1. Open http://127.0.0.1:8000/docs and call each endpoint from the browser.
2. Add `GET /api/races/{year}/{round}/results` returning the final
   classification from `meta["drivers"]`.
3. What happens if you `POST .../prepare` for a round that doesn't exist (e.g.
   2024 round 30)? Follow the error from the child process to `/status`.

## Interview angle

"The API is FastAPI with validated path and query parameters, proper status
codes and generated docs. Slow race preparation runs as a background job in a
separate spawned process that reports progress through a queue, so the
server stays responsive. Blocking I/O is pushed off the event loop with a
thread pool."
