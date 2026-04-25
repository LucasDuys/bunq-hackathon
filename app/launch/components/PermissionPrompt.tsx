"use client";

/**
 * PermissionPrompt — slide-in modal sheet that mirrors the ChatGPT-5.5
 * "Allow agent to ..." transparency motif. Shows a question, an Approve
 * primary CTA, and a Deny ghost CTA. Auto-approves at `approveAt` (ms into
 * the parent scene) so the rest of the choreography can proceed.
 *
 * Pure client component, time-driven by props from the parent scene. Renders
 * a centered sheet over a faint backdrop. Approval triggers a brief green
 * pulse on the Approve button before fade-out.
 *
 * Lifecycle (all relative to scene start):
 *   showAt          — slide in from below + fade in
 *   approveAt       — Approve button pulses green
 *   approveAt+450   — sheet fades out
 */
import { Check, Shield } from "lucide-react";

export type PermissionPromptProps = {
  /** ms elapsed in the parent scene */
  elapsedMs: number;
  /** When to show the sheet (ms into scene). */
  showAt: number;
  /** When auto-approve fires (ms into scene). */
  approveAt: number;
  /** Body question, e.g. "Allow Carbo to read this receipt?" */
  question: string;
  /** Optional smaller description below the question. */
  description?: string;
  /** Approve button label, default "Approve". */
  approveLabel?: string;
};

const FADE_OUT_MS = 380;

export function PermissionPrompt({
  elapsedMs,
  showAt,
  approveAt,
  question,
  description,
  approveLabel = "Approve",
}: PermissionPromptProps) {
  const visible = elapsedMs >= showAt;
  const approved = elapsedMs >= approveAt;
  const fadeOutStart = approveAt + 220;
  const fadeT = Math.max(
    0,
    Math.min(1, (elapsedMs - fadeOutStart) / FADE_OUT_MS)
  );

  if (!visible) return null;

  // Slide-in from translateY 16 → 0 over 320ms.
  const enterT = Math.max(0, Math.min(1, (elapsedMs - showAt) / 320));
  const opacity = enterT * (1 - fadeT);
  const translateY = (1 - enterT) * 16 + fadeT * -8;

  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: `rgba(15, 15, 15, ${0.32 * (1 - fadeT) * enterT})`,
        zIndex: 40,
        pointerEvents: "none",
      }}
      aria-modal="true"
      role="alertdialog"
    >
      <div
        style={{
          width: 420,
          maxWidth: "70vw",
          background: "#ffffff",
          borderRadius: 14,
          border: "1px solid rgba(15, 15, 15, 0.08)",
          boxShadow:
            "0 20px 48px rgba(15, 15, 15, 0.18), 0 4px 12px rgba(15, 15, 15, 0.08)",
          padding: 20,
          opacity,
          transform: `translateY(${translateY}px)`,
          willChange: "transform, opacity",
          fontFamily: "var(--font-inter), system-ui, sans-serif",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            marginBottom: 12,
          }}
        >
          <div
            aria-hidden="true"
            style={{
              width: 28,
              height: 28,
              borderRadius: 8,
              background: "rgba(62, 207, 142, 0.14)",
              color: "var(--brand-green, #3ecf8e)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Shield size={16} strokeWidth={2} />
          </div>
          <span
            style={{
              fontFamily:
                "var(--font-source-code-pro), ui-monospace, monospace",
              fontSize: 11,
              letterSpacing: "1.2px",
              textTransform: "uppercase",
              color: "#6e6e6e",
            }}
          >
            Permission required
          </span>
        </div>

        <div
          style={{
            fontSize: 16,
            color: "#0f0f0f",
            lineHeight: 1.4,
            marginBottom: description ? 6 : 16,
          }}
        >
          {question}
        </div>
        {description ? (
          <div
            style={{
              fontSize: 13,
              color: "#6e6e6e",
              lineHeight: 1.45,
              marginBottom: 16,
            }}
          >
            {description}
          </div>
        ) : null}

        <div
          style={{
            display: "flex",
            gap: 8,
            justifyContent: "flex-end",
          }}
        >
          <button
            type="button"
            disabled
            style={{
              height: 34,
              padding: "0 14px",
              borderRadius: 6,
              border: "1px solid rgba(15, 15, 15, 0.10)",
              background: "transparent",
              color: "#6e6e6e",
              fontSize: 13,
              fontWeight: 500,
              fontFamily: "inherit",
              cursor: "default",
            }}
          >
            Deny
          </button>
          <button
            type="button"
            disabled
            style={{
              height: 34,
              padding: "0 16px",
              borderRadius: 9999,
              border: "1px solid #0f0f0f",
              background: approved ? "var(--brand-green, #3ecf8e)" : "#0f0f0f",
              color: approved ? "#0a0a0a" : "#fafafa",
              fontSize: 13,
              fontWeight: 500,
              fontFamily: "inherit",
              cursor: "default",
              display: "flex",
              alignItems: "center",
              gap: 6,
              transition: "background 220ms ease-out, color 220ms ease-out",
              boxShadow: approved
                ? "0 0 0 3px rgba(62, 207, 142, 0.24)"
                : "none",
            }}
          >
            {approved ? <Check size={14} strokeWidth={2.5} /> : null}
            {approved ? "Approved" : approveLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
