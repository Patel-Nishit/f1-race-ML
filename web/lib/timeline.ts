// Things drawn along the playback timeline.

export interface Segment {
  start: number;
  end: number;
  status: number;
}

/**
 * Periods of safety car (4), red flag (5) and VSC (6/7) as [start, end)
 * ranges, from the list of status changes. Shown as coloured bands on the
 * timeline so you can jump straight to the action.
 */
export function neutralisedPeriods(changes: { t: number; status: number }[], duration: number): Segment[] {
  const segments: Segment[] = [];
  const sorted = [...changes].sort((a, b) => a.t - b.t);
  sorted.forEach((change, i) => {
    if (![4, 5, 6, 7].includes(change.status)) return;
    const start = Math.max(0, change.t);
    const end = Math.min(duration, i + 1 < sorted.length ? sorted[i + 1].t : duration);
    if (end <= start) return;
    const status = change.status === 7 ? 6 : change.status; // VSC ending counts as VSC
    const last = segments[segments.length - 1];
    if (last && last.status === status && Math.abs(last.end - start) < 1e-6) last.end = end; // merge
    else segments.push({ start, end, status });
  });
  return segments;
}

/** Replay times of every `every`-th lap start (for tick marks). */
export function lapTicks(lapStarts: number[], every = 5): { lap: number; t: number }[] {
  return lapStarts
    .map((t, i) => ({ lap: i + 1, t }))
    .filter(({ lap }) => lap > 1 && lap % every === 0);
}

/** Which lap the leader was on at replay time t (1-based). */
export function lapAt(lapStarts: number[], t: number): number {
  let lap = 1;
  for (let i = 0; i < lapStarts.length; i++) if (lapStarts[i] <= t) lap = i + 1;
  return lap;
}
