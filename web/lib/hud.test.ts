import { beforeEach, describe, expect, it } from "vitest";
import { shortcutFor, type KeyLike } from "./shortcuts";
import { lapTicks, neutralisedPeriods } from "./timeline";
import { useUiStore } from "./uiStore";

const key = (k: string, mods: Partial<KeyLike> = {}): KeyLike =>
  ({ key: k, shiftKey: false, ctrlKey: false, metaKey: false, altKey: false, ...mods });

describe("shortcuts", () => {
  it("maps keys to the same commands as the desktop app", () => {
    expect(shortcutFor(key(" "))).toEqual({ kind: "command", command: { type: "toggle" } });
    expect(shortcutFor(key("ArrowLeft"))).toEqual({ kind: "command", command: { type: "skip", value: -5 } });
    expect(shortcutFor(key("ArrowRight", { shiftKey: true })))
      .toEqual({ kind: "command", command: { type: "skip_laps", value: 1 } });
    expect(shortcutFor(key("ArrowUp"))).toEqual({ kind: "command", command: { type: "faster" } });
    expect(shortcutFor(key("r"))).toEqual({ kind: "command", command: { type: "restart" } });
    expect(shortcutFor(key("?", { shiftKey: true }))).toEqual({ kind: "legend" });
    expect(shortcutFor(key("Escape"))).toEqual({ kind: "clear-selection" });
  });

  it("ignores unknown keys and browser shortcuts", () => {
    expect(shortcutFor(key("x"))).toBeNull();
    expect(shortcutFor(key("r", { ctrlKey: true }))).toBeNull(); // Ctrl+R = reload
    expect(shortcutFor(key("l", { metaKey: true }))).toBeNull(); // Cmd+L = address bar
  });
});

describe("timeline", () => {
  it("finds safety car, red flag and VSC periods", () => {
    const changes = [
      { t: -100, status: 1 }, { t: 572, status: 2 }, { t: 606, status: 4 }, { t: 1012, status: 1 },
      { t: 1392, status: 6 }, { t: 1457, status: 7 }, { t: 1471, status: 1 }, { t: 4719, status: 6 },
    ];
    expect(neutralisedPeriods(changes, 4800)).toEqual([
      { start: 606, end: 1012, status: 4 },
      { start: 1392, end: 1471, status: 6 }, // VSC + VSC ending merged
      { start: 4719, end: 4800, status: 6 }, // still on at the end
    ]);
  });

  it("puts a tick every 5 laps", () => {
    const starts = Array.from({ length: 12 }, (_, i) => i * 90);
    expect(lapTicks(starts)).toEqual([{ lap: 5, t: 360 }, { lap: 10, t: 810 }]);
  });
});

describe("ui store", () => {
  beforeEach(() => useUiStore.setState({ selected: [] }));

  it("selects at most two drivers, dropping the oldest", () => {
    const { toggleDriver } = useUiStore.getState();
    toggleDriver("VER");
    toggleDriver("NOR");
    toggleDriver("LEC");
    expect(useUiStore.getState().selected).toEqual(["NOR", "LEC"]);
    toggleDriver("NOR"); // clicking again deselects
    expect(useUiStore.getState().selected).toEqual(["LEC"]);
  });
});
