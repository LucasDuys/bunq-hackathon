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
        >
          <ScaleSlider tiers={SCALE_TIERS} progress={progress} />
        </MacWindow>
      </CameraScript>
    </div>
  );
}
