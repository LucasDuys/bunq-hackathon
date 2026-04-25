"use client";

/**
 * ClusterCards — 4 priority clusters surfaced by the spend_emissions_baseline
 * agent in S9. Cards reveal staggered (150ms gap) driven externally by the
 * scene's `progress` (0..1).
 *
 * A card becomes visible iff `progress >= cardIndex / clusters.length`. Each
 * card runs a local opacity + translateY fade-in on its first paint.
 */

import { useMemo } from "react";
import type { PriorityCluster } from "../types";
import { fmtEur } from "@/lib/utils";
import { CodeLabel } from "@/components/ui";

export type ClusterCardsProps = {
  clusters: PriorityCluster[];
  /** 0..1 progress controlling reveal stagger. */
  progress: number;
};

export function ClusterCards({ clusters, progress }: ClusterCardsProps) {
  // Per-card local progress: maps the global progress to a 0..1 ramp per slot.
  const cardProgress = useMemo(() => {
    const n = clusters.length;
    return clusters.map((_, i) => {
      const start = i / n;
      const local = (progress - start) / (1 / n);
      return Math.max(0, Math.min(1, local));
    });
  }, [clusters, progress]);

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: `repeat(${clusters.length}, minmax(0, 1fr))`,
        gap: 16,
        width: "100%",
      }}
    >
      {clusters.map((cluster, i) => (
        <ClusterCard key={cluster.id} cluster={cluster} progress={cardProgress[i] ?? 0} />
      ))}
    </div>
  );
}

function ClusterCard({
  cluster,
  progress,
}: {
  cluster: PriorityCluster;
  progress: number;
}) {
  const eased = easeOut(progress);
  const opacity = eased;
  const translateY = (1 - eased) * 16;

  return (
    <div
      style={{
        background: "#171717",
        border: "1px solid var(--border-default)",
        borderRadius: 12,
        padding: 16,
        opacity,
        transform: `translate3d(0, ${translateY}px, 0)`,
        transition: "opacity 400ms ease-out, transform 400ms ease-out",
        willChange: "opacity, transform",
        display: "flex",
        flexDirection: "column",
        gap: 12,
      }}
    >
      {/* ── Header: dot + category ── */}
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span
          aria-hidden="true"
          style={{
            display: "inline-block",
            width: 6,
            height: 6,
            borderRadius: "50%",
            background: cluster.color,
            flexShrink: 0,
          }}
        />
        <span
          style={{
            color: "var(--fg-primary)",
            fontSize: 14,
            fontWeight: 500,
            fontFamily: "var(--font-inter), system-ui, sans-serif",
          }}
        >
          {cluster.category}
        </span>
      </div>

      {/* ── Sub-label ── */}
      <div
        style={{
          color: "var(--fg-muted)",
          fontSize: 12,
          fontFamily: "var(--font-inter), system-ui, sans-serif",
          lineHeight: 1.4,
        }}
      >
        {cluster.subLabel}
      </div>

      {/* ── Big stat: annual spend ── */}
      <div
        style={{
          color: "var(--fg-primary)",
          fontSize: 28,
          fontWeight: 400,
          fontVariantNumeric: "tabular-nums",
          letterSpacing: "-0.01em",
          lineHeight: 1.0,
          marginTop: 4,
        }}
      >
        {fmtEur(cluster.annualSpendEur, 0)}
      </div>

      {/* ── tCO₂e — confidence pairing requirement isn't applicable here
              (priority cards are spend-driven), but we still render the figure
              with explicit unit. ── */}
      <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
        <span
          style={{
            color: "var(--fg-primary)",
            fontSize: 18,
            fontWeight: 400,
            fontVariantNumeric: "tabular-nums",
            letterSpacing: "-0.01em",
          }}
        >
          {cluster.tco2e.toFixed(1)}
        </span>
        <span
          style={{
            color: "var(--fg-muted)",
            fontSize: 12,
            fontFamily: "var(--font-inter), system-ui, sans-serif",
          }}
        >
          tCO₂e / yr
        </span>
      </div>

      {/* ── Priority pill ── */}
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: "auto" }}>
        <span
          aria-hidden="true"
          style={{
            display: "inline-block",
            width: 6,
            height: 6,
            borderRadius: "50%",
            background: cluster.color,
            flexShrink: 0,
          }}
        />
        <CodeLabel>Priority · High</CodeLabel>
      </div>
    </div>
  );
}

function easeOut(t: number): number {
  if (t <= 0) return 0;
  if (t >= 1) return 1;
  return 1 - Math.pow(1 - t, 3);
}
