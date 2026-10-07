"use client";

// The timing tower: live order, tyres, gaps. Rows are keyed by driver code
// and use motion's `layout` animation: when two drivers swap places, each row
// slides from its old position to its new one (the FLIP technique: measure
// First and Last positions, Invert with a transform, then Play). After a jump
// (seek, lap skip) the whole order changes at once; animating 20 rows flying
// about is noise, so we snap instead, just like the canvas.
import { motion } from "motion/react";
import { useReplayStore } from "@/lib/replayStore";
import { TYRE_COLOURS } from "@/lib/status";
import type { DriverMeta } from "@/lib/types";
import { useUiStore } from "@/lib/uiStore";

export function Leaderboard({ drivers, className = "" }: { drivers: DriverMeta[]; className?: string }) {
  const rows = useReplayStore((s) => s.buffer.latest?.drivers);
  // applyFrame makes prev === latest when a command's answer arrives (a jump)
  const jumped = useReplayStore((s) => s.buffer.prev === s.buffer.latest);
  const selected = useUiStore((s) => s.selected);
  const toggleDriver = useUiStore((s) => s.toggleDriver);
  const showGaps = useUiStore((s) => s.tools.gaps);
  const info = new Map(drivers.map((d) => [d.code, d]));

  return (
    <aside aria-label="Leaderboard" className={`flex min-h-0 flex-col ${className}`}>
      {/* on phones the "Timing tower" tab already names this panel */}
      <div className="hidden items-baseline justify-between px-3 pb-1.5 pt-3 lg:flex">
        <h2 className="text-sm font-semibold">Timing tower</h2>
        <span className="text-xs text-faint">Select for telemetry</span>
      </div>
      <ol className="min-h-0 flex-1 overflow-y-auto px-1.5 pb-1.5">
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
                title={meta ? `${meta.name}, ${meta.team}` : d.code}
                className={`grid w-full grid-cols-[2.1rem_3px_1fr_1.6rem_4.25rem] items-center gap-2.5 rounded-ui px-1.5 py-[3px] text-left
                  ${isSelected ? "bg-panel-light" : "hover:bg-panel-light/70"} ${d.out ? "text-faint" : ""}`}
                style={isSelected ? { boxShadow: `inset 3px 0 0 ${meta?.color ?? "var(--ink)"}` } : undefined}
              >
                <span className={`chip-slant py-0.5 text-center font-mono text-sm font-bold tabular-nums ${
                  d.position === 1 && !d.out ? "bg-f1 text-white" : "bg-panel-light"}`}>
                  <span className="chip-slant-text">{d.position}</span>
                </span>
                <span className="h-5 rounded-[1px]" style={{ background: d.out ? "var(--ink-3)" : meta?.color }} />
                <span className="flex items-center gap-1.5 font-bold tracking-wide">
                  {d.code}
                  {d.drs_open && !d.out && (
                    <span className="rounded-[2px] bg-ok px-1 text-[9px] font-black leading-tight text-black">DRS</span>
                  )}
                </span>
                <TyreBadge compound={d.tyre} dim={d.out} />
                <span className={`text-right font-mono text-xs font-semibold tabular-nums ${
                  d.out ? "text-f1-ink" : status === "LEADER" ? "text-ink" : "text-dim"}`}>
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
  // tyres are black in both themes; the coloured ring is the compound
  return (
    <span
      className="flex h-[22px] w-[22px] items-center justify-center rounded-full border-[2.5px] bg-[#16171c] text-[11px] font-black leading-none"
      style={{ borderColor: colour, color: colour }}
      title={compound.toLowerCase()}
      aria-label={`${compound.toLowerCase()} tyres`}
    >
      {compound === "UNKNOWN" ? "?" : compound[0]}
    </span>
  );
}
