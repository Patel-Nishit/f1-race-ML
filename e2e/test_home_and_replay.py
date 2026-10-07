import time

from conftest import API, WEB, clock, until


def test_race_picker_lists_the_season(page):
    page.goto(f"{WEB}/")
    page.get_by_text("Saudi Arabian Grand Prix").wait_for(timeout=60_000)
    assert page.locator("li").count() == 24  # 2024 calendar
    assert page.get_by_role("link", name="Watch replay").count() >= 1


def test_replay_streams_and_pauses(page):
    page.goto(f"{WEB}/replay/2024/2")
    page.get_by_text("Live", exact=True).wait_for(timeout=60_000)
    first = clock(page)
    assert until(lambda: clock(page) != first), "clock should advance while playing"
    canvas = page.locator("canvas")
    a = canvas.screenshot(); time.sleep(0.5)
    assert canvas.screenshot() != a, "cars should move"

    page.get_by_role("button", name="Pause").click()
    page.get_by_role("button", name="Play", exact=True).wait_for()
    paused = clock(page); time.sleep(1.5)
    assert clock(page) == paused


def test_canvas_runs_at_display_rate(page):
    page.goto(f"{WEB}/replay/2024/2")
    page.get_by_text("Live", exact=True).wait_for(timeout=60_000)
    fps = page.evaluate("""() => new Promise(r => { let n = 0; const s = performance.now();
        const f = () => { n++; performance.now() - s < 2000 ? requestAnimationFrame(f) : r(n / 2) };
        requestAnimationFrame(f); })""")
    assert fps > 50


def test_unprepared_and_invalid_races(page):
    page.goto(f"{WEB}/replay/2024/9")
    page.get_by_text("hasn't been prepared").wait_for(timeout=15_000)
    page.goto(f"{WEB}/replay/abc/1")
    page.get_by_text("valid race").wait_for(timeout=15_000)
    page.errors.clear()  # the 404 for round 9 is expected
