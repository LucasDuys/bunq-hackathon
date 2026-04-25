"use client";

import { useEffect, useRef, useState } from "react";
import {
  CheckCircle2,
  FileText,
  Globe2,
  Leaf,
  Receipt,
  Scale,
  ShieldCheck,
  Sparkles,
  Wallet,
} from "lucide-react";

type Status = "pending" | "active" | "done";

const NODES = [
  { key: "baseline", label: "Baseline", icon: Wallet },
  { key: "research", label: "Research", icon: Globe2 },
  { key: "green_alt", label: "Greens", icon: Leaf },
  { key: "cost", label: "Costs", icon: Receipt },
  { key: "green_judge", label: "G·judge", icon: Scale },
  { key: "cost_judge", label: "C·judge", icon: ShieldCheck },
  { key: "credits", label: "Credits", icon: Sparkles },
  { key: "report", label: "Report", icon: FileText },
] as const;

// Deterministic timeline. Pairs (green_alt+cost) and (green_judge+cost_judge)
// run in parallel — they activate together and complete together. Last stage
// stalls if the request hasn't resolved yet, then jumps to "done".
const TIMELINE: Array<{ idxs: number[]; holdMs: number }> = [
  { idxs: [0], holdMs: 700 },
  { idxs: [1], holdMs: 7000 },
  { idxs: [2, 3], holdMs: 4500 },
  { idxs: [4, 5], holdMs: 3800 },
  { idxs: [6], holdMs: 1200 },
  { idxs: [7], holdMs: 4500 },
];

type Props = {
  open: boolean;
  done: boolean;
};

export const ResearchProgressOverlay = ({ open, done }: Props) => {
  const [statuses, setStatuses] = useState<Status[]>(() => NODES.map(() => "pending"));
  const timersRef = useRef<number[]>([]);

  useEffect(() => {
    if (!open) {
      timersRef.current.forEach((t) => clearTimeout(t));
      timersRef.current = [];
      setStatuses(NODES.map(() => "pending"));
      return;
    }

    let cancelled = false;

    const runStep = (idx: number) => {
      if (cancelled || idx >= TIMELINE.length) return;
      const { idxs, holdMs } = TIMELINE[idx];

      setStatuses((prev) => {
        const next = [...prev];
        for (const i of idxs) if (next[i] === "pending") next[i] = "active";
        return next;
      });

      const t = window.setTimeout(() => {
        if (cancelled) return;
        const isLast = idx === TIMELINE.length - 1;
        if (isLast) return; // stall on last group until `done` resolves
        setStatuses((prev) => {
          const next = [...prev];
          for (const i of idxs) next[i] = "done";
          return next;
        });
        runStep(idx + 1);
      }, holdMs);

      timersRef.current.push(t);
    };

    runStep(0);

    return () => {
      cancelled = true;
      timersRef.current.forEach((t) => clearTimeout(t));
      timersRef.current = [];
    };
  }, [open]);

  useEffect(() => {
    if (!done) return;
    const t = window.setTimeout(() => {
      setStatuses(NODES.map(() => "done"));
    }, 220);
    timersRef.current.push(t);
    return () => clearTimeout(t);
  }, [done]);

  if (!open) return null;

  const completedCount = statuses.filter((s) => s === "done").length;
  const activeIdxs = statuses.flatMap((s, i) => (s === "active" ? [i] : []));
  const progressPct = Math.round((completedCount / NODES.length) * 100);

  const headline = (() => {
    if (completedCount === NODES.length) return "Briefing ready";
    if (activeIdxs.length === 0) return "Spinning up agents";
    const labels = activeIdxs.map((i) => NODES[i].label.toLowerCase()).join(" + ");
    const stagePart =
      activeIdxs.length > 1
        ? `Stages ${activeIdxs[0] + 1}–${activeIdxs[activeIdxs.length - 1] + 1}`
        : `Stage ${activeIdxs[0] + 1}`;
    return `${stagePart} · ${labels}`;
  })();

  return (
    <div
      className="research-overlay"
      role="status"
      aria-live="polite"
      aria-label="Impact research in progress"
    >
      <div className="research-overlay__backdrop" aria-hidden="true" />
      <div className="research-overlay__panel">
        <div className="research-overlay__head">
          <span className="dag__live">
            <span className="dag__live-dot" aria-hidden="true" />
            Live
          </span>
          <span className="research-overlay__eyebrow">Carbo agents · 8-agent DAG</span>
          <span className="research-overlay__count">
            <span className="tabular-nums">{completedCount}</span>
            <span className="research-overlay__count-sep">/</span>
            <span className="tabular-nums">{NODES.length}</span>
            <span className="research-overlay__count-label">stages</span>
          </span>
        </div>
        <h2 className="research-overlay__title">{headline}</h2>

        <div className="dag research-overlay__dag">
          <div className="dag__rail-wrap">
            <ol className="dag__row" role="list">
              {NODES.map((node, i) => {
                const status = statuses[i];
                const isLast = i === NODES.length - 1;
                const Icon = node.icon;
                const isActive = status === "active";
                const isDone = status === "done";

                let edgeMod: "pending" | "done" | "active" = "pending";
                if (isDone) edgeMod = "done";
                else if (isActive) edgeMod = "active";

                const renderIcon = isDone ? (
                  <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                ) : (
                  <Icon className="h-4 w-4" aria-hidden="true" />
                );

                return (
                  <li
                    key={node.key}
                    className={`dag__cell dag__cell--${status}`}
                    style={{ ["--cell-index" as string]: i } as React.CSSProperties}
                  >
                    <span className="dag__cell-index" aria-hidden="true">
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    <div className="dag__node-wrap">
                      <span className={`dag__node dag__node--${status}`}>
                        <span className="dag__node-icon">{renderIcon}</span>
                      </span>
                      {isActive && <span className="dag__node-orbit" aria-hidden="true" />}
                      {isActive && <span className="dag__node-glow" aria-hidden="true" />}
                    </div>
                    {!isLast && (
                      <span className={`dag__edge dag__edge--${edgeMod}`} aria-hidden="true">
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
                    </div>
                  </li>
                );
              })}
            </ol>
          </div>
        </div>

        <div className="research-overlay__progress-wrap">
          <div
            className="research-overlay__progress-track"
            role="progressbar"
            aria-valuenow={progressPct}
            aria-valuemin={0}
            aria-valuemax={100}
          >
            <div
              className="research-overlay__progress-fill"
              style={{ width: `${progressPct}%` }}
            />
          </div>
          <div className="research-overlay__footnote">
            <span className="tabular-nums">{progressPct}%</span>
            <span className="research-overlay__hint">
              Please don&apos;t leave this page.
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
