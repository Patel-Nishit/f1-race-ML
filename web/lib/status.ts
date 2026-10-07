// Track status codes (FastF1) -> label and colour. Mirrors desktop/theme.py.
export const TRACK_STATUS: Record<number, { label: string; color: string; banner?: string }> = {
  1: { label: "GREEN", color: "#00aa50" },
  2: { label: "YELLOW", color: "#f0c800" },
  4: { label: "SAFETY CAR", color: "#ffb000", banner: "SAFETY CAR" },
  5: { label: "RED FLAG", color: "#dc1e1e", banner: "RED FLAG" },
  6: { label: "VSC", color: "#ffb000", banner: "VIRTUAL SAFETY CAR" },
  7: { label: "VSC ENDING", color: "#f0c800", banner: "VSC ENDING" },
};

export const TYRE_COLOURS: Record<string, string> = {
  SOFT: "#da291c",
  MEDIUM: "#ffd200",
  HARD: "#ebebeb",
  INTERMEDIATE: "#43b02a",
  WET: "#0067ad",
  UNKNOWN: "#808080",
};
