"use client";

/**
 * S13C — Monthly briefing.
 *
 * "The compliance report writes itself." Sits between the impact workspace
 * (S13B) and the "At scale" title card (S14). Replaces the older CFO report
 * matrix view with a hero briefing layout: huge sentence-case headline → KPI
 * strip → executive read paragraph.
 *
 * Camera: opens wide so the headline lands as a gesture, then VERY GENTLE
 * push toward the executive read so the viewer settles into the prose. We
 * cap scale at 1.05 — anything more and the type goes soft.
 *
 * Header text "The compliance report writes itself." is owned by
 * LaunchTimeline / HeaderOverlay; this scene only renders the MacWindow body.
 */

import type { SceneProps } from "../types";
import { MacWindow } from "../components/MacWindow";
import { CameraScript } from "../components/CameraScript";
import { LaunchSidebar } from "../components/real/LaunchSidebar";
import { LaunchBriefingReport } from "../components/real/LaunchBriefingReport";

export default function S13C({ elapsedMs, durationMs }: SceneProps) {
  const progress = durationMs > 0 ? Math.min(1, Math.max(0, elapsedMs / durationMs)) : 1;

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
          { at: 0,    scale: 0.92, x: 0, y: 30 },
          { at: 0.18, scale: 0.96, x: 0, y: 10 },
          { at: 0.55, scale: 1.00, x: 0, y: -10 },
          { at: 1.0,  scale: 1.05, x: 0, y: -30 },
        ]}
        elapsedMs={elapsedMs}
        durationMs={durationMs}
      >
        <MacWindow
          title="Carbo — Reports · Monthly briefing"
          showSidebar
          showSearch
          width={1480}
          height={900}
          glass
        >
          <div style={{ display: "flex", height: "100%" }}>
            <LaunchSidebar activeKey="reports" />
            <div style={{ flex: 1, minWidth: 0, overflow: "auto" }}>
              <LaunchBriefingReport progress={progress} />
            </div>
          </div>
        </MacWindow>
      </CameraScript>
    </div>
  );
}
