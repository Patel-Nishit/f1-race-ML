// Shapes of the data the backend sends. Keeping them in one place means the
// TypeScript compiler catches it when the frontend and backend disagree.

export type TyreCompound = "SOFT" | "MEDIUM" | "HARD" | "INTERMEDIATE" | "WET" | "UNKNOWN";

export interface DriverMeta {
  code: string;
  number: string;
  name: string;
  team: string;
  color: string; // "#3671c6"
  grid: number;
  status: string;
  final_position: number;
}

export interface TrackMeta {
  x: number[];
  y: number[];
  frac: number[];
  lap_length: number;
  rotation: number; // degrees
  pit_exit: [number, number] | null;
  pit_entry: [number, number] | null;
}

export interface RaceMeta {
  year: number;
  round: number;
  session: string;
  event_name: string;
  country: string;
  fps: number;
  duration: number;
  total_laps: number;
  drivers: DriverMeta[];
  retirements: Record<string, number>;
  track: TrackMeta;
  track_status_changes: { t: number; status: number }[];
  lap_starts: number[];
  driver_fields: string[];
}

export interface DriverState {
  code: string;
  x: number;
  y: number;
  position: number;
  lap: number;
  tyre: TyreCompound;
  speed: number;
  gear: number;
  drs_open: boolean;
  throttle: number;
  brake: number;
  out: boolean;
  laps_down: number;
}

export interface SafetyCar {
  x: number;
  y: number;
  state: "DEPLOYING" | "LEADING" | "RETURNING";
}

export interface Weather {
  air_temp: number;
  track_temp: number | null;
  humidity: number | null;
  raining: boolean;
}

/** A frame after decoding: drivers as objects, safety car as an object. */
export interface Frame {
  seq: number;
  ack: number | null;
  t: number;
  lap: number;
  status: number;
  playing: boolean;
  speed: number;
  sc: SafetyCar | null;
  weather: Weather | null;
  drivers: DriverState[];
}

/** A frame exactly as it arrives over the WebSocket (compact form). */
export interface WireFrame extends Omit<Frame, "drivers" | "sc"> {
  type: "frame";
  sc: [number, number, SafetyCar["state"]] | null;
  drivers: unknown[][];
}

export interface Hello {
  type: "hello";
  year: number;
  round: number;
  event_name: string;
  fps: number;
  duration: number;
  total_laps: number;
  lap_starts: number[];
  driver_fields: string[];
}

export type Command =
  | { type: "play" | "pause" | "toggle" | "faster" | "slower" | "restart" }
  | { type: "seek"; t: number }
  | { type: "skip"; value: number }
  | { type: "skip_laps"; value: number }
  | { type: "speed"; value: number };

export type PrepareState = "missing" | "preparing" | "ready" | "error";

export interface PrepareStatus {
  state: PrepareState;
  stage: string;
  progress: number;
  error: string;
}

export interface SeasonEvent {
  round_number: number;
  event_name: string;
  date: string;
  country: string;
  type: string;
  status: PrepareState;
}

export interface PreparedRace {
  year: number;
  round: number;
  session: string;
  event_name: string;
  country: string;
  total_laps: number;
  duration: number;
}
