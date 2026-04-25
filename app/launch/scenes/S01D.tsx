"use client";

/**
 * S01D — Dashboard intro.
 *
 * First real-product surface viewers see, immediately after the opening title.
 * Renders the actual Carbo dashboard (KPIs + emissions-by-category bars +
 * recent activity) inside a MacWindow with the real LaunchSidebar mounted on
 * the left.
 *
 * Camera does a slow push from a wide overview down to a tight close on the
 * NET ANNUAL IMPACT KPI card so the viewer reads the headline number.
 */

import type { SceneProps } from "../types";
import { MacWindow } from "../components/MacWindow";
import { CameraScript } from "../components/CameraScript";
import { LaunchSidebar } from "../components/real/LaunchSidebar";
import { LaunchDashboard } from "../components/real/LaunchDashboard";

export default function S01D({ elapsedMs, durationMs }: SceneProps) {
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
          { at: 0,    scale: 0.85, x: 0,    y: 60 },
          { at: 0.30, scale: 0.95, x: 0,    y: 20 },
          { at: 0.70, scale: 1.20, x: -200, y: -40 },
          { at: 1.0,  scale: 1.45, x: -260, y: -100 },
        ]}
        elapsedMs={elapsedMs}
        durationMs={durationMs}
      >
        <MacWindow
          title="Carbo — Dashboard"
          showSidebar
          showSearch
          width={1480}
          height={900}
          glass
        >
          <div style={{ display: "flex", height: "100%" }}>
            <LaunchSidebar activeKey="dashboard" />
            <div style={{ flex: 1, minWidth: 0, overflow: "auto" }}>
              <LaunchDashboard />
            </div>
          </div>
        </MacWindow>
      </CameraScript>
    </div>
  );
}
