"use client";

/**
 * useSceneTimer — RAF-driven scene clock.
 *
 * If `externalElapsedMs` is provided, the hook becomes a passthrough (clamped
 * to [0, durationMs]). Otherwise it self-clocks from mount via
 * requestAnimationFrame. `progress` is `elapsedMs / durationMs` clamped 0..1.
 * `onComplete` fires exactly once when elapsedMs >= durationMs.
 */
import { useEffect, useRef, useState } from "react";

export type UseSceneTimerOptions = {
  externalElapsedMs?: number;
  onComplete?: () => void;
};

export type UseSceneTimerResult = {
  elapsedMs: number;
  progress: number;
};

export function useSceneTimer(
  durationMs: number,
  options?: UseSceneTimerOptions
): UseSceneTimerResult {
  const { externalElapsedMs, onComplete } = options ?? {};
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;

  const completedRef = useRef(false);

  // Internal clock — only used when externalElapsedMs is undefined.
  const [internalElapsed, setInternalElapsed] = useState(0);
  const isExternal = externalElapsedMs !== undefined;

  useEffect(() => {
    if (isExternal) return;
    let frame = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const e = now - start;
      setInternalElapsed(e);
      if (e < durationMs) {
        frame = requestAnimationFrame(tick);
      } else {
        // Pin to durationMs at end so consumers see a stable terminal value.
        setInternalElapsed(durationMs);
      }
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [isExternal, durationMs]);

  const rawElapsed = isExternal ? (externalElapsedMs as number) : internalElapsed;
  const elapsedMs = clamp(rawElapsed, 0, durationMs);
  const progress = durationMs > 0 ? clamp(elapsedMs / durationMs, 0, 1) : 1;

  // Fire onComplete exactly once when the timer crosses the finish line.
  useEffect(() => {
    if (completedRef.current) return;
    if (elapsedMs >= durationMs && durationMs > 0) {
      completedRef.current = true;
      onCompleteRef.current?.();
    }
  }, [elapsedMs, durationMs]);

  return { elapsedMs, progress };
}

function clamp(value: number, min: number, max: number): number {
  if (value < min) return min;
  if (value > max) return max;
  return value;
}
