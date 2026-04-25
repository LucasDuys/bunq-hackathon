"use client";

/**
 * S02 — Spreadsheet, three beats.
 *
 * Beat 1 (0..30%):  wide hold — full MacWindow chrome visible (scale 0.85,
 *                   y +60) so the viewer registers the macOS frame.
 * Beat 2 (30..65%): settle to full content view (scale 1.0, x/y 0).
 * Beat 3 (65..100%):snap-push toward the gap rows — left and up — then tighten
 *                   onto the Albert Heijn row (scale 1.7, x -180, y -240).
 *
 * macOS chrome is visible the entire scene at the start, falling out of frame
 * only as we tighten on the row in the final beat.
 */

import type { SceneProps } from "../types";
import { MacWindow } from "../components/MacWindow";
import { CameraScript } from "../components/CameraScript";
import { LaunchSidebar } from "../components/real/LaunchSidebar";
import { TransactionTable } from "../components/TransactionTable";
import { TRANSACTIONS } from "../data";

export default function S02({ elapsedMs, durationMs }: SceneProps) {
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
          { at: 0.30, scale: 1.0,  x: 0,    y: 0 },
          { at: 0.65, scale: 1.4,  x: -120, y: -200 },
          { at: 1.0,  scale: 1.7,  x: -180, y: -240 },
        ]}
        elapsedMs={elapsedMs}
        durationMs={durationMs}
      >
        <MacWindow
          title="Carbo — Ledger"
          showSidebar
          showSearch
          width={1480}
          height={900}
        >
          <div style={{ display: "flex", height: "100%" }}>
            <LaunchSidebar activeKey="ledger" />
            <div style={{ flex: 1, minWidth: 0, overflow: "auto" }}>
              <TransactionTable transactions={TRANSACTIONS} />
            </div>
          </div>
        </MacWindow>
      </CameraScript>
    </div>
  );
}
