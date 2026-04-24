import Link from "next/link";
import { ArrowRight, Leaf, Zap, Shield, Target, Sparkles } from "lucide-react";
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
  Stat,
} from "@/components/ui";
import { StartCloseButton } from "@/components/StartCloseButton";
import { TrendChart } from "@/components/TrendChart";
import { ClusterConstellation } from "@/components/ClusterConstellation";
import { getActiveRunForOrg } from "@/lib/agent/onboarding";
import {
  DEFAULT_ORG_ID,
  currentMonth,
  getActivePolicyRaw,
  getAllTransactions,
  getCategorySpendForMonth,
  getClustersForMonth,
  getLatestCloseRun,
  getMonthlyTrend,
  getTransactionsForMonth,
  getTaxSavingsForMonth,
} from "@/lib/queries";
import { buildCategoryAnalyses } from "@/lib/agent/impact-analysis";
import { fmtEur, fmtKg } from "@/lib/utils";

export const dynamic = "force-dynamic";

const CAT_COLORS: Record<string, string> = {
  fuel: "var(--cat-fuel)",
  electricity: "var(--cat-electricity)",
  food: "var(--cat-goods)",
  goods: "var(--cat-goods)",
  travel: "var(--cat-travel)",
  digital: "var(--cat-digital)",
  cloud: "var(--cat-digital)",
  services: "var(--cat-services)",
  procurement: "var(--cat-goods)",
};

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

  const taxSavings = getTaxSavingsForMonth(DEFAULT_ORG_ID, month);
  const impactCategories = buildCategoryAnalyses(taxSavings);
  const aboveAvgCount = impactCategories.filter((c) => c.vsAvgPct > 10).length;
  const topSwitch = impactCategories
    .flatMap((c) => c.switchOpportunities)
    .sort((a, b) => b.annualCo2eSavingKg - a.annualCo2eSavingKg)[0];

  const hasRun = !!latestRun && (latestRun.finalCo2eKg != null || latestRun.initialCo2eKg != null);
  const point = latestRun?.finalCo2eKg ?? latestRun?.initialCo2eKg ?? 0;
  const confidence = latestRun?.finalConfidence ?? latestRun?.initialConfidence ?? 0;

  const sortedSpend = [...spendRows].sort((a, b) => (b.spendEur ?? 0) - (a.spendEur ?? 0));
  const maxSpend = Math.max(1, ...sortedSpend.map((s) => s.spendEur ?? 0));

  const stateBadgeTone: "default" | "positive" | "warning" | "info" =
    latestRun?.state === "APPROVED"
      ? "positive"
      : latestRun?.state === "READY"
        ? "info"
        : latestRun?.state === "CLUSTER"
          ? "warning"
          : "default";

  return (
    <div className="flex flex-col gap-8">
      {/* Onboarding banner — minimal, single line */}
      {(!hasPolicy || activeOnboarding) && (
        <div
          className="ca-card flex items-center gap-4 px-5 py-3"
          style={{ borderColor: "var(--brand-green-border)" }}
        >
          <Sparkles className="h-4 w-4 shrink-0" style={{ color: "var(--brand-green)" }} />
          <div className="flex-1 text-sm" style={{ color: "var(--fg-secondary)" }}>
            {activeOnboarding
              ? "Your onboarding is in progress — pick up where you left off."
              : "Carbo needs a carbon policy before it can close the month."}
          </div>
          <Link href={activeOnboarding ? `/onboarding/${activeOnboarding.id}` : "/onboarding"}>
            <Button variant="primary" size="sm">
              {activeOnboarding ? "Resume" : "Start onboarding"}
              <ArrowRight className="h-3.5 w-3.5" />
            </Button>
          </Link>
        </div>
      )}

      {/* Page header */}
      <div className="flex items-end justify-between gap-4">
        <div>
          <CodeLabel className="block mb-3">Acme BV · bunq Business · {month}</CodeLabel>
          <h1
            className="text-[40px] leading-[1.05] tracking-[-0.02em] m-0"
            style={{ color: "var(--fg-primary)" }}
          >
            Monthly overview
          </h1>
        </div>
        <div className="flex gap-2.5">
          <Button variant="ghost" size="sm">Export CSRD</Button>
          <StartCloseButton month={month} latestRunId={latestRun?.id ?? null} />
        </div>
      </div>

      <SectionDivider />

      {/* Hero reserve panel — clean, bordered, no overlays */}
      <div className="ca-card" style={{ padding: 32 }}>
        <div className="flex items-start justify-between gap-6 mb-8">
          <div className="flex items-center gap-2.5">
            <PulseDot />
            <CodeLabel>Carbon reserve · Live</CodeLabel>
          </div>
          <CodeLabel>NL · AFM escrow</CodeLabel>
        </div>

        <div className="flex items-end gap-12 flex-wrap">
          {/* Reserve number */}
          <div className="flex flex-col gap-3 min-w-0">
            <CodeLabel>Reserve balance</CodeLabel>
            <div className="flex items-baseline gap-2">
              <span
                className="text-[32px] leading-none tabular-nums"
                style={{ color: "var(--fg-muted)" }}
              >
                €
              </span>
              <span
                className="text-[68px] leading-none tracking-[-0.02em] tabular-nums"
                style={{ color: "var(--fg-primary)" }}
              >
                {latestRun?.reserveEur ? latestRun.reserveEur.toFixed(2) : "0.00"}
              </span>
            </div>
            <div className="flex items-center gap-3 mt-1">
              <Badge tone="positive">
                {hasRun ? `+${fmtEur(latestRun?.reserveEur ?? 0, 0)} this month` : "No close yet"}
              </Badge>
              <span className="text-[13px]" style={{ color: "var(--fg-muted)" }}>
                {txs.length} transactions ingested
              </span>
            </div>
          </div>

          {/* Adjacent CO2e + confidence */}
          <div className="flex flex-col gap-3 min-w-[220px]">
            <CodeLabel>CO₂e this month</CodeLabel>
            <div
              className="text-[32px] leading-none tabular-nums tracking-[-0.01em]"
              style={{ color: "var(--fg-primary)" }}
            >
              {hasRun ? fmtKg(point) : "—"}
            </div>
            {hasRun ? (
              <ConfidenceBar value={confidence} />
            ) : (
              <div className="text-[13px]" style={{ color: "var(--fg-muted)" }}>
                Pending close
              </div>
            )}
          </div>

          {latestRun && (
            <div className="ml-auto self-end">
              <Link href={`/close/${latestRun.id}`}>
                <Button variant="secondary" size="sm">
                  View close <ArrowRight className="h-3.5 w-3.5" />
                </Button>
              </Link>
            </div>
          )}
        </div>

        <div
          className="mt-8 pt-6 grid grid-cols-2 md:grid-cols-3 gap-6"
          style={{ borderTop: "1px solid var(--border-faint)" }}
        >
          <div>
            <CodeLabel className="block mb-2">Total spend</CodeLabel>
            <div
              className="text-[20px] leading-none tabular-nums"
              style={{ color: "var(--fg-primary)" }}
            >
              {fmtEur(totalSpend, 0)}
            </div>
          </div>
          <div>
            <CodeLabel className="block mb-2">Offset rate</CodeLabel>
            <div
              className="text-[20px] leading-none tabular-nums"
              style={{ color: "var(--fg-primary)" }}
            >
              € 0.028
              <span className="text-[13px] ml-1.5" style={{ color: "var(--fg-muted)" }}>
                / kgCO₂e
              </span>
            </div>
          </div>
          <div>
            <CodeLabel className="block mb-2">Reserve status</CodeLabel>
            <div
              className="text-[20px] leading-none"
              style={{ color: "var(--fg-primary)" }}
            >
              {latestRun?.approved ? "Transferred" : "Pending"}
            </div>
          </div>
        </div>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiChip
          icon={<Leaf className="h-[15px] w-[15px]" />}
          label="This month"
          value={hasRun ? fmtKg(point) : "—"}
          unit="CO₂e"
          trend={hasRun ? `±${Math.round((1 - confidence) * point)} kg` : undefined}
          trendTone="neutral"
        />
        <KpiChip
          icon={<Zap className="h-[15px] w-[15px]" />}
          label="Transactions"
          value={String(txs.length)}
          unit={`of ${allTxs.length}`}
        />
        <KpiChip
          icon={<Sparkles className="h-[15px] w-[15px]" />}
          label="Confidence"
          value={hasRun ? `${Math.round(confidence * 100)}` : "—"}
          unit="%"
          trend={hasRun && confidence >= 0.85 ? "high" : hasRun ? "medium" : undefined}
          trendTone={confidence >= 0.85 ? "green" : "neutral"}
        />
        <KpiChip
          icon={<Shield className="h-[15px] w-[15px]" />}
          label="Reserve"
          value={latestRun?.reserveEur ? fmtEur(latestRun.reserveEur, 0) : "—"}
          unit={latestRun?.approved ? "transferred" : "pending"}
          trendTone="green"
        />
      </div>

      <SectionDivider label="Trend" />

      {/* Emissions trend */}
      <Card>
        <CardHeader>
          <div>
            <CodeLabel className="block mb-2">6-month footprint</CodeLabel>
            <CardTitle>Emissions over time</CardTitle>
          </div>
          <Badge tone="default">kg CO₂e per month</Badge>
        </CardHeader>
        <CardBody>
          <TrendChart data={trend} />
        </CardBody>
      </Card>

      {/* Cluster constellation — agent transparency */}
      {clusters.length > 0 && (
        <>
          <SectionDivider label="Transparency" />
          <ClusterConstellation
            clusters={clusters}
            variant="compact"
            eyebrow="Agent clusters · this month"
            title="Where the agent is uncertain"
          />
        </>
      )}

      {/* Category breakdown — table-like */}
      {sortedSpend.length > 0 && (
        <>
          <SectionDivider label="Breakdown" />
          <Card>
            <CardHeader>
              <div>
                <CodeLabel className="block mb-2">Spend by category</CodeLabel>
                <CardTitle>Where the footprint comes from</CardTitle>
              </div>
              <Link href="/categories">
                <Button variant="ghost" size="sm">
                  Details <ArrowRight className="h-3.5 w-3.5" />
                </Button>
              </Link>
            </CardHeader>
            <CardBody className="px-0 py-0">
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
                const color = CAT_COLORS[(r.category ?? "other").toLowerCase()] ?? "var(--cat-other)";
                return (
                  <div
                    key={r.category ?? i}
                    className="grid grid-cols-[1fr_2fr_auto_auto] gap-x-6 px-6 py-3 items-center"
                    style={{
                      borderBottom:
                        i < Math.min(sortedSpend.length, 6) - 1
                          ? "1px solid var(--border-faint)"
                          : "none",
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
        </>
      )}

      {/* Impact CTA */}
      {impactCategories.length > 0 && (
        <Link href="/impact" className="block group">
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
                  Environmental impact analysis
                </div>
                <div className="text-[12px] mt-0.5" style={{ color: "var(--fg-muted)" }}>
                  {aboveAvgCount > 0
                    ? `${aboveAvgCount} categories above industry average`
                    : "All categories at or below industry average"}
                  {topSwitch ? ` · top switch: ${topSwitch.switchLabel.split("→")[0].trim()}` : ""}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-5 shrink-0">
              {topSwitch && (
                <div className="text-right">
                  <div
                    className="text-[18px] leading-none tabular-nums"
                    style={{ color: "var(--brand-green)" }}
                  >
                    {fmtKg(topSwitch.annualCo2eSavingKg)}
                  </div>
                  <div className="text-[11px] mt-1.5" style={{ color: "var(--fg-muted)" }}>
                    avoidable per year
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
      )}

      {/* Latest close run */}
      {latestRun && (
        <>
          <SectionDivider label="Close" />
          <Card>
            <CardHeader>
              <div>
                <CodeLabel className="block mb-2">Latest close</CodeLabel>
                <CardTitle>Close run · {latestRun.month}</CardTitle>
              </div>
              <div className="flex items-center gap-3">
                <Badge tone={stateBadgeTone}>{latestRun.state}</Badge>
                <Link href={`/close/${latestRun.id}`}>
                  <Button variant="ghost" size="sm">
                    Open <ArrowRight className="h-3.5 w-3.5" />
                  </Button>
                </Link>
              </div>
            </CardHeader>
            <CardBody>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                <Stat
                  label="Initial"
                  value={latestRun.initialCo2eKg != null ? fmtKg(latestRun.initialCo2eKg) : "—"}
                  sub={
                    latestRun.initialConfidence != null
                      ? `${Math.round(latestRun.initialConfidence * 100)}% confidence`
                      : undefined
                  }
                />
                <Stat
                  label="Final"
                  value={latestRun.finalCo2eKg != null ? fmtKg(latestRun.finalCo2eKg) : "—"}
                  sub={
                    latestRun.finalConfidence != null
                      ? `${Math.round(latestRun.finalConfidence * 100)}% confidence`
                      : undefined
                  }
                  tone="positive"
                />
                <Stat
                  label="Reserve"
                  value={latestRun.reserveEur != null ? fmtEur(latestRun.reserveEur, 0) : "—"}
                  sub={latestRun.approved ? "Transferred" : "Awaiting approval"}
                />
                <Stat
                  label="Started"
                  value={new Date(latestRun.startedAt * 1000).toLocaleDateString("en-GB", {
                    day: "2-digit",
                    month: "short",
                    year: "numeric",
                  })}
                />
              </div>
              {latestRun.finalConfidence != null && (
                <div className="mt-5 pt-5" style={{ borderTop: "1px solid var(--border-faint)" }}>
                  <ConfidenceBar value={latestRun.finalConfidence} />
                </div>
              )}
            </CardBody>
          </Card>
        </>
      )}

      {/* Footer */}
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
