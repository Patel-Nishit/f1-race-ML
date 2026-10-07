"use client";

// The home page: choose a season, see every race and its status, prepare
// races (with a live progress bar) and open them.
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { api, ApiError } from "@/lib/api";
import type { PrepareStatus, SeasonEvent } from "@/lib/types";

const FIRST_SEASON = 2018;
const LAST_SEASON = 2026;
const SEASONS = Array.from({ length: LAST_SEASON - FIRST_SEASON + 1 }, (_, i) => LAST_SEASON - i);
const POLL_MS = 1000;

export function RacePicker() {
  const [year, setYear] = useState(2024);
  const [events, setEvents] = useState<SeasonEvent[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<Record<number, PrepareStatus>>({});
  // A public demo server can switch preparation off (F1_ALLOW_PREPARE=false).
  const [canPrepare, setCanPrepare] = useState(true);

  useEffect(() => {
    api.health().then((h) => setCanPrepare(h.prepare_enabled)).catch(() => {});
  }, []);

  // Load the season calendar whenever the year changes.
  useEffect(() => {
    let cancelled = false; // ignore a slow response for a year we already left
    api.events(year)
      .then((data) => {
        if (cancelled) return;
        setEvents(data);
        setError(null);
        // races already being prepared (e.g. started in another tab) get polled too
        const running = data.filter((e) => e.status === "preparing");
        setProgress(Object.fromEntries(running.map((e) => [e.round_number,
          { state: "preparing", stage: "", progress: 0, error: "" } as PrepareStatus])));
      })
      .catch((e: ApiError) => !cancelled && (setEvents([]), setError(e.message)));
    return () => {
      cancelled = true;
    };
  }, [year]);

  const preparing = Object.entries(progress)
    .filter(([, s]) => s.state === "preparing")
    .map(([round]) => Number(round));

  // Poll the status of races being prepared, once a second. Polling is fine
  // here: it's slow-changing, and only while something is in progress.
  useEffect(() => {
    if (preparing.length === 0) return;
    const timer = setInterval(async () => {
      const updates = await Promise.all(preparing.map((r) => api.status(year, r).catch(() => null)));
      setProgress((old) => {
        const next = { ...old };
        updates.forEach((s, i) => s && (next[preparing[i]] = s));
        return next;
      });
    }, POLL_MS);
    return () => clearInterval(timer);
  }, [year, preparing.join(",")]); // eslint-disable-line react-hooks/exhaustive-deps

  const prepare = useCallback(async (round: number) => {
    try {
      const status = await api.prepare(year, round);
      setProgress((old) => ({ ...old, [round]: status }));
    } catch (e) {
      setError((e as ApiError).message);
    }
  }, [year]);

  return (
    <section>
      <div className="mb-6 flex flex-wrap gap-2" role="tablist" aria-label="Season">
        {SEASONS.map((y) => (
          <button
            key={y}
            role="tab"
            aria-selected={y === year}
            onClick={() => { setYear(y); setEvents(null); setProgress({}); }}
            className={`rounded px-3 py-1.5 text-sm font-semibold transition-colors ${
              y === year ? "bg-f1 text-white" : "bg-panel text-dim hover:bg-panel-light hover:text-ink"
            }`}
          >
            {y}
          </button>
        ))}
      </div>

      {!canPrepare && (
        <p className="mb-6 rounded border border-line bg-panel px-4 py-3 text-sm text-dim">
          This is a demo server: races marked &ldquo;Watch replay&rdquo; are ready. To replay any race since 2018,
          run the project locally (see the README).
        </p>
      )}

      {error && (
        <p className="mb-6 rounded border border-f1/50 bg-f1/10 px-4 py-3 text-sm" role="alert">{error}</p>
      )}

      {events === null ? (
        <p className="text-dim">Loading the {year} calendar…</p>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {events.map((ev) => (
            <EventCard
              key={ev.round_number}
              year={year}
              event={ev}
              status={progress[ev.round_number]}
              onPrepare={() => prepare(ev.round_number)}
              canPrepare={canPrepare}
            />
          ))}
        </ul>
      )}
    </section>
  );
}

function EventCard({ year, event, status, onPrepare, canPrepare }: {
  year: number;
  event: SeasonEvent;
  status?: PrepareStatus;
  onPrepare: () => void;
  canPrepare: boolean;
}) {
  const state = status?.state ?? event.status;
  const upcoming = new Date(event.date) > new Date();

  return (
    <li className="flex flex-col justify-between rounded-lg border border-line/60 bg-panel p-4">
      <div>
        <p className="font-mono text-xs text-faint">ROUND {event.round_number} · {event.date}</p>
        <h2 className="mt-1 text-lg font-bold leading-tight">{event.event_name}</h2>
        <p className="text-sm text-dim">{event.country}</p>
      </div>

      <div className="mt-4">
        {state === "ready" && (
          <Link
            href={`/replay/${year}/${event.round_number}`}
            className="inline-block rounded bg-f1 px-4 py-1.5 text-sm font-bold text-white hover:bg-red-700"
          >
            Watch replay
          </Link>
        )}
        {state === "missing" && !upcoming && !canPrepare && (
          <p className="text-sm text-faint">Not in this demo</p>
        )}
        {state === "missing" && !upcoming && canPrepare && (
          <button onClick={onPrepare}
            className="rounded bg-panel-light px-4 py-1.5 text-sm font-semibold hover:bg-line">
            Prepare race
          </button>
        )}
        {state === "missing" && upcoming && <p className="text-sm text-faint">Not raced yet</p>}
        {state === "preparing" && (
          <div aria-live="polite">
            <div className="h-1.5 overflow-hidden rounded bg-panel-light">
              <div className="h-full bg-f1 transition-[width] duration-500"
                style={{ width: `${Math.round((status?.progress ?? 0) * 100)}%` }} />
            </div>
            <p className="mt-1.5 text-xs text-dim">{status?.stage || "Starting"}…</p>
          </div>
        )}
        {state === "error" && (
          <div>
            <p className="text-xs text-f1">{status?.error || "Preparation failed"}</p>
            <button onClick={onPrepare} className="mt-1 text-sm font-semibold underline">Try again</button>
          </div>
        )}
      </div>
    </li>
  );
}
