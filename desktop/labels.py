"""Cached, batched text labels.

Two performance rules for drawing text 60 times a second:

1. Cache: creating an arcade.Text lays the text out, which is slow. Each label
   gets a stable key; we create it once and only update what changed.
2. Batch: drawing ~130 labels one by one means ~130 separate trips to the GPU
   ("draw calls"). Instead every label joins one pyglet Batch, and the whole
   batch is drawn with a single call at the end of the frame.

Usage per frame:  labels.begin_frame()  ...labels.draw(...)...  labels.end_frame()
Labels not drawn during a frame are hidden automatically.
"""

import arcade
import pyglet


class Labels:
    def __init__(self):
        self._cache = {}
        self._used = set()
        self.batch = pyglet.graphics.Batch()

    def begin_frame(self):
        self._used = set()

    def draw(self, key, text, x, y, color=(255, 255, 255), size=11,
             anchor_x="left", anchor_y="center", bold=False):
        text = str(text)
        color = tuple(color) if len(color) == 4 else (*color, 255)
        label = self._cache.get(key)
        if label is None:
            label = arcade.Text(text, x, y, color, size, anchor_x=anchor_x,
                                anchor_y=anchor_y, bold=bold, batch=self.batch)
            self._cache[key] = label
        else:
            if label.text != text:
                label.text = text
            if label.x != x or label.y != y:
                label.position = (x, y)
            if tuple(label.color) != color:
                label.color = color
            if not label.visible:
                label.visible = True
        self._used.add(key)
        return label

    def end_frame(self):
        for key, label in self._cache.items():
            if key not in self._used and label.visible:
                label.visible = False
        self.batch.draw()
