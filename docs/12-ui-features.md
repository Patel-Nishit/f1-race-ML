# 12 — The replay HUD (heads-up display)

![Web replay during the safety car](images/web-replay.png)

Phase 6 turned the bare track into a full replay screen; phase 7 added the
Insights menu and its analysis tools (second half of this chapter).

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

## Phase 7: the Insights menu

![Insights column](images/web-insights.png)

A floating menu on the left of the track **opens automatically with every
replay** (`I` or its header toggles it). Each tool is a checkbox; enabled
tools appear as cards below it, and the track is re-fitted into the space
beside the column (`fitTrack(..., insetLeft)`), so nothing hides the cars.

| Tool | Component | Data source |
|------|-----------|-------------|
| Driver telemetry | `TelemetryPanel.tsx` | Live frames: speed, gear, DRS, lap, tyre, throttle/brake meters |
| Speed trace | `SpeedTrace.tsx` | `GET .../telemetry/{code}`: last 60 s, refetched once per race-second |
| Tyre strategy | `TyreStrategy.tsx` | `GET .../strategy`: stints, shown only up to the current lap |
| Gaps to leader | `Leaderboard.tsx` | `gap` field in every frame |
| Race control & weather | `RaceControl.tsx` | Status changes so far + weather in frames |

### Gap to leader: measured the way F1 does it

A gap isn't a distance, it's **time at the same place**: "how many seconds
ago was the leader where this car is now?" The backend keeps the leader's
progress over time (`RaceData.leader_progress`, made non-decreasing with
`np.maximum.accumulate`) and inverts it with `np.interp`:

```python
passed_at = np.interp(driver_progress, race.leader_progress, race.arrays["t"])
gap = t - passed_at
```

Saudi Arabia 2024 under the safety car: NOR leads, VER +2.1 s, HAM +2.8 s.
The field is bunched, exactly as expected.

### Tyre stints: use the right column

![Tyre strategy](images/web-strategy.png)

We first rebuilt stints from the per-frame tyre colour. That can't see a pit
stop onto the *same* compound. FastF1's laps table has a `Stint` number, so
the pipeline now saves real stints in `meta.json` (`src/strategy.py`). In
Australia 2024, **15 drivers** made Hard → Hard stops that the colour-only
version would have merged into one long stint. OCO even ran three Hard
stints. The chart shows each stop as a 2 px gap between bars.

**No spoilers:** the full strategy is known in advance, so `stintsSoFar()`
drops stints that haven't started and cuts the current one at the driver's
current lap.

### Chart design (and the palette check)

Both charts follow the data-visualisation rules we adopted:

- **One y-axis.** The speed trace shows speed only; throttle and brake live
  in the telemetry card. Two different scales on one chart mislead.
- **Thin marks, quiet grid:** 2 px lines, 10 px bars (max 24 px), solid
  hairline gridlines, and a 2 px surface gap between stints.
- **Identity never by colour alone.** Teammates share a team colour (NOR and
  PIA are both McLaren orange), so the second selected driver's line is
  **dashed**, and there's a legend with line keys.
- **Text in text colours.** Values and names are white/grey; the colour sits
  on the line or bar next to them.
- **A tooltip that enhances, never gates.** The crosshair snaps to the nearest
  sample and lists *both* drivers (value first, name second); the same
  numbers are in the legend and the telemetry cards.

We ran the Pirelli compound colours through a palette validator on our dark
panel. It flagged white (hard) and yellow (medium) as outside the ideal
lightness band, soft vs intermediate as close for deuteranopes (ΔE 8.0), and
wet blue at 2.87:1 contrast. Repainting tyres would confuse every F1 fan, so
we kept the convention and added **secondary encoding**: a letter in every
segment that fits one, a legend and a tooltip. Wet moved one step lighter
(`#1a7fd0`, passes 3:1). The letter colour is chosen by measured WCAG contrast,
which picks **black** on wet blue (4.99:1 vs 4.21:1 for white), contrary to
intuition.

### Bugs found while testing phase 7

- **Ticking an Insights checkbox disabled every keyboard shortcut.** The
  checkbox kept focus, and the shortcut hook ignored keys on *any* `<input>`.
  Now only text-entry fields block shortcuts (`isTypingTarget()`, unit-tested).
- **"(1 laps)"** in the stint tooltip, fixed with a tiny `lapCount()`.
- A React lint rule caught `setState` called synchronously inside an effect
  in the telemetry hook. The fix was to **derive** "loading" (`result.id !==
  wanted`) instead of storing it.

## Exercises

1. Show the interval to the car ahead (not just the gap to the leader) on the
   leaderboard. Which existing value makes this a one-liner?
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
