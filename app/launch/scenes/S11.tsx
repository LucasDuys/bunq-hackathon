"use client";

/**
 * S11 — DAG runs through. The showpiece.
 *
 * Full-width MacWindow showing the 8-agent DAG. DagFlow consumes scene-elapsed
 * directly; we cap its internal duration at (durationMs - 2000) so all nodes
 * settle into "done" with a clear 2s tail before scene end.
 *
 * The camera does a slow methodical descent through the tier stack. Scale is
 * capped at 1.05 to keep DAG nodes pixel-grid aligned and crisp — descent is
 * driven primarily by Y translation (which stays sharp because it's pixel
 * aligned). At >1.06x, browsers fall off the GPU pixel grid and node text /
 * model badges (Sonnet 4.6 / Haiku 4.5) render fuzzy.
 *
 *   - Beat 1 (0..20%):  settle from a hair zoomed-out to native (scale 1.0).
 *   - Beat 2 (20..55%): hold at scale 1.0 and translate down to mid-DAG.
 *   - Beat 3 (55..85%): tiny final push (scale 1.04) toward bottom tiers.
 *   - Beat 4 (85..end): land tight on the executive_report node at scale 1.05.
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
          { at: 0,    scale: 0.92, x: 0, y: 30 },
          { at: 0.20, scale: 1.0,  x: 0, y: 0 },
          { at: 0.55, scale: 1.0,  x: 0, y: -120 },
          { at: 0.85, scale: 1.04, x: 0, y: -220 },
          { at: 1.0,  scale: 1.05, x: 0, y: -260 },
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
                  padding: "32px 24px 320px",
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
