"use client";

// Fetch the last `seconds` of telemetry for the selected drivers, following
// the replay. Columnar storage on the server makes each request one slice.
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { useReplayStore } from "@/lib/replayStore";
import type { TelemetryWindow } from "@/lib/types";

export function useTelemetryWindow(year: number, round: number, codes: string[], seconds: number) {
  // Re-render (and refetch) once per race-second, not on every frame.
  const now = useReplayStore((s) => Math.floor(s.buffer.latest?.t ?? 0));
  const key = codes.join(",");
  const wanted = `${key}@${now}`;
  // What we last received, and for which request.
  const [result, setResult] = useState<{ id: string; windows: TelemetryWindow[] }>({ id: "", windows: [] });

  useEffect(() => {
    if (!key) return;
    // A newer request (next second, or a different selection) cancels the
    // older one, so a slow response can never overwrite fresher data.
    const controller = new AbortController();
    Promise.all(key.split(",").map((code) =>
      api.telemetry(year, round, code, now - seconds, now, 300, controller.signal)))
      .then((windows) => setResult({ id: `${key}@${now}`, windows }))
      .catch(() => {}); // aborted or failed: keep showing the previous data
    return () => controller.abort();
  }, [year, round, key, now, seconds]);

  // Derived, not stored: "loading" just means the data we have isn't for the
  // request we want yet. While loading we keep showing the previous data
  // (no flash, no layout jump).
  return { data: key ? result.windows : [], loading: Boolean(key) && result.id !== wanted };
}
