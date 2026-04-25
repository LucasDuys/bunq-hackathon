"use client";

/**
 * S11R — Refine questions card.
 *
 * After the DAG runs and the audit ledger verifies, three Sonnet-authored
 * questions disambiguate the highest-uncertainty cluster (cluster_food).
 * User chips answer each. Confidence on the cluster jumps to 0.91.
 */

import type { SceneProps } from "../types";
import { MacWindow } from "../components/MacWindow";
import { CameraScript } from "../components/CameraScript";
import { RefineQuestionCard } from "../components/RefineQuestionCard";

export default function S11R({ elapsedMs, durationMs }: SceneProps) {
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
          { at: 0,   scale: 0.97, x: 0, y: 16 },
          { at: 0.4, scale: 1.0,  x: 0, y: 0 },
          { at: 1.0, scale: 1.03, x: 0, y: -8 },
        ]}
        elapsedMs={elapsedMs}
        durationMs={durationMs}
      >
        <MacWindow
          title="Carbo — Refine · cluster_food"
          showSidebar
          width={1180}
          height={680}
          glass
        >
          <RefineQuestionCard elapsedMs={elapsedMs} durationMs={durationMs} />
        </MacWindow>
      </CameraScript>
    </div>
  );
}
