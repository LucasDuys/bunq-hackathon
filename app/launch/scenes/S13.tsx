"use client";

/**
 * S13 — Swap this · save that.
 *
 * Side-by-side flow: CURRENT SPEND → ALTERNATIVE → SAVINGS, one row per
 * win-win swap (5 rows from MATRIX_POINTS), plus a TOTAL row that tallies
 * the savings. Replaces the abstract scatter chart that lived here before
 * (AlternativesMatrix is preserved but no longer used by this scene).
 *
 * Camera stays calm: opens slightly wide (scale 0.95, y +20), settles to 1.0,
 * never pushes past 1.05 — keeps the numbers crisp (S11 was over-blurred at
 * 1.28; we don't repeat that here).
 */

import type { SceneProps } from "../types";
import { MacWindow } from "../components/MacWindow";
import { CameraScript } from "../components/CameraScript";
import { AlternativesFlow } from "../components/AlternativesFlow";
import { MATRIX_POINTS } from "../data";

export default function S13({ elapsedMs, durationMs, progress }: SceneProps) {
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
          { at: 0,    scale: 0.95, x: 0, y: 20 },
          { at: 0.20, scale: 1.0,  x: 0, y: 0 },
          { at: 1.0,  scale: 1.03, x: 0, y: 0 },
        ]}
        elapsedMs={elapsedMs}
        durationMs={durationMs}
      >
        <MacWindow
          title="Carbo — Alternatives"
          showSidebar
          width={1280}
          height={900}
          glass
        >
          <div
            style={{
              width: "100%",
              height: "100%",
              padding: "32px 48px",
              boxSizing: "border-box",
              display: "flex",
              flexDirection: "column",
            }}
          >
            <AlternativesFlow points={MATRIX_POINTS} progress={progress} />
          </div>
        </MacWindow>
      </CameraScript>
    </div>
  );
}
