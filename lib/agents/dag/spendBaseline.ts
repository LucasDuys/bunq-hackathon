/**
 * T004 + T005 — Spend & Emissions Baseline Agent.
 *
 * Hybrid authority split (spec R005):
 *   - Deterministic core always runs: reads the canonical `transactions` table
 *     via `lib/queries.ts::getTransactionsForMonth`, aggregates spend + emissions
 *     per category, scores clusters by `spend × tco2e × (1−confidence)` with a
 *     policy override, and caps at 20 priority targets.
 *   - Optional LLM enhance pass runs only when `env.anthropicMock === false`
 *     and `ANTHROPIC_API_KEY` is set. It fills `reason_for_priority_detail`
 *     per cluster and may emit `required_context_question` when schema is
 *     ambiguous. It NEVER overrides priority ordering.
 *
 * Input: { orgId, month } → Output: BaselineOutput (see types.ts).
 * Entry points: `run()` (used by runDag and the /api/baseline/run route).
 */

import { eq } from "drizzle-orm";
import { db, policies } from "@/lib/db/client";
import { estimateEmission } from "@/lib/emissions/estimate";
import { env } from "@/lib/env";
import { policySchema, type Policy } from "@/lib/policy/schema";
import { evaluatePolicy, type CategoryAggregate } from "@/lib/policy/evaluate";
import { DEFAULT_ORG_ID, currentMonth, getActivePolicyRaw, getTransactionsForMonth } from "@/lib/queries";
import { anthropic, MODEL_HAIKU, isAnthropicMock } from "@/lib/anthropic/client";
import { detailFor, type ReasonForPriority } from "./reasons";
import { recommendedAgentFor } from "./routing";
import type { AgentContext, BaselineOutput } from "./types";

// ── System prompt (kept stable — consumed by the LLM enhance pass) ────────
export const SYSTEM_PROMPT = `You are the Spend & Emissions Baseline Agent for Carbon Autopilot for bunq Business.

Your job is to review a pre-computed baseline payload (total spend, total emissions, top categories, priority targets) and do exactly three narrow things:
1. For each priority target, write a one-sentence \`reason_for_priority_detail\` that is audit-friendly and cites the cluster's dominant signal (spend share, emissions share, or confidence gap).
2. If any cluster's category looks ambiguous (e.g. more than 50% of its transactions landed in "other" or have very low classifier confidence), emit a single \`required_context_question\` asking the user for the missing context.
3. Merge any cluster-disambiguation suggestions into the output verbatim.

You do NOT re-rank priority targets. You do NOT invent new clusters. You do NOT change numeric fields. All aggregation and scoring is deterministic and already done.

Output must be machine-readable JSON matching the agreed schema. Only the three fields above may be written or changed.`;

export type BaselineInput = {
  orgId?: string;
  month?: string;
};

// ── Helpers ───────────────────────────────────────────────────────────────

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
const clusterIdFor = (category: string) => `cluster_${slug(category)}`;

const loadPolicy = (orgId: string): Policy | null => {
  const raw = getActivePolicyRaw(orgId);
  if (!raw) return null;
  try {
    return policySchema.parse(JSON.parse(raw.rules));
  } catch {
    return null;
  }
};

type ClusterAccumulator = {
  category: string;
  spendEur: number;
  co2eKg: number;
  confidenceSum: number;
  txCount: number;
};

const empty = (orgId: string, month: string): BaselineOutput => ({
  agent: "spend_emissions_baseline_agent",
  company_id: orgId,
  analysis_period: month,
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
  required_context_question: null,
});

// ── Deterministic aggregation + clustering + scoring ──────────────────────

