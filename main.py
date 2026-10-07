"""F1 Race Replay command-line entry point.

Usage:
    python main.py list-rounds --year 2024
    python main.py prepare --year 2024 --round 1 [--refresh-data]
    python main.py desktop --year 2024 --round 2 [--start 600 --speed 4]
    python main.py serve [--port 8000 --reload]
"""

import argparse
import os
import time

from rich.console import Console

console = Console()


def cmd_list_rounds(args):
    from src.f1_data import list_rounds
    list_rounds(args.year)


def cmd_prepare(args):
    from src.f1_data import prepare_race
    from src.race_store import race_paths

    start = time.perf_counter()
    console.print(f"[bold]Preparing {args.year} round {args.round} ({args.session})...[/bold]")
    race = prepare_race(args.year, args.round, args.session, refresh=args.refresh_data)
    elapsed = time.perf_counter() - start

    meta = race.meta
    npz_path, _ = race_paths(args.year, args.round, args.session)
    size_mb = npz_path.stat().st_size / 1e6
    memory_mb = sum(a.nbytes for a in race.arrays.values()) / 1e6
    sc_frames = int((race.arrays["sc_state"] > 0).sum())
    console.print(
        f"[green]Done in {elapsed:.1f}s[/green] - {meta['event_name']}: "
        f"{race.n_frames} frames ({meta['fps']} Hz), {meta['total_laps']} laps, "
        f"{len(meta['drivers'])} drivers"
    )
    console.print(f"File {size_mb:.1f} MB on disk, {memory_mb:.1f} MB in memory")
    console.print(f"Retired (OUT): {meta['retirements'] or 'none'}")
    console.print(f"Safety car on screen for {sc_frames / meta['fps']:.0f}s")


def cmd_desktop(args):
    from src.f1_data import prepare_race
    from desktop.replay_window import run

    race = prepare_race(args.year, args.round, args.session)
    selected = [c.strip().upper() for c in args.select.split(",")] if args.select else None
    run(race, start=args.start, speed=args.speed, selected=selected,
        screenshot=args.screenshot, show_legend=args.legend, antialias=not args.no_antialias)


def cmd_serve(args):
    import uvicorn

    console.print(f"[bold]API on http://{args.host}:{args.port}[/bold]  (docs: /docs)")
    uvicorn.run("backend.app:app", host=args.host, port=args.port, reload=args.reload)


def build_parser():
    parser = argparse.ArgumentParser(description="F1 Race Replay")
    sub = parser.add_subparsers(dest="command", required=True)

    p = sub.add_parser("list-rounds", help="List the rounds of a season")
    p.add_argument("--year", type=int, required=True)
    p.set_defaults(func=cmd_list_rounds)

    p = sub.add_parser("prepare", help="Download and pre-compute a race")
    p.add_argument("--year", type=int, required=True)
    p.add_argument("--round", type=int, required=True)
    p.add_argument("--session", default="R", choices=["R", "S"])
    p.add_argument("--refresh-data", action="store_true", help="Recompute even if already prepared")
    p.set_defaults(func=cmd_prepare)

    p = sub.add_parser("desktop", help="Open the Arcade desktop replay")
    p.add_argument("--year", type=int, required=True)
    p.add_argument("--round", type=int, required=True)
    p.add_argument("--session", default="R", choices=["R", "S"])
    p.add_argument("--start", type=float, default=0.0, help="Start at this many seconds")
    p.add_argument("--speed", type=float, default=1.0, help="Playback speed, e.g. 4")
    p.add_argument("--select", help="Drivers to show telemetry for, e.g. VER,NOR")
    p.add_argument("--legend", action="store_true", help="Open with the legend shown")
    p.add_argument("--no-antialias", action="store_true",
                   help="Faster on machines without a GPU (e.g. WSL), slightly jaggier edges")
    p.add_argument("--screenshot", help="Save one frame to this PNG and exit")
    p.set_defaults(func=cmd_desktop)

    p = sub.add_parser("serve", help="Run the web API (FastAPI + WebSocket)")
    # Hosting platforms pass the port in $PORT and need 0.0.0.0 (all interfaces)
    p.add_argument("--host", default=os.environ.get("HOST", "127.0.0.1"))
    p.add_argument("--port", type=int, default=int(os.environ.get("PORT", 8000)))
    p.add_argument("--reload", action="store_true", help="Restart on code changes")
    p.set_defaults(func=cmd_serve)
    return parser


if __name__ == "__main__":
    args = build_parser().parse_args()
    args.func(args)
