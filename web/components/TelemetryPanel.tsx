"use client";

// Live numbers for the selected drivers, straight from the stream.
import { useReplayStore } from "@/lib/replayStore";
import { TYRE_COLOURS } from "@/lib/status";
import type { DriverMeta } from "@/lib/types";
import { useUiStore } from "@/lib/uiStore";
import { EmptyHint, InsightCard } from "./InsightCard";

export function TelemetryPanel({ drivers }: { drivers: DriverMeta[] }) {
  const selected = useUiStore((s) => s.selected);
  const rows = useReplayStore((s) => s.buffer.latest?.drivers);
  const info = new Map(drivers.map((d) => [d.code, d]));
  const live = selected.map((code) => rows?.find((d) => d.code === code)).filter((d) => d !== undefined);

  return (
    <InsightCard title="Driver telemetry">
      {live.length === 0 ? (
        <EmptyHint>Select up to two drivers on the leaderboard or the map.</EmptyHint>
      ) : (
        <div className="space-y-2">
          {live.map((d) => {
            const meta = info.get(d.code);
            return (
              <article key={d.code} className="rounded border-l-4 bg-panel-light/60 px-3 py-2"
                style={{ borderColor: meta?.color }} aria-label={`${d.code} telemetry`}>
                <div className="flex items-baseline justify-between">
                  <p className="font-bold">P{d.position} {d.code}
                    <span className="ml-2 text-xs font-normal text-dim">{meta?.name}</span></p>
                  <p className="font-mono text-xs text-dim">LAP {d.lap}</p>
                </div>
                {d.out ? (
                  <p className="py-2 text-2xl font-black text-f1">OUT</p>
                ) : (
                  <>
                    <div className="mt-1 flex items-end justify-between">
                      <p>
                        {/* a big standalone number: proportional figures, not tabular */}
                        <span className="text-3xl font-bold" aria-label="Speed">{Math.round(d.speed)}</span>
                        <span className="ml-1 text-xs text-dim">km/h</span>
                      </p>
                      <div className="flex items-center gap-2 text-sm">
                        <span className="font-bold" aria-label="Gear">GEAR {d.gear}</span>
                        <span className={`rounded px-1.5 text-xs font-bold ${
                          d.drs_open ? "bg-ok text-black" : "bg-panel-light text-faint"}`}
                          aria-label={d.drs_open ? "DRS open" : "DRS closed"}>DRS</span>
                      </div>
                    </div>
                    <Meter label="Throttle" value={d.throttle} colour="#00c85a" />
                    <Meter label="Brake" value={d.brake} colour="#e62828" />
                    <p className="mt-1 text-xs text-dim">
                      Tyre <span className="font-bold" style={{ color: TYRE_COLOURS[d.tyre] }}>●</span>{" "}
                      {d.tyre.toLowerCase()}
                    </p>
                  </>
                )}
              </article>
            );
          })}
        </div>
      )}
    </InsightCard>
  );
}

/** A meter: the fill carries the value; the track is a faint step of the same hue. */
function Meter({ label, value, colour }: { label: string; value: number; colour: string }) {
  const pct = Math.max(0, Math.min(100, value));
  return (
    <div className="mt-1 flex items-center gap-2" role="meter" aria-label={label}
      aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(pct)}>
      <span className="w-14 text-[11px] text-dim">{label}</span>
      <span className="relative h-2 flex-1 overflow-hidden rounded-full" style={{ background: `${colour}33` }}>
        <span className="absolute inset-y-0 left-0 rounded-full" style={{ width: `${pct}%`, background: colour }} />
      </span>
      <span className="w-9 text-right font-mono text-[11px] tabular-nums text-dim">{Math.round(pct)}%</span>
    </div>
  );
}
