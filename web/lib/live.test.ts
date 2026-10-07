import { describe, expect, it } from "vitest";
import { applyFrame, emptyBuffer, expectAck } from "./frameBuffer";
import { blendWeight, interpolate, shouldSnap } from "./interpolate";
import { decodeFrame } from "./protocol";
import { fitTrack, toScreen } from "./track";
import type { Frame, TrackMeta, WireFrame } from "./types";

const FIELDS = ["code", "x", "y", "position", "lap", "tyre", "speed", "gear",
  "drs_open", "throttle", "brake", "out", "laps_down", "gap"];

function frame(t: number, x: number, extra: Partial<Frame> = {}): Frame {
  return {
    seq: Math.round(t * 10), ack: null, t, lap: 1, status: 1, playing: true, speed: 1,
    sc: null, weather: null,
    drivers: [{ code: "VER", x, y: 0, position: 1, lap: 1, tyre: "SOFT", speed: 300, gear: 8,
      drs_open: false, throttle: 100, brake: 0, out: false, laps_down: 0, gap: 0 }],
    ...extra,
  };
}

describe("decodeFrame", () => {
  it("zips driver rows with the field names from hello", () => {
    const wire: WireFrame = {
      type: "frame", seq: 1, ack: null, t: 600, lap: 7, status: 4, playing: true, speed: 1,
      weather: null, sc: [10, 20, "LEADING"],
      drivers: [["VER", -3474.2, 18900.4, 1, 7, "MEDIUM", 286.8, 7, false, 100, 0, false, 0, 0]],
    };
    const f = decodeFrame(wire, FIELDS);
    expect(f.drivers[0]).toMatchObject({ code: "VER", x: -3474.2, position: 1, tyre: "MEDIUM", gear: 7 });
    expect(f.sc).toEqual({ x: 10, y: 20, state: "LEADING" });
  });
});

describe("applyFrame", () => {
  it("keeps the last two frames", () => {
    let b = applyFrame(emptyBuffer, frame(1, 0), 1000);
    b = applyFrame(b, frame(1.1, 10), 1100);
    expect(b.prev?.t).toBe(1);
    expect(b.latest?.t).toBe(1.1);
  });

  it("learns the real interval between frames", () => {
    let b = applyFrame(emptyBuffer, frame(1, 0), 0);
    for (let i = 1; i <= 30; i++) b = applyFrame(b, frame(1 + i / 10, i), i * 120);
    expect(b.interval).toBeGreaterThan(115);
    expect(b.interval).toBeLessThan(121);
  });

  it("ignores in-flight frames until the command is acknowledged", () => {
    let b = applyFrame(emptyBuffer, frame(600, 0), 0);
    b = expectAck(b, 7, 10);
    b = applyFrame(b, frame(600.1, 1, { ack: null }), 50); // sent before the seek
    expect(b.latest?.t).toBe(600);
    b = applyFrame(b, frame(2000, 500, { ack: 7 }), 60); // the seek's answer
    expect(b.latest?.t).toBe(2000);
    expect(b.prev?.t).toBe(2000); // no gliding across the jump
    expect(b.pendingAck).toBeNull();
  });

  it("stops waiting for an ack that never comes", () => {
    let b = applyFrame(emptyBuffer, frame(600, 0), 0);
    b = expectAck(b, 9, 0);
    b = applyFrame(b, frame(600.1, 1), 2000);
    expect(b.latest?.t).toBe(600.1);
  });
});

describe("interpolation", () => {
  it("blends positions between the last two frames", () => {
    let b = applyFrame(emptyBuffer, frame(1, 0), 0);
    b = applyFrame(b, frame(1.1, 100), 100);
    expect(blendWeight(b, 150)).toBeCloseTo(0.5);
    const r = interpolate(b, 150)!;
    expect(r.cars[0].x).toBeCloseTo(50);
    expect(r.t).toBeCloseTo(1.05);
  });

  it("holds the latest frame when paused", () => {
    let b = applyFrame(emptyBuffer, frame(1, 0), 0);
    b = applyFrame(b, frame(1.1, 100, { playing: false }), 100);
    expect(interpolate(b, 120)!.cars[0].x).toBe(100);
  });

  it("snaps instead of gliding after a rewind or a big jump", () => {
    expect(shouldSnap(frame(10, 0), frame(9, 0))).toBe(true);
    expect(shouldSnap(frame(10, 0), frame(70, 0))).toBe(true);
    expect(shouldSnap(frame(10, 0), frame(10.1, 0))).toBe(false);
    expect(shouldSnap(frame(10, 0), frame(11.6, 0, { speed: 16 }))).toBe(false);
  });
});

describe("track transform", () => {
  const square: TrackMeta = {
    x: [0, 100, 100, 0], y: [0, 0, 100, 100], frac: [0, 0.25, 0.5, 0.75],
    lap_length: 400, rotation: 0, pit_exit: null, pit_entry: null,
  };

  it("fits the track inside the canvas with padding", () => {
    const tr = fitTrack(square, 300, 200, 50);
    expect(toScreen(tr, 0, 0)).toEqual([100, 150]); // bottom-left
    expect(toScreen(tr, 100, 100)).toEqual([200, 50]); // top-right: y is flipped
  });

  it("keeps the track out of the inset areas", () => {
    const tr = fitTrack(square, 400, 300, 0, { left: 100, top: 50, right: 0, bottom: 50 });
    const [x0, y0] = toScreen(tr, 0, 100); // top-left corner of the square
    const [x1, y1] = toScreen(tr, 100, 0); // bottom-right corner
    expect(x0).toBeGreaterThanOrEqual(100);
    expect(y0).toBeGreaterThanOrEqual(50);
    expect(x1).toBeLessThanOrEqual(400);
    expect(y1).toBeLessThanOrEqual(250);
  });

  it("rotates by the circuit angle", () => {
    const tr = fitTrack({ ...square, rotation: 90 }, 300, 300, 50);
    const [ax] = toScreen(tr, 100, 0);
    const [bx] = toScreen(tr, 0, 0);
    expect(ax).toBeCloseTo(bx); // after 90 degrees, x-axis points become a vertical line
  });
});
