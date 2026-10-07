# 14 — Deployment and your resume

## Part 1: Deploying

### Why two hosts?

| Part | Needs | Where |
|------|-------|-------|
| Web app (`web/`) | Static pages + a little server rendering | **Vercel** (made by the Next.js team, generous free tier) |
| API (`backend/`) | A **long-running** process: WebSocket connections that stay open for a whole race, ~40 MB of arrays in memory | A container host: **Render**, **Fly.io** or **Railway** |

Vercel runs your server code as short-lived *serverless functions*: they
start per request and stop soon after, which doesn't suit a WebSocket that
streams for 90 minutes. That's why the API lives elsewhere.

**Deploy the API first** (the web app needs its URL), then the web app, then
tell the API the web app's URL (CORS).

### Step 1: the API (Render example)

The repo includes a `Dockerfile` and a Render blueprint (`render.yaml`).

1. Push the repo to GitHub.
2. Render → **New + → Blueprint** → pick the repo. It reads `render.yaml` and
   builds the `Dockerfile`.
3. The build **prepares the demo races inside the image** (default: 2024
   rounds 1–3). Expect a **10–15 minute** first build: each race is downloaded
   from F1's timing archive and processed. Change the races with the
   `DEMO_RACES` build argument (e.g. `"2024:1 2023:22"`).
4. When it's live, open `https://<your-api>.onrender.com/api/health`. You
   should see `{"status":"ok","prepare_enabled":false}`.

**Alternatives** with the same `Dockerfile`: Fly.io (`fly launch`, then
`fly deploy`; it detects the Dockerfile) or Railway (new project from the
repo). Both support WebSockets.

**Things to know about free tiers** (check each provider's current limits;
they change):

- Free services often **sleep when idle** and take a while to wake up on the
  first visit. A visitor sees "Connecting…", then it works.
- Memory is small (often 512 MB). This API uses roughly 40 MB per loaded
  race plus Python itself, and keeps at most 4 races in memory (the LRU cache).
- Build machines may have little RAM, which is why the Dockerfile sets
  `F1_WORKERS=2`: each parallel worker holds a copy of the session.

### Step 2: the web app (Vercel)

1. Vercel → **Add New → Project** → import the GitHub repo.
2. **Root Directory: `web`**. The framework is detected as Next.js.
3. **Environment variable:** `NEXT_PUBLIC_API_URL = https://<your-api>.onrender.com`
   (no trailing slash). The WebSocket URL is derived from it (`https` →
   `wss`).
4. Deploy. Note: `NEXT_PUBLIC_` values are baked in **at build time**, so if
   you change the API URL later, redeploy the web app.

### Step 3: connect them (CORS)

On the API host, set:

| Variable | Value |
|----------|-------|
| `F1_CORS_ORIGINS` | `https://<your-app>.vercel.app` (comma-separate several) |
| `F1_CORS_ORIGIN_REGEX` | `https://.*\.vercel\.app` to also allow Vercel preview deployments |

Restart the API. Open your Vercel URL: the race picker shows the demo races
as **Watch replay**, and the rest say "Not in this demo".

### Step 4: check it

```bash
curl https://<your-api>.onrender.com/api/races          # the shipped races
E2E_WEB_URL=https://<your-app>.vercel.app \
E2E_API_URL=https://<your-api>.onrender.com \
  .venv-e2e/bin/python -m pytest e2e                     # the browser suite, against production
```

(The e2e suite expects Saudi Arabia 2024, round 2, to be one of the demo races.)

### All settings

| Variable | Where | Default | Purpose |
|----------|-------|---------|---------|
| `NEXT_PUBLIC_API_URL` | web (build time) | `http://127.0.0.1:8000` | Where the browser finds the API |
| `HOST`, `PORT` | API | `127.0.0.1`, `8000` | Hosts set `PORT`; the Dockerfile sets `HOST=0.0.0.0` |
| `F1_CORS_ORIGINS` | API | `http://localhost:3000` | Sites allowed to call the API |
| `F1_CORS_ORIGIN_REGEX` | API | none | Pattern of extra allowed sites |
| `F1_ALLOW_PREPARE` | API | `true` (`false` in Docker) | Whether visitors may prepare new races |
| `F1_DATA_DIR` | API, CLI | `computed_data` | Where prepared races live |
| `F1_WORKERS` | CLI, API | CPU count | Cap on parallel extraction processes |

### Security decisions

- **Preparation is off in production.** Preparing a race costs minutes of
  CPU and hundreds of MB of downloads. An open endpoint would let anyone
  exhaust the server. The public deployment replays only the races baked into
  the image, and the UI says so instead of showing broken buttons.
- **CORS is an allow-list,** not `*`.
- **Inputs are validated** (year, round, session, every WebSocket command),
  and prepared data is loaded with `allow_pickle=False`.
- **No secrets** exist anywhere in this project.

### What was verified before shipping (and what wasn't)

| Check | Result |
|-------|--------|
| Slim API environment (`requirements-api.txt` only, no Arcade) prepares a race with `F1_WORKERS=2` | ✅ 195 s |
| Same environment serves in "public mode" (`HOST=0.0.0.0`, `PORT`, prepare disabled, CORS from env) | ✅ prepare → 403, health reports it |
| Production web build with `NEXT_PUBLIC_API_URL`, full browser suite against it | ✅ 15/15, three runs |
| Python CI job on a clean export with a fresh environment | ✅ (see chapter 13) |
| Web typecheck on a clean checkout | ✅ after fixing: route types must be generated first (`next typegen`) |
| `docker build` itself | ❌ not run: Docker isn't available in this environment. The steps were checked individually above; the first real build happens on your host |

## Part 2: Your resume

