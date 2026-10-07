"use client";

// Big slanted banner over the track during a safety car, VSC or red flag.
import { AnimatePresence, motion } from "motion/react";
import { useReplayStore } from "@/lib/replayStore";
import { TRACK_STATUS } from "@/lib/status";

export function StatusBanner() {
  const status = useReplayStore((s) => s.buffer.latest?.status ?? 1);
  const info = TRACK_STATUS[status];
  return (
    <div className="flex justify-center" aria-live="assertive">
      <AnimatePresence>
        {info?.banner && (
          <motion.div
            key={info.banner}
            initial={{ y: -16, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -16, opacity: 0 }}
            transition={{ duration: 0.25, ease: "easeOut" }}
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
