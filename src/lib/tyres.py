"""Tyre compound helpers.

FastF1 reports compounds as strings ("SOFT", "MEDIUM", ...). We store them as
small integers so they fit in numpy arrays alongside the other telemetry.
"""

TYRE_COMPOUNDS = ["UNKNOWN", "SOFT", "MEDIUM", "HARD", "INTERMEDIATE", "WET"]

TYRE_SHORT = {
    "UNKNOWN": "?",
    "SOFT": "S",
    "MEDIUM": "M",
    "HARD": "H",
    "INTERMEDIATE": "I",
    "WET": "W",
}

# Official Pirelli sidewall colours (RGB)
TYRE_COLOURS = {
    "UNKNOWN": (128, 128, 128),
    "SOFT": (218, 41, 28),
    "MEDIUM": (255, 210, 0),
    "HARD": (240, 240, 240),
    "INTERMEDIATE": (67, 176, 42),
    "WET": (0, 103, 173),
}


def get_tyre_compound_int(compound) -> int:
    """Map a compound name to its index in TYRE_COMPOUNDS (0 when unknown/NaN)."""
    if not isinstance(compound, str):
        return 0
    compound = compound.strip().upper()
    return TYRE_COMPOUNDS.index(compound) if compound in TYRE_COMPOUNDS else 0


def get_tyre_compound_name(value) -> str:
    """Inverse of get_tyre_compound_int; accepts floats from interpolated arrays."""
    idx = int(round(float(value)))
    return TYRE_COMPOUNDS[idx] if 0 <= idx < len(TYRE_COMPOUNDS) else "UNKNOWN"


def get_tyre_colour(value) -> tuple:
    return TYRE_COLOURS[get_tyre_compound_name(value)]
