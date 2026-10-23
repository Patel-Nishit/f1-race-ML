// The optional Red Bull colour theme.
//
// It works like light/dark: the colours are CSS variables (app/globals.css),
// and turning the theme on just sets data-team="redbull" on <html>. The
// choice is saved in localStorage so it survives reloads. A tiny script in
// app/layout.tsx re-applies it before the first paint, so the page never
// flashes the default colours first.
//
// No React in this file: app/layout.tsx (a server component) imports the
// script from here. The hook lives in components/home/TeamThemeToggle.tsx.

export const TEAM_THEME_KEY = "team-theme";
export const TEAM_THEME = "redbull";

/** Runs in <head> before React (keep it tiny, and in sync with setTeamTheme). */
export const TEAM_THEME_SCRIPT = `try{if(localStorage.getItem("${TEAM_THEME_KEY}")==="${TEAM_THEME}")document.documentElement.dataset.team="${TEAM_THEME}"}catch(e){}`;

const listeners = new Set<() => void>();

export function isTeamThemeOn(): boolean {
  return document.documentElement.dataset.team === TEAM_THEME;
}

export function setTeamTheme(on: boolean) {
  if (on) document.documentElement.dataset.team = TEAM_THEME;
  else delete document.documentElement.dataset.team;
  try {
    if (on) localStorage.setItem(TEAM_THEME_KEY, TEAM_THEME);
    else localStorage.removeItem(TEAM_THEME_KEY);
  } catch {
    // private window or blocked storage: the theme still applies until reload
  }
  listeners.forEach((l) => l());
}

/** Calls `onChange` after every setTeamTheme. Returns an unsubscribe. */
export function subscribeTeamTheme(onChange: () => void): () => void {
  listeners.add(onChange);
  return () => listeners.delete(onChange);
}
