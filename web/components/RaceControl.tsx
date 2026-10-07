"use client";

import { formatRaceTime } from "@/lib/format";
import { useReplayStore } from "@/lib/replayStore";
import { TRACK_STATUS } from "@/lib/status";
import type { RaceMeta } from "@/lib/types";
import { EmptyHint, InsightCard } from "./InsightCard";

export function RaceControl({ meta }: { meta: RaceMeta }) {
  const seconds = useReplayStore((s) => Math.floor(s.buffer.latest?.t ?? 0));
  const weather = useReplayStore((s) => s.buffer.latest?.weather);
  // only what has happened so far: no spoilers
  const past = meta.track_status_changes.filter((c) => c.t >= 0 && c.t <= seconds).slice(-6).reverse();

  return (
    <InsightCard title="Race control & weather">
      {weather && (
        <dl className="mb-3 grid grid-cols-4 gap-2 text-sm">
          {[
            ["Air", `${weather.air_temp.toFixed(1)}°C`],
            ["Track", weather.track_temp != null ? `${weather.track_temp.toFixed(1)}°C` : "-"],
            ["Humidity", weather.humidity != null ? `${weather.humidity.toFixed(0)}%` : "-"],
            ["Rain", weather.raining ? "Yes" : "Dry"],
          ].map(([label, value]) => (
            <div key={label}>
              <dt className="text-xs text-dim">{label}</dt>
              <dd className="font-mono font-semibold tabular-nums">{value}</dd>
            </div>
          ))}
        </dl>
      )}
      {past.length === 0 ? (
        <EmptyHint>No flags yet.</EmptyHint>
      ) : (
        <ol className="space-y-0.5 text-sm" aria-label="Flag changes, newest first">
          {past.map((c) => {
            const info = TRACK_STATUS[c.status];
            return (
              <li key={c.t} className="flex items-center gap-2">
                <span className="w-14 text-right font-mono text-xs tabular-nums text-dim">{formatRaceTime(c.t)}</span>
                <span className="h-2.5 w-2.5 rounded-full" style={{ background: info?.color ?? "var(--ink-2)" }} />
                <span>{info?.label ?? c.status}</span>
              </li>
            );
          })}
        </ol>
      )}
    </InsightCard>
  );
}
