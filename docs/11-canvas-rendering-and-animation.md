# 11 — Canvas rendering and smooth live motion

![Replay page](images/web-replay.png)

This chapter is the browser side of chapter 09: turning 10 frames a second
from a WebSocket into smooth 60 fps motion that survives seeks and dropped
connections.

## The data path, end to end

```
WebSocket message (compact JSON, ~1.5 KB)
   │  replaySocket.ts   parse, decode rows -> objects (protocol.ts)
   ▼
frameBuffer.ts applyFrame()   drop stale frames, keep the last two, time them
   │  stored in the Zustand store (replayStore.ts)
   ▼
TrackCanvas requestAnimationFrame loop (60x per second)
   │  interpolate.ts   blend prev -> latest by elapsed time
   │  track.ts         world coords -> canvas pixels
   ▼
pixels
```

Each step is a small pure function, tested in `web/lib/live.test.ts` without a
browser.

## Concept: entity interpolation

Frames arrive every ~100 ms; the screen refreshes every ~16 ms. Showing the
newest frame as-is makes cars jump 10 times a second. Instead we keep the
last two frames and draw *between* them:

```ts
w = (now - latestArrival) / interval      // 0 when `latest` arrives, 1 by the next one
x = prev.x + (latest.x - prev.x) * w
```

The price is that we show the race about one frame (~100 ms) *late*. That's
the trade every online game makes: a little delay for perfectly smooth
motion.

Details that matter:

- **`interval` is measured, not assumed.** Each arrival updates a smoothed
  average (`0.8 × old + 0.2 × new`). If the network delivers every 120 ms,
  the animation adapts.
- **Paused → no blending.** When `playing` is false we show `latest` exactly.
- **Snap, don't glide, on jumps.** After a rewind or a seek, gliding would
  send the cars sailing across the infield. `shouldSnap()` detects time going
  backwards or jumping more than 3 normal steps, and jumps straight there.

## Concept: acks, so a seek is clean

From chapter 09: every command gets an `id`, and the server echoes it as
`ack`. In `applyFrame()`:

1. After sending a command, set `pendingAck = id`.
2. Ignore frames whose `ack` is older; they were sent before the server
   saw our command.
3. The frame with the matching ack becomes **both** `prev` and `latest`, so
   there's nothing to interpolate across the jump.
4. If no ack arrives within 1.5 s (say the command was rejected), stop
   waiting. A live system must never wait forever.

## Concept: reconnecting

`web/lib/replaySocket.ts` handles a dropped connection:

- **Exponential backoff:** retry after 0.5 s, 1 s, 2 s, 4 s, then every 5 s.
  Retrying instantly in a loop would hammer a server that is restarting.
- **Resume, don't restart:** the URL is rebuilt on every attempt from the
  latest frame (`?t=…&speed=…&autoplay=…`), so the replay continues where it
  was.
- **Know when to give up:** close code `4404` (race not prepared) is
  permanent, so we don't retry.
- **Ignore ghosts:** a close event from an *old* socket we already replaced
  is ignored (`if (this.ws !== ws) return`).

Tested for real (Playwright drove Chromium while we killed the API server):

| Step | Observed |
|------|----------|
| Server killed | Badge shows "Reconnecting" after 0.1 s |
| While down | "Reconnecting · retrying in 2.0s" |
| Server restarted | "Live" again 5.3 s later (startup + backoff) |
| Replay time | Resumed at 0:04, where it was, not 0:00 |

## Concept: the canvas drawing loop

```ts
const draw = () => {
  frameId = requestAnimationFrame(draw);       // schedule the next frame first
  ctx.clearRect(0, 0, width, height);
  ctx.drawImage(trackLayer, 0, 0, width, height);
  const state = interpolate(useReplayStore.getState().buffer, performance.now());
  for (const car of state.cars) { /* arc + fill + stroke */ }
};
```

- **`requestAnimationFrame`** calls us before every screen refresh (60 Hz on
  most screens) and pauses automatically in background tabs, saving battery.
- **`performance.now()`** is a precise, never-going-backwards clock.
  `Date.now()` can jump if the system clock changes.
- **Offscreen layer:** the track outline (~700 points) never changes, so it's
  drawn once onto a hidden canvas and copied with one `drawImage` per frame.
  It's the web version of the desktop app's cached shape list (chapter 07).
- **High-DPI screens:** the canvas's pixel size is `CSS size ×
  devicePixelRatio`, then scaled back with `setTransform`. Without this, lines
  look blurry on Retina and most phones.
- **`ResizeObserver`** refits the track whenever the canvas changes size.
- **Draw order:** back-markers first, so the leader's dot is on top.
- **Cleanup:** the effect returns a function that cancels the animation
  frame and disconnects the observer.

### Coordinates, again

`web/lib/track.ts` is a port of `desktop/track_view.py`: rotate by the circuit
angle, scale to fit, centre. The one difference is that **canvas y grows
downwards** (Arcade's grows upwards), so y is flipped. The screenshots of
both apps show Jeddah the same way round, which confirms the flip is right.

## Measured

| Check (headless Chromium, 1440×900) | Result |
|------|--------|
| Canvas animation loop | 60 fps |
| Cars moving while playing | yes (consecutive canvas captures differ) |
| Paused | clock and canvas both frozen |
| Production build | `/` static; `/replay/...` partial prerender |

## Added in phase 6

- **Selected cars:** a white ring plus a name tag (the second selected car's
  tag goes below its dot so close cars don't overprint), drawn from the UI
  store with `getState()` like everything else in the loop.
- **Click a car to select it:** each frame remembers where it drew every car;
  a click picks the nearest one within 14 px.

Phase 7 adds the safety car's pulsing glow (canvas `shadowBlur` + a sine
wave).

## Exercises

1. Show the interpolation delay: draw a faint dot at each car's *latest*
   position, next to the interpolated one. Play at 16× to see the gap.
2. Throttle the network in Chrome DevTools ("Slow 3G"). What happens to
   `interval`, and does motion stay smooth?
3. Add an FPS counter in a corner of the canvas (count frames per second in
   the `draw` loop).

## Interview angle

"On the client I render a 10 Hz WebSocket feed at 60 fps with entity
interpolation, using a measured inter-arrival interval. Seeks are made clean
with command acks: in-flight stale frames are dropped, and no interpolation
happens across a jump. The socket reconnects with exponential backoff and
resumes from the last known time, which I verified by killing the server
during an automated browser test."
