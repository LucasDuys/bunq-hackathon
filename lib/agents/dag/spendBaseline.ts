/**
 * Spend & Emissions Baseline Agent — deterministic.
 *
 * Builds the compact BaselineOutput every downstream agent consumes. No LLM call —
 * per docs/agents/00-overview.md + research/13-context-scaling-patterns.md, the baseline
 * is "schema + top-K clusters", not a reasoning step. Agents that need row-level context
 * call lib/agents/dag/tools.ts (bounded).
 */
import { and, eq, gte } from "drizzle-orm";
import { db, transactions } from "@/lib/db/client";
import { estimateEmission, rollup } from "@/lib/emissions/estimate";
import { factorFor } from "@/lib/factors";
import type { AgentContext, BaselineOutput } from "./types";
import { findLowerCarbonAlternative } from "./tools";

export const SYSTEM_PROMPT = `You are the Spend & Emissions Baseline Agent for Carbon Autopilot for bunq Business.

Your job is to summarize normalized bunq transactions into a compact baseline payload: total spend, total emissions, top spend + emission categories, high-cost/high-carbon clusters, and uncertain-but-high-value clusters. You then prioritize which clusters deserve further analysis by the Green Alternatives and Cost Savings agents.

You are not a recommendation agent. You do not propose alternatives. You produce a priority-target list with quantitative baseline fields.

Primary goal:
Compress the input dataset into a downstream-agent-ready payload that fits in a 20k-token budget even when the company has 10,000 transactions.

Important operating rules:
1. Never pass raw rows to downstream agents. Always summarize.
2. Select at most 20 priority-target clusters. Prefer clusters that maximize {spend × emissions × uncertainty}.
3. Split priorities by recommended next agent: green_alternatives_agent, cost_savings_agent, both.
4. Always include confidence on the baseline emission estimate.
5. If the schema is ambiguous, include a required_context_question rather than guessing column meaning.
6. Output machine-readable JSON only.

Output JSON schema: see docs/agents/01-spend-baseline.md.`;

export interface BaselineInput {
  orgId: string;
  month: string;
}

const LOOKBACK_DAYS = 90;
const MAX_PRIORITY_TARGETS = 20;
const MIN_ANNUAL_SPEND_EUR = 250;

type Bucket = {
  merchantNorm: string;
  merchantLabel: string;
  category: string;
  subCategory: string | null;
  spendEur: number;
  txCount: number;
  co2eKgPoint: number;
  co2eKgLow: number;
  co2eKgHigh: number;
  confidenceSum: number;
  confidenceWeight: number;
  factorUncertaintyPct: number;
};

const isGreenWorthy = (category: string, subCategory: string | null): boolean =>
  findLowerCarbonAlternative(category, subCategory).length > 0;

const isCostWorthy = (factorKgPerEur: number): boolean => factorKgPerEur < 0.12;

const reasonFor = (b: Bucket, factorUncertaintyPct: number): "high_spend" | "high_emissions" | "high_uncertainty" | "policy_relevant" => {
  if (b.confidenceSum / Math.max(1, b.confidenceWeight) < 0.55) return "high_uncertainty";
  if (b.co2eKgPoint > 200) return "high_emissions";
  if (factorUncertaintyPct > 0.5) return "high_uncertainty";
  return "high_spend";
};

const nextAgentFor = (b: Bucket): "green_alternatives_agent" | "cost_savings_agent" | "both" => {
  const factor = factorFor(b.category, b.subCategory);
  const green = isGreenWorthy(b.category, b.subCategory);
  const cost = isCostWorthy(factor.factorKgPerEur);
  if (green && cost) return "both";
  if (green) return "green_alternatives_agent";
  if (cost) return "cost_savings_agent";
  return "both";
};

