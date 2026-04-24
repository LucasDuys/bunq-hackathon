import Link from "next/link";
import {
  ArrowLeft,
  Leaf,
  Target,
  TrendingDown,
  Zap,
  Grid3X3,
  BarChart3,
  FlaskConical,
} from "lucide-react";
import {
  Badge,
  Card,
  CardBody,
  CardHeader,
  CardTitle,
  KpiChip,
  PulseDot,
  SectionDivider,
  Stat,
} from "@/components/ui";
import { BenchmarkChart } from "@/components/BenchmarkChart";
import { ImpactMatrix } from "@/components/ImpactMatrix";
import { ImpactSimulator } from "@/components/ImpactSimulator";
import { SwitchCard } from "@/components/SwitchCard";
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

  const matrixItems = analysis.topSwitches.map((sw) => ({
    label: sw.switchLabel.split("→")[0].trim(),
    category: sw.fromFactorId.split(".")[0],
    annualCostSavingEur: sw.annualCostSavingEur,
    annualCo2eSavingKg: sw.annualCo2eSavingKg,
    co2eReductionPct: sw.co2eReductionPct,
  }));

  const allSwitches = analysis.categories.flatMap((c) => c.switchOpportunities);
  const allMatrixItems = allSwitches.map((sw) => ({
    label: sw.switchLabel.split("→")[0].trim(),
    category: sw.fromFactorId.split(".")[0],
    annualCostSavingEur: sw.annualCostSavingEur,
    annualCo2eSavingKg: sw.annualCo2eSavingKg,
    co2eReductionPct: sw.co2eReductionPct,
  }));

  return (
    <div className="flex flex-col gap-5">
      {/* Background glow */}
      <div
        className="fixed inset-0 pointer-events-none z-0"
        style={{
          background: `
            radial-gradient(ellipse 1200px 700px at 50% 0%, rgba(48,192,111,0.10), transparent 55%),
            radial-gradient(ellipse 800px 500px at 80% 100%, rgba(48,192,111,0.06), transparent 50%)
          `,
        }}
      />

      <div className="relative z-[1] flex flex-col gap-5">
        {/* Header */}
        <div>
          <Link
            href="/"
            className="text-xs flex items-center gap-1 mb-2 transition-colors"
            style={{ color: "var(--text-mute)" }}
          >
            <ArrowLeft className="h-3 w-3" /> Back to overview
          </Link>
          <div className="flex items-end justify-between gap-6">
            <div>
              <div
                className="text-xs mb-2 tracking-[0.3px]"
                style={{ color: "var(--text-mute)" }}
              >
                Acme BV · {analysis.month} · {analysis.categories.length} categories analysed
              </div>
              <h1 className="font-serif text-[40px] font-normal tracking-[-0.035em] leading-none">
                Impact analysis.{" "}
                <span style={{ color: "var(--text-mute)" }}>
                  {isAboveAvg
                    ? `${Math.abs(intensityDiff).toFixed(0)}% above average.`
                    : `${Math.abs(intensityDiff).toFixed(0)}% below average.`}
                </span>
              </h1>
            </div>
            <Badge tone={isAboveAvg ? "warning" : "positive"}>
              <PulseDot color={isAboveAvg ? "var(--amber)" : "var(--green)"} />
              {isAboveAvg ? "Above" : "Below"} benchmark
            </Badge>
          </div>
        </div>

        <SectionDivider />

        {/* Hero KPI row */}
        <div className="grid grid-cols-12 gap-5">
          {/* Hero number — total saveable */}
          <div
            className="col-span-5 ca-card relative overflow-hidden"
            style={{ padding: "28px 32px", minHeight: 200 }}
          >
            <div
              className="absolute inset-0 pointer-events-none"
              style={{
                background: "radial-gradient(ellipse 80% 70% at 20% 100%, rgba(48,192,111,0.18), transparent 55%)",
              }}
            />
            <div className="relative z-[1] flex flex-col h-full">
              <div className="flex items-center gap-2 mb-4">
                <Zap className="h-3.5 w-3.5" style={{ color: "var(--green-bright)" }} />
                <span
                  className="text-[11px] uppercase tracking-[0.8px] font-semibold"
                  style={{ color: "var(--text-mute)" }}
                >
                  Annual savings potential
                </span>
              </div>
              <div className="flex items-baseline gap-1.5">
                <span
                  className="font-serif text-[28px] font-normal leading-none"
                  style={{ color: "var(--green-bright)", textShadow: "0 0 20px rgba(74,222,128,0.5)" }}
                >
                  €
                </span>
                <span
                  className="font-serif text-[64px] font-normal tracking-[-0.04em] leading-[0.9] tabular-nums"
                  style={{ color: "#fff", textShadow: "0 0 30px rgba(74,222,128,0.2)" }}
                >
                  {Math.round(analysis.totalAnnualSavingEur).toLocaleString("en-NL")}
                </span>
              </div>
              <div
                className="text-[13px] mt-3"
                style={{ color: "var(--text-mute)" }}
              >
                + {fmtKg(analysis.totalAnnualCo2eSavingKg)} CO₂e avoided per year
              </div>
              <div
                className="mt-auto pt-4 text-[12px]"
                style={{
                  borderTop: "1px solid var(--border-faint)",
                  color: "var(--text-faint)",
                }}
              >
                from {analysis.topSwitches.length} switching opportunities across {analysis.categories.filter((c) => c.switchOpportunities.length > 0).length} categories
              </div>
            </div>
          </div>

          {/* KPI chips */}
          <div className="col-span-7 grid grid-cols-2 gap-5">
            <KpiChip
              icon={<Target className="h-[15px] w-[15px]" />}
              label="Your intensity"
              value={analysis.overallIntensity.toFixed(3)}
              unit="kg CO₂e / EUR"
              trend={`${isAboveAvg ? "+" : ""}${intensityDiff.toFixed(0)}%`}
              trendTone={isAboveAvg ? "red" : "green"}
            />
            <KpiChip
              icon={<BarChart3 className="h-[15px] w-[15px]" />}
              label="Industry average"
              value={analysis.benchmarkIntensity.toFixed(3)}
              unit="kg CO₂e / EUR"
            />
            <KpiChip
              icon={<TrendingDown className="h-[15px] w-[15px]" />}
              label="CO₂e avoidable"
              value={fmtKg(analysis.totalAnnualCo2eSavingKg)}
              unit="per year"
              trend={`${((analysis.totalAnnualCo2eSavingKg / Math.max(analysis.totalCo2eKg * 12, 1)) * 100).toFixed(0)}%`}
              trendTone="green"
            />
            <KpiChip
              icon={<Leaf className="h-[15px] w-[15px]" />}
              label="Monthly footprint"
              value={fmtKg(analysis.totalCo2eKg)}
              unit={`from ${fmtEur(analysis.totalSpendEur, 0)} spend`}
            />
          </div>
        </div>

        {/* AI narrative — styled as a pullquote, not a boring card */}
        <div
          className="relative px-8 py-6 rounded-2xl"
          style={{
            background: "linear-gradient(135deg, var(--bg-card) 0%, rgba(48,192,111,0.03) 100%)",
            borderLeft: "3px solid var(--green)",
          }}
        >
          <div className="flex items-center gap-2 mb-3">
            <div
              className="w-5 h-5 rounded-md grid place-items-center"
              style={{
                background: "rgba(48,192,111,0.12)",
                border: "1px solid rgba(48,192,111,0.20)",
              }}
            >
              <Zap className="h-3 w-3" style={{ color: "var(--green-bright)" }} />
            </div>
            <span
              className="text-[11px] uppercase tracking-[0.8px] font-semibold"
              style={{ color: "var(--green)" }}
            >
              Claude Sonnet analysis
            </span>
          </div>
          <p
            className="text-[14px] leading-[1.7] font-medium"
            style={{ color: "var(--text-dim)" }}
          >
            {analysis.narrative}
          </p>
        </div>

        <SectionDivider label="Impact matrix" />

        {/* 2×2 Impact Matrix + Benchmark chart */}
        <div className="grid grid-cols-12 gap-5">
          <div className="col-span-5">
            <Card>
              <CardHeader className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Grid3X3 className="h-4 w-4" style={{ color: "var(--green)" }} />
                  <CardTitle>Cost vs. carbon matrix</CardTitle>
                </div>
                <Badge tone="info">{allMatrixItems.length} switches</Badge>
              </CardHeader>
              <CardBody>
                <ImpactMatrix items={allMatrixItems} />
              </CardBody>
            </Card>
          </div>
          <div className="col-span-7">
            <BenchmarkChart categories={analysis.categories} />
          </div>
        </div>

        <SectionDivider label="Top switches" />

        {/* Switch cards — before/after visual */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {analysis.topSwitches.slice(0, 4).map((sw, i) => (
            <SwitchCard key={sw.fromFactorId} sw={sw} rank={i + 1} />
          ))}
        </div>

        {analysis.topSwitches.length > 4 && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {analysis.topSwitches.slice(4).map((sw, i) => (
              <SwitchCard key={sw.fromFactorId} sw={sw} rank={i + 5} />
            ))}
          </div>
        )}

        <SectionDivider label="Simulator" />

        {/* What-if simulator */}
        <ImpactSimulator
          categories={analysis.categories}
          totalCo2eKg={analysis.totalCo2eKg}
          totalSpendEur={analysis.totalSpendEur}
        />

        <SectionDivider />

        {/* Methodology — compact footer */}
        <div
          className="grid grid-cols-3 gap-6 py-4"
          style={{ color: "var(--text-mute)" }}
        >
          <div className="flex gap-2.5 items-start text-[12px]">
            <Target
              className="h-3.5 w-3.5 mt-0.5 shrink-0"
              style={{ color: "var(--green-soft)" }}
            />
            <span>
              Intensity from DEFRA 2024 / Exiobase factors. Benchmarks are Exiobase 3.8.2 sector averages, 2024 prices.
            </span>
          </div>
          <div className="flex gap-2.5 items-start text-[12px]">
            <TrendingDown
              className="h-3.5 w-3.5 mt-0.5 shrink-0"
              style={{ color: "var(--green-soft)" }}
            />
            <span>
              Savings include direct price deltas + EU ETS carbon cost avoidance at ~€70/tonne.
            </span>
          </div>
          <div className="flex gap-2.5 items-start text-[12px]">
            <FlaskConical
              className="h-3.5 w-3.5 mt-0.5 shrink-0"
              style={{ color: "var(--green-soft)" }}
            />
            <span>
              Narrative by Claude Sonnet. Projections annualize current-month patterns.
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
