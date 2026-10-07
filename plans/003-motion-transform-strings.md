# 003 — Use hardware-accelerated transform strings for Motion entrances

- **Status**: TODO
- **Commit**: 32c05ff
- **Severity**: MEDIUM
- **Category**: Performance
- **Estimated scope**: 1 file (StatusBanner is covered by plan 002)
- **Depends on**: 001

## Problem

Motion's `y` shorthand animates on the main thread. The home page entrance plays while
the mini-replay canvas, a WebSocket and several fetches start, exactly when the main
thread is busiest:

```tsx
// web/components/home/HomeView.tsx:59-61 — current
initial: { opacity: 0, y: 16 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.6, delay, ease: EASE },
// web/components/home/HomeView.tsx:163-167 — current
initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} ...
```

## Target

```tsx
initial: { opacity: 0, transform: "translateY(16px)" },
animate: { opacity: 1, transform: "translateY(0px)" },
transition: { duration: 0.6, delay, ease: EASE_OUT },   // marketing entrance: 600ms is allowed
// tiles
initial={{ opacity: 0, transform: "translateY(20px)" }}
whileInView={{ opacity: 1, transform: "translateY(0px)" }}
transition={{ duration: 0.5, delay: index * 0.07, ease: EASE_OUT }}
```

## Steps

1. Replace the `y` keys in `enter()` and `RaceTile` with the transform strings above.

## Boundaries

- Keep durations and stagger (0.6s / 0.5s, 70ms stagger) — the home page is a marketing surface.

## Verification

- **Mechanical**: typecheck, lint, tests pass.
- **Feel check**: reload the home page with DevTools CPU throttling 4x: the headline and tiles still rise smoothly; reduced motion shows them without movement.
- **Done when**: no Motion `x`/`y`/`scale` shorthand remains in `web/components`.
