/** 3733 -> "1:02:13", 125 -> "2:05" */
export function formatRaceTime(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = String(s % 60).padStart(2, "0");
  return h ? `${h}:${String(m).padStart(2, "0")}:${sec}` : `${m}:${sec}`;
}

const MONTHS = ["January", "February", "March", "April", "May", "June", "July",
  "August", "September", "October", "November", "December"];

/** "2024-03-09" -> { month: "March", short: "9 Mar" } (read as UTC: no time-zone shift) */
export function eventDate(iso: string) {
  const d = new Date(`${iso}T00:00:00Z`);
  const month = MONTHS[d.getUTCMonth()];
  return { month, short: `${d.getUTCDate()} ${month.slice(0, 3)}` };
}
