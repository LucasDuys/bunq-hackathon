import { MODEL_SONNET, anthropic, withAnthropicFallback } from "@/lib/anthropic/client";
import { type MonthlySavingsSummary } from "@/lib/tax";
import { BENCHMARKS, benchmarkFor, type Benchmark } from "@/lib/benchmarks";
import { GREEN_ALTERNATIVES, type GreenAlternative } from "@/lib/tax/alternatives";
import { factorById } from "@/lib/factors";

// ── Types ──────────────────────────────────────────────────────────

export type CategoryAnalysis = {
  category: string;
  label: string;
  spendEur: number;
  co2eKg: number;
  intensity: number;
  benchmarkAvg: number;
  benchmarkTopQuartile: number;
  vsAvgPct: number;
  switchOpportunities: SwitchOpportunity[];
};

export type SwitchOpportunity = {
  switchLabel: string;
  co2eReductionPct: number;
  annualCostSavingEur: number;
  annualCo2eSavingKg: number;
  fromFactorId: string;
  toFactorId: string;
};

export type ImpactAnalysis = {
  month: string;
  totalSpendEur: number;
  totalCo2eKg: number;
  overallIntensity: number;
  benchmarkIntensity: number;
  categories: CategoryAnalysis[];
  topSwitches: SwitchOpportunity[];
  totalAnnualSavingEur: number;
  totalAnnualCo2eSavingKg: number;
  narrative: string;
};

// ── Analysis engine ────────────────────────────────────────────────

export function buildCategoryAnalyses(
  savings: MonthlySavingsSummary,
): CategoryAnalysis[] {
  return savings.byCategory.map((cat) => {
    const bm = benchmarkFor(cat.category);
    const intensity = cat.spendEur > 0 ? cat.co2eKg / cat.spendEur : 0;
    const benchmarkAvg = bm?.avgIntensity ?? 0.30;
    const benchmarkTop = bm?.topQuartileIntensity ?? 0.15;
    const vsAvgPct = benchmarkAvg > 0
      ? ((intensity - benchmarkAvg) / benchmarkAvg) * 100
      : 0;

    const switches = buildSwitchOpportunities(cat.category, cat.spendEur);

    return {
      category: cat.category,
      label: bm?.label ?? cat.category,
      spendEur: cat.spendEur,
      co2eKg: cat.co2eKg,
      intensity: Number(intensity.toFixed(4)),
      benchmarkAvg,
      benchmarkTopQuartile: benchmarkTop,
      vsAvgPct: Number(vsAvgPct.toFixed(1)),
      switchOpportunities: switches,
    };
  });
}

function buildSwitchOpportunities(
  category: string,
  monthlySpendEur: number,
): SwitchOpportunity[] {
  const alts = GREEN_ALTERNATIVES.filter((a) =>
    a.fromFactorId.startsWith(category + "."),
  );

  return alts
    .map((alt) => {
      const from = factorById(alt.fromFactorId);
      const to = factorById(alt.toFactorId);
      if (!from || !to) return null;

      const currentCo2e = monthlySpendEur * from.factorKgPerEur;
      const altCost = monthlySpendEur * alt.priceRatio;
      const altCo2e = altCost * to.factorKgPerEur;
      const co2eReduction = currentCo2e - altCo2e;
      const costDifference = monthlySpendEur - altCost;

      return {
        switchLabel: alt.switchLabel,
        co2eReductionPct: currentCo2e > 0
          ? Number(((co2eReduction / currentCo2e) * 100).toFixed(1))
          : 0,
        annualCostSavingEur: Number((costDifference * 12).toFixed(2)),
        annualCo2eSavingKg: Number((co2eReduction * 12).toFixed(2)),
        fromFactorId: alt.fromFactorId,
        toFactorId: alt.toFactorId,
      };
    })
    .filter((s): s is SwitchOpportunity => s !== null && s.annualCo2eSavingKg > 0)
    .sort((a, b) => b.annualCo2eSavingKg - a.annualCo2eSavingKg);
}

// ── Narrative generation ───────────────────────────────────────────

export async function generateImpactAnalysis(
  savings: MonthlySavingsSummary,
): Promise<ImpactAnalysis> {
  const categories = buildCategoryAnalyses(savings);
  const overallIntensity = savings.totalSpendEur > 0
    ? savings.totalCo2eKg / savings.totalSpendEur
    : 0;

  const weightedBenchmark = categories.reduce((sum, c) => {
    const weight = c.spendEur / (savings.totalSpendEur || 1);
    return sum + c.benchmarkAvg * weight;
  }, 0);

  const topSwitches = categories
    .flatMap((c) => c.switchOpportunities)
    .sort((a, b) => b.annualCo2eSavingKg - a.annualCo2eSavingKg)
    .slice(0, 5);

  const totalAnnualSavingEur = topSwitches.reduce((s, sw) => s + sw.annualCostSavingEur, 0);
  const totalAnnualCo2eSavingKg = topSwitches.reduce((s, sw) => s + sw.annualCo2eSavingKg, 0);

  const narrative = await generateNarrative({
    month: savings.month,
    totalSpendEur: savings.totalSpendEur,
    totalCo2eKg: savings.totalCo2eKg,
    overallIntensity,
    benchmarkIntensity: weightedBenchmark,
    categories,
    topSwitches,
    totalAnnualSavingEur,
    totalAnnualCo2eSavingKg,
  });

  return {
    month: savings.month,
    totalSpendEur: savings.totalSpendEur,
    totalCo2eKg: savings.totalCo2eKg,
    overallIntensity: Number(overallIntensity.toFixed(4)),
    benchmarkIntensity: Number(weightedBenchmark.toFixed(4)),
    categories,
    topSwitches,
    totalAnnualSavingEur: Number(totalAnnualSavingEur.toFixed(2)),
    totalAnnualCo2eSavingKg: Number(totalAnnualCo2eSavingKg.toFixed(2)),
    narrative,
  };
}

