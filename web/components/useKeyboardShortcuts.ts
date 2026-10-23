"use client";

import { useEffect } from "react";
import { FAVOURITE_DRIVER } from "@/lib/favourites";
import { useReplayStore } from "@/lib/replayStore";
import { isTypingTarget, shortcutFor } from "@/lib/shortcuts";
import { useUiStore } from "@/lib/uiStore";

/** Global keyboard shortcuts for the replay page. */
export function useKeyboardShortcuts() {
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      // don't steal keys while someone is typing in a text field
      if (isTypingTarget(e.target as HTMLInputElement)) return;
      const action = shortcutFor(e);
      if (!action) return;
      // Stop the browser's default (Space/arrows scroll the page, and Space
      // would also "click" whichever button has focus: a double toggle).
      e.preventDefault();
      if (e.repeat && action.kind !== "command") return;
      const ui = useUiStore.getState();
      if (action.kind === "command") {
        if (e.repeat && action.command.type === "toggle") return;
        useReplayStore.getState().send(action.command);
      } else if (action.kind === "legend") ui.toggleLegend();
      else if (action.kind === "insights") ui.toggleInsights();
      else if (action.kind === "favourite") ui.toggleDriver(FAVOURITE_DRIVER.code);
      else ui.clearSelection();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);
}
