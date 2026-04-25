"use client";

import { motion, AnimatePresence } from "motion/react";
import { CAPTION_FADE } from "@/components/demo-deck/pace";
import type { StageConfig } from "./stages";

// One caption surface for the whole deck. Always anchored at the top.
// Stage 0 reads as a normal slide here — the "Meet Carbo" hero lives in
// the canvas (frames.tsx → HeroFrame), not in this caption.
//
// Typography pulled up to hackaway-class sizes so a stranger can read each
// slide without scrolling or zooming. text-4xl md:text-5xl headlines.

export function Caption({ stage }: { stage: StageConfig }) {
  // The DAG stage and the receipt-OCR stage both own their captions internally
  // (split layout — text on the left, animation on the right) so the top
  // caption strip is suppressed for those stages.
  if (stage.frames.dag) return null;
  if (stage.frames.receiptOcr) return null;
  return (
    <div className="pointer-events-none fixed left-0 right-0 top-0 z-30 flex flex-col items-center px-12 pt-10 md:pt-14">
      <AnimatePresence mode="wait">
        <motion.div
          key={stage.id}
          className="flex max-w-5xl flex-col items-center gap-4 text-center"
          initial={{ opacity: 0, y: -6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          transition={CAPTION_FADE}
        >
          <span className="font-mono text-sm uppercase tracking-[0.22em] text-[var(--brand-green)]">
            {stage.caption.eyebrow}
          </span>

          <h1 className="max-w-[36ch] text-balance text-3xl font-normal leading-[1.08] tracking-tight text-[var(--fg-primary)] md:text-5xl">
            {stage.caption.headline}
          </h1>

          {stage.caption.sub && (
            <p className="max-w-[58ch] text-balance text-base text-[var(--fg-secondary)] md:text-xl">
              {stage.caption.sub}
            </p>
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
