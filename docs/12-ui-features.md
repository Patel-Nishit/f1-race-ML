# 12 — The replay HUD (heads-up display)

![Web replay during the safety car](images/web-replay.png)

Phase 6 turned the bare track into a full replay screen. Phase 7 adds the
Insights menu and telemetry panel to this chapter.

## Layout: CSS grid with named areas

```
┌──────────────────── top ────────────────────┐
│ ← Races │ 2024 SAUDI… │ LAP 8/50 13:20 │ SC 1× ● │
├──────────── track ────────────┬──── side ───┤
│ canvas + banner + legend      │ leaderboard │
├──────────── bottom ───────────┤             │
│ timeline + buttons            │             │
└───────────────────────────────┴─────────────┘
```

`ReplayView.tsx` declares the areas once
(`[grid-template-areas:'top_top''track_side''bottom_side']`), and each
component places itself (`[grid-area:side]`). Moving a panel means editing one
string, not five components.

## Features and where they live

| Feature | Component | Notes |
|---------|-----------|-------|
| Lap & race time | `TopBar.tsx` → `RaceClock` | Subscribes to `lap` and `floor(t)`, so it re-renders once a second |
| Track status pill | `TopBar.tsx` → `StatusPill` | Colour from `lib/status.ts` |
| SC / VSC / red flag banner | `StatusBanner.tsx` | Slides in (motion `AnimatePresence`), pulses with a CSS `box-shadow` keyframe |
| Leaderboard | `Leaderboard.tsx` | Position, team colour, tyre badge, OUT / +N LAP / DRS; rows slide on overtakes |
| Driver OUT | `Leaderboard.tsx`, `TrackCanvas.tsx` | Row greyed with red OUT, sorted last; car no longer drawn |
| Controls | `ControlBar.tsx` | Restart, ±lap, ±5 s, play/pause, slower/faster with speed readout |
| Timeline | `ControlBar.tsx` → `Timeline` | Click or drag to jump; lap ticks every 5 laps; SC/VSC/red flag bands |
| Keyboard shortcuts | `useKeyboardShortcuts.ts` + `lib/shortcuts.ts` | Same keys as the desktop app |
| Legend | `Legend.tsx` | Generated from the same `SHORTCUTS` list the keyboard uses |
| Selecting drivers | `lib/uiStore.ts` | Click a leaderboard row **or a car on the map**; up to 2; Esc clears |

## Design decisions worth explaining

**One source of truth for shortcuts.** `lib/shortcuts.ts` holds the mapping
(a pure function, unit-tested) *and* the list the legend displays. The legend
can't drift out of date with what the keys actually do.

**The timeline sends one seek per drag.** While you drag, only the knob moves
(local React state). The seek goes to the server once, on release. Verified in
the browser test by counting WebSocket messages: exactly 1 seek for a 5-step
drag.

**Safety car periods on the timeline.** `neutralisedPeriods()` turns the list
of status changes into coloured bands (SC, red flag, and VSC with VSC-ending
merged in), so you can see and jump straight to the action.

**Animate overtakes, snap after jumps.** Leaderboard rows use motion's
`layout` animation (FLIP: measure the old and new positions, then animate the
difference with a transform). But after a seek, the whole order changes at
once and 20 rows flying around is noise. Measured with the browser: 0.1 s after
a lap jump, rows overlapped (gaps from −26 px to 98 px). With "snap after
jumps" they're evenly spaced (36 px) immediately, while during normal play rows
were caught mid-slide in 149 of 233 samples. The canvas follows the same rule
(chapter 11).

**Space on a focused button.** After clicking Play, the button has keyboard
focus. Pressing Space would then fire *both* our shortcut *and* the browser's
"click the focused button": a double toggle that does nothing. The keyboard
hook calls `preventDefault()`, and the browser test checks that exactly one
toggle is sent.

**Don't steal browser shortcuts.** Ctrl/Cmd+key combos are ignored (Ctrl+R
reloads, Cmd+L focuses the address bar), and so are keys typed into form
fields.

**Accessibility basics.** Buttons have `aria-label`s and tooltips with their
shortcut. The timeline is a `role="slider"` with a readable `aria-valuetext`
("13:20"). The connection and status changes are announced with
`aria-live`. Animations switch off when the OS asks for reduced motion
(`MotionConfig reducedMotion="user"`, plus a CSS media query for the pulse).

## A data bug the UI exposed: "+1 LAP" for everyone

The first HUD screenshot, right after the leader started lap 2, showed
**every other driver as "+1 LAP"**. The rule was "lapped = on a lower lap
number than the leader", which is true for everyone for a few seconds each
time the leader crosses the line.

The fix (`src/snapshot.py`, so the desktop app gets it too) compares
**progress** instead: lapped means at least one full lap behind. That
revealed a second, subtler issue. At the flag the six officially lapped
drivers in Saudi Arabia measured **0.996–0.9998** laps behind, not 1.0,
because each lap's last telemetry sample lands a few metres before the line.
A tolerance of 0.01 laps (~50 m) absorbs that.

Checked against the official classification:

| Race | Lapped at the flag (ours) | Official "Lapped" |
|------|---------------------------|-------------------|
| Bahrain 2024 | 10 drivers | same 10 |
| Saudi Arabia 2024 | 6 drivers | same 6 |
| Australia 2024 | 7 drivers | same 7 |

*Lesson: a UI is a test of the data. Look at screenshots of real moments,
not just green unit tests.*

## Testing

- `web/lib/hud.test.ts`: shortcut mapping (including ignoring Ctrl+R),
  timeline bands and lap ticks, max-two selection.
- `tests/test_snapshot.py`: "lower lap number is not lapped" and "exactly
  one lap down despite the measurement gap".
- Browser test (Playwright, 16 checks): every shortcut, legend open/close,
  Space on a focused button, one seek per drag, the SC banner, OUT rows at
  the bottom, two-driver selection, Esc, and clicking a car on the canvas.
  The first version used fixed `sleep(0.4)` waits and failed once in 6 runs.
  Replacing them with "poll until the condition holds" made it pass 9 runs out
  of 9.

## Exercises

1. Add "Gap to leader" to the leaderboard: `(leader_progress − progress) ×
   average lap time`. Where should it be computed, in the backend or the
   client?
2. Show a small "PIT" tag when a car is in the pit lane. (Hint: the backend
   knows `PitInTime`/`PitOutTime` per lap.)
3. Make the leaderboard collapsible on narrow screens.

## Interview angle

"The HUD is a CSS-grid layout of small components, each subscribing to just
the slice of state it shows. Shortcuts are one tested pure function that also
generates the legend. The timeline sends a single seek per drag and shows
safety-car periods. I animate real overtakes but snap after seeks, measured in
the browser. And reviewing screenshots of real race moments surfaced a
lapped-car bug in the shared data layer, which I fixed and verified against
the official classification for three races."
