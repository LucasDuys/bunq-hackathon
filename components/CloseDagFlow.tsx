"use client";

import { useEffect, useRef, useState } from "react";
import { DagFlow } from "@/app/launch/components/DagFlow";
import { DAG_NODES } from "@/app/launch/data";

const DURATION_MS = 12_000;

/**
 * Animated 8-agent DAG visual for the close page.
 *
 * - When the close run is in DAG_RUNNING state, ticks `elapsedMs` from the
 *   server-supplied `startedAtUnix` so the animation tracks real wall time.
 * - When the run has advanced past DAG_RUNNING, freezes at `DURATION_MS` so
 *   every node renders in `done` state.
 * - Honors `prefers-reduced-motion` by jumping straight to the done frame.
 *
 * Reuses `DAG_NODES` from `app/launch/data.ts` so both the demo timeline and
 * the close page consume identical agent metadata.
 */
export function CloseDagFlow({
  startedAtUnix,
  isRunning,
}: {
  startedAtUnix: number;
  isRunning: boolean;
}) {
  const reducedMotion =
    typeof window !== "undefined" &&
    window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

  const initialElapsed = isRunning && !reducedMotion
    ? Math.min(DURATION_MS, Math.max(0, Date.now() - startedAtUnix * 1000))
    : DURATION_MS;
  const [elapsedMs, setElapsedMs] = useState(initialElapsed);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    if (!isRunning || reducedMotion) {
      setElapsedMs(DURATION_MS);
      return;
    }
    const tick = () => {
      const e = Math.min(DURATION_MS, Math.max(0, Date.now() - startedAtUnix * 1000));
      setElapsedMs(e);
      if (e < DURATION_MS) {
        rafRef.current = requestAnimationFrame(tick);
      }
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    };
  }, [isRunning, reducedMotion, startedAtUnix]);

  return (
    <div className="overflow-x-auto">
      <DagFlow nodes={DAG_NODES} elapsedMs={elapsedMs} durationMs={DURATION_MS} />
    </div>
  );
}
