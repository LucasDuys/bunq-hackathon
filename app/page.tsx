import Link from "next/link";
import {
  Activity,
  AlertCircle,
  ArrowRight,
  Calculator,
  CheckCircle2,
  Leaf,
  ShieldCheck,
  Sparkles,
  Tags,
  Target,
  Zap,
} from "lucide-react";
import {
  Badge,
  Button,
  Card,
  CardBody,
  CardHeader,
  CardTitle,
  CodeLabel,
  ConfidenceBar,
  KpiChip,
  PulseDot,
  SectionDivider,
} from "@/components/ui";
import { StartCloseButton } from "@/components/StartCloseButton";
import { TrendChart } from "@/components/TrendChart";
import { ClusterConstellation } from "@/components/ClusterConstellation";
import { ExplainButton } from "@/components/ExplainButton";
import { getActiveRunForOrg } from "@/lib/agent/onboarding";
import {
  DEFAULT_ORG_ID,
  currentMonth,
  getActivePolicyRaw,
  getAllTransactions,
  getCategorySpendForMonth,
  getClustersForMonth,
  getLatestCloseRun,
  getLatestEstimatesForMonth,
  getMonthlyTrend,
  getQuestionsForRun,
  getTaxSavingsForMonth,
  getTransactionsForMonth,
} from "@/lib/queries";
import { buildCategoryAnalyses } from "@/lib/agent/impact-analysis";
import { fmtEur, fmtKg } from "@/lib/utils";

export const dynamic = "force-dynamic";

type HeroState = "cold-start" | "ready-to-run" | "in-progress" | "ready-to-approve" | "approved";

const CAT_COLORS: Record<string, string> = {
  fuel: "var(--cat-fuel)",
  electricity: "var(--cat-electricity)",
  food: "var(--cat-goods)",
  goods: "var(--cat-goods)",
  travel: "var(--cat-travel)",
  digital: "var(--cat-digital)",
  cloud: "var(--cat-digital)",
  services: "var(--cat-services)",
  procurement: "var(--cat-services)",
};

const catToken = (cat: string): string => {
  const c = cat.toLowerCase();
  if (c.includes("fuel") || c.includes("scope1") || c.includes("combust")) return "var(--cat-fuel)";
  if (c.includes("electric") || c.includes("energy") || c.includes("power"))
    return "var(--cat-electricity)";
  if (
    c.includes("travel") ||
    c.includes("transport") ||
    c.includes("flight") ||
    c.includes("logistic")
  )
    return "var(--cat-travel)";
  if (c.includes("digital") || c.includes("saas") || c.includes("cloud") || c.includes("software"))
    return "var(--cat-digital)";
  if (c.includes("service") || c.includes("professional")) return "var(--cat-services)";
  if (
    c.includes("good") ||
    c.includes("procure") ||
    c.includes("supply") ||
    c.includes("food")
  )
    return "var(--cat-goods)";
  return "var(--cat-other)";
};

/**
 * Mirror of the close-page state→phase map (DESIGN.md §4.10), but trimmed
 * to four mini dots for the dashboard rail. Keep in sync with
 * app/close/[id]/page.tsx STATE_TO_PHASE.
 */
const MINI_PHASES = [
  { key: "INGEST", label: "Ingest", icon: Zap },
  { key: "ESTIMATE", label: "Estimate", icon: Calculator },
  { key: "REVIEW", label: "Review", icon: AlertCircle },
  { key: "APPROVE", label: "Approve", icon: CheckCircle2 },
] as const;

const stateToMiniPhaseIdx = (state: string | undefined): number => {
  switch (state) {
    case "AGGREGATE":
      return 0;
    case "ESTIMATE_INITIAL":
    case "APPLY_ANSWERS":
    case "ESTIMATE_FINAL":
      return 1;
    case "CLUSTER_UNCERTAINTY":
    case "QUESTIONS_GENERATED":
    case "AWAITING_ANSWERS":
      return 2;
    case "APPLY_POLICY":
    case "PROPOSED":
    case "AWAITING_APPROVAL":
    case "EXECUTING":
      return 3;
    case "COMPLETED":
      return 4;
    default:
      return 0;
  }
};

const TERMINAL_CLOSE_STATES = new Set(["COMPLETED", "FAILED"]);

