// UI-only state (not from the server): selection, open panels.
import { create } from "zustand";

export const MAX_SELECTED = 2;

export type Tool = "telemetry" | "speedTrace" | "strategy" | "gaps" | "raceControl";

export const TOOLS: { id: Tool; label: string; hint: string }[] = [
  { id: "telemetry", label: "Driver telemetry", hint: "Speed, gear, DRS, lap for selected drivers" },
  { id: "speedTrace", label: "Speed trace", hint: "Last 60 s of speed, selected drivers" },
  { id: "strategy", label: "Tyre strategy", hint: "Stints so far, every driver" },
  { id: "gaps", label: "Gaps to leader", hint: "Seconds behind P1 on the leaderboard" },
  { id: "raceControl", label: "Race control & weather", hint: "Flags so far, conditions" },
];

interface UiStore {
  selected: string[];
  legendOpen: boolean;
  insightsOpen: boolean;
  tools: Record<Tool, boolean>;
  toggleTool: (tool: Tool) => void;
  toggleDriver: (code: string) => void;
  clearSelection: () => void;
  toggleLegend: () => void;
  toggleInsights: () => void;
}

export const useUiStore = create<UiStore>((set) => ({
  selected: [],
  legendOpen: false,
  insightsOpen: true, // the Insights menu launches with the replay
  tools: { telemetry: true, speedTrace: true, strategy: false, gaps: true, raceControl: false },
  toggleTool: (tool) => set(({ tools }) => ({ tools: { ...tools, [tool]: !tools[tool] } })),
  toggleDriver: (code) =>
    set(({ selected }) => ({
      selected: selected.includes(code)
        ? selected.filter((c) => c !== code)
        : [...selected, code].slice(-MAX_SELECTED), // keep the two most recent
    })),
  clearSelection: () => set({ selected: [] }),
  toggleLegend: () => set(({ legendOpen }) => ({ legendOpen: !legendOpen })),
  toggleInsights: () => set(({ insightsOpen }) => ({ insightsOpen: !insightsOpen })),
}));
