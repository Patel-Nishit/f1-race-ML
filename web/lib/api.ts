// Small typed wrapper around the backend's REST API.
//
// NEXT_PUBLIC_ variables are inlined into the browser bundle at build time,
// so set NEXT_PUBLIC_API_URL before `next build` when deploying.
import type { PreparedRace, PrepareStatus, RaceMeta, SeasonEvent, Strategy, TelemetryWindow } from "./types";

export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:8000";

/** ws:// for http://, wss:// for https:// */
export const WS_URL = API_URL.replace(/^http/, "ws");

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  if (init?.signal?.aborted) throw new DOMException("Aborted", "AbortError");
  let response: Response;
  try {
    response = await fetch(`${API_URL}${path}`, init);
  } catch (e) {
    if ((e as Error).name === "AbortError") throw e; // we cancelled it ourselves
    // otherwise fetch only rejects when the server can't be reached at all
    throw new ApiError(0, `Can't reach the backend at ${API_URL}. Is "python main.py serve" running?`);
  }
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    const detail = typeof body.detail === "string" ? body.detail : response.statusText;
    throw new ApiError(response.status, detail);
  }
  return response.json() as Promise<T>;
}

export const api = {
  races: () => request<PreparedRace[]>("/api/races"),
  events: (year: number) => request<SeasonEvent[]>(`/api/seasons/${year}/events`),
  status: (year: number, round: number) => request<PrepareStatus>(`/api/races/${year}/${round}/status`),
  prepare: (year: number, round: number) =>
    request<PrepareStatus>(`/api/races/${year}/${round}/prepare`, { method: "POST" }),
  meta: (year: number, round: number) => request<RaceMeta>(`/api/races/${year}/${round}/meta`),
  strategy: (year: number, round: number) => request<Strategy>(`/api/races/${year}/${round}/strategy`),
  telemetry: (year: number, round: number, code: string, start: number, end: number, maxPoints = 300,
    signal?: AbortSignal) =>
    request<TelemetryWindow>(
      `/api/races/${year}/${round}/telemetry/${code}?start=${Math.max(0, start)}&end=${end}&max_points=${maxPoints}`,
      { signal }),
};

export function replaySocketUrl(year: number, round: number, opts: { t?: number; speed?: number; autoplay?: boolean }) {
  const params = new URLSearchParams({
    t: String(opts.t ?? 0),
    speed: String(opts.speed ?? 1),
    autoplay: String(opts.autoplay ?? true),
  });
  return `${WS_URL}/ws/replay/${year}/${round}?${params}`;
}
