import re

from conftest import count_opaque, css_rgb, lap, seek, until

SC_AMBER = (255, 176, 0)


def leftmost_track_px(page):
    """x of the leftmost pixel of the track outline, whatever the theme's track colour."""
    return page.evaluate("""([r0, g0, b0]) => {
        const c = document.querySelector('canvas'), d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
        for (let x = 0; x < c.width; x += 2) for (let y = 0; y < c.height; y += 4) { const i = (y * c.width + x) * 4;
          if (d[i+3] > 200 && Math.abs(d[i]-r0) < 6 && Math.abs(d[i+1]-g0) < 6 && Math.abs(d[i+2]-b0) < 6) return x / devicePixelRatio; }
        return null; }""", list(css_rgb(page, "--track-edge")))


def test_menu_opens_with_the_replay_and_track_refits(replay):
    page = replay
    menu = page.get_by_role("button", name=re.compile("INSIGHTS"))
    assert menu.get_attribute("aria-expanded") == "true"
    assert page.locator("#insights-tools input[type=checkbox]").count() == 5
    assert until(lambda: (leftmost_track_px(page) or 0) > 336)  # beside the menu
    page.keyboard.press("i")
    assert until(lambda: menu.get_attribute("aria-expanded") == "false")
    assert until(lambda: (leftmost_track_px(page) or 999) < 336)


def test_gaps_on_the_leaderboard(replay):
    page = replay
    rows = page.locator("aside ol li")
    assert until(lambda: "LEADER" in rows.nth(0).inner_text())
    assert until(lambda: re.search(r"\+\d+\.\d", rows.nth(3).inner_text()))


def test_telemetry_and_speed_trace(replay):
    page = replay
    seek(page, 800)
    page.get_by_text("SAFETY CAR", exact=True).first.wait_for()
    for code in ("NOR", "VER"):
        page.locator("aside li", has_text=code).first.get_by_role("button").click()
    cards = page.get_by_label(re.compile(r"^(NOR|VER) telemetry$"))
    assert until(lambda: cards.count() == 2)
    assert all(s in cards.nth(0).inner_text() for s in ("km/h", "GEAR", "DRS", "LAP"))
    assert page.get_by_role("meter").count() == 4

    trace = page.get_by_label("Speed trace", exact=True)
    paths = trace.locator("svg[role=img] path")
    assert until(lambda: paths.count() == 2)
    assert paths.nth(1).get_attribute("stroke-dasharray") == "5 3"  # identity not by colour alone
    box = trace.locator("svg[role=img]").bounding_box()
    page.mouse.move(box["x"] + box["width"] * 0.6, box["y"] + box["height"] * 0.5)
    tip = trace.get_by_role("status")
    assert until(lambda: "NOR" in tip.inner_text() and "VER" in tip.inner_text())


def test_tyre_strategy_has_no_spoilers(replay):
    page = replay
    page.get_by_role("checkbox", name=re.compile("Tyre strategy")).check()
    strat = page.get_by_label("Tyre strategy", exact=True)
    ver = strat.locator("g[aria-label^='VER:']")
    assert until(lambda: ver.get_attribute("aria-label") == "VER: medium laps 1 to 1")
    seek(page, 800)
    assert until(lambda: ver.get_attribute("aria-label", timeout=500) == f"VER: medium laps 1 to 7, hard laps 8 to {lap(page)}")
    ver.locator("g[role=img]").last.hover()
    assert until(lambda: "Hard" in strat.get_by_role("status").inner_text())
    # shortcuts still work after ticking a checkbox (it keeps focus)
    page.keyboard.press("r")
    assert until(lambda: ver.get_attribute("aria-label") == "VER: medium laps 1 to 1")


def test_race_control_and_weather(replay):
    page = replay
    page.get_by_role("checkbox", name=re.compile("Race control")).check()
    rc = page.get_by_label("Race control & weather", exact=True)
    assert until(lambda: "No flags yet" in rc.inner_text())
    seek(page, 1100)
    assert until(lambda: all(s in rc.inner_text() for s in ("YELLOW", "SAFETY CAR", "GREEN")))
    assert "°C" in rc.inner_text()


def test_safety_car_glows_then_fades(replay):
    page = replay
    seek(page, 900)
    assert until(lambda: count_opaque(page, SC_AMBER, 30) > 50)
    seek(page, 1100)
    assert until(lambda: count_opaque(page, SC_AMBER, 30) == 0, timeout=3)
