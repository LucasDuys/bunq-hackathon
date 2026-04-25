"use client";

/**
 * DagFlow — S11.
 *
 * Animated visualization of the 8-agent Carbo DAG with EXPLICIT
 * parallel-pair callouts. Mirrors lib/agents/dag/index.ts:
 *
 *   tier 1: spend_emissions_baseline_agent      (deterministic, cached)
 *   tier 2: research_agent                      (Sonnet)
 *   tier 3: green_alternatives_agent || cost_savings_agent   ← PARALLEL
 *   tier 4: green_judge_agent || cost_judge_agent            ← PARALLEL
 *   tier 5: carbon_credit_incentive_strategy_agent           (Sonnet)
 *   tier 6: executive_report_agent                           (Sonnet)
 *
 * Tier scheduling: each tier's slice of `durationMs` is proportional to its
 * critical-path latency (max of the two parallel nodes for tiers 3/4).
 * Within tiers 3 and 4 BOTH nodes activate on the same frame — the parallel
 * fan-out is the visual centerpiece.
 *
 * Final state: all nodes done, executive_report has a faint accent halo.
 */

import { useMemo } from "react";
import type { CSSProperties, ComponentType } from "react";
import {
  Calculator,
  Search,
  Leaf,
  Wallet,
  ShieldCheck,
  Coins,
  FileText,
  CheckCircle2,
} from "lucide-react";
import type { DagNode } from "../types";

type Props = {
  nodes: DagNode[];
  elapsedMs: number;
  /**
   * Total scene duration (default 16s). Tier activations distribute
   * proportionally to per-tier critical-path latency.
   */
  durationMs?: number;
};

type IconCmp = ComponentType<{ size?: number | string; color?: string; strokeWidth?: number | string }>;

const ICONS: Record<string, IconCmp> = {
  Calculator,
  Search,
  Leaf,
  Wallet,
  ShieldCheck,
  Coins,
  FileText,
};

const TIER_GAP = 56;
const NODE_W = 280;
const NODE_H = 96;
const PARALLEL_GAP = 72; // horizontal gap between the two parallel nodes

type NodeStatus = "pending" | "active" | "done";

type TierBucket = {
  tier: 1 | 2 | 3 | 4 | 5 | 6;
  nodes: DagNode[];
  /** Critical-path latency for this tier (max of pair, or sole node). */
  criticalLatencyMs: number;
  /** When this tier becomes active, in scene-ms. */
  startMs: number;
  /** When all of this tier's nodes are done, in scene-ms. */
  endMs: number;
};

