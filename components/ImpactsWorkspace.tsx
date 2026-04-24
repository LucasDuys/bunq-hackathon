"use client";
import { useMemo, useState } from "react";
import {
  ArrowUpRight,
  BadgeCheck,
  Beaker,
  ExternalLink,
  FileSearch,
  Flag,
  Info,
  LayoutGrid,
  LineChart,
  ListChecks,
  Search,
  Sparkles,
  Target,
} from "lucide-react";
import { Badge, Card, CardBody, CardHeader, CardTitle, ConfidenceBar, Stat } from "@/components/ui";
import { ImpactMatrix, type MatrixPoint } from "@/components/ImpactMatrix";
import { ScenarioPlanner, type PlannableAlternative } from "@/components/ScenarioPlanner";
import type { Quadrant } from "@/lib/agent/impacts";
import type { DagRunResult, ResearchResult, ResearchedAlternative } from "@/lib/agents/dag/types";
import { schemesForCategory } from "@/lib/tax";
import { fmtEur, fmtKg } from "@/lib/utils";

type Lens = "co2" | "eur";

/* ─────────── Types surfaced from the page ─────────── */

export type WorkspaceAlt = {
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

export type WorkspaceBaseline = {
  key: string;
  merchantLabel: string;
  category: string;
  subCategory: string | null;
  annualSpendEur: number;
  annualCo2eKg: number;
  confidence: number;
  alternatives: WorkspaceAlt[];
};

export type WorkspaceHeadline = {
  totalCo2: number;
  totalSpend: number;
  avgConfidence: number;
  winWinCo2: number;
  winWinEur: number;
  winWinCount: number;
  payCo2: number;
  payEur: number;
  payCount: number;
};

export type ResearchKpis = {
  evidenceSources: number;
  webSearchSpendEur: number;
  clustersResearched: number;
  cacheHits: number;
};

type TabKey = "overview" | "matrix" | "switches" | "research";

/* ─────────── Small helpers ─────────── */

const QUADRANT_ORDER: Quadrant[] = ["win_win", "pay_to_decarbonize", "status_quo_trap", "avoid"];

const QUADRANT_LABEL: Record<Quadrant, string> = {
  win_win: "Win-win",
  pay_to_decarbonize: "Pay to decarbonize",
  status_quo_trap: "Status-quo trap",
  avoid: "Avoid",
};

const QUADRANT_COLOR: Record<Quadrant, string> = {
  win_win: "var(--quadrant-win-win)",
  pay_to_decarbonize: "var(--quadrant-pay)",
  status_quo_trap: "var(--quadrant-trap)",
  avoid: "var(--quadrant-avoid)",
};

const QUADRANT_TINT: Record<Quadrant, string> = {
  win_win: "var(--quadrant-win-win-bg)",
  pay_to_decarbonize: "var(--quadrant-pay-bg)",
  status_quo_trap: "var(--quadrant-trap-bg)",
  avoid: "var(--quadrant-avoid-bg)",
};

const FEASIBILITY_LABEL: Record<string, string> = {
  drop_in: "Drop-in",
  migration: "Migration",
  procurement: "Procurement",
};

const REPORT_QUADRANT_MAP: Record<string, Quadrant> = {
  low_cost_low_carbon: "win_win",
  high_cost_low_carbon: "pay_to_decarbonize",
  low_cost_high_carbon: "status_quo_trap",
  high_cost_high_carbon: "avoid",
};

const FLAG_LABEL: Record<string, string> = {
  requires_policy_check: "Needs policy check",
  requires_tax_verification: "Needs tax verification",
  incumbent_match: "Matches incumbent",
  paywalled_source: "Paywalled source",
  single_source_only: "Single source",
};

const signedEur = (v: number) => `${v < 0 ? "−" : v > 0 ? "+" : ""}${fmtEur(Math.abs(v), 0)}`;
const signedKg = (v: number) => {
  const abs = Math.abs(v);
  const sign = v < 0 ? "−" : v > 0 ? "+" : "";
  return abs >= 1000 ? `${sign}${(abs / 1000).toFixed(2)} tCO₂e` : `${sign}${abs.toFixed(0)} kgCO₂e`;
};
const toneForDelta = (v: number, goodNegative = true) => {
  if (v === 0) return "text-[var(--fg-muted)]";
  const good = goodNegative ? v < 0 : v > 0;
  return good ? "text-[var(--status-success)]" : "text-[var(--status-danger)]";
};

/* ─────────── Tab nav ─────────── */

const TabButton = ({
  active,
  icon,
  label,
  count,
  onClick,
}: {
  active: boolean;
  icon: React.ReactNode;
  label: string;
  count?: number | string;
  onClick: () => void;
}) => (
  <button
    type="button"
    onClick={onClick}
    className="inline-flex items-center gap-2 rounded-full px-3.5 h-9 text-[13px] font-normal transition-[transform,background,color,box-shadow] duration-150 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring-accent)]"
    style={{
      color: active ? "var(--text)" : "var(--text-dim)",
      background: active ? "var(--bg-card-2)" : "transparent",
      boxShadow: active
        ? "0 0 0 1px var(--border-strong) inset"
        : "0 0 0 1px transparent inset",
    }}
    aria-pressed={active}
  >
    <span style={{ color: active ? "var(--green-bright)" : "var(--text-mute)" }}>{icon}</span>
    <span>{label}</span>
    {count !== undefined && (
      <span
        className="tabular-nums text-[11px]"
        style={{ color: active ? "var(--text-dim)" : "var(--text-mute)" }}
      >
        {count}
      </span>
    )}
  </button>
);

/* ─────────── Lens toggle ─────────── */

const LensToggle = ({ lens, onChange }: { lens: Lens; onChange: (l: Lens) => void }) => {
  const Btn = ({ value, label }: { value: Lens; label: string }) => {
    const active = lens === value;
    return (
      <button
        type="button"
        onClick={() => onChange(value)}
        aria-pressed={active}
        className="inline-flex items-center justify-center h-7 px-3 text-[12px] font-medium tabular-nums rounded-full transition-[background,color] duration-150 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-green)]"
        style={{
          color: active ? "var(--fg-primary)" : "var(--fg-muted)",
          background: active ? "var(--bg-button)" : "transparent",
        }}
      >
        {label}
      </button>
    );
  };
  return (
    <div
      className="inline-flex items-center gap-0.5 rounded-full p-0.5 ml-1"
      role="group"
      aria-label="Lens"
      style={{
        background: "var(--bg-inset)",
        border: "1px solid var(--border-default)",
      }}
    >
      <Btn value="co2" label="CO₂e" />
      <Btn value="eur" label="€" />
    </div>
  );
};

/* ─────────── Tax-scheme chip ─────────── */

const TaxSchemeChips = ({ category }: { category: string }) => {
  const schemes = useMemo(() => schemesForCategory(category), [category]);
  if (schemes.length === 0) return null;
  return (
    <div className="flex items-center gap-1.5 flex-wrap mt-1.5">
      {schemes.map((s) => (
        <span
          key={s.id}
          className="inline-flex items-center gap-1 rounded-full px-2 py-[2px] text-[11px] font-mono uppercase tracking-[0.04em]"
          style={{
            color: "var(--brand-green-link)",
            border: "1px solid var(--brand-green-border)",
            background: "transparent",
          }}
          title={s.description}
        >
          <BadgeCheck className="h-3 w-3" aria-hidden />
          {s.id}
          {s.method === "pct_of_investment" && (
            <span style={{ color: "var(--fg-muted)" }}>· {(s.rate * 100).toFixed(1)}%</span>
          )}
        </span>
      ))}
    </div>
  );
};

/* ─────────── Hero briefing ─────────── */

const HeroBriefing = ({
  dag,
  headline,
  baselines,
  action,
  lens,
  onLensChange,
}: {
  dag: DagRunResult | null;
  headline: WorkspaceHeadline;
  baselines: WorkspaceBaseline[];
  action: React.ReactNode;
  lens: Lens;
  onLensChange: (l: Lens) => void;
}) => {
  const netEur = dag?.executiveReport.kpis.net_company_scale_financial_impact_eur ?? 0;
  const co2eKg = (dag?.executiveReport.kpis.emissions_reduced_tco2e ?? 0) * 1000;
  // Headline-derived fallback when DAG hasn't run. Negative deltas in the
  // headline mean reductions; flip sign for display.
  const headlineCo2eAvoidableKg = Math.max(
    0,
    -(headline.winWinCo2 + headline.payCo2),
  );
  const headlineEurUpside = -(headline.winWinEur) + Math.max(0, -headline.payEur);
  const heroCo2eKg = co2eKg > 0 ? co2eKg : headlineCo2eAvoidableKg;
  const heroEur = netEur !== 0 ? netEur : headlineEurUpside;
  const confidence = dag?.executiveReport.kpis.confidence ?? headline.avgConfidence;
  const narrative = dag?.executiveReport.executive_summary ?? "";
  const jurisdiction = dag?.creditStrategy.jurisdiction;
  const taxReviewRequired = dag?.creditStrategy.summary.tax_advisor_review_required;

  return (
    <Card className="relative overflow-hidden">
      <div className="relative grid grid-cols-1 lg:grid-cols-[1.1fr_1fr] gap-10 p-8">
        <div className="flex flex-col gap-5 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <Sparkles className="h-4 w-4" style={{ color: "var(--green-bright)" }} aria-hidden />
            <span
              className="text-[11px] uppercase tracking-[0.14em] font-normal"
              style={{ color: "var(--text-mute)" }}
            >
              Carbon CFO briefing · {dag?.executiveReport.analysis_period ?? "latest run"}
            </span>
            {taxReviewRequired ? <Badge tone="warning">Tax advisor review</Badge> : null}
            <LensToggle lens={lens} onChange={onLensChange} />
          </div>
          <div className="flex items-baseline gap-3 flex-wrap">
            <div
              className="font-normal tabular-nums leading-none"
              style={{
                fontSize: "clamp(56px, 7vw, 88px)",
                letterSpacing: "-0.03em",
                color:
                  lens === "co2"
                    ? "var(--green-bright)"
                    : heroEur >= 0
                      ? "var(--green-bright)"
                      : "var(--red)",
              }}
            >
              {lens === "co2" ? fmtKg(heroCo2eKg) : signedEur(heroEur)}
            </div>
            <div className="flex flex-col gap-0.5">
              <span className="text-[11px] uppercase tracking-[0.14em] text-[var(--text-mute)] font-normal">
                {lens === "co2" ? "Avoidable / yr" : "Net / yr"}
              </span>
              <span className="text-xs text-[var(--text-dim)]">
                {lens === "co2" ? "across surfaced switches" : "after tax, credits & ETS"}
              </span>
            </div>
          </div>
          {narrative ? (
            <p className="text-[15px] leading-[1.55] max-w-[62ch] text-[var(--text-dim)]">
              {narrative}
            </p>
          ) : (
            <p className="text-[15px] leading-[1.55] max-w-[62ch] text-[var(--text-mute)]">
              Run the impact agents to generate a CFO-grade briefing with sourced alternatives,
              scenario maths, and tax-aware credit strategy.
            </p>
          )}
          <div className="flex items-center gap-3 flex-wrap">{action}</div>
        </div>

        <div className="grid grid-cols-2 gap-3 content-start">
          <MetricTile
            label="CO₂e reducible"
            value={co2eKg !== 0 ? fmtKg(co2eKg) : "—"}
            sub={`${baselines.length} line items in scope`}
            confidence={confidence}
          />
          <MetricTile
            label="Direct savings"
            value={signedEur(dag?.executiveReport.kpis.direct_procurement_savings_eur ?? 0)}
            sub={`Tax upside ${signedEur(dag?.executiveReport.kpis.estimated_tax_incentive_upside_eur ?? 0)}`}
            tone={
              (dag?.executiveReport.kpis.direct_procurement_savings_eur ?? 0) > 0
                ? "positive"
                : "default"
            }
          />
          <MetricTile
            label="Avoided credits"
            value={signedEur(
              dag?.creditStrategy.summary.total_avoided_credit_purchase_cost_eur ?? 0,
            )}
            sub={`Residual €${(
              dag?.creditStrategy.summary.total_recommended_credit_purchase_cost_eur ?? 0
            ).toLocaleString("en-NL")}/yr`}
            tone={
              (dag?.creditStrategy.summary.total_avoided_credit_purchase_cost_eur ?? 0) > 0
                ? "positive"
                : "default"
            }
          />
          <MetricTile
            label="Jurisdiction"
            value={jurisdiction?.country ?? "NL"}
            sub={`${((jurisdiction?.corporate_tax_rate ?? 0) * 100).toFixed(1)}% corp tax`}
          />
        </div>
      </div>
    </Card>
  );
};

const MetricTile = ({
  label,
  value,
  sub,
  tone = "default",
  confidence,
}: {
  label: string;
  value: string;
  sub?: string;
  tone?: "default" | "positive" | "warning";
  confidence?: number;
}) => (
  <div
    className="rounded-[14px] p-3.5 flex flex-col gap-1.5"
    style={{
      background: "var(--bg-card-2)",
      border: "1px solid var(--border-faint)",
    }}
  >
    <div className="text-[10.5px] uppercase tracking-[0.6px] font-normal text-[var(--text-mute)]">
      {label}
    </div>
    <div
      className="text-[24px] leading-none tabular-nums"
      style={{
        color:
          tone === "positive"
            ? "var(--green-bright)"
            : tone === "warning"
              ? "var(--amber)"
              : "var(--text)",
      }}
    >
      {value}
    </div>
    {sub && <div className="text-[11px] text-[var(--text-mute)]">{sub}</div>}
    {confidence !== undefined && <ConfidenceBar value={confidence} />}
  </div>
);

/* ─────────── Top recommendations (overview) ─────────── */

const TopRecommendations = ({ dag }: { dag: DagRunResult }) => {
  const recs = dag.executiveReport.top_recommendations;
  if (recs.length === 0) return null;
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-3">
          <CardTitle>Top switches ranked by LLM panel</CardTitle>
          <span className="text-[11px] text-[var(--text-mute)]">
            green + cost judges agreed
          </span>
        </div>
      </CardHeader>
      <CardBody>
        <ol className="space-y-2">
          {recs.map((r) => {
            const q = REPORT_QUADRANT_MAP[r.matrix_quadrant];
            return (
              <li
                key={r.rank}
                className="rounded-[14px] px-4 py-3 flex items-center justify-between gap-4"
                style={{
                  background: QUADRANT_TINT[q],
                  borderLeft: `3px solid ${QUADRANT_COLOR[q]}`,
                  border: "1px solid var(--border-faint)",
                }}
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span
                      className="font-mono text-[11px] text-[var(--text-mute)] w-5 text-right"
                    >
                      #{r.rank}
                    </span>
                    <span className="font-normal text-[var(--text)]">{r.title}</span>
                    {r.approval_required ? (
                      <Badge tone="warning">Approval required</Badge>
                    ) : null}
                    <span
                      className="inline-flex items-center gap-1.5 text-[10.5px]"
                      style={{ color: QUADRANT_COLOR[q] }}
                    >
                      <span
                        className="h-1.5 w-1.5 rounded-full"
                        style={{ background: QUADRANT_COLOR[q] }}
                      />
                      {QUADRANT_LABEL[q]}
                    </span>
                  </div>
                  <p className="text-[13px] text-[var(--text-dim)] mt-1 leading-snug">
                    {r.action}
                  </p>
                </div>
                <div className="flex items-center gap-5 shrink-0 tabular-nums text-sm">
                  <MicroMetric
                    label="Cost/yr"
                    value={r.annual_saving_eur !== null ? signedEur(r.annual_saving_eur) : "—"}
                    tone={
                      r.annual_saving_eur && r.annual_saving_eur > 0
                        ? "text-[var(--status-success)]"
                        : "text-[var(--text-mute)]"
                    }
                  />
                  <MicroMetric
                    label="CO₂e/yr"
                    value={
                      r.carbon_saving_kg !== null
                        ? signedKg(-Math.abs(r.carbon_saving_kg))
                        : "—"
                    }
                    tone={
                      r.carbon_saving_kg && r.carbon_saving_kg > 0
                        ? "text-[var(--status-success)]"
                        : "text-[var(--text-mute)]"
                    }
                  />
                  <MicroMetric
                    label="Conf"
                    value={`${(r.confidence * 100).toFixed(0)}%`}
                  />
                </div>
              </li>
            );
          })}
        </ol>
      </CardBody>
    </Card>
  );
};

