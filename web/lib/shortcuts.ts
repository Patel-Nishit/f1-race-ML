// Keyboard shortcuts, as a pure function from a key press to an action.
// Same keys as the desktop app (desktop/ui/legend.py).
import { FAVOURITE_DRIVER } from "./favourites";
import type { Command } from "./types";

export const SKIP_SECONDS = 5;

export type Action =
  | { kind: "command"; command: Command }
  | { kind: "legend" }
  | { kind: "insights" }
  | { kind: "favourite" }
  | { kind: "clear-selection" };

/**
 * Should a key press be left alone because the user is typing? Only for
 * fields that take text. A focused checkbox or button must NOT block
 * shortcuts, or ticking an Insights checkbox would silently disable them.
 */
export function isTypingTarget(el: { tagName: string; isContentEditable?: boolean; type?: string } | null): boolean {
  if (!el) return false;
  if (el.isContentEditable) return true;
  if (el.tagName === "TEXTAREA" || el.tagName === "SELECT") return true;
  if (el.tagName !== "INPUT") return false;
  const nonText = ["checkbox", "radio", "button", "submit", "reset", "range", "color", "file", "image"];
  return !nonText.includes((el.type ?? "text").toLowerCase());
}

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
    case "m":
    case "M":
      return { kind: "favourite" };
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
  ["M", `Focus ${FAVOURITE_DRIVER.first} (select / deselect)`],
  ["I", "Insights menu"],
  ["L or ?", "Show / hide this legend"],
  ["Esc", "Clear selection"],
];
