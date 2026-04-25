"use client";

/**
 * CountUpNumber — RAF-driven number tween for hero KPIs, CFO report figures,
 * and scale-projection numbers. Supports decimal precision, prefix/suffix,
 * locale formatting (en-NL by default — `€ 4.320` style), and ease-out
 * cubic so the number lands rather than abruptly stopping.
 *
 * Pure client-component, runs its own RAF; consumers control `value` and may
 * pass `restartKey` to force a re-tween from 0 (e.g. when a slider snaps).
 *
 * Renders a `<span>` so it inherits typography from the parent. Always uses
 * `tabular-nums` per DESIGN.md.
 */
import { useEffect, useRef, useState } from "react";

export type CountUpNumberProps = {
  /** Final value to count up to. */
  value: number;
  /** ms over which to tween. */
  durationMs?: number;
  /** Decimal places. */
  decimals?: number;
  /** Prefix string (e.g. "€ "). */
  prefix?: string;
  /** Suffix string (e.g. " kgCO₂e"). */
  suffix?: string;
  /** BCP-47 locale. Default "nl-NL". */
  locale?: string;
  /**
   * Reset and re-tween from 0 when this changes. Useful for slider scenes that
   * snap between fixed tiers — pass the tier index here.
   */
  restartKey?: string | number;
  /** Optional className for inherited styling. */
  className?: string;
};

function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}

export function CountUpNumber({
  value,
  durationMs = 700,
  decimals = 0,
  prefix = "",
  suffix = "",
  locale = "nl-NL",
  restartKey,
  className,
}: CountUpNumberProps) {
  const [shown, setShown] = useState(0);
  const startRef = useRef<number | null>(null);
  const fromRef = useRef(0);
  const toRef = useRef(value);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    fromRef.current = 0;
    toRef.current = value;
    startRef.current = null;

    const tick = (now: number) => {
      if (startRef.current === null) startRef.current = now;
      const t = Math.min(1, (now - startRef.current) / durationMs);
      const eased = easeOutCubic(t);
      const v = fromRef.current + (toRef.current - fromRef.current) * eased;
      setShown(v);
      if (t < 1) {
        rafRef.current = requestAnimationFrame(tick);
      }
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, [value, durationMs, restartKey]);

  const formatted = shown.toLocaleString(locale, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });

  return (
    <span
      className={className}
      style={{ fontVariantNumeric: "tabular-nums" }}
    >
      {prefix}
      {formatted}
      {suffix}
    </span>
  );
}
