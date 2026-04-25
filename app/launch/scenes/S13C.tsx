"use client";

/**
 * S13C — CFO report.
 *
 * Sits between the alternatives matrix abstraction (S13) and the "At scale"
 * title card (S14). Shows the actual Carbo CFO report surface — 4 KPI cards
 * plus the 2x2 price-vs-carbon impact matrix — inside MacWindow + the real
 * sidebar with the Reports nav item active.
 *
 * Camera glides from a wide chrome-visible hold to a tighter push on the
 * impact matrix grid so the viewer reads the win-win quadrant.
 */

import type { SceneProps } from "../types";
import { MacWindow } from "../components/MacWindow";
import { CameraScript } from "../components/CameraScript";
import { LaunchSidebar } from "../components/real/LaunchSidebar";
import { LaunchCFOReport } from "../components/real/LaunchCFOReport";

export default function S13C({ elapsedMs, durationMs }: SceneProps) {
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
          { at: 0,    scale: 0.88, x: 0,    y: 50 },
          { at: 0.25, scale: 0.95, x: 0,    y: 20 },
          { at: 0.65, scale: 1.15, x: -100, y: -120 },
          { at: 1.0,  scale: 1.30, x: -120, y: -180 },
        ]}
        elapsedMs={elapsedMs}
        durationMs={durationMs}
      >
        <MacWindow
          title="Carbo — Reports"
          showSidebar
          showSearch
          width={1480}
          height={900}
        >
          <div style={{ display: "flex", height: "100%" }}>
            <LaunchSidebar activeKey="reports" />
            <div style={{ flex: 1, minWidth: 0, overflow: "auto" }}>
              <LaunchCFOReport />
            </div>
          </div>
        </MacWindow>
      </CameraScript>
    </div>
  );
}