export default async function Overview() {
  const month = currentMonth();
  const txs = getTransactionsForMonth(DEFAULT_ORG_ID, month);
  const allTxs = getAllTransactions(DEFAULT_ORG_ID);
  const spendRows = getCategorySpendForMonth(DEFAULT_ORG_ID, month);
  const totalSpend = spendRows.reduce((s, r) => s + (r.spendEur ?? 0), 0);
  const latestRun = getLatestCloseRun(DEFAULT_ORG_ID);
  const trend = getMonthlyTrend(DEFAULT_ORG_ID, 6);
  const activeOnboarding = getActiveRunForOrg(DEFAULT_ORG_ID);
  const hasPolicy = !!getActivePolicyRaw(DEFAULT_ORG_ID);
  const clusters = getClustersForMonth(DEFAULT_ORG_ID, month);
  const estimates = getLatestEstimatesForMonth(DEFAULT_ORG_ID, month);

  const taxSavings = getTaxSavingsForMonth(DEFAULT_ORG_ID, month);
  const impactCategories = buildCategoryAnalyses(taxSavings);
  const aboveAvgCount = impactCategories.filter((c) => c.vsAvgPct > 10).length;
  const topSwitches = impactCategories
    .flatMap((c) => c.switchOpportunities)
    .sort((a, b) => b.annualCo2eSavingKg - a.annualCo2eSavingKg);
  const topSwitch = topSwitches[0];
  const annualAvoidableKg = topSwitches
    .slice(0, 5)
    .reduce((s, x) => s + x.annualCo2eSavingKg, 0);
  const annualSavingsEur = topSwitches
    .slice(0, 5)
    .reduce((s, x) => s + x.annualCostSavingEur, 0);

  const hasRun =
    !!latestRun && (latestRun.finalCo2eKg != null || latestRun.initialCo2eKg != null);
  const co2ePoint = latestRun?.finalCo2eKg ?? latestRun?.initialCo2eKg ?? 0;
  const confidence = latestRun?.finalConfidence ?? latestRun?.initialConfidence ?? 0;

  // Hero state machine — single source of truth for headline, copy, CTA.
  const isInProgress =
    !!latestRun && !TERMINAL_CLOSE_STATES.has(latestRun.state) && latestRun.state !== "READY_FOR_APPROVAL";
  const isAwaitingApproval =
    !!latestRun &&
    (latestRun.state === "PROPOSED" || latestRun.state === "AWAITING_APPROVAL");
  const isApproved = !!latestRun && latestRun.state === "COMPLETED";

  let heroState: HeroState;
  if (!hasPolicy) heroState = "cold-start";
  else if (isApproved) heroState = "approved";
  else if (isAwaitingApproval) heroState = "ready-to-approve";
  else if (isInProgress) heroState = "in-progress";
  else heroState = "ready-to-run";

  const unanswered = latestRun ? getQuestionsForRun(latestRun.id).filter((q) => !q.answer).length : 0;
  const miniPhaseIdx = stateToMiniPhaseIdx(latestRun?.state);

  const sortedSpend = [...spendRows].sort((a, b) => (b.spendEur ?? 0) - (a.spendEur ?? 0));
  const maxSpend = Math.max(1, ...sortedSpend.map((s) => s.spendEur ?? 0));

  // Per-category confidence (spend-weighted) — drill-down rolled in from /categories.
  const catConfidence = new Map<string, { num: number; den: number }>();
  for (const e of estimates) {
    const cat = e.category ?? "other";
    const w = Math.max(1, e.co2eKgPoint);
    const cw = catConfidence.get(cat) ?? { num: 0, den: 0 };
    cw.num += (e.confidence ?? 0) * w;
    cw.den += w;
    catConfidence.set(cat, cw);
  }
  const catConfRows = sortedSpend.map((r) => {
    const cw = catConfidence.get(r.category ?? "other");
    return {
      category: r.category ?? "other",
      spendEur: r.spendEur ?? 0,
      count: r.count ?? 0,
      confidence: cw && cw.den > 0 ? cw.num / cw.den : 0,
    };
  });

  // Show standalone onboarding banner only on a true cold-start (no policy AND
  // no active onboarding). Otherwise the sidebar callout already covers this.
  const showOnboardingBanner = !hasPolicy && !activeOnboarding;

  return (
    <div className="flex flex-col gap-8">
      {/* Cold-start onboarding banner */}
      {showOnboardingBanner && (
        <div
          className="ca-card flex items-center gap-4 px-5 py-3"
          style={{ borderColor: "var(--brand-green-border)" }}
        >
          <Sparkles className="h-4 w-4 shrink-0" style={{ color: "var(--brand-green)" }} />
          <div className="flex-1 text-sm" style={{ color: "var(--fg-secondary)" }}>
            Carbo needs a carbon policy before it can close the month.
          </div>
          <Link href="/onboarding">
            <Button variant="primary" size="sm">
              Start onboarding
              <ArrowRight className="h-3.5 w-3.5" />
            </Button>
          </Link>
        </div>
      )}

      {/* Page header — no top-right CTA. The hero owns the only primary CTA. */}
      <div>
        <CodeLabel className="block mb-3">Acme BV · bunq Business · {month}</CodeLabel>
        <h1
          className="text-[40px] leading-[1.05] tracking-[-0.02em] m-0"
          style={{ color: "var(--fg-primary)" }}
        >
          Monthly overview
        </h1>
      </div>

      <SectionDivider />

      {/* ─── Hero — close run is the product ─── */}
      <HeroCard
        heroState={heroState}
        month={month}
        latestRun={latestRun}
        co2ePoint={co2ePoint}
        confidence={confidence}
        miniPhaseIdx={miniPhaseIdx}
        unanswered={unanswered}
        txCount={txs.length}
        onboardingHref={activeOnboarding ? `/onboarding/${activeOnboarding.id}` : "/onboarding"}
        onboardingLabel={activeOnboarding ? "Continue onboarding" : "Start onboarding"}
      />

      {/* ─── KPI strip ─── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiChip
          icon={<Leaf className="h-[15px] w-[15px]" />}
          label="This month"
          value={hasRun ? fmtKg(co2ePoint) : "—"}
          unit="CO₂e"
          trend={hasRun ? `±${Math.round((1 - confidence) * co2ePoint)} kg` : undefined}
          trendTone="neutral"
          action={<ExplainButton metric="month-co2e" scope={{ month }} size="xs" />}
        />
        <KpiChip
          icon={<Sparkles className="h-[15px] w-[15px]" />}
          label="Confidence"
          value={hasRun ? `${Math.round(confidence * 100)}` : "—"}
          unit="%"
          trend={hasRun && confidence >= 0.85 ? "high" : hasRun ? "medium" : undefined}
          trendTone={confidence >= 0.85 ? "green" : "neutral"}
          action={<ExplainButton metric="month-confidence" scope={{ month }} size="xs" />}
        />
        <KpiChip
          icon={<ShieldCheck className="h-[15px] w-[15px]" />}
          label="Reserve"
          value={latestRun?.reserveEur ? fmtEur(latestRun.reserveEur, 0) : "—"}
          unit={latestRun?.approved ? "transferred" : "pending"}
          trendTone="green"
          action={<ExplainButton metric="month-reserve" scope={{ month }} size="xs" />}
        />
        <KpiChip
          icon={<Zap className="h-[15px] w-[15px]" />}
          label="Transactions"
          value={String(txs.length)}
          unit={`of ${allTxs.length}`}
          action={<ExplainButton metric="month-transactions" scope={{ month }} size="xs" />}
        />
      </div>

      <SectionDivider label="Trend" />

      {/* ─── 6-month trend ─── */}
      <Card>
        <CardHeader>
          <div>
            <CodeLabel className="block mb-2">6-month footprint</CodeLabel>
            <CardTitle>Emissions over time</CardTitle>
          </div>
          <div className="flex items-center gap-2">
            <Badge tone="default">kg CO₂e per month</Badge>
            <ExplainButton metric="trend" />
          </div>
        </CardHeader>
        <CardBody>
          <TrendChart data={trend} />
        </CardBody>
      </Card>

      {/* ─── Spend by category (with drill-down disclosure) ─── */}
      {sortedSpend.length > 0 && (
        <>
          <SectionDivider label="Breakdown" />
          <Card>
            <CardHeader>
              <div>
                <CodeLabel className="block mb-2">Spend by category</CodeLabel>
                <CardTitle>Where the footprint comes from</CardTitle>
              </div>
              <ExplainButton metric="month-co2e" scope={{ month }} />
            </CardHeader>
            <CardBody className="px-0 py-0">
              {/* Top-6 inline (matches old dashboard) */}
              <div
                className="grid grid-cols-[1fr_2fr_auto_auto] gap-x-6 px-6 py-3"
                style={{ borderBottom: "1px solid var(--border-faint)" }}
              >
                <CodeLabel>Category</CodeLabel>
                <CodeLabel>Share</CodeLabel>
                <CodeLabel className="text-right">Spend</CodeLabel>
                <CodeLabel className="text-right">Tx</CodeLabel>
              </div>
              {sortedSpend.slice(0, 6).map((r, i) => {
                const pct = ((r.spendEur ?? 0) / maxSpend) * 100;
                const color =
                  CAT_COLORS[(r.category ?? "other").toLowerCase()] ?? catToken(r.category ?? "");
                const isLast = i === Math.min(sortedSpend.length, 6) - 1;
                return (
                  <div
                    key={r.category ?? i}
                    className="grid grid-cols-[1fr_2fr_auto_auto] gap-x-6 px-6 py-3 items-center"
                    style={{
                      borderBottom: isLast ? "none" : "1px solid var(--border-faint)",
                    }}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span
                        className="w-[6px] h-[6px] rounded-full shrink-0"
                        style={{ background: color }}
                      />
                      <span
                        className="text-[13px] capitalize truncate"
                        style={{ color: "var(--fg-primary)" }}
                      >
                        {r.category}
                      </span>
                    </div>
                    <div
                      className="h-[6px] rounded-full overflow-hidden"
                      style={{ background: "var(--bg-inset)" }}
                    >
                      <div
                        className="h-full rounded-full"
                        style={{ width: `${pct}%`, background: color }}
                      />
                    </div>
                    <div
                      className="text-[13px] tabular-nums text-right"
                      style={{ color: "var(--fg-primary)" }}
                    >
                      {fmtEur(r.spendEur ?? 0, 0)}
                    </div>
                    <div
                      className="text-[12px] tabular-nums text-right w-12"
                      style={{ color: "var(--fg-muted)" }}
                    >
                      {r.count}
                    </div>
                  </div>
                );
              })}
            </CardBody>
          </Card>

          {/* Drill-down: per-category confidence + cluster constellation. */}
          {(catConfRows.length > 6 || clusters.length > 0) && (
            <details className="group">
              <summary
                className="flex items-center gap-2 cursor-pointer select-none px-1"
                style={{ color: "var(--fg-secondary)" }}
              >
                <CodeLabel>View by category &amp; agent uncertainty</CodeLabel>
                <ArrowRight className="h-3.5 w-3.5 transition-transform group-open:rotate-90" />
              </summary>
              <div className="mt-6 flex flex-col gap-6">
                {catConfRows.length > 0 && (
                  <Card>
                    <CardHeader>
                      <div>
                        <CodeLabel className="block mb-2">Confidence per category</CodeLabel>
                        <CardTitle>How sure we are, by category</CardTitle>
                      </div>
                      <div className="flex items-center gap-2">
                        <CodeLabel>{month}</CodeLabel>
                        <ExplainButton metric="month-confidence" scope={{ month }} />
                      </div>
                    </CardHeader>
                    <CardBody className="p-0">
                      <table className="w-full text-[13px]">
                        <thead>
                          <tr style={{ borderBottom: "1px solid var(--border-faint)" }}>
                            <th className="text-left px-6 py-3">
                              <CodeLabel>Category</CodeLabel>
                            </th>
                            <th className="text-left px-4 py-3">
                              <CodeLabel>Confidence</CodeLabel>
                            </th>
                            <th className="text-right px-4 py-3">
                              <CodeLabel>Spend</CodeLabel>
                            </th>
                            <th className="text-right px-6 py-3">
                              <CodeLabel>Tx</CodeLabel>
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {catConfRows.map((r) => (
                            <tr
                              key={r.category}
                              style={{ borderBottom: "1px solid var(--border-faint)" }}
                            >
                              <td className="px-6 py-3.5">
                                <div className="flex items-center gap-2.5">
                                  <span
                                    className="inline-block rounded-full shrink-0"
                                    style={{
                                      width: 6,
                                      height: 6,
                                      background: catToken(r.category),
                                    }}
                                    aria-hidden
                                  />
                                  <span
                                    className="capitalize"
                                    style={{ color: "var(--fg-primary)" }}
                                  >
                                    {r.category.replace(/_/g, " ")}
                                  </span>
                                </div>
                              </td>
                              <td className="px-4 py-3.5 w-[240px]">
                                <ConfidenceBar value={r.confidence} />
                              </td>
                              <td
                                className="px-4 py-3.5 text-right tabular-nums"
                                style={{ color: "var(--fg-secondary)" }}
                              >
                                {fmtEur(r.spendEur, 0)}
                              </td>
                              <td
                                className="px-6 py-3.5 text-right tabular-nums"
                                style={{ color: "var(--fg-muted)" }}
                              >
                                {r.count}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </CardBody>
                  </Card>
                )}

                {clusters.length > 0 && (
                  <ClusterConstellation
                    clusters={clusters}
                    variant="compact"
                    eyebrow="Agent clusters · this month"
                    title="Where the agent is uncertain"
                  />
                )}
              </div>
            </details>
          )}
        </>
      )}

      {/* ─── Impact Insights teaser — dual lens ─── */}
      {impactCategories.length > 0 && (
        <div className="relative">
          <div className="absolute top-3 right-3 z-10">
            <ExplainButton metric="impact-summary" size="xs" />
          </div>
          <Link href="/impacts" className="block group">
          <div className="ca-card ca-card--hover flex items-center justify-between px-5 py-4">
            <div className="flex items-center gap-3.5 min-w-0">
              <div
                className="w-9 h-9 rounded-[6px] grid place-items-center shrink-0"
                style={{
                  background: "var(--bg-inset)",
                  border: "1px solid var(--border-faint)",
                  color: "var(--brand-green)",
                }}
              >
                <Target className="h-4 w-4" />
              </div>
              <div className="min-w-0">
                <div className="text-[14px]" style={{ color: "var(--fg-primary)" }}>
                  Impact workspace · price-vs-environment matrix
                </div>
                <div className="text-[12px] mt-0.5" style={{ color: "var(--fg-muted)" }}>
                  {aboveAvgCount > 0
                    ? `${aboveAvgCount} categories above industry average`
                    : "All categories at or below industry average"}
                  {topSwitch
                    ? ` · top switch: ${topSwitch.switchLabel.split("→")[0].trim()}`
                    : ""}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-6 shrink-0">
              {annualAvoidableKg > 0 && (
                <div className="text-right">
                  <div
                    className="text-[18px] leading-none tabular-nums"
                    style={{ color: "var(--brand-green)" }}
                  >
                    {fmtKg(annualAvoidableKg)}
                  </div>
                  <div className="text-[11px] mt-1.5" style={{ color: "var(--fg-muted)" }}>
                    avoidable per year
                  </div>
                </div>
              )}
              {annualSavingsEur > 0 && (
                <div
                  className="text-right hidden sm:block pl-6"
                  style={{ borderLeft: "1px solid var(--border-faint)" }}
                >
                  <div
                    className="text-[18px] leading-none tabular-nums"
                    style={{ color: "var(--fg-primary)" }}
                  >
                    {fmtEur(annualSavingsEur, 0)}
                  </div>
                  <div className="text-[11px] mt-1.5" style={{ color: "var(--fg-muted)" }}>
                    annual savings
                  </div>
                </div>
              )}
              <ArrowRight
                className="h-4 w-4 transition-transform group-hover:translate-x-0.5"
                style={{ color: "var(--fg-muted)" }}
              />
            </div>
          </div>
        </Link>
        </div>
      )}

      {/* ─── Footer attribution ─── */}
      <div
        className="mt-4 pt-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2"
        style={{ borderTop: "1px solid var(--border-faint)" }}
      >
        <CodeLabel>Factors · DEFRA 2024 · ADEME Base Carbone · Exiobase v3</CodeLabel>
        <CodeLabel>Reserve · bunq sub-account · Credits Puro.earth / Gold Standard</CodeLabel>
      </div>
    </div>
  );
}

/* ─── Hero card (server component) ─── */

type HeroLatestRun = ReturnType<typeof getLatestCloseRun>;

const HeroCard = ({
  heroState,
  month,
  latestRun,
  co2ePoint,
  confidence,
  miniPhaseIdx,
  unanswered,
  txCount,
  onboardingHref,
  onboardingLabel,
}: {
  heroState: HeroState;
  month: string;
  latestRun: HeroLatestRun;
  co2ePoint: number;
  confidence: number;
  miniPhaseIdx: number;
  unanswered: number;
  txCount: number;
  onboardingHref: string;
  onboardingLabel: string;
}) => {
  const reserveEur = latestRun?.reserveEur ?? 0;

  const eyebrow = (() => {
    switch (heroState) {
      case "cold-start":
        return "Get started";
      case "ready-to-run":
        return `Monthly close · ${month} · ready`;
      case "in-progress":
        return `Monthly close · ${month} · running`;
      case "ready-to-approve":
        return `Monthly close · ${month} · awaiting approval`;
      case "approved":
        return `Monthly close · ${month} · transferred`;
    }
  })();

  const headline = (() => {
    switch (heroState) {
      case "cold-start":
        return "Carbo is ready when you are.";
      case "ready-to-run":
        return `Run carbon close for ${month}.`;
      case "in-progress":
        return unanswered > 0
          ? `${unanswered} ${unanswered === 1 ? "question" : "questions"} for you.`
          : "Carbo is closing the month.";
      case "ready-to-approve":
        return `Reserve €${reserveEur.toFixed(2)} ready to transfer.`;
      case "approved":
        return `${fmtKg(co2ePoint)} closed and reserved.`;
    }
  })();

  const sub = (() => {
    switch (heroState) {
      case "cold-start":
        return "Walk through onboarding and we'll calibrate a carbon policy from your last 90 days of bunq spend.";
      case "ready-to-run":
        return `${txCount} transactions ingested this month. Run the close to get a CO₂e estimate, refinement questions, and a reserve recommendation.`;
      case "in-progress":
        return "Pick up where you left off — answer the agent's questions and we'll recompute on the spot.";
      case "ready-to-approve":
        return `${fmtKg(co2ePoint)} estimated. Approve to fund the carbon reserve sub-account and queue EU credit retirement.`;
      case "approved":
        return "Reserve transferred and audit chain extended. Run the next close from the 1st of next month.";
    }
  })();

  return (
    <div className="ca-card" style={{ padding: 32, borderColor: "var(--brand-green-border)" }}>
      {/* Top row — eyebrow + state badge */}
      <div className="flex items-start justify-between gap-6 mb-7">
        <div className="flex items-center gap-2.5">
          {heroState === "in-progress" ? (
            <PulseDot color="var(--status-warning)" />
          ) : heroState === "approved" ? (
            <PulseDot color="var(--status-success)" />
          ) : heroState === "ready-to-approve" ? (
            <PulseDot color="var(--brand-green)" />
          ) : (
            <Activity className="h-3.5 w-3.5" style={{ color: "var(--fg-muted)" }} />
          )}
          <CodeLabel>{eyebrow}</CodeLabel>
        </div>
        <CodeLabel>NL · AFM escrow · {month}</CodeLabel>
      </div>

      {/* Headline + sub */}
      <div className="flex flex-col gap-3 max-w-[60ch]">
        <h2
          className="text-[36px] leading-[1.05] tracking-[-0.015em] m-0"
          style={{ color: "var(--fg-primary)" }}
        >
          {headline}
        </h2>
        <p className="text-[14px] leading-[1.5]" style={{ color: "var(--fg-secondary)" }}>
          {sub}
        </p>
      </div>

      {/* Mini rail (only when there's a run) */}
      {latestRun && (
        <div className="flex items-center gap-2 mt-7">
          {MINI_PHASES.map((phase, i) => {
            const isDone = i < miniPhaseIdx;
            const isActive = i === miniPhaseIdx && heroState !== "approved";
            const isApproved = heroState === "approved";
            const dotColor = isApproved
              ? "var(--brand-green)"
              : isDone
                ? "var(--brand-green)"
                : isActive
                  ? "var(--status-warning)"
                  : "var(--border-default)";
            return (
              <div key={phase.key} className="flex items-center gap-2">
                <span
                  className="inline-block rounded-full"
                  style={{
                    width: 8,
                    height: 8,
                    background: dotColor,
                    animation: isActive ? "pulse-dot 1.5s ease-in-out infinite" : "none",
                  }}
                  aria-hidden
                />
                <span
                  className="code-label"
                  style={{
                    color:
                      isDone || isApproved || isActive
                        ? "var(--fg-secondary)"
                        : "var(--fg-faint)",
                  }}
                >
                  {phase.label}
                </span>
                {i < MINI_PHASES.length - 1 && (
                  <span
                    className="inline-block"
                    style={{
                      width: 16,
                      height: 1,
                      background: "var(--border-faint)",
                      margin: "0 4px",
                    }}
                    aria-hidden
                  />
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Metrics + CTA row */}
      <div
        className="mt-8 pt-7 flex items-end justify-between gap-6 flex-wrap"
        style={{ borderTop: "1px solid var(--border-faint)" }}
      >
        {/* Numbers */}
        <div className="flex items-end gap-12 flex-wrap min-w-0">
          {(heroState === "in-progress" ||
            heroState === "ready-to-approve" ||
            heroState === "approved") && (
            <div className="flex flex-col gap-3 min-w-[180px]">
              <CodeLabel>CO₂e this month</CodeLabel>
              <div
                className="text-[40px] leading-none tabular-nums tracking-[-0.015em]"
                style={{ color: "var(--fg-primary)" }}
              >
                {fmtKg(co2ePoint)}
              </div>
              <ConfidenceBar value={confidence} />
            </div>
          )}
          {(heroState === "ready-to-approve" || heroState === "approved") && (
            <div className="flex flex-col gap-3 min-w-[180px]">
              <CodeLabel>Reserve</CodeLabel>
              <div className="flex items-baseline gap-1.5">
                <span
                  className="text-[24px] leading-none tabular-nums"
                  style={{ color: "var(--fg-muted)" }}
                >
                  €
                </span>
                <span
                  className="text-[40px] leading-none tabular-nums tracking-[-0.015em]"
                  style={{ color: "var(--fg-primary)" }}
                >
                  {reserveEur.toFixed(2)}
                </span>
              </div>
              <Badge tone={heroState === "approved" ? "positive" : "info"}>
                {heroState === "approved" ? "Transferred" : "Awaiting approval"}
              </Badge>
            </div>
          )}
          {heroState === "ready-to-run" && (
            <div className="flex flex-col gap-3 min-w-[180px]">
              <CodeLabel>Transactions ready</CodeLabel>
              <div
                className="text-[40px] leading-none tabular-nums tracking-[-0.015em]"
                style={{ color: "var(--fg-primary)" }}
              >
                {txCount}
              </div>
              <span className="text-[12px]" style={{ color: "var(--fg-muted)" }}>
                Ingested via webhook
              </span>
            </div>
          )}
        </div>

        {/* Single primary CTA */}
        <div className="flex items-center gap-2.5 ml-auto">
          {heroState === "cold-start" && (
            <Link href={onboardingHref}>
              <Button variant="primary" size="md" className="gap-2">
                {onboardingLabel}
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          )}
          {heroState === "ready-to-run" && (
            <StartCloseButton month={month} label={`Run carbon close · ${month}`} />
          )}
          {heroState === "in-progress" && latestRun && (
            <Link href={`/close/${latestRun.id}`}>
              <Button variant="primary" size="md" className="gap-2">
                {unanswered > 0 ? "Answer questions" : "Continue close"}
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          )}
          {heroState === "ready-to-approve" && latestRun && (
            <Link href={`/close/${latestRun.id}`}>
              <Button variant="primary" size="md" className="gap-2">
                Review &amp; approve · {fmtEur(reserveEur, 0)}
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          )}
          {heroState === "approved" && latestRun && (
            <Link href={`/close/${latestRun.id}`}>
              <Button variant="secondary" size="md" className="gap-2">
                View close
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          )}
        </div>
      </div>
    </div>
  );
};