async function generateNarrative(params: {
  month: string;
  totalSpendEur: number;
  totalCo2eKg: number;
  overallIntensity: number;
  benchmarkIntensity: number;
  categories: CategoryAnalysis[];
  topSwitches: SwitchOpportunity[];
  totalAnnualSavingEur: number;
  totalAnnualCo2eSavingKg: number;
}): Promise<string> {
  const aboveAvg = params.categories
    .filter((c) => c.vsAvgPct > 10)
    .sort((a, b) => b.vsAvgPct - a.vsAvgPct);
  const belowAvg = params.categories
    .filter((c) => c.vsAvgPct < -10)
    .sort((a, b) => a.vsAvgPct - b.vsAvgPct);

  const fallback = () => buildMockNarrative(params, aboveAvg, belowAvg);

  return withAnthropicFallback(
    async () => {
      const client = anthropic();
      const msg = await client.messages.create({
        model: MODEL_SONNET,
        max_tokens: 800,
        messages: [
          {
            role: "user",
            content: `You are a carbon accounting analyst writing a concise environmental impact report for a Dutch SME using bunq Business.

Write a 4-6 sentence narrative analysis based on this data. Be specific with numbers. Use plain language, no jargon. Address the business owner directly ("you" / "your").

Data:
- Month: ${params.month}
- Total spend: €${params.totalSpendEur.toFixed(0)}
- Total CO₂e: ${params.totalCo2eKg.toFixed(1)} kg (${(params.totalCo2eKg / 1000).toFixed(2)} tonnes)
- Your carbon intensity: ${params.overallIntensity.toFixed(3)} kg CO₂e per EUR
- Industry average intensity: ${params.benchmarkIntensity.toFixed(3)} kg CO₂e per EUR
- Categories above industry average: ${aboveAvg.map((c) => `${c.label} (${c.vsAvgPct.toFixed(0)}% above)`).join(", ") || "none"}
- Categories below average (good): ${belowAvg.map((c) => `${c.label} (${Math.abs(c.vsAvgPct).toFixed(0)}% below)`).join(", ") || "none"}
- Top switch opportunity: ${params.topSwitches[0]?.switchLabel ?? "none"} (saves ${params.topSwitches[0]?.annualCo2eSavingKg.toFixed(0) ?? 0} kg CO₂e/year)
- Total annual savings potential: €${params.totalAnnualSavingEur.toFixed(0)} and ${params.totalAnnualCo2eSavingKg.toFixed(0)} kg CO₂e

Rules:
- No headers or bullet points — flowing prose only.
- Lead with the most surprising or actionable finding.
- Compare to industry averages with specific percentages.
- End with the single highest-impact action they can take and its EUR + CO₂e saving.
- Never use "game-changer", "deep dive", "leverage", or corporate-speak.`,
          },
        ],
      });

      const text = msg.content
        .filter((c) => c.type === "text")
        .map((c) => (c as { text: string }).text)
        .join("");
      return text || fallback();
    },
    fallback,
    "impact-analysis.generateClaudeNarrative",
  );
}

function buildMockNarrative(
  params: {
    month: string;
    totalSpendEur: number;
    totalCo2eKg: number;
    overallIntensity: number;
    benchmarkIntensity: number;
    totalAnnualSavingEur: number;
    totalAnnualCo2eSavingKg: number;
    topSwitches: SwitchOpportunity[];
  },
  aboveAvg: CategoryAnalysis[],
  belowAvg: CategoryAnalysis[],
): string {
  const intensityDiff = ((params.overallIntensity - params.benchmarkIntensity) / params.benchmarkIntensity) * 100;
  const direction = intensityDiff > 0 ? "above" : "below";

  const parts: string[] = [];

  parts.push(
    `In ${params.month}, your business spent €${params.totalSpendEur.toFixed(0)} and generated ${(params.totalCo2eKg / 1000).toFixed(2)} tonnes of CO₂e.`,
  );

  parts.push(
    `Your carbon intensity is ${params.overallIntensity.toFixed(3)} kg CO₂e per EUR — ${Math.abs(intensityDiff).toFixed(0)}% ${direction} the industry average of ${params.benchmarkIntensity.toFixed(3)}.`,
  );

  if (aboveAvg.length > 0) {
    const worst = aboveAvg[0];
    parts.push(
      `Your biggest outlier is ${worst.label.toLowerCase()}, running ${worst.vsAvgPct.toFixed(0)}% above average intensity — this is where the most impact hides.`,
    );
  }

  if (belowAvg.length > 0) {
    parts.push(
      `On the positive side, your ${belowAvg[0].label.toLowerCase()} spending is already ${Math.abs(belowAvg[0].vsAvgPct).toFixed(0)}% below industry average.`,
    );
  }

  if (params.topSwitches.length > 0) {
    const top = params.topSwitches[0];
    parts.push(
      `The single highest-impact move: ${top.switchLabel.toLowerCase()}. That alone would cut ${(top.annualCo2eSavingKg / 1000).toFixed(2)} tonnes CO₂e per year and save €${top.annualCostSavingEur.toFixed(0)}.`,
    );
  }

  parts.push(
    `Across all switching opportunities, you could save €${params.totalAnnualSavingEur.toFixed(0)} and ${(params.totalAnnualCo2eSavingKg / 1000).toFixed(2)} tonnes CO₂e annually.`,
  );

  return parts.join(" ");
}
