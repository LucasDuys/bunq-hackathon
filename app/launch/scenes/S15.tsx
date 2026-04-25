"use client";

/**
 * S15 — Scale slider sweep.
 *
 * MacWindow holding the ScaleSlider. The slider's `progress` sweeps through
 * the three SCALE_TIERS (mock → mid-market → enterprise), animating the
 * giant net-EUR + tCO₂e numbers via the slider's RAF count-up.
 *
 * Camera slowly closes in to add weight to the numbers. Three beats:
 *   - Beat 1 (0..30%):  wide hold (scale 0.95, y +30) — chrome visible.
 *   - Beat 2 (30..end): settle to full view, then a gentle close-in toward
 *                       the giant numbers (scale 1.12, y -30).
 */

import type { SceneProps } from "../types";
import { MacWindow } from "../components/MacWindow";
import { CameraScript } from "../components/CameraScript";
import { ScaleSlider } from "../components/ScaleSlider";
import { SCALE_TIERS } from "../data";

const STAMP_SHOW_AT = 0.45; // shows once we've snapped past the mock tier

export default function S15({ elapsedMs, durationMs, progress }: SceneProps) {
  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        background: "#ffffff",
      }}
    >
      <CameraScript
        keyframes={[
          { at: 0,    scale: 0.95, x: 0, y: 30 },
          { at: 0.30, scale: 1.0,  x: 0, y: 0 },
          { at: 1.0,  scale: 1.12, x: 0, y: -30 },
        ]}
        elapsedMs={elapsedMs}
        durationMs={durationMs}
      >
        <MacWindow
          title="Carbo — Scale projection"
          showSidebar
          width={1280}
          height={720}
          glass
        >
          <ScaleSlider tiers={SCALE_TIERS} progress={progress} />
        </MacWindow>
      </CameraScript>

      {/* "1.87% net annual financial impact" stamp — appears once we cross
          past the mock tier; reinforces the canonical 1.87% line from
          our internal narrative. */}
      <ImpactStamp visible={progress > STAMP_SHOW_AT} />
    </div>
  );
}

function ImpactStamp({ visible }: { visible: boolean }) {
  return (
    <div
      style={{
        position: "absolute",
        right: 60,
        top: 80,
        opacity: visible ? 0.96 : 0,
        transform: `rotate(-6deg) scale(${visible ? 1 : 1.4}) translateY(${visible ? 0 : -12}px)`,
        transition:
          "opacity 280ms ease-out, transform 360ms cubic-bezier(0.32, 0.72, 0, 1)",
        padding: "10px 16px",
        borderRadius: 10,
        border: "2.5px solid var(--brand-green, #3ecf8e)",
        color: "var(--brand-green, #3ecf8e)",
        fontFamily:
          "var(--font-source-code-pro), ui-monospace, monospace",
        textTransform: "uppercase",
        letterSpacing: "1.4px",
        fontSize: 12,
        background: "rgba(255, 255, 255, 0.92)",
        pointerEvents: "none",
        zIndex: 60,
        boxShadow: "0 14px 28px rgba(15, 15, 15, 0.10)",
      }}
      aria-hidden={!visible}
    >
      <div style={{ fontSize: 11, color: "#6e6e6e", letterSpacing: "1.6px" }}>
        Net annual impact
      </div>
      <div
        style={{
          fontFamily: "var(--font-inter), system-ui, sans-serif",
          fontSize: 28,
          fontWeight: 400,
          letterSpacing: "-0.01em",
          lineHeight: 1,
          marginTop: 4,
          fontVariantNumeric: "tabular-nums",
        }}
      >
        1.87%
      </div>
      <div
        style={{
          fontSize: 10,
          color: "var(--brand-green-link, #00c573)",
          marginTop: 4,
          letterSpacing: "1.2px",
        }}
      >
        Per €1M annual spend
      </div>
    </div>
  );
}
