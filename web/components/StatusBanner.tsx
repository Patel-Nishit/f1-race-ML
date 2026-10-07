"use client";

// Big slanted banner over the track during a safety car, VSC or red flag.
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { DURATION, EASE_OUT, from } from "@/lib/motion";
import { useReplayStore } from "@/lib/replayStore";
import { TRACK_STATUS } from "@/lib/status";

export function StatusBanner() {
  const status = useReplayStore((s) => s.buffer.latest?.status ?? 1);
  const info = TRACK_STATUS[status];
  const reduce = useReducedMotion();
  return (
    <div className="flex justify-center" aria-live="assertive">
      {/* mode="wait": when one banner replaces another (VSC -> VSC ENDING), the old
          one leaves before the new one arrives. The default renders both at once,
          side by side, and both jump sideways (measured: 611 -> 539 px). */}
      <AnimatePresence mode="wait">
        {info?.banner && (
          <motion.div
            key={info.banner}
            data-enter
            // full transform strings run on the compositor (Motion's x/y don't)
            initial={{ opacity: 0, transform: from("translateY(-12px)", reduce) }}
            animate={{ opacity: 1, transform: from("translateY(0px)", reduce), transition: { duration: DURATION.small, ease: EASE_OUT } }}
            // leaving is the system responding: faster than arriving
            exit={{ opacity: 0, transform: from("translateY(-6px)", reduce), transition: { duration: DURATION.exit, ease: EASE_OUT } }}
          >
            <div className="chip-slant animate-pulse-glow px-6 py-1.5 text-base font-bold italic tracking-wide text-black md:text-lg"
              style={{ background: info.color, ["--glow" as string]: info.color }}>
              <span className="chip-slant-text">{info.banner}</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
