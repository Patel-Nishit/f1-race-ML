"""The Arcade window: game loop, input handling and drawing order.

Every frame Arcade calls:
    on_update(dt)  -> advance the playback clock by dt real seconds
    on_draw()      -> build a snapshot for the current replay time and paint it
"""

import arcade

from desktop import theme
from desktop.labels import Labels
from desktop.track_view import TrackView
from desktop.ui.controls import ControlBar
from desktop.ui.insights import InsightsMenu
from desktop.ui.leaderboard import Leaderboard
from desktop.ui.legend import draw_legend
from desktop.ui.telemetry import draw_telemetry
from desktop.ui.topbar import draw_status_banner, draw_top_bar
from src.playback import PlaybackClock
from src.snapshot import build_snapshot, lap_start_times

SKIP_SECONDS = 5
MAX_SELECTED = 2


class ReplayWindow(arcade.Window):
    def __init__(self, race, start=0.0, speed=1.0, selected=None, autoplay=True,
                 screenshot=None, show_legend=False, antialias=True, width=1440, height=900):
        meta = race.meta
        super().__init__(width, height, f"F1 Race Replay - {meta['year']} {meta['event_name']}",
                         resizable=True, antialiasing=antialias)
        self.background_color = theme.BACKGROUND
        self.race = race
        self.lap_starts = lap_start_times(race)
        self.clock = PlaybackClock(meta["duration"], self.lap_starts, start=start)
        self.clock.set_speed(speed)
        if autoplay and not screenshot:
            self.clock.play()

        self.labels = Labels()
        self.track = TrackView(meta["track"], meta["drivers"])
        self.leaderboard = Leaderboard()
        self.controls = ControlBar()
        self.insights = InsightsMenu()
        self.selected = list(selected or [])[:MAX_SELECTED]
        self.show_legend = show_legend  # a hint is always shown; L toggles it
        self.wall_time = 0.0
        self.screenshot = screenshot
        self.frames_drawn = 0
        self._layout(width, height)

    # --- layout ------------------------------------------------------------
    def _layout(self, width, height):
        self.track_area = (0, theme.BOTTOM_BAR, width - theme.SIDEBAR, height - theme.TOP_BAR)
        left, bottom, right, top = self.track_area
        # the banner sits at the top; the tools column on the left
        self.track.layout(left + theme.TOOLS, bottom, right, top - 50)

    def on_resize(self, width, height):
        super().on_resize(width, height)
        self._layout(width, height)

    # --- game loop ---------------------------------------------------------
    def on_update(self, delta_time):
        self.wall_time += delta_time
        self.clock.tick(delta_time)

    def on_draw(self):
        self.clear()
        self.labels.begin_frame()
        snapshot = build_snapshot(self.race, self.clock.t)
        w, h = self.width, self.height

        self.track.draw_track()
        self.track.draw_cars(snapshot, self.labels, self.selected,
                             self.insights.enabled["labels"], self.wall_time)
        draw_status_banner(self.track_area, snapshot, self.labels, self.wall_time)
        if self.insights.enabled["telemetry"]:
            draw_telemetry(self.track_area, snapshot, self.selected, self.race, self.labels)
        self.insights.draw(self.track_area, snapshot, self.race.meta, self.labels)
        draw_legend(self.track_area, self.labels, self.show_legend)

        self.leaderboard.draw(w, h, snapshot, self.selected, self.labels)
        draw_top_bar(w, h, self.race.meta, snapshot, self.clock, self.labels, self.wall_time)
        self.controls.draw(w, self.clock, self.labels, self.lap_starts)
        self.labels.end_frame()  # all text in one batched draw call

        self.frames_drawn += 1
        if self.screenshot and self.frames_drawn == 3:
            arcade.get_image().save(self.screenshot)
            print(f"Saved screenshot to {self.screenshot}")
            self.close()

    # --- input -------------------------------------------------------------
    def on_key_press(self, key, modifiers):
        shift = modifiers & arcade.key.MOD_SHIFT
        k = arcade.key
        if key == k.SPACE:
            self.clock.toggle()
        elif key == k.LEFT:
            self.clock.skip_laps(-1) if shift else self.clock.skip(-SKIP_SECONDS)
        elif key == k.RIGHT:
            self.clock.skip_laps(+1) if shift else self.clock.skip(SKIP_SECONDS)
        elif key == k.UP:
            self.clock.faster()
        elif key == k.DOWN:
            self.clock.slower()
        elif key == k.R:
            self.clock.restart()
        elif key in (k.L, k.SLASH, k.QUESTION):
            self.show_legend = not self.show_legend
        elif key == k.I:
            self.insights.open = not self.insights.open
        elif key == k.ESCAPE:
            self.selected = []

    def on_mouse_press(self, x, y, button, modifiers):
        if self.insights.handle_click(x, y):
            return
        hit = self.controls.hit_test(x, y)
        if hit:
            action, value = hit
            actions = {
                "seek": lambda: self.clock.seek(value * self.clock.duration),
                "toggle": self.clock.toggle,
                "restart": self.clock.restart,
                "back": lambda: self.clock.skip(-SKIP_SECONDS),
                "forward": lambda: self.clock.skip(SKIP_SECONDS),
                "prev_lap": lambda: self.clock.skip_laps(-1),
                "next_lap": lambda: self.clock.skip_laps(+1),
                "slower": self.clock.slower,
                "faster": self.clock.faster,
            }
            actions[action]()
            return
        code = self.leaderboard.hit_test(x, y, self.width)
        if code:
            self.toggle_driver(code)

    def on_mouse_drag(self, x, y, dx, dy, buttons, modifiers):
        hit = self.controls.hit_test(x, y)
        if hit and hit[0] == "seek":
            self.clock.seek(hit[1] * self.clock.duration)

    def toggle_driver(self, code):
        if code in self.selected:
            self.selected.remove(code)
        else:
            self.selected.append(code)
            self.selected = self.selected[-MAX_SELECTED:]  # keep the 2 most recent


def run(race, **kwargs):
    ReplayWindow(race, **kwargs)
    arcade.run()
