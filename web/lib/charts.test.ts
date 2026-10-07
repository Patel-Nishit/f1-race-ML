import { describe, expect, it } from "vitest";
import { linePath, nearestIndex, scale, stintsSoFar, textOn, ticks } from "./charts";

describe("chart helpers", () => {
  it("scales values to pixels (including inverted y axes)", () => {
    const y = scale(0, 350, 120, 0); // 0 km/h at the bottom
    expect(y(0)).toBe(120);
    expect(y(350)).toBe(0);
    expect(y(175)).toBe(60);
  });

  it("makes clean ticks", () => {
    expect(ticks(350, 100)).toEqual([0, 100, 200, 300]);
    expect(ticks(50, 10)).toEqual([0, 10, 20, 30, 40, 50]);
  });

  it("finds the nearest sample", () => {
    const ts = [0, 1, 2, 3];
    expect(nearestIndex(ts, 1.4)).toBe(1);
    expect(nearestIndex(ts, 1.6)).toBe(2);
    expect(nearestIndex(ts, -5)).toBe(0);
    expect(nearestIndex(ts, 99)).toBe(3);
    expect(nearestIndex([], 1)).toBe(-1);
  });

  it("builds an SVG path", () => {
    expect(linePath([0, 10], [5, 6])).toBe("M0.0 5.0L10.0 6.0");
  });

  it("never shows future stints", () => {
    const stints = [
      { compound: "MEDIUM" as const, start_lap: 1, end_lap: 7 },
      { compound: "HARD" as const, start_lap: 8, end_lap: 50 },
    ];
    expect(stintsSoFar(stints, 5)).toEqual([{ compound: "MEDIUM", start_lap: 1, end_lap: 5 }]);
    expect(stintsSoFar(stints, 20)).toEqual([
      { compound: "MEDIUM", start_lap: 1, end_lap: 7 },
      { compound: "HARD", start_lap: 8, end_lap: 20 },
    ]);
  });

  it("picks the higher-contrast text colour on tyre colours", () => {
    // measured WCAG ratios (white vs black text):
    expect(textOn("#da291c")).toBe("#fff"); // soft:   4.87 vs 4.32
    expect(textOn("#ffd200")).toBe("#000"); // medium: 1.45 vs 14.47
    expect(textOn("#ebebeb")).toBe("#000"); // hard:   1.19 vs 17.62
    expect(textOn("#43b02a")).toBe("#000"); // inter:  2.81 vs 7.48
    expect(textOn("#1a7fd0")).toBe("#000"); // wet:    4.21 vs 4.99 (not what intuition says!)
  });
});
