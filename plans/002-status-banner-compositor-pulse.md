# 002 — Pulse the status banner glow with opacity, and make its exit faster

- **Status**: TODO
- **Commit**: 32c05ff
- **Severity**: MEDIUM (pulse) + LOW (exit timing)
- **Category**: Performance; Interruptibility (asymmetric timing)
- **Estimated scope**: 2 files, ~25 lines
- **Depends on**: 001 (EASE_OUT, DURATION)

## Problem

The SC/VSC/red-flag banner pulses by animating `box-shadow` forever, a paint on every
frame, for the minutes a safety car is out, on top of a 60 fps canvas:

```css
/* web/app/globals.css:185-189 — current */
@keyframes pulse-glow {
  0%, 100% { box-shadow: 0 0 0 0 color-mix(in srgb, var(--glow) 60%, transparent); }
  50% { box-shadow: 0 0 22px 6px color-mix(in srgb, var(--glow) 45%, transparent); }
}
.animate-pulse-glow { animation: pulse-glow 1.6s ease-in-out infinite; }
```
Its exit mirrors its entry (`StatusBanner.tsx:17-20`: y -16, 0.25s both ways). Exits should be faster.

## Target

```css
/* glow drawn once on a pseudo-element; only its opacity animates (compositor-only) */
.animate-pulse-glow { position: relative; isolation: isolate; }
.animate-pulse-glow::after {
  content: ""; position: absolute; inset: 0; z-index: -1; border-radius: inherit;
  box-shadow: 0 0 22px 6px color-mix(in srgb, var(--glow) 55%, transparent);
  animation: pulse-opacity 1.6s cubic-bezier(0.77, 0, 0.175, 1) infinite;
}
@keyframes pulse-opacity { 0%, 100% { opacity: 0.15; } 50% { opacity: 1; } }
/* reduced motion: steady glow, no pulse */
```
```tsx
// StatusBanner.tsx motion props
initial={{ opacity: 0, transform: "translateY(-12px)" }}
animate={{ opacity: 1, transform: "translateY(0px)", transition: { duration: 0.2, ease: EASE_OUT } }}
exit={{ opacity: 0, transform: "translateY(-6px)", transition: { duration: DURATION.exit, ease: EASE_OUT } }}
```

## Steps

1. Replace the `pulse-glow` keyframes and `.animate-pulse-glow` rule with the target CSS.
2. In the reduced-motion block, keep `.animate-pulse-glow::after { animation: none; opacity: 0.6; }` (steady glow, no movement).
3. Update the `motion.div` props in `StatusBanner.tsx` as above (full transform strings, faster exit).

## Boundaries

- Do not change the banner's text, colours, or the slanted chip markup.

## Verification

- **Mechanical**: typecheck, lint, tests pass; in the browser the banner element's computed `animation-name` on `::after` is `pulse-opacity`; no element animates `box-shadow`.
- **Feel check**: seek into a safety car. The glow breathes as before. In DevTools Rendering > Paint flashing, the banner does **not** flash every frame. Seek out of it: the banner leaves noticeably faster than it arrived.
- **Done when**: the pulse animates only opacity; exit duration 150ms < enter 200ms.
