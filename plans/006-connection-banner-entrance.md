# 006 — Ease the connection-lost banner in and out

- **Status**: TODO
- **Commit**: 32c05ff
- **Severity**: LOW (additive)
- **Category**: Missed opportunity (preventing a jarring change)
- **Estimated scope**: 2 files, ~15 lines
- **Depends on**: 001

## Problem

`web/components/TopBar.tsx:92-105` renders `ConnectionBanner` with `if (...) return null`:
it pops over the track and vanishes with no bridge. Occasional (only when the stream drops).

## Target

Motion \`AnimatePresence\` around a keyed \`motion.p\` (entrance and exit in one place):

- Enter: \`initial={{ opacity: 0, transform: "scale(0.97)" }}\` → \`animate={{ opacity: 1, transform: "scale(1)" }}\`,
  200ms \`EASE_OUT\` (\`[0.23, 1, 0.32, 1]\`).
- Exit: \`{ opacity: 0, transform: "scale(0.98)" }\`, 150ms \`EASE_OUT\` (exit faster than enter).
- Centred overlay, so the default centre origin is correct. Reduced motion: \`MotionConfig reducedMotion="user"\`
  (already on the page) drops the scale and keeps the fade.

## Steps

1. Render the banner inside `<AnimatePresence>` with a keyed `motion.p`: `initial={{ opacity: 0, transform: "scale(0.97)" }}`, `animate={{ opacity: 1, transform: "scale(1)" }}` 200ms, `exit` as above.

## Verification

- **Feel check**: with a replay open, stop the API: the banner fades/settles in (not a pop); restart it: it leaves faster than it came. Reduced motion: fades only.
