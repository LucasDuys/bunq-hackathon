"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { ConfidenceBar, CodeLabel } from "@/components/ui";
import type { ClusterWithQuestion } from "@/lib/queries";
import { fmtEur, fmtKg } from "@/lib/utils";

type Variant = "compact" | "full";

type Props = {
  clusters: ClusterWithQuestion[];
  variant?: Variant;
  title?: string;
  eyebrow?: string;
};

const CATEGORY_TOKEN: Record<string, string> = {
  fuel: "var(--cat-fuel)",
  electricity: "var(--cat-electricity)",
  goods: "var(--cat-goods)",
  procurement: "var(--cat-goods)",
  food: "var(--cat-goods)",
  travel: "var(--cat-travel)",
  logistics: "var(--cat-travel)",
  transport: "var(--cat-travel)",
  digital: "var(--cat-digital)",
  saas: "var(--cat-digital)",
  cloud: "var(--cat-digital)",
  software: "var(--cat-digital)",
  services: "var(--cat-services)",
  professional: "var(--cat-services)",
};

const catToken = (cat: string | null | undefined): string => {
  if (!cat) return "var(--cat-other)";
  const c = cat.toLowerCase();
  for (const key of Object.keys(CATEGORY_TOKEN)) {
    if (c.includes(key)) return CATEGORY_TOKEN[key];
  }
  return "var(--cat-other)";
};

const catLabel = (cat: string | null | undefined): string =>
  (cat ?? "other").replace(/_/g, " ").toLowerCase();

