# 06 — Safety car, OUT drivers and track geometry

The API gives us *some* facts directly and leaves others out. This chapter
covers modelling the missing pieces from the facts we have. That's a very
common real-world data task.

## Track geometry (`src/track.py`)

### The outline

We take the race's fastest lap (`session.laps.pick_fastest()`) and keep its
X/Y points. Each point also has `RelativeDistance`: how far round the lap it
is, from 0.0 to 1.0. We call that `frac`.

`point_at_fraction(track, f)` answers "where on the map is the point `f` of
the way round?" with `np.interp` on X and on Y. Values wrap: `1.25` is the same
place as `0.25`. The safety car needs this to sit "200 m ahead of the leader"
even when that's past the finish line.

### Finding the pit lane from events

FastF1 has no pit lane coordinates. But every lap row records `PitInTime` and
`PitOutTime`, and we know where every car was at every moment. So
`find_pit_points()`:

1. For each pit stop, looks up that car's X/Y at `PitOutTime` (pit exit) and
   `PitInTime` (pit entry).
2. Takes the **median** over all stops. Unlike the mean, a single odd value
   (e.g. a timing glitch) can't drag a median far off.

On Bahrain 2024 this puts pit entry and pit exit about 420 m apart in a
straight line, either side of the start/finish line. Exercise 1 below lets you
check this on a plot.

## Safety car (`src/safety_car.py`)

Track status code `4` tells us **when** the safety car is out, but not
**where** it is. We model its position as a **state machine**: a thing that is
always in exactly one state and moves between states on events.

```
HIDDEN --(status becomes 4)--> DEPLOYING --(10 s)--> LEADING
   ^                                                    |
   +------(status leaves 4)---- RETURNING <--(last 10 s of the period)
```

| State | Position |
|-------|----------|
| HIDDEN | Not drawn (x, y = NaN) |
| DEPLOYING | Drives forward along the track from the pit exit to 200 m ahead of the leader |
| LEADING | 200 m ahead of the leader, on the racing line |
| RETURNING | Drives on to the pit entry |

Because the data is a recording, we know in advance when each safety car
period ends. So "the last 10 seconds" is easy, which a live system couldn't
do. Periods shorter than 30 s split their time into thirds, so all three
phases still appear.

### Easing

Moving at a constant speed and then stopping dead looks robotic. `smoothstep`
is an **easing curve**:

```
smoothstep(u) = 3u² − 2u³      (u from 0 to 1)
```

It starts slowly, speeds up, and slows down to arrive gently. Its slope is 0 at
both ends. We use it for the progress along the track and for blending from
the pit-lane point onto the racing line. The web app will reuse the same
idea for animations.

### Honest limitations

- The real safety car waits at the pit exit for the leader. Ours drives
  straight to its slot. It's a visual model, not a reconstruction.
- VSC (codes 6 and 7) has no physical car, so viewers show a banner only.
- Red flag (5): cars go to the pit lane; we show a banner too.

Writing limitations down is part of good engineering. It tells reviewers you
know where the model ends.

## OUT drivers (`src/race_status.py`)

`session.results["Status"]` says how each driver's race ended. In current
FastF1 data, cars that took the flag are `Finished` or `Lapped`. Older seasons
use `+1 Lap`, `+2 Laps`. Anything else (`Retired`, `Disqualified`, and in
older data specific causes like `Engine`...) means the driver didn't finish.

**When** did they retire? A retired car stops sending telemetry, so we use
the time of its last sample. `detect_retirements()` returns
`{code: t_out}`, stored in the JSON metadata. Viewers then:

- stop drawing the car after `t_out`,
- grey out its leaderboard row with **OUT**,
- and `compute_positions` keeps it at the back, ordered by how far it got.

## Checked against a real race: Saudi Arabia 2024

`python main.py prepare --year 2024 --round 2` gives:

| Event | Our data |
|-------|----------|
| GAS retires | Status `Retired`, OUT at 122 s |
| STR crashes | Status `Retired`, OUT at 556 s, lap 6 |
| Yellow flag | status 2 at 572 s |
| Safety car | status 4 from 606 s to 1,012 s (leader laps 7 to 9) |
| Our SC model | 100 frames DEPLOYING, 3,856 LEADING, 100 RETURNING |

The order of events (crash → yellow → safety car) is exactly what happened on
track. Rendering a few frames showed the SC leaving the pit exit, running just
ahead of the bunched pack, and peeling off to the pit entry.

## Exercises

1. Plot the track outline with matplotlib:
   `plt.plot(r.meta["track"]["x"], r.meta["track"]["y"])`, then add the pit
   points as red dots.
2. Change `LEAD_GAP_M` to 500 and look at `sc_x/sc_y` during a safety car.
3. Write a test where the safety car period starts on the very first frame.
   Does `compute_safety_car` handle it?

## Interview angle

"FastF1 has no safety car GPS or pit lane coordinates, so I derived the pit
lane from the median car position at pit events, and modelled the safety car
as a state machine with eased transitions along the track polyline. I wrote
the model's limitations down explicitly."
