"""Design-system checks against the colours the browser actually uses.

Reads the live CSS variables (not the source file), so a stale stylesheet or
a bad token value can't pass unnoticed. Runs in both colour schemes.
"""

import pytest

from conftest import WEB, expand_hex


def _luminance(hex_colour):
    hex_colour = expand_hex(hex_colour)
    channels = [int(hex_colour[i:i + 2], 16) / 255 for i in (1, 3, 5)]
    lin = [c / 12.92 if c <= 0.03928 else ((c + 0.055) / 1.055) ** 2.4 for c in channels]
    return 0.2126 * lin[0] + 0.7152 * lin[1] + 0.0722 * lin[2]


def contrast(a, b):
    la, lb = sorted((_luminance(a), _luminance(b)), reverse=True)
    return (la + 0.05) / (lb + 0.05)


# (text token, background token, minimum ratio)
PAIRS = [
    ("--ink", "--bg", 4.5), ("--ink", "--surface", 4.5),
    ("--ink-2", "--surface", 4.5), ("--ink-2", "--surface-2", 4.5),
    ("--ink-3", "--surface", 4.5), ("--ink-3", "--surface-2", 4.5),
    ("--on-accent", "--accent", 4.5), ("--accent-ink", "--surface", 4.5),
    ("--sc-ink", "--surface", 4.5), ("--ok-ink", "--surface", 4.5),
    ("--track-edge", "--bg", 3.0),  # UI component, not text
]


def test_theme_tokens_meet_wcag_aa(page):
    page.goto(f"{WEB}/")
    tokens = page.evaluate("""(names) => { const s = getComputedStyle(document.documentElement);
        return Object.fromEntries(names.map(n => [n, s.getPropertyValue(n).trim()])); }""",
                           sorted({name for pair in PAIRS for name in pair[:2]}))
    missing = [n for n, v in tokens.items() if not v]
    assert not missing, f"CSS variables missing in the browser: {missing}"
    failures = [f"{fg} on {bg}: {contrast(tokens[fg], tokens[bg]):.2f} < {need}"
                for fg, bg, need in PAIRS if contrast(tokens[fg], tokens[bg]) < need]
    assert not failures, failures


def test_floating_panels_are_glass(page):
    """Desktop replay: the panels over the track really get their surface and
    border, and nothing over the live canvas uses a backdrop blur (measured:
    re-blurring the canvas every frame halved the frame rate)."""
    page.goto(f"{WEB}/replay/2024/2")
    page.get_by_text("Live", exact=True).wait_for(timeout=60_000)
    style = page.evaluate("""() => { const s = getComputedStyle(document.querySelector('aside'));
        return { bg: s.backgroundColor, border: s.borderTopWidth }; }""")
    assert style["bg"] not in ("rgba(0, 0, 0, 0)", "transparent"), style
    assert style["border"] == "1px", style
    blurred = page.evaluate("""() => [...document.querySelectorAll('*')]
        .filter(e => getComputedStyle(e).backdropFilter !== 'none').length""")
    assert blurred == 0, f"{blurred} element(s) blur the live canvas behind them"


def test_all_twenty_drivers_fit_in_the_tower(page):
    page.goto(f"{WEB}/replay/2024/2")
    page.get_by_text("Live", exact=True).wait_for(timeout=60_000)
    rows = page.locator("aside ol li")
    rows.nth(19).wait_for()
    box = page.get_by_role("complementary", name="Leaderboard").bounding_box()
    last = rows.nth(19).bounding_box()
    assert last["y"] + last["height"] <= box["y"] + box["height"], "the 20th row should be visible without scrolling"
