"""The WebSocket replay stream: the "live data" part of the project.

The server owns the playback clock and *pushes* frames; the browser only
sends commands. Two tasks run side by side for each connection:

  receiver  reads commands (play, pause, seek, speed...) and applies them
  sender    advances the clock by the real time that passed and sends a frame
            SEND_HZ times a second while playing, or once after a command
            while paused (no point streaming identical frames)

Because the clock advances by measured real time, a slow network or a slow
client never makes the replay drift: if a send takes longer, the next frame
simply jumps further ahead. At 16x speed we still send 10 frames a second;
they're just 1.6 race-seconds apart, and the browser interpolates.
"""

import asyncio
import json
import time

from fastapi import WebSocket, WebSocketDisconnect
from starlette.concurrency import run_in_threadpool

from backend.replay import CommandError, ReplaySession
from src.race_store import is_prepared, load_race_cached

SEND_HZ = 10
PERIOD = 1 / SEND_HZ


def _dumps(message: dict) -> str:
    # No spaces after separators: ~10% smaller frames, sent 10 times a second
    return json.dumps(message, separators=(",", ":"))


async def replay_socket(websocket: WebSocket, year: int, round_number: int,
                        session_type: str, start: float, speed: float, autoplay: bool):
    await websocket.accept()
    if not is_prepared(year, round_number, session_type):
        await websocket.send_text(_dumps({"type": "error", "message": "race not prepared"}))
        await websocket.close(code=4404)
        return

    # Loading ~20 MB from disk takes about a second; do it in a worker thread
    # so the event loop keeps serving other connections meanwhile.
    race = await run_in_threadpool(load_race_cached, year, round_number, session_type)
    session = ReplaySession(race, start=start, speed=speed)
    if autoplay:
        session.clock.play()

    await websocket.send_text(_dumps(session.hello_message()))
    await websocket.send_text(_dumps(session.frame_message()))

    changed = asyncio.Event()  # set by the receiver whenever a command arrives

    async def receiver():
        while True:
            raw = await websocket.receive_text()
            try:
                message = json.loads(raw)
                if not isinstance(message, dict):
                    raise CommandError("commands must be JSON objects")
                session.handle(message)
            except (CommandError, json.JSONDecodeError) as e:
                await websocket.send_text(_dumps({"type": "error", "message": str(e)}))
            changed.set()

    async def sender():
        last = time.monotonic()
        was_playing = session.clock.playing
        while True:
            if session.clock.playing:
                await asyncio.sleep(PERIOD)
            else:
                await changed.wait()  # paused: sleep until a command arrives
            changed.clear()
            now = time.monotonic()
            # Only count real time that passed *while playing*; otherwise
            # pressing play after a 30 s pause would jump 30 s ahead.
            session.clock.tick(now - last if was_playing else 0.0)
            last = now
            was_playing = session.clock.playing
            await websocket.send_text(_dumps(session.frame_message()))

    tasks = [asyncio.create_task(receiver()), asyncio.create_task(sender())]
    try:
        done, pending = await asyncio.wait(tasks, return_when=asyncio.FIRST_COMPLETED)
        for task in done:
            exc = task.exception()
            if exc and not isinstance(exc, WebSocketDisconnect):
                raise exc
    finally:
        for task in tasks:
            task.cancel()
