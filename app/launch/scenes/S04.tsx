"use client";

/**
 * S04 — Cursor drag-drop.
 *
 * MacWindow showing TransactionTable on the LEFT and a "DOCUMENTS" stack of
 * receipt thumbnails on the RIGHT. Below the table sits a dashed drop zone.
 * The CursorActor performs the scripted drag-drop, carrying a small receipt
 * thumb. After release (~3000ms in the script), the thumb dissolves into the
 * drop zone which now shows a checkmark + filename badge.
 *
 * Camera stays subtle so the cursor remains the motion. We hold wide while
 * the cursor enters (chrome visible), then nudge forward toward the drop zone
 * as the drop completes. The CursorActor itself sits OUTSIDE the camera
 * wrapper because its keyframes use viewport-reference coordinates.
 */

import { Check, FileText, UploadCloud } from "lucide-react";
import type { SceneProps } from "../types";
import { MacWindow } from "../components/MacWindow";
import { CameraScript } from "../components/CameraScript";
import { CursorActor } from "../components/CursorActor";
import { PermissionPrompt } from "../components/PermissionPrompt";
import { LaunchSidebar } from "../components/real/LaunchSidebar";
import { TransactionTable } from "../components/TransactionTable";
import { DRAG_DROP_CURSOR, TRANSACTIONS } from "../data";

const RECEIPT_FILENAME = "albert-heijn-2026-04-24.jpg";
/** When (ms into S4) the cursor drops the receipt — must match DRAG_DROP_CURSOR. */
const DROP_AT_MS = 3000;
/** Buffer for the dissolve transition after the drop. */
const POST_DROP_MS = 100;

export default function S04({ elapsedMs, durationMs }: SceneProps) {
  const dropped = elapsedMs > DROP_AT_MS + POST_DROP_MS;

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
          { at: 0,    scale: 0.92, x: 0,   y: 30 },
          { at: 0.30, scale: 0.92, x: 0,   y: 30 },
          { at: 1.0,  scale: 1.05, x: -40, y: -40 },
        ]}
        elapsedMs={elapsedMs}
        durationMs={durationMs}
      >
        <MacWindow title="Carbo — Documents" width={1480} height={900} glass>
          <div style={{ display: "flex", height: "100%" }}>
            <LaunchSidebar activeKey="invoices" />
            <div style={{ flex: 1, minWidth: 0, overflow: "auto" }}>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 320px",
                  gridTemplateRows: "1fr 220px",
                  gap: 16,
                  padding: 16,
                  height: "100%",
                  boxSizing: "border-box",
                }}
              >
                {/* Table — top-left, spans the rest of the height */}
                <div
                  style={{
                    gridColumn: "1 / 2",
                    gridRow: "1 / 2",
                    border: "1px solid var(--border-default)",
                    borderRadius: 12,
                    overflow: "hidden",
                    minHeight: 0,
                  }}
                >
                  <TransactionTable transactions={TRANSACTIONS} />
                </div>

                {/* Documents stack — top-right */}
                <div
                  style={{
                    gridColumn: "2 / 3",
                    gridRow: "1 / 2",
                    display: "flex",
                    flexDirection: "column",
                    gap: 12,
                  }}
                >
                  <div
                    style={{
                      fontFamily: "var(--font-source-code-pro), ui-monospace, monospace",
                      fontSize: 11,
                      letterSpacing: "1.2px",
                      textTransform: "uppercase",
                      color: "var(--fg-muted)",
                      marginBottom: 4,
                    }}
                  >
                    Documents
                  </div>
                  <ReceiptThumb filename={RECEIPT_FILENAME} highlighted />
                  <ReceiptThumb filename="kpn-zakelijk-2026-04-12.pdf" />
                  <ReceiptThumb filename="ns-reizigers-2026-04-20.pdf" />
                </div>

                {/* Drop zone — bottom (full width across both columns) */}
                <div
                  style={{
                    gridColumn: "1 / 3",
                    gridRow: "2 / 3",
                    minHeight: 0,
                  }}
                >
                  <DropZone dropped={dropped} filename={RECEIPT_FILENAME} />
                </div>
              </div>
            </div>
          </div>
        </MacWindow>
      </CameraScript>

      {/* Cursor overlaid on top of everything — outside the MacWindow AND outside
          the CameraScript so its 1920×1080 reference coordinates apply directly
          to the viewport (NOT the camera-transformed space). */}
      <CursorActor
        script={DRAG_DROP_CURSOR}
        elapsedMs={elapsedMs}
        carry={!dropped ? <CarryThumb /> : null}
      />

      {/* Permission sheet — slides in just after the drop, auto-approves before
          the scene ends. Mirrors the ChatGPT-5.5 transparency motif. */}
      <PermissionPrompt
        elapsedMs={elapsedMs}
        showAt={3700}
        approveAt={5500}
        question="Allow Carbo to read albert-heijn-2026-04-24.jpg?"
        description="Vision will extract merchant, date, items, VAT and total. Audit-logged."
        approveLabel="Allow once"
      />
    </div>
  );
}

