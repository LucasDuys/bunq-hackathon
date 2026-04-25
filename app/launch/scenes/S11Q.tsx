"use client";

/**
 * S11Q — Carbon credit retirement certificate.
 *
 * Follows S11P (the €412 reserve transfer). The money moved — now show what
 * it bought: a Puro.earth biochar credit, printed line by line on a tan-paper
 * certificate with a "RETIRED" stamp at the end.
 *
 * Uses the existing CreditCertificate component centered in a MacWindow.
 *
 *   ──── beats ─────────────────────────────────────────────────────────
 *   0    →  800   MacWindow fades in, camera settles
 *   800  → 3800   Certificate lines print one by one (~220ms each)
 *   3800 → 4200   "RETIRED" stamp lands
 *   4200 → 6000   Hold, gentle camera push
 */

import type { SceneProps } from "../types";
import { CameraScript } from "../components/CameraScript";
import { MacWindow } from "../components/MacWindow";
import { CreditCertificate } from "../components/CreditCertificate";

export default function S11Q({ elapsedMs, durationMs }: SceneProps) {
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
          { at: 0, scale: 0.94, x: 0, y: 14 },
          { at: 0.15, scale: 0.98, x: 0, y: 4 },
          { at: 0.6, scale: 1.0, x: 0, y: 0 },
          { at: 1.0, scale: 1.03, x: 0, y: -6 },
        ]}
        elapsedMs={elapsedMs}
        durationMs={durationMs}
      >
        <MacWindow
          title="Carbo — Carbon credit · retirement"
          width={680}
          height={560}
          glass
        >
          <div
            style={{
              height: "100%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              background: "#171717",
              padding: 24,
            }}
          >
            <CreditCertificate
              elapsedMs={elapsedMs}
              printStart={800}
              stampAt={3800}
            />
          </div>
        </MacWindow>
      </CameraScript>
    </div>
  );
}
