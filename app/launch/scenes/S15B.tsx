"use client";

/**
 * S15B — Audit ledger hash chain.
 *
 * Terminal-style view: monospace rows appear one by one with typed hashes,
 * then a verification sweep lights every row green. Footer reads
 * "chain verified · 12 events".
 *
 * Uses the existing AuditLedgerScroll component. Camera stays almost static
 * — the terminal is the show.
 */

import type { SceneProps } from "../types";
import { CameraScript } from "../components/CameraScript";
import { MacWindow } from "../components/MacWindow";
import { AuditLedgerScroll } from "../components/AuditLedgerScroll";

export default function S15B({ elapsedMs, durationMs }: SceneProps) {
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
          { at: 0, scale: 0.95, x: 0, y: 10 },
          { at: 0.12, scale: 0.98, x: 0, y: 2 },
          { at: 0.7, scale: 1.0, x: 0, y: 0 },
          { at: 1.0, scale: 1.02, x: 0, y: -4 },
        ]}
        elapsedMs={elapsedMs}
        durationMs={durationMs}
      >
        <MacWindow
          title="Carbo — Audit ledger"
          width={1100}
          height={620}
          glass
        >
          <AuditLedgerScroll elapsedMs={elapsedMs} durationMs={durationMs} />
        </MacWindow>
      </CameraScript>
    </div>
  );
}
