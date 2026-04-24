import { ArrowRight, ExternalLink, Info, Target } from "lucide-react";
import type { Quadrant } from "@/lib/agent/impacts";
import { Badge, Card, CardBody, CardHeader, CardTitle, ConfidenceBar, Stat } from "@/components/ui";
import { ImpactMatrix, type MatrixPoint } from "@/components/ImpactMatrix";
import { RunImpactResearch } from "@/components/RunImpactResearch";
import { getLatestDagResult, getLatestRecommendations } from "@/lib/impacts/store";
import type { DagRunResult } from "@/lib/agents/dag/types";
import { DEFAULT_ORG_ID } from "@/lib/queries";
import { fmtEur, fmtKg } from "@/lib/utils";

export const dynamic = "force-dynamic";

type RecRow = Awaited<ReturnType<typeof getLatestRecommendations>>[number];

type Baseline = {
  key: string;
  merchantLabel: string;
  category: string;
  subCategory: string | null;
  annualSpendEur: number;
  annualCo2eKg: number;
  confidence: number;
  alternatives: Alt[];
};

type Alt = {
  id: string;
  name: string;
  description: string;
  type: string;
  costDeltaEurYear: number;
  co2eDeltaKgYear: number;
  costDeltaPct: number;
  co2eDeltaPct: number;
  confidence: number;
  feasibility: string;
  rationale: string;
  sources: Array<{ title: string; url: string }>;
  quadrant: Quadrant;
};

