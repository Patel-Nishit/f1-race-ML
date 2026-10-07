// Motion tokens for JS (Motion) animations. The CSS twins live in
// app/globals.css (--ease-out, --ease-in-out); keep the two in sync.

/** Strong ease-out for UI: starts fast, settles softly. */
export const EASE_OUT = [0.23, 1, 0.32, 1] as const;
/** Strong ease-in-out for things moving on screen. */
export const EASE_IN_OUT = [0.77, 0, 0.175, 1] as const;

/**
 * A transform to animate from, or "none" under reduced motion.
 *
 * We animate full transform strings (they run on the compositor), but
 * MotionConfig's reducedMotion="user" only strips Motion's x/y/scale
 * shorthands, not raw transform strings. So components pass the starting
 * transform through this: with reduced motion, only the fade remains.
 */
export function from(transform: string, reduce: boolean | null): string {
  return reduce ? "none" : transform;
}

/** Seconds. UI stays under 0.3; exits are faster than entrances. */
export const DURATION = { press: 0.16, small: 0.2, exit: 0.15 } as const;
