"use client";

/**
 * HeaderOverlay — chapter-card text rendered in the launch video's TOP PLATE,
 * the dedicated text band above the camera-zoomed MacWindow stage. The plate
 * sits in the white shell, so the header never collides with the dark window
 * interior the way the previous absolute-positioned overlay did.
 *
 * Lifecycle (scene-local ms):
 *   0..ENTER_MS         — fade in + slide down 16px → 0
 *   ENTER_MS..exitStart — hold (no drift; the plate is a stage, not a runway)
 *   last EXIT_MS        — fade out + slide up 8px
 *
 * Sourced from `TIMELINE[i].header`, mounted by LaunchTimeline.
 */

export type HeaderOverlayProps = {
  text: string;
  elapsedMs: number;
  durationMs: number;
  /** 1-indexed scene number (e.g., 4) — rendered as a chapter eyebrow. */
  sceneIndex?: number;
  /** Total scene count — paired with sceneIndex. */
  sceneTotal?: number;
};

const ENTER_MS = 360;
const EXIT_MS = 480;

export function HeaderOverlay({
  text,
  elapsedMs,
  durationMs,
  sceneIndex,
  sceneTotal,
}: HeaderOverlayProps) {
  const enterT = Math.max(0, Math.min(1, elapsedMs / ENTER_MS));
  const exitStart = Math.max(0, durationMs - EXIT_MS);
  const exitT =
    elapsedMs <= exitStart
      ? 0
      : Math.min(1, (elapsedMs - exitStart) / EXIT_MS);

  const opacity = enterT * (1 - exitT);
  const translateY = (1 - enterT) * 16 + exitT * -8;

  const showEyebrow = sceneIndex !== undefined && sceneTotal !== undefined;

  return (
    <div
      style={{
        width: "100%",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 6,
        opacity,
        transform: `translateY(${translateY}px)`,
        transition: "opacity 120ms linear",
        willChange: "transform, opacity",
      }}
      aria-live="polite"
      aria-atomic="true"
    >
      {showEyebrow ? (
        <div
          aria-hidden="true"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            fontFamily:
              "var(--font-source-code-pro), ui-monospace, SFMono-Regular, monospace",
            fontSize: 11,
            letterSpacing: "1.2px",
            textTransform: "uppercase",
            color: "rgba(10, 10, 10, 0.42)",
            fontVariantNumeric: "tabular-nums",
          }}
        >
          <span
            style={{
              width: 4,
              height: 4,
              borderRadius: 9999,
              background: "var(--brand-green, #3ecf8e)",
              display: "inline-block",
            }}
          />
          {String(sceneIndex).padStart(2, "0")} / {String(sceneTotal).padStart(2, "0")}
        </div>
      ) : null}
      <h2
        style={{
          margin: 0,
          fontFamily: "var(--font-inter), system-ui, sans-serif",
          fontWeight: 400,
          fontSize: "clamp(26px, 3.4vw, 52px)",
          lineHeight: 1.0,
          letterSpacing: "-0.018em",
          color: "#0a0a0a",
          textAlign: "center",
          textWrap: "balance",
          maxWidth: "min(1100px, 92vw)",
        }}
      >
        {text}
      </h2>
    </div>
  );
}
