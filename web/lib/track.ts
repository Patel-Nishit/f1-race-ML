// From FastF1 track coordinates to canvas pixels.
//
// Same three steps as the desktop app (desktop/track_view.py): rotate by the
// circuit's angle, scale to fit, move to the centre. One difference: canvas y
// grows *downwards*, so we flip y.
import type { TrackMeta } from "./types";

export interface Transform {
  scale: number;
  offsetX: number;
  offsetY: number;
  cos: number;
  sin: number;
}

function rotate(x: number, y: number, cos: number, sin: number): [number, number] {
  // same matrix as numpy: [x, y] @ [[cos, sin], [-sin, cos]]
  return [x * cos - y * sin, x * sin + y * cos];
}

export function fitTrack(track: TrackMeta, width: number, height: number, padding = 40): Transform {
  const angle = (track.rotation * Math.PI) / 180;
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (let i = 0; i < track.x.length; i++) {
    const [rx, ry] = rotate(track.x[i], track.y[i], cos, sin);
    minX = Math.min(minX, rx); maxX = Math.max(maxX, rx);
    minY = Math.min(minY, ry); maxY = Math.max(maxY, ry);
  }
  const scale = Math.min((width - 2 * padding) / (maxX - minX), (height - 2 * padding) / (maxY - minY));
  return {
    scale,
    cos,
    sin,
    offsetX: width / 2 - ((minX + maxX) / 2) * scale,
    offsetY: height / 2 + ((minY + maxY) / 2) * scale, // + because y is flipped
  };
}

export function toScreen(tr: Transform, x: number, y: number): [number, number] {
  const [rx, ry] = rotate(x, y, tr.cos, tr.sin);
  return [tr.offsetX + rx * tr.scale, tr.offsetY - ry * tr.scale];
}