const parseSources = (raw: string): Array<{ title: string; url: string }> => {
  try {
    const v = JSON.parse(raw);
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
};

const quadrantOrder: Quadrant[] = ["win_win", "pay_to_decarbonize", "status_quo_trap", "avoid"];

const quadrantLabel: Record<Quadrant, string> = {
  win_win: "Win-win",
  pay_to_decarbonize: "Pay to decarbonize",
  status_quo_trap: "Status-quo trap",
  avoid: "Avoid",
};

// Token-backed quadrant accents so dark/light parity matches DESIGN.md semantics.
const quadrantAccent: Record<Quadrant, { border: string; text: string; dot: string }> = {
  win_win: {
    border: "border-l-[var(--quadrant-win-win)]",
    text: "text-[var(--quadrant-win-win)]",
    dot: "bg-[var(--quadrant-win-win)]",
  },
  pay_to_decarbonize: {
    border: "border-l-[var(--quadrant-pay)]",
    text: "text-[var(--quadrant-pay)]",
    dot: "bg-[var(--quadrant-pay)]",
  },
  status_quo_trap: {
    border: "border-l-[var(--quadrant-trap)]",
    text: "text-[var(--fg-muted)]",
    dot: "bg-[var(--quadrant-trap)]",
  },
  avoid: {
    border: "border-l-[var(--quadrant-avoid)]",
    text: "text-[var(--quadrant-avoid)]",
    dot: "bg-[var(--quadrant-avoid)]",
  },
};

const categoryBadge: Record<string, string> = {
  cloud: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300",
  travel: "bg-violet-100 text-violet-800 dark:bg-violet-950/60 dark:text-violet-300",
  utilities: "bg-sky-100 text-sky-800 dark:bg-sky-950/60 dark:text-sky-300",
  food: "bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300",
  procurement: "bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300",
};

const feasibilityLabel: Record<string, string> = {
  drop_in: "Drop-in",
  migration: "Migration",
  procurement: "Procurement",
};

const signedEur = (v: number) => `${v < 0 ? "−" : v > 0 ? "+" : ""}${fmtEur(Math.abs(v), 0)}`;

const signedKg = (v: number) => {
  const abs = Math.abs(v);
  const sign = v < 0 ? "−" : v > 0 ? "+" : "";
  return abs >= 1000 ? `${sign}${(abs / 1000).toFixed(2)} tCO₂e` : `${sign}${abs.toFixed(0)} kgCO₂e`;
};

const groupByBaseline = (rows: RecRow[]): Baseline[] => {
  const m = new Map<string, Baseline>();
  for (const r of rows) {
    let b = m.get(r.baselineKey);
    if (!b) {
      b = {
        key: r.baselineKey,
        merchantLabel: r.baselineMerchantLabel,
        category: r.baselineCategory,
        subCategory: r.baselineSubCategory ?? null,
        annualSpendEur: r.baselineAnnualSpendEur,
        annualCo2eKg: r.baselineAnnualCo2eKg,
        confidence: r.baselineConfidence,
        alternatives: [],
      };
      m.set(r.baselineKey, b);
    }
    b.alternatives.push({
      id: r.id,
      name: r.altName,
      description: r.altDescription,
      type: r.altType,
      costDeltaEurYear: r.altCostDeltaEurYear,
      co2eDeltaKgYear: r.altCo2eDeltaKgYear,
      costDeltaPct: r.altCostDeltaPct,
      co2eDeltaPct: r.altCo2eDeltaPct,
      confidence: r.altConfidence,
      feasibility: r.altFeasibility,
      rationale: r.altRationale,
      sources: parseSources(r.altSources),
      quadrant: r.quadrant as Quadrant,
    });
  }
  return [...m.values()].sort((a, b) => b.annualCo2eKg - a.annualCo2eKg);
};

const computeHeadline = (baselines: Baseline[]) => {
  let totalCo2 = 0;
  let totalSpend = 0;
  let confSum = 0;
  let winWinCo2 = 0;
  let winWinEur = 0;
  let winWinCount = 0;
  let payCo2 = 0;
  let payEur = 0;
  let payCount = 0;
  for (const b of baselines) {
    totalCo2 += b.annualCo2eKg;
    totalSpend += b.annualSpendEur;
    confSum += b.confidence * b.annualCo2eKg;
    const bestWin = b.alternatives
      .filter((a) => a.quadrant === "win_win")
      .sort((x, y) => x.co2eDeltaKgYear - y.co2eDeltaKgYear)[0];
    if (bestWin) {
      winWinCo2 += bestWin.co2eDeltaKgYear;
      winWinEur += bestWin.costDeltaEurYear;
      winWinCount += 1;
    }
    const bestPay = b.alternatives
      .filter((a) => a.quadrant === "pay_to_decarbonize")
      .sort((x, y) => x.co2eDeltaKgYear - y.co2eDeltaKgYear)[0];
    if (bestPay) {
      payCo2 += bestPay.co2eDeltaKgYear;
      payEur += bestPay.costDeltaEurYear;
      payCount += 1;
    }
  }
  return {
    totalCo2,
    totalSpend,
    avgConfidence: totalCo2 > 0 ? confSum / totalCo2 : 0,
    winWinCo2,
    winWinEur,
    winWinCount,
    payCo2,
    payEur,
    payCount,
  };
};

const quadrantLabelFromReport: Record<string, Quadrant> = {
  low_cost_low_carbon: "win_win",
  high_cost_low_carbon: "pay_to_decarbonize",
  low_cost_high_carbon: "status_quo_trap",
  high_cost_high_carbon: "avoid",
};

const CfoSummary = ({ dag }: { dag: DagRunResult }) => {
  const k = dag.executiveReport.kpis;
  const netTone: "positive" | "warning" | "default" =
    k.net_company_scale_financial_impact_eur > 500
      ? "positive"
      : k.net_company_scale_financial_impact_eur > 0
        ? "default"
        : "warning";
  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle>CFO summary</CardTitle>
            <p className="text-xs text-[var(--fg-muted)] mt-1">
              From {dag.baseline.priority_targets.length} priority clusters · jurisdiction {dag.creditStrategy.jurisdiction.country ?? "NL"}, {((dag.creditStrategy.jurisdiction.corporate_tax_rate ?? 0) * 100).toFixed(1)}% corporate tax
            </p>
          </div>
          {dag.creditStrategy.summary.tax_advisor_review_required ? (
            <Badge tone="warning">Tax advisor review</Badge>
          ) : null}
        </div>
      </CardHeader>
      <CardBody>
        <p className="text-sm text-[var(--fg-secondary)] mb-4">{dag.executiveReport.executive_summary}</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Stat
            label="Net financial impact"
            value={signedEur(k.net_company_scale_financial_impact_eur)}
            sub="per year, after tax, credits, ETS"
            tone={netTone}
          />
          <Stat
            label="Direct procurement savings"
            value={signedEur(k.direct_procurement_savings_eur)}
            sub={`Tax upside ${signedEur(k.estimated_tax_incentive_upside_eur)}`}
            tone={k.direct_procurement_savings_eur > 0 ? "positive" : "default"}
          />
          <div className="flex flex-col gap-1">
            <div className="text-[11px] uppercase tracking-wide text-[var(--fg-muted)]">CO₂e reduced</div>
            <div className="text-2xl font-semibold tabular-nums">{fmtKg(k.emissions_reduced_tco2e * 1000)}</div>
            <ConfidenceBar value={k.confidence} />
          </div>
          <Stat
            label="Avoided credit purchase"
            value={signedEur(dag.creditStrategy.summary.total_avoided_credit_purchase_cost_eur)}
            sub={`Residual credits €${dag.creditStrategy.summary.total_recommended_credit_purchase_cost_eur.toLocaleString("en-NL")}/yr`}
            tone={dag.creditStrategy.summary.total_avoided_credit_purchase_cost_eur > 0 ? "positive" : "default"}
          />
        </div>
        {dag.executiveReport.limitations.length > 0 ? (
          <ul className="mt-4 space-y-1 text-xs text-[var(--fg-muted)]">
            {dag.executiveReport.limitations.map((l, i) => (
              <li key={i} className="inline-flex items-center gap-1.5">
                <Info className="h-3 w-3" aria-hidden />
                {l}
              </li>
            ))}
          </ul>
        ) : null}
      </CardBody>
    </Card>
  );
};

