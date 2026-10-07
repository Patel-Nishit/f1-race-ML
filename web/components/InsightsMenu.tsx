"use client";

// The Insights dock: analysis tools for the replay. Open when the replay
// starts; "I" or the header toggles it. Enabled tools appear as cards below.
import { CaretDownIcon, ChartLineIcon } from "@phosphor-icons/react";
import type { RaceMeta } from "@/lib/types";
import { TOOLS, useUiStore } from "@/lib/uiStore";
import { RaceControl } from "./RaceControl";
import { SpeedTrace } from "./SpeedTrace";
import { TelemetryPanel } from "./TelemetryPanel";
import { TyreStrategy } from "./TyreStrategy";

export const INSIGHTS_WIDTH = 336; // px; the track is fitted to the space beside it

export function InsightsMenu({ meta, className = "" }: { meta: RaceMeta; className?: string }) {
  const open = useUiStore((s) => s.insightsOpen);
  const toggleOpen = useUiStore((s) => s.toggleInsights);
  const tools = useUiStore((s) => s.tools);
  const toggleTool = useUiStore((s) => s.toggleTool);

  return (
    <div className={`pointer-events-none flex flex-col gap-2 ${className}`}>
      <div className="pointer-events-auto rounded-ui border border-line bg-panel lg:glass">
        <button onClick={toggleOpen} aria-expanded={open} aria-controls="insights-tools"
          className="flex w-full items-center justify-between gap-2 rounded-ui px-3 py-2.5 text-sm font-semibold hover:bg-panel-light/60">
          <span className="flex items-center gap-2">
            <ChartLineIcon size={18} className="text-f1-ink" aria-hidden="true" /> Insights
          </span>
          <span className="flex items-center gap-2 text-xs font-normal text-faint">
            <kbd className="font-mono">I</kbd>
            <CaretDownIcon size={14} weight="bold" aria-hidden="true"
              className={`transition-transform ${open ? "rotate-180" : ""}`} />
          </span>
        </button>
        {open && (
          <ul id="insights-tools" className="border-t border-line p-1.5">
            {TOOLS.map((tool) => (
              <li key={tool.id}>
                <label className="flex cursor-pointer items-center justify-between gap-3 rounded-ui px-1.5 py-1.5 hover:bg-panel-light/70">
                  <span>
                    <span className="block text-sm font-semibold leading-tight">{tool.label}</span>
                    <span className="block text-xs leading-tight text-dim">{tool.hint}</span>
                  </span>
                  {/* a checkbox that looks and announces as a switch */}
                  <input type="checkbox" role="switch" checked={tools[tool.id]} onChange={() => toggleTool(tool.id)}
                    className="peer sr-only" />
                  <span aria-hidden="true"
                    className="relative h-5 w-9 shrink-0 rounded-full bg-line transition-colors after:absolute after:left-0.5 after:top-0.5 after:h-4 after:w-4 after:rounded-full after:bg-white after:shadow after:transition-transform peer-checked:bg-f1 peer-checked:after:translate-x-4 peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-[var(--accent)]" />
                </label>
              </li>
            ))}
          </ul>
        )}
      </div>

      {open && tools.telemetry && <TelemetryPanel drivers={meta.drivers} />}
      {open && tools.speedTrace && <SpeedTrace year={meta.year} round={meta.round} drivers={meta.drivers} />}
      {open && tools.strategy && <TyreStrategy year={meta.year} round={meta.round} totalLaps={meta.total_laps} />}
      {open && tools.raceControl && <RaceControl meta={meta} />}
    </div>
  );
}
