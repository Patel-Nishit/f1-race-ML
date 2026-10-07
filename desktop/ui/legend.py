"""On-screen legend: every control and what the colours mean."""

import arcade

from desktop import theme

KEYS = [
    ("Space", "Play / pause"),
    ("Left / Right", "Back / forward 5 s"),
    ("Shift + Left / Right", "Previous / next lap"),
    ("Up / Down", "Faster / slower (0.25x to 32x)"),
    ("R", "Restart race"),
    ("Click leaderboard", "Driver telemetry (up to 2)"),
    ("Click timeline", "Jump to that moment"),
    ("I", "Insights menu"),
    ("L or ?", "Show / hide this legend"),
    ("Esc", "Clear selection"),
]

WIDTH = 380


def draw_legend(track_area, labels, visible):
    left, bottom, right, top = track_area
    if not visible:
        labels.draw("legend-hint", "Press L for the controls legend", right - 16, bottom + 16,
                    theme.TEXT_DIM, 10, anchor_x="right")
        return
    line = 19
    height = 44 + line * len(KEYS) + 52
    x0, y0 = right - WIDTH - 16, bottom + 16
    arcade.draw_lrbt_rectangle_filled(x0, x0 + WIDTH, y0, y0 + height, theme.with_alpha(theme.PANEL, 235))
    arcade.draw_lrbt_rectangle_outline(x0, x0 + WIDTH, y0, y0 + height, theme.BORDER, 1)
    y = y0 + height - 20
    labels.draw("legend-title", "CONTROLS", x0 + 14, y, theme.TEXT_DIM, 10, bold=True)
    y -= 26
    for i, (key, action) in enumerate(KEYS):
        labels.draw(f"legend-k{i}", key, x0 + 14, y, theme.TEXT, 10, bold=True)
        labels.draw(f"legend-a{i}", action, x0 + 170, y, theme.TEXT_DIM, 10)
        y -= line

    # colour key
    y -= 10
    x = x0 + 14
    for name, colour in (("S", theme.TYRE_COLOURS["SOFT"]), ("M", theme.TYRE_COLOURS["MEDIUM"]),
                         ("H", theme.TYRE_COLOURS["HARD"]), ("I", theme.TYRE_COLOURS["INTERMEDIATE"]),
                         ("W", theme.TYRE_COLOURS["WET"])):
        arcade.draw_circle_outline(x + 6, y, 7, colour, 2)
        labels.draw(f"legend-tyre-{name}", name, x + 6, y, colour, 8, anchor_x="center", bold=True)
        x += 24
    arcade.draw_lrbt_rectangle_filled(x + 8, x + 26, y - 6, y + 6, theme.SAFETY_CAR)
    labels.draw("legend-sc", "Safety car", x + 32, y, theme.TEXT_DIM, 10)
    labels.draw("legend-out", "OUT", x + 124, y, theme.ACCENT, 10, bold=True)
    labels.draw("legend-out2", "= retired", x + 158, y, theme.TEXT_DIM, 10)
