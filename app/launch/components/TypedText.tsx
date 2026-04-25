"use client";

/**
 * TypedText — character-stagger reveal driven by a single RAF loop.
 *
 * Each character is its own <span> that fades in over 120ms. The number of
 * characters visible at any frame is derived from elapsed time, so the
 * component is monotonic and resilient to dropped frames.
 *
 * Spaces render as non-breaking spaces so layout width is locked from frame 1
 * (no reflow as letters appear).
 */
import { useEffect, useRef, useState, useMemo } from "react";

export type TypedTextProps = {
  text: string;
  perCharMs?: number;
  startDelayMs?: number;
  className?: string;
};

const REVEAL_MS = 120;

export function TypedText({
  text,
  perCharMs = 22,
  startDelayMs = 0,
  className,
}: TypedTextProps) {
  const [elapsed, setElapsed] = useState(0);
  const startRef = useRef<number | null>(null);
  const totalRevealMs = startDelayMs + text.length * perCharMs + REVEAL_MS;

  useEffect(() => {
    let frame = 0;
    startRef.current = null;
    const tick = (now: number) => {
      if (startRef.current === null) startRef.current = now;
      const e = now - startRef.current;
      setElapsed(e);
      if (e < totalRevealMs) {
        frame = requestAnimationFrame(tick);
      }
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [totalRevealMs, text]);

  const chars = useMemo(() => Array.from(text), [text]);

  return (
    <span
      className={className}
      style={{ whiteSpace: "pre-wrap", display: "inline" }}
      aria-label={text}
    >
      {chars.map((ch, i) => {
        // Per-char fade window: starts at startDelayMs + i * perCharMs.
        const charStart = startDelayMs + i * perCharMs;
        const local = elapsed - charStart;
        let opacity: number;
        if (local <= 0) opacity = 0;
        else if (local >= REVEAL_MS) opacity = 1;
        else opacity = local / REVEAL_MS;
        return (
          <span
            key={i}
            aria-hidden="true"
            style={{
              display: "inline",
              whiteSpace: "pre-wrap",
              opacity,
              transition: "opacity 0ms",
            }}
          >
            {ch === " " ? " " : ch}
          </span>
        );
      })}
    </span>
  );
}
