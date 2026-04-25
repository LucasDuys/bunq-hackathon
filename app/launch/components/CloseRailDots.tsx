"use client";

/**
 * CloseRailDots — the 6-dot sticky rail for the close state machine.
 * INGEST → CLASSIFY → ESTIMATE → CLUSTER → READY → APPROVED.
 *
 * Driven by `progress` (0..1). Each dot transitions through three visual
 * states: future (hollow border), active (pulsing brand-green), done (solid
 * brand-green). The active state sits at progress * 6 with a 1.5s opacity
 * pulse; prior dots are solid; future dots are hollow.
 *
 * DESIGN.md §4.10 spells the colors and labels.
 */
import {
  AlertCircle,
  Calculator,
  CheckCircle2,
  ShieldCheck,
  Tags,
  Zap,
} from "lucide-react";

type StateKey = "INGEST" | "CLASSIFY" | "ESTIMATE" | "CLUSTER" | "READY" | "APPROVED";

const STATES: Array<{
  key: StateKey;
  label: string;
  copy: string;
  icon: typeof Zap;
}> = [
  { key: "INGEST",    label: "Ingest",    copy: "Reading transactions",     icon: Zap },
  { key: "CLASSIFY",  label: "Classify",  copy: "Matching merchants",       icon: Tags },
  { key: "ESTIMATE",  label: "Estimate",  copy: "Estimating emissions",     icon: Calculator },
  { key: "CLUSTER",   label: "Cluster",   copy: "Grouping uncertainty",     icon: AlertCircle },
  { key: "READY",     label: "Ready",     copy: "Ready to approve",         icon: CheckCircle2 },
  { key: "APPROVED",  label: "Approved",  copy: "Reserve transferred",      icon: ShieldCheck },
];

export type CloseRailDotsProps = {
  /** 0..1 progress through the close machine. */
  progress: number;
  /** ms elapsed in the parent scene — drives the active-dot pulse. */
  elapsedMs: number;
};

export function CloseRailDots({ progress, elapsedMs }: CloseRailDotsProps) {
  // 6 states; activeFloat is float position; activeIdx clamps to int.
  const activeFloat = Math.min(STATES.length - 0.001, progress * STATES.length);
  const activeIdx = Math.floor(activeFloat);
  // Pulse: 1.5s opacity 0.6→1 sine.
  const pulse = 0.7 + 0.3 * (0.5 + 0.5 * Math.sin(elapsedMs / 240));
  const ActiveIcon = STATES[activeIdx]!.icon;

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 24,
        padding: "32px 24px",
      }}
    >
      {/* Headline */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          fontFamily: "var(--font-inter), system-ui, sans-serif",
          color: "#fafafa",
        }}
      >
        <ActiveIcon
          size={18}
          color="var(--brand-green, #3ecf8e)"
          strokeWidth={2}
          style={{ opacity: pulse }}
        />
        <span style={{ fontSize: 22, fontWeight: 400, letterSpacing: "-0.01em" }}>
          {STATES[activeIdx]!.copy}
          <span
            aria-hidden="true"
            style={{
              opacity: Math.floor(elapsedMs / 380) % 2 === 0 ? 1 : 0,
              marginLeft: 2,
            }}
          >
            …
          </span>
        </span>
      </div>

      {/* Sub-eyebrow */}
      <div
        style={{
          fontFamily: "var(--font-source-code-pro), ui-monospace, monospace",
          fontSize: 11,
          letterSpacing: "1.2px",
          textTransform: "uppercase",
          color: "#898989",
        }}
      >
        Close · April 2026
      </div>

      {/* Dot rail */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 0,
          marginTop: 8,
        }}
      >
        {STATES.map((s, i) => {
          const isDone = i < activeIdx;
          const isActive = i === activeIdx;
          const dotBg = isDone
            ? "var(--brand-green, #3ecf8e)"
            : isActive
            ? "var(--brand-green, #3ecf8e)"
            : "transparent";
          const dotBorder = isActive
            ? "var(--brand-green, #3ecf8e)"
            : isDone
            ? "var(--brand-green, #3ecf8e)"
            : "#2e2e2e";
          const dotOpacity = isActive ? pulse : isDone ? 1 : 1;

          return (
            <div
              key={s.key}
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                width: 92,
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  width: "100%",
                }}
              >
                {/* Pre-line */}
                <div
                  aria-hidden="true"
                  style={{
                    flex: 1,
                    height: 1,
                    background: i === 0 ? "transparent" : i <= activeIdx ? "var(--brand-green, #3ecf8e)" : "#2e2e2e",
                    transition: "background 320ms ease-out",
                  }}
                />
                {/* Dot */}
                <div
                  style={{
                    width: 14,
                    height: 14,
                    borderRadius: 9999,
                    background: dotBg,
                    border: `1.5px solid ${dotBorder}`,
                    opacity: dotOpacity,
                    transition: "background 320ms ease-out, border-color 320ms ease-out",
                    boxShadow: isActive
                      ? "0 0 0 4px rgba(62, 207, 142, 0.18)"
                      : "none",
                    flexShrink: 0,
                  }}
                />
                {/* Post-line */}
                <div
                  aria-hidden="true"
                  style={{
                    flex: 1,
                    height: 1,
                    background:
                      i === STATES.length - 1
                        ? "transparent"
                        : i < activeIdx
                        ? "var(--brand-green, #3ecf8e)"
                        : "#2e2e2e",
                    transition: "background 320ms ease-out",
                  }}
                />
              </div>
              <div
                style={{
                  marginTop: 12,
                  fontFamily: "var(--font-source-code-pro), ui-monospace, monospace",
                  fontSize: 10,
                  letterSpacing: "1.2px",
                  textTransform: "uppercase",
                  color:
                    isActive
                      ? "var(--brand-green, #3ecf8e)"
                      : isDone
                      ? "#b4b4b4"
                      : "#4d4d4d",
                  transition: "color 320ms ease-out",
                  whiteSpace: "nowrap",
                }}
              >
                {s.label}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
