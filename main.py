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
    from src.f1_data import enable_cache, load_session, get_race_telemetry

    enable_cache()
    start = time.perf_counter()
    console.print(f"[bold]Loading {args.year} round {args.round} ({args.session})...[/bold]")
    session = load_session(args.year, args.round, args.session)
    data = get_race_telemetry(session, session_type=args.session)
    elapsed = time.perf_counter() - start
    console.print(
        f"[green]Done in {elapsed:.1f}s[/green]: {len(data['frames'])} frames, "
        f"{data['total_laps']} laps, {len(data['driver_colors'])} drivers, "
        f"{len(data['track_statuses'])} track status changes"
    )


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
    # f1_data reads this flag straight from sys.argv
    p.add_argument("--refresh-data", action="store_true", help="Ignore computed cache")
    p.set_defaults(func=cmd_prepare)
    return parser


if __name__ == "__main__":
    args = build_parser().parse_args()
    args.func(args)
