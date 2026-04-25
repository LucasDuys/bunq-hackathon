"use client";

import { motion } from "motion/react";

// Extracted from app/presentation/page.tsx so both decks share the primitive.
// `value` is a 0..1 confidence; the bar tier flips colour at 0.6 and 0.85.

export function ConfidenceBar({
  value,
  label = "Confidence",
  animateFrom,
  delay = 0,
}: {
  value: number;
  label?: string;
  animateFrom?: number;
  delay?: number;
}) {
  const tier =
    value >= 0.85
      ? "var(--confidence-high)"
      : value >= 0.6
      ? "var(--confidence-medium)"
      : "var(--confidence-low)";
  const pct = Math.round(value * 100);

  return (
    <div className="w-full max-w-md">
      <div className="mb-1.5 flex items-center justify-between">
        <span className="font-mono text-[11px] uppercase tracking-[0.16em] text-[var(--fg-muted)]">
          {label}
        </span>
        <span className="tabular-nums text-xs font-medium text-[var(--fg-secondary)]">
          {pct}%
        </span>
      </div>
      <div
        className="h-1.5 w-full overflow-hidden rounded-full bg-[var(--border-faint)]"
        role="progressbar"
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <motion.div
          className="h-full"
          initial={{ width: `${(animateFrom ?? 0) * 100}%`, background: tier }}
          animate={{ width: `${pct}%`, background: tier }}
          transition={{ duration: 1.0, ease: "easeOut", delay }}
        />
      </div>
    </div>
  );
}
