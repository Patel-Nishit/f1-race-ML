"use client";

// Live leaderboard. Rows are keyed by driver code and use motion's `layout`
// animation: when two drivers swap places, React re-orders the list and each
// row slides from its old position to its new one (the FLIP technique:
// measure First and Last positions, Invert with a transform, then Play).
// After a jump (seek, lap skip) the whole order changes at once; animating
// 20 rows flying about is noise, so we snap instead, just like the canvas.
import { motion } from "motion/react";
import { useReplayStore } from "@/lib/replayStore";
import { TYRE_COLOURS } from "@/lib/status";
import type { DriverMeta } from "@/lib/types";
import { useUiStore } from "@/lib/uiStore";

export function Leaderboard({ drivers }: { drivers: DriverMeta[] }) {
  const rows = useReplayStore((s) => s.buffer.latest?.drivers);
  // applyFrame makes prev === latest when a command's answer arrives (a jump)
  const jumped = useReplayStore((s) => s.buffer.prev === s.buffer.latest);
  const selected = useUiStore((s) => s.selected);
  const toggleDriver = useUiStore((s) => s.toggleDriver);
  const showGaps = useUiStore((s) => s.tools.gaps);
  const info = new Map(drivers.map((d) => [d.code, d]));

  return (
    <aside className="flex min-h-0 flex-col border-l border-line/60 bg-panel [grid-area:side]" aria-label="Leaderboard">
      <div className="flex items-baseline justify-between px-4 pb-2 pt-3">
        <h2 className="text-xs font-bold tracking-wider text-dim">LEADERBOARD</h2>
        <span className="text-[11px] text-faint">click for telemetry</span>
      </div>
      <ol className="min-h-0 flex-1 overflow-y-auto px-2 pb-2">
        {(rows ?? []).map((d) => {
          const meta = info.get(d.code);
          const isSelected = selected.includes(d.code);
          const status = d.out ? "OUT"
            : d.laps_down ? `+${d.laps_down} LAP`
            : !showGaps ? ""
            : d.position === 1 ? "LEADER"
            : d.gap != null ? `+${d.gap.toFixed(1)}` : "";
          return (
            <motion.li key={d.code} layout="position"
              transition={jumped ? { duration: 0 } : { type: "spring", stiffness: 500, damping: 45 }}>
              <button
                onClick={() => toggleDriver(d.code)}
                aria-pressed={isSelected}
                title={meta ? `${meta.name} · ${meta.team}` : d.code}
                className={`grid w-full grid-cols-[2rem_4px_1fr_1.75rem_4.5rem] items-center gap-2.5 rounded px-2 py-1.5 text-left
                  ${isSelected ? "bg-panel-light ring-1 ring-ink/70" : "hover:bg-panel-light/60"}
                  ${d.out ? "text-faint" : ""}`}
              >
                <span className="text-right font-mono font-bold tabular-nums">{d.position}</span>
                <span className="h-5 rounded-sm" style={{ background: d.out ? "var(--ink-3)" : meta?.color }} />
                <span className="flex items-center gap-1.5 font-bold tracking-wide">
                  {d.code}
                  {d.drs_open && !d.out && (
                    <span className="rounded-sm bg-ok px-1 text-[9px] font-black leading-tight text-black">DRS</span>
                  )}
                </span>
                <TyreBadge compound={d.tyre} dim={d.out} />
                <span className={`text-right font-mono text-xs font-bold tabular-nums ${
                  d.out ? "text-f1" : "text-dim"}`}>
                  {status}
                </span>
              </button>
            </motion.li>
          );
        })}
      </ol>
    </aside>
  );
}

function TyreBadge({ compound, dim }: { compound: string; dim: boolean }) {
  const colour = dim ? "var(--ink-3)" : TYRE_COLOURS[compound] ?? TYRE_COLOURS.UNKNOWN;
  return (
    <span
      className="flex h-6 w-6 items-center justify-center rounded-full border-[2.5px] bg-black text-xs font-black leading-none"
      style={{ borderColor: colour, color: colour }}
      title={compound.toLowerCase()}
      aria-label={`${compound.toLowerCase()} tyres`}
    >
      {compound === "UNKNOWN" ? "?" : compound[0]}
    </span>
  );
}
