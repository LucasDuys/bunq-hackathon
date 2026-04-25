"use client";

/**
 * S09 — Cluster reorganization + ClusterCards reveal.
 *
 * Vertical stack inside MacWindow: ClusterCards on TOP, TransactionTable
 * BELOW. Two phases driven by scene `progress`:
 *   - First half (0..0.5): table rows reorganize via FLIP into category groups.
 *   - Second half (0.5..1): ClusterCards stagger in (4 priority cards).
 *
 * Camera continues from S07's tight zoom, settles to a full view as the table
 * reorganizes, then pulls back further to reveal the new ClusterCards above
 * — and holds there to let the eye land. macOS chrome becomes visible again
 * by the second beat.
 */

import type { SceneProps } from "../types";
import { MacWindow } from "../components/MacWindow";
import { CameraScript } from "../components/CameraScript";
import { LaunchSidebar } from "../components/real/LaunchSidebar";
import { ClusterCards } from "../components/ClusterCards";
import { TransactionTable } from "../components/TransactionTable";
import { PRIORITY_CLUSTERS, TRANSACTIONS } from "../data";

export default function S09({ elapsedMs, durationMs, progress }: SceneProps) {
  // First half clusters the table; second half reveals priority cards.
  const tableClusterProgress = Math.min(1, progress * 2);
  const cardsProgress = Math.max(0, (progress - 0.5) * 2);

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
          { at: 0,    scale: 1.4,  x: 0, y: -180 },
          { at: 0.40, scale: 1.0,  x: 0, y: 0 },
          { at: 0.75, scale: 0.92, x: 0, y: 40 },
          { at: 1.0,  scale: 0.92, x: 0, y: 40 },
        ]}
        elapsedMs={elapsedMs}
        durationMs={durationMs}
      >
        <MacWindow
          title="Carbo — Priority clusters · post-DAG tier 1"
          showSidebar
          width={1480}
          height={900}
          glass
        >
          <div style={{ display: "flex", height: "100%" }}>
            <LaunchSidebar activeKey="ledger" />
            <div style={{ flex: 1, minWidth: 0, overflow: "auto" }}>
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: 16,
                  padding: 16,
                  height: "100%",
                  boxSizing: "border-box",
                }}
              >
                {/* Cluster cards on top — staggered reveal */}
                <div style={{ flexShrink: 0 }}>
                  <ClusterCards
                    clusters={PRIORITY_CLUSTERS}
                    progress={cardsProgress}
                  />
                </div>

                {/* Table beneath — rows reorganize by category */}
                <div
                  style={{
                    flex: 1,
                    minHeight: 0,
                    border: "1px solid var(--border-default)",
                    borderRadius: 12,
                    overflow: "hidden",
                  }}
                >
                  <TransactionTable
                    transactions={TRANSACTIONS}
                    clusterByCategory
                    clusterProgress={tableClusterProgress}
                  />
                </div>
              </div>
            </div>
          </div>
        </MacWindow>
      </CameraScript>
    </div>
  );
}