/* ── sub-components ─────────────────────────────────────────────────────── */

function ReceiptThumb({
  filename,
  highlighted,
}: {
  filename: string;
  highlighted?: boolean;
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: "10px 12px",
        background: "var(--bg-canvas)",
        border: `1px solid ${
          highlighted ? "var(--brand-green-border)" : "var(--border-default)"
        }`,
        borderRadius: 10,
      }}
    >
      <div
        style={{
          width: 32,
          height: 40,
          borderRadius: 4,
          background: "#fafafa",
          color: "#0a0a0a",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
          border: "1px solid rgba(0,0,0,0.08)",
        }}
        aria-hidden="true"
      >
        <FileText size={14} color="#0a0a0a" strokeWidth={1.75} />
      </div>
      <div
        style={{
          fontFamily: "var(--font-inter), system-ui, sans-serif",
          fontSize: 12,
          color: "var(--fg-secondary)",
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}
      >
        {filename}
      </div>
    </div>
  );
}

/** Tiny 60×80 paper-style card the cursor "carries" while dragging. */
function CarryThumb() {
  return (
    <div
      style={{
        width: 60,
        height: 80,
        background: "#fafafa",
        border: "1px solid rgba(0,0,0,0.12)",
        borderRadius: 4,
        boxShadow: "0 6px 14px -4px rgba(0,0,0,0.25)",
        padding: 6,
        display: "flex",
        flexDirection: "column",
        gap: 4,
      }}
    >
      <div
        style={{
          fontSize: 8,
          fontWeight: 500,
          color: "#0a0a0a",
          fontFamily: "var(--font-source-code-pro), ui-monospace, monospace",
          letterSpacing: "0.4px",
        }}
      >
        Albert Heijn
      </div>
      <div
        style={{
          height: 2,
          background: "rgba(0,0,0,0.18)",
          width: "70%",
        }}
      />
      <div
        style={{
          height: 2,
          background: "rgba(0,0,0,0.12)",
          width: "85%",
        }}
      />
      <div
        style={{
          height: 2,
          background: "rgba(0,0,0,0.12)",
          width: "60%",
        }}
      />
      <div
        style={{
          marginTop: "auto",
          fontSize: 8,
          fontWeight: 500,
          color: "#0a0a0a",
          fontFamily: "var(--font-source-code-pro), ui-monospace, monospace",
          textAlign: "right",
        }}
      >
        €487,20
      </div>
    </div>
  );
}

function DropZone({
  dropped,
  filename,
}: {
  dropped: boolean;
  filename: string;
}) {
  return (
    <div
      style={{
        height: 160,
        border: dropped
          ? "1px solid var(--brand-green-border)"
          : "1.5px dashed var(--border-default)",
        background: dropped
          ? "var(--brand-green-soft)"
          : "var(--bg-inset)",
        borderRadius: 12,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 12,
        transition: "background 300ms ease-out, border-color 300ms ease-out",
      }}
    >
      {!dropped ? (
        <>
          <UploadCloud
            size={28}
            color="var(--fg-muted)"
            strokeWidth={1.5}
          />
          <div
            style={{
              color: "var(--fg-secondary)",
              fontSize: 14,
              fontFamily: "var(--font-inter), system-ui, sans-serif",
            }}
          >
            Drop a receipt here
          </div>
        </>
      ) : (
        <>
          <div
            style={{
              width: 36,
              height: 36,
              borderRadius: 9999,
              background: "var(--brand-green)",
              color: "#0a0a0a",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Check size={20} strokeWidth={2.4} />
          </div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              padding: "6px 12px",
              borderRadius: 9999,
              border: "1px solid var(--brand-green-border)",
              background: "var(--bg-canvas)",
              color: "var(--brand-green)",
              fontSize: 12,
              fontWeight: 500,
              fontFamily: "var(--font-inter), system-ui, sans-serif",
            }}
          >
            <FileText size={12} strokeWidth={1.75} />
            <span style={{ color: "var(--fg-primary)" }}>
              {filename}
            </span>
            <span
              style={{
                color: "var(--fg-muted)",
                fontFamily: "var(--font-source-code-pro), ui-monospace, monospace",
                fontSize: 11,
                letterSpacing: "1.2px",
                textTransform: "uppercase",
              }}
            >
              Uploaded
            </span>
          </div>
        </>
      )}
    </div>
  );
}
