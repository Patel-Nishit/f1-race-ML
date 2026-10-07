"""The playback clock: what replay time is it, and how fast is it moving?

Shared by the Arcade desktop viewer and (later) the backend's WebSocket
stream. Viewers call tick(dt) every frame with the real seconds that passed;
the clock turns that into replay seconds using the current speed.
"""

import bisect

SPEEDS = [0.25, 0.5, 1, 2, 4, 8, 16, 32]
DEFAULT_SPEED_INDEX = SPEEDS.index(1)


class PlaybackClock:
    def __init__(self, duration: float, lap_starts=None, start: float = 0.0):
        """
        duration: replay length in seconds.
        lap_starts: replay time at which each lap begins, lap_starts[0] = lap 1.
        """
        self.duration = float(duration)
        self.lap_starts = list(lap_starts or [])
        self.t = 0.0
        self.playing = False
        self.speed_index = DEFAULT_SPEED_INDEX
        self.seek(start)

    @property
    def speed(self) -> float:
        return SPEEDS[self.speed_index]

    def tick(self, real_dt: float) -> float:
        """Advance by real_dt wall-clock seconds; returns the new replay time."""
        if self.playing:
            self.seek(self.t + real_dt * self.speed)
            if self.t >= self.duration:
                self.playing = False  # stop at the chequered flag
        return self.t

    # --- controls --------------------------------------------------------
    def play(self):
        if self.t >= self.duration:
            self.t = 0.0
        self.playing = True

    def pause(self):
        self.playing = False

    def toggle(self):
        self.pause() if self.playing else self.play()

    def seek(self, t: float):
        self.t = min(max(0.0, float(t)), self.duration)

    def skip(self, seconds: float):
        self.seek(self.t + seconds)

    def restart(self):
        self.seek(0.0)

    def faster(self):
        self.speed_index = min(self.speed_index + 1, len(SPEEDS) - 1)

    def slower(self):
        self.speed_index = max(self.speed_index - 1, 0)

    def set_speed(self, speed: float):
        """Snap to the nearest allowed speed."""
        self.speed_index = min(range(len(SPEEDS)), key=lambda i: abs(SPEEDS[i] - speed))

    # --- laps --------------------------------------------------------------
    def current_lap(self) -> int:
        """1-based lap the leader is on, according to lap_starts."""
        return max(1, bisect.bisect_right(self.lap_starts, self.t))

    def skip_laps(self, delta: int):
        """Jump to the start of the lap `delta` laps away (like a chapter skip).

        Going back from mid-lap first returns to the start of the current lap,
        the way a music player's "previous" button does.
        """
        if not self.lap_starts:
            return
        lap = self.current_lap()
        if delta < 0 and self.t - self.lap_starts[lap - 1] > 2.0:
            delta += 1
        target = min(max(1, lap + delta), len(self.lap_starts))
        self.seek(self.lap_starts[target - 1])
