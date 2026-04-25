"use client";

import { useEffect, useState } from "react";
import { motion } from "motion/react";

// One-shot counter that ticks from 0 → `value` over `duration` seconds with
// an easeOutCubic ramp. v3.2: no `useInView` — the parent (frame component)
// is itself wrapped in AnimatePresence and only mounts when visible, so
// the counter reliably starts the moment it enters the tree. Keeping inView
// on top of that was double-gating and the layout-animation re-renders were
// flickering it on/off, restarting the ramp mid-tick. Hence the stutter.

export function AnimatedCounter({
  value,
  duration = 1.2,
  prefix = "",
  suffix = "",
  format = (n: number) => n.toLocaleString("en-US"),
  delay = 0,
  className = "",
}: {
  value: number;
  duration?: number;
  prefix?: string;
  suffix?: string;
  format?: (n: number) => string;
  delay?: number;
  className?: string;
}) {
  const [display, setDisplay] = useState(0);

  useEffect(() => {
    let raf = 0;
    let firstTs = 0;
    const startMs = delay * 1000;
    const totalMs = duration * 1000;

    const step = (ts: number) => {
      if (!firstTs) firstTs = ts;
      const elapsed = ts - firstTs;
      const t = Math.min(1, Math.max(0, (elapsed - startMs) / totalMs));
      const eased = 1 - Math.pow(1 - t, 3);
      setDisplay(Math.round(value * eased));
      if (elapsed < startMs + totalMs) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
    // value/duration/delay are intended to be set once for the lifetime
    // of this counter instance — the parent re-mounts the counter when
    // the stage changes, which is exactly when we want a fresh ramp.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <span className={`tabular-nums ${className}`}>
      {prefix}
      {format(display)}
      {suffix}
    </span>
  );
}

// AnimatedNumberBlock kept for back-compat in case any older slide imports it.
export function AnimatedNumberBlock({
  value,
  prefix = "",
  suffix = "",
  format,
  duration,
  delay = 0,
  label,
  hint,
}: {
  value: number;
  prefix?: string;
  suffix?: string;
  format?: (n: number) => string;
  duration?: number;
  delay?: number;
  label: string;
  hint?: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: "easeOut", delay }}
      className="flex flex-col items-start gap-1"
    >
      <div className="font-mono text-xs uppercase tracking-[0.18em] text-[var(--fg-muted)]">
        {label}
      </div>
      <div className="text-5xl font-normal text-[var(--fg-primary)] md:text-6xl">
        <AnimatedCounter
          value={value}
          prefix={prefix}
          suffix={suffix}
          format={format}
          duration={duration}
          delay={delay + 0.1}
        />
      </div>
      {hint && (
        <motion.div
          className="text-sm text-[var(--fg-secondary)]"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.4, ease: "easeOut", delay: delay + 0.6 }}
        >
          {hint}
        </motion.div>
      )}
    </motion.div>
  );
}
