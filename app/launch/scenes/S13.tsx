"use client";

/**
 * S13 — Alternatives matrix · zoom to win-win.
 *
 * Centered AlternativesMatrix inside a MacWindow. First 55% of the scene the
 * points reveal in their staggered bounce; once we cross 55% the matrix's
 * own internal zoom flips on, pulling the bottom-left win-win quadrant to
 * fill ~80% of the frame.
 *
 * Camera holds and frames — the matrix carries the motion. Wide hold opens
 * the scene with chrome visible (scale 0.95, y +30), settles to full view by
 * 20%, then ends with a very subtle push (scale 1.05) for added weight.
 */

import type { SceneProps } from "../types";
import { MacWindow } from "../components/MacWindow";
import { CameraScript } from "../components/CameraScript";
import { AlternativesMatrix } from "../components/AlternativesMatrix";
import { MATRIX_POINTS } from "../data";

const ZOOM_THRESHOLD = 0.55;

export default function S13({ elapsedMs, durationMs, progress }: SceneProps) {
  const revealProgress =
    progress < ZOOM_THRESHOLD ? progress / ZOOM_THRESHOLD : 1;
  const zoomToWinWin = progress >= ZOOM_THRESHOLD;

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
          { at: 0,    scale: 0.95, x: 0, y: 30 },
          { at: 0.20, scale: 1.0,  x: 0, y: 0 },
          { at: 1.0,  scale: 1.05, x: 0, y: 0 },
        ]}
        elapsedMs={elapsedMs}
        durationMs={durationMs}
      >
        <MacWindow
          title="Carbo — Alternatives matrix"
          showSidebar
          width={1280}
          height={900}
          glass
        >
          <div
            style={{
              width: "100%",
              height: "100%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: 32,
              boxSizing: "border-box",
            }}
          >
            <AlternativesMatrix
              points={MATRIX_POINTS}
              progress={revealProgress}
              zoomToWinWin={zoomToWinWin}
            />
          </div>
        </MacWindow>
      </CameraScript>
    </div>
  );
}
