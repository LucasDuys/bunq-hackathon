"use client";

/**
 * S07A — Close state machine sticky rail.
 *
 * The Albert Heijn row resolved in S07. Now the close state machine engages.
 * Six dots advance INGEST → CLASSIFY → ESTIMATE → CLUSTER → READY → APPROVED
 * over the scene. Camera holds wide so the rail reads as one motion.
 *
 * The CLUSTER state lands at ~progress 0.55, which is where the next scene
 * (S08C orbiting cube) picks up — the rail intentionally stops at CLUSTER.
 */

import type { SceneProps } from "../types";
import { MacWindow } from "../components/MacWindow";
import { CameraScript } from "../components/CameraScript";
import { CloseRailDots } from "../components/CloseRailDots";

export default function S07A({ elapsedMs, durationMs, progress }: SceneProps) {
  // Rail completes at progress 0.7 (CLUSTER ≈ idx 3.5/6).
  // Map scene progress 0..1 → rail progress 0..0.7 so APPROVED stays for S11P.
  const railProgress = Math.min(0.7, progress * 0.7);

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
          { at: 0,   scale: 0.96, x: 0, y: 30 },
          { at: 0.4, scale: 1.0,  x: 0, y: 0 },
          { at: 1.0, scale: 1.05, x: 0, y: -20 },
        ]}
        elapsedMs={elapsedMs}
        durationMs={durationMs}
      >
        <MacWindow
          title="Carbo — Close · April 2026"
          showSidebar
          width={1280}
          height={620}
          glass
        >
          <div
            style={{
              height: "100%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              background: "#171717",
            }}
          >
            <CloseRailDots progress={railProgress} elapsedMs={elapsedMs} />
          </div>
        </MacWindow>
      </CameraScript>
    </div>
  );
}
