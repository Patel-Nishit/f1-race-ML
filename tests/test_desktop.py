"""Drive the Arcade window with simulated key presses and clicks.

Needs a display and a prepared race (python main.py prepare --year 2024
--round 2), so it skips itself otherwise.
"""

import os

import pytest

from src.race_store import is_prepared

pytestmark = pytest.mark.skipif(
    not (os.environ.get("DISPLAY") or os.environ.get("WAYLAND_DISPLAY")) or not is_prepared(2024, 2),
    reason="needs a display and the 2024 round 2 race prepared",
)


@pytest.fixture(scope="module")
def window():
    from desktop.replay_window import ReplayWindow
    from src.race_store import load_race

    w = ReplayWindow(load_race(2024, 2), start=600, autoplay=False)
    w.on_draw()  # one draw so click targets exist
    yield w
    w.close()


def click(w, box):
    l, r, b, t = box
    w.on_mouse_press((l + r) / 2, (b + t) / 2, 1, 0)


def test_keyboard(window):
    from arcade import key as K
    w, c = window, window.clock
    c.seek(600)
    w.on_key_press(K.SPACE, 0)
    assert c.playing
    w.on_key_press(K.SPACE, 0)
    assert not c.playing
    w.on_key_press(K.RIGHT, 0)
    assert c.t == 605
    w.on_key_press(K.LEFT, 0)
    w.on_key_press(K.LEFT, 0)
    assert c.t == 595
    lap = c.current_lap()
    w.on_key_press(K.RIGHT, K.MOD_SHIFT)
    assert c.current_lap() == lap + 1
    speed = c.speed
    w.on_key_press(K.UP, 0)
    assert c.speed == speed * 2
    w.on_key_press(K.L, 0)
    assert w.show_legend
    w.on_key_press(K.SLASH, 0)
    assert not w.show_legend
    w.on_key_press(K.R, 0)
    assert c.t == 0


def test_buttons_and_timeline(window):
    w, c = window, window.clock
    w.on_draw()
    buttons = {a: (l, r, b, t) for a, l, r, b, t in w.controls.hitboxes}
    click(w, buttons["toggle"])
    assert c.playing
    click(w, buttons["toggle"])
    assert not c.playing
    l, r, b, t = w.controls.scrubber
    w.on_mouse_press(l + (r - l) / 2, (b + t) / 2, 1, 0)
    assert abs(c.t - c.duration / 2) < 1


def test_leaderboard_selection(window):
    w = window
    w.on_draw()
    rows = w.leaderboard.rows
    for code, b, t in rows[:3]:
        w.on_mouse_press(w.width - 100, (b + t) / 2, 1, 0)
    assert w.selected == [rows[1][0], rows[2][0]]  # max 2, oldest dropped
    from arcade import key as K
    w.on_key_press(K.ESCAPE, 0)
    assert w.selected == []
