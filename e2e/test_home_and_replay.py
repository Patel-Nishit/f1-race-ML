import re
import time

from conftest import API, RACE, WEB, clock, until


def test_race_picker_lists_the_season(page):
    page.goto(f"{WEB}/")
    calendar = page.locator("section[aria-labelledby=calendar-heading]")
    calendar.locator("li", has_text="Saudi Arabian Grand Prix").wait_for(timeout=60_000)
    assert calendar.locator("li").count() == 24  # 2024 calendar, one row per round
    assert page.get_by_role("tab", name="2024").get_attribute("aria-selected") == "true"
    # hero CTA, a tile per ready race, and the ready rows all open replays
    assert page.get_by_role("link", name="Watch replay", exact=True).count() >= 2
    assert page.get_by_role("link", name="Watch replay: Saudi Arabian Grand Prix 2024").count() == 1


def test_season_strip_keyboard(page):
    page.goto(f"{WEB}/")
    tab = page.get_by_role("tab", name="2024")
    tab.wait_for(timeout=60_000)
    tab.focus()
    page.keyboard.press("ArrowRight")  # seasons run newest to oldest
    assert page.get_by_role("tab", name="2023").get_attribute("aria-selected") == "true"
    page.locator("li", has_text="Bahrain Grand Prix").wait_for(timeout=60_000)


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


def test_favourites_card_and_team_theme(page):
    page.goto(f"{WEB}/")
    card = page.locator("section[aria-labelledby=favourites-heading]")
    card.get_by_role("heading", name="Max Verstappen").wait_for(timeout=60_000)
    # every result chip opens that race's replay
    assert card.get_by_role("link").filter(has_text="Saudi Arabian").get_attribute("href") == "/replay/2024/2"
    toggle = page.get_by_role("switch").first
    assert toggle.get_attribute("aria-checked") == "false"
    toggle.click()
    assert page.evaluate("document.documentElement.dataset.team") == "redbull"
    page.reload()  # the choice survives a reload, applied before React starts
    assert page.evaluate("document.documentElement.dataset.team") == "redbull"
    page.get_by_role("switch").first.click()
    assert page.evaluate("document.documentElement.dataset.team") is None


def test_focus_favourite_selects_max(page):
    page.goto(f"{WEB}{RACE}")
    focus = page.get_by_role("button", name=re.compile("Max"))
    focus.wait_for(timeout=60_000)
    focus.click()
    assert focus.get_attribute("aria-pressed") == "true"
    page.keyboard.press("m")  # the shortcut toggles it back off
    assert focus.get_attribute("aria-pressed") == "false"


STANDINGS = {
    "season": 2026, "round": 17, "fetched_at": 0, "stale": False,
    "drivers": [
        {"position": p, "code": c, "name": c, "number": n, "team": "", "team_id": "", "points": pts, "wins": 0}
        for p, c, n, pts in [(1, "ANT", "12", 340), (2, "RUS", "63", 238), (3, "HAM", "44", 229),
                             (4, "VER", "3", 221), (5, "LEC", "16", 215)]],
    "constructors": [
        {"position": 1, "team": "Mercedes", "team_id": "mercedes", "points": 578, "wins": 11},
        {"position": 4, "team": "Red Bull", "team_id": "red_bull", "points": 332, "wins": 2}],
}


def test_favourites_live_standings(page):
    # fixed data, so the test doesn't depend on this week's real championship
    page.route("**/api/standings", lambda r: r.fulfill(json=STANDINGS))
    page.goto(f"{WEB}/")
    card = page.locator("section[aria-labelledby=favourites-heading]")
    ladder = card.get_by_role("list", name="2026 driver standings around VER")
    ladder.wait_for(timeout=60_000)
    assert ladder.locator("li").all_inner_texts()[0].split() == ["P1", "ANT", "340"]
    assert card.get_by_text("119 behind the leader, 8 behind P3").is_visible()
    assert card.get_by_text("#3").is_visible()  # this season's number, not the replay's #1
    assert card.get_by_role("list", name="2026 constructor standings around Red Bull").is_visible()


def test_favourites_without_live_standings(page):
    page.route("**/api/standings", lambda r: r.fulfill(status=502, json={"detail": "down"}))
    page.goto(f"{WEB}/")
    card = page.locator("section[aria-labelledby=favourites-heading]")
    card.get_by_text("Live standings are unavailable right now.").first.wait_for(timeout=60_000)
    assert card.get_by_role("link").filter(has_text="Saudi Arabian").count() == 1  # replay stats still there
