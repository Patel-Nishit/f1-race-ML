"""Track status codes and driver retirement ("OUT") detection."""

TRACK_STATUS = {
    1: "GREEN",
    2: "YELLOW",
    4: "SAFETY_CAR",
    5: "RED_FLAG",
    6: "VSC",
    7: "VSC_ENDING",
}

SAFETY_CAR = 4

# Results statuses that mean "took the chequered flag". Older seasons use
# "+1 Lap", "+2 Laps"; newer FastF1 data uses "Lapped".
_FINISHED_STATUSES = {"Finished", "Lapped"}


def is_finisher(status) -> bool:
    if not isinstance(status, str):
        return False
    return status in _FINISHED_STATUSES or status.startswith("+")


def detect_retirements(results_status: dict, last_seen: dict) -> dict:
    """Which drivers retired, and when.

    Args:
        results_status: {code: Status string from session.results}
        last_seen: {code: seconds on the replay timeline of their last telemetry}

    Returns {code: t_out} for every driver who did not finish. The car simply
    stops producing data when it retires, so its last sample is the moment
    we show it as OUT.
    """
    return {
        code: float(last_seen[code])
        for code, status in results_status.items()
        if code in last_seen and not is_finisher(status)
    }
