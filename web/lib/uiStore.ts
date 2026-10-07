// UI-only state (not from the server): selection, open panels.
import { create } from "zustand";

export const MAX_SELECTED = 2;

interface UiStore {
  selected: string[];
  legendOpen: boolean;
  insightsOpen: boolean;
  toggleDriver: (code: string) => void;
  clearSelection: () => void;
  toggleLegend: () => void;
  toggleInsights: () => void;
}

export const useUiStore = create<UiStore>((set) => ({
  selected: [],
  legendOpen: false,
  insightsOpen: true, // opens with the replay (phase 7)
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
