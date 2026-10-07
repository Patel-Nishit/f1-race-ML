"""Top bar: event name, lap counter, race clock, track status, speed."""

import math

import arcade

from desktop import theme
from desktop.shapes import ShapeCache, rect
from src.lib.time import format_time

_background = ShapeCache()


def draw_top_bar(width, height, meta, snapshot, clock, labels, wall_time):
    top = height
    bottom = height - theme.TOP_BAR
    mid = (top + bottom) / 2
    _background.draw((width, height), lambda: [
        rect(0, width, bottom, top, theme.PANEL),
        rect(0, 4, bottom, top, theme.ACCENT),
    ])

    labels.draw("event", f"{meta['year']} {meta['event_name']}".upper(), 20, mid + 9,
                theme.TEXT, 13, bold=True)
    labels.draw("event-sub", meta["country"], 20, mid - 11, theme.TEXT_DIM, 10)

    # Lap & race time, centred over the track area
    cx = (width - theme.SIDEBAR) / 2
    lap = min(snapshot["lap"], snapshot["total_laps"])
    labels.draw("lap", f"LAP {lap} / {snapshot['total_laps']}", cx - 16, mid,
                theme.TEXT, 18, anchor_x="right", bold=True)
    labels.draw("time", format_time(snapshot["t"], decimals=0), cx + 16, mid,
                theme.TEXT_DIM, 18, anchor_x="left")

    # Track status pill
    status = snapshot["track_status"]
    colour = theme.STATUS_COLOURS.get(status, theme.TEXT_DIM)
    text = theme.STATUS_LABELS.get(status, str(status))
    px = width - theme.SIDEBAR + 20
    arcade.draw_lrbt_rectangle_filled(px, px + 120, mid - 13, mid + 13, colour)
    labels.draw("status", text, px + 60, mid, (0, 0, 0) if status != 5 else theme.TEXT,
                11, anchor_x="center", bold=True)

    # Playback state
    state = f"{clock.speed:g}x" + ("" if clock.playing else "  PAUSED")
    labels.draw("speed", state, width - 20, mid, theme.TEXT_DIM, 12, anchor_x="right", bold=True)


def draw_status_banner(track_area, snapshot, labels, wall_time):
    """Big pulsing banner over the track for SC / VSC / red flag."""
    status = snapshot["track_status"]
    text = {4: "SAFETY CAR", 6: "VIRTUAL SAFETY CAR", 7: "VSC ENDING", 5: "RED FLAG"}.get(status)
    if not text:
        return
    left, bottom, right, top = track_area
    cx = (left + right) / 2
    y = top - 34
    colour = theme.STATUS_COLOURS[status]
    pulse = 0.5 + 0.5 * math.sin(wall_time * 2 * math.pi * 1.2)
    half = 12 + len(text) * 7.5
    arcade.draw_lrbt_rectangle_filled(cx - half - 6, cx + half + 6, y - 22, y + 22,
                                      theme.with_alpha(colour, 50 + 70 * pulse))
    arcade.draw_lrbt_rectangle_filled(cx - half, cx + half, y - 16, y + 16, colour)
    labels.draw("banner", text, cx, y, (0, 0, 0) if status != 5 else theme.TEXT,
                15, anchor_x="center", bold=True)