### Project line (resume / LinkedIn)

> **F1 Race Replay**: full-stack replay of any Formula 1 race since 2018,
> streaming 20-car telemetry over WebSockets to a 60 fps canvas web app and a
> desktop client. Python · FastAPI · numpy · Next.js · TypeScript ·
> WebSockets · Playwright. *(link to GitHub + live demo)*

### Bullet points (pick 3–4)

- Built a **real-time replay system** for Formula 1 races: a FastAPI server
  streams 20-car telemetry over **WebSockets at 10 Hz**, rendered at **60 fps**
  in a Next.js/TypeScript canvas app with client-side interpolation.
- Designed an **ETL pipeline** over official timing data (FastF1, pandas,
  numpy, multiprocessing), with columnar compressed storage that **cut race
  files 16× (322 MB → 20 MB)** and a three-layer cache.
- Designed a **compact streaming protocol** (positional rows + schema
  handshake, **2.3× smaller frames**, fixed send rate at any playback speed)
  with command acknowledgements, plus a client that **reconnects with
  exponential backoff and resumes in place**.
- **Validated derived data against official results** (grid order, final
  classification, lapped cars across three races), finding and fixing two
  systematic ranking biases. Modelled the missing safety-car position as a
  state machine.
- Shipped with **129 automated test runs** (pytest, Vitest, and Playwright
  end-to-end in light and dark themes, including live WCAG contrast checks and
  killing the server mid-replay), CI on GitHub Actions, and a
  Dockerised API deployed separately from the Vercel front end.

*(Swap in your own numbers if you add races or features. Every number above
is measured in this guide.)*

### A 60-second demo script

1. Race picker: "Any season since 2018. Prepared races open instantly."
2. Open Saudi Arabia 2024, then press **L**: "Every control has a keyboard shortcut."
3. Drag the timeline into the orange band: "The safety car period. It comes out
   of the pit lane, leads the field, and the gaps shrink to a couple of seconds."
4. Click NOR and VER: "Live telemetry, and a speed trace. Teammates share a
   colour, so the second line is dashed."
5. Tick **Tyre strategy**: "Built from the official stint data, and spoiler-free:
   it only shows laps that have happened."
6. "The browser just renders; the server owns the clock and streams it. If I
   kill the server, the page reconnects and resumes at the same moment."

### Interview questions you should be ready for

**Why WebSockets instead of polling?** The race updates 10 times a second.
Polling would need 10 requests a second per viewer, each with HTTP overhead
and up to 100 ms of extra delay. A WebSocket is one open connection where the
server pushes the moment data exists. We *do* poll for one thing, preparation
progress, because it changes slowly and only while a job runs.

**Why does the server own the playback clock?** One source of truth. The
browser sends intentions ("seek to 2000 s"); the server's frames are the
state. It's how real live-timing systems work, and it makes a future "watch
party" (shared sessions) a small change.

**How do you keep motion smooth with 10 updates a second?** Entity
interpolation: keep the last two frames and draw between them, by the time
elapsed since the latest arrived, divided by the measured interval. We show
the race ~100 ms late in exchange for perfectly smooth motion. After a seek
we snap instead of interpolating.

**What happens if a frame arrives after the user seeks?** Every command
carries an id that the server echoes as `ack`. Until a frame with that ack
arrives, the client ignores older frames, so cars never jump backwards. If
no ack arrives within 1.5 s, it stops waiting.

**What if the network is slow?** The server advances the clock by measured
wall time and sends at a fixed rate, so a slow client gets skipped frames,
not a growing queue. Memory stays bounded and the replay never drifts.

**Why columnar storage?** Most questions read one field across many frames
("VER's speed for the last 60 s"), which is one array slice. Rows of dicts
also cost dozens of bytes per number in Python. We measured 322 MB → 20 MB.

**How did you know your positions were right?** Unit tests prove the code
does what I *think*; to check it's actually right, I compared against
official data. That caught two real bugs: a ~150 m grid-slot bias that
lasted the whole race, and the last finisher being one frame short of
"finished".

**How do you compute the gap to the leader?** As time at the same place on
track: when did the leader reach the point this car is at now? The leader's
progress over time never decreases, so it can be inverted with `np.interp`.

**The API doesn't give the safety car's position. What did you do?** Modelled
it: a state machine (deploying, leading, returning) that follows the track
line from the pit exit, 200 m ahead of the leader, back to the pit entry. The
pit lane itself is the median car position at real pit-in/pit-out times. I
documented the model's limits.

**How did you test the UI?** Pure logic (shortcuts, interpolation, ack
handling, chart maths) is unit-tested. Then Playwright drives a real browser:
every shortcut, dragging the timeline (exactly one seek is sent), the safety
car fade, killing the server mid-replay. Flaky tests were fixed by polling for
conditions instead of fixed sleeps.

**What would you do next?** A live mode from a real-time feed (the protocol
wouldn't change), shared watch-party sessions, persistent storage instead of
baking races into the image, and pit-lane indicators.

**What was the hardest bug?** A good honest answer: "+1 LAP for every car"
right after the leader crossed the line (comparing lap *numbers* instead of
progress). The fix then revealed telemetry stopping a few metres short of the
line, so exactly-one-lap-down cars measured 0.996 laps behind. I added a
tolerance and checked it against the official classification for three races.

### Before you share it

- [ ] Add a licence (MIT is common for portfolio projects) if you want others
  to reuse the code. Also check the licence of the original *f1-race-replay*
  project the first pipeline was adapted from, and link it in the README
  credits.
- [ ] Put the live demo link and the GIF at the top of the GitHub README
  (already in place; add the URL).
- [ ] Pin the repository on your GitHub profile.
- [ ] Practise the 60-second demo out loud.