export function DagFlow({ nodes, elapsedMs, durationMs = 16_000 }: Props) {
  // Group nodes by tier. We don't reorder within tier — order from data.ts
  // determines left/right placement for parallel pairs (greenAlt left,
  // costSavings right; greenJudge left, costJudge right).
  const tiers = useMemo<TierBucket[]>(() => {
    const buckets: Record<number, DagNode[]> = {};
    for (const node of nodes) {
      (buckets[node.tier] ??= []).push(node);
    }
    const tierIds = (Object.keys(buckets) as unknown as string[])
      .map((k) => parseInt(k, 10) as 1 | 2 | 3 | 4 | 5 | 6)
      .sort((a, b) => a - b);

    // First pass: critical-path latency per tier (max for parallel pairs).
    const critLatencies = tierIds.map((t) =>
      Math.max(...buckets[t].map((n) => n.latencyMs))
    );
    const totalCrit = critLatencies.reduce((s, l) => s + l, 0) || 1;

    // Distribute durationMs proportionally to critical latency.
    let cursor = 0;
    return tierIds.map((tier, i) => {
      const slice = (critLatencies[i] / totalCrit) * durationMs;
      const startMs = cursor;
      const endMs = cursor + slice;
      cursor = endMs;
      return {
        tier,
        nodes: buckets[tier],
        criticalLatencyMs: critLatencies[i],
        startMs,
        endMs,
      } satisfies TierBucket;
    });
  }, [nodes, durationMs]);

  // The grid as a whole: total height = sum of node heights + gaps.
  const totalHeight =
    tiers.length * NODE_H + (tiers.length - 1) * TIER_GAP + 16;
  const gridWidth = NODE_W * 2 + PARALLEL_GAP + 80; // generous breathing room

  // Compute each tier's center Y and per-node X for the SVG edges.
  const layout = useMemo(() => {
    const tierCenters: { tier: number; cy: number; nodes: { id: string; cx: number }[] }[] = [];
    let y = 8; // top inset
    for (const t of tiers) {
      const cy = y + NODE_H / 2;
      const isParallel = t.nodes.length === 2;
      const nodes = t.nodes.map((n, i) => {
        let cx = gridWidth / 2;
        if (isParallel) {
          // Two columns, centered on grid midpoint.
          const half = NODE_W / 2 + PARALLEL_GAP / 2;
          cx = i === 0 ? gridWidth / 2 - half : gridWidth / 2 + half;
        }
        return { id: n.id, cx };
      });
      tierCenters.push({ tier: t.tier, cy, nodes });
      y += NODE_H + TIER_GAP;
    }
    return tierCenters;
  }, [tiers, gridWidth]);

  // For each node, compute status. Within a tier:
  //   - pending until tier.startMs
  //   - active between startMs and startMs + node.latencyMs (mapped to slice)
  //   - done thereafter
  const statusFor = (tier: TierBucket, node: DagNode): NodeStatus => {
    if (elapsedMs < tier.startMs) return "pending";
    // Map node's latency onto the tier's allocated slice.
    const slice = tier.endMs - tier.startMs;
    const localLatency = (node.latencyMs / tier.criticalLatencyMs) * slice;
    const localElapsed = elapsedMs - tier.startMs;
    if (localElapsed >= localLatency) return "done";
    return "active";
  };

  return (
    <div
      style={{
        position: "relative",
        width: gridWidth,
        height: totalHeight,
        margin: "0 auto",
        background: "var(--bg-canvas)",
        border: "1px solid var(--border-default)",
        borderRadius: 16,
        padding: "32px 24px 40px",
        boxSizing: "content-box",
      }}
    >
      <DagKeyframes />

      {/* SVG edges between tiers — drawn behind the node cards. */}
      <svg
        width={gridWidth}
        height={totalHeight}
        style={{
          position: "absolute",
          left: 24,
          top: 32,
          pointerEvents: "none",
          overflow: "visible",
        }}
      >
        {layout.slice(0, -1).map((from, i) => {
          const to = layout[i + 1];
          const sourceTier = tiers[i];
          const sourceDone = sourceTier.nodes.every(
            (n) => statusFor(sourceTier, n) === "done"
          );
          const stroke = sourceDone
            ? "var(--border-strong)"
            : "var(--border-faint)";
          // Connect every from-node to every to-node (handles fan-out & fan-in).
          return from.nodes.flatMap((src) =>
            to.nodes.map((dst) => (
              <line
                key={`${src.id}->${dst.id}`}
                x1={src.cx}
                y1={from.cy + NODE_H / 2}
                x2={dst.cx}
                y2={to.cy - NODE_H / 2}
                stroke={stroke}
                strokeWidth={1}
                style={{ transition: "stroke 400ms ease-out" }}
              />
            ))
          );
        })}
      </svg>

      {/* Node cards */}
      {tiers.map((tier, tierIdx) => {
        const tierLayout = layout[tierIdx];
        const isParallel = tier.nodes.length === 2;
        const tierDone = tier.nodes.every(
          (n) => statusFor(tier, n) === "done"
        );
        return (
          <div key={`tier-${tier.tier}`}>
            {tier.nodes.map((node, ni) => {
              const status = statusFor(tier, node);
              const cx = tierLayout.nodes[ni].cx;
              const cy = tierLayout.cy;
              return (
                <NodeCard
                  key={node.id}
                  node={node}
                  status={status}
                  // SVG centers; convert to top-left of card for absolute positioning.
                  left={24 + cx - NODE_W / 2}
                  top={32 + cy - NODE_H / 2}
                  isFinal={node.id === "executive_report_agent"}
                />
              );
            })}

            {/* Parallel chip + tooltip — positioned between the two cards */}
            {isParallel ? (
              <ParallelChip
                left={24 + gridWidth / 2 - 60}
                top={32 + tierLayout.cy - 14}
                tierDone={tierDone}
                savedMs={
                  tier.nodes.reduce((s, n) => s + n.latencyMs, 0) -
                  tier.criticalLatencyMs
                }
              />
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

/* ── sub-components ─────────────────────────────────────────────────────── */

function NodeCard({
  node,
  status,
  left,
  top,
  isFinal,
}: {
  node: DagNode;
  status: NodeStatus;
  left: number;
  top: number;
  isFinal: boolean;
}) {
  const Icon = ICONS[node.icon] ?? FileText;

  const borderColor =
    status === "active"
      ? "var(--brand-green-border)"
      : status === "done"
        ? "var(--border-strong)"
        : "var(--border-faint)";

  const opacity = status === "pending" ? 0.35 : 1;

  // Final accent: when the executive_report is done, give it a soft halo.
  const finalAccent =
    isFinal && status === "done"
      ? {
          boxShadow:
            "0 0 0 1px var(--brand-green-border), 0 0 24px -2px rgba(62, 207, 142, 0.18)",
        }
      : {};

  const style: CSSProperties = {
    position: "absolute",
    left,
    top,
    width: NODE_W,
    height: NODE_H,
    background: "var(--bg-canvas)",
    border: `1px solid ${borderColor}`,
    borderRadius: 12,
    padding: 14,
    boxSizing: "border-box",
    display: "flex",
    flexDirection: "column",
    justifyContent: "space-between",
    opacity,
    transition:
      "opacity 400ms ease-out, border-color 400ms ease-out, box-shadow 400ms ease-out",
    animation:
      status === "active" ? "dag-active-pulse 1.5s ease-in-out infinite" : undefined,
    ...finalAccent,
  };

  return (
    <div style={style}>
      {/* Top row: icon circle + label + check */}
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <div
          style={{
            width: 28,
            height: 28,
            borderRadius: 9999,
            background:
              status === "done" || status === "active"
                ? "var(--brand-green-soft)"
                : "var(--bg-inset)",
            border: `1px solid ${
              status === "done" || status === "active"
                ? "var(--brand-green-border)"
                : "var(--border-default)"
            }`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color:
              status === "done" || status === "active"
                ? "var(--brand-green)"
                : "var(--fg-muted)",
            flexShrink: 0,
            transition: "all 300ms ease-out",
          }}
        >
          <Icon size={15} />
        </div>
        <div
          style={{
            fontFamily: "var(--font-inter), system-ui, sans-serif",
            fontSize: 14,
            fontWeight: 500,
            color: "var(--fg-primary)",
            flex: 1,
            lineHeight: 1.2,
            letterSpacing: "-0.005em",
          }}
        >
          {node.label}
        </div>
        {status === "done" ? (
          <CheckCircle2 size={14} color="var(--brand-green)" />
        ) : null}
      </div>

      {/* Bottom row: model badge + cached pill + latency */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          fontFamily: "var(--font-source-code-pro), ui-monospace, monospace",
          fontSize: 11,
          letterSpacing: "1.2px",
          textTransform: "uppercase",
          color: "var(--fg-muted)",
        }}
      >
        <span>{node.model}</span>
        {node.cached ? (
          <span
            style={{
              padding: "2px 8px",
              borderRadius: 9999,
              border: "1px solid var(--brand-green-border)",
              color: "var(--brand-green)",
              fontSize: 10,
              letterSpacing: "1.2px",
            }}
          >
            Cached
          </span>
        ) : null}
        <span
          style={{
            marginLeft: "auto",
            color: "var(--fg-secondary)",
            fontVariantNumeric: "tabular-nums",
            letterSpacing: "0.4px",
          }}
        >
          {node.latencyMs}ms
        </span>
      </div>
    </div>
  );
}

function ParallelChip({
  left,
  top,
  tierDone,
  savedMs,
}: {
  left: number;
  top: number;
  tierDone: boolean;
  savedMs: number;
}) {
  return (
    <div
      style={{
        position: "absolute",
        left,
        top,
        width: 120,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 6,
        pointerEvents: "none",
      }}
    >
      <div
        style={{
          padding: "4px 12px",
          borderRadius: 9999,
          border: "1px solid var(--brand-green-border)",
          background: "var(--bg-canvas)",
          color: "var(--brand-green)",
          fontFamily: "var(--font-source-code-pro), ui-monospace, monospace",
          fontSize: 11,
          letterSpacing: "1.2px",
          textTransform: "uppercase",
          whiteSpace: "nowrap",
        }}
      >
        ║ Parallel
      </div>
      {/* Tooltip — fades in once both nodes finish */}
      <div
        style={{
          padding: "3px 8px",
          borderRadius: 6,
          background: "var(--bg-inset)",
          border: "1px solid var(--border-default)",
          color: "var(--fg-secondary)",
          fontFamily: "var(--font-source-code-pro), ui-monospace, monospace",
          fontSize: 10,
          letterSpacing: "0.6px",
          whiteSpace: "nowrap",
          opacity: tierDone ? 1 : 0,
          transform: tierDone ? "translateY(0)" : "translateY(-4px)",
          transition: "opacity 300ms ease-out, transform 300ms ease-out",
        }}
      >
        Parallel · saves {(savedMs / 1000).toFixed(1)}s
      </div>
    </div>
  );
}

function DagKeyframes() {
  return (
    <style>{`
      @keyframes dag-active-pulse {
        0%, 100% { border-color: var(--brand-green-border); }
        50%      { border-color: var(--brand-green); }
      }
      @media (prefers-reduced-motion: reduce) {
        @keyframes dag-active-pulse {
          0%, 100% { border-color: var(--brand-green-border); }
        }
      }
    `}</style>
  );
}
