"""Telemetry cards for the drivers selected on the leaderboard."""

import arcade

from desktop import theme

WIDTH = 250
HEIGHT = 190
TRACE_SECONDS = 20


def draw_telemetry(track_area, snapshot, selected, race, labels):
    left, bottom, right, top = track_area
    by_code = {d["code"]: d for d in snapshot["drivers"]}
    x = left + 16
    y0 = bottom + 16
    # cards stack upwards from the bottom of the tools column

    if not selected:
        arcade.draw_lrbt_rectangle_filled(x, x + WIDTH, y0, y0 + 36, theme.with_alpha(theme.PANEL, 220))
        labels.draw("tel-hint", "Click a driver on the leaderboard", x + 12, y0 + 18, theme.TEXT_DIM, 10)
        return

    for slot, code in enumerate(selected):
        d = by_code.get(code)
        if d:  # first selected on top
            y = y0 + (len(selected) - 1 - slot) * (HEIGHT + 12)
            _card(x, y, d, race, snapshot["t"], labels, slot)


def _card(x, y, d, race, t, labels, slot):
    k = f"tel{slot}"
    team = theme.hex_to_rgb(d["color"])
    arcade.draw_lrbt_rectangle_filled(x, x + WIDTH, y, y + HEIGHT, theme.with_alpha(theme.PANEL, 235))
    arcade.draw_lrbt_rectangle_filled(x, x + 4, y, y + HEIGHT, team)
    top = y + HEIGHT

    labels.draw(f"{k}-code", f"P{d['position']}  {d['code']}", x + 14, top - 18, theme.TEXT, 13, bold=True)
    labels.draw(f"{k}-name", d["name"], x + 14, top - 36, theme.TEXT_DIM, 9)
    labels.draw(f"{k}-lap", f"LAP {d['lap']}", x + WIDTH - 12, top - 18, theme.TEXT_DIM, 10,
                anchor_x="right", bold=True)
    tyre = theme.TYRE_COLOURS.get(d["tyre"], theme.TEXT_DIM)
    labels.draw(f"{k}-tyre", d["tyre"].title(), x + WIDTH - 12, top - 36, tyre, 9,
                anchor_x="right", bold=True)

    if d["out"]:
        labels.draw(f"{k}-speed", "OUT", x + 14, top - 72, theme.ACCENT, 26, bold=True)
        return

    speed = labels.draw(f"{k}-speed", f"{d['speed']:.0f}", x + 14, top - 72, theme.TEXT, 28, bold=True)
    # place the unit right after the number, however many digits it has
    labels.draw(f"{k}-unit", "km/h", x + 18 + speed.content_width, top - 78, theme.TEXT_DIM, 10)
    labels.draw(f"{k}-gear", f"GEAR {d['gear']}", x + WIDTH - 12, top - 62, theme.TEXT, 12,
                anchor_x="right", bold=True)

    # DRS pill
    drs_colour = theme.DRS_ON if d["drs_open"] else theme.PANEL_LIGHT
    arcade.draw_lrbt_rectangle_filled(x + WIDTH - 62, x + WIDTH - 12, top - 92, top - 76, drs_colour)
    labels.draw(f"{k}-drs", "DRS", x + WIDTH - 37, top - 84,
                (0, 0, 0) if d["drs_open"] else theme.TEXT_FAINT, 9, anchor_x="center", bold=True)

    # Throttle and brake bars
    for i, (name, value, colour) in enumerate((("thr", d["throttle"], theme.THROTTLE),
                                                ("brk", d["brake"], theme.BRAKE))):
        by = top - 108 - i * 16
        labels.draw(f"{k}-{name}", "THR" if name == "thr" else "BRK", x + 14, by, theme.TEXT_DIM, 8)
        arcade.draw_lrbt_rectangle_filled(x + 44, x + WIDTH - 12, by - 4, by + 4, theme.BORDER)
        frac = max(0.0, min(1.0, value / 100.0))
        arcade.draw_lrbt_rectangle_filled(x + 44, x + 44 + (WIDTH - 56) * frac, by - 4, by + 4, colour)

    _speed_trace(x + 14, y + 12, WIDTH - 26, 44, d, race, t, team)


def _speed_trace(x, y, w, h, d, race, t, colour):
    """Last TRACE_SECONDS of speed, read straight from the stored arrays."""
    fps = race.meta["fps"]
    i = race.frame_index(t)
    col = race.codes.index(d["code"])
    start = max(0, i - TRACE_SECONDS * fps)
    speeds = race.arrays["speed"][start:i + 1, col]
    arcade.draw_lrbt_rectangle_filled(x, x + w, y, y + h, (14, 15, 19))
    if len(speeds) < 2:
        return
    step = max(1, len(speeds) // 100)  # ~100 points is plenty for 230 px
    speeds = speeds[::step]
    n = TRACE_SECONDS * fps // step
    points = [(x + w - (len(speeds) - 1 - k) * w / n, y + 3 + (h - 6) * min(1.0, s / 350.0))
              for k, s in enumerate(speeds)]
    arcade.draw_line_strip(points, colour, 1.5)
