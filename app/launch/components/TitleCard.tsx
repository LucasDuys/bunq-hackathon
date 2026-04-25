"use client";

/**
 * TitleCard — the signature gesture of the launch video.
 *
 * Lifecycle (frame-perfect, all timings in ms):
 *   0    — container starts at translateX(120px) opacity 0
 *   0..350 — slides to translateX(0) opacity 1 with cubic-bezier(0.32, 0.72, 0, 1)
 *   150  — TypedText begins revealing characters (overlapping the slide-in)
 *   350 + text.length*perCharMs + holdMs — exit fires
 *   exit lasts 280ms: translateX(0 → -80px) opacity (1 → 0), ease-in
 *   onComplete fires after exit settles.
 */
import { useEffect, useRef, useState } from "react";
import styles from "../launch.module.css";
import { TypedText } from "./TypedText";

export type TitleCardProps = {
  text: string;
  holdMs?: number;
  perCharMs?: number;
  onComplete?: () => void;
};

const ENTER_MS = 350;
const TYPE_OFFSET_MS = 150;
const EXIT_MS = 280;
const ENTER_EASE = "cubic-bezier(0.32, 0.72, 0, 1)";
const EXIT_EASE = "cubic-bezier(0.4, 0, 1, 1)";

type Phase = "enter" | "exit" | "done";

export function TitleCard({
  text,
  holdMs = 1200,
  perCharMs = 22,
  onComplete,
}: TitleCardProps) {
  const [phase, setPhase] = useState<Phase>("enter");
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;

  const typingMs = text.length * perCharMs;
  const exitAt = ENTER_MS + typingMs + holdMs;

  useEffect(() => {
    const exitTimer = window.setTimeout(() => setPhase("exit"), exitAt);
    const doneTimer = window.setTimeout(() => {
      setPhase("done");
      onCompleteRef.current?.();
    }, exitAt + EXIT_MS);
    return () => {
      window.clearTimeout(exitTimer);
      window.clearTimeout(doneTimer);
    };
  }, [exitAt]);

  // Compute transform & opacity from phase. We use a CSS transition driven by
  // class swap so the browser handles interpolation; the timing is exactly
  // ENTER_MS / EXIT_MS via inline style.
  const isEnter = phase === "enter";
  const isExit = phase === "exit" || phase === "done";

  const transform = isExit ? "translateX(-80px)" : isEnter ? "translateX(0)" : "translateX(0)";
  const opacity = isExit ? 0 : 1;

  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        pointerEvents: "none",
      }}
    >
      <div
        style={{
          // Initial frame is translateX(120px) opacity 0; React mounts that
          // first paint, then immediately transitions to (0, 1) on next tick.
          transform,
          opacity,
          transition: isExit
            ? `transform ${EXIT_MS}ms ${EXIT_EASE}, opacity ${EXIT_MS}ms ${EXIT_EASE}`
            : `transform ${ENTER_MS}ms ${ENTER_EASE}, opacity ${ENTER_MS}ms ${ENTER_EASE}`,
          willChange: "transform, opacity",
          maxWidth: "min(1200px, 90vw)",
          padding: "0 32px",
        }}
      >
        <InitialFrame>
          <h1 className={styles.titleText}>
            <TypedText
              text={text}
              perCharMs={perCharMs}
              startDelayMs={TYPE_OFFSET_MS}
            />
          </h1>
        </InitialFrame>
      </div>
    </div>
  );
}

/**
 * Forces the very first paint to start at translateX(120px) opacity 0 by
 * applying that style for one frame, then removing it so the parent's
 * transition kicks in to (0, 1).
 */
function InitialFrame({ children }: { children: React.ReactNode }) {
  const [primed, setPrimed] = useState(false);
  useEffect(() => {
    // Two RAF ticks guarantees the browser has committed the initial styles
    // before we trigger the transition target.
    let f1 = 0;
    let f2 = 0;
    f1 = requestAnimationFrame(() => {
      f2 = requestAnimationFrame(() => setPrimed(true));
    });
    return () => {
      cancelAnimationFrame(f1);
      cancelAnimationFrame(f2);
    };
  }, []);
  return (
    <div
      style={{
        transform: primed ? "translateX(0)" : "translateX(120px)",
        opacity: primed ? 1 : 0,
        transition: `transform ${ENTER_MS}ms ${ENTER_EASE}, opacity ${ENTER_MS}ms ${ENTER_EASE}`,
        willChange: "transform, opacity",
      }}
    >
      {children}
    </div>
  );
}
