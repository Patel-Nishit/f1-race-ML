"use client";

// The track and the cars, drawn on an HTML canvas.
//
// Why a canvas and not 20 React components? Positions change 60 times a
// second. Re-rendering React that often is wasteful; a canvas lets us simply
// repaint pixels. React only sets the canvas up; a requestAnimationFrame
// loop does the drawing, reading the store directly with getState().
import { useEffect, useRef } from "react";
import { interpolate } from "@/lib/interpolate";
import { useReplayStore } from "@/lib/replayStore";
import { useUiStore } from "@/lib/uiStore";
import { fitTrack, toScreen, type Transform } from "@/lib/track";
import type { RaceMeta } from "@/lib/types";

const CAR_RADIUS = 7;
const CLICK_RADIUS = 14; // generous, so cars are easy to click

export function TrackCanvas({ meta }: { meta: RaceMeta }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext("2d")!;
    const colours = new Map(meta.drivers.map((d) => [d.code, d.color]));
    let transform: Transform | null = null;
    let trackLayer: HTMLCanvasElement | null = null;
    let frameId = 0;
    // where each car was drawn last frame, for click hit-testing
    let drawn: { code: string; x: number; y: number }[] = [];

    // The outline never changes, so draw it once onto an offscreen canvas
    // ("layer") and copy that image every frame: one drawImage call instead
    // of re-tracing ~700 points.
    function buildTrackLayer(width: number, height: number, dpr: number) {
      transform = fitTrack(meta.track, width, height, 48);
      const layer = document.createElement("canvas");
      layer.width = width * dpr;
      layer.height = height * dpr;
      const lc = layer.getContext("2d")!;
      lc.scale(dpr, dpr);
      lc.lineJoin = "round";
      lc.beginPath();
      meta.track.x.forEach((x, i) => {
        const [sx, sy] = toScreen(transform!, x, meta.track.y[i]);
        if (i === 0) lc.moveTo(sx, sy);
        else lc.lineTo(sx, sy);
      });
      lc.closePath();
      lc.strokeStyle = "#6e7282";
      lc.lineWidth = 14;
      lc.stroke();
      lc.strokeStyle = "#464a58";
      lc.lineWidth = 10;
      lc.stroke();
      // start/finish
      const [fx, fy] = toScreen(transform, meta.track.x[0], meta.track.y[0]);
      lc.fillStyle = "#ecedf2";
      lc.beginPath();
      lc.arc(fx, fy, 3, 0, Math.PI * 2);
      lc.fill();
      trackLayer = layer;
    }

    // Keep the canvas sharp on high-DPI screens and refit on resize.
    const resize = () => {
      const dpr = window.devicePixelRatio || 1;
      const { width, height } = canvas.getBoundingClientRect();
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      buildTrackLayer(width, height, dpr);
    };
    const observer = new ResizeObserver(resize);
    observer.observe(canvas);

    const draw = () => {
      frameId = requestAnimationFrame(draw);
      if (!transform || !trackLayer) return;
      const { width, height } = canvas.getBoundingClientRect();
      ctx.clearRect(0, 0, width, height);
      ctx.drawImage(trackLayer, 0, 0, width, height);

      const state = interpolate(useReplayStore.getState().buffer, performance.now());
      if (!state) return;

      // back-markers first, so the leader is drawn on top
      const order = new Map(useReplayStore.getState().buffer.latest!.drivers.map((d) => [d.code, d.position]));
      const cars = [...state.cars].sort((a, b) => (order.get(b.code) ?? 0) - (order.get(a.code) ?? 0));
      const selected = useUiStore.getState().selected;
      drawn = [];
      for (const car of cars) {
        if (car.out) continue;
        const [x, y] = toScreen(transform, car.x, car.y);
        drawn.push({ code: car.code, x, y });
        if (selected.includes(car.code)) {
          ctx.beginPath();
          ctx.arc(x, y, CAR_RADIUS + 5, 0, Math.PI * 2);
          ctx.fillStyle = "rgba(255,255,255,0.3)";
          ctx.fill();
          ctx.lineWidth = 2;
          ctx.strokeStyle = "#fff";
          ctx.stroke();
        }
        ctx.beginPath();
        ctx.arc(x, y, CAR_RADIUS, 0, Math.PI * 2);
        ctx.fillStyle = colours.get(car.code) ?? "#888";
        ctx.fill();
        ctx.lineWidth = 1.5;
        ctx.strokeStyle = "#000";
        ctx.stroke();
      }

      // name tags for selected cars (2nd one below its car, so close cars don't overprint)
      ctx.font = "bold 11px var(--font-titillium), sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      for (const car of drawn) {
        const slot = selected.indexOf(car.code);
        if (slot < 0) continue;
        const dy = slot === 1 ? CAR_RADIUS + 12 : -(CAR_RADIUS + 12);
        ctx.lineWidth = 3;
        ctx.strokeStyle = "#101116";
        ctx.strokeText(car.code, car.x, car.y + dy);
        ctx.fillStyle = "#fff";
        ctx.fillText(car.code, car.x, car.y + dy);
      }

      if (state.sc) {
        const [x, y] = toScreen(transform, state.sc.x, state.sc.y);
        ctx.fillStyle = "#ffb000";
        ctx.fillRect(x - 11, y - 7, 22, 14);
        ctx.fillStyle = "#000";
        ctx.font = "bold 9px var(--font-titillium), sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText("SC", x, y + 0.5);
      }
    };
    frameId = requestAnimationFrame(draw);

    // Click a car to select it, same as clicking its leaderboard row.
    const onClick = (e: MouseEvent) => {
      const box = canvas.getBoundingClientRect();
      const px = e.clientX - box.left;
      const py = e.clientY - box.top;
      let best: string | null = null;
      let bestDist = CLICK_RADIUS;
      for (const car of drawn) {
        const d = Math.hypot(car.x - px, car.y - py);
        if (d < bestDist) [best, bestDist] = [car.code, d];
      }
      if (best) useUiStore.getState().toggleDriver(best);
    };
    canvas.addEventListener("click", onClick);

    return () => {
      cancelAnimationFrame(frameId);
      observer.disconnect();
      canvas.removeEventListener("click", onClick);
    };
  }, [meta]);

  return <canvas ref={canvasRef} className="h-full w-full" aria-label={`Track map of ${meta.event_name}`} role="img" />;
}
