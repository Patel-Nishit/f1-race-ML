"""The map: track outline, cars and the safety car.

FastF1 X/Y coordinates are in 1/10 metre around an arbitrary origin. To draw
them we (1) rotate by the circuit's display angle, (2) scale to fit the
available area, and (3) shift into the middle of it. world_to_screen() does
all three for whole arrays of points at once.
"""

import math

import arcade
import numpy as np
from arcade import shape_list

from desktop import theme

CAR_RADIUS = 7


class TrackView:
    def __init__(self, track: dict, drivers: list):
        self.track = track
        self.angle = math.radians(track["rotation"])
        self.outline = self._rotate(np.column_stack([track["x"], track["y"]]))
        self.static_shapes = None
        self.area = (0, 0, 1, 1)

        # One sprite pair (black outline + team colour) per car, all in one
        # SpriteList: moving sprites is cheap and the list draws in one call.
        self.car_sprites = arcade.SpriteList()
        self.cars = {}
        for d in drivers:
            outline = arcade.SpriteCircle(CAR_RADIUS + 2, (0, 0, 0))
            fill = arcade.SpriteCircle(CAR_RADIUS, theme.hex_to_rgb(d["color"]))
            self.car_sprites.append(outline)
            self.car_sprites.append(fill)
            self.cars[d["code"]] = (outline, fill)

    def _rotate(self, xy: np.ndarray) -> np.ndarray:
        c, s = math.cos(self.angle), math.sin(self.angle)
        return xy @ np.array([[c, s], [-s, c]])

    def layout(self, left, bottom, right, top, padding=40):
        """Fit the rotated outline into this screen rectangle."""
        self.area = (left, bottom, right, top)
        lo = self.outline.min(axis=0)
        hi = self.outline.max(axis=0)
        span = hi - lo
        width = right - left - 2 * padding
        height = top - bottom - 2 * padding
        self.scale = min(width / span[0], height / span[1])
        self.offset = np.array([(left + right) / 2, (bottom + top) / 2]) - (lo + hi) / 2 * self.scale
        self._build_static_shapes()

    def world_to_screen(self, x, y) -> np.ndarray:
        xy = self._rotate(np.column_stack([np.atleast_1d(x), np.atleast_1d(y)]))
        return xy * self.scale + self.offset

    def _build_static_shapes(self):
        """The outline never changes, so build it once as a GPU shape list
        instead of sending ~700 points to the GPU every frame."""
        pts = self.outline * self.scale + self.offset
        pts = [tuple(p) for p in pts] + [tuple(pts[0])]
        self.static_shapes = shape_list.ShapeElementList()
        self.static_shapes.append(shape_list.create_line_strip(pts, theme.TRACK_EDGE, 14))
        self.static_shapes.append(shape_list.create_line_strip(pts, theme.TRACK, 10))
        # start/finish line marker
        sx, sy = pts[0]
        self.static_shapes.append(shape_list.create_ellipse_filled(sx, sy, 5, 5, theme.TEXT))

    def draw_track(self):
        self.static_shapes.draw()

    def draw_cars(self, snapshot, labels, selected, show_labels, wall_time):
        drivers = snapshot["drivers"]
        screen = self.world_to_screen([d["x"] for d in drivers], [d["y"] for d in drivers])
        for d, (sx, sy) in zip(drivers, screen):
            for sprite in self.cars[d["code"]]:
                sprite.position = (sx, sy)
                sprite.visible = not d["out"]

        # highlight rings for the (at most 2) selected cars, under the cars
        for d, (sx, sy) in zip(drivers, screen):
            if d["code"] in selected and not d["out"]:
                arcade.draw_circle_filled(sx, sy, CAR_RADIUS + 6, theme.with_alpha(theme.SELECTED, 90))
        self.car_sprites.draw()

        for d, (sx, sy) in zip(drivers, screen):
            if d["out"] or not (show_labels or d["code"] in selected):
                continue
            # 2nd selected driver's tag goes below, so close cars don't overprint
            below = d["code"] in selected and selected.index(d["code"]) == 1
            dy = -(CAR_RADIUS + 9) if below else CAR_RADIUS + 9
            labels.draw(f"car-{d['code']}", d["code"], sx, sy + dy,
                        theme.TEXT, 9, anchor_x="center", bold=True)

        sc = snapshot["safety_car"]
        if sc:
            self.draw_safety_car(sc, labels, wall_time)

    def draw_safety_car(self, sc, labels, wall_time):
        (sx, sy), = self.world_to_screen(sc["x"], sc["y"])
        # Pulsing glow: alpha follows a sine wave, 1.2 pulses per second
        pulse = 0.5 + 0.5 * math.sin(wall_time * 2 * math.pi * 1.2)
        for radius, alpha in ((26, 40), (19, 70), (13, 110)):
            arcade.draw_circle_filled(sx, sy, radius * (0.85 + 0.15 * pulse),
                                      theme.with_alpha(theme.SAFETY_CAR, alpha * (0.4 + 0.6 * pulse)))
        arcade.draw_lrbt_rectangle_filled(sx - 11, sx + 11, sy - 7, sy + 7, theme.SAFETY_CAR)
        labels.draw("sc-body", "SC", sx, sy, (0, 0, 0), 8, anchor_x="center", bold=True)
