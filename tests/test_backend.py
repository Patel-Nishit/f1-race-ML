import json
import time

import pytest
from fastapi.testclient import TestClient

from src.race_store import save_race
from tests.conftest import make_full_race


@pytest.fixture
def client(data_dir):
    from backend.app import app
    save_race(make_full_race(), 2030, 1, data_dir=data_dir)
    return TestClient(app)


# --- REST ------------------------------------------------------------------

def test_health(client):
    assert client.get("/api/health").json() == {"status": "ok"}


def test_lists_prepared_races(client):
    races = client.get("/api/races").json()
    assert races == [{"year": 2030, "round": 1, "session": "R", "event_name": "Test Grand Prix",
                      "country": "Testland", "total_laps": 3, "duration": 60.0}]


def test_meta(client):
    meta = client.get("/api/races/2030/1/meta").json()
    assert [d["code"] for d in meta["drivers"]] == ["AAA", "BBB", "CCC"]
    assert meta["lap_starts"] == [0.0, 20.0, 40.0]
    assert "code" in meta["driver_fields"]


def test_unprepared_race_is_404(client):
    r = client.get("/api/races/2030/2/meta")
    assert r.status_code == 404
    assert "prepare" in r.json()["detail"]


def test_validation(client):
    assert client.get("/api/races/2030/99/status").status_code == 422
    assert client.get("/api/races/2010/1/status").status_code == 422
    assert client.get("/api/races/2030/1/status?session=Q").status_code == 422


def test_status(client):
    assert client.get("/api/races/2030/1/status").json()["state"] == "ready"
    assert client.get("/api/races/2030/2/status").json()["state"] == "missing"


def test_telemetry_window(client):
    r = client.get("/api/races/2030/1/telemetry/aaa?start=10&end=20&max_points=10").json()
    assert r["code"] == "AAA"
    assert r["t"][0] == 10.0 and r["t"][-1] <= 20.0
    assert len(r["t"]) <= 11
    assert r["gear"][0] == 7 and isinstance(r["gear"][0], int)
    assert r["drs_open"][0] is False
    assert client.get("/api/races/2030/1/telemetry/ZZZ").status_code == 404


def test_cors_allows_the_web_app(client):
    r = client.options("/api/races", headers={"Origin": "http://localhost:3000",
                                               "Access-Control-Request-Method": "GET"})
    assert r.headers["access-control-allow-origin"] == "http://localhost:3000"


# --- WebSocket -------------------------------------------------------------

def frames_until(ws, predicate, limit=50):
    for _ in range(limit):
        msg = ws.receive_json()
        if predicate(msg):
            return msg
    raise AssertionError("expected message never arrived")


def test_websocket_hello_and_frames(client):
    with client.websocket_connect("/ws/replay/2030/1?t=10&autoplay=false") as ws:
        hello = ws.receive_json()
        assert hello["type"] == "hello" and hello["total_laps"] == 3
        frame = ws.receive_json()
        assert frame["type"] == "frame" and frame["t"] == 10.0 and not frame["playing"]
        row = dict(zip(hello["driver_fields"], frame["drivers"][0]))
        assert row["code"] == "AAA" and row["position"] == 1 and row["tyre"] == "MEDIUM"


def test_websocket_commands_are_acknowledged(client):
    with client.websocket_connect("/ws/replay/2030/1?autoplay=false") as ws:
        ws.receive_json(), ws.receive_json()
        ws.send_json({"type": "seek", "t": 35, "id": 7})
        frame = frames_until(ws, lambda m: m.get("ack") == 7)
        assert frame["t"] == 35.0
        out = {r[0]: r[-2] for r in frame["drivers"]}  # "out" is second-last
        assert out == {"AAA": False, "BBB": False, "CCC": True}

        ws.send_json({"type": "speed", "value": 8, "id": 8})
        assert frames_until(ws, lambda m: m.get("ack") == 8)["speed"] == 8


def test_websocket_plays(client):
    with client.websocket_connect("/ws/replay/2030/1?speed=4") as ws:
        ws.receive_json()
        first = ws.receive_json()
        later = [ws.receive_json() for _ in range(5)]
        assert later[-1]["playing"] and later[-1]["t"] > first["t"]
        assert later[-1]["seq"] > first["seq"]


def test_websocket_rejects_bad_commands(client):
    with client.websocket_connect("/ws/replay/2030/1?autoplay=false") as ws:
        ws.receive_json(), ws.receive_json()
        ws.send_text("not json")
        assert frames_until(ws, lambda m: m["type"] == "error")
        ws.send_json({"type": "warp"})
        assert frames_until(ws, lambda m: m["type"] == "error")
        ws.send_json({"type": "seek"})
        err = frames_until(ws, lambda m: m["type"] == "error")
        assert "needs 't'" in err["message"]


def test_websocket_unprepared_race(client):
    with client.websocket_connect("/ws/replay/2030/2") as ws:
        assert ws.receive_json() == {"type": "error", "message": "race not prepared"}


# --- background jobs -------------------------------------------------------

def fake_prepare(year, round_number, session_type, q):
    """Stands in for the real pipeline: reports progress, saves a fake race."""
    from src.race_store import save_race
    q.put(("progress", "Pretending to work", 0.5))
    save_race(make_full_race(year, round_number), year, round_number, session_type)
    q.put(("done",))


def failing_prepare(year, round_number, session_type, q):
    q.put(("error", "ValueError: no data"))


def wait_for(jobs, *key, states=("ready", "error"), timeout=30):
    deadline = time.time() + timeout
    while time.time() < deadline:
        status = jobs.status(*key)
        if status["state"] in states:
            return status
        time.sleep(0.1)
    raise AssertionError(f"job still {status}")


def test_prepare_job_success(data_dir):
    from backend.jobs import PrepareJobs
    jobs = PrepareJobs(target=fake_prepare)
    assert jobs.status(2030, 5)["state"] == "missing"
    assert jobs.start(2030, 5)["state"] == "preparing"
    assert jobs.start(2030, 5)["state"] in ("preparing", "ready")  # no duplicate job
    assert wait_for(jobs, 2030, 5)["state"] == "ready"


def test_prepare_job_failure(data_dir):
    from backend.jobs import PrepareJobs
    jobs = PrepareJobs(target=failing_prepare)
    jobs.start(2030, 6)
    status = wait_for(jobs, 2030, 6)
    assert status["state"] == "error" and "no data" in status["error"]
