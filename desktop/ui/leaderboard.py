"""Leaderboard: position, team colour, driver code, tyre, gap status."""

from desktop import theme
from desktop.shapes import ShapeCache, rect, circle, ring


class Leaderboard:
    def __init__(self):
        self.rows = []  # (code, bottom, top) for click detection
        self.shapes = ShapeCache()

    def _geometry(self, width, height, count):
        left = width - theme.SIDEBAR
        top = height - theme.TOP_BAR
        y = top - 44
        row_h = min(theme.ROW_HEIGHT, (y - theme.BOTTOM_BAR - 8) / max(1, count))
        return left, top, y, row_h

    def draw(self, width, height, snapshot, selected, labels):
        drivers = snapshot["drivers"]
        left, top, y_start, row_h = self._geometry(width, height, len(drivers))

        # Shapes only change on an overtake, pit stop, retirement or click,
        # so they are rebuilt only then (see desktop/shapes.py).
        key = (width, height, tuple(selected),
               tuple((d["code"], d["out"], d["tyre"]) for d in drivers))
        self.shapes.draw(key, lambda: self._build_shapes(width, height, drivers, selected))

        labels.draw("lb-title", "LEADERBOARD", left + 20, top - 24, theme.TEXT_DIM, 10, bold=True)
        labels.draw("lb-hint", "click to see telemetry", width - 20, top - 24,
                    theme.TEXT_FAINT, 9, anchor_x="right")

        self.rows = []
        y = y_start
        for i, d in enumerate(drivers):
            mid = y - row_h / 2
            self.rows.append((d["code"], y - row_h, y))
            text = theme.TEXT_FAINT if d["out"] else theme.TEXT
            labels.draw(f"lb-pos-{i}", d["position"], left + 40, mid, text, 12,
                        anchor_x="right", bold=True)
            labels.draw(f"lb-code-{i}", d["code"], left + 64, mid, text, 12, bold=True)
            tyre = theme.TEXT_FAINT if d["out"] else theme.TYRE_COLOURS.get(d["tyre"], theme.TEXT_DIM)
            labels.draw(f"lb-tyre-{i}", d["tyre"][0] if d["tyre"] != "UNKNOWN" else "?",
                        left + 150, mid, tyre, 9, anchor_x="center", bold=True)

            if d["out"]:
                status, colour = "OUT", theme.ACCENT
            elif d["laps_down"]:
                status, colour = f"+{d['laps_down']} LAP", theme.TEXT_DIM
            elif d["drs_open"]:
                status, colour = "DRS", theme.DRS_ON
            else:
                status, colour = "", theme.TEXT_DIM
            if status:
                labels.draw(f"lb-status-{i}", status, width - 24, mid, colour, 10,
                            anchor_x="right", bold=True)
            y -= row_h

    def _build_shapes(self, width, height, drivers, selected):
        left, top, y, row_h = self._geometry(width, height, len(drivers))
        shapes = [
            rect(left, width, theme.BOTTOM_BAR, top, theme.PANEL),
            rect(left, left + 1, theme.BOTTOM_BAR, top, theme.BORDER),
        ]
        for d in drivers:
            mid = y - row_h / 2
            if d["code"] in selected:
                shapes.append(rect(left + 8, width - 8, y - row_h + 1, y - 1, theme.PANEL_LIGHT))
                shapes.append(rect(left + 8, left + 10, y - row_h + 1, y - 1, theme.SELECTED))
            team = theme.TEXT_FAINT if d["out"] else theme.hex_to_rgb(d["color"])
            shapes.append(rect(left + 50, left + 54, mid - 9, mid + 9, team))
            tyre = theme.TEXT_FAINT if d["out"] else theme.TYRE_COLOURS.get(d["tyre"], theme.TEXT_DIM)
            shapes.append(circle(left + 150, mid, 10, (10, 10, 12)))
            shapes.append(ring(left + 150, mid, 10, tyre, 2.5))
            y -= row_h
        return shapes

    def hit_test(self, x, y, width):
        if x < width - theme.SIDEBAR:
            return None
        for code, bottom, top in self.rows:
            if bottom <= y < top:
                return code
        return None
