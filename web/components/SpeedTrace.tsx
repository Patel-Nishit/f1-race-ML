"use client";

// Speed over the last 60 s for the selected drivers.
//
// Chart rules followed (see docs/12): one y-axis only (speed; throttle and
// brake live in the telemetry card, not on a second axis); 2 px lines;
// hairline solid gridlines; a legend for 2 series. Teammates share a team
// colour, so the second driver's line is dashed: identity never depends on
// colour alone. Text stays in text colours; colour sits on the marks.
import { useState } from "react";
import { linePath, nearestIndex, scale, ticks } from "@/lib/charts";
import type { DriverMeta, TelemetryWindow } from "@/lib/types";
import { useUiStore } from "@/lib/uiStore";
import { EmptyHint, InsightCard } from "./InsightCard";
import { useTelemetryWindow } from "./useTelemetryWindow";

const WINDOW_S = 60;
const W = 300, H = 150;
const M = { left: 30, right: 8, top: 8, bottom: 18 };
const MAX_SPEED = 350;
const DASH = ["", "5 3"]; // 1st driver solid, 2nd dashed

export function SpeedTrace({ year, round, drivers }: { year: number; round: number; drivers: DriverMeta[] }) {
  const selected = useUiStore((s) => s.selected);
  const { data, loading } = useTelemetryWindow(year, round, selected, WINDOW_S);
  const [hoverT, setHoverT] = useState<number | null>(null);
  const colour = new Map(drivers.map((d) => [d.code, d.color]));

  const series = data.filter((w) => w.t.length > 1 && selected.includes(w.code));
  if (selected.length === 0) {
    return <InsightCard title="Speed trace"><EmptyHint>Select a driver to see their speed trace.</EmptyHint></InsightCard>;
  }

  const tEnd = Math.max(...series.map((w) => w.t[w.t.length - 1]), WINDOW_S);
  const tStart = tEnd - WINDOW_S;
  const x = scale(tStart, tEnd, M.left, W - M.right);
  const y = scale(0, MAX_SPEED, H - M.bottom, M.top);
  const toT = scale(M.left, W - M.right, tStart, tEnd); // inverse of x, for the crosshair

  const readout = (w: TelemetryWindow, t: number) => {
    const i = nearestIndex(w.t, t);
    return i < 0 ? null : { t: w.t[i], speed: w.speed[i] };
  };
  const shownT = hoverT ?? tEnd;
  const order = (code: string) => selected.indexOf(code);

  return (
    <InsightCard title="Speed trace" aside={<span className="text-[11px] text-faint">last {WINDOW_S} s</span>}>
      {/* Legend: line key in the series colour, text in text colours, current value */}
      <div className="mb-1 flex gap-4 text-xs">
        {series.map((w) => {
          const r = readout(w, shownT);
          return (
            <span key={w.code} className="flex items-center gap-1.5">
              <svg width="18" height="6" aria-hidden="true">
                <line x1="0" y1="3" x2="18" y2="3" stroke={colour.get(w.code)} strokeWidth="2"
                  strokeDasharray={DASH[order(w.code)]} />
              </svg>
              <span className="font-bold text-ink">{w.code}</span>
              <span className="font-mono tabular-nums text-dim">{r ? `${Math.round(r.speed)} km/h` : "–"}</span>
            </span>
          );
        })}
      </div>

      <div className="relative">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className={`w-full transition-opacity ${loading && series.length ? "opacity-90" : ""}`}
          role="img"
          tabIndex={0}
          aria-label={`Speed over the last ${WINDOW_S} seconds for ${series.map((w) => w.code).join(" and ")}`}
          onPointerMove={(e) => {
            const box = e.currentTarget.getBoundingClientRect();
            const px = ((e.clientX - box.left) / box.width) * W;
            setHoverT(px >= M.left ? Math.min(tEnd, toT(px)) : null);
          }}
          onPointerLeave={() => setHoverT(null)}
          onFocus={() => setHoverT(tEnd)}
          onBlur={() => setHoverT(null)}
        >
          {/* hairline, solid, recessive gridlines + y ticks */}
          {ticks(MAX_SPEED, 100).map((v) => (
            <g key={v}>
              <line x1={M.left} x2={W - M.right} y1={y(v)} y2={y(v)} stroke="#2c2f3a" strokeWidth="1" />
              <text x={M.left - 4} y={y(v) + 3} textAnchor="end" fontSize="9" fill="#969aaa">{v}</text>
            </g>
          ))}
          {[tStart, tStart + WINDOW_S / 2, tEnd].map((t, i) => (
            <text key={i} x={x(t)} y={H - 4} fontSize="9" fill="#969aaa"
              textAnchor={i === 0 ? "start" : i === 2 ? "end" : "middle"}>
              {i === 2 ? "now" : `−${Math.round(tEnd - t)} s`}
            </text>
          ))}

          {series.map((w) => {
            const keep = w.t.map((t, i) => (t >= tStart ? i : -1)).filter((i) => i >= 0);
            return (
              <path key={w.code} d={linePath(keep.map((i) => x(w.t[i])), keep.map((i) => y(w.speed[i])))}
                fill="none" stroke={colour.get(w.code)} strokeWidth="2" strokeLinejoin="round"
                strokeLinecap="round" strokeDasharray={DASH[order(w.code)]} />
            );
          })}

          {/* crosshair: a hairline that snaps to the nearest sample, plus ringed dots */}
          {hoverT !== null && (
            <g>
              <line x1={x(hoverT)} x2={x(hoverT)} y1={M.top} y2={H - M.bottom} stroke="#ecedf2" strokeWidth="1" />
              {series.map((w) => {
                const r = readout(w, hoverT);
                return r && (
                  <circle key={w.code} cx={x(r.t)} cy={y(r.speed)} r="4" fill={colour.get(w.code)}
                    stroke="#1a1c24" strokeWidth="2" />
                );
              })}
            </g>
          )}
        </svg>

        {/* Tooltip: every series at that moment; value strong, name secondary */}
        {hoverT !== null && series.length > 0 && (
          <div role="status" className="pointer-events-none absolute top-1 rounded border border-line bg-bg/95 px-2 py-1 text-xs shadow"
            style={x(hoverT) > W / 2 ? { right: `${(1 - (x(hoverT) - 8) / W) * 100}%` } : { left: `${((x(hoverT) + 8) / W) * 100}%` }}>
            <p className="mb-0.5 text-[10px] text-faint">−{Math.max(0, tEnd - hoverT).toFixed(1)} s</p>
            {series.map((w) => {
              const r = readout(w, hoverT);
              return (
                <p key={w.code} className="flex items-center gap-1.5 whitespace-nowrap">
                  <svg width="12" height="4" aria-hidden="true">
                    <line x1="0" y1="2" x2="12" y2="2" stroke={colour.get(w.code)} strokeWidth="2"
                      strokeDasharray={DASH[order(w.code)] ? "3 2" : ""} />
                  </svg>
                  <b className="font-mono tabular-nums text-ink">{r ? Math.round(r.speed) : "–"}</b>
                  <span className="text-dim">{w.code}</span>
                </p>
              );
            })}
          </div>
        )}
      </div>
    </InsightCard>
  );
}
