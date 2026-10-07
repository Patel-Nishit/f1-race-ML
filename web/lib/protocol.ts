// Turning compact wire frames back into friendly objects.
//
// To keep frames small, the server sends each driver as a list
// (["VER", -3474.2, 18900.4, 1, ...]) and the field names only once, in the
// "hello" message. We zip them back together here, once per frame.
import type { DriverState, Frame, WireFrame } from "./types";

export function decodeFrame(wire: WireFrame, fields: string[]): Frame {
  const drivers = wire.drivers.map((row) => {
    const driver: Record<string, unknown> = {};
    fields.forEach((field, i) => {
      driver[field] = row[i];
    });
    return driver as unknown as DriverState;
  });
  const sc = wire.sc ? { x: wire.sc[0], y: wire.sc[1], state: wire.sc[2] } : null;
  return {
    seq: wire.seq,
    ack: wire.ack,
    t: wire.t,
    lap: wire.lap,
    status: wire.status,
    playing: wire.playing,
    speed: wire.speed,
    weather: wire.weather,
    sc,
    drivers,
  };
}
