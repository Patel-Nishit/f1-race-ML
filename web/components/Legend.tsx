"use client";

// Shortcuts popover: every control and what the colours mean. Opened with
// L or ?, or the Shortcuts button in the header.
import { XIcon } from "@phosphor-icons/react";
import { SHORTCUTS } from "@/lib/shortcuts";
import { TYRE_COLOURS } from "@/lib/status";
import { useUiStore } from "@/lib/uiStore";

export function Legend() {
  const open = useUiStore((s) => s.legendOpen);
  const toggle = useUiStore((s) => s.toggleLegend);
  if (!open) return null;
  return (
    <section aria-label="Controls legend"
      className="glass absolute right-3 top-16 z-30 w-[min(23rem,calc(100vw-1.5rem))] p-4 text-sm">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="font-semibold">Shortcuts</h2>
        <button onClick={toggle} aria-label="Close legend" className="rounded-ui p-1 text-dim hover:text-ink">
          <XIcon size={16} weight="bold" aria-hidden="true" />
        </button>
      </div>
      <dl className="grid grid-cols-[auto_1fr] items-center gap-x-4 gap-y-1.5">
        {SHORTCUTS.map(([keys, action]) => (
          <div key={keys} className="contents">
            <dt>
              {/* mouse actions are plain text; only real keys get key chips */}
              {keys.startsWith("Click") ? <span className="text-xs font-semibold">{keys}</span>
                : <kbd className="rounded-[4px] border border-line bg-panel-light px-1.5 py-0.5 font-mono text-xs">{keys}</kbd>}
            </dt>
            <dd className="text-dim">{action}</dd>
          </div>
        ))}
      </dl>
      <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-1.5 border-t border-line pt-3 text-xs text-dim">
        {(["SOFT", "MEDIUM", "HARD", "INTERMEDIATE", "WET"] as const).map((c) => (
          <span key={c} className="flex items-center gap-1">
            <span className="h-3 w-3 rounded-full border-2 bg-[#16171c]" style={{ borderColor: TYRE_COLOURS[c] }} />
            {c[0] + c.slice(1).toLowerCase()}
          </span>
        ))}
        <span className="flex items-center gap-1"><span className="h-3 w-4 rounded-[2px] bg-sc" />Safety car</span>
        <span><b className="text-f1-ink">OUT</b> retired</span>
        <span><b className="text-ok-ink">DRS</b> flap open</span>
      </div>
    </section>
  );
}
