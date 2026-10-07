# 09 — Real-time data with WebSockets

This is the "managing live data" chapter. The replay is a recording, but the
browser receives it exactly as it would receive a live feed: the server
pushes updates, and the client reacts.

## Push vs poll

| | Polling | Pushing (WebSocket) |
|---|---|---|
| How | Client asks "anything new?" every N ms | Server sends the moment data exists |
| Latency | Up to N ms late | As soon as it's sent |
| Waste | Many empty answers | Only real updates |
| Connection | New HTTP request each time | One connection stays open |

We use **both**, each where it fits: the slow, rare preparation status is
*polled* (once a second is plenty), and the 10-times-a-second race stream is
*pushed*.

A **WebSocket** starts as a normal HTTP request that "upgrades" into a
two-way connection. Either side can send a message at any time, until one
side closes it.

## The protocol we designed

Connect: `ws://127.0.0.1:8000/ws/replay/2024/2?t=600&speed=1&autoplay=true`

**Server → browser**

```jsonc
// once, on connect: what doesn't change
{"type": "hello", "event_name": "Saudi Arabian Grand Prix", "fps": 10,
 "duration": 4931.9, "total_laps": 50, "lap_starts": [0.0, 95.9, ...],
 "driver_fields": ["code","x","y","position","lap","tyre","speed","gear",
                   "drs_open","throttle","brake","out","laps_down"]}

// 10 times a second while playing
{"type": "frame", "seq": 812, "ack": 3, "t": 1240.3, "lap": 12, "status": 1,
 "playing": true, "speed": 4, "sc": null, "weather": {...},
 "drivers": [["VER", -3474.2, 18900.4, 1, 12, "MEDIUM", 286.8, 7, false, 100.0, 0.0, false, 0], ...]}

// when a command is invalid
{"type": "error", "message": "'seek' needs 't'"}
```

**Browser → server**

```jsonc
{"type": "play", "id": 1}       {"type": "pause", "id": 2}     {"type": "toggle", "id": 3}
{"type": "seek", "t": 2000, "id": 4}    {"type": "skip", "value": -5, "id": 5}
{"type": "skip_laps", "value": 1, "id": 6}   {"type": "speed", "value": 8, "id": 7}
{"type": "faster"}  {"type": "slower"}  {"type": "restart"}
```

### Design decisions, and why

**1. The server owns the clock.** The browser never decides what time it is.
It sends *intentions* ("seek to 2000"), and the server's frames are the truth.
This is how real live-timing systems work, and it means every viewer of a
session sees a consistent state.

**2. Send static data once.** Drivers, colours and the track outline (21 KB)
come from `GET .../meta` and the `hello` message, never in frames.

**3. Rows as lists, with the field names sent once.** Measured on a real
frame:

| Driver rows as | Frame size |
|----------------|-----------|
| dicts, with spaces | 4,133 bytes |
| dicts, compact JSON | 3,586 bytes |
| **lists + `driver_fields` in hello** | **1,546 bytes** |

That's about 15 KB/s per viewer instead of 41 KB/s. On mobile data, that
matters.

**4. A fixed send rate, whatever the speed.** At 16× we still send 10 frames
a second; they're just 1.6 race-seconds apart (measured: 10.0 frames/s, 1.61 s
steps). Bandwidth doesn't grow with playback speed, and the browser
interpolates between frames anyway.

**5. Silence when paused.** While paused, the server sends one frame after
each command and nothing else. Measured: exactly 1 frame, then silence.

**6. Sequence numbers and acks.** Every frame has an increasing `seq`, and
commands can carry an `id` that the server echoes as `ack`. Why it matters:

```
t=0ms    browser sends {"type":"seek","t":2000,"id":4}
t=0ms    ...but frames for t=600.1, 600.2 are already on the wire
t=2ms    server applies the seek; the next frame has ack=4, t=2000
```

Without acks, the cars would jump to lap 20, back to lap 7 for a moment, then
to lap 20 again. With them, the browser ignores frames until it sees
`ack == 4`. Measured seek response: **1.9 ms** on localhost.

**7. Validate everything that comes in.** Commands are parsed with a Pydantic
model (`backend/replay.py`). Unknown types, missing fields and non-JSON text
get an `error` message, and the connection stays open.

## How the server loop works (`backend/ws.py`)

Two **asyncio tasks** run side by side for each connection:

```python
async def receiver():          # waits for commands
    while True:
        raw = await websocket.receive_text()
        session.handle(json.loads(raw))
        changed.set()           # wake the sender

async def sender():            # pushes frames
    while True:
        if playing: await asyncio.sleep(0.1)
        else:       await changed.wait()   # sleep until a command arrives
        clock.tick(real_seconds_since_last_send)
        await websocket.send_text(frame)
```

`asyncio.wait(..., FIRST_COMPLETED)` runs both. When the browser disconnects,
the receiver raises `WebSocketDisconnect`, we cancel the sender, and the
session is gone.

### Backpressure and drift

`await websocket.send_text(...)` waits if the network or the client is slow.
Because the clock advances by **measured real time**, a slow send doesn't
slow the replay down: the next frame simply lands further ahead. Frames are
skipped rather than queued, so memory can't grow without limit. That's
backpressure handled by design.

### A bug we avoided: the pause jump

A naive loop does `clock.tick(now - last)` every time. Pause for 30 s, press
play, and the first tick adds 30 s. The fix is to only count time that passed
*while playing* (`was_playing`). The test client checks it: after a 2 s
pause, play resumes at t=2000.0, not 2002.

## What the browser will do (phase 5)

- Keep the last two frames and **interpolate** positions at 60 fps.
- Track the last command `id` and drop frames whose `ack` is older.
- **Reconnect** automatically if the socket drops, passing `?t=<last t>` so
  the replay continues where it was.

## Try it yourself

```bash
python main.py serve
# in another terminal:
python - <<'EOF'
import asyncio, json, websockets
async def main():
    async with websockets.connect("ws://127.0.0.1:8000/ws/replay/2024/2?t=600") as ws:
        print(json.loads(await ws.recv())["driver_fields"])
        for _ in range(5):
            f = json.loads(await ws.recv())
            print(f["t"], f["drivers"][0][:4])
asyncio.run(main())
EOF
```

## Exercises

1. **Watch party:** make all connections to the same race share one
   `ReplaySession`, so anyone's pause pauses everyone. What has to change in
   `ws.py`? (Hint: a dict of sessions and a set of websockets to broadcast to.)
2. Send only the drivers whose data changed since the last frame (a *delta*).
   How much smaller do frames get? What happens if a delta is lost?
3. Add a `{"type": "ping"}` command answered with `{"type": "pong", "t": ...}`
   and measure round-trip time from the client.

## Interview angle

"The replay is streamed over WebSockets with the server owning the playback
clock. I designed a compact protocol: static data once, rows as positional
arrays with a schema in the handshake (2.3× smaller frames), a fixed 10 Hz
send rate independent of playback speed, silence while paused, and sequence
numbers plus command acks so stale in-flight frames are ignored after a seek.
The sender advances by measured wall-clock time, so slow clients get skipped
frames instead of drift or unbounded buffering."
