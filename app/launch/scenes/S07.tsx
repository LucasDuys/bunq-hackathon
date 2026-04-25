"use client";

/**
 * S07 — Pan back to spreadsheet · fill Albert Heijn row.
 *
 * Spreadsheet returns. Camera starts off-center and tight (suggesting we just
 * panned from the receipt area), settles to a full view at the midpoint, then
 * tightens back onto the now-filled Albert Heijn row at the top.
 *
 * The TransactionTable receives `fillRow` for tx_001 + scene `progress` so the
 * row's missing cells animate in (sub-category typewriter → CO₂e count-up
 * → confidence bar). After ~85% progress we surface a "linked" badge.
 */

import { useMemo } from "react";
import { Check } from "lucide-react";
import type { SceneProps } from "../types";
import { MacWindow } from "../components/MacWindow";
import { CameraScript } from "../components/CameraScript";
import { LaunchSidebar } from "../components/real/LaunchSidebar";
import { TransactionTable } from "../components/TransactionTable";
import { ALBERT_HEIJN_RESOLVED, TRANSACTIONS } from "../data";

export default function S07({ elapsedMs, durationMs, progress }: SceneProps) {
  const fillRow = useMemo(
    () => ({
      id: "tx_001",
      subCategory: ALBERT_HEIJN_RESOLVED.subCategory ?? "Catering · fresh produce",
      tco2eKg: ALBERT_HEIJN_RESOLVED.tco2eKg ?? 421,
      confidence: ALBERT_HEIJN_RESOLVED.confidence ?? 0.87,
    }),
    []
  );

  const showLinkedBadge = progress > 0.85;

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
          { at: 0,    scale: 1.4,  x: 280,  y: 220 },
          { at: 0.45, scale: 1.0,  x: 0,    y: 0 },
          { at: 1.0,  scale: 1.65, x: -160, y: -220 },
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
              <div style={{ position: "relative", width: "100%", height: "100%" }}>
                <TransactionTable
                  transactions={TRANSACTIONS}
                  fillRow={fillRow}
                  fillProgress={progress}
                />

                {/* "Linked" badge — appears after the fill animation settles */}
                {showLinkedBadge ? <LinkedBadge /> : null}
              </div>
            </div>
          </div>
        </MacWindow>
      </CameraScript>
    </div>
  );
}

function LinkedBadge() {
  return (
    <div
      style={{
        position: "absolute",
        // Anchor near the top-right of the table where the Albert Heijn row sits.
        top: 56,
        right: 24,
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        padding: "4px 10px",
        borderRadius: 9999,
        background: "var(--brand-green-soft)",
        border: "1px solid var(--brand-green-border)",
        color: "var(--brand-green)",
        fontFamily: "var(--font-source-code-pro), ui-monospace, monospace",
        fontSize: 11,
        letterSpacing: "1.2px",
        textTransform: "uppercase",
        animation: "s07-linked-fade 350ms ease-out forwards",
        opacity: 0,
      }}
    >
      <Check size={12} strokeWidth={2.4} />
      <span>Linked</span>
      <style>{`
        @keyframes s07-linked-fade {
          from { opacity: 0; transform: translateY(-4px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @media (prefers-reduced-motion: reduce) {
          @keyframes s07-linked-fade { from, to { opacity: 1; transform: none; } }
        }
      `}</style>
    </div>
  );
}
