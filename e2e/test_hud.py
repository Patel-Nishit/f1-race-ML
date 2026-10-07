import re

from conftest import clock, count_opaque, lap, seek, until


def test_keyboard_shortcuts(replay):
    page = replay
    c0 = clock(page)
    page.keyboard.press("ArrowRight")
    assert until(lambda: clock(page) != c0)
    l0 = lap(page)
    page.keyboard.press("Shift+ArrowRight")
    assert until(lambda: lap(page) == l0 + 1)
    page.keyboard.press("ArrowUp")
    assert until(lambda: page.get_by_label("Playback speed").inner_text() == "2×")
    page.keyboard.press("l")
    assert page.get_by_label("Controls legend").is_visible()
    page.keyboard.press("?")
    assert page.get_by_label("Controls legend").count() == 0


def test_space_on_focused_button_toggles_once(replay):
    page = replay
    page.get_by_role("button", name="Play", exact=True).click()  # focus the button
    page.get_by_role("button", name="Pause", exact=True).wait_for()
    before = sum(m["type"] == "toggle" for m in page.replay_sent)
    page.keyboard.press("Space")
    page.get_by_role("button", name="Play", exact=True).wait_for()
    page.wait_for_timeout(500)
    assert sum(m["type"] == "toggle" for m in page.replay_sent) - before == 1


def test_timeline_drag_sends_one_seek(replay):
    page = replay
    bar = page.get_by_role("slider", name="Race timeline").bounding_box()
    y = bar["y"] + bar["height"] / 2
    before = sum(m["type"] == "seek" for m in page.replay_sent)
    page.mouse.move(bar["x"] + bar["width"] * 0.05, y)
    page.mouse.down()
    for f in (0.08, 0.11, 0.14, 0.162):
        page.mouse.move(bar["x"] + bar["width"] * f, y)
    page.mouse.up()
    assert until(lambda: lap(page) >= 7)
    assert sum(m["type"] == "seek" for m in page.replay_sent) - before == 1


def test_safety_car_banner_and_out_drivers(replay):
    page = replay
    seek(page, 800)
    assert until(page.get_by_text("SAFETY CAR", exact=True).first.is_visible)
    rows = page.locator("aside ol li")
    assert until(lambda: "OUT" in rows.nth(19).inner_text() and "OUT" in rows.nth(18).inner_text())
    assert page.locator("aside li", has_text="OUT").count() == 2  # STR, GAS


def test_selection_from_leaderboard_and_map(replay):
    page = replay
    seek(page, 800)
    rows = page.locator("aside ol li")
    assert until(lambda: rows.count() == 20)
    for i in range(3):
        rows.nth(i).get_by_role("button").click()
    assert page.locator("aside button[aria-pressed=true]").count() == 2  # oldest dropped
    page.keyboard.press("Escape")
    assert page.locator("aside button[aria-pressed=true]").count() == 0

    # click the leader's car on the map (McLaren orange)
    pos = page.evaluate("""() => {
        const c = document.querySelector('canvas'), d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
        for (let y = 0; y < c.height; y++) for (let x = 0; x < c.width; x++) { const i = (y * c.width + x) * 4;
          if (d[i+3] > 200 && Math.abs(d[i]-255) + Math.abs(d[i+1]-128) + d[i+2] < 6)
            return {x: x / devicePixelRatio + 3, y: y / devicePixelRatio + 3}; }
        return null; }""")
    box = page.locator("canvas").bounding_box()
    page.mouse.click(box["x"] + pos["x"], box["y"] + pos["y"])
    assert until(lambda: page.locator("aside button[aria-pressed=true]").count() == 1)
    assert re.search(r"NOR|PIA", page.locator("aside button[aria-pressed=true]").inner_text())