const MicroMetric = ({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: string;
}) => (
  <div className="flex flex-col items-end">
    <span className="text-[10px] uppercase tracking-wide text-[var(--text-mute)]">{label}</span>
    <span className={tone}>{value}</span>
  </div>
);

/* ─────────── Switches explorer (master-detail) ─────────── */

const SwitchesExplorer = ({ baselines }: { baselines: WorkspaceBaseline[] }) => {
  const [quadrantFilter, setQuadrantFilter] = useState<Quadrant | "all">("all");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [selectedKey, setSelectedKey] = useState<string>(baselines[0]?.key ?? "");

  const categories = useMemo(
    () => Array.from(new Set(baselines.map((b) => b.category))).sort(),
    [baselines],
  );

  const filtered = useMemo(() => {
    return baselines.filter((b) => {
      if (categoryFilter !== "all" && b.category !== categoryFilter) return false;
      if (quadrantFilter === "all") return true;
      return b.alternatives.some((a) => a.quadrant === quadrantFilter);
    });
  }, [baselines, categoryFilter, quadrantFilter]);

  const selected = useMemo(
    () => filtered.find((b) => b.key === selectedKey) ?? filtered[0] ?? null,
    [filtered, selectedKey],
  );

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <CardTitle>Switches explorer</CardTitle>
            <p className="text-[11px] text-[var(--text-mute)] mt-1">
              Pick a line item to inspect every alternative, quadrant, and cited source.
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <FilterChip
              active={quadrantFilter === "all"}
              onClick={() => setQuadrantFilter("all")}
              label="All"
            />
            {QUADRANT_ORDER.map((q) => (
              <FilterChip
                key={q}
                active={quadrantFilter === q}
                onClick={() => setQuadrantFilter(q)}
                label={QUADRANT_LABEL[q]}
                dot={QUADRANT_COLOR[q]}
              />
            ))}
            {categories.length > 1 && (
              <select
                className="h-8 rounded-full px-3 text-[12px]"
                style={{
                  background: "var(--bg-card-2)",
                  color: "var(--text-dim)",
                  border: "1px solid var(--border)",
                }}
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                aria-label="Filter by category"
              >
                <option value="all">All categories</option>
                {categories.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            )}
          </div>
        </div>
      </CardHeader>
      <CardBody className="p-0">
        <div className="grid grid-cols-1 lg:grid-cols-[320px_1fr]">
          <ul
            className="max-h-[640px] overflow-y-auto lg:border-r"
            style={{ borderColor: "var(--border-faint)" }}
          >
            {filtered.length === 0 && (
              <li className="px-5 py-8 text-center text-sm text-[var(--text-mute)]">
                No line items match the filters.
              </li>
            )}
            {filtered.map((b) => {
              const isSelected = selected?.key === b.key;
              const bestWin = b.alternatives
                .filter((a) => a.quadrant === "win_win")
                .sort((x, y) => x.co2eDeltaKgYear - y.co2eDeltaKgYear)[0];
              return (
                <li key={b.key}>
                  <button
                    type="button"
                    onClick={() => setSelectedKey(b.key)}
                    className="w-full text-left px-5 py-3.5 flex flex-col gap-1 transition-colors duration-150 focus-visible:outline-none"
                    style={{
                      background: isSelected ? "var(--bg-card-2)" : "transparent",
                      borderLeft: isSelected
                        ? "2px solid var(--green-bright)"
                        : "2px solid transparent",
                      borderBottom: "1px solid var(--border-faint)",
                    }}
                    aria-pressed={isSelected}
                  >
                    <div className="flex items-center gap-2">
                      <span
                        className="text-[10.5px] uppercase tracking-wide text-[var(--text-mute)]"
                      >
                        {b.category}
                        {b.subCategory ? ` · ${b.subCategory.replace(/_/g, " ")}` : ""}
                      </span>
                      <span className="text-[10.5px] text-[var(--text-mute)]">·</span>
                      <span
                        className="text-[10.5px] tabular-nums text-[var(--text-mute)]"
                      >
                        {b.alternatives.length} alts
                      </span>
                    </div>
                    <div className="font-normal text-[14px] text-[var(--text)] truncate">
                      {b.merchantLabel}
                    </div>
                    <div className="flex items-center justify-between tabular-nums text-[12px]">
                      <span className="text-[var(--text-dim)]">
                        {fmtKg(b.annualCo2eKg)}
                      </span>
                      <span className="text-[var(--text-mute)]">
                        {fmtEur(b.annualSpendEur, 0)}/yr
                      </span>
                    </div>
                    {bestWin && (
                      <div className="flex items-center gap-1.5 text-[11px] mt-0.5">
                        <span
                          className="h-1.5 w-1.5 rounded-full"
                          style={{ background: QUADRANT_COLOR.win_win }}
                        />
                        <span style={{ color: QUADRANT_COLOR.win_win }}>
                          {signedKg(bestWin.co2eDeltaKgYear)} · {signedEur(bestWin.costDeltaEurYear)}/yr
                        </span>
                      </div>
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
          <div className="p-6 min-w-0">
            {selected ? (
              <BaselineDetail baseline={selected} quadrantFilter={quadrantFilter} />
            ) : (
              <div className="text-sm text-[var(--text-mute)]">Nothing selected.</div>
            )}
          </div>
        </div>
      </CardBody>
    </Card>
  );
};

const FilterChip = ({
  active,
  onClick,
  label,
  dot,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  dot?: string;
}) => (
  <button
    type="button"
    onClick={onClick}
    className="inline-flex items-center gap-1.5 rounded-full px-3 h-8 text-[12px] transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring-accent)]"
    style={{
      color: active ? "var(--text)" : "var(--text-dim)",
      background: active ? "var(--bg-card-2)" : "transparent",
      border: `1px solid ${active ? "var(--border-strong)" : "var(--border)"}`,
    }}
    aria-pressed={active}
  >
    {dot && (
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: dot }} aria-hidden />
    )}
    {label}
  </button>
);

const BaselineDetail = ({
  baseline,
  quadrantFilter,
}: {
  baseline: WorkspaceBaseline;
  quadrantFilter: Quadrant | "all";
}) => {
  const grouped = useMemo(() => {
    const m = new Map<Quadrant, WorkspaceAlt[]>();
    for (const a of baseline.alternatives) {
      if (quadrantFilter !== "all" && a.quadrant !== quadrantFilter) continue;
      const arr = m.get(a.quadrant) ?? [];
      arr.push(a);
      m.set(a.quadrant, arr);
    }
    for (const arr of m.values()) arr.sort((x, y) => x.co2eDeltaKgYear - y.co2eDeltaKgYear);
    return m;
  }, [baseline, quadrantFilter]);

  const visibleCount = [...grouped.values()].reduce((n, v) => n + v.length, 0);

  return (
    <div className="flex flex-col gap-5 min-w-0">
      <header className="flex items-start justify-between gap-6 flex-wrap">
        <div className="min-w-0">
          <div className="flex items-center gap-2 mb-1.5">
            <Badge tone="default">{baseline.category}</Badge>
            {baseline.subCategory && (
              <Badge tone="default">{baseline.subCategory.replace(/_/g, " ")}</Badge>
            )}
          </div>
          <h3 className="text-xl font-normal tracking-tight truncate">
            {baseline.merchantLabel}
          </h3>
          <TaxSchemeChips category={baseline.category} />
        </div>
        <div className="flex items-center gap-6 shrink-0">
          <div className="flex flex-col">
            <span className="text-[10.5px] uppercase tracking-wide text-[var(--text-mute)]">
              Spend / yr
            </span>
            <span className="text-[22px] leading-none tabular-nums">
              {fmtEur(baseline.annualSpendEur, 0)}
            </span>
          </div>
          <div className="flex flex-col gap-1 min-w-[160px]">
            <span className="text-[10.5px] uppercase tracking-wide text-[var(--text-mute)]">
              CO₂e / yr
            </span>
            <span className="text-[22px] leading-none tabular-nums">
              {fmtKg(baseline.annualCo2eKg)}
            </span>
            <ConfidenceBar value={baseline.confidence} />
          </div>
        </div>
      </header>

      {visibleCount === 0 ? (
        <div className="text-sm text-[var(--text-mute)] py-10 text-center">
          No alternatives in the selected quadrant.
        </div>
      ) : (
        <div className="flex flex-col gap-5">
          {QUADRANT_ORDER.filter((q) => (grouped.get(q)?.length ?? 0) > 0).map((q) => (
            <section key={q} className="flex flex-col gap-2.5">
              <div className="flex items-center gap-2">
                <span
                  className="h-1.5 w-1.5 rounded-full"
                  style={{ background: QUADRANT_COLOR[q] }}
                />
                <span
                  className="text-[11px] font-normal uppercase tracking-[0.08em]"
                  style={{ color: QUADRANT_COLOR[q] }}
                >
                  {QUADRANT_LABEL[q]}
                </span>
                <span className="text-[11px] text-[var(--text-mute)]">
                  · {grouped.get(q)!.length}
                </span>
              </div>
              <ul className="flex flex-col gap-2">
                {grouped.get(q)!.map((a) => (
                  <AltRow key={a.id} alt={a} quadrantColor={QUADRANT_COLOR[q]} />
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  );
};

const AltRow = ({ alt, quadrantColor }: { alt: WorkspaceAlt; quadrantColor: string }) => {
  const [open, setOpen] = useState(false);
  return (
    <li
      className="rounded-[14px]"
      style={{
        background: "var(--bg-card-2)",
        border: "1px solid var(--border-faint)",
        borderLeft: `3px solid ${quadrantColor}`,
      }}
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full text-left px-4 py-3 flex flex-col gap-1.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring-accent)] rounded-[14px]"
        aria-expanded={open}
      >
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-2 flex-wrap min-w-0">
            <span className="font-normal text-[14px] text-[var(--text)]">{alt.name}</span>
            <span className="text-[10px] uppercase tracking-wide text-[var(--text-mute)]">
              {alt.type}
            </span>
            <span className="text-[10px] rounded-full px-1.5 py-0.5 text-[var(--text-mute)] border border-[var(--border)]">
              {FEASIBILITY_LABEL[alt.feasibility] ?? alt.feasibility}
            </span>
            {alt.sources.length > 0 && (
              <span className="text-[10px] text-[var(--text-mute)] inline-flex items-center gap-1">
                <BadgeCheck className="h-3 w-3" aria-hidden />
                {alt.sources.length} src
              </span>
            )}
          </div>
          <div className="flex items-center gap-5 shrink-0 tabular-nums text-[13px]">
            <MicroMetric
              label="Cost"
              value={`${signedEur(alt.costDeltaEurYear)}/yr`}
              tone={toneForDelta(alt.costDeltaEurYear)}
            />
            <MicroMetric
              label="CO₂e"
              value={`${signedKg(alt.co2eDeltaKgYear)}/yr`}
              tone={toneForDelta(alt.co2eDeltaKgYear)}
            />
            <MicroMetric label="Conf" value={`${(alt.confidence * 100).toFixed(0)}%`} />
          </div>
        </div>
        <p className="text-[13px] text-[var(--text-dim)] leading-snug">{alt.description}</p>
      </button>
      {open && (
        <div
          className="px-4 pb-4 pt-1 flex flex-col gap-2"
          style={{ borderTop: "1px dashed var(--border-faint)" }}
        >
          <p className="text-[12.5px] text-[var(--text-dim)] leading-relaxed max-w-[70ch]">
            {alt.rationale}
          </p>
          <div className="flex items-center gap-3 text-[11px] text-[var(--text-mute)] flex-wrap">
            <span>
              Δ cost {(alt.costDeltaPct * 100).toFixed(0)}%
            </span>
            <span>·</span>
            <span>Δ CO₂e {(alt.co2eDeltaPct * 100).toFixed(0)}%</span>
          </div>
          {alt.sources.length > 0 && (
            <div className="flex items-center gap-2 flex-wrap">
              {alt.sources.map((s, i) => (
                <a
                  key={i}
                  href={s.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-[11px] rounded-full px-2.5 py-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring-accent)]"
                  style={{
                    background: "var(--bg-inset)",
                    color: "var(--green-bright)",
                    border: "1px solid var(--border-faint)",
                  }}
                >
                  <span className="truncate max-w-[260px]">{s.title}</span>
                  <ExternalLink className="h-3 w-3" aria-hidden />
                </a>
              ))}
            </div>
          )}
        </div>
      )}
    </li>
  );
};

/* ─────────── Research inspector ─────────── */

const ResearchInspector = ({
  dag,
  kpis,
}: {
  dag: DagRunResult;
  kpis: ResearchKpis;
}) => {
  const clusterLabel = useMemo(() => {
    const m = new Map<string, string>();
    for (const t of dag.baseline.priority_targets) {
      m.set(t.cluster_id, t.baseline_merchant_label ?? t.cluster_id);
    }
    return m;
  }, [dag]);

  const results = dag.research?.results ?? [];
  const sorted = useMemo(
    () => [...results].sort((a, b) => b.alternatives.length - a.alternatives.length),
    [results],
  );
  const [q, setQ] = useState("");
  const [selectedId, setSelectedId] = useState<string>(sorted[0]?.cluster_id ?? "");

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return sorted;
    return sorted.filter((r) => {
      const label = clusterLabel.get(r.cluster_id) ?? r.cluster_id;
      if (label.toLowerCase().includes(s)) return true;
      return r.alternatives.some(
        (a) =>
          a.name.toLowerCase().includes(s) ||
          a.sources.some(
            (src) =>
              src.domain.toLowerCase().includes(s) ||
              src.title.toLowerCase().includes(s),
          ),
      );
    });
  }, [sorted, q, clusterLabel]);

  const selected = filtered.find((r) => r.cluster_id === selectedId) ?? filtered[0] ?? null;

  return (
    <div className="flex flex-col gap-5">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <MetricTile
          label="Clusters researched"
          value={kpis.clustersResearched.toString()}
          sub={`${kpis.cacheHits} served from cache`}
        />
        <MetricTile
          label="Source URLs"
          value={kpis.evidenceSources.toString()}
          sub="across approved switches"
          tone={kpis.evidenceSources > 0 ? "positive" : "warning"}
        />
        <MetricTile
          label="Web-search spend"
          value={fmtEur(kpis.webSearchSpendEur, 2)}
          sub="this close run"
        />
        <MetricTile
          label="Matrix freshness"
          value={kpis.clustersResearched > kpis.cacheHits ? "Live" : "Cached"}
          sub={
            kpis.clustersResearched > kpis.cacheHits
              ? "new web_search results"
              : "served from 30-day cache"
          }
          tone="positive"
        />
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <CardTitle>Research inspector</CardTitle>
              <p className="text-[11px] text-[var(--text-mute)] mt-1">
                Every alternative the Research Agent proposed — with sources, provenance, freshness
                and flags. Click a cluster to drill in.
              </p>
            </div>
            <div
              className="inline-flex items-center gap-2 rounded-full px-3 h-8 text-[12px]"
              style={{
                background: "var(--bg-card-2)",
                border: "1px solid var(--border)",
                minWidth: 240,
              }}
            >
              <Search className="h-3.5 w-3.5 text-[var(--text-mute)]" aria-hidden />
              <input
                type="search"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search merchant, alt, or domain"
                className="bg-transparent outline-none w-full placeholder:text-[var(--text-mute)]"
                aria-label="Search research results"
              />
            </div>
          </div>
        </CardHeader>
        <CardBody className="p-0">
          <div className="grid grid-cols-1 lg:grid-cols-[300px_1fr]">
            <ul
              className="max-h-[640px] overflow-y-auto lg:border-r"
              style={{ borderColor: "var(--border-faint)" }}
            >
              {filtered.length === 0 && (
                <li className="p-6 text-center text-sm text-[var(--text-mute)]">
                  No clusters match.
                </li>
              )}
              {filtered.map((r) => {
                const isSelected = selected?.cluster_id === r.cluster_id;
                const label = clusterLabel.get(r.cluster_id) ?? r.cluster_id;
                const sourcesCount = r.alternatives.reduce(
                  (n, a) => n + a.sources.length,
                  0,
                );
                return (
                  <li key={r.cluster_id}>
                    <button
                      type="button"
                      onClick={() => setSelectedId(r.cluster_id)}
                      className="w-full text-left px-5 py-3 flex flex-col gap-1 focus-visible:outline-none"
                      style={{
                        background: isSelected ? "var(--bg-card-2)" : "transparent",
                        borderLeft: isSelected
                          ? "2px solid var(--green-bright)"
                          : "2px solid transparent",
                        borderBottom: "1px solid var(--border-faint)",
                      }}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-normal text-[13.5px] truncate text-[var(--text)]">
                          {label}
                        </span>
                        {r.cache_hit ? (
                          <span
                            className="text-[10px] uppercase tracking-wide text-[var(--text-mute)]"
                          >
                            cache
                          </span>
                        ) : (
                          <span
                            className="text-[10px] uppercase tracking-wide"
                            style={{ color: "var(--green-bright)" }}
                          >
                            live
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-3 text-[11px] text-[var(--text-mute)] tabular-nums">
                        <span>{r.alternatives.length} alts</span>
                        <span>·</span>
                        <span>{sourcesCount} srcs</span>
                        <span>·</span>
                        <span>{r.searches_used} queries</span>
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
            <div className="p-6 min-w-0">
              {selected ? (
                <ClusterDetail
                  result={selected}
                  label={clusterLabel.get(selected.cluster_id) ?? selected.cluster_id}
                />
              ) : (
                <div className="text-sm text-[var(--text-mute)]">
                  No research results yet for this run.
                </div>
              )}
            </div>
          </div>
        </CardBody>
      </Card>
    </div>
  );
};

const ClusterDetail = ({
  result,
  label,
}: {
  result: ResearchResult;
  label: string;
}) => {
  return (
    <div className="flex flex-col gap-4 min-w-0">
      <header>
        <div className="text-[10.5px] uppercase tracking-[0.6px] text-[var(--text-mute)] mb-1">
          Cluster
        </div>
        <h3 className="text-lg font-normal tracking-tight truncate">{label}</h3>
        <div className="flex items-center gap-4 text-[11px] text-[var(--text-mute)] mt-1.5 tabular-nums">
          <span>{result.alternatives.length} alternatives</span>
          <span>·</span>
          <span>{result.searches_used} web_search calls</span>
          <span>·</span>
          <span>{result.cache_hit ? "cache hit" : "fresh"}</span>
        </div>
      </header>
      <ul className="flex flex-col gap-3">
        {result.alternatives.map((a) => (
          <ResearchedAltCard key={a.id} alt={a} />
        ))}
      </ul>
    </div>
  );
};

const ResearchedAltCard = ({ alt }: { alt: ResearchedAlternative }) => {
  const freshnessTone =
    alt.freshness_days > 30
      ? "text-[var(--amber)]"
      : "text-[var(--text-mute)]";
  const provenanceTone =
    alt.provenance === "web_search"
      ? "var(--green-bright)"
      : alt.provenance === "cache"
        ? "var(--text-dim)"
        : "var(--amber)";
  return (
    <li
      className="rounded-[14px] p-4 flex flex-col gap-3"
      style={{
        background: "var(--bg-card-2)",
        border: "1px solid var(--border-faint)",
      }}
    >
      <header className="flex items-start justify-between gap-4 flex-wrap">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-normal text-[14.5px] text-[var(--text)]">{alt.name}</span>
            {alt.vendor && (
              <span className="text-[11px] text-[var(--text-mute)]">· {alt.vendor}</span>
            )}
            <span
              className="text-[10px] uppercase tracking-[0.08em] rounded-full px-2 py-0.5"
              style={{
                color: provenanceTone,
                background: "var(--bg-inset)",
                border: "1px solid var(--border-faint)",
              }}
            >
              {alt.provenance.replace(/_/g, " ")}
            </span>
          </div>
          <p className="text-[13px] text-[var(--text-dim)] leading-snug mt-1 max-w-[70ch]">
            {alt.description}
          </p>
        </div>
        <div className="flex items-center gap-5 shrink-0 tabular-nums text-[13px]">
          <MicroMetric
            label="Δ Cost"
            value={
              alt.cost_delta_pct !== null
                ? `${(alt.cost_delta_pct * 100).toFixed(0)}%`
                : "—"
            }
            tone={
              alt.cost_delta_pct !== null && alt.cost_delta_pct < 0
                ? "text-[var(--status-success)]"
                : alt.cost_delta_pct && alt.cost_delta_pct > 0
                  ? "text-[var(--status-danger)]"
                  : "text-[var(--text-mute)]"
            }
          />
          <MicroMetric
            label="Δ CO₂e"
            value={
              alt.co2e_delta_pct !== null
                ? `${(alt.co2e_delta_pct * 100).toFixed(0)}%`
                : "—"
            }
            tone={
              alt.co2e_delta_pct !== null && alt.co2e_delta_pct < 0
                ? "text-[var(--status-success)]"
                : alt.co2e_delta_pct && alt.co2e_delta_pct > 0
                  ? "text-[var(--status-danger)]"
                  : "text-[var(--text-mute)]"
            }
          />
          <MicroMetric label="Conf" value={`${(alt.confidence * 100).toFixed(0)}%`} />
        </div>
      </header>
      <div className="flex items-center gap-2 flex-wrap text-[11px]">
        <span
          className="inline-flex items-center gap-1 rounded-full px-2 py-0.5"
          style={{
            background: "var(--bg-inset)",
            color: "var(--text-dim)",
            border: "1px solid var(--border-faint)",
          }}
        >
          {FEASIBILITY_LABEL[alt.feasibility] ?? alt.feasibility}
        </span>
        <span className={`tabular-nums ${freshnessTone}`}>
          {alt.freshness_days}d fresh
        </span>
        <span className="text-[var(--text-mute)]">· {alt.geography}</span>
        {alt.flags.length > 0 &&
          alt.flags.map((f) => (
            <span
              key={f}
              className="inline-flex items-center gap-1 rounded-full px-2 py-0.5"
              style={{
                background: "transparent",
                color: "var(--status-warning)",
                border: "1px solid rgba(247,185,85,0.30)",
              }}
            >
              <Flag className="h-2.5 w-2.5" aria-hidden />
              {FLAG_LABEL[f] ?? f}
            </span>
          ))}
      </div>
      {alt.sources.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <div className="text-[10.5px] uppercase tracking-[0.6px] font-normal text-[var(--text-mute)]">
            Evidence
          </div>
          <ul className="flex flex-col gap-1.5">
            {alt.sources.map((s, i) => (
              <li key={i}>
                <a
                  href={s.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group rounded-lg px-3 py-2 flex items-start gap-2 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring-accent)]"
                  style={{
                    background: "var(--bg-inset)",
                    border: "1px solid var(--border-faint)",
                  }}
                >
                  <FileSearch className="h-3.5 w-3.5 mt-0.5 text-[var(--text-mute)]" aria-hidden />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-[12.5px] font-normal text-[var(--text)] truncate">
                        {s.title}
                      </span>
                      <span className="text-[10.5px] text-[var(--text-mute)]">
                        {s.domain}
                      </span>
                    </div>
                    {s.snippet && (
                      <p className="text-[11.5px] text-[var(--text-dim)] leading-snug mt-0.5 line-clamp-2">
                        {s.snippet}
                      </p>
                    )}
                  </div>
                  <ArrowUpRight
                    className="h-3.5 w-3.5 text-[var(--text-mute)] shrink-0 group-hover:text-[var(--green-bright)]"
                    aria-hidden
                  />
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}
    </li>
  );
};

/* ─────────── Matrix tab ─────────── */

const MatrixPanel = ({
  points,
  baselines,
  headline,
}: {
  points: MatrixPoint[];
  baselines: WorkspaceBaseline[];
  headline: WorkspaceHeadline;
}) => (
  <div className="flex flex-col gap-5">
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-2">
            <CardTitle>Cost × CO₂e trade-off matrix</CardTitle>
            <span className="text-[11px] text-[var(--text-mute)] inline-flex items-center gap-1">
              <Info className="h-3 w-3" aria-hidden /> bubble size = baseline CO₂e
            </span>
          </div>
          <div className="flex items-center gap-3 text-[11px] text-[var(--text-mute)]">
            {QUADRANT_ORDER.map((q) => (
              <span key={q} className="inline-flex items-center gap-1.5">
                <span
                  className="h-1.5 w-1.5 rounded-full"
                  style={{ background: QUADRANT_COLOR[q] }}
                />
                <span>{QUADRANT_LABEL[q]}</span>
              </span>
            ))}
          </div>
        </div>
      </CardHeader>
      <CardBody>
        <ImpactMatrix points={points} />
      </CardBody>
    </Card>
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      <Card>
        <CardBody className="space-y-2">
          <Stat
            label="Annual CO₂e in scope"
            value={fmtKg(headline.totalCo2)}
            sub={`${fmtEur(headline.totalSpend, 0)}/yr across ${baselines.length} line items`}
          />
          <ConfidenceBar value={headline.avgConfidence} />
        </CardBody>
      </Card>
      <Card>
        <CardBody>
          <Stat
            label="Win-win savings available"
            value={headline.winWinCo2 !== 0 ? signedKg(headline.winWinCo2) : "—"}
            sub={
              headline.winWinCount > 0
                ? `${signedEur(headline.winWinEur)}/yr across ${headline.winWinCount} switch${headline.winWinCount === 1 ? "" : "es"}`
                : "No cheaper-and-greener alternatives found"
            }
            tone={headline.winWinCo2 < 0 ? "positive" : "default"}
          />
        </CardBody>
      </Card>
      <Card>
        <CardBody>
          <Stat
            label="Extra decarbonization budget"
            value={headline.payCo2 !== 0 ? signedKg(headline.payCo2) : "—"}
            sub={
              headline.payCount > 0
                ? `${signedEur(headline.payEur)}/yr to unlock via ${headline.payCount} paid switch${headline.payCount === 1 ? "" : "es"}`
                : "No pay-to-decarbonize options surfaced"
            }
            tone="warning"
          />
        </CardBody>
      </Card>
    </div>
  </div>
);

/* ─────────── Main workspace ─────────── */

export const ImpactsWorkspace = ({
  baselines,
  headline,
  matrixPoints,
  plannableAlts,
  dag,
  researchKpis,
  action,
}: {
  baselines: WorkspaceBaseline[];
  headline: WorkspaceHeadline;
  matrixPoints: MatrixPoint[];
  plannableAlts: PlannableAlternative[];
  dag: DagRunResult | null;
  researchKpis: ResearchKpis | null;
  action: React.ReactNode;
}) => {
  const [tab, setTab] = useState<TabKey>("overview");
  const [lens, setLens] = useState<Lens>("co2");

  const limitations = dag?.executiveReport.limitations ?? [];
  const researchResultsCount = dag?.research?.results.length ?? 0;

  return (
    <div className="flex flex-col gap-6">
      <HeroBriefing
        dag={dag}
        headline={headline}
        baselines={baselines}
        action={action}
        lens={lens}
        onLensChange={setLens}
      />

      <div
        className="sticky top-14 z-20 -mx-2 px-2 py-2 flex items-center gap-2 overflow-x-auto"
        style={{
          background:
            "linear-gradient(180deg, var(--bg-canvas) 0%, var(--bg-canvas) 60%, transparent 100%)",
          backdropFilter: "blur(8px)",
        }}
      >
        <TabButton
          active={tab === "overview"}
          onClick={() => setTab("overview")}
          icon={<LineChart className="h-4 w-4" aria-hidden />}
          label="Overview"
        />
        <TabButton
          active={tab === "matrix"}
          onClick={() => setTab("matrix")}
          icon={<LayoutGrid className="h-4 w-4" aria-hidden />}
          label="Trade-off matrix"
          count={matrixPoints.length}
        />
        <TabButton
          active={tab === "switches"}
          onClick={() => setTab("switches")}
          icon={<ListChecks className="h-4 w-4" aria-hidden />}
          label="Switches"
          count={baselines.length}
        />
        <TabButton
          active={tab === "research"}
          onClick={() => setTab("research")}
          icon={<Beaker className="h-4 w-4" aria-hidden />}
          label="Research"
          count={researchResultsCount || "—"}
        />
      </div>

      {tab === "overview" && (
        <div className="flex flex-col gap-5">
          <ScenarioPlanner alternatives={plannableAlts} />
          {dag ? <TopRecommendations dag={dag} /> : null}
          {limitations.length > 0 && (
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Info className="h-3.5 w-3.5 text-[var(--amber)]" aria-hidden />
                  <CardTitle>Caveats the agents flagged</CardTitle>
                </div>
              </CardHeader>
              <CardBody>
                <ul className="flex flex-col gap-1.5 text-[13px] text-[var(--text-dim)]">
                  {limitations.map((l, i) => (
                    <li key={i} className="flex gap-2">
                      <span className="text-[var(--text-mute)] shrink-0">·</span>
                      <span>{l}</span>
                    </li>
                  ))}
                </ul>
              </CardBody>
            </Card>
          )}
        </div>
      )}

      {tab === "matrix" && (
        <MatrixPanel
          points={matrixPoints}
          baselines={baselines}
          headline={headline}
        />
      )}

      {tab === "switches" && <SwitchesExplorer baselines={baselines} />}

      {tab === "research" && dag && researchKpis && (
        <ResearchInspector dag={dag} kpis={researchKpis} />
      )}
      {tab === "research" && (!dag || !researchKpis) && (
        <Card>
          <CardBody className="py-12 text-center space-y-2">
            <Target
              className="h-8 w-8 mx-auto"
              style={{ color: "var(--green-bright)" }}
              aria-hidden
            />
            <h2 className="text-base font-normal">No DAG run persisted yet</h2>
            <p className="text-sm text-[var(--text-dim)] max-w-md mx-auto">
              Run impact research to populate the research inspector with web-sourced evidence per
              cluster.
            </p>
          </CardBody>
        </Card>
      )}
    </div>
  );
};
