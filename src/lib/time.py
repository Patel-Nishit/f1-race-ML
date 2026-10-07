"""Time parsing/formatting helpers for lap and race times."""

import re

_TIMEDELTA_RE = re.compile(
    r"^(?:(?P<days>-?\d+) days? )?(?:(?P<h>\d+):)?(?P<m>\d+):(?P<s>\d+(?:\.\d+)?)$"
)


def parse_time_string(value: str) -> float:
    """Parse "0 days 00:01:31.447000", "01:31.447" or "91.447" into seconds.

    Returns None for empty/NaT values.
    """
    if value is None:
        return None
    value = str(value).strip()
    if value in ("", "NaT", "nan", "None"):
        return None
    try:
        return float(value)
    except ValueError:
        pass
    match = _TIMEDELTA_RE.match(value)
    if not match:
        raise ValueError(f"Unrecognised time string: {value!r}")
    days = int(match.group("days") or 0)
    hours = int(match.group("h") or 0)
    minutes = int(match.group("m"))
    seconds = float(match.group("s"))
    return days * 86400 + hours * 3600 + minutes * 60 + seconds


def format_time(seconds, decimals: int = 3) -> str:
    """Format seconds as "H:MM:SS" (race clock) or "M:SS.mmm" (lap time).

    decimals=0 gives a race clock like "1:02:13"; otherwise a lap time.
    """
    if seconds is None:
        return "--"
    seconds = max(0.0, float(seconds))
    hours, rem = divmod(seconds, 3600)
    minutes, secs = divmod(rem, 60)
    if decimals == 0:
        if hours:
            return f"{int(hours)}:{int(minutes):02d}:{int(secs):02d}"
        return f"{int(minutes)}:{int(secs):02d}"
    sec_str = f"{secs:0{3 + decimals}.{decimals}f}"
    minutes += hours * 60
    return f"{int(minutes)}:{sec_str}"
