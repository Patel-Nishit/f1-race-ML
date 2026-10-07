// What to do with each frame that arrives: the "live data" logic.
//
// We keep only the last two frames. The canvas draws *between* them, which
// means we deliberately show the race one frame (~100 ms) late, but motion is
// perfectly smooth. Games call this "entity interpolation".
import type { Frame } from "./types";

export interface FrameBuffer {
  prev: Frame | null;
  latest: Frame | null;
  latestArrival: number; // performance.now() when `latest` arrived (ms)
  interval: number; // smoothed time between frames (ms)
  pendingAck: number | null; // id of a command we're waiting to see applied
  pendingSince: number;
}

export const SEND_INTERVAL_MS = 100; // the server sends 10 frames per second
const ACK_TIMEOUT_MS = 1500;

export const emptyBuffer: FrameBuffer = {
  prev: null,
  latest: null,
  latestArrival: 0,
  interval: SEND_INTERVAL_MS,
  pendingAck: null,
  pendingSince: 0,
};

/**
 * Returns the new buffer after a frame arrives at time `now` (ms).
 *
 * Rules:
 *  1. While waiting for a command's ack, ignore older frames. They were
 *     already on the wire before the server saw our command (e.g. a seek), and
 *     showing them would make the cars jump back for a moment. If the ack
 *     never comes (say the command was rejected), give up waiting after 1.5 s.
 *  2. The frame that carries the ack starts fresh: no interpolating across a
 *     seek, or cars would glide across the infield to their new positions.
 *  3. Otherwise the latest frame becomes `prev`, the new one `latest`, and we
 *     update the smoothed interval between frames.
 */
export function applyFrame(buffer: FrameBuffer, frame: Frame, now: number): FrameBuffer {
  if (buffer.pendingAck !== null) {
    const acked = frame.ack !== null && frame.ack >= buffer.pendingAck;
    const timedOut = now - buffer.pendingSince > ACK_TIMEOUT_MS;
    if (!acked && !timedOut) return buffer;
    return { ...buffer, prev: frame, latest: frame, latestArrival: now, pendingAck: null };
  }

  const gap = now - buffer.latestArrival;
  const interval =
    buffer.latest && gap > 20 && gap < 500 ? buffer.interval * 0.8 + gap * 0.2 : buffer.interval;
  return { ...buffer, prev: buffer.latest ?? frame, latest: frame, latestArrival: now, interval };
}

export function expectAck(buffer: FrameBuffer, id: number, now: number): FrameBuffer {
  return { ...buffer, pendingAck: id, pendingSince: now };
}
