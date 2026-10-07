"use client";

// Tyre strategy so far: one row per driver (in race order), one bar segment
// per stint. Compound colours follow Pirelli's convention, which F1 viewers
// already know. The palette check flagged white (hard) and yellow (medium) as
// too light and soft/intermediate as close for deuteranopes, so every
// segment also carries its letter, and there's a legend and a tooltip.
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { scale, stintsSoFar, textOn, ticks } from "@/lib/charts";
import { useReplayStore } from "@/lib/replayStore";
import { TYRE_COLOURS } from "@/lib/status";
import type { Stint, Strategy } from "@/lib/types";
import { EmptyHint, InsightCard } from "./InsightCard";

const W = 300;
const LABEL = 34; // driver code column
const ROW = 14;
const BAR = 10; // thin bars (<= 24 px), leaving air between rows
const GAP = 2; // surface gap between stints
const COMPOUNDS = ["SOFT", "MEDIUM", "HARD", "INTERMEDIATE", "WET"] as const;

interface Hover { code: string; stint: Stint; x: number; y: number }

export function TyreStrategy({ year, round, totalLaps }: { year: number; round: number; totalLaps: number }) {
  const [strategy, setStrategy] = useState<Strategy | null>(null);
  const [hover, setHover] = useState<Hover | null>(null);
  const rows = useReplayStore((s) => s.buffer.latest?.drivers);
  const leaderLap = useReplayStore((s) => s.buffer.latest?.lap ?? 1);

  useEffect(() => {
    let cancelled = false;
    api.strategy(year, round).then((s) => !cancelled && setStrategy(s)).catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [year, round]);

  if (!strategy || !rows) return <InsightCard title="Tyre strategy"><EmptyHint>Loading…</EmptyHint></InsightCard>;

  const height = rows.length * ROW + 16;
  const x = scale(0, totalLaps, LABEL, W - 4);
  // a bar covers whole laps: lap n spans [n-1, n]
  const segment = (s: Stint) => ({ x0: x(s.start_lap - 1), x1: x(s.end_lap) });

  return (
    <InsightCard title="Tyre strategy" aside={<span className="text-[11px] text-faint">so far · lap {leaderLap}</span>}>
      <div className="mb-1.5 flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] text-dim">
        {COMPOUNDS.map((c) => (
          <span key={c} className="flex items-center gap-1">
            <span className="inline-block h-2.5 w-3.5 rounded-sm" style={{ background: TYRE_COLOURS[c] }} />
            {c[0] + c.slice(1).toLowerCase()}
          </span>
        ))}
      </div>
      <div className="relative">
        <svg viewBox={`0 0 ${W} ${height}`} className="w-full" role="img"
          aria-label="Tyre strategy so far for every driver">
          {/* current lap marker */}
          <line x1={x(leaderLap)} x2={x(leaderLap)} y1={0} y2={rows.length * ROW} stroke="#5f6373" strokeWidth="1" />
          {rows.map((d, i) => {
            const stints = stintsSoFar(strategy[d.code] ?? [], d.lap);
            const yMid = i * ROW + ROW / 2;
            const description = stints.map((s) =>
              `${s.compound.toLowerCase()} laps ${s.start_lap}–${s.end_lap}`).join(", ");
            return (
              <g key={d.code} aria-label={`${d.code}: ${description}`} opacity={d.out ? 0.45 : 1}>
                <text x={0} y={yMid + 3.5} fontSize="10" fontWeight="700" fill="#ecedf2">{d.code}</text>
                {stints.map((s, k) => {
                  const { x0, x1 } = segment(s);
                  const last = k === stints.length - 1;
                  const left = x0 + (k ? GAP / 2 : 0);
                  const right = x1 - (last ? 0 : GAP / 2);
                  const w = Math.max(1, right - left);
                  const fill = TYRE_COLOURS[s.compound] ?? TYRE_COLOURS.UNKNOWN;
                  const show = () => setHover({ code: d.code, stint: s, x: (left + right) / 2, y: yMid });
                  return (
                    <g key={k} tabIndex={0} role="img"
                      aria-label={`${d.code} ${s.compound.toLowerCase()}, laps ${s.start_lap} to ${s.end_lap}`}
                      onPointerEnter={show} onFocus={show}
                      onPointerLeave={() => setHover(null)} onBlur={() => setHover(null)}
                      className="cursor-default outline-none [&:focus>rect]:stroke-ink">
                      {/* hit area taller than the bar */}
                      <rect x={left} y={yMid - ROW / 2} width={w} height={ROW} fill="transparent" />
                      {/* square at the race start, rounded 4px at the data end (the latest lap) */}
                      <rect x={left} y={yMid - BAR / 2} width={w} height={BAR} fill={fill}
                        rx={last && w > 8 ? 2 : 0} strokeWidth="1.5"
                        opacity={hover && hover.code === d.code && hover.stint === s ? 0.85 : 1} />
                      {last && w > 8 && <rect x={left} y={yMid - BAR / 2} width={4} height={BAR} fill={fill} />}
                      {w >= 12 && (
                        <text x={left + w / 2} y={yMid + 3} textAnchor="middle" fontSize="8" fontWeight="800"
                          fill={textOn(fill)} pointerEvents="none">
                          {s.compound === "UNKNOWN" ? "?" : s.compound[0]}
                        </text>
                      )}
                    </g>
                  );
                })}
              </g>
            );
          })}
          {/* lap axis */}
          {ticks(totalLaps, 10).map((lap) => (
            <text key={lap} x={x(lap)} y={height - 3} fontSize="9" fill="#969aaa" textAnchor="middle">{lap}</text>
          ))}
        </svg>
        {hover && (
          <div role="status"
            className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-full whitespace-nowrap rounded border border-line bg-bg/95 px-2 py-1 text-xs shadow"
            style={{ left: `${(hover.x / W) * 100}%`, top: `${((hover.y - 6) / height) * 100}%` }}>
            <b className="text-ink">{hover.stint.compound[0] + hover.stint.compound.slice(1).toLowerCase()}</b>
            <span className="text-dim"> · {hover.code} · laps {hover.stint.start_lap}–{hover.stint.end_lap}
              {" "}({lapCount(hover.stint)})</span>
          </div>
        )}
      </div>
    </InsightCard>
  );
}

function lapCount(s: Stint): string {
  const n = s.end_lap - s.start_lap + 1;
  return `${n} lap${n === 1 ? "" : "s"}`;
}
