"""Bottom bar: a clickable timeline (scrubber) and playback buttons.

Icons are drawn from triangles and rectangles rather than font symbols, so
they look the same on every operating system.
"""

import arcade

from desktop import theme
from desktop.shapes import ShapeCache, polygon, rect

BUTTON = 40
GAP = 8


def _tri(x, y, size, direction, colour):
    """Triangle pointing right (+1) or left (-1), centred on x, y."""
    h = size / 2
    return polygon([(x - h * direction, y - h), (x - h * direction, y + h), (x + h * direction, y)], colour)


def _icon(kind, x, y, colour, playing):
    """Shapes for one button icon."""
    if kind == "play":
        if playing:
            return [rect(x - 7, x - 2, y - 8, y + 8, colour), rect(x + 2, x + 7, y - 8, y + 8, colour)]
        return [_tri(x + 2, y, 16, 1, colour)]
    if kind == "restart":
        return [rect(x - 8, x - 5, y - 7, y + 7, colour), _tri(x + 2, y, 14, -1, colour)]
    if kind in ("back", "forward"):
        d = 1 if kind == "forward" else -1
        return [_tri(x - 5 * d, y, 11, d, colour), _tri(x + 5 * d, y, 11, d, colour)]
    if kind in ("prev_lap", "next_lap"):
        d = 1 if kind == "next_lap" else -1
        return [_tri(x - 3 * d, y, 12, d, colour), rect(x + 5 * d - 1.5, x + 5 * d + 1.5, y - 7, y + 7, colour)]
    if kind == "slower":
        return [rect(x - 7, x + 7, y - 1.5, y + 1.5, colour)]
    if kind == "faster":
        return [rect(x - 7, x + 7, y - 1.5, y + 1.5, colour), rect(x - 1.5, x + 1.5, y - 7, y + 7, colour)]
    return []


class ControlBar:
    # (action name, icon, tooltip shown under the button)
    BUTTONS = [
        ("restart", "restart", "R"),
        ("prev_lap", "prev_lap", "Shift+Left"),
        ("back", "back", "Left"),
        ("toggle", "play", "Space"),
        ("forward", "forward", "Right"),
        ("next_lap", "next_lap", "Shift+Right"),
        ("slower", "slower", "Down"),
        ("faster", "faster", "Up"),
    ]

    def __init__(self):
        self.hitboxes = []  # (action, left, right, bottom, top)
        self.scrubber = (0, 0, 0, 0)
        self.shapes = ShapeCache()

    def draw(self, width, clock, labels, lap_starts):
        right_edge = width - theme.SIDEBAR
        left, right = 20, right_edge - 20
        y = theme.BOTTOM_BAR - 14
        self.scrubber = (left, right, y - 8, y + 8)

        total = len(self.BUTTONS) * BUTTON + (len(self.BUTTONS) - 1) * GAP
        x = right_edge / 2 - total / 2
        cy = 26
        self.hitboxes = []
        for action, _, _ in self.BUTTONS:
            self.hitboxes.append((action, x, x + BUTTON, cy - 16, cy + 16))
            x += BUTTON + GAP

        # Background, timeline track, lap ticks and buttons only change on a
        # resize or play/pause, so they're one cached shape list.
        self.shapes.draw((width, clock.playing),
                         lambda: self._build_shapes(width, clock, lap_starts, cy))

        # The moving parts: progress fill and knob
        px = left + (right - left) * clock.t / clock.duration
        arcade.draw_lrbt_rectangle_filled(left, px, y - 2, y + 2, theme.ACCENT)
        arcade.draw_circle_filled(px, y, 6, theme.TEXT)
        labels.draw("ctl-speed", f"{clock.speed:g}x", x + 6, cy, theme.TEXT, 13, bold=True)

    def _build_shapes(self, width, clock, lap_starts, cy):
        left, right, bottom, top = self.scrubber
        y = (bottom + top) / 2
        shapes = [
            rect(0, width, 0, theme.BOTTOM_BAR, theme.PANEL),
            rect(0, width, theme.BOTTOM_BAR - 1, theme.BOTTOM_BAR, theme.BORDER),
            rect(left, right, y - 2, y + 2, theme.PANEL_LIGHT),
        ]
        for t in lap_starts[1::5]:  # a tick every 5 laps
            tx = left + (right - left) * t / clock.duration
            shapes.append(rect(tx - 0.5, tx + 0.5, y - 5, y + 5, theme.BORDER))
        for (action, icon, _), (_, l, r, b, t) in zip(self.BUTTONS, self.hitboxes):
            shapes.append(rect(l, r, b, t, theme.ACCENT if action == "toggle" else theme.PANEL_LIGHT))
            shapes.extend(_icon(icon, (l + r) / 2, (b + t) / 2, theme.TEXT, clock.playing))
        return shapes

    def hit_test(self, x, y):
        """Returns ("seek", fraction) for the scrubber, (action, None) for a
        button, or None."""
        left, right, bottom, top = self.scrubber
        if left <= x <= right and bottom <= y <= top:
            return "seek", (x - left) / (right - left)
        for action, l, r, b, t in self.hitboxes:
            if l <= x <= r and b <= y <= t:
                return action, None
        return None
