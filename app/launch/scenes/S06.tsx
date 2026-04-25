"use client";

/**
 * S06 — Receipt OCR animation.
 *
 * Centered receipt + EXTRACTED sidebar inside a MacWindow. The ReceiptOCR
 * primitive owns the scan-line + lift choreography; we drive it from the
 * scene clock so it advances in lock-step.
 *
 * Camera does a subtle off-center push that LEADS the eye toward the lifted
 * text sidebar (right side). Three beats:
 *   - Beat 1 (0..20%):  wide hold (scale 0.95, y +20) — chrome visible.
 *   - Beat 2 (20..end): gentle settle then a slow off-center push toward the
 *                       sidebar (scale 1.18, x +80, y -40).
 */

import type { SceneProps } from "../types";
import { MacWindow } from "../components/MacWindow";
import { CameraScript } from "../components/CameraScript";
import { ReceiptOCR } from "../components/ReceiptOCR";
import { RECEIPT_OCR } from "../data";

export default function S06({ elapsedMs, durationMs }: SceneProps) {
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
          { at: 0,    scale: 0.95, x: 0,  y: 20 },
          { at: 0.20, scale: 1.05, x: 0,  y: 0 },
          { at: 1.0,  scale: 1.18, x: 80, y: -40 },
        ]}
        elapsedMs={elapsedMs}
        durationMs={durationMs}
      >
        <MacWindow
          title="Carbo — Invoice ingestion · vision"
          width={1280}
          height={820}
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
            <ReceiptOCR
              regions={RECEIPT_OCR}
              elapsedMs={elapsedMs}
              durationMs={durationMs}
            />
          </div>
        </MacWindow>
      </CameraScript>
    </div>
  );
}
