import math

import pytest

from src.lib.time import format_time, parse_time_string
from src.lib.tyres import get_tyre_compound_int, get_tyre_compound_name


@pytest.mark.parametrize("text, seconds", [
    ("0 days 00:01:31.447000", 91.447),
    ("01:31.447", 91.447),
    ("1:02:13", 3733.0),
    ("91.447", 91.447),
])
def test_parse_time_string(text, seconds):
    assert parse_time_string(text) == pytest.approx(seconds)


def test_parse_time_string_missing():
    assert parse_time_string("NaT") is None
    assert parse_time_string(None) is None


def test_format_time():
    assert format_time(91.447) == "1:31.447"
    assert format_time(3733, decimals=0) == "1:02:13"
    assert format_time(125, decimals=0) == "2:05"
    assert format_time(None) == "--"


def test_tyre_round_trip():
    for name in ["SOFT", "MEDIUM", "HARD", "INTERMEDIATE", "WET"]:
        assert get_tyre_compound_name(get_tyre_compound_int(name)) == name


def test_tyre_unknown():
    assert get_tyre_compound_int(math.nan) == 0
    assert get_tyre_compound_int("TEST_UNKNOWN") == 0
    assert get_tyre_compound_name(42) == "UNKNOWN"
