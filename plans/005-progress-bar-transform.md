# 005 — Animate the prepare progress bar with transform, not width

- **Status**: TODO
- **Commit**: 32c05ff
- **Severity**: LOW
- **Category**: Performance
- **Estimated scope**: 1 file, 3 lines
- **Depends on**: 001

## Problem

```tsx
// web/components/home/SeasonCalendar.tsx:217 — current
<div className="h-full bg-f1 transition-[width] duration-500" style={{ width: `${pct}%` }} />
```
`width` is a layout property, and 500ms exceeds the 300ms UI budget for a bar that updates each second.

## Target

```tsx
<div className="h-full w-full origin-left bg-f1 transition-transform duration-300 ease-out"
  style={{ transform: `scaleX(${progress})` }} />
```
(`ease-out` resolves to the token from plan 001.)

## Verification

- **Mechanical**: typecheck, lint pass.
- **Feel check**: prepare a race; the bar grows from the left in quick, decelerating steps.
- **Done when**: no `transition-[width]` remains.
