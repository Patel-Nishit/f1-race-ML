# 004 — Give button-styled links the same press feedback as buttons

- **Status**: TODO
- **Commit**: 32c05ff
- **Severity**: MEDIUM
- **Category**: Physicality & origin
- **Estimated scope**: 1 CSS utility + 5 call sites
- **Depends on**: 001

## Problem

Every `<button>` scales to 0.97 on press (`globals.css:127-135`), but links styled as
buttons don't, so the main calls to action feel dead next to them:
`HomeView.tsx:75` (hero "Watch replay"), `HomeView.tsx:170` (race tiles),
`SeasonCalendar.tsx:199` (row "Watch replay"), `ReplayView.tsx:80` and `not-found.tsx:12` ("Back to races").

## Target

```css
/* web/app/globals.css */
@utility pressable {
  transition-property: transform, background-color, border-color, color;
  transition-duration: 160ms;
  transition-timing-function: var(--ease-out);
  &:active { transform: scale(0.97); }
  @media (prefers-reduced-motion: reduce) { &:active { transform: none; } }
}
@utility pressable-soft { /* large tiles: 0.97 would be too much movement */
  &:active { transform: translateY(-1px) scale(0.99); }
}
```

## Steps

1. Add both utilities to `globals.css`.
2. Add `pressable` to the five links above; add `pressable-soft` to the tile link as well (its existing `transition-[transform,border-color] duration-200` stays).

## Boundaries

- Don't change link destinations, labels or accessible names (tests depend on them).

## Verification

- **Mechanical**: typecheck, lint, tests (`pytest e2e`) pass.
- **Feel check**: press and hold each CTA: it dips like the buttons do; release springs back in ~160ms. Tiles dip less than buttons.
- **Done when**: every element that looks like a button responds to press.
