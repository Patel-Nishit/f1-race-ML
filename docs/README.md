# F1 Race Replay — Learning Guide

This folder is a step-by-step course built around this project. Each chapter
explains **what we built, why, the concepts from zero, the real code, exercises,
and how to talk about it in an interview**.

A hosted copy (same content, easier to share) lives at:
https://claude.ai/code/artifact/45446912-d41f-4b9f-b819-757b967892df

## Chapters

| # | Chapter | Phase |
|---|---------|-------|
| 00 | [The big picture](00-big-picture.md) | all |
| 01 | [Python, virtual environments and project layout](01-python-and-env.md) | 1 |
| 02 | [F1 data and FastF1](02-f1-data-and-fastf1.md) | 1 |
| 03 | [numpy & pandas essentials](03-numpy-pandas-essentials.md) | 2 |
| 04 | [The data pipeline (ETL)](04-data-pipeline.md) | 2 |
| 05 | [Data management: caching, columnar storage](05-data-management.md) | 2 |
| 06 | [Safety car & race status modelling](06-safety-car-and-race-status.md) | 2 |
| 07 | [Arcade desktop viewer](07-arcade-desktop.md) | 3 |
| 08 | [Backend with FastAPI](08-backend-fastapi.md) | 4 |
| 09 | [Real-time data with WebSockets](09-real-time-websockets.md) | 4 |
| 10 | [Next.js, React & TypeScript](10-nextjs-react-typescript.md) | 5 |
| 11 | [Canvas rendering & animation](11-canvas-rendering-and-animation.md) | 5–7 |
| 12 | [UI features (the HUD)](12-ui-features.md) | 6–7 |
| 13 | [Testing & debugging](13-testing-and-debugging.md) | all |
| 14 | Deployment & your resume | 8 |

Chapters without links are written when we reach that phase.
Track progress in [PROGRESS.md](PROGRESS.md).

## How to run (so far)

```bash
source venv/bin/activate          # Windows: venv\Scripts\activate
pip install -r requirements.txt
python main.py list-rounds --year 2024
python main.py prepare --year 2024 --round 1   # Bahrain: no SC, no retirements
python main.py prepare --year 2024 --round 2   # Saudi Arabia: safety car + 2 OUT
python main.py desktop --year 2024 --round 2   # open the desktop replay
python main.py serve                           # API on :8000, docs at /docs
cd web && npm install && npm run dev           # web app on :3000 (needs the API running)
python -m pytest                               # run the tests
```

Prepared races land in `computed_data/` as `2024_01_R.npz` + `2024_01_R.json`.
