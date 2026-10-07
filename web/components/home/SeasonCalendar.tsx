"use client";

// Season calendar: pick a season, see every round grouped by month, prepare
// races (with a live progress bar) and open the ready ones.
import Link from "next/link";
import { ArrowClockwiseIcon, ArrowRightIcon, DownloadSimpleIcon } from "@phosphor-icons/react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useCallback, useEffect, useRef, useState } from "react";
import { api, ApiError } from "@/lib/api";
import { eventDate } from "@/lib/format";
import { EASE_OUT, from } from "@/lib/motion";
import type { PrepareStatus, SeasonEvent } from "@/lib/types";

const FIRST_SEASON = 2018;
const LAST_SEASON = 2026;
const SEASONS = Array.from({ length: LAST_SEASON - FIRST_SEASON + 1 }, (_, i) => LAST_SEASON - i);
const POLL_MS = 1000;

export function SeasonCalendar() {
  const [year, setYear] = useState(2024);
  const [reload, setReload] = useState(0);
  const [events, setEvents] = useState<SeasonEvent[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<Record<number, PrepareStatus>>({});
  // A public demo server can switch preparation off (F1_ALLOW_PREPARE=false).
  const [canPrepare, setCanPrepare] = useState(true);

  useEffect(() => {
    api.health().then((h) => setCanPrepare(h.prepare_enabled)).catch(() => {});
  }, []);

  // Load the season calendar whenever the year changes (or Retry is pressed).
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
  }, [year, reload]);

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

  const chooseSeason = (y: number) => {
    setYear(y);
    setEvents(null);
    setProgress({});
  };

  // group rounds by month, in calendar order
  const months: { month: string; events: SeasonEvent[] }[] = [];
  for (const ev of events ?? []) {
    const { month } = eventDate(ev.date);
    const last = months[months.length - 1];
    if (last && last.month === month) last.events.push(ev);
    else months.push({ month, events: [ev] });
  }

  return (
    <section aria-labelledby="calendar-heading" className="mx-auto w-full max-w-[1400px] px-4 md:px-8">
      <h2 id="calendar-heading" className="text-3xl font-bold tracking-tight">Every race since 2018</h2>
      <SeasonStrip year={year} onChoose={chooseSeason} />

      {!canPrepare && (
        <p className="mt-6 max-w-[70ch] text-sm text-dim">
          This is a demo server, so only the races marked &ldquo;Watch replay&rdquo; are available. Run the project
          locally to replay any race since 2018.
        </p>
      )}

      {error && events && events.length > 0 && (
        <p className="mt-6 rounded-ui border border-f1/50 bg-f1/10 px-4 py-3 text-sm" role="alert">{error}</p>
      )}

      <div className="mt-10">
        {events === null ? (
          <CalendarSkeleton />
        ) : events.length === 0 ? (
          <div className="flex flex-col items-start gap-4 rounded-ui border border-dashed border-line p-8" role="alert">
            <p className="max-w-[60ch] text-dim">Couldn&apos;t load the {year} calendar. {error}</p>
            <button onClick={() => setReload((n) => n + 1)}
              className="inline-flex items-center gap-2 rounded-ui border border-line px-4 py-2 text-sm font-semibold hover:border-ink">
              <ArrowClockwiseIcon size={16} aria-hidden="true" /> Try again
            </button>
          </div>
        ) : (
          <div className="grid gap-x-16 gap-y-10 xl:grid-cols-2">
            {months.map(({ month, events: monthEvents }) => (
              <section key={month} aria-label={`${month} ${year}`}>
                <h3 className="mb-2 text-sm font-semibold text-dim">{month}</h3>
                <ul className="flex flex-col gap-1">
                  {monthEvents.map((ev) => (
                    <RoundRow key={ev.round_number} year={year} event={ev} status={progress[ev.round_number]}
                      onPrepare={() => prepare(ev.round_number)} canPrepare={canPrepare} />
                  ))}
                </ul>
              </section>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

/** Seasons as a row of tabs. Arrow keys move between them (roving focus). */
function SeasonStrip({ year, onChoose }: { year: number; onChoose: (y: number) => void }) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const onKeyDown = (e: React.KeyboardEvent) => {
    const i = SEASONS.indexOf(year);
    const next = e.key === "ArrowRight" ? i + 1 : e.key === "ArrowLeft" ? i - 1
      : e.key === "Home" ? 0 : e.key === "End" ? SEASONS.length - 1 : null;
    if (next === null) return;
    e.preventDefault();
    const clamped = Math.max(0, Math.min(SEASONS.length - 1, next));
    onChoose(SEASONS[clamped]);
    refs.current[clamped]?.focus();
  };
  return (
    <div role="tablist" aria-label="Season" onKeyDown={onKeyDown}
      className="-mx-4 mt-6 flex snap-x gap-1 overflow-x-auto px-4 pb-2 md:mx-0 md:px-0">
      {SEASONS.map((y, i) => {
        const selected = y === year;
        return (
          <button
            key={y}
            ref={(el) => { refs.current[i] = el; }}
            role="tab"
            aria-selected={selected}
            tabIndex={selected ? 0 : -1}
            onClick={() => onChoose(y)}
            className={`relative shrink-0 snap-start px-4 py-2 font-mono text-2xl font-bold tabular-nums transition-colors md:text-3xl ${
              selected ? "text-ink" : "text-faint hover:text-dim"}`}
          >
            {y}
            {selected && <span aria-hidden="true" className="chip-slant absolute inset-x-3 bottom-0 h-1 bg-f1" />}
          </button>
        );
      })}
    </div>
  );
}

function RoundRow({ year, event, status, onPrepare, canPrepare }: {
  year: number;
  event: SeasonEvent;
  status?: PrepareStatus;
  onPrepare: () => void;
  canPrepare: boolean;
}) {
  const state = status?.state ?? event.status;
  const upcoming = new Date(event.date) > new Date();
  const ready = state === "ready";
  // one key per visible state, so only real changes (prepare, progress, ready) animate
  const reduce = useReducedMotion();
  const cellKey = state === "missing" ? (upcoming ? "upcoming" : canPrepare ? "prepare" : "demo") : state;

  return (
    <li className="grid grid-cols-[3rem_1fr_auto] items-center gap-4 rounded-ui px-3 py-3 transition-colors hover:bg-panel">
      <span className={`font-mono text-2xl font-bold tabular-nums transition-colors duration-300 ${ready ? "text-f1-ink" : "text-faint"}`}>
        {String(event.round_number).padStart(2, "0")}
      </span>
      <div className="min-w-0">
        <p className="truncate font-semibold leading-tight">{event.event_name}</p>
        <p className="text-sm text-dim">{event.country}, {eventDate(event.date).short}</p>
      </div>
      {/* Status changes settle in from the right instead of swapping (plans/007).
          initial={false}: page load and season switches show rows without animating. */}
      <div className="relative flex justify-end">
       <AnimatePresence mode="popLayout" initial={false}>
        <motion.div
          key={cellKey}
          data-enter
          className="flex origin-right justify-end"
          initial={{ opacity: 0, transform: from("scale(0.96)", reduce) }}
          animate={{ opacity: 1, transform: from("scale(1)", reduce), transition: { duration: 0.22, ease: EASE_OUT } }}
          exit={{ opacity: 0, transition: { duration: 0.12, ease: EASE_OUT } }}
        >
        {ready && (
          <Link href={`/replay/${year}/${event.round_number}`}
            className="pressable inline-flex items-center gap-1.5 whitespace-nowrap rounded-ui bg-f1 px-3.5 py-1.5 text-sm font-semibold text-white hover:bg-f1-hover">
            Watch replay <ArrowRightIcon size={14} weight="bold" aria-hidden="true" />
          </Link>
        )}
        {state === "missing" && !upcoming && canPrepare && (
          <button onClick={onPrepare}
            className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-ui border border-line px-3.5 py-1.5 text-sm font-semibold hover:border-ink">
            <DownloadSimpleIcon size={14} weight="bold" aria-hidden="true" /> Prepare race
          </button>
        )}
        {state === "missing" && !upcoming && !canPrepare && (
          <span className="text-sm text-faint">Not in this demo</span>
        )}
        {state === "missing" && upcoming && <span className="text-sm text-faint">Not raced yet</span>}
        {state === "preparing" && (
          <div className="w-40" aria-live="polite">
            <div className="h-1.5 overflow-hidden rounded-[2px] bg-panel-light">
              {/* scaleX, not width: transform skips layout (plans/005) */}
              <div className="h-full w-full origin-left bg-f1 transition-transform duration-300 ease-out"
                style={{ transform: `scaleX(${status?.progress ?? 0})` }} />
            </div>
            <p className="mt-1.5 truncate text-xs text-dim">{status?.stage || "Starting"}…</p>
          </div>
        )}
        {state === "error" && (
          <div className="text-right">
            <p className="max-w-56 truncate text-xs text-f1-ink" title={status?.error}>
              {status?.error || "Preparation failed"}
            </p>
            <button onClick={onPrepare} className="mt-1 text-sm font-semibold underline underline-offset-4">Try again</button>
          </div>
        )}
        </motion.div>
       </AnimatePresence>
      </div>
    </li>
  );
}

function CalendarSkeleton() {
  return (
    <div className="grid gap-x-16 gap-y-10 xl:grid-cols-2" aria-label="Loading the calendar">
      {[0, 1].map((col) => (
        <div key={col} className="flex flex-col gap-3">
          <div className="skeleton h-4 w-20" />
          {[0, 1, 2, 3].map((i) => <div key={i} className="skeleton h-14" />)}
        </div>
      ))}
    </div>
  );
}
