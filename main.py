"""F1 Race Replay command-line entry point.

Usage:
    python main.py list-rounds --year 2024
    python main.py prepare --year 2024 --round 1 [--refresh-data]
"""

import argparse
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
    return parser


if __name__ == "__main__":
    args = build_parser().parse_args()
    args.func(args)