const TopRecommendations = ({ dag }: { dag: DagRunResult }) => {
  const recs = dag.executiveReport.top_recommendations;
  if (recs.length === 0) return null;
  return (
    <Card>
      <CardHeader>
        <CardTitle>Top 5 switches</CardTitle>
      </CardHeader>
      <CardBody>
        <ul className="space-y-2">
          {recs.map((r) => {
            const q = quadrantLabelFromReport[r.matrix_quadrant];
            const accent = quadrantAccent[q];
            return (
              <li
                key={r.rank}
                className={`rounded-lg border border-[var(--border-default)] border-l-4 ${accent.border} px-4 py-3 flex items-center justify-between gap-4`}
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`h-2 w-2 rounded-full ${accent.dot}`} />
                    <span className="font-medium text-[var(--fg-primary)]">#{r.rank} {r.title}</span>
                    {r.approval_required ? <Badge tone="warning">Approval required</Badge> : null}
                  </div>
                  <p className="text-sm text-[var(--fg-secondary)] mt-1">{r.action}</p>
                </div>
                <div className="flex items-center gap-5 shrink-0 tabular-nums text-sm">
                  <div className="flex flex-col items-end">
                    <span className="text-[10px] uppercase tracking-wide text-[var(--fg-muted)]">Cost/yr</span>
                    <span className={r.annual_saving_eur && r.annual_saving_eur > 0 ? "text-[var(--status-success)]" : "text-[var(--fg-muted)]"}>
                      {r.annual_saving_eur !== null ? signedEur(r.annual_saving_eur) : "—"}
                    </span>
                  </div>
                  <div className="flex flex-col items-end">
                    <span className="text-[10px] uppercase tracking-wide text-[var(--fg-muted)]">CO₂e/yr</span>
                    <span className={r.carbon_saving_kg && r.carbon_saving_kg > 0 ? "text-[var(--status-success)]" : "text-[var(--fg-muted)]"}>
                      {r.carbon_saving_kg !== null ? signedKg(-Math.abs(r.carbon_saving_kg)) : "—"}
                    </span>
                  </div>
                  <div className="flex flex-col items-end min-w-[54px]">
                    <span className="text-[10px] uppercase tracking-wide text-[var(--fg-muted)]">Conf</span>
                    <span>{(r.confidence * 100).toFixed(0)}%</span>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      </CardBody>
    </Card>
  );
};

export default async function ImpactsPage() {
  const rows = getLatestRecommendations(DEFAULT_ORG_ID);
  const dag = getLatestDagResult(DEFAULT_ORG_ID);
  const baselines = groupByBaseline(rows);
  const hasData = baselines.length > 0;
  const h = computeHeadline(baselines);

  const matrixPoints: MatrixPoint[] = baselines.flatMap((b) =>
    b.alternatives.map((a) => ({
      id: a.id,
      baselineLabel: b.merchantLabel,
      altName: a.name,
      costDeltaEurYear: a.costDeltaEurYear,
      co2eDeltaKgYear: a.co2eDeltaKgYear,
      baselineAnnualCo2eKg: b.annualCo2eKg,
      quadrant: a.quadrant,
      feasibility: a.feasibility,
      confidence: a.confidence,
    })),
  );

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-start justify-between gap-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Biggest impact switches</h1>
          <p className="text-sm text-[var(--fg-secondary)] mt-1">
            Where swapping a vendor or policy cuts the most CO₂e per euro — grounded in DEFRA, Ember and vendor sustainability pages.
          </p>
        </div>
        <RunImpactResearch hasData={hasData} />
      </div>

      {!hasData ? (
        <Card>
          <CardBody className="py-10 text-center space-y-3">
            <Target className="h-8 w-8 text-[var(--brand-forest-600)] mx-auto" aria-hidden />
            <h2 className="text-base font-semibold">No impact research yet</h2>
            <p className="text-sm text-[var(--fg-secondary)] max-w-md mx-auto">
              Run impact research to analyse the last 90 days of spend across cloud, travel, utilities, food and procurement, and surface realistic alternatives — with sources, confidence, and a CFO-grade net impact number.
            </p>
          </CardBody>
        </Card>
      ) : (
        <>
          {dag ? <CfoSummary dag={dag} /> : null}
          {dag ? <TopRecommendations dag={dag} /> : null}

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardBody className="space-y-2">
                <Stat
                  label="Annual CO₂e in scope"
                  value={fmtKg(h.totalCo2)}
                  sub={`${fmtEur(h.totalSpend, 0)}/yr across ${baselines.length} line items`}
                />
                <ConfidenceBar value={h.avgConfidence} />
              </CardBody>
            </Card>
            <Card>
              <CardBody>
                <Stat
                  label="Win-win savings available"
                  value={h.winWinCo2 !== 0 ? signedKg(h.winWinCo2) : "—"}
                  sub={
                    h.winWinCount > 0
                      ? `${signedEur(h.winWinEur)}/yr across ${h.winWinCount} switch${h.winWinCount === 1 ? "" : "es"}`
                      : "No cheaper-and-greener alternatives found"
                  }
                  tone={h.winWinCo2 < 0 ? "positive" : "default"}
                />
              </CardBody>
            </Card>
            <Card>
              <CardBody>
                <Stat
                  label="Extra decarbonization budget"
                  value={h.payCo2 !== 0 ? signedKg(h.payCo2) : "—"}
                  sub={
                    h.payCount > 0
                      ? `${signedEur(h.payEur)}/yr to unlock via ${h.payCount} paid switch${h.payCount === 1 ? "" : "es"}`
                      : "No pay-to-decarbonize options surfaced"
                  }
                  tone="warning"
                />
              </CardBody>
            </Card>
          </div>

          <Card>
            <CardHeader className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CardTitle>Cost × CO₂e trade-off matrix</CardTitle>
                <span className="text-xs text-[var(--fg-muted)] inline-flex items-center gap-1">
                  <Info className="h-3 w-3" aria-hidden /> bubble size = baseline CO₂e
                </span>
              </div>
              <div className="flex items-center gap-3 text-[11px] text-[var(--fg-muted)]">
                {quadrantOrder.map((q) => (
                  <span key={q} className="inline-flex items-center gap-1.5">
                    <span className={`h-2 w-2 rounded-full ${quadrantAccent[q].dot}`} />
                    <span>{quadrantLabel[q]}</span>
                  </span>
                ))}
              </div>
            </CardHeader>
            <CardBody>
              <ImpactMatrix points={matrixPoints} />
            </CardBody>
          </Card>

          <div className="flex flex-col gap-4">
            {baselines.map((b) => {
              const altsByQ = new Map<Quadrant, Alt[]>();
              for (const a of b.alternatives) {
                const arr = altsByQ.get(a.quadrant) ?? [];
                arr.push(a);
                altsByQ.set(a.quadrant, arr);
              }
              for (const arr of altsByQ.values()) {
                arr.sort((x, y) => x.co2eDeltaKgYear - y.co2eDeltaKgYear);
              }
              return (
                <Card key={b.key}>
                  <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ${categoryBadge[b.category] ?? "bg-[var(--bg-surface-muted)] text-[var(--fg-secondary)]"}`}>
                          {b.category}
                          {b.subCategory ? ` · ${b.subCategory.replace(/_/g, " ")}` : ""}
                        </span>
                        <Badge tone="default">{b.alternatives.length} alternatives</Badge>
                      </div>
                      <h3 className="mt-1.5 text-base font-semibold text-[var(--fg-primary)] truncate">{b.merchantLabel}</h3>
                    </div>
                    <div className="flex items-center gap-6 sm:gap-8 shrink-0">
                      <Stat label="Annual spend" value={fmtEur(b.annualSpendEur, 0)} />
                      <div className="flex flex-col gap-1 min-w-[140px]">
                        <div className="text-xs uppercase tracking-wide text-[var(--fg-muted)]">Annual CO₂e</div>
                        <div className="text-2xl font-semibold tabular-nums">{fmtKg(b.annualCo2eKg)}</div>
                        <ConfidenceBar value={b.confidence} />
                      </div>
                    </div>
                  </CardHeader>
                  <CardBody className="space-y-4">
                    {quadrantOrder
                      .filter((q) => (altsByQ.get(q)?.length ?? 0) > 0)
                      .map((q) => (
                        <div key={q} className="space-y-2">
                          <div className="flex items-center gap-2">
                            <span className={`h-2 w-2 rounded-full ${quadrantAccent[q].dot}`} />
                            <span className={`text-[11px] font-semibold uppercase tracking-wide ${quadrantAccent[q].text}`}>
                              {quadrantLabel[q]}
                            </span>
                          </div>
                          <ul className="space-y-2">
                            {altsByQ.get(q)!.map((a) => (
                              <li
                                key={a.id}
                                className={`rounded-lg border border-[var(--border-default)] border-l-4 ${quadrantAccent[q].border} px-4 py-3 hover:bg-[var(--bg-surface-muted)] transition-colors`}
                              >
                                <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
                                  <div className="min-w-0">
                                    <div className="flex items-center gap-2 flex-wrap">
                                      <span className="font-medium text-[var(--fg-primary)]">{a.name}</span>
                                      <span className="text-[10px] uppercase tracking-wide text-[var(--fg-muted)]">{a.type}</span>
                                      <span className="text-[10px] text-[var(--fg-muted)] rounded-full border border-[var(--border-default)] px-1.5 py-0.5">
                                        {feasibilityLabel[a.feasibility] ?? a.feasibility}
                                      </span>
                                    </div>
                                    <div className="text-sm text-[var(--fg-secondary)] mt-0.5">{a.description}</div>
                                  </div>
                                  <div className="flex items-center gap-4 sm:gap-5 shrink-0 tabular-nums text-sm">
                                    <div className="flex flex-col items-end">
                                      <span className="text-[10px] uppercase tracking-wide text-[var(--fg-muted)]">Cost</span>
                                      <span className={a.costDeltaEurYear < 0 ? "text-[var(--status-success)] font-medium" : a.costDeltaEurYear > 0 ? "text-[var(--status-danger)] font-medium" : "text-[var(--fg-muted)]"}>
                                        {signedEur(a.costDeltaEurYear)}/yr
                                      </span>
                                    </div>
                                    <div className="flex flex-col items-end">
                                      <span className="text-[10px] uppercase tracking-wide text-[var(--fg-muted)]">CO₂e</span>
                                      <span className={a.co2eDeltaKgYear < 0 ? "text-[var(--status-success)] font-medium" : a.co2eDeltaKgYear > 0 ? "text-[var(--status-danger)] font-medium" : "text-[var(--fg-muted)]"}>
                                        {signedKg(a.co2eDeltaKgYear)}/yr
                                      </span>
                                    </div>
                                    <div className="flex flex-col items-end min-w-[54px]">
                                      <span className="text-[10px] uppercase tracking-wide text-[var(--fg-muted)]">Conf</span>
                                      <span>{(a.confidence * 100).toFixed(0)}%</span>
                                    </div>
                                  </div>
                                </div>
                                <div className="mt-2 flex flex-col gap-1.5 sm:flex-row sm:items-center sm:justify-between">
                                  <p className="text-xs text-[var(--fg-muted)] max-w-2xl">{a.rationale}</p>
                                  {a.sources.length > 0 && (
                                    <div className="flex items-center gap-2 flex-wrap">
                                      {a.sources.map((s, i) => (
                                        <a
                                          key={i}
                                          href={s.url}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          className="inline-flex items-center gap-1 text-[11px] text-[var(--brand-forest-600)] dark:text-[var(--brand-mint-500)] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring-accent)] rounded"
                                        >
                                          {s.title}
                                          <ExternalLink className="h-3 w-3" aria-hidden />
                                        </a>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              </li>
                            ))}
                          </ul>
                        </div>
                      ))}
                    {b.alternatives.length === 0 && (
                      <div className="text-sm text-[var(--fg-muted)] inline-flex items-center gap-2">
                        No alternatives surfaced for this item yet
                        <ArrowRight className="h-3.5 w-3.5" aria-hidden />
                      </div>
                    )}
                  </CardBody>
                </Card>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
