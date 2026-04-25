"use client";

/**
 * CreditCertificate — print-style document that "prints" line by line
 * (Puro.earth · Gelderland Biochar · 2.84t · €412) when the credit is
 * purchased. Tan paper background, mono header, ribbon stamp at the end.
 *
 * Pure visual — pulls fixture data inline; the real `lib/credits/projects.ts`
 * row would be passed in for production but we keep the demo deterministic.
 */

import { Award, FileCheck2 } from "lucide-react";

const LINES: Array<{ label: string; value: string }> = [
  { label: "REGISTRY",     value: "Puro.earth · methodology v3" },
  { label: "PROJECT",      value: "Gelderland Biochar Initiative" },
  { label: "TYPE",         value: "Removal · technical · biochar pyrolysis" },
  { label: "REGION",       value: "Gelderland · NL · EU" },
  { label: "TONNES",       value: "2.84 tCO₂e" },
  { label: "PRICE / TONNE",value: "€ 145.00" },
  { label: "TOTAL",        value: "€ 411.80" },
  { label: "PERMANENCE",   value: ">100 years" },
  { label: "RETIRED ON",   value: "2026-04-25 12:13:02 UTC" },
];

export type CreditCertificateProps = {
  /** ms elapsed in the parent scene */
  elapsedMs: number;
  /** When to start printing (ms into scene) */
  printStart: number;
  /** When stamp fires (ms into scene) */
  stampAt: number;
};

const PER_LINE_MS = 220;

export function CreditCertificate({
  elapsedMs,
  printStart,
  stampAt,
}: CreditCertificateProps) {
  if (elapsedMs < printStart) return null;
  const enterT = Math.max(0, Math.min(1, (elapsedMs - printStart) / 320));
  const printedFloat = Math.max(0, (elapsedMs - printStart) / PER_LINE_MS);
  const printedCount = Math.min(LINES.length, Math.floor(printedFloat));
  const stamped = elapsedMs >= stampAt;

  return (
    <div
      style={{
        position: "relative",
        width: 460,
        opacity: enterT,
        transform: `translateY(${(1 - enterT) * 12}px)`,
        transition: "opacity 320ms ease-out, transform 320ms ease-out",
        background: "#fdfaf3",
        borderRadius: 12,
        border: "1px solid #e9e3d2",
        padding: 26,
        color: "#1a1a1a",
        fontFamily: "var(--font-source-code-pro), ui-monospace, monospace",
        boxShadow: "0 24px 48px rgba(15, 15, 15, 0.18)",
        willChange: "transform, opacity",
        overflow: "hidden",
      }}
    >
      {/* Header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          marginBottom: 4,
          fontSize: 11,
          letterSpacing: "1.2px",
          textTransform: "uppercase",
          color: "#6e6e6e",
        }}
      >
        <FileCheck2 size={14} color="#1a1a1a" strokeWidth={2} />
        Carbon credit · retirement certificate
      </div>
      <div
        style={{
          fontFamily: "var(--font-inter), system-ui, sans-serif",
          fontSize: 22,
          fontWeight: 400,
          lineHeight: 1.15,
          letterSpacing: "-0.01em",
          marginBottom: 18,
          color: "#0f0f0f",
        }}
      >
        2.84 tCO₂e retired
      </div>

      {/* Printed lines */}
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {LINES.map((l, i) => {
          const visible = i < printedCount;
          return (
            <div
              key={l.label}
              style={{
                display: "grid",
                gridTemplateColumns: "120px 1fr",
                gap: 10,
                fontSize: 11,
                lineHeight: 1.5,
                opacity: visible ? 1 : 0,
                transform: `translateY(${visible ? 0 : 4}px)`,
                transition: "opacity 200ms ease-out, transform 200ms ease-out",
              }}
            >
              <span
                style={{
                  letterSpacing: "1.2px",
                  textTransform: "uppercase",
                  color: "#6e6e6e",
                }}
              >
                {l.label}
              </span>
              <span style={{ color: "#0f0f0f" }}>{l.value}</span>
            </div>
          );
        })}
      </div>

      {/* Stamp */}
      <div
        aria-hidden="true"
        style={{
          position: "absolute",
          right: 22,
          bottom: 22,
          display: "flex",
          alignItems: "center",
          gap: 6,
          padding: "6px 10px",
          borderRadius: 9999,
          border: "1.5px solid #c0392b",
          color: "#c0392b",
          fontSize: 11,
          letterSpacing: "1.6px",
          textTransform: "uppercase",
          opacity: stamped ? 0.92 : 0,
          transform: `rotate(-8deg) scale(${stamped ? 1 : 1.6})`,
          transition: "opacity 220ms ease-out, transform 320ms cubic-bezier(0.32, 0.72, 0, 1)",
        }}
      >
        <Award size={12} strokeWidth={2.5} />
        Retired
      </div>
    </div>
  );
}