const aggregate = (orgId: string, month: string): {
  output: BaselineOutput;
  clusters: Map<string, ClusterAccumulator>;
  policy: Policy | null;
} => {
  const txs = getTransactionsForMonth(orgId, month);
  const output = empty(orgId, month);
  const clusters = new Map<string, ClusterAccumulator>();
  const policy = loadPolicy(orgId);

  if (txs.length === 0) return { output, clusters, policy };

  // Aggregate per category.
  for (const tx of txs) {
    const category = tx.category ?? "other";
    const amountEur = Math.abs(tx.amountCents ?? 0) / 100;
    const est = estimateEmission({
      category,
      subCategory: tx.subCategory ?? null,
      amountEur,
      classifierConfidence: tx.categoryConfidence ?? 0.5,
    });
    const acc = clusters.get(category) ?? {
      category,
      spendEur: 0,
      co2eKg: 0,
      confidenceSum: 0,
      txCount: 0,
    };
    acc.spendEur += amountEur;
    acc.co2eKg += est.co2eKgPoint;
    // Confidence weighted by co2e later; accumulate spend-weighted here for baseline.
    acc.confidenceSum += est.confidence * amountEur;
    acc.txCount += 1;
    clusters.set(category, acc);
  }

  // Totals + baseline fields.
  const totalSpend = Array.from(clusters.values()).reduce((s, c) => s + c.spendEur, 0);
  const totalCo2e = Array.from(clusters.values()).reduce((s, c) => s + c.co2eKg, 0);
  const baselineConfidence =
    totalSpend > 0
      ? Array.from(clusters.values()).reduce((s, c) => s + c.confidenceSum, 0) / totalSpend
      : 0;

  output.baseline.total_spend_eur = Number(totalSpend.toFixed(2));
  output.baseline.estimated_total_tco2e = Number((totalCo2e / 1000).toFixed(3));
  output.baseline.baseline_confidence = Number(baselineConfidence.toFixed(3));

  // Top 5 by spend + by emissions.
  const byKey = (key: "spendEur" | "co2eKg") => (a: ClusterAccumulator, b: ClusterAccumulator) =>
    b[key] - a[key];

  output.baseline.top_spend_categories = Array.from(clusters.values())
    .sort(byKey("spendEur"))
    .slice(0, 5)
    .map((c) => ({
      category: c.category,
      spend_eur: Number(c.spendEur.toFixed(2)),
      share_pct: totalSpend > 0 ? Math.round((c.spendEur / totalSpend) * 100) : 0,
    }));

  output.baseline.top_emission_categories = Array.from(clusters.values())
    .sort(byKey("co2eKg"))
    .slice(0, 5)
    .map((c) => ({
      category: c.category,
      tco2e: Number((c.co2eKg / 1000).toFixed(3)),
      share_pct: totalCo2e > 0 ? Math.round((c.co2eKg / totalCo2e) * 100) : 0,
    }));

  // Overlap: high_cost_high_carbon = in both top-5 lists with share ≥ 10%.
  const spendShares = new Map(output.baseline.top_spend_categories.map((r) => [r.category, r.share_pct]));
  const emissionShares = new Map(output.baseline.top_emission_categories.map((r) => [r.category, r.share_pct]));
  output.baseline.high_cost_high_carbon_clusters = Array.from(clusters.keys())
    .filter((cat) => (spendShares.get(cat) ?? 0) >= 10 && (emissionShares.get(cat) ?? 0) >= 10)
    .map(clusterIdFor)
    .sort();

  // Uncertainty: avg_confidence < 0.6 AND annualized spend ≥ €1,200.
  output.baseline.uncertain_high_value_clusters = Array.from(clusters.values())
    .filter((c) => {
      const avgConf = c.spendEur > 0 ? c.confidenceSum / c.spendEur : 0;
      return avgConf < 0.6 && c.spendEur * 12 >= 1200;
    })
    .map((c) => clusterIdFor(c.category))
    .sort();

  return { output, clusters, policy };
};

// ── Priority target scoring + policy override ─────────────────────────────

type ScoredCluster = {
  cluster_id: string;
  category: string;
  annualized_spend_eur: number;
  estimated_tco2e: number;
  transaction_count: number;
  avg_confidence: number;
  score: number;
  spend_share_pct: number;
  emissions_share_pct: number;
  policy_triggered: boolean;
};

const isPolicyBreach = (policy: Policy, aggregates: CategoryAggregate[], category: string): boolean => {
  if (!policy) return false;
  // "Breach" = the category has a *specific* (non-wildcard) rule AND that rule
  // produces reserve > €50 on the period's aggregates. Wildcard-fallback
  // categories don't trigger so we don't flood top-20 with noise.
  const rule = policy.reserveRules.find((r) => r.category === category);
  if (!rule) return false;
  const outcome = evaluatePolicy(policy, aggregates);
  const row = outcome.perCategory.find((r) => r.category === category);
  return !!row && row.reserveEur > 50;
};

const scoreClusters = (
  clusters: Map<string, ClusterAccumulator>,
  spendShares: Map<string, number>,
  emissionShares: Map<string, number>,
  policy: Policy | null,
): ScoredCluster[] => {
  const aggregates: CategoryAggregate[] = Array.from(clusters.values()).map((c) => ({
    category: c.category,
    spendEur: c.spendEur,
    co2eKg: c.co2eKg,
  }));
  return Array.from(clusters.values()).map((c) => {
    const avgConfidence = c.spendEur > 0 ? c.confidenceSum / c.spendEur : 0;
    const annualSpend = c.spendEur * 12;
    const annualCo2e = (c.co2eKg * 12) / 1000;
    const score = annualSpend * annualCo2e * (1 - avgConfidence);
    return {
      cluster_id: clusterIdFor(c.category),
      category: c.category,
      annualized_spend_eur: Number(annualSpend.toFixed(2)),
      estimated_tco2e: Number(annualCo2e.toFixed(3)),
      transaction_count: c.txCount,
      avg_confidence: Number(avgConfidence.toFixed(3)),
      score,
      spend_share_pct: spendShares.get(c.category) ?? 0,
      emissions_share_pct: emissionShares.get(c.category) ?? 0,
      policy_triggered: policy ? isPolicyBreach(policy, aggregates, c.category) : false,
    };
  });
};

