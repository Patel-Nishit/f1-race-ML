from src.race_status import detect_retirements, is_finisher


def test_is_finisher():
    assert is_finisher("Finished")
    assert is_finisher("Lapped")
    assert is_finisher("+1 Lap")
    assert not is_finisher("Retired")
    assert not is_finisher("Engine")
    assert not is_finisher(float("nan"))


def test_detect_retirements_uses_last_telemetry_time():
    statuses = {"VER": "Finished", "HAM": "Retired", "ALB": "Accident", "SAR": "Lapped"}
    last_seen = {"VER": 5600.0, "HAM": 1200.5, "ALB": 30.0, "SAR": 5650.0}
    assert detect_retirements(statuses, last_seen) == {"HAM": 1200.5, "ALB": 30.0}