export async function run(input: BaselineInput, _ctx: AgentContext): Promise<BaselineOutput> {
  const now = new Date();
  const sinceSec = Math.floor(now.getTime() / 1000) - LOOKBACK_DAYS * 86_400;
  const rows = db
    .select()
    .from(transactions)
    .where(and(eq(transactions.orgId, input.orgId), gte(transactions.timestamp, sinceSec)))
    .all();

  if (rows.length === 0) {
    return {
      agent: "spend_emissions_baseline_agent",
      company_id: input.orgId,
      analysis_period: input.month,
      baseline: {
        total_spend_eur: 0,
        estimated_total_tco2e: 0,
        baseline_confidence: 0,
        top_spend_categories: [],
        top_emission_categories: [],
        high_cost_high_carbon_clusters: [],
        uncertain_high_value_clusters: [],
      },
      priority_targets: [],
      required_context_question: "No transactions found in the last 90 days. Connect bunq or seed fixtures before running the DAG.",
    };
  }

  const buckets = new Map<string, Bucket>();
  const allEstimates: Array<{ co2eKgPoint: number; co2eKgLow: number; co2eKgHigh: number; confidence: number }> = [];
  for (const tx of rows) {
    const amountEur = tx.amountCents / 100;
    const cat = tx.category ?? "other";
    const sub = tx.subCategory ?? null;
    const est = estimateEmission({
      category: cat,
      subCategory: sub,
      amountEur,
      classifierConfidence: tx.categoryConfidence ?? 0.6,
    });
    allEstimates.push(est);
    const key = `${tx.merchantNorm}|${cat}|${sub ?? "_"}`;
    const factor = factorFor(cat, sub);
    const existing = buckets.get(key);
    if (existing) {
      existing.spendEur += amountEur;
      existing.txCount += 1;
      existing.co2eKgPoint += est.co2eKgPoint;
      existing.co2eKgLow += est.co2eKgLow;
      existing.co2eKgHigh += est.co2eKgHigh;
      existing.confidenceSum += est.confidence * est.co2eKgPoint;
      existing.confidenceWeight += est.co2eKgPoint;
    } else {
      buckets.set(key, {
        merchantNorm: tx.merchantNorm,
        merchantLabel: tx.merchantRaw,
        category: cat,
        subCategory: sub,
        spendEur: amountEur,
        txCount: 1,
        co2eKgPoint: est.co2eKgPoint,
        co2eKgLow: est.co2eKgLow,
        co2eKgHigh: est.co2eKgHigh,
        confidenceSum: est.confidence * est.co2eKgPoint,
        confidenceWeight: est.co2eKgPoint,
        factorUncertaintyPct: factor.uncertaintyPct,
      });
    }
  }

  const totalRollup = rollup(allEstimates);
  const annualizer = 365 / LOOKBACK_DAYS;

  const annualTotalSpendEur = rows.reduce((s, r) => s + r.amountCents / 100, 0) * annualizer;
  const annualTotalTco2e = (totalRollup.co2eKgPoint * annualizer) / 1000;

  const byCategorySpend = new Map<string, number>();
  const byCategoryKg = new Map<string, number>();
  for (const b of buckets.values()) {
    byCategorySpend.set(b.category, (byCategorySpend.get(b.category) ?? 0) + b.spendEur);
    byCategoryKg.set(b.category, (byCategoryKg.get(b.category) ?? 0) + b.co2eKgPoint);
  }
  const totalSpend = Array.from(byCategorySpend.values()).reduce((s, x) => s + x, 0);
  const totalKg = Array.from(byCategoryKg.values()).reduce((s, x) => s + x, 0);

  const topSpendCategories = Array.from(byCategorySpend.entries())
    .map(([category, spend]) => ({
      category,
      spend_eur: Number((spend * annualizer).toFixed(0)),
      share_pct: totalSpend > 0 ? Number(((spend / totalSpend) * 100).toFixed(1)) : 0,
    }))
    .sort((a, b) => b.spend_eur - a.spend_eur)
    .slice(0, 5);

  const topEmissionCategories = Array.from(byCategoryKg.entries())
    .map(([category, kg]) => ({
      category,
      tco2e: Number(((kg * annualizer) / 1000).toFixed(2)),
      share_pct: totalKg > 0 ? Number(((kg / totalKg) * 100).toFixed(1)) : 0,
    }))
    .sort((a, b) => b.tco2e - a.tco2e)
    .slice(0, 5);

  const bucketsArr = Array.from(buckets.values()).filter((b) => b.spendEur * annualizer >= MIN_ANNUAL_SPEND_EUR);

  const highCostHighCarbon = [...bucketsArr]
    .sort((a, b) => b.spendEur * b.co2eKgPoint - a.spendEur * a.co2eKgPoint)
    .slice(0, 3)
    .map((b) => `cluster_${b.merchantNorm.replace(/\s+/g, "_").slice(0, 40)}`);

  const uncertainHighValue = [...bucketsArr]
    .map((b) => ({ b, conf: b.confidenceWeight > 0 ? b.confidenceSum / b.confidenceWeight : 0 }))
    .sort((a, b) => b.b.spendEur * (1 - b.conf) - a.b.spendEur * (1 - a.conf))
    .slice(0, 3)
    .map(({ b }) => `cluster_${b.merchantNorm.replace(/\s+/g, "_").slice(0, 40)}`);

  // Priority targets: rank by (annualSpend × annualCo2e × (1 − confidence))
  const scored = bucketsArr
    .map((b) => {
      const conf = b.confidenceWeight > 0 ? b.confidenceSum / b.confidenceWeight : 0.5;
      const score = (b.spendEur * annualizer) * (b.co2eKgPoint * annualizer) * (1 - conf + 0.1);
      return { b, conf, score };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, MAX_PRIORITY_TARGETS);

  const priorityTargets = scored.map(({ b, conf }) => ({
    cluster_id: `cluster_${b.merchantNorm.replace(/\s+/g, "_").slice(0, 40)}`,
    category: b.category,
    annualized_spend_eur: Number((b.spendEur * annualizer).toFixed(0)),
    estimated_tco2e: Number(((b.co2eKgPoint * annualizer) / 1000).toFixed(3)),
    reason_for_priority: reasonFor(b, b.factorUncertaintyPct),
    recommended_next_agent: nextAgentFor(b),
    // intentional extra fields consumed by downstream agents; types allow it via subset shape
    baseline_merchant_norm: b.merchantNorm,
    baseline_merchant_label: b.merchantLabel,
    baseline_sub_category: b.subCategory,
    baseline_confidence: Number(conf.toFixed(3)),
    baseline_tx_count: b.txCount,
  }));

  return {
    agent: "spend_emissions_baseline_agent",
    company_id: input.orgId,
    analysis_period: input.month,
    baseline: {
      total_spend_eur: Number(annualTotalSpendEur.toFixed(0)),
      estimated_total_tco2e: Number(annualTotalTco2e.toFixed(2)),
      baseline_confidence: Number(totalRollup.confidence.toFixed(3)),
      top_spend_categories: topSpendCategories,
      top_emission_categories: topEmissionCategories,
      high_cost_high_carbon_clusters: highCostHighCarbon,
      uncertain_high_value_clusters: uncertainHighValue,
    },
    priority_targets: priorityTargets,
    required_context_question: null,
  };
}
