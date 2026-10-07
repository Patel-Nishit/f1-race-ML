"use client";

import { SHORTCUTS } from "@/lib/shortcuts";
import { TYRE_COLOURS } from "@/lib/status";
import { useUiStore } from "@/lib/uiStore";

export function Legend() {
  const open = useUiStore((s) => s.legendOpen);
  const toggle = useUiStore((s) => s.toggleLegend);

  if (!open) {
    return (
      <button onClick={toggle}
        className="absolute bottom-3 right-3 rounded bg-panel/80 px-3 py-1 text-xs text-dim hover:text-ink">
        <kbd className="font-mono font-bold">L</kbd> controls legend
      </button>
    );
  }
  return (
    <section aria-label="Controls legend"
      className="absolute bottom-3 right-3 w-[22rem] rounded-lg border border-line bg-panel/95 p-4 text-sm shadow-xl">
      <div className="mb-2 flex items-center justify-between">
        <h2 className="text-xs font-bold tracking-wider text-dim">CONTROLS</h2>
        <button onClick={toggle} aria-label="Close legend" className="text-dim hover:text-ink">✕</button>
      </div>
      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1">
        {SHORTCUTS.map(([keys, action]) => (
          <div key={keys} className="contents">
            <dt className="font-mono text-xs font-bold leading-5">{keys}</dt>
            <dd className="text-dim">{action}</dd>
          </div>
        ))}
      </dl>
      <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-line pt-3 text-xs text-dim">
        {(["SOFT", "MEDIUM", "HARD", "INTERMEDIATE", "WET"] as const).map((c) => (
          <span key={c} className="flex items-center gap-1">
            <span className="h-3 w-3 rounded-full border-2" style={{ borderColor: TYRE_COLOURS[c] }} />
            {c[0] + c.slice(1).toLowerCase()}
          </span>
        ))}
        <span className="flex items-center gap-1"><span className="h-3 w-4 rounded-sm bg-sc" />Safety car</span>
        <span><b className="text-f1">OUT</b> retired</span>
        <span><b className="text-ok">DRS</b> flap open</span>
      </div>
    </section>
  );
}
