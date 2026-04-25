"use client";

/**
 * ReserveTransferToast — bunq-styled receipt that visualises €412 moving from
 * the Operating sub-account to the Carbon Reserve sub-account. Uses the real
 * bunq pill-amount visual language: large amount in Inter weight 400, "→" arrow
 * between the two account chips, green check on settle.
 *
 * Drives entirely from `elapsedMs` so the parent scene can choreograph it
 * alongside the credit certificate.
 */

import { ArrowRight, Check } from "lucide-react";

export type ReserveTransferToastProps = {
  /** ms elapsed in the parent scene */
  elapsedMs: number;
  /** When to show the toast (ms into scene) */
  showAt: number;
  /** When the green check fires (ms into scene) */
  settleAt: number;
};

export function ReserveTransferToast({
  elapsedMs,
  showAt,
  settleAt,
}: ReserveTransferToastProps) {
  if (elapsedMs < showAt) return null;
  const enterT = Math.max(0, Math.min(1, (elapsedMs - showAt) / 320));
  const settled = elapsedMs >= settleAt;

  return (
    <div
      style={{
        opacity: enterT,
        transform: `translateY(${(1 - enterT) * 12}px)`,
        transition: "opacity 240ms ease-out, transform 240ms ease-out",
        background: "#171717",
        border: `1px solid ${settled ? "var(--brand-green, #3ecf8e)" : "#2e2e2e"}`,
        borderRadius: 16,
        padding: 24,
        width: 460,
        color: "#fafafa",
        fontFamily: "var(--font-inter), system-ui, sans-serif",
        willChange: "transform, opacity",
      }}
    >
      <div
        style={{
          fontFamily: "var(--font-source-code-pro), ui-monospace, monospace",
          fontSize: 11,
          letterSpacing: "1.2px",
          textTransform: "uppercase",
          color: "#898989",
          marginBottom: 14,
        }}
      >
        Reserve transfer · proposed
      </div>

      <div
        style={{
          fontSize: 44,
          fontWeight: 400,
          lineHeight: 1,
          letterSpacing: "-0.01em",
          marginBottom: 16,
          fontVariantNumeric: "tabular-nums",
        }}
      >
        € 412.00
      </div>

      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          marginBottom: 16,
        }}
      >
        <Pill label="Operating" />
        <ArrowRight size={16} color="#898989" />
        <Pill label="Carbon Reserve" highlighted={settled} />
      </div>

      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          fontFamily: "var(--font-source-code-pro), ui-monospace, monospace",
          fontSize: 11,
          letterSpacing: "1.2px",
          textTransform: "uppercase",
          color: settled ? "var(--brand-green, #3ecf8e)" : "#898989",
          transition: "color 220ms ease-out",
        }}
      >
        {settled ? (
          <>
            <Check size={14} strokeWidth={2.5} /> Transfer settled · 12:13:01
          </>
        ) : (
          "DRY_RUN · awaiting approve"
        )}
      </div>
    </div>
  );
}

function Pill({ label, highlighted }: { label: string; highlighted?: boolean }) {
  return (
    <span
      style={{
        padding: "6px 12px",
        borderRadius: 9999,
        border: `1px solid ${highlighted ? "var(--brand-green, #3ecf8e)" : "#2e2e2e"}`,
        background: highlighted ? "rgba(62, 207, 142, 0.10)" : "transparent",
        color: highlighted ? "var(--brand-green, #3ecf8e)" : "#fafafa",
        fontSize: 13,
        fontWeight: 500,
        transition: "all 220ms ease-out",
      }}
    >
      {label}
    </span>
  );
}
