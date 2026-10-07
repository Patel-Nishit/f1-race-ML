"""Colours and layout sizes shared by every part of the desktop UI."""

BACKGROUND = (16, 17, 22)
PANEL = (26, 28, 36)
PANEL_LIGHT = (38, 41, 52)
BORDER = (58, 62, 76)
TEXT = (236, 237, 242)
TEXT_DIM = (150, 154, 170)
TEXT_FAINT = (95, 99, 115)
TRACK = (70, 74, 88)
TRACK_EDGE = (110, 114, 130)
ACCENT = (225, 6, 0)  # F1 red
SELECTED = (255, 255, 255)

SAFETY_CAR = (255, 176, 0)
STATUS_COLOURS = {
    1: (0, 170, 80),     # green
    2: (240, 200, 0),    # yellow
    4: SAFETY_CAR,       # safety car
    5: (220, 30, 30),    # red flag
    6: SAFETY_CAR,       # VSC
    7: (240, 200, 0),    # VSC ending
}
STATUS_LABELS = {
    1: "GREEN",
    2: "YELLOW",
    4: "SAFETY CAR",
    5: "RED FLAG",
    6: "VSC",
    7: "VSC ENDING",
}
DRS_ON = (0, 200, 90)
THROTTLE = (0, 200, 90)
BRAKE = (230, 40, 40)

TYRE_COLOURS = {
    "SOFT": (218, 41, 28),
    "MEDIUM": (255, 210, 0),
    "HARD": (235, 235, 235),
    "INTERMEDIATE": (67, 176, 42),
    "WET": (0, 103, 173),
    "UNKNOWN": (128, 128, 128),
}

# Layout (pixels)
TOP_BAR = 56
BOTTOM_BAR = 76
SIDEBAR = 320
TOOLS = 282  # left column for the Insights menu and telemetry cards
ROW_HEIGHT = 34


def hex_to_rgb(value: str) -> tuple:
    value = value.lstrip("#")
    return tuple(int(value[i:i + 2], 16) for i in (0, 2, 4))


def with_alpha(colour: tuple, alpha: float) -> tuple:
    return (*colour[:3], max(0, min(255, int(alpha))))
