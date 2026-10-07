"use client";

// Big banner over the track during a safety car, VSC or red flag.
import { AnimatePresence, motion } from "motion/react";
import { useReplayStore } from "@/lib/replayStore";
import { TRACK_STATUS } from "@/lib/status";

export function StatusBanner() {
  const status = useReplayStore((s) => s.buffer.latest?.status ?? 1);
  const info = TRACK_STATUS[status];
  return (
    <div className="pointer-events-none absolute inset-x-0 top-4 flex justify-center" aria-live="assertive">
      <AnimatePresence>
        {info?.banner && (
          <motion.div
            key={info.banner}
            initial={{ y: -24, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -24, opacity: 0 }}
            transition={{ duration: 0.25, ease: "easeOut" }}
            className="animate-pulse-glow rounded px-6 py-1.5 text-lg font-black tracking-wide text-black"
            style={{ background: info.color, ["--glow" as string]: info.color }}
          >
            {info.banner}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
