# Animation plans

From an `improve-animations` audit of `web/` at commit 32c05ff.

| # | Plan | Severity | Status | Depends on |
|---|------|----------|--------|------------|
| 001 | [Shared motion tokens](001-motion-tokens.md) | MEDIUM | DONE | none |
| 002 | [Status banner: opacity pulse, faster exit](002-status-banner-compositor-pulse.md) | MEDIUM | DONE | 001 |
| 003 | [Transform strings for Motion entrances](003-motion-transform-strings.md) | MEDIUM | DONE | 001 |
| 004 | [Press feedback on button-styled links](004-link-press-feedback.md) | MEDIUM | DONE | 001 |
| 005 | [Progress bar via transform](005-progress-bar-transform.md) | LOW | DONE | 001 |
| 006 | [Connection banner entrance/exit](006-connection-banner-entrance.md) | LOW (additive) | DONE | 001 |
| 007 | [Status cell transitions on prepare](007-prepare-status-transitions.md) | LOW (additive) | DONE | 001 |

**Order:** 001 first (tokens), then 002-007 in any order. 006-007 come from `find-animation-opportunities`; its rejected candidates are listed in the plans' commit message.

**Correct as is (not findings):** the 600ms marketing entrance on the home page; no animation on
keyboard-toggled UI (shortcuts popover, Insights collapse); pointer-following tooltips are instant;
the leaderboard spring (stiffness 500, damping 45) snaps after jumps; reduced motion is handled; Tailwind
v4 already gates `hover:` to hover-capable devices.

## Review after execution

`review-animations` isn't installed here, so the review used the `emil-design-eng`
checklist and measured behaviour in a real browser (Playwright sampling computed
styles mid-transition). It found two problems, both fixed:

| Before | After | Why |
| --- | --- | --- |
| Banner `AnimatePresence` in default (sync) mode | `mode="wait"` | VSC -> VSC ENDING rendered both banners side by side; both jumped sideways (measured 611 -> 539 px) |
| Raw `transform` strings, trusting `MotionConfig reducedMotion="user"` | `from(transform, reduce)` + CSS `[data-enter] { transform: none !important }` under reduced motion | Motion only strips its x/y/scale shorthands, so plan 003 silently brought movement back for reduced-motion visitors; the CSS guard also covers the first server-rendered paint, before hydration |

Checked and fine: no `transition: all`, no `scale(0)`, no `ease-in`, no Motion
shorthands; exits faster than entrances (150 vs 200 ms, 120 vs 220 ms); UI motion
<= 300 ms; marketing entrance 500-600 ms (allowed); hover gated by Tailwind v4;
keyboard-toggled UI (shortcuts popover, Insights collapse) stays instant.

Guarded by `e2e/test_design.py::test_entrances_respect_reduced_motion` (normal:
the hero rises; reduced: it only fades), stable over 5 runs on a cold server.
