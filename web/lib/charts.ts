// Small chart helpers (no chart library: these charts are simple, and
// writing the scales yourself is the best way to understand them).
import type { Stint } from "./types";

/** Maps a value from [d0, d1] onto pixels [r0, r1]. */
export function scale(d0: number, d1: number, r0: number, r1: number) {
  const k = d1 === d0 ? 0 : (r1 - r0) / (d1 - d0);
  return (v: number) => r0 + (v - d0) * k;
}

/** Clean tick values 0, step, 2*step... up to max. */
export function ticks(max: number, step: number): number[] {
  const out: number[] = [];
  for (let v = 0; v <= max + 1e-9; v += step) out.push(Math.round(v * 1000) / 1000);
  return out;
}

/** Index of the sample closest to `t` in a sorted array (for the crosshair). */
export function nearestIndex(ts: number[], t: number): number {
  if (ts.length === 0) return -1;
  let lo = 0, hi = ts.length - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (ts[mid] <= t) lo = mid;
    else hi = mid;
  }
  return Math.abs(ts[hi] - t) < Math.abs(ts[lo] - t) ? hi : lo;
}

/** SVG path "M x y L x y ..." for a line. */
export function linePath(xs: number[], ys: number[]): string {
  return xs.map((x, i) => `${i ? "L" : "M"}${x.toFixed(1)} ${ys[i].toFixed(1)}`).join("");
}

/**
 * Stints a viewer is allowed to see at this point of the replay: drop stints
 * that haven't started, and cut the current one at the driver's current lap.
 * (The full race strategy is known in advance; showing it would spoil it.)
 */
export function stintsSoFar(stints: Stint[], currentLap: number): Stint[] {
  return stints
    .filter((s) => s.start_lap <= currentLap)
    .map((s) => ({ ...s, end_lap: Math.min(s.end_lap, currentLap) }));
}

/** WCAG relative luminance of a "#rrggbb" colour (0 = black, 1 = white). */
export function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** Black or white text: whichever has the higher WCAG contrast ratio on this fill. */
export function textOn(hex: string): "#000" | "#fff" {
  const L = luminance(hex);
  const withWhite = 1.05 / (L + 0.05);
  const withBlack = (L + 0.05) / 0.05;
  return withBlack >= withWhite ? "#000" : "#fff";
}
