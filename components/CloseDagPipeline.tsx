"use client";

import { useMemo } from "react";
import {
  Banknote,
  Calculator,
  CheckCircle2,
  ClipboardCheck,
  Coins,
  HelpCircle,
  Search,
  Sparkles,
  Wallet,
  XCircle,
} from "lucide-react";

// Mirrors NarratePhase from CloseChatStream so the parent's StepGroup is
// assignable here. CLASSIFY exists in the audit chain but is folded into the
// INGEST node visually — we never render a CLASSIFY node, so the type is
// wider than the rendered set on purpose.
type Phase =
  | "INGEST"
  | "CLASSIFY"
  | "ESTIMATE"
  | "CLUSTER"
  | "REFINE"
  | "POLICY"
  | "PROPOSE"
  | "EXECUTE"
  | "COMPLETE";

type RenderedPhase = Exclude<Phase, "CLASSIFY">;

type NodeStatus =
  | "pending"
  | "active"
  | "done"
  | "waiting"
  | "error"
  | "skipped";

type DataLite = {
  state: string;
  status: string;
  initialCo2eKg: number | null;
  finalCo2eKg: number | null;
  initialConfidence: number | null;
  finalConfidence: number | null;
  reserveEur: number | null;
  events: Array<{ id: number; payload: unknown }>;
};

type EntryLite = {
  id: number;
  payload: {
    role: string;
    title: string;
    body?: string;
    meta?: Record<string, unknown>;
    tool?: string;
  };
};

export type StepGroupLite = {
  phase: Phase;
  status: "pending" | "active" | "done" | "waiting" | "error";
  startedAt: number | null;
  endedAt: number | null;
  entries: EntryLite[];
};

type NodeDef = {
  key: RenderedPhase;
  label: string;
  icon: typeof Wallet;
};

const NODES: NodeDef[] = [
  { key: "INGEST", label: "Ingest", icon: Wallet },
  { key: "ESTIMATE", label: "Estimate", icon: Calculator },
  { key: "CLUSTER", label: "Cluster", icon: Search },
  { key: "REFINE", label: "Refine", icon: Sparkles },
  { key: "POLICY", label: "Policy", icon: Coins },
  { key: "PROPOSE", label: "Propose", icon: ClipboardCheck },
  { key: "EXECUTE", label: "Execute", icon: Banknote },
  { key: "COMPLETE", label: "Complete", icon: CheckCircle2 },
];

const REFINE_INDEX = NODES.findIndex((n) => n.key === "REFINE");

const formatNum = (n: number, fraction = 0): string =>
  new Intl.NumberFormat("en-NL", {
    minimumFractionDigits: fraction,
    maximumFractionDigits: fraction,
  }).format(n);

const statForPhase = (
  phase: RenderedPhase,
  group: StepGroupLite | undefined,
  data: DataLite,
): string | null => {
  switch (phase) {
    case "INGEST": {
      const result = group?.entries.find(
        (e) => e.payload.role === "tool_result",
      );
      const meta = result?.payload.meta as { txCount?: number } | undefined;
      return meta?.txCount != null ? `${meta.txCount} tx` : null;
    }
    case "ESTIMATE": {
      const v = data.finalCo2eKg ?? data.initialCo2eKg;
      return v != null ? `${formatNum(v, 0)} kg` : null;
    }
    case "CLUSTER": {
      const result = group?.entries.find(
        (e) =>
          Array.isArray(
            (e.payload.meta as { flagged?: unknown[] } | undefined)?.flagged,
          ),
      );
      const flagged = (result?.payload.meta as { flagged?: unknown[] } | undefined)
        ?.flagged;
      return flagged
        ? `${flagged.length} flag${flagged.length === 1 ? "" : "s"}`
        : null;
    }
    case "REFINE": {
      const answered =
        group?.entries.filter((e) => e.payload.role === "summary").length ?? 0;
      return answered > 0
        ? `${answered} ans${answered === 1 ? "" : "wers"}`
        : null;
    }
    case "POLICY":
      return data.reserveEur != null ? `€${formatNum(data.reserveEur, 0)}` : null;
    case "PROPOSE": {
      const summary = group?.entries.find((e) => e.payload.role === "summary");
      const meta = summary?.payload.meta as
        | { tonnesCovered?: number; creditProjects?: unknown[] }
        | undefined;
      if (meta?.tonnesCovered != null)
        return `${formatNum(meta.tonnesCovered, 2)} t`;
      return null;
    }
    case "EXECUTE":
      return data.reserveEur != null ? `€${formatNum(data.reserveEur, 0)}` : null;
    case "COMPLETE":
      return data.state === "COMPLETED" ? "sealed" : null;
  }
};

