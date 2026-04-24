import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  Leaf,
  Target,
  TrendingDown,
  Zap,
} from "lucide-react";
import {
  Badge,
  Card,
  CardBody,
  CardHeader,
  CardTitle,
  ConfidenceBar,
  Stat,
} from "@/components/ui";
import { BenchmarkChart } from "@/components/BenchmarkChart";
import { ImpactSimulator } from "@/components/ImpactSimulator";
import { DEFAULT_ORG_ID, currentMonth, getTaxSavingsForMonth } from "@/lib/queries";
import { generateImpactAnalysis } from "@/lib/agent/impact-analysis";
import { fmtEur, fmtKg } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function ImpactPage() {
  const month = currentMonth();
  const savings = getTaxSavingsForMonth(DEFAULT_ORG_ID, month);
  const analysis = await generateImpactAnalysis(savings);

  const intensityDiff =
    analysis.benchmarkIntensity > 0
      ? ((analysis.overallIntensity - analysis.benchmarkIntensity) /
          analysis.benchmarkIntensity) *
        100
      : 0;
  const isAboveAvg = intensityDiff > 0;

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div>
        <Link
          href="/"
          className="text-xs flex items-center gap-1 mb-2 transition-colors"
          style={{ color: "var(--text-mute)" }}
        >
          <ArrowLeft className="h-3 w-3" /> Back to overview
        </Link>
        <div className="flex items-start justify-between gap-6">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">
              Environmental impact analysis
            </h1>
            <p className="text-sm mt-1" style={{ color: "var(--text-mute)" }}>
              {analysis.month} · {analysis.categories.length} spending
              categories · powered by Claude Sonnet
            </p>
          </div>
          <Badge tone={isAboveAvg ? "warning" : "positive"}>
            {isAboveAvg ? "Above" : "Below"} industry avg
          </Badge>
        </div>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardBody>
            <Stat
              label="Your carbon intensity"
              value={`${analysis.overallIntensity.toFixed(3)}`}
              sub="kg CO₂e per EUR"
              tone={isAboveAvg ? "warning" : "positive"}
            />
          </CardBody>
        </Card>
        <Card>
          <CardBody>
            <Stat
              label="Industry average"
              value={`${analysis.benchmarkIntensity.toFixed(3)}`}
              sub="kg CO₂e per EUR"
            />
          </CardBody>
        </Card>
        <Card>
          <CardBody>
            <Stat
              label="Annual savings potential"
              value={fmtEur(analysis.totalAnnualSavingEur, 0)}
              sub="from switching opportunities"
              tone="positive"
            />
          </CardBody>
        </Card>
        <Card>
          <CardBody>
            <Stat
              label="CO₂e avoidable per year"
              value={fmtKg(analysis.totalAnnualCo2eSavingKg)}
              sub={`${((analysis.totalAnnualCo2eSavingKg / Math.max(analysis.totalCo2eKg * 12, 1)) * 100).toFixed(0)}% of annual footprint`}
              tone="positive"
            />
          </CardBody>
        </Card>
      </div>

      {/* AI narrative */}
      <Card>
        <CardHeader className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div
              className="w-6 h-6 rounded-lg grid place-items-center"
              style={{
                background: "rgba(48,192,111,0.12)",
                border: "1px solid rgba(48,192,111,0.20)",
              }}
            >
              <Zap
                className="h-3.5 w-3.5"
                style={{ color: "var(--green-bright)" }}
              />
            </div>
            <CardTitle>AI analysis</CardTitle>
          </div>
          <Badge tone="info">Claude Sonnet</Badge>
        </CardHeader>
        <CardBody>
          <p
            className="text-sm leading-relaxed"
            style={{ color: "var(--text-dim)" }}
          >
            {analysis.narrative}
          </p>
        </CardBody>
      </Card>

      {/* Two-column: benchmark chart + top switches */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <BenchmarkChart categories={analysis.categories} />

        <Card>
          <CardHeader className="flex items-center justify-between">
            <CardTitle>Top 5 switching opportunities</CardTitle>
            <Badge tone="positive">ranked by CO₂e impact</Badge>
          </CardHeader>
          <CardBody className="space-y-3">
            {analysis.topSwitches.map((sw, i) => (
              <div
                key={sw.fromFactorId}
                className="flex items-center gap-3 p-3 rounded-xl"
                style={{
                  background: "var(--bg-card-2)",
                  border: "1px solid var(--border-faint)",
                }}
              >
                <div
                  className="w-7 h-7 rounded-lg grid place-items-center text-xs font-bold shrink-0"
                  style={{
                    background: "rgba(48,192,111,0.10)",
                    color: "var(--green-bright)",
                    border: "1px solid rgba(48,192,111,0.20)",
                  }}
                >
                  {i + 1}
                </div>
                <div className="flex-1 min-w-0">
                  <div
                    className="text-sm font-medium truncate"
                    style={{ color: "var(--text)" }}
                  >
                    {sw.switchLabel}
                  </div>
                  <div
                    className="text-xs tabular-nums mt-0.5"
                    style={{ color: "var(--text-mute)" }}
                  >
                    −{sw.co2eReductionPct}% CO₂e · saves{" "}
                    {fmtKg(sw.annualCo2eSavingKg)}/yr
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <div
                    className="text-sm font-semibold tabular-nums"
                    style={{ color: "var(--green-bright)" }}
                  >
                    {fmtEur(sw.annualCostSavingEur, 0)}
                  </div>
                  <div
                    className="text-[11px]"
                    style={{ color: "var(--text-mute)" }}
                  >
                    per year
                  </div>
                </div>
              </div>
            ))}

            {analysis.topSwitches.length === 0 && (
              <div
                className="text-sm text-center py-4"
                style={{ color: "var(--text-mute)" }}
              >
                No switching opportunities found. Run a monthly close first.
              </div>
            )}
          </CardBody>
        </Card>
      </div>

      {/* What-if simulator */}
      <ImpactSimulator
        categories={analysis.categories}
        totalCo2eKg={analysis.totalCo2eKg}
        totalSpendEur={analysis.totalSpendEur}
      />

      {/* Methodology */}
      <Card>
        <CardHeader>
          <CardTitle>How we calculate this</CardTitle>
        </CardHeader>
        <CardBody
          className="space-y-3 text-sm"
          style={{ color: "var(--text-mute)" }}
        >
          <div className="flex gap-2 items-start">
            <Target
              className="h-4 w-4 mt-0.5 shrink-0"
              style={{ color: "var(--green)" }}
            />
            <span>
              Carbon intensity (kg CO₂e per EUR) is calculated from your
              actual spending using DEFRA 2024 / Exiobase emission factors.
              Industry benchmarks are Exiobase 3.8.2 sector averages adjusted
              for 2024 price levels.
            </span>
          </div>
          <div className="flex gap-2 items-start">
            <TrendingDown
              className="h-4 w-4 mt-0.5 shrink-0"
              style={{ color: "var(--green)" }}
            />
            <span>
              Switching opportunities use real alternative factors and price
              ratios. Cost savings include direct price differences and indirect
              EU ETS carbon cost avoidance at ~€70/tonne.
            </span>
          </div>
          <div className="flex gap-2 items-start">
            <Leaf
              className="h-4 w-4 mt-0.5 shrink-0"
              style={{ color: "var(--green)" }}
            />
            <span>
              The AI narrative is generated by Claude Sonnet, analysing your
              data against industry patterns. Projections assume current-month
              spending continues for 12 months.
            </span>
          </div>
        </CardBody>
      </Card>
    </div>
  );
}
