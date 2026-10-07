// Keyboard shortcuts, as a pure function from a key press to an action.
// Same keys as the desktop app (desktop/ui/legend.py).
import type { Command } from "./types";

export const SKIP_SECONDS = 5;

export type Action =
  | { kind: "command"; command: Command }
  | { kind: "legend" }
  | { kind: "insights" }
  | { kind: "clear-selection" };

export interface KeyLike {
  key: string;
  shiftKey: boolean;
  ctrlKey: boolean;
  metaKey: boolean;
  altKey: boolean;
}

export function shortcutFor(e: KeyLike): Action | null {
  if (e.ctrlKey || e.metaKey || e.altKey) return null; // leave browser shortcuts alone
  const cmd = (command: Command): Action => ({ kind: "command", command });
  switch (e.key) {
    case " ":
      return cmd({ type: "toggle" });
    case "ArrowLeft":
      return cmd(e.shiftKey ? { type: "skip_laps", value: -1 } : { type: "skip", value: -SKIP_SECONDS });
    case "ArrowRight":
      return cmd(e.shiftKey ? { type: "skip_laps", value: 1 } : { type: "skip", value: SKIP_SECONDS });
    case "ArrowUp":
      return cmd({ type: "faster" });
    case "ArrowDown":
      return cmd({ type: "slower" });
    case "r":
    case "R":
      return cmd({ type: "restart" });
    case "l":
    case "L":
    case "?":
      return { kind: "legend" };
    case "i":
    case "I":
      return { kind: "insights" };
    case "Escape":
      return { kind: "clear-selection" };
    default:
      return null;
  }
}

/** Shown in the legend; one source of truth with shortcutFor. */
export const SHORTCUTS: [string, string][] = [
  ["Space", "Play / pause"],
  ["← / →", `Back / forward ${SKIP_SECONDS} s`],
  ["Shift + ← / →", "Previous / next lap"],
  ["↑ / ↓", "Faster / slower (0.25× to 32×)"],
  ["R", "Restart race"],
  ["Click a driver", "Select for telemetry (up to 2)"],
  ["Click timeline", "Jump to that moment"],
  ["I", "Insights menu"],
  ["L or ?", "Show / hide this legend"],
  ["Esc", "Clear selection"],
];