export const ClusterConstellation = ({
  clusters,
  variant = "full",
  title,
  eyebrow,
}: Props) => {
  const uid = useId();
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const [w, setW] = useState(800);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const on = () => setReducedMotion(mq.matches);
    on();
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);

  useEffect(() => {
    if (!wrapRef.current) return;
    const ro = new ResizeObserver((entries) => {
      const cr = entries[0]?.contentRect;
      if (cr) setW(Math.max(320, Math.round(cr.width)));
    });
    ro.observe(wrapRef.current);
    return () => ro.disconnect();
  }, []);

  const h = variant === "compact" ? 260 : 360;
  const padL = 56;
  const padR = 16;
  const padT = 20;
  const padB = variant === "compact" ? 36 : 44;
  const innerW = Math.max(40, w - padL - padR);
  const innerH = h - padT - padB;

  // Filter out zero-value clusters; keep one floor so log scale behaves.
  const visible = useMemo(
    () => clusters.filter((c) => c.totalSpendEur > 0),
    [clusters],
  );

  const { xMin, xMax, yMax, rMax } = useMemo(() => {
    if (visible.length === 0)
      return { xMin: 50, xMax: 1000, yMax: 0.6, rMax: 1 };
    const spends = visible.map((c) => c.totalSpendEur);
    const co2 = visible.map((c) => c.co2eKgPoint);
    const uncertainties = visible.map((c) =>
      Math.max(0, 1 - c.avgClassifierConfidence),
    );
    return {
      xMin: Math.max(10, Math.min(...spends) * 0.8),
      xMax: Math.max(1000, Math.max(...spends) * 1.1),
      yMax: Math.min(1, Math.max(0.3, Math.max(...uncertainties) * 1.15)),
      rMax: Math.max(1, Math.max(...co2)),
    };
  }, [visible]);

  const xScale = (v: number): number => {
    const lv = Math.log10(Math.max(xMin, v));
    const lMin = Math.log10(xMin);
    const lMax = Math.log10(xMax);
    return padL + ((lv - lMin) / (lMax - lMin)) * innerW;
  };
  const yScale = (v: number): number => {
    const clamped = Math.max(0, Math.min(yMax, v));
    return padT + (1 - clamped / yMax) * innerH;
  };
  const rScale = (co2: number): number => {
    const minR = 3.5;
    const maxR = variant === "compact" ? 14 : 20;
    const norm = rMax > 0 ? Math.sqrt(co2) / Math.sqrt(rMax) : 0;
    return minR + norm * (maxR - minR);
  };

  // Format € nicely for axis ticks
  const fmtTickEur = (v: number): string => {
    if (v >= 1000) return `€${(v / 1000).toFixed(v >= 10000 ? 0 : 1)}k`;
    return `€${Math.round(v)}`;
  };

  // Generate log x ticks (1, 3 per decade).
  const xTicks = useMemo(() => {
    const ticks: number[] = [];
    const lMin = Math.floor(Math.log10(xMin));
    const lMax = Math.ceil(Math.log10(xMax));
    for (let d = lMin; d <= lMax; d++) {
      ticks.push(Math.pow(10, d));
      if (d < lMax) ticks.push(3 * Math.pow(10, d));
    }
    return ticks.filter((t) => t >= xMin * 0.95 && t <= xMax * 1.05);
  }, [xMin, xMax]);

  const yTicks = useMemo(() => {
    const step = yMax > 0.5 ? 0.2 : 0.1;
    const out: number[] = [];
    for (let v = 0; v <= yMax + 0.0001; v += step) out.push(Number(v.toFixed(2)));
    return out;
  }, [yMax]);

  const active = visible.find((c) => c.id === activeId) ?? null;

  const materialX = xScale(300);
  const mediumY = yScale(1 - 0.85); // high confidence threshold
  const lowY = yScale(1 - 0.6); // medium threshold

  const flaggedCount = visible.filter((c) => c.flagged).length;
  const answeredCount = visible.filter((c) => c.answered).length;

  // Constellation edges — connect flagged clusters within the same category.
  const edges = useMemo(() => {
    const flagged = visible.filter((c) => c.flagged);
    const byCat = new Map<string, typeof flagged>();
    for (const c of flagged) {
      const key = (c.likelyCategory ?? "other").toLowerCase();
      if (!byCat.has(key)) byCat.set(key, []);
      byCat.get(key)!.push(c);
    }
    const out: Array<{ a: string; b: string; cat: string }> = [];
    for (const [cat, group] of byCat) {
      if (group.length < 2) continue;
      // connect sequentially sorted by spend
      const sorted = [...group].sort((a, b) => a.totalSpendEur - b.totalSpendEur);
      for (let i = 0; i < sorted.length - 1; i++) {
        out.push({ a: sorted[i].id, b: sorted[i + 1].id, cat });
      }
    }
    return out;
  }, [visible]);

  const byId = useMemo(
    () => new Map(visible.map((c) => [c.id, c])),
    [visible],
  );

  // Legend — unique categories present
  const legend = useMemo(() => {
    const set = new Map<string, string>();
    for (const c of visible) {
      const label = catLabel(c.likelyCategory);
      if (!set.has(label)) set.set(label, catToken(c.likelyCategory));
    }
    return Array.from(set.entries()).slice(0, 7);
  }, [visible]);

  if (visible.length === 0) {
    return (
      <div
        className="ca-card"
        style={{
          padding: 24,
          minHeight: variant === "compact" ? 180 : 240,
          display: "grid",
          placeItems: "center",
          color: "var(--fg-muted)",
        }}
      >
        <div className="text-center">
          <CodeLabel>Cluster map</CodeLabel>
          <p className="mt-2 text-[13px]">No merchants yet. Run a close to populate.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="ca-card" style={{ padding: variant === "compact" ? 20 : 24 }}>
      {/* Header */}
      <div className="flex items-start justify-between gap-4 mb-4">
        <div>
          {eyebrow && <CodeLabel className="block mb-2">{eyebrow}</CodeLabel>}
          <h3
            className="text-[17px] font-normal leading-[1.33] m-0"
            style={{ color: "var(--fg-primary)", letterSpacing: "-0.16px" }}
          >
            {title ?? "Where the agent is uncertain"}
          </h3>
          {variant === "full" && (
            <p
              className="text-[13px] mt-1.5 max-w-[56ch]"
              style={{ color: "var(--fg-secondary)" }}
            >
              Each dot is a merchant. Higher = the agent is less sure. Further right = more
              material spend. Flagged dots are the ones worth asking about.
            </p>
          )}
        </div>
        <div className="flex items-center gap-4 shrink-0 tabular-nums">
          <div className="text-right">
            <CodeLabel className="block">Merchants</CodeLabel>
            <div
              className="text-[18px] leading-none mt-1"
              style={{ color: "var(--fg-primary)" }}
            >
              {visible.length}
            </div>
          </div>
          <div className="text-right">
            <CodeLabel className="block">Flagged</CodeLabel>
            <div
              className="text-[18px] leading-none mt-1"
              style={{ color: flaggedCount > 0 ? "var(--status-warning)" : "var(--fg-primary)" }}
            >
              {flaggedCount}
            </div>
          </div>
          {variant === "full" && (
            <div className="text-right">
              <CodeLabel className="block">Answered</CodeLabel>
              <div
                className="text-[18px] leading-none mt-1"
                style={{ color: answeredCount > 0 ? "var(--brand-green)" : "var(--fg-primary)" }}
              >
                {answeredCount}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* SVG */}
      <div ref={wrapRef} className="relative w-full" style={{ height: h }}>
        <svg
          width={w}
          height={h}
          viewBox={`0 0 ${w} ${h}`}
          role="img"
          aria-label="Cluster constellation — merchants by spend and uncertainty"
          style={{ display: "block" }}
        >
          <defs>
            <radialGradient id={`${uid}-risk`} cx="100%" cy="0%" r="85%">
              <stop offset="0%" stopColor="var(--status-warning)" stopOpacity="0.08" />
              <stop offset="60%" stopColor="var(--status-warning)" stopOpacity="0.02" />
              <stop offset="100%" stopColor="var(--status-warning)" stopOpacity="0" />
            </radialGradient>
          </defs>

          {/* Risk zone (top-right: material spend × high uncertainty) */}
          <rect
            x={materialX}
            y={padT}
            width={Math.max(0, padL + innerW - materialX)}
            height={Math.max(0, mediumY - padT)}
            fill={`url(#${uid}-risk)`}
          />

          {/* Grid */}
          {yTicks.map((t) => (
            <line
              key={`gy-${t}`}
              x1={padL}
              x2={padL + innerW}
              y1={yScale(t)}
              y2={yScale(t)}
              stroke="var(--border-faint)"
              strokeDasharray="3 3"
            />
          ))}
          {xTicks.map((t) => (
            <line
              key={`gx-${t}`}
              y1={padT}
              y2={padT + innerH}
              x1={xScale(t)}
              x2={xScale(t)}
              stroke="var(--border-faint)"
              strokeDasharray="3 3"
            />
          ))}

          {/* Threshold guides */}
          <line
            x1={materialX}
            x2={materialX}
            y1={padT}
            y2={padT + innerH}
            stroke="var(--border-strong)"
            strokeDasharray="4 4"
          />
          <text
            x={materialX + 6}
            y={padT + 12}
            fontSize={10}
            fontFamily="var(--font-mono)"
            style={{ textTransform: "uppercase", letterSpacing: "1.2px" }}
            fill="var(--fg-muted)"
          >
            Material · €300
          </text>

          <line
            x1={padL}
            x2={padL + innerW}
            y1={mediumY}
            y2={mediumY}
            stroke="var(--confidence-high)"
            strokeOpacity="0.35"
            strokeDasharray="2 4"
          />
          <line
            x1={padL}
            x2={padL + innerW}
            y1={lowY}
            y2={lowY}
            stroke="var(--confidence-medium)"
            strokeOpacity="0.35"
            strokeDasharray="2 4"
          />

          {/* Axes */}
          <line
            x1={padL}
            x2={padL + innerW}
            y1={padT + innerH}
            y2={padT + innerH}
            stroke="var(--border-default)"
          />
          <line
            x1={padL}
            x2={padL}
            y1={padT}
            y2={padT + innerH}
            stroke="var(--border-default)"
          />

          {/* Y ticks */}
          {yTicks.map((t) => (
            <text
              key={`yl-${t}`}
              x={padL - 8}
              y={yScale(t) + 3}
              textAnchor="end"
              fontSize={10}
              fontFamily="var(--font-mono)"
              fill="var(--fg-muted)"
              style={{ letterSpacing: "1.2px", textTransform: "uppercase" }}
            >
              {Math.round(t * 100)}%
            </text>
          ))}

          {/* X ticks */}
          {xTicks.map((t) => (
            <text
              key={`xl-${t}`}
              x={xScale(t)}
              y={padT + innerH + 16}
              textAnchor="middle"
              fontSize={10}
              fontFamily="var(--font-mono)"
              fill="var(--fg-muted)"
              style={{ letterSpacing: "1.2px", textTransform: "uppercase" }}
            >
              {fmtTickEur(t)}
            </text>
          ))}

          {/* Axis titles */}
          <text
            x={padL}
            y={padT - 6}
            fontSize={10}
            fontFamily="var(--font-mono)"
            fill="var(--fg-muted)"
            style={{ letterSpacing: "1.2px", textTransform: "uppercase" }}
          >
            Uncertainty →
          </text>
          {variant === "full" && (
            <text
              x={padL + innerW}
              y={padT + innerH + 32}
              textAnchor="end"
              fontSize={10}
              fontFamily="var(--font-mono)"
              fill="var(--fg-muted)"
              style={{ letterSpacing: "1.2px", textTransform: "uppercase" }}
            >
              Spend per merchant → (log scale)
            </text>
          )}

          {/* Constellation edges — behind points */}
          {edges.map((e, i) => {
            const a = byId.get(e.a);
            const b = byId.get(e.b);
            if (!a || !b) return null;
            const color = catToken(a.likelyCategory);
            return (
              <line
                key={`edge-${i}`}
                x1={xScale(a.totalSpendEur)}
                y1={yScale(1 - a.avgClassifierConfidence)}
                x2={xScale(b.totalSpendEur)}
                y2={yScale(1 - b.avgClassifierConfidence)}
                stroke={color}
                strokeOpacity="0.25"
                strokeDasharray="2 3"
              />
            );
          })}

          {/* Points */}
          {visible.map((c, idx) => {
            const cx = xScale(c.totalSpendEur);
            const cy = yScale(1 - c.avgClassifierConfidence);
            const r = rScale(c.co2eKgPoint);
            const color = catToken(c.likelyCategory);
            const isActive = activeId === c.id;
            const delay = reducedMotion ? 0 : idx * 30;

            return (
              <g
                key={c.id}
                style={{
                  opacity: reducedMotion ? 1 : 0,
                  animation: reducedMotion
                    ? undefined
                    : `cc-fade-in 500ms ease-out ${delay}ms forwards`,
                  cursor: "pointer",
                }}
                onMouseEnter={() => setActiveId(c.id)}
                onMouseLeave={() => setActiveId((id) => (id === c.id ? null : id))}
                onFocus={() => setActiveId(c.id)}
                onBlur={() => setActiveId((id) => (id === c.id ? null : id))}
                tabIndex={0}
                aria-label={`${c.merchantLabel}, ${Math.round((1 - c.avgClassifierConfidence) * 100)}% uncertainty, ${fmtEur(c.totalSpendEur, 0)}, ${fmtKg(c.co2eKgPoint)}`}
              >
                {/* flagged pulse ring */}
                {c.flagged && !reducedMotion && (
                  <circle
                    cx={cx}
                    cy={cy}
                    r={r + 4}
                    fill="none"
                    stroke={color}
                    strokeOpacity="0.5"
                    style={{
                      animation: "cc-pulse 2.2s ease-out infinite",
                      transformOrigin: `${cx}px ${cy}px`,
                    }}
                  />
                )}

                {/* answered checkmark halo */}
                {c.answered && (
                  <circle
                    cx={cx}
                    cy={cy}
                    r={r + 2.5}
                    fill="none"
                    stroke="var(--brand-green)"
                    strokeOpacity="0.7"
                    strokeWidth={1}
                  />
                )}

                {/* main dot */}
                <circle
                  cx={cx}
                  cy={cy}
                  r={r}
                  fill={color}
                  fillOpacity={c.flagged ? 0.22 : 0.12}
                  stroke={color}
                  strokeOpacity={c.flagged ? 0.95 : 0.45}
                  strokeWidth={c.flagged ? 1.5 : 1}
                />

                {/* active outer ring */}
                {isActive && (
                  <circle
                    cx={cx}
                    cy={cy}
                    r={r + 6}
                    fill="none"
                    stroke="var(--fg-primary)"
                    strokeOpacity="0.9"
                    strokeWidth={1}
                  />
                )}

                {/* flagged label */}
                {c.flagged && variant === "full" && (
                  <text
                    x={cx + r + 6}
                    y={cy + 3}
                    fontSize={11}
                    fontFamily="var(--font-sans)"
                    fill="var(--fg-secondary)"
                  >
                    {c.merchantLabel.length > 18
                      ? c.merchantLabel.slice(0, 17) + "…"
                      : c.merchantLabel}
                  </text>
                )}
              </g>
            );
          })}
        </svg>

        {/* Tooltip */}
        {active && (
          <ClusterTooltip
            cluster={active}
            x={xScale(active.totalSpendEur)}
            y={yScale(1 - active.avgClassifierConfidence)}
            boundsW={w}
            boundsH={h}
          />
        )}
      </div>

      {/* Legend */}
      {legend.length > 0 && (
        <div
          className="mt-4 pt-4 flex flex-wrap items-center gap-x-5 gap-y-2"
          style={{ borderTop: "1px solid var(--border-faint)" }}
        >
          {legend.map(([label, color]) => (
            <span key={label} className="flex items-center gap-2">
              <span
                className="w-[6px] h-[6px] rounded-full"
                style={{ background: color }}
              />
              <span
                className="text-[12px] capitalize"
                style={{ color: "var(--fg-secondary)" }}
              >
                {label}
              </span>
            </span>
          ))}
          <span className="flex items-center gap-2 ml-auto">
            <span
              className="w-[10px] h-[10px] rounded-full"
              style={{
                border: "1.5px solid var(--status-warning)",
                background: "transparent",
              }}
            />
            <span className="text-[12px]" style={{ color: "var(--fg-muted)" }}>
              flagged by agent
            </span>
          </span>
          <span className="flex items-center gap-2">
            <span
              className="w-[10px] h-[10px] rounded-full"
              style={{
                border: "1px solid var(--brand-green)",
                background: "transparent",
              }}
            />
            <span className="text-[12px]" style={{ color: "var(--fg-muted)" }}>
              answered
            </span>
          </span>
        </div>
      )}

      <style jsx>{`
        @keyframes cc-fade-in {
          to {
            opacity: 1;
          }
        }
        @keyframes cc-pulse {
          0% {
            transform: scale(0.92);
            opacity: 0.55;
          }
          80% {
            transform: scale(1.18);
            opacity: 0;
          }
          100% {
            transform: scale(1.18);
            opacity: 0;
          }
        }
      `}</style>
    </div>
  );
};

const ClusterTooltip = ({
  cluster,
  x,
  y,
  boundsW,
  boundsH,
}: {
  cluster: ClusterWithQuestion;
  x: number;
  y: number;
  boundsW: number;
  boundsH: number;
}) => {
  const W = 280;
  const flipX = x + W + 16 > boundsW;
  const left = flipX ? Math.max(8, x - W - 12) : Math.min(boundsW - W - 8, x + 12);
  const top = Math.min(Math.max(8, y - 40), boundsH - 180);
  const color = catToken(cluster.likelyCategory);

  return (
    <div
      role="tooltip"
      className="absolute pointer-events-none"
      style={{
        left,
        top,
        width: W,
        background: "var(--bg-canvas)",
        border: "1px solid var(--border-strong)",
        borderRadius: 12,
        padding: "12px 14px",
        boxShadow: "rgba(0,0,0,0.20) 0 4px 18px",
        zIndex: 5,
      }}
    >
      <div className="flex items-center gap-2 mb-2">
        <span
          className="w-[6px] h-[6px] rounded-full shrink-0"
          style={{ background: color }}
        />
        <CodeLabel className="truncate" style={{ letterSpacing: "1.2px" }}>
          {catLabel(cluster.likelyCategory)}
          {cluster.likelySubCategory ? ` · ${cluster.likelySubCategory}` : ""}
        </CodeLabel>
      </div>
      <div
        className="text-[14px] mb-2 truncate"
        style={{ color: "var(--fg-primary)", letterSpacing: "-0.16px" }}
        title={cluster.merchantLabel}
      >
        {cluster.merchantLabel}
      </div>

      <div className="grid grid-cols-2 gap-x-3 gap-y-2 mb-2.5">
        <div>
          <CodeLabel>Spend</CodeLabel>
          <div
            className="text-[13px] tabular-nums mt-0.5"
            style={{ color: "var(--fg-primary)" }}
          >
            {fmtEur(cluster.totalSpendEur, 0)}
          </div>
        </div>
        <div>
          <CodeLabel>Tx</CodeLabel>
          <div
            className="text-[13px] tabular-nums mt-0.5"
            style={{ color: "var(--fg-primary)" }}
          >
            {cluster.txCount}
          </div>
        </div>
        <div>
          <CodeLabel>CO₂e</CodeLabel>
          <div
            className="text-[13px] tabular-nums mt-0.5"
            style={{ color: "var(--fg-primary)" }}
          >
            {fmtKg(cluster.co2eKgPoint)}
          </div>
        </div>
        <div>
          <CodeLabel>Range</CodeLabel>
          <div
            className="text-[13px] tabular-nums mt-0.5"
            style={{ color: "var(--fg-secondary)" }}
          >
            ±{fmtKg((cluster.co2eKgHigh - cluster.co2eKgLow) / 2)}
          </div>
        </div>
      </div>

      <ConfidenceBar value={cluster.avgClassifierConfidence} />

      {cluster.question && (
        <div
          className="mt-3 pt-3"
          style={{ borderTop: "1px solid var(--border-faint)" }}
        >
          <CodeLabel className="block mb-1.5">
            {cluster.answered ? "Answered" : "Agent asks"}
          </CodeLabel>
          <div
            className="text-[12px] leading-[1.4]"
            style={{ color: "var(--fg-secondary)" }}
          >
            {cluster.question}
          </div>
          {cluster.answer && (
            <div
              className="mt-1.5 text-[12px]"
              style={{ color: "var(--brand-green)" }}
            >
              → {cluster.answer}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
