"""End-to-end browser tests (Playwright driving Chromium).

They need both servers running and Saudi Arabia 2024 prepared:

    python main.py prepare --year 2024 --round 2
    python main.py serve                  # terminal 1
    cd web && npm run dev                 # terminal 2
    .venv-e2e/bin/python -m pytest e2e    # terminal 3

Without the servers every test is skipped, so they never break a normal run.
"""

import json
import os
import re
import time
import urllib.request

import pytest

WEB = os.environ.get("E2E_WEB_URL", "http://localhost:3000")
API = os.environ.get("E2E_API_URL", "http://127.0.0.1:8000")
RACE = "/replay/2024/2"  # Saudi Arabia 2024: safety car, two retirements
DURATION = 4931.9


def _get(url):
    with urllib.request.urlopen(url, timeout=3) as r:
        return r.read()


def _servers_ready():
    try:
        _get(f"{WEB}/")
        return json.loads(_get(f"{API}/api/races/2024/2/status"))["state"] == "ready"
    except Exception:
        return False


def pytest_collection_modifyitems(config, items):
    # This hook sees every collected test in the session, so only touch ours.
    ours = [item for item in items if "e2e" in item.path.parts]
    if ours and not _servers_ready():
        skip = pytest.mark.skip(reason=f"needs the web app at {WEB} and the API at {API} with 2024/2 prepared")
        for item in ours:
            item.add_marker(skip)


@pytest.fixture(scope="session")
def browser():
    from playwright.sync_api import sync_playwright
    with sync_playwright() as p:
        b = p.chromium.launch()
        yield b
        b.close()


# Every browser test runs twice: in the dark and in the light colour scheme.
@pytest.fixture(params=["dark", "light"])
def page(browser, request):
    page = browser.new_page(viewport={"width": 1440, "height": 900}, color_scheme=request.param)
    page.errors = []
    page.on("pageerror", lambda e: page.errors.append(str(e)))
    yield page
    assert page.errors == [], f"JavaScript errors: {page.errors}"
    page.close()


@pytest.fixture
def replay(page):
    """The Saudi Arabia 2024 replay, connected and paused at the start."""
    page.replay_sent = []
    page.on("websocket", lambda ws: "/ws/replay/" in ws.url and
            ws.on("framesent", lambda payload: page.replay_sent.append(json.loads(payload))))
    page.goto(f"{WEB}{RACE}")
    page.get_by_text("Live", exact=True).wait_for(timeout=60_000)
    page.keyboard.press("Space")
    page.get_by_role("button", name="Play", exact=True).wait_for()
    return page


def until(fn, timeout=8.0):
    """Poll fn() until it's truthy. Never sleep a fixed time and hope."""
    deadline = time.time() + timeout
    while time.time() < deadline:
        try:
            if fn():
                return True
        except Exception:
            pass
        time.sleep(0.05)
    return False


def lap(page):
    return int(re.search(r"LAP (\d+)", page.get_by_label("Race progress").inner_text()).group(1))


def clock(page):
    return page.get_by_label("Race progress").inner_text().split()[-1]


def seek(page, t):
    """Click the timeline at replay time t (seconds)."""
    bar = page.get_by_role("slider", name="Race timeline").bounding_box()
    page.mouse.click(bar["x"] + bar["width"] * t / DURATION, bar["y"] + bar["height"] / 2)


def css_rgb(page, var):
    """A theme colour (CSS variable) as an (r, g, b) tuple, e.g. css_rgb(page, "--track-edge")."""
    value = page.evaluate(f"getComputedStyle(document.documentElement).getPropertyValue('{var}').trim()")
    return tuple(int(value[i:i + 2], 16) for i in (1, 3, 5))


def count_opaque(page, rgb, tolerance=6):
    """Opaque canvas pixels of one colour. The canvas is transparent, so faint
    glows carry near-exact colour values at alpha ~10: always check alpha."""
    return page.evaluate("""([r0, g0, b0, tol]) => {
        const c = document.querySelector('canvas'), d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
        let n = 0; for (let i = 0; i < d.length; i += 4)
          if (d[i+3] > 200 && Math.abs(d[i]-r0) + Math.abs(d[i+1]-g0) + Math.abs(d[i+2]-b0) < tol) n++;
        return n; }""", [*rgb, tolerance])
