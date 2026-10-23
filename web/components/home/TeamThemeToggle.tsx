"use client";

// On/off switch for the Red Bull colour theme (lib/teamTheme.ts). A real
// switch for screen readers: role="switch" with aria-checked.
import { useSyncExternalStore } from "react";
import { FAVOURITE_TEAM } from "@/lib/favourites";
import { isTeamThemeOn, setTeamTheme, subscribeTeamTheme } from "@/lib/teamTheme";

/** [on, setOn]. The server render assumes "off"; the real value arrives on hydration. */
function useTeamTheme(): [boolean, (on: boolean) => void] {
  const on = useSyncExternalStore(subscribeTeamTheme, isTeamThemeOn, () => false);
  return [on, setTeamTheme];
}

export function TeamThemeToggle({ label = `${FAVOURITE_TEAM.short} theme`, className = "" }:
  { label?: string; className?: string }) {
  const [on, setOn] = useTeamTheme();
  return (
    <button role="switch" aria-checked={on} onClick={() => setOn(!on)}
      className={`flex items-center gap-2.5 rounded-ui px-2 py-1 text-sm text-dim hover:text-ink ${className}`}>
      {label}
      <span aria-hidden="true"
        className={`relative h-5 w-9 shrink-0 rounded-full border transition-colors ${
          on ? "border-f1 bg-f1" : "border-line bg-panel-light"}`}>
        <span className={`absolute top-1/2 h-3.5 w-3.5 -translate-y-1/2 rounded-full transition-[left,background-color] duration-200 ${
          on ? "left-[18px] bg-fav" : "left-[2px] bg-faint"}`} />
      </span>
    </button>
  );
}
