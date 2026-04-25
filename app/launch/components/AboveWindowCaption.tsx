"use client";

/**
 * AboveWindowCaption — narration line that floats above the MacWindow chrome
 * during product scenes. Mirrors the "Using Github: searched channels …" header
 * in the ChatGPT-5.5 launch reference video. Reads as a verb-first sentence
 * fragment in Source Code Pro to feel like a developer console echo.
 *
 * Lifecycle (all in ms):
 *   0..200  — fades in + slides down 8px → 0
 *   200..(text.len*8 + 200) — characters reveal one by one
 *   hold for the rest of the scene's caption window
 *   last 320ms — fades out + slides up 8px
 *
 * Caption is sourced from `TIMELINE[i].caption` and rendered by LaunchTimeline,
 * so individual scenes never import this directly.
 */

import { useMemo } from "react";

export type AboveWindowCaptionProps = {
  /** The text to type out. */
  text: string;
  /** ms elapsed inside the parent scene. */
  elapsedMs: number;
  /** total scene duration in ms. */
  durationMs: number;
};

const ENTER_MS = 220;
const PER_CHAR_MS = 14;
const EXIT_MS = 320;

export function AboveWindowCaption({
  text,
  elapsedMs,
  durationMs,
}: AboveWindowCaptionProps) {
  const typingMs = text.length * PER_CHAR_MS;
  const exitStart = Math.max(durationMs - EXIT_MS, ENTER_MS + typingMs + 200);

  const visibleChars = useMemo(() => {
    const t = elapsedMs - ENTER_MS;
    if (t <= 0) return 0;
    return Math.min(text.length, Math.floor(t / PER_CHAR_MS));
  }, [elapsedMs, text]);

  // Enter: 0 → ENTER_MS lerp opacity 0→1 and translateY -8 → 0
  const enterT = Math.max(0, Math.min(1, elapsedMs / ENTER_MS));
  // Exit: exitStart → durationMs lerp opacity 1→0 and translateY 0 → -8
  const exitProgress =
    elapsedMs <= exitStart
      ? 0
      : Math.min(1, (elapsedMs - exitStart) / EXIT_MS);

  const opacity = enterT * (1 - exitProgress);
  const translateY = -8 + enterT * 8 + exitProgress * -8;

  const shown = text.slice(0, visibleChars);

  return (
    <div
      style={{
        position: "absolute",
        top: 28,
        left: "50%",
        transform: `translate(-50%, ${translateY}px)`,
        opacity,
        transition: "opacity 120ms linear",
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: "6px 14px",
        borderRadius: 9999,
        background: "rgba(255, 255, 255, 0.66)",
        backdropFilter: "blur(14px)",
        WebkitBackdropFilter: "blur(14px)",
        border: "1px solid rgba(15, 15, 15, 0.06)",
        color: "#3a3a3a",
        fontFamily:
          "var(--font-source-code-pro), ui-monospace, SFMono-Regular, monospace",
        fontSize: 12,
        letterSpacing: "0.6px",
        textTransform: "uppercase",
        whiteSpace: "nowrap",
        pointerEvents: "none",
        zIndex: 50,
        fontVariantNumeric: "tabular-nums",
        willChange: "transform, opacity",
      }}
      aria-live="polite"
      aria-atomic="true"
    >
      <span
        aria-hidden="true"
        style={{
          width: 6,
          height: 6,
          borderRadius: 9999,
          background: "var(--brand-green, #3ecf8e)",
          boxShadow: "0 0 0 3px rgba(62, 207, 142, 0.18)",
          flexShrink: 0,
        }}
      />
      <span>{shown}</span>
      {visibleChars < text.length ? (
        <span
          aria-hidden="true"
          style={{
            display: "inline-block",
            width: 1,
            height: 11,
            background: "#3a3a3a",
            marginLeft: 1,
            opacity: Math.floor(elapsedMs / 380) % 2 === 0 ? 1 : 0,
          }}
        />
      ) : null}
    </div>
  );
}
