"use client";

/**
 * TitleCard — centered, wrapping title with a fade-in / fade-out and a
 * typewriter reveal. No horizontal slide — long titles just wrap and stay
 * centered, so nothing ever clips against the scene's overflow:hidden frame.
 *
 * Lifecycle (ms):
 *   0           — opacity 0
 *   0..ENTER_MS — fade in (opacity 0 → 1)
 *   TYPE_OFFSET — TypedText begins revealing characters
 *   exitAt      — fade out fires
 *   exitAt + EXIT_MS — onComplete()
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

const ENTER_MS = 320;
const TYPE_OFFSET_MS = 120;
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

  const isExit = phase === "exit" || phase === "done";

  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        pointerEvents: "none",
        padding: "0 6vw",
      }}
    >
      <FadeFrame isExit={isExit}>
        <h1 className={styles.titleText}>
          <TypedText
            text={text}
            perCharMs={perCharMs}
            startDelayMs={TYPE_OFFSET_MS}
          />
        </h1>
      </FadeFrame>
    </div>
  );
}

/**
 * Forces the very first paint at opacity 0, then fades in. On exit, fades out.
 * No horizontal slide — long titles centered + wrapped via .titleText.
 */
function FadeFrame({
  isExit,
  children,
}: {
  isExit: boolean;
  children: React.ReactNode;
}) {
  const [primed, setPrimed] = useState(false);
  useEffect(() => {
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

  const opacity = isExit ? 0 : primed ? 1 : 0;

  return (
    <div
      style={{
        opacity,
        transition: isExit
          ? `opacity ${EXIT_MS}ms ${EXIT_EASE}`
          : `opacity ${ENTER_MS}ms ${ENTER_EASE}`,
        willChange: "opacity",
        maxWidth: "min(1100px, 88vw)",
      }}
    >
      {children}
    </div>
  );
}
