# 001 — Add shared motion tokens and use them everywhere

- **Status**: TODO
- **Commit**: 32c05ff
- **Severity**: MEDIUM
- **Category**: Cohesion & tokens (also Easing & duration)
- **Estimated scope**: 3 files, ~30 lines

## Problem

Four different easings with no shared tokens:

```css
/* web/app/globals.css:131 — current (button press) */
transition-timing-function: cubic-bezier(0.16, 1, 0.3, 1);
```
```ts
// web/components/home/HomeView.tsx:17 — current
const EASE = [0.16, 1, 0.3, 1] as const;
// web/components/StatusBanner.tsx:20 — current (Motion's weak built-in)
transition={{ duration: 0.25, ease: "easeOut" }}
```
Tailwind `transition-colors` / `transition-transform` utilities (e.g. `InsightsMenu.tsx:32`,
`SeasonCalendar.tsx:165`) use Tailwind's default `cubic-bezier(0.4, 0, 0.2, 1)`.

## Target

```css
/* web/app/globals.css, inside @theme inline (overrides Tailwind's ease-* utilities) */
--ease-out: cubic-bezier(0.23, 1, 0.32, 1);       /* strong ease-out for UI */
--ease-in-out: cubic-bezier(0.77, 0, 0.175, 1);   /* strong ease-in-out for on-screen movement */
--default-transition-timing-function: cubic-bezier(0.23, 1, 0.32, 1);
--default-transition-duration: 160ms;
```
```ts
// web/lib/motion.ts (new)
export const EASE_OUT = [0.23, 1, 0.32, 1] as const;
export const EASE_IN_OUT = [0.77, 0, 0.175, 1] as const;
export const DURATION = { press: 0.16, small: 0.2, exit: 0.15 } as const;
```

## Repo conventions to follow

- Design tokens live in `web/app/globals.css` under `@theme inline` (see `--color-*`, `--radius-ui`).
- Shared TS constants live in `web/lib/*.ts` (see `web/lib/status.ts`).

## Steps

1. In `globals.css` `@theme inline`, add the four lines above.
2. In `globals.css` button base rule, replace `cubic-bezier(0.16, 1, 0.3, 1)` with `var(--ease-out)`.
3. Create `web/lib/motion.ts` exactly as above.
4. `HomeView.tsx`: delete `const EASE` and import `EASE_OUT` from `@/lib/motion`; replace `EASE` uses.
5. `StatusBanner.tsx`: replace `ease: "easeOut"` with `ease: EASE_OUT` (import it).

## Boundaries

- Motion values only; no markup changes. No new dependencies.
- Do not change durations here except where a step says so.

## Verification

- **Mechanical**: `npm run typecheck && npm run lint && npm test` pass. In the browser, `getComputedStyle(button).transitionTimingFunction` is `cubic-bezier(0.23, 1, 0.32, 1)`; a `transition-colors` element reports the same curve and 160ms.
- **Feel check**: hover a calendar row and press a button: changes start immediately and settle softly; nothing feels laggy.
- **Done when**: no hand-typed cubic-bezier or `"easeOut"` string remains outside `globals.css` and `lib/motion.ts`.
