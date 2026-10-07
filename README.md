# F1 Race Replay

Replay any Formula 1 race since 2018: every car on a drawn track, live
leaderboard with tyres, safety car, retirements, playback controls and driver
telemetry. One Python data pipeline (FastF1 + numpy) feeds two viewers: an
Arcade desktop app and a Next.js web app streamed over WebSockets.

| Desktop (Arcade) | Web (Next.js) |
|---|---|
| ![Desktop viewer](docs/images/desktop-safety-car.png) | ![Web replay](docs/images/web-replay.png) |

**Status:** data pipeline, desktop viewer, streaming API and web replay HUD done (phases 1–6 of 8). See [docs/PROGRESS.md](docs/PROGRESS.md).

## Quick start

```bash
python3 -m venv venv && source venv/bin/activate
pip install -r requirements.txt
python main.py list-rounds --year 2024
python main.py prepare --year 2024 --round 2
python main.py desktop --year 2024 --round 2
python main.py serve        # API + WebSocket on :8000, docs at /docs
cd web && npm install && npm run dev   # web app on http://localhost:3000
python -m pytest            # and: cd web && npm test
```

## Learning guide

The project doubles as a course: see [docs/README.md](docs/README.md).
