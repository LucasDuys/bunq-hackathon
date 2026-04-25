"use client";

/**
 * AboveWindowCaption — narrator pill rendered in the launch video's BOTTOM
 * PLATE. The plate is the dedicated text band below the camera-zoomed
 * MacWindow stage; the pill never overlaps animations the way the previous
 * absolute-positioned overlay did.
 *
 * Lifecycle (scene-local ms):
 *   0..ENTER_MS                       — fade in + slide up 8px → 0
 *   ENTER_MS..(typing window)         — characters reveal one by one
 *   hold for the rest of the scene's caption window
 *   last EXIT_MS                      — fade out + slide down 8px
 *
 * Caption is sourced from `TIMELINE[i].caption` and rendered by LaunchTimeline,
 * so individual scenes never import this directly.
 */

import { useMemo } from "react";

export type AboveWindowCaptionProps = {
  text: string;
  elapsedMs: number;
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

  const enterT = Math.max(0, Math.min(1, elapsedMs / ENTER_MS));
  const exitProgress =
    elapsedMs <= exitStart
      ? 0
      : Math.min(1, (elapsedMs - exitStart) / EXIT_MS);

  const opacity = enterT * (1 - exitProgress);
  // Enter from below (+8 → 0), exit downward (0 → +8). Bottom-plate physics:
  // the pill rises out of the plate floor, then sinks back in.
  const translateY = 8 - enterT * 8 + exitProgress * 8;

  const shown = text.slice(0, visibleChars);

  return (
    <div
      style={{
        transform: `translateY(${translateY}px)`,
        opacity,
        transition: "opacity 120ms linear",
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: "6px 14px",
        borderRadius: 9999,
        background: "rgba(255, 255, 255, 0.78)",
        backdropFilter: "blur(14px)",
        WebkitBackdropFilter: "blur(14px)",
        border: "1px solid rgba(15, 15, 15, 0.08)",
        color: "#3a3a3a",
        fontFamily:
          "var(--font-source-code-pro), ui-monospace, SFMono-Regular, monospace",
        fontSize: 14,
        letterSpacing: "0.4px",
        textTransform: "uppercase",
        whiteSpace: "nowrap",
        pointerEvents: "none",
        fontVariantNumeric: "tabular-nums",
        willChange: "transform, opacity",
        maxWidth: "92vw",
        overflow: "hidden",
        textOverflow: "ellipsis",
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
