// Smooth motion between two frames.
import type { Frame } from "./types";
import type { FrameBuffer } from "./frameBuffer";

export interface CarPosition {
  code: string;
  x: number;
  y: number;
  out: boolean;
}

export interface Interpolated {
  t: number;
  cars: CarPosition[];
  sc: { x: number; y: number } | null;
}

const lerp = (a: number, b: number, w: number) => a + (b - a) * w;

/** How far (0..1) we are from `prev` towards `latest` at time `now` (ms). */
export function blendWeight(buffer: FrameBuffer, now: number): number {
  if (!buffer.latest || !buffer.latest.playing) return 1;
  const w = (now - buffer.latestArrival) / buffer.interval;
  return Math.min(1, Math.max(0, w));
}

/**
 * Should we jump straight to `next` instead of gliding? Yes if time went
 * backwards (rewind) or jumped much further than normal playback would
 * (a seek or a lap skip).
 */
export function shouldSnap(prev: Frame, next: Frame): boolean {
  const dt = next.t - prev.t;
  const normalStep = 0.1 * next.speed; // seconds of race per frame
  return dt < 0 || dt > normalStep * 3 + 0.5;
}

export function interpolate(buffer: FrameBuffer, now: number): Interpolated | null {
  const { prev, latest } = buffer;
  if (!latest) return null;
  const w = prev && !shouldSnap(prev, latest) ? blendWeight(buffer, now) : 1;
  const before = new Map((prev ?? latest).drivers.map((d) => [d.code, d]));

  const cars = latest.drivers.map((d) => {
    const p = before.get(d.code) ?? d;
    return { code: d.code, x: lerp(p.x, d.x, w), y: lerp(p.y, d.y, w), out: d.out };
  });

  let sc: Interpolated["sc"] = null;
  if (latest.sc) {
    const p = prev?.sc ?? latest.sc;
    sc = { x: lerp(p.x, latest.sc.x, w), y: lerp(p.y, latest.sc.y, w) };
  }
  const t = prev ? lerp(prev.t, latest.t, w) : latest.t;
  return { t, cars, sc };
}
