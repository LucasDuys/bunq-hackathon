"use client";

import { useCallback, useEffect, useState } from "react";
import { Canvas } from "@/components/demo-deck/canvas/Canvas";
import { Caption } from "@/components/demo-deck/canvas/Caption";
import { STAGES } from "@/components/demo-deck/canvas/stages";
import { StepIndicator } from "@/components/demo-deck/StepIndicator";

// v2 morphing canvas. One mounted tree, no slide-show swap.
// Stage advances on Space/ArrowRight/Enter; reverses on ArrowLeft;
// resets on R. Motion's layoutId across element components handles every
// inter-stage morph in one continuous animation.

export default function DemoDeckPage() {
  const [stageIdx, setStageIdx] = useState(0);
  const stage = STAGES[stageIdx];

  const navigate = useCallback((dir: "next" | "prev" | number) => {
    if (typeof dir === "number") {
      setStageIdx(Math.max(0, Math.min(STAGES.length - 1, dir)));
    } else if (dir === "next") {
      setStageIdx((s) => Math.min(s + 1, STAGES.length - 1));
    } else {
      setStageIdx((s) => Math.max(s - 1, 0));
    }
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight" || e.key === " " || e.key === "Enter") {
        e.preventDefault();
        navigate("next");
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        navigate("prev");
      } else if (e.key === "r" || e.key === "R") {
        e.preventDefault();
        navigate(0);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [navigate]);

  return (
    <div className="relative h-full w-full overflow-hidden text-[var(--fg-primary)]">
      <Canvas stage={stage} />
      <Caption stage={stage} />

      {stageIdx > 0 && (
        <button
          onClick={() => navigate("prev")}
          className="fixed bottom-8 left-8 z-50 flex h-10 w-10 items-center justify-center rounded-full border border-[var(--border-default)] bg-[var(--bg-button)] text-[var(--fg-muted)] transition-colors hover:text-[var(--fg-primary)] hover:border-[var(--border-stronger)]"
          aria-label="Previous stage"
        >
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
            <path
              d="M10 3L5 8L10 13"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
      )}

      {stageIdx < STAGES.length - 1 && (
        <button
          onClick={() => navigate("next")}
          className="fixed bottom-8 right-8 z-50 flex h-10 w-10 items-center justify-center rounded-full border border-[var(--border-default)] bg-[var(--bg-button)] text-[var(--fg-muted)] transition-colors hover:text-[var(--fg-primary)] hover:border-[var(--border-stronger)]"
          aria-label="Next stage"
        >
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
            <path
              d="M6 3L11 8L6 13"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
      )}

      <StepIndicator current={stageIdx} total={STAGES.length} onNavigate={navigate} />
    </div>
  );
}
