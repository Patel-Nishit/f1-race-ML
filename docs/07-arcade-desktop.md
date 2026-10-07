# 07 — The Arcade desktop viewer

![Desktop viewer: Saudi Arabia 2024 under the safety car](images/desktop-safety-car.png)

```bash
python main.py desktop --year 2024 --round 2              # play from the start
python main.py desktop --year 2024 --round 2 --start 600 --speed 4 --select NOR,VER
python main.py desktop --year 2024 --round 2 --no-antialias   # faster without a GPU
```

## What we built

| Feature | Where |
|---------|-------|
| Track, cars, safety car with pulsing glow | `desktop/track_view.py` |
| Leaderboard: position, team colour, tyre, OUT, +laps, DRS | `desktop/ui/leaderboard.py` |
| Lap counter, race clock, track status, speed | `desktop/ui/topbar.py` |
| SAFETY CAR / VSC / RED FLAG banner | `desktop/ui/topbar.py` |
| Buttons + clickable timeline | `desktop/ui/controls.py` |
| Legend of all controls and colours | `desktop/ui/legend.py` |
| Insights menu (opens with the replay) | `desktop/ui/insights.py` |
| Telemetry cards with a 20 s speed trace | `desktop/ui/telemetry.py` |
| Game loop and input | `desktop/replay_window.py` |

Two pieces live in `src/`, **not** in `desktop/`, because the web backend
(phase 4) needs exactly the same logic:

- `src/playback.py`: `PlaybackClock` (play, pause, seek, speed, lap jumps).
- `src/snapshot.py`: `build_snapshot(race, t)` returns the whole race state
  at time `t` as plain dicts and lists.

The desktop code only *draws* snapshots. Separating "what is the state" from
"how do we show it" is the most important design idea in this phase.

## Concept: the game loop

Every interactive graphics program runs the same loop, about 60 times a second:

```
while window is open:
    handle input          -> on_key_press, on_mouse_press
    update the world      -> on_update(dt)   (dt = real seconds since last frame)
    draw the world        -> on_draw()
```

Our `on_update` only moves the clock: `t += dt * speed`. Because it uses the
*real* elapsed time `dt`, playback speed stays correct even when the frame
rate drops. At 16x speed, 1 real second always advances 16 race seconds.

## Concept: interpolation for smooth motion

Data is stored at 10 Hz, but we draw at up to 60 fps. If we just showed the
nearest stored frame, cars would jump 6 times a second. `build_snapshot`
blends the two frames either side of `t`:

```python
f = t * fps            # e.g. 812.37 * 10 = 8123.7
i = floor(f)           # 8123   (earlier frame)
w = f - i              # 0.7    (how far towards the next frame)
x = x[i] * (1 - w) + x[i + 1] * w
```

Gear, tyre and lap aren't blended; they come from frame `i`. A gear of
"3.7" makes no sense.

## Concept: coordinates and transforms

Track X/Y are in 1/10 metre around some origin, and Arcade's screen has (0, 0)
at the **bottom-left**. `TrackView.world_to_screen` turns one into the other
in three steps:

1. **Rotate** by the circuit's angle (`rotation` from FastF1) so the map
   matches TV graphics. A 2×2 rotation matrix does this for all points at once.
2. **Scale** so the track's bounding box fits the free area.
3. **Translate** to the middle of that area.

`layout()` runs again on every window resize, so the map always fits.

## Concept: input handling

- Keys: `on_key_press(key, modifiers)`. `modifiers & arcade.key.MOD_SHIFT`
  tells us if Shift was held (Shift+Right = next lap).
- Mouse: every clickable thing records a **hitbox** (`left, right, bottom,
  top`) while it's drawn. `on_mouse_press(x, y)` checks which box contains the
  click. This "draw it, remember where it went" approach is called
  immediate-mode UI.

## Concept: performance (draw calls)

The first version ran at **22 fps**. Profiling (`cProfile`) showed two causes:

1. **Draw calls.** Each `arcade.draw_*` call and each text label is a separate
   trip to the GPU. We had ~130 text draws and ~180 shape draws per frame.
2. **No GPU on this machine.** WSL here renders OpenGL in software
   (`llvmpipe`), so presenting each frame costs ~20 ms on its own.

We fixed the first with three standard techniques:

| Technique | Where | Idea |
|-----------|-------|------|
| Text batching | `desktop/labels.py` | All labels join one `pyglet.graphics.Batch`, drawn with one call |
| Sprite lists | `TrackView.car_sprites` | 40 car sprites move every frame but draw in one call |
| Cached shape lists | `desktop/shapes.py` | Panels, buttons, leaderboard rows are built once and rebuilt only when their *key* changes (an overtake, a click, a resize) |

Results on this machine (software rendering):

| | Antialiasing on | `--no-antialias` |
|---|---|---|
| Before | 22 fps | 33 fps |
| After | 26 fps | 41 fps |

The rest is the software rasterizer, which a real GPU removes. The lesson:
**measure first.** Without the profiler we might have optimised
`build_snapshot`, which only takes 0.12 ms.

## Bugs we hit (and what they teach)

- **Brake bar always empty.** FastF1's brake channel is on/off (0 or 1), not
  0–100% like throttle. Fixed in `build_snapshot`: `brake * 100`.
  *Lesson: check the units of every field.*
- **Tyre rings vanished after the shape-list refactor.**
  `shape_list.create_ellipse_filled` takes a *diameter*, but
  `arcade.draw_circle_filled` takes a *radius*. *Lesson: two similar APIs
  can disagree; read the docstring.*
- **Overlays hid the track.** Long, diagonal circuits (Jeddah) ran under the
  panels. Fixed with a dedicated left "tools" column and fitting the track to
  the rest.

## Testing a UI

- `tests/test_playback.py` and `tests/test_snapshot.py` test the shared logic
  with no window at all.
- `tests/test_desktop.py` opens a real window and calls `on_key_press` /
  `on_mouse_press` directly, then checks the clock and selection. It skips
  itself on machines without a display.
- `--screenshot file.png` renders one frame and exits. That's how every
  screenshot in this guide was made and checked.

## Exercises

1. Add a key `F` that toggles "follow the leader": the map zooms in around
   the P1 car. (Hint: change `scale` and `offset` in `TrackView`.)
2. Show the gap to the car ahead in the leaderboard. (Hint: the difference in
   `progress` × an average lap time is a rough estimate.)
3. Profile the app yourself:
   `python -m cProfile -o prof.out main.py desktop --year 2024 --round 2`,
   then read it with `pstats`.

## Interview angle

"I built the desktop viewer on a shared playback clock and snapshot layer, so
the desktop and web clients show identical state. When it ran at 22 fps I
profiled it, found the bottleneck was draw calls, and used text batching,
sprite lists and cached shape lists. I also measured how much was the
environment's software renderer, so I didn't over-optimise."
