"""Retained-mode drawing helpers.

arcade.draw_* functions are "immediate mode": every call is a separate trip
to the GPU, every frame. For things that rarely change (panel backgrounds,
leaderboard rows, buttons) we instead build a ShapeElementList once, keep it
on the GPU, and draw it with a single call. ShapeCache rebuilds it only when
its `key` (a description of what it should look like) changes.
"""

from arcade import shape_list


def _rgba(colour):
    return tuple(colour) if len(colour) == 4 else (*colour, 255)


def rect(left, right, bottom, top, colour):
    return shape_list.create_rectangle_filled((left + right) / 2, (bottom + top) / 2,
                                              right - left, top - bottom, _rgba(colour))


# Note: shape_list ellipses take a full width/height (diameter), unlike
# arcade.draw_circle_filled which takes a radius.
def circle(x, y, radius, colour):
    return shape_list.create_ellipse_filled(x, y, radius * 2, radius * 2, _rgba(colour))


def ring(x, y, radius, colour, width):
    return shape_list.create_ellipse_outline(x, y, radius * 2, radius * 2, _rgba(colour), width)


def polygon(points, colour):
    return shape_list.create_polygon(points, _rgba(colour))


class ShapeCache:
    def __init__(self):
        self._key = None
        self._shapes = None

    def draw(self, key, build):
        """build() returns a list of shapes; it only runs when key changes."""
        if key != self._key:
            self._shapes = shape_list.ShapeElementList()
            for shape in build():
                self._shapes.append(shape)
            self._key = key
        self._shapes.draw()
