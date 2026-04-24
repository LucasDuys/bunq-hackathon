"use client";
import { useMemo, useState } from "react";
import { Card, CardBody, CardHeader, CardTitle, ConfidenceBar, Stat } from "@/components/ui";
import { fmtEur, fmtKg } from "@/lib/utils";

export type PlannableAlternative = {
  id: string;
  baselineKey: string;
  baselineLabel: string;
  name: string;
  category: string;
  costDeltaEurYear: number;
  co2eDeltaKgYear: number;
  confidence: number;
  quadrant: "win_win" | "pay_to_decarbonize" | "status_quo_trap" | "avoid";
  sourceCount: number;
};

// Plans/matrix-research.md §14.2 — scenario slider. "If we adopt the top N switches,
// projected savings = €X, projected CO2e reduction = Y tonnes." Drives the exec KPIs.
// Pure client component; state is local and URL-less (keeps the page cache-friendly).
//
// Strategy: take one best switch per baselineKey (not N alts for the same cluster),
// ranked by a composite score. Let the user dial how many clusters to "adopt".
const scoreAlt = (a: PlannableAlternative): number => {
  // Bigger emissions reduction + negative cost both count.
  const co2ePart = Math.max(0, -a.co2eDeltaKgYear) / 100; // per 100 kg
  const costPart = Math.max(0, -a.costDeltaEurYear) / 1000; // per €1k
  return co2ePart + costPart + a.confidence;
};

const bestPerCluster = (all: PlannableAlternative[]): PlannableAlternative[] => {
  const byCluster = new Map<string, PlannableAlternative>();
  for (const a of all) {
    const existing = byCluster.get(a.baselineKey);
    if (!existing || scoreAlt(a) > scoreAlt(existing)) byCluster.set(a.baselineKey, a);
  }
  return [...byCluster.values()].sort((a, b) => scoreAlt(b) - scoreAlt(a));
};

const signedEur = (v: number) => `${v < 0 ? "−" : v > 0 ? "+" : ""}${fmtEur(Math.abs(v), 0)}`;
const signedKg = (v: number) => {
  const abs = Math.abs(v);
  const sign = v < 0 ? "−" : v > 0 ? "+" : "";
  return abs >= 1000 ? `${sign}${(abs / 1000).toFixed(2)} tCO₂e` : `${sign}${abs.toFixed(0)} kgCO₂e`;
};

export const ScenarioPlanner = ({ alternatives }: { alternatives: PlannableAlternative[] }) => {
  const ranked = useMemo(() => bestPerCluster(alternatives), [alternatives]);
  const [n, setN] = useState(Math.min(5, ranked.length));

  if (ranked.length === 0) return null;

  const adopted = ranked.slice(0, n);
  const totals = adopted.reduce(
    (acc, a) => {
      acc.costEur += a.costDeltaEurYear;
      acc.co2eKg += a.co2eDeltaKgYear;
      acc.conf += a.confidence;
      if (a.sourceCount > 0) acc.withEvidence += 1;
      return acc;
    },
    { costEur: 0, co2eKg: 0, conf: 0, withEvidence: 0 },
  );
  const avgConf = adopted.length > 0 ? totals.conf / adopted.length : 0;
  const sliderId = "scenario-n";

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle>Scenario planner</CardTitle>
            <p className="text-xs text-[var(--fg-muted)] mt-1">
              If we adopt the top N switches (one per merchant), here is the projected annual impact.
            </p>
          </div>
        </div>
      </CardHeader>
      <CardBody className="space-y-5">
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <label htmlFor={sliderId} className="text-[11px] uppercase tracking-wide text-[var(--fg-muted)]">
              Switches adopted
            </label>
            <span className="text-sm font-semibold tabular-nums">
              {n}
              <span className="text-[var(--fg-muted)] font-normal"> / {ranked.length}</span>
            </span>
          </div>
          <input
            id={sliderId}
            type="range"
            min={0}
            max={ranked.length}
            value={n}
            onChange={(e) => setN(Number(e.target.value))}
            className="w-full accent-[var(--brand-forest-600)] dark:accent-[var(--brand-mint-500)]"
            aria-valuemin={0}
            aria-valuemax={ranked.length}
            aria-valuenow={n}
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Stat
            label="Projected Δ cost / yr"
            value={signedEur(totals.costEur)}
            sub={totals.costEur < 0 ? "net saving" : totals.costEur > 0 ? "net investment" : "neutral"}
            tone={totals.costEur < 0 ? "positive" : totals.costEur > 0 ? "warning" : "default"}
          />
          <div className="flex flex-col gap-1">
            <div className="text-[11px] uppercase tracking-wide text-[var(--fg-muted)]">Projected Δ CO₂e / yr</div>
            <div className="text-2xl font-semibold tabular-nums">
              {totals.co2eKg !== 0 ? signedKg(totals.co2eKg) : "—"}
            </div>
            <ConfidenceBar value={avgConf} />
          </div>
          <Stat
            label="Evidence coverage"
            value={`${totals.withEvidence}/${adopted.length}`}
            sub={
              totals.withEvidence === adopted.length
                ? "every switch has ≥1 source"
                : `${adopted.length - totals.withEvidence} switch${adopted.length - totals.withEvidence === 1 ? "" : "es"} without sources`
            }
            tone={totals.withEvidence === adopted.length ? "positive" : "warning"}
          />
        </div>

        {adopted.length > 0 && (
          <ul className="space-y-1.5 text-sm">
            {adopted.map((a, i) => (
              <li
                key={a.id}
                className="flex items-center justify-between gap-3 rounded-md border border-[var(--border-default)] px-3 py-2 tabular-nums"
              >
                <div className="min-w-0 flex items-center gap-2">
                  <span className="text-[10px] text-[var(--fg-muted)] font-mono w-5 text-right">#{i + 1}</span>
                  <span className="truncate">
                    <span className="font-medium text-[var(--fg-primary)]">{a.name}</span>
                    <span className="text-[var(--fg-muted)]"> — {a.baselineLabel}</span>
                  </span>
                </div>
                <div className="flex items-center gap-4 shrink-0 text-xs">
                  <span className={a.costDeltaEurYear < 0 ? "text-[var(--status-success)]" : a.costDeltaEurYear > 0 ? "text-[var(--status-danger)]" : "text-[var(--fg-muted)]"}>
                    {signedEur(a.costDeltaEurYear)}
                  </span>
                  <span className={a.co2eDeltaKgYear < 0 ? "text-[var(--status-success)]" : a.co2eDeltaKgYear > 0 ? "text-[var(--status-danger)]" : "text-[var(--fg-muted)]"}>
                    {signedKg(a.co2eDeltaKgYear)}
                  </span>
                  <span className="text-[var(--fg-muted)] min-w-[44px] text-right">
                    {a.sourceCount > 0 ? `${a.sourceCount} src` : "no src"}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardBody>
    </Card>
  );
};
