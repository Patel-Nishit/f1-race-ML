"use client";

// The Insights menu: a floating panel of analysis tools. It's open when the
// replay starts; "I" or the header toggles it. Enabled tools appear as cards
// below it, in a column on the left of the track.
import type { RaceMeta } from "@/lib/types";
import { TOOLS, useUiStore } from "@/lib/uiStore";
import { RaceControl } from "./RaceControl";
import { SpeedTrace } from "./SpeedTrace";
import { TelemetryPanel } from "./TelemetryPanel";
import { TyreStrategy } from "./TyreStrategy";

export const INSIGHTS_WIDTH = 336; // px; the track is fitted to the space beside it

export function InsightsMenu({ meta }: { meta: RaceMeta }) {
  const open = useUiStore((s) => s.insightsOpen);
  const toggleOpen = useUiStore((s) => s.toggleInsights);
  const tools = useUiStore((s) => s.tools);
  const toggleTool = useUiStore((s) => s.toggleTool);

  return (
    <div className="pointer-events-none absolute inset-y-0 left-0 flex flex-col gap-2 overflow-y-auto p-3"
      style={{ width: INSIGHTS_WIDTH }}>
      <div className="pointer-events-auto rounded-lg border border-line/70 bg-panel/95 shadow-lg">
        <button onClick={toggleOpen} aria-expanded={open} aria-controls="insights-tools"
          className="flex w-full items-center justify-between rounded-t-lg bg-f1 px-3 py-1.5 text-sm font-bold text-white">
          INSIGHTS
          <span className="font-mono text-xs opacity-90"><kbd>I</kbd> {open ? "−" : "+"}</span>
        </button>
        {open && (
          <ul id="insights-tools" className="p-1.5">
            {TOOLS.map((tool) => (
              <li key={tool.id}>
                <label className="flex cursor-pointer items-start gap-2.5 rounded px-1.5 py-1 hover:bg-panel-light/70">
                  <input type="checkbox" checked={tools[tool.id]} onChange={() => toggleTool(tool.id)}
                    className="mt-1 accent-f1" />
                  <span>
                    <span className="block text-sm font-semibold leading-tight">{tool.label}</span>
                    <span className="block text-[11px] leading-tight text-faint">{tool.hint}</span>
                  </span>
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
