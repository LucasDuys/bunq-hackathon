"use client";
import { useMemo } from "react";
import {
  CartesianGrid,
  Label,
  ReferenceArea,
  ReferenceLine,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
  ZAxis,
} from "recharts";
import type { Quadrant } from "@/lib/agent/impacts";
import { fmtEur } from "@/lib/utils";

export type MatrixPoint = {
  id: string;
  baselineLabel: string;
  altName: string;
  costDeltaEurYear: number;
  co2eDeltaKgYear: number;
  baselineAnnualCo2eKg: number;
  quadrant: Quadrant;
  feasibility: string;
  confidence: number;
};

const quadrantVar: Record<Quadrant, string> = {
  win_win: "var(--quadrant-win-win)",
  pay_to_decarbonize: "var(--quadrant-pay)",
  status_quo_trap: "var(--quadrant-trap)",
  avoid: "var(--quadrant-avoid)",
};

const quadrantTintVar: Record<Quadrant, string> = {
  win_win: "var(--quadrant-win-win-bg)",
  pay_to_decarbonize: "var(--quadrant-pay-bg)",
  status_quo_trap: "var(--quadrant-trap-bg)",
  avoid: "var(--quadrant-avoid-bg)",
};

const quadrantLabel: Record<Quadrant, string> = {
  win_win: "Win-win",
  pay_to_decarbonize: "Pay to decarbonize",
  status_quo_trap: "Status-quo trap",
  avoid: "Avoid",
};

const niceBound = (n: number, min: number) => {
  const v = Math.max(Math.abs(n), min);
  const mag = Math.pow(10, Math.floor(Math.log10(v)));
  const step = mag / 2;
  return Math.ceil(v / step) * step;
};

const fmtCompactEur = (v: number) => {
  const abs = Math.abs(v);
  const sign = v < 0 ? "−" : v > 0 ? "+" : "";
  if (abs >= 1000) return `${sign}€${(abs / 1000).toFixed(1)}k`;
  return `${sign}€${abs.toFixed(0)}`;
};

const fmtKgDelta = (kg: number) => {
  const abs = Math.abs(kg);
  const sign = kg < 0 ? "−" : kg > 0 ? "+" : "";
  if (abs >= 1000) return `${sign}${(abs / 1000).toFixed(2)} t`;
  return `${sign}${abs.toFixed(0)} kg`;
};

type TooltipPayload = { payload: MatrixPoint };

const MatrixTooltip = ({ active, payload }: { active?: boolean; payload?: TooltipPayload[] }) => {
  if (!active || !payload?.length) return null;
  const p = payload[0].payload;
  const good = "text-[var(--status-success)]";
  const bad = "text-[var(--status-danger)]";
  return (
    <div className="rounded-lg border border-[var(--border-default)] bg-[var(--bg-surface)] p-3 text-xs max-w-xs" style={{ boxShadow: "0 0 0 1px var(--border-default)" }}>
      <div className="font-medium text-[var(--fg-primary)] mb-0.5">{p.altName}</div>
      <div className="text-[var(--fg-muted)] mb-2">from {p.baselineLabel}</div>
      <div className="grid grid-cols-2 gap-x-3 gap-y-1 tabular-nums">
        <span className="text-[var(--fg-muted)]">Cost</span>
        <span className={p.costDeltaEurYear < 0 ? good : p.costDeltaEurYear > 0 ? bad : ""}>
          {fmtCompactEur(p.costDeltaEurYear)}/yr
        </span>
        <span className="text-[var(--fg-muted)]">CO₂e</span>
        <span className={p.co2eDeltaKgYear < 0 ? good : p.co2eDeltaKgYear > 0 ? bad : ""}>
          {fmtKgDelta(p.co2eDeltaKgYear)}/yr
        </span>
        <span className="text-[var(--fg-muted)]">Confidence</span>
        <span>{(p.confidence * 100).toFixed(0)}%</span>
        <span className="text-[var(--fg-muted)]">Feasibility</span>
        <span className="capitalize">{p.feasibility.replace(/_/g, " ")}</span>
      </div>
      <div
        className="mt-2 inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-medium"
        style={{
          backgroundColor: `color-mix(in srgb, ${quadrantVar[p.quadrant]} 15%, transparent)`,
          color: quadrantVar[p.quadrant],
        }}
      >
        <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: quadrantVar[p.quadrant] }} />
        {quadrantLabel[p.quadrant]}
      </div>
    </div>
  );
};

