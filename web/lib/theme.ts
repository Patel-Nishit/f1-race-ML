// Theme colours for code that can't use CSS (the canvas).
//
// Colours live as CSS variables in app/globals.css, with a dark and a light
// value switched by the system setting. readTheme() reads the current values;
// onThemeChange() calls back when the visitor's system flips between them.

export interface CanvasTheme {
  trackEdge: string;
  track: string;
  ink: string;
  carStroke: string;
  tagInk: string;
  tagHalo: string;
  sc: string;
  scInk: string;
}

export function readTheme(): CanvasTheme {
  const css = getComputedStyle(document.documentElement);
  const v = (name: string) => css.getPropertyValue(name).trim();
  return {
    trackEdge: v("--track-edge"),
    track: v("--track"),
    ink: v("--ink"),
    carStroke: v("--car-stroke"),
    tagInk: v("--tag-ink"),
    tagHalo: v("--tag-halo"),
    sc: v("--sc"),
    scInk: v("--sc-ink"), // amber as text: darker in light mode for contrast
  };
}

/** Calls `callback` whenever the system switches light/dark. Returns an unsubscribe. */
export function onThemeChange(callback: () => void): () => void {
  const query = window.matchMedia("(prefers-color-scheme: dark)");
  query.addEventListener("change", callback);
  return () => query.removeEventListener("change", callback);
}
