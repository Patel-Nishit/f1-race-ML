"""One viewer's replay: a playback clock plus how frames are packed for sending.

Each WebSocket connection gets its own ReplaySession, so two browser tabs can
watch different moments of the same race.
"""

from typing import Literal, Optional

from pydantic import BaseModel, ValidationError

from src.playback import PlaybackClock
from src.snapshot import build_snapshot, lap_start_times

# Each driver in a frame is sent as a list, not a dict, in this order. Keys
# repeated 20 times per frame, 10 times a second, would more than double the
# message size (measured: 1,546 vs 3,586 bytes). The client gets this list
# once, in the "hello" message.
DRIVER_FIELDS = ["code", "x", "y", "position", "lap", "tyre", "speed", "gear",
                 "drs_open", "throttle", "brake", "out", "laps_down"]


class Command(BaseModel):
    """A message from the browser. Pydantic checks the shape and types for us,
    so anything malformed is rejected before it touches the clock."""
    type: Literal["play", "pause", "toggle", "seek", "skip", "skip_laps",
                  "speed", "faster", "slower", "restart"]
    id: Optional[int] = None        # echoed back as "ack" in the next frame
    t: Optional[float] = None       # seek: replay time in seconds
    value: Optional[float] = None   # skip: seconds, skip_laps: laps, speed: multiplier


class CommandError(ValueError):
    pass


class ReplaySession:
    def __init__(self, race, start: float = 0.0, speed: float = 1.0):
        self.race = race
        self.lap_starts = lap_start_times(race)
        self.clock = PlaybackClock(race.meta["duration"], self.lap_starts, start=start)
        self.clock.set_speed(speed)
        self.seq = 0
        self.last_ack = None  # id of the last command applied

    # --- incoming ------------------------------------------------------------
    def handle(self, raw: dict) -> None:
        try:
            cmd = Command.model_validate(raw)
        except ValidationError as e:
            raise CommandError(e.errors()[0]["msg"]) from None
        if cmd.id is not None:
            self.last_ack = cmd.id
        c = self.clock
        needs = {"seek": "t", "skip": "value", "skip_laps": "value", "speed": "value"}
        if cmd.type in needs and getattr(cmd, needs[cmd.type]) is None:
            raise CommandError(f"'{cmd.type}' needs '{needs[cmd.type]}'")
        if cmd.type == "play":
            c.play()
        elif cmd.type == "pause":
            c.pause()
        elif cmd.type == "toggle":
            c.toggle()
        elif cmd.type == "seek":
            c.seek(cmd.t)
        elif cmd.type == "skip":
            c.skip(cmd.value)
        elif cmd.type == "skip_laps":
            c.skip_laps(int(cmd.value))
        elif cmd.type == "speed":
            c.set_speed(cmd.value)
        elif cmd.type == "faster":
            c.faster()
        elif cmd.type == "slower":
            c.slower()
        elif cmd.type == "restart":
            c.restart()

    # --- outgoing ------------------------------------------------------------
    def hello_message(self) -> dict:
        meta = self.race.meta
        return {
            "type": "hello",
            "year": meta["year"],
            "round": meta["round"],
            "event_name": meta["event_name"],
            "fps": meta["fps"],
            "duration": meta["duration"],
            "total_laps": meta["total_laps"],
            "lap_starts": [round(t, 2) for t in self.lap_starts],
            "driver_fields": DRIVER_FIELDS,
        }

    def frame_message(self) -> dict:
        """The race at the clock's current time, packed compactly."""
        self.seq += 1
        snap = build_snapshot(self.race, self.clock.t)
        sc = snap["safety_car"]
        return {
            "type": "frame",
            "seq": self.seq,
            # The browser ignores frames until it sees the ack for its latest
            # command, so frames already in flight before a seek can't make
            # the cars jump back for a moment.
            "ack": self.last_ack,
            "t": round(snap["t"], 2),
            "lap": snap["lap"],
            "status": snap["track_status"],
            "playing": self.clock.playing,
            "speed": self.clock.speed,
            "sc": [round(sc["x"], 1), round(sc["y"], 1), sc["state"]] if sc else None,
            "weather": snap["weather"],
            "drivers": [[_round(d[f]) for f in DRIVER_FIELDS] for d in snap["drivers"]],
        }


def _round(value):
    return round(value, 1) if isinstance(value, float) else value