const selectPriorityTargets = (scored: ScoredCluster[]): ScoredCluster[] => {
  const MAX = 20;
  const byScore = [...scored].sort((a, b) => b.score - a.score);

  // Partition into policy-triggered vs not.
  const policyHits = byScore.filter((c) => c.policy_triggered);
  const others = byScore.filter((c) => !c.policy_triggered);

  // Policy hits always included. If > 20 policy hits, keep the highest-scored 20.
  if (policyHits.length >= MAX) return policyHits.slice(0, MAX);

  // Otherwise take all policy hits + fill remaining slots by score from the rest.
  const slots = MAX - policyHits.length;
  return [...policyHits, ...others.slice(0, slots)];
};

const reasonForSingle = (c: ScoredCluster): ReasonForPriority => {
  if (c.policy_triggered) return "policy_relevant";
  if (c.emissions_share_pct >= 20) return "high_emissions";
  if (c.spend_share_pct >= 20) return "high_spend";
  return "high_uncertainty";
};

const buildPriorityTargets = (scored: ScoredCluster[]): BaselineOutput["priority_targets"] => {
  return selectPriorityTargets(scored).map((c) => {
    const reason = reasonForSingle(c);
    return {
      cluster_id: c.cluster_id,
      category: c.category,
      annualized_spend_eur: c.annualized_spend_eur,
      estimated_tco2e: c.estimated_tco2e,
      reason_for_priority: reason,
      recommended_next_agent: recommendedAgentFor(c.category),
      reason_for_priority_detail: detailFor(reason),
      transaction_count: c.transaction_count,
      avg_confidence: c.avg_confidence,
    };
  });
};

// ── Optional LLM enhance (spec R005 — runs only when key + flag allow) ────

const enhanceWithLlm = async (output: BaselineOutput): Promise<BaselineOutput> => {
  if (isAnthropicMock()) return output;
  try {
    const client = anthropic();
    const userPayload = {
      baseline: output.baseline,
      priority_targets: output.priority_targets.map((t) => ({
        cluster_id: t.cluster_id,
        category: t.category,
        reason_for_priority: t.reason_for_priority,
        annualized_spend_eur: t.annualized_spend_eur,
        estimated_tco2e: t.estimated_tco2e,
        avg_confidence: t.avg_confidence,
        transaction_count: t.transaction_count,
      })),
    };
    const msg = await client.messages.create({
      model: MODEL_HAIKU,
      max_tokens: 800,
      system: [
        { type: "text", text: SYSTEM_PROMPT, cache_control: { type: "ephemeral" } },
      ],
      messages: [{ role: "user", content: JSON.stringify(userPayload) }],
    });
    const text = msg.content.filter((c) => c.type === "text").map((c) => (c as { text: string }).text).join("");
    const m = text.match(/\{[\s\S]*\}/);
    if (!m) return output;
    const parsed = JSON.parse(m[0]) as {
      priority_targets?: Array<{ cluster_id: string; reason_for_priority_detail?: string }>;
      required_context_question?: string | null;
    };
    const byId = new Map((parsed.priority_targets ?? []).map((p) => [p.cluster_id, p]));
    return {
      ...output,
      priority_targets: output.priority_targets.map((t) => {
        const hit = byId.get(t.cluster_id);
        return hit?.reason_for_priority_detail
          ? { ...t, reason_for_priority_detail: hit.reason_for_priority_detail }
          : t;
      }),
      required_context_question: parsed.required_context_question ?? output.required_context_question,
    };
  } catch (e) {
    console.warn(`[baseline] LLM enhance failed, falling back to deterministic: ${(e as Error).message}`);
    return output;
  }
};

// ── Public entry point ────────────────────────────────────────────────────

export async function run(input: BaselineInput = {}, _ctx?: AgentContext): Promise<BaselineOutput> {
  const orgId = input.orgId ?? DEFAULT_ORG_ID;
  const month = input.month ?? currentMonth();

  const { output: shell, clusters, policy } = aggregate(orgId, month);
  if (clusters.size === 0) return shell;

  const spendShares = new Map(shell.baseline.top_spend_categories.map((r) => [r.category, r.share_pct]));
  const emissionShares = new Map(shell.baseline.top_emission_categories.map((r) => [r.category, r.share_pct]));
  const scored = scoreClusters(clusters, spendShares, emissionShares, policy);

  const deterministic: BaselineOutput = {
    ...shell,
    priority_targets: buildPriorityTargets(scored),
    required_context_question: null,
  };

  // Swap to LLM enhance when the flag is off AND the key is present.
  if (env.anthropicMock) return deterministic;
  return enhanceWithLlm(deterministic);
}
