"use client";

/**
 * S01D — Dashboard intro.
 *
 * First real-product surface viewers see, immediately after the opening title.
 * Renders the actual Carbo dashboard (KPIs + emissions-by-category bars +
 * recent activity) inside a MacWindow with the real LaunchSidebar mounted on
 * the left.
 *
 * Camera: one continuous move. We hold wide for the first ~25% so the viewer
 * registers the dashboard layout, then a single eased push lands on the
 * NET ANNUAL IMPACT KPI. No interim stops — three keyframes is two segments,
 * but the first segment is identical start/end (a true hold), so visually it
 * reads as one smooth dolly.
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
          { at: 0,    scale: 1.0,  x: 0,    y: 0 },
          { at: 0.25, scale: 1.0,  x: 0,    y: 0 },
          { at: 1.0,  scale: 1.22, x: -210, y: -70 },
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
