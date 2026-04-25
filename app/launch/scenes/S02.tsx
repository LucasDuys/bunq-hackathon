"use client";

/**
 * S02 — Spreadsheet, agent reading transactions row by row.
 *
 * Camera (unchanged): three beats, wide → settle → tighten on the gap rows.
 *
 * Reveal: a SCAN sweeps top-to-bottom. Rows ahead of the scan render as low-
 * opacity skeletons. As the scan crosses each row, its cells fade in
 * left-to-right (date → confidence) over ~250ms; classified cells (sub-cat,
 * CO₂e, confidence bar) populate. Gap rows (Albert Heijn, Vendor invoice
 * #4821) render their amber `?` chip + pulsing AlertCircle as the scan
 * crosses them, so the un-classified state is itself visible — handing the
 * baton to S04's drag-receipt-to-fill-the-gap.
 *
 * The scan completes a touch before the scene ends (progress * 1.15 clamped)
 * so the camera can land tightly on the gap rows for the final beat.
 *
 * Header decorations inside the MacWindow's right column:
 *   - 2px brand-green progress bar pinned above the table header.
 *   - "READING n/12 · 2 GAPS" ticker, source-code-pro 11px uppercase 1.2px,
 *     tabular-nums, top-right.
 */

import type { SceneProps } from "../types";
import { MacWindow } from "../components/MacWindow";
import { CameraScript } from "../components/CameraScript";
import { LaunchSidebar } from "../components/real/LaunchSidebar";
import { TransactionTable } from "../components/TransactionTable";
import { TRANSACTIONS } from "../data";

const clamp01 = (n: number) => Math.max(0, Math.min(1, n));

const GAP_COUNT = TRANSACTIONS.filter((t) => t.isGap).length;

export default function S02({ elapsedMs, durationMs, progress }: SceneProps) {
  // Scan completes a bit before scene end so the camera can land on the gaps.
  const scanProgress = clamp01(progress * 1.15);
  const readingCount = Math.min(
    TRANSACTIONS.length,
    Math.floor(scanProgress * TRANSACTIONS.length) + (scanProgress > 0 ? 1 : 0)
  );
  const reading = scanProgress >= 1 ? TRANSACTIONS.length : readingCount;

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
          // Adjusted: the table is now ~38px lower (progress bar + ticker row),
          // so we offset y more negative on the tight beats to land on the gap rows.
          { at: 0,    scale: 0.85, x: 0,    y: 60 },
          { at: 0.30, scale: 1.0,  x: 0,    y: 0 },
          { at: 0.65, scale: 1.4,  x: -120, y: -240 },
          { at: 1.0,  scale: 1.7,  x: -180, y: -290 },
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
          glass
        >
          <div style={{ display: "flex", height: "100%" }}>
            <LaunchSidebar activeKey="ledger" />
            <div
              style={{
                flex: 1,
                minWidth: 0,
                display: "flex",
                flexDirection: "column",
                background: "#171717",
              }}
            >
              {/* Scan progress bar — 2px brand-green, full-width above header */}
              <div
                role="progressbar"
                aria-valuenow={Math.round(scanProgress * 100)}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label="Reading transactions"
                style={{
                  position: "relative",
                  height: 2,
                  width: "100%",
                  background: "var(--border-faint)",
                  flexShrink: 0,
                }}
              >
                <div
                  style={{
                    width: `${scanProgress * 100}%`,
                    height: "100%",
                    background: "var(--brand-green)",
                    transition: "width 80ms linear",
                  }}
                />
              </div>

              {/* Ticker row — "READING n/12 · 2 GAPS" in source-code-pro */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "10px 16px",
                  borderBottom: "1px solid var(--border-faint)",
                  background: "#171717",
                  flexShrink: 0,
                }}
              >
                <span
                  style={{
                    fontFamily:
                      "var(--font-source-code-pro), ui-monospace, monospace",
                    fontSize: 11,
                    letterSpacing: "1.2px",
                    textTransform: "uppercase",
                    color: "var(--fg-muted)",
                  }}
                >
                  Ledger · April 2026
                </span>
                <span
                  aria-live="polite"
                  style={{
                    fontFamily:
                      "var(--font-source-code-pro), ui-monospace, monospace",
                    fontSize: 11,
                    letterSpacing: "1.2px",
                    textTransform: "uppercase",
                    color: "var(--fg-secondary)",
                    fontVariantNumeric: "tabular-nums",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 6,
                  }}
                >
                  <span
                    aria-hidden="true"
                    style={{
                      width: 6,
                      height: 6,
                      borderRadius: "50%",
                      background:
                        scanProgress < 1
                          ? "var(--brand-green)"
                          : "var(--fg-muted)",
                      boxShadow:
                        scanProgress < 1
                          ? "0 0 0 3px rgba(62,207,142,0.18)"
                          : "none",
                    }}
                  />
                  Reading {reading}/{TRANSACTIONS.length} · {GAP_COUNT} gaps
                </span>
              </div>

              {/* The table itself — scan mode drives row reveal */}
              <div style={{ flex: 1, minHeight: 0, overflow: "auto" }}>
                <TransactionTable
                  transactions={TRANSACTIONS}
                  scanProgress={scanProgress}
                />
              </div>
            </div>
          </div>
        </MacWindow>
      </CameraScript>
    </div>
  );
}