export const CloseDagPipeline = ({
  groups,
  data,
  live,
}: {
  groups: StepGroupLite[];
  data: DataLite;
  live: boolean;
}) => {
  const phaseToGroup = useMemo(() => {
    const map = new Map<Phase, StepGroupLite>();
    for (const g of groups) map.set(g.phase, g);
    return map;
  }, [groups]);

  const getGroup = (key: RenderedPhase) => phaseToGroup.get(key);

  // Resolve per-node status. REFINE is optional — mark "skipped" once we're
  // past it without entries (so the node visually bypasses).
  const computedStatus: NodeStatus[] = useMemo(() => {
    let activeIdx = -1;
    for (let i = 0; i < NODES.length; i++) {
      const g = phaseToGroup.get(NODES[i].key);
      if (g && (g.status === "active" || g.status === "waiting")) {
        activeIdx = i;
        break;
      }
    }
    return NODES.map((n, i) => {
      const g = phaseToGroup.get(n.key);
      if (g) return g.status;
      if (n.key === "REFINE") {
        const past = activeIdx > REFINE_INDEX || data.state === "COMPLETED";
        return past ? "skipped" : "pending";
      }
      return "pending";
    });
  }, [phaseToGroup, data.state]);

  const completedCount = computedStatus.filter((s) => s === "done").length;
  const activeIdx = computedStatus.findIndex(
    (s) => s === "active" || s === "waiting",
  );
  const headlineCopy = (() => {
    if (data.state === "COMPLETED") return "Loop closed";
    if (data.state === "FAILED") return "Run failed";
    if (activeIdx < 0) return "Spinning up";
    return `Stage ${activeIdx + 1} · ${NODES[activeIdx].label.toLowerCase()}`;
  })();

  return (
    <div className="dag" aria-label="Close pipeline">
      <div className="dag__head">
        <span className="dag__head-eyebrow">Pipeline</span>
        {live && (
          <span className="dag__live">
            <span className="dag__live-dot" aria-hidden="true" />
            Live
          </span>
        )}
        <span className="dag__head-headline">{headlineCopy}</span>
        <span className="dag__head-count">
          <span className="tabular-nums">{completedCount}</span>
          <span className="dag__head-count-sep">/</span>
          <span className="tabular-nums">{NODES.length}</span>
          <span className="dag__head-count-label">stages</span>
        </span>
      </div>

      <div className="dag__rail-wrap">
        <ol className="dag__row" role="list">
          {NODES.map((node, i) => {
            const status = computedStatus[i];
            const isLast = i === NODES.length - 1;
            const stat = statForPhase(node.key, phaseToGroup.get(node.key), data);
            const Icon = node.icon;
            const isActive = status === "active" || status === "waiting";

            // Edge from this node to the next reflects this node's state
            let edgeMod: "pending" | "done" | "active" | "skipped" = "pending";
            if (status === "done") edgeMod = "done";
            else if (isActive) edgeMod = "active";
            else if (status === "skipped") edgeMod = "skipped";

            const renderIcon = (() => {
              if (status === "done")
                return <CheckCircle2 className="h-4 w-4" aria-hidden="true" />;
              if (status === "waiting")
                return <HelpCircle className="h-4 w-4" aria-hidden="true" />;
              if (status === "error")
                return <XCircle className="h-4 w-4" aria-hidden="true" />;
              return <Icon className="h-4 w-4" aria-hidden="true" />;
            })();

            const ariaLabel = (() => {
              const parts = [`${node.label}`];
              if (status === "done") parts.push("complete");
              else if (status === "active") parts.push("running");
              else if (status === "waiting") parts.push("awaiting input");
              else if (status === "error") parts.push("failed");
              else if (status === "skipped") parts.push("skipped");
              else parts.push("pending");
              if (stat) parts.push(stat);
              return parts.join(" · ");
            })();

            return (
              <li
                key={node.key}
                className={`dag__cell dag__cell--${status}`}
                style={{ "--cell-index": i } as React.CSSProperties}
              >
                <span className="dag__cell-index" aria-hidden="true">
                  {String(i + 1).padStart(2, "0")}
                </span>

                <div className="dag__node-wrap">
                  <span
                    className={`dag__node dag__node--${status}`}
                    aria-current={isActive ? "step" : undefined}
                    aria-label={ariaLabel}
                  >
                    <span className="dag__node-icon">{renderIcon}</span>
                  </span>
                  {isActive && (
                    <span className="dag__node-orbit" aria-hidden="true" />
                  )}
                  {isActive && (
                    <span className="dag__node-glow" aria-hidden="true" />
                  )}
                </div>

                {!isLast && (
                  <span
                    className={`dag__edge dag__edge--${edgeMod}`}
                    aria-hidden="true"
                  >
                    <span className="dag__edge-track" />
                    {edgeMod === "active" && (
                      <>
                        <span className="dag__edge-dashes" />
                        <span className="dag__particle" />
                        <span className="dag__particle dag__particle--d2" />
                        <span className="dag__particle dag__particle--d3" />
                      </>
                    )}
                  </span>
                )}

                <div className="dag__meta">
                  <span className="dag__label">{node.label}</span>
                  <span
                    className="dag__stat tabular-nums"
                    data-empty={stat ? "false" : "true"}
                  >
                    {stat ?? "—"}
                  </span>
                </div>
              </li>
            );
          })}
        </ol>
      </div>
    </div>
  );
};
