# 00 — The big picture

## What we're building

An **F1 race replay**: pick a past race and watch all 20 cars move around a
drawn track, with a live leaderboard, tyre compounds, lap counter, race clock,
safety car, retired drivers marked OUT, playback controls and per-driver
telemetry (speed, gear, DRS).

There are **two viewers** that share one Python "data core":

- a **desktop app** built with Python's Arcade game library, and
- a **web app** built with Next.js (React + TypeScript), fed by a FastAPI server.

## How data flows

```
FastF1 (F1's official timing archive)          <- "the API"
   |  downloads, cached in .fastf1-cache/      (cache layer 1)
   v
src/  — Python data core
   extract each driver's telemetry (in parallel)
   resample everything onto one 10 Hz clock
   compute positions, retirements, safety-car path
   |  saved to computed_data/*.npz + meta.json  (cache layer 2)
   v
+-----------------------------+------------------------------+
| desktop/  Arcade app        | backend/  FastAPI            |
| reads the files directly    | REST + WebSocket stream      |
+-----------------------------+--------------+---------------+
                                             v
                               web/  Next.js app (canvas + panels)
```

**Rule of thumb:** everything slow happens *once*, in the data core. Viewers
only read the saved result, so they're fast and always agree with each other.

## Why "replay" and not truly live?

Real-time F1 data needs a paid feed and only exists during race weekends —
hard to develop against. Instead, the backend **streams a past race over a
WebSocket exactly as if it were live**. You still learn every live-data skill:
push vs. poll, buffering, interpolation, sequence numbers, reconnects.

## Glossary

| Term | Plain meaning |
|------|---------------|
| API | A program you ask for data. FastF1 is our gateway to F1 timing data. |
| Session | One on-track event: Race (`R`), Qualifying (`Q`), Sprint (`S`). |
| Telemetry | Car sensor data over time: speed, gear, throttle, brake, DRS, X/Y. |
| Frame | One snapshot of every car at one instant. |
| FPS / Hz | Frames (or samples) per second. |
| Resampling | Re-measuring uneven data onto an even clock. |
| Interpolation | Estimating a value between two known samples. |
| Cache | A saved copy so we don't redo slow work. |
| Columnar storage | One array per field, instead of one record per moment. |
| REST | Request/response over HTTP, e.g. `GET /api/races/2024/1`. |
| WebSocket | A connection that stays open so the server can push data. |
| Canvas | A browser element you draw pixels on with JavaScript. |
| Track status | Flag state: 1 green, 2 yellow, 4 Safety Car, 5 red, 6 VSC, 7 VSC ending. |
| DRS | Drag Reduction System. In FastF1 data, values ≥ 10 mean the flap is open. |

## Interview pitch (30 seconds)

> "I built an F1 race replay with a Python data pipeline and two front ends.
> The pipeline pulls official timing data with FastF1, resamples 20 cars'
> telemetry onto a common 10 Hz timeline in parallel, and stores it in a
> columnar format. A FastAPI server streams it over WebSockets like a live
> feed, and a Next.js canvas app renders it at 60 fps with interpolation.
> I also built an Arcade desktop viewer on the same data core."
