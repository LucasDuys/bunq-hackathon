"use client";

/**
 * S15I — Impacts view.
 *
 * Sits between the scale slider abstraction (S15) and the closing lockup (S16).
 * Shows the real Carbo impacts page — recommendation list with rationales,
 * delta tiles (cost / CO₂e), confidence bars, and source pills — inside a
 * MacWindow with the real sidebar (Impacts active).
 *
 * Camera does a slow vertical pan downward through the recommendation list
 * so the viewer reads the substance, not just the headline.
 */

import type { SceneProps } from "../types";
import { MacWindow } from "../components/MacWindow";
import { CameraScript } from "../components/CameraScript";
import { LaunchSidebar } from "../components/real/LaunchSidebar";
import { LaunchImpactsView } from "../components/real/LaunchImpactsView";

export default function S15I({ elapsedMs, durationMs }: SceneProps) {
  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        background: "#ffffff",
        overflow: "hidden",
      }}
    >
      <CameraScript
        keyframes={[
          { at: 0,    scale: 0.88, x: 0, y: 60 },
          { at: 0.30, scale: 0.95, x: 0, y: 0 },
          { at: 0.70, scale: 1.05, x: 0, y: -200 },
          { at: 1.0,  scale: 1.10, x: 0, y: -340 },
        ]}
        elapsedMs={elapsedMs}
        durationMs={durationMs}
      >
        <MacWindow
          title="Carbo — Impacts"
          showSidebar
          showSearch
          width={1480}
          height={900}
        >
          <div style={{ display: "flex", height: "100%" }}>
            <LaunchSidebar activeKey="impacts" />
            <div style={{ flex: 1, minWidth: 0, overflow: "auto" }}>
              <LaunchImpactsView />
            </div>
          </div>
        </MacWindow>
      </CameraScript>
    </div>
  );
}