export const ImpactMatrix = ({ points }: { points: MatrixPoint[] }) => {
  const { xBound, yBound, byQuadrant } = useMemo(() => {
    const xMax = points.reduce((m, p) => Math.max(m, Math.abs(p.costDeltaEurYear)), 0);
    const yMax = points.reduce((m, p) => Math.max(m, Math.abs(p.co2eDeltaKgYear)), 0);
    const xB = niceBound(xMax, 100);
    const yB = niceBound(yMax, 50);
    const buckets: Record<Quadrant, MatrixPoint[]> = {
      win_win: [],
      pay_to_decarbonize: [],
      status_quo_trap: [],
      avoid: [],
    };
    for (const p of points) buckets[p.quadrant].push(p);
    return { xBound: xB, yBound: yB, byQuadrant: buckets };
  }, [points]);

  if (points.length === 0) {
    return (
      <div className="h-[420px] flex items-center justify-center text-sm text-[var(--fg-muted)]">
        No alternatives yet. Run impact research above.
      </div>
    );
  }

  return (
    <div className="h-[420px]" role="figure" aria-label="Cost versus CO₂e delta matrix for alternatives">
      <ResponsiveContainer width="100%" height="100%">
        <ScatterChart margin={{ top: 24, right: 32, bottom: 48, left: 56 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border-default)" />
          <ReferenceArea x1={-xBound} x2={0} y1={-yBound} y2={0} fill={quadrantTintVar.win_win} fillOpacity={1} stroke="none">
            <Label value="Win-win" position="insideBottomLeft" offset={12} fill={quadrantVar.win_win} fontSize={11} fontWeight={600} />
          </ReferenceArea>
          <ReferenceArea x1={0} x2={xBound} y1={-yBound} y2={0} fill={quadrantTintVar.pay_to_decarbonize} fillOpacity={1} stroke="none">
            <Label value="Pay to decarbonize" position="insideBottomRight" offset={12} fill={quadrantVar.pay_to_decarbonize} fontSize={11} fontWeight={600} />
          </ReferenceArea>
          <ReferenceArea x1={-xBound} x2={0} y1={0} y2={yBound} fill={quadrantTintVar.status_quo_trap} fillOpacity={1} stroke="none">
            <Label value="Status-quo trap" position="insideTopLeft" offset={12} fill={quadrantVar.status_quo_trap} fontSize={11} fontWeight={600} />
          </ReferenceArea>
          <ReferenceArea x1={0} x2={xBound} y1={0} y2={yBound} fill={quadrantTintVar.avoid} fillOpacity={1} stroke="none">
            <Label value="Avoid" position="insideTopRight" offset={12} fill={quadrantVar.avoid} fontSize={11} fontWeight={600} />
          </ReferenceArea>
          <ReferenceLine x={0} stroke="var(--border-strong)" strokeWidth={1} />
          <ReferenceLine y={0} stroke="var(--border-strong)" strokeWidth={1} />
          <XAxis
            type="number"
            dataKey="costDeltaEurYear"
            name="Δ cost"
            domain={[-xBound, xBound]}
            tickFormatter={fmtCompactEur}
            stroke="var(--fg-muted)"
            fontSize={11}
            tickLine={false}
          >
            <Label value="Δ cost per year (← cheaper  ·  more expensive →)" position="bottom" offset={20} fill="var(--fg-muted)" fontSize={11} />
          </XAxis>
          <YAxis
            type="number"
            dataKey="co2eDeltaKgYear"
            name="Δ CO₂e"
            domain={[-yBound, yBound]}
            tickFormatter={fmtKgDelta}
            stroke="var(--fg-muted)"
            fontSize={11}
            tickLine={false}
          >
            <Label value="Δ CO₂e per year" angle={-90} position="left" offset={30} fill="var(--fg-muted)" fontSize={11} />
          </YAxis>
          <ZAxis type="number" dataKey="baselineAnnualCo2eKg" range={[60, 360]} name="Baseline CO₂e" />
          <Tooltip content={<MatrixTooltip />} cursor={{ strokeDasharray: "3 3", stroke: "var(--border-strong)" }} />
          {(Object.keys(byQuadrant) as Quadrant[]).map((q) => (
            <Scatter
              key={q}
              data={byQuadrant[q]}
              fill={quadrantVar[q]}
              fillOpacity={0.85}
              stroke={quadrantVar[q]}
              strokeWidth={1.5}
              isAnimationActive={false}
            />
          ))}
        </ScatterChart>
      </ResponsiveContainer>
      <div className="sr-only">
        <table>
          <caption>Alternatives by cost and CO₂e delta</caption>
          <thead>
            <tr>
              <th>Alternative</th>
              <th>From</th>
              <th>Δ cost €/yr</th>
              <th>Δ CO₂e kg/yr</th>
              <th>Quadrant</th>
            </tr>
          </thead>
          <tbody>
            {points.map((p) => (
              <tr key={p.id}>
                <td>{p.altName}</td>
                <td>{p.baselineLabel}</td>
                <td>{fmtEur(p.costDeltaEurYear, 0)}</td>
                <td>{p.co2eDeltaKgYear.toFixed(1)}</td>
                <td>{quadrantLabel[p.quadrant]}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
