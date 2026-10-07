# 007 — Transition the round status cell (prepare → progress → ready)

- **Status**: TODO
- **Commit**: 32c05ff
- **Severity**: LOW (additive, delight at a rare moment)
- **Category**: Missed opportunity (state indication)
- **Estimated scope**: 1 file, ~20 lines
- **Depends on**: 001

## Problem

`web/components/home/SeasonCalendar.tsx:197-230`: the status cell swaps instantly between
"Prepare race", the progress bar and "Watch replay". Finishing a ~3 minute job lands silently.

## Target

- Wrap the status cell's content in a `motion.div` keyed by `state` (`missing`, `preparing`, `ready`, `error`),
  inside `<AnimatePresence mode="popLayout" initial={false}>` so the first render (page load,
  season switch) does **not** animate; only real state changes do.
- Enter: `initial={{ opacity: 0, transform: "scale(0.96)" }}` → `animate={{ opacity: 1, transform: "scale(1)" }}`,
  220ms `EASE_OUT` (`[0.23, 1, 0.32, 1]`), `transform-origin: right center` (the cell is right-aligned).
  Exit: `opacity: 0`, 120ms.
- Round number: add `transition-colors duration-300` so it turns red as the race becomes ready.
- Reduced motion: `MotionConfig reducedMotion="user"` (already on the page) removes the scale; fades remain.

## Boundaries

- Keep every label and accessible name (`Prepare race`, `Watch replay`); e2e tests use them.

## Verification

- **Feel check**: click Prepare race: the button gives way to the progress bar smoothly. Reload or switch season: rows do NOT animate. When preparation finishes, "Watch replay" settles in from the right and the round number turns red.
