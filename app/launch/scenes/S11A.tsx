"use client";

/**
 * S11A — Audit ledger scroll.
 *
 * Right after the DAG completes (S11), the ledger view appends each event,
 * then sweeps a green ✓ down the column to show the SHA-256 chain verified.
 * Mirrors `lib/audit/append.ts` semantics — append-only, hash-linked.
 */

import type { SceneProps } from "../types";
import { MacWindow } from "../components/MacWindow";
import { CameraScript } from "../components/CameraScript";
import { AuditLedgerScroll } from "../components/AuditLedgerScroll";

export default function S11A({ elapsedMs, durationMs }: SceneProps) {
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
          { at: 0,   scale: 0.96, x: 0, y: 20 },
          { at: 0.4, scale: 1.0,  x: 0, y: 0 },
          { at: 1.0, scale: 1.04, x: 0, y: -10 },
        ]}
        elapsedMs={elapsedMs}
        durationMs={durationMs}
      >
        <MacWindow
          title="Carbo — Audit ledger"
          showSidebar
          width={1280}
          height={720}
          glass
        >
          <AuditLedgerScroll elapsedMs={elapsedMs} durationMs={durationMs} />
        </MacWindow>
      </CameraScript>
    </div>
  );
}
