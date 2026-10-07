import pytest

from src.playback import SPEEDS, PlaybackClock


def test_starts_paused_at_zero_and_ticks_only_when_playing():
    c = PlaybackClock(duration=100)
    assert c.t == 0 and not c.playing
    c.tick(1.0)
    assert c.t == 0
    c.play()
    c.tick(1.0)
    assert c.t == 1.0


def test_speed_multiplies_real_time():
    c = PlaybackClock(duration=100)
    c.play()
    c.faster()
    c.faster()  # 1x -> 2x -> 4x
    assert c.speed == 4
    c.tick(0.5)
    assert c.t == pytest.approx(2.0)


def test_speed_limits():
    c = PlaybackClock(duration=100)
    for _ in range(20):
        c.faster()
    assert c.speed == SPEEDS[-1]
    for _ in range(20):
        c.slower()
    assert c.speed == SPEEDS[0]
    c.set_speed(3.9)
    assert c.speed == 4


def test_stops_at_the_end_and_play_restarts():
    c = PlaybackClock(duration=10)
    c.play()
    c.tick(60)
    assert c.t == 10 and not c.playing
    c.play()
    assert c.t == 0 and c.playing


def test_seek_and_skip_are_clamped():
    c = PlaybackClock(duration=10)
    c.skip(-5)
    assert c.t == 0
    c.seek(50)
    assert c.t == 10


def test_lap_skipping():
    c = PlaybackClock(duration=400, lap_starts=[0, 100, 200, 300])
    c.seek(150)
    assert c.current_lap() == 2
    c.skip_laps(+1)
    assert c.t == 200
    c.seek(250)
    c.skip_laps(-1)  # mid-lap: back to the start of this lap
    assert c.t == 200
    c.skip_laps(-1)  # at a lap start: previous lap
    assert c.t == 100
    c.skip_laps(+10)
    assert c.t == 300
