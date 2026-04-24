import Link from "next/link";
import { ArrowRight, ArrowDown, ArrowUp, Leaf, Target, Zap, Shield, Sparkles, Check } from "lucide-react";
import {
  Badge,
  Button,
  Card,
  CardBody,
  CardHeader,
  CardTitle,
  ConfidenceBar,
  DonutChart,
  KpiChip,
  PulseDot,
  SectionDivider,
  Stat,
} from "@/components/ui";
import { StartCloseButton } from "@/components/StartCloseButton";
import { TrendChart } from "@/components/TrendChart";
import {
  DEFAULT_ORG_ID,
  currentMonth,
  getAllTransactions,
  getCategorySpendForMonth,
  getLatestCloseRun,
  getMonthlyTrend,
  getTransactionsForMonth,
  getTaxSavingsForMonth,
} from "@/lib/queries";
import { buildCategoryAnalyses } from "@/lib/agent/impact-analysis";
import { fmtEur, fmtKg } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function Overview() {
  const month = currentMonth();
  const txs = getTransactionsForMonth(DEFAULT_ORG_ID, month);
  const allTxs = getAllTransactions(DEFAULT_ORG_ID);
  const spendRows = getCategorySpendForMonth(DEFAULT_ORG_ID, month);
  const totalSpend = spendRows.reduce((s, r) => s + (r.spendEur ?? 0), 0);
  const latestRun = getLatestCloseRun(DEFAULT_ORG_ID);
  const trend = getMonthlyTrend(DEFAULT_ORG_ID, 6);

  const taxSavings = getTaxSavingsForMonth(DEFAULT_ORG_ID, month);
  const impactCategories = buildCategoryAnalyses(taxSavings);
  const aboveAvgCount = impactCategories.filter((c) => c.vsAvgPct > 10).length;
  const topSwitch = impactCategories
    .flatMap((c) => c.switchOpportunities)
    .sort((a, b) => b.annualCo2eSavingKg - a.annualCo2eSavingKg)[0];

  const hasRun = !!latestRun && (latestRun.finalCo2eKg != null || latestRun.initialCo2eKg != null);
  const point = latestRun?.finalCo2eKg ?? latestRun?.initialCo2eKg ?? 0;
  const confidence = latestRun?.finalConfidence ?? latestRun?.initialConfidence ?? 0;

  return (
    <div className="flex flex-col gap-5">
      {/* Green radial glow — fixed background */}
      <div
        className="fixed inset-0 pointer-events-none z-0"
        style={{
          background: `
            radial-gradient(ellipse 1400px 800px at 10% 110%, rgba(48,192,111,0.18), transparent 55%),
            radial-gradient(ellipse 1200px 700px at 90% -10%, rgba(48,192,111,0.09), transparent 50%),
            radial-gradient(ellipse 900px 500px at 50% 50%, rgba(48,192,111,0.04), transparent 60%)
          `,
        }}
      />

      {/* Page content */}
      <div className="relative z-[1] flex flex-col gap-5">
        {/* Header */}
        <div className="flex items-end justify-between mt-2 mb-2">
          <div>
            <div className="text-xs mb-2 tracking-[0.3px]" style={{ color: "var(--text-mute)" }}>
              Acme BV · bunq Business · Carbon Reserve
            </div>
            <h1 className="font-serif text-[44px] font-normal tracking-[-0.035em] leading-none m-0">
              Monthly overview.{" "}
              <span style={{ color: "var(--text-mute)" }}>Here&apos;s {month}.</span>
            </h1>
          </div>
          <div className="flex gap-2.5">
            <Button variant="ghost" size="sm">Export CSRD</Button>
            <StartCloseButton month={month} latestRunId={latestRun?.id ?? null} />
          </div>
        </div>

        <SectionDivider />

        {/* ROW 1 — Hero reserve card + KPI chips */}
        <div className="grid grid-cols-12 gap-5">
          {/* Hero reserve card */}
          <div className="col-span-8 ca-card relative overflow-hidden" style={{ padding: 34, minHeight: 300 }}>
            <div
              className="absolute inset-0 pointer-events-none"
              style={{
                background: "radial-gradient(ellipse 70% 55% at 15% 110%, rgba(48,192,111,0.22), transparent 60%)",
              }}
            />
            <svg className="absolute inset-0 w-full h-full opacity-50 pointer-events-none">
              <defs>
                <pattern id="hero-grid" width="32" height="32" patternUnits="userSpaceOnUse">
                  <path d="M 32 0 L 0 0 0 32" fill="none" stroke="rgba(255,255,255,0.025)" strokeWidth="1" />
                </pattern>
              </defs>
              <rect width="100%" height="100%" fill="url(#hero-grid)" />
            </svg>

            <div className="relative z-[1] flex flex-col h-full">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-2.5">
                  <PulseDot />
                  <span className="text-[11px] uppercase tracking-[0.8px] font-semibold" style={{ color: "var(--text-mute)" }}>
                    Carbon Reserve · Live
                  </span>
                </div>
                <span className="text-[11px] tabular-nums" style={{ color: "var(--text-faint)" }}>
                  NL · AFM escrow
                </span>
              </div>

              <div className="flex items-baseline gap-1.5 mt-1.5">
                <span
                  className="font-serif text-[32px] font-normal leading-none"
                  style={{ color: "var(--green-bright)", textShadow: "0 0 28px rgba(74,222,128,0.6)" }}
                >€</span>
                <span
                  className="font-serif text-[96px] font-normal tracking-[-0.04em] leading-[0.92] tabular-nums"
                  style={{ color: "#fff", textShadow: "0 0 40px rgba(74,222,128,0.25)" }}
                >
                  {latestRun?.reserveEur ? latestRun.reserveEur.toFixed(2) : "0.00"}
                </span>
              </div>

              <div className="flex items-center gap-3 mt-5">
                <Badge tone="positive">
                  <ArrowUp className="h-[11px] w-[11px]" />
                  {hasRun ? fmtEur(latestRun?.reserveEur ?? 0, 0) : "€ 0"} this month
                </Badge>
                <span className="text-[12.5px]" style={{ color: "var(--text-mute)" }}>
                  {txs.length} transactions ingested
                </span>
              </div>

              <div className="mt-auto pt-6 flex gap-5 items-center" style={{ borderTop: "1px solid var(--border-faint)" }}>
                <div>
                  <div className="text-[10px] uppercase tracking-[0.7px] mb-1.5 font-semibold" style={{ color: "var(--text-mute)" }}>Total spend</div>
                  <div className="font-serif text-[26px] font-normal tracking-[-0.02em] tabular-nums" style={{ color: "var(--text)" }}>
                    {fmtEur(totalSpend, 0)}
                  </div>
                </div>
                <div className="w-px h-9" style={{ background: "var(--border-faint)" }} />
                <div>
                  <div className="text-[10px] uppercase tracking-[0.7px] mb-1.5 font-semibold" style={{ color: "var(--text-mute)" }}>Estimated CO₂e</div>
                  <div className="text-[13px] font-medium tabular-nums" style={{ color: "var(--text-dim)" }}>
                    {hasRun ? fmtKg(point) : "Pending close"}
                  </div>
                </div>
                <div className="w-px h-9" style={{ background: "var(--border-faint)" }} />
                <div>
                  <div className="text-[10px] uppercase tracking-[0.7px] mb-1.5 font-semibold" style={{ color: "var(--text-mute)" }}>Offset rate</div>
                  <div className="text-[13px] font-medium tabular-nums" style={{ color: "var(--text-dim)" }}>€ 0.028 / kgCO₂e</div>
                </div>
                <div className="ml-auto">
                  {latestRun && (
                    <Link href={`/close/${latestRun.id}`}>
                      <Button variant="secondary" size="sm">
                        View close <ArrowRight className="h-3.5 w-3.5" />
                      </Button>
                    </Link>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* KPI chip column */}
          <div className="col-span-4 flex flex-col gap-5">
            <KpiChip
              icon={<Leaf className="h-[15px] w-[15px]" />}
              label="This month"
              value={hasRun ? fmtKg(point) : "—"}
              unit="CO₂e"
              trend={hasRun ? "↓ 8.2%" : undefined}
              trendTone="green"
            />
            <KpiChip
              icon={<Zap className="h-[15px] w-[15px]" />}
              label="Transactions"
              value={String(txs.length)}
              unit={`of ${allTxs.length} total`}
              trend={`+${txs.length}`}
              trendTone="neutral"
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
              icon={<Check className="h-[15px] w-[15px]" />}
              label="Reserve allocated"
              value={latestRun?.reserveEur ? fmtEur(latestRun.reserveEur, 0) : "—"}
              unit={latestRun?.approved ? "transferred" : "pending"}
              trend={latestRun?.approved ? "done" : undefined}
              trendTone="green"
            />
          </div>
        </div>

        <SectionDivider label="Analytics" />

        {/* ROW 2 — Emissions trend + How it works */}
        <div className="grid grid-cols-12 gap-5">
          <Card className="col-span-8">
            <CardHeader className="flex items-center justify-between">
              <div>
                <div className="text-[11px] uppercase tracking-[0.8px] font-semibold mb-1.5" style={{ color: "var(--text-mute)" }}>Footprint trend</div>
                <CardTitle>6-month emissions</CardTitle>
              </div>
              <Badge tone="info">kg CO₂e per month</Badge>
            </CardHeader>
            <CardBody>
              <TrendChart data={trend} />
            </CardBody>
          </Card>

          <Card className="col-span-4">
            <CardHeader>
              <div className="text-[11px] uppercase tracking-[0.8px] font-semibold mb-1.5" style={{ color: "var(--text-mute)" }}>How it works</div>
              <CardTitle>Autopilot pipeline</CardTitle>
            </CardHeader>
            <CardBody className="space-y-4 text-[13px]" style={{ color: "var(--text-dim)" }}>
              {[
                { icon: Zap, text: "Webhook ingests every bunq transaction and classifies the merchant." },
                { icon: Sparkles, text: "Monthly close estimates CO₂e with confidence, clusters uncertainty." },
                { icon: ArrowDown, text: "Agent asks 2–3 high-impact questions; confidence lifts." },
                { icon: Shield, text: "Policy engine allocates funds to the Carbon Reserve. Credits are EU-first." },
              ].map(({ icon: Icon, text }) => (
                <div key={text} className="flex gap-3 items-start">
                  <div
                    className="w-7 h-7 rounded-lg grid place-items-center shrink-0 mt-0.5"
                    style={{ background: "rgba(48,192,111,0.08)", border: "1px solid rgba(48,192,111,0.18)" }}
                  >
                    <Icon className="h-3.5 w-3.5" style={{ color: "var(--green-bright)" }} />
                  </div>
                  <span>{text}</span>
                </div>
              ))}
            </CardBody>
          </Card>
        </div>

        <SectionDivider label="Breakdown" />

        {/* ROW 3 — Category spend breakdown with donut */}
        {spendRows.length > 0 && (() => {
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
          const sorted = [...spendRows].sort((a, b) => (b.spendEur ?? 0) - (a.spendEur ?? 0));
          const maxSpend = Math.max(1, ...sorted.map((s) => s.spendEur ?? 0));
          return (
            <Card>
              <CardHeader className="flex items-center justify-between">
                <div>
                  <div className="text-[11px] uppercase tracking-[0.8px] font-semibold mb-1.5" style={{ color: "var(--text-mute)" }}>Spend by category</div>
                  <CardTitle>Where the footprint comes from</CardTitle>
                </div>
                <Link href="/categories">
                  <Button variant="ghost" size="sm">View details <ArrowRight className="h-3.5 w-3.5" /></Button>
                </Link>
              </CardHeader>
              <CardBody>
                <div className="flex gap-8 items-center">
                  <DonutChart
                    className="shrink-0"
                    segments={sorted.slice(0, 6).map((r) => ({
                      label: r.category ?? "other",
                      value: r.spendEur ?? 0,
                      color: CAT_COLORS[(r.category ?? "other").toLowerCase()] ?? "var(--cat-other)",
                    }))}
                  />
                  <div className="flex-1 flex flex-col gap-2.5">
                    {sorted.slice(0, 6).map((r) => {
                      const pct = ((r.spendEur ?? 0) / maxSpend) * 100;
                      const color = CAT_COLORS[(r.category ?? "other").toLowerCase()] ?? "var(--cat-other)";
                      return (
                        <div key={r.category} className="flex items-center gap-4">
                          <div className="flex items-center gap-2 w-28">
                            <span className="w-[6px] h-[6px] rounded-full shrink-0" style={{ background: color }} />
                            <span className="text-[13px] font-medium capitalize" style={{ color: "var(--text)" }}>{r.category}</span>
                          </div>
                          <div className="flex-1 h-[8px] rounded-full relative overflow-hidden" style={{ background: "var(--bg-inset)" }}>
                            <div
                              className="h-full rounded-full"
                              style={{
                                width: `${pct}%`,
                                background: `linear-gradient(90deg, ${color}88, ${color})`,
                                boxShadow: `0 0 6px ${color}44`,
                                animation: "bar-grow 800ms cubic-bezier(.22,.8,.2,1) both",
                                transformOrigin: "left",
                              }}
                            />
                          </div>
                          <div className="w-24 text-right text-[13px] tabular-nums" style={{ color: "var(--text-dim)" }}>{fmtEur(r.spendEur ?? 0, 0)}</div>
                          <div className="w-14 text-right text-xs" style={{ color: "var(--text-faint)" }}>{r.count} tx</div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </CardBody>
            </Card>
          );
        })()}

        <SectionDivider />

        {/* ROW 4 — Impact analysis CTA */}
        {impactCategories.length > 0 && (
          <Link href="/impact" className="block group">
            <div
              className="ca-card flex items-center justify-between p-5"
              style={{
                background: "linear-gradient(135deg, var(--bg-card) 0%, rgba(48,192,111,0.04) 100%)",
              }}
            >
              <div className="flex items-center gap-3.5">
                <div
                  className="w-10 h-10 rounded-xl grid place-items-center shrink-0"
                  style={{
                    background: "rgba(48,192,111,0.10)",
                    border: "1px solid rgba(48,192,111,0.20)",
                  }}
                >
                  <Target className="h-5 w-5" style={{ color: "var(--green-bright)" }} />
                </div>
                <div>
                  <div className="text-sm font-medium" style={{ color: "var(--text)" }}>
                    Environmental impact analysis
                  </div>
                  <div className="text-xs" style={{ color: "var(--text-mute)" }}>
                    {aboveAvgCount > 0
                      ? `${aboveAvgCount} categories above industry average`
                      : "All categories at or below industry average"}
                    {topSwitch ? ` · top switch: ${topSwitch.switchLabel.split("→")[0].trim()}` : ""}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-4">
                {topSwitch && (
                  <div className="text-right">
                    <div className="text-lg font-semibold tabular-nums" style={{ color: "var(--green-bright)" }}>
                      {fmtKg(topSwitch.annualCo2eSavingKg)}
                    </div>
                    <div className="text-[11px]" style={{ color: "var(--text-mute)" }}>avoidable per year</div>
                  </div>
                )}
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" style={{ color: "var(--text-mute)" }} />
              </div>
            </div>
          </Link>
        )}

        <SectionDivider label="Close" />

        {/* ROW 5 — Latest close run */}
        {latestRun && (
          <Card>
            <CardHeader className="flex items-center justify-between">
              <div>
                <div className="text-[11px] uppercase tracking-[0.8px] font-semibold mb-1.5" style={{ color: "var(--text-mute)" }}>Latest close</div>
                <CardTitle>Close run — {latestRun.month}</CardTitle>
              </div>
              <Link href={`/close/${latestRun.id}`} className="text-[13px] flex items-center gap-1.5 hover:underline" style={{ color: "var(--green-bright)" }}>
                Open <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </CardHeader>
            <CardBody className="grid grid-cols-2 md:grid-cols-4 gap-5">
              <Stat label="State" value={latestRun.state} />
              <Stat label="Initial" value={latestRun.initialCo2eKg != null ? fmtKg(latestRun.initialCo2eKg) : "—"} />
              <Stat label="Final" value={latestRun.finalCo2eKg != null ? fmtKg(latestRun.finalCo2eKg) : "—"} />
              <Stat label="Started" value={new Date(latestRun.startedAt * 1000).toLocaleString()} />
            </CardBody>
          </Card>
        )}

        {/* Footer */}
        <div className="mt-8 flex justify-between items-center text-[11px]" style={{ color: "var(--text-faint)" }}>
          <div>Factors: DEFRA 2024 · ADEME Base Carbone · Exiobase v3</div>
          <div>Reserve held in bunq sub-account · Credits EU-based (Puro.earth / Gold Standard)</div>
        </div>
      </div>
    </div>
  );
}
