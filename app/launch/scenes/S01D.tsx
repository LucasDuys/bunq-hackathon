"use client";

/**
 * S01D — Hero cockpit. The wow shot.
 *
 * One cinematic frame that fires every Carbo capability simultaneously: live
 * tx ingestion (bunq + email + receipt), 8-agent DAG pipeline status, hero
 * NET ANNUAL IMPACT counting up, confidence ring, MoM sparkline, scope-by-
 * category breakdown, win-win swaps, reserve transfer, and CSRD draft
 * progress. The rest of the timeline elaborates each beat individually.
 *
 * Camera: hold wide for the first 25% so the viewer reads the full cockpit,
 * then a slow methodical push toward the hero NET IMPACT card while every
 * subsystem keeps animating. Final 12% holds tight on the hero so the
 * count-up + confidence ring + green sparkline land in close-up.
 */

import type { SceneProps } from "../types";
import { MacWindow } from "../components/MacWindow";
import { CameraScript } from "../components/CameraScript";
import { LaunchSidebar } from "../components/real/LaunchSidebar";
import { LaunchHeroCockpit } from "../components/real/LaunchHeroCockpit";

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
          // Settle: a hair zoomed-out so the viewer takes the whole cockpit in.
          { at: 0,    scale: 0.94, x: 0,   y: 10 },
          // Hold wide.
          { at: 0.25, scale: 0.96, x: 0,   y: 0 },
          // Slow push toward hero impact card (center column, slightly above middle).
          { at: 0.65, scale: 1.06, x: -60, y: -40 },
          // Land close on the hero number.
          { at: 1.0,  scale: 1.14, x: -90, y: -70 },
        ]}
        elapsedMs={elapsedMs}
        durationMs={durationMs}
      >
        <MacWindow
          title="Carbo — Live cockpit"
          showSidebar
          showSearch
          width={1480}
          height={900}
          glass
        >
          <div style={{ display: "flex", height: "100%" }}>
            <LaunchSidebar activeKey="dashboard" />
            <div style={{ flex: 1, minWidth: 0 }}>
              <LaunchHeroCockpit
                elapsedMs={elapsedMs}
                durationMs={durationMs}
              />
            </div>
          </div>
        </MacWindow>
      </CameraScript>
    </div>
  );
}
