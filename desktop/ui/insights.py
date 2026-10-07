"""Insights menu: a floating panel of analysis tools.

It opens automatically when the replay starts. Each item is a toggle; some
also show their content right inside the panel (weather, race control).
"""

import arcade

from desktop import theme
from src.lib.time import format_time

WIDTH = 250
ITEM = 26
ITEMS = [
    ("telemetry", "Driver telemetry"),
    ("labels", "Driver names on track"),
    ("weather", "Weather"),
    ("race_control", "Race control log"),
]


class InsightsMenu:
    def __init__(self):
        self.open = True  # launches with the replay
        self.enabled = {"telemetry": True, "labels": False, "weather": True, "race_control": True}
        self.hitboxes = []
        self.header = (0, 0, 0, 0)

    def draw(self, track_area, snapshot, meta, labels):
        left, bottom, right, top = track_area
        x0, x1 = left + 16, left + 16 + WIDTH
        y = top - 16
        self.hitboxes = []

        # header (always visible: click to collapse / expand)
        self.header = (x0, x1, y - 30, y)
        arcade.draw_lrbt_rectangle_filled(x0, x1, y - 30, y, theme.ACCENT)
        labels.draw("ins-title", "INSIGHTS", x0 + 12, y - 15, theme.TEXT, 11, bold=True)
        labels.draw("ins-key", "I  " + ("-" if self.open else "+"), x1 - 12, y - 15,
                    theme.TEXT, 11, anchor_x="right", bold=True)
        y -= 30
        if not self.open:
            return

        body_top = y
        rows = self._content_rows(snapshot, meta)
        height = 8 + ITEM * len(ITEMS) + (10 + 18 * len(rows) if rows else 0)
        arcade.draw_lrbt_rectangle_filled(x0, x1, body_top - height, body_top,
                                          theme.with_alpha(theme.PANEL, 235))
        y -= 4
        for key, text in ITEMS:
            mid = y - ITEM / 2
            on = self.enabled[key]
            box = theme.ACCENT if on else theme.PANEL_LIGHT
            arcade.draw_lrbt_rectangle_filled(x0 + 12, x0 + 26, mid - 7, mid + 7, box)
            if on:
                arcade.draw_lrbt_rectangle_filled(x0 + 16, x0 + 22, mid - 3, mid + 3, theme.TEXT)
            labels.draw(f"ins-item-{key}", text, x0 + 36, mid, theme.TEXT if on else theme.TEXT_DIM, 10)
            self.hitboxes.append((key, x0, x1, y - ITEM, y))
            y -= ITEM

        if rows:
            y -= 6
            arcade.draw_lrbt_rectangle_filled(x0 + 12, x1 - 12, y, y + 1, theme.BORDER)
            y -= 14
            for i, (text, colour) in enumerate(rows):
                labels.draw(f"ins-row-{i}", text, x0 + 14, y, colour, 10)
                y -= 18

    def _content_rows(self, snapshot, meta):
        rows = []
        w = snapshot.get("weather")
        if self.enabled["weather"] and w:
            rain = "Raining" if w["raining"] else "Dry"
            rows.append((f"Air {w['air_temp']:.1f} C   Track {w['track_temp']:.1f} C", theme.TEXT))
            rows.append((f"Humidity {w['humidity']:.0f}%   {rain}", theme.TEXT_DIM))
        if self.enabled["race_control"]:
            past = [c for c in meta["track_status_changes"] if 0 <= c["t"] <= snapshot["t"]]
            if not past:
                rows.append(("No flags yet", theme.TEXT_DIM))
            for change in past[-4:]:
                status = change["status"]
                rows.append((f"{format_time(change['t'], 0)}   {theme.STATUS_LABELS.get(status, status)}",
                             theme.STATUS_COLOURS.get(status, theme.TEXT_DIM)))
        return rows

    def handle_click(self, x, y):
        l, r, b, t = self.header
        if l <= x <= r and b <= y <= t:
            self.open = not self.open
            return True
        if not self.open:
            return False
        for key, l, r, b, t in self.hitboxes:
            if l <= x <= r and b <= y <= t:
                self.enabled[key] = not self.enabled[key]
                return True
        return False
