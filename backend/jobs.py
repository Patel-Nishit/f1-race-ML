"""Background race preparation with progress reporting.

Preparing a race takes minutes, far too long for one HTTP request. So:

  POST .../prepare   starts a job and returns immediately (202 Accepted)
  GET  .../status    is polled by the browser to draw a progress bar

Each job runs in its own *process*: the pipeline is CPU-heavy, uses its own
multiprocessing pool, and if it crashes it can't take the web server down.
The child reports progress through a multiprocessing Queue; a small thread
in the server reads that queue and updates the job's state.
"""

import multiprocessing as mp
import queue
import threading
import time
import traceback
from dataclasses import asdict, dataclass

from src.race_store import is_prepared, race_key


def run_prepare(year, round_number, session_type, progress_queue):
    """Runs in the child process. Must be top-level so it can be imported there."""
    try:
        from src.f1_data import prepare_race

        prepare_race(year, round_number, session_type,
                     progress=lambda stage, frac: progress_queue.put(("progress", stage, frac)))
        progress_queue.put(("done",))
    except Exception as e:  # report any failure back to the server
        traceback.print_exc()
        progress_queue.put(("error", f"{type(e).__name__}: {e}"))


@dataclass
class JobState:
    state: str            # "preparing" | "ready" | "error"
    stage: str = ""
    progress: float = 0.0
    error: str = ""
    started_at: float = 0.0


class PrepareJobs:
    def __init__(self, target=run_prepare):
        self.target = target
        self.jobs = {}
        self.lock = threading.Lock()  # jobs is touched by request handlers and watcher threads
        # "spawn" starts a clean Python process instead of copying (forking)
        # the running server, which is the safe choice when threads exist.
        self.ctx = mp.get_context("spawn")

    def status(self, year, round_number, session_type="R") -> dict:
        key = race_key(year, round_number, session_type)
        with self.lock:
            job = self.jobs.get(key)
            if job and job.state != "ready":
                return asdict(job)
        if is_prepared(year, round_number, session_type):
            return asdict(JobState(state="ready", stage="Done", progress=1.0))
        return asdict(JobState(state="missing"))

    def start(self, year, round_number, session_type="R") -> dict:
        key = race_key(year, round_number, session_type)
        with self.lock:
            job = self.jobs.get(key)
            already_running = job is not None and job.state == "preparing"
            if not already_running and not is_prepared(year, round_number, session_type):
                self.jobs[key] = JobState(state="preparing", stage="Starting", started_at=time.time())
                q = self.ctx.Queue()
                proc = self.ctx.Process(target=self.target, args=(year, round_number, session_type, q))
                proc.start()
                threading.Thread(target=self._watch, args=(key, proc, q), daemon=True).start()
        return self.status(year, round_number, session_type)

    def _watch(self, key, proc, q):
        """Copy progress messages from the child process into the job state."""
        while True:
            try:
                msg = q.get(timeout=0.5)
            except queue.Empty:
                if not proc.is_alive():
                    self._update(key, state="error", error=f"worker exited with code {proc.exitcode}")
                    return
                continue
            if msg[0] == "progress":
                self._update(key, stage=msg[1], progress=float(msg[2]))
            elif msg[0] == "done":
                self._update(key, state="ready", stage="Done", progress=1.0)
                proc.join()
                return
            elif msg[0] == "error":
                self._update(key, state="error", error=msg[1])
                proc.join()
                return

    def _update(self, key, **changes):
        with self.lock:
            job = self.jobs[key]
            for name, value in changes.items():
                setattr(job, name, value)
