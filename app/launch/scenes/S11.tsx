"use client";

/**
 * S11 — DAG runs through. The showpiece.
 *
 * Full-width MacWindow showing the 8-agent DAG. DagFlow consumes scene-elapsed
 * directly; we cap its internal duration at (durationMs - 2000) so all nodes
 * settle into "done" with a clear 2s tail before scene end.
 *
 * The camera does a slow methodical descent through the tier stack:
 *   - Beat 1 (0..15%):  wide hold (scale 0.85, y +60) — full chrome visible.
 *   - Beat 2 (15..45%): gentle settle (scale 0.92, y +30).
 *   - Beat 3 (45..75%): push down to the parallel pairs at tier 3-4.
 *   - Beat 4 (75..end): continue down past tier 5-6, landing tight on the
 *                       executive_report node at the bottom.
 */

import type { SceneProps } from "../types";
import { MacWindow } from "../components/MacWindow";
import { CameraScript } from "../components/CameraScript";
import { LaunchSidebar } from "../components/real/LaunchSidebar";
import { DagFlow } from "../components/DagFlow";
import { DAG_NODES } from "../data";

export default function S11({ elapsedMs, durationMs }: SceneProps) {
  const dagDuration = Math.max(8000, durationMs - 2000);

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
          { at: 0,    scale: 0.85, x: 0, y: 60 },
          { at: 0.15, scale: 0.92, x: 0, y: 30 },
          { at: 0.45, scale: 1.05, x: 0, y: -100 },
          { at: 0.75, scale: 1.18, x: 0, y: -200 },
          { at: 1.0,  scale: 1.28, x: 0, y: -280 },
        ]}
        elapsedMs={elapsedMs}
        durationMs={durationMs}
      >
        <MacWindow
          title="Carbo — DAG executor"
          showSidebar
          width={1480}
          height={900}
          glass
        >
          <div style={{ display: "flex", height: "100%" }}>
            <LaunchSidebar activeKey="close" />
            <div style={{ flex: 1, minWidth: 0, overflow: "auto" }}>
              <div
                style={{
                  width: "100%",
                  height: "100%",
                  display: "flex",
                  alignItems: "flex-start",
                  justifyContent: "center",
                  padding: "32px 24px",
                  boxSizing: "border-box",
                  overflow: "auto",
                }}
              >
                <DagFlow
                  nodes={DAG_NODES}
                  elapsedMs={elapsedMs}
                  durationMs={dagDuration}
                />
              </div>
            </div>
          </div>
        </MacWindow>
      </CameraScript>
    </div>
  );
}
