// A race's real circuit shape, drawn from its prepared metadata.
import { fitTrack, toScreen } from "@/lib/track";
import type { TrackMeta } from "@/lib/types";

export function TrackOutline({ track, className, strokeWidth = 3 }: {
  track: TrackMeta;
  className?: string;
  strokeWidth?: number;
}) {
  const W = 200, H = 140;
  const tr = fitTrack(track, W, H, 10);
  const step = Math.max(1, Math.floor(track.x.length / 180)); // ~180 points is plenty at this size
  const d = track.x
    .filter((_, i) => i % step === 0)
    .map((x, k) => {
      const [sx, sy] = toScreen(tr, x, track.y[k * step]);
      return `${k ? "L" : "M"}${sx.toFixed(1)} ${sy.toFixed(1)}`;
    })
    .join("") + "Z";
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className={className} aria-hidden="true">
      <path d={d} fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinejoin="round" />
    </svg>
  );
}
