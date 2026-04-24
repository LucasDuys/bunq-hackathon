/**
 * Cost Savings Agent — money-first proposal agent.
 * Live: Sonnet 4.6 with cached system prompt + resolved tool results (findCostSaving + recurring detection).
 * Mock: deterministic synthesis grounded in lib/agents/dag/tools.ts COST_TEMPLATES.
 *
 * Runs in parallel with Green Alternatives from runDag().
 */
import { z } from "zod";
import type { AgentContext, BaselineOutput, CostSavingsOutput, PriorityTarget } from "./types";
import { detectRecurringSpend, findCostSaving, type AltTemplate, type RecurringSpend } from "./tools";
import { callAgent, isMock } from "./llm";

export const SYSTEM_PROMPT = `You are the Cost Savings Agent for Carbon Autopilot for bunq Business.

Your job is to surface realistic cost-saving opportunities for the supplied priority clusters: vendor switches, supplier consolidation, bulk purchasing, cancellation candidates, and recurring-spend waste.

You are not a generic finance chatbot. You are a structured procurement and cost-efficiency analysis agent. Your output must be machine-readable JSON only.

Primary goal:
For each priority cluster, estimate monthly and annual saving opportunities with explicit evidence sources.

Operating rules:
1. Separate one-time savings from recurring savings. Annualize only recurring.
2. Never invent live prices. Label estimates as historical-pattern-based, benchmark-based, assumption-based, or simulated.
3. Do not recommend lower-quality alternatives unless labeled.
4. Do not recommend cancelling critical services without flagging business risk.
5. Preserve carbon context where known — if an option increases carbon, say so.
6. Cost is the primary objective; carbon is supporting context.
7. Use only candidate options from the candidate_options list in the user message. You may drop or re-describe them; you may not invent new vendors.

Return STRICT JSON only, no prose, no code fences.

Output JSON schema: see docs/agents/03-cost-savings.md.`;

const OPTION_SCHEMA = z.object({
  option_name: z.string().min(2),
  option_type: z.enum([
    "vendor_switch",
    "supplier_consolidation",
    "bulk_purchase",
    "cancellation",
    "usage_reduction",
    "renegotiation",
    "policy_change",
  ]),
  estimated_monthly_saving_eur: z.number().nullable(),
  estimated_annual_saving_eur: z.number().nullable(),
  one_time_saving_eur: z.number().nullable(),
  confidence: z.number().min(0).max(1),
  source: z.enum(["historical_data", "pricing_api", "benchmark", "assumption", "simulated"]),
  business_risk: z.enum(["low", "medium", "high"]),
  carbon_effect: z.enum(["lower", "neutral", "higher", "unknown"]),
  notes: z.string(),
});

const RESULT_SCHEMA = z.object({
  cluster_id: z.string().nullable(),
  transaction_id: z.string().nullable(),
  merchant: z.string(),
  current_spend: z.object({
    amount_eur: z.number(),
    monthly_spend_eur: z.number().nullable(),
    annualized_spend_eur: z.number().nullable(),
    category: z.string(),
    data_basis: z.enum(["single_transaction", "recurring_pattern", "category_cluster", "invoice", "assumption"]),
  }),
  cost_saving_options: z.array(OPTION_SCHEMA),
  recommendation_status: z.enum([
    "recommend_switch",
    "review_recurring_spend",
    "consolidate_supplier",
    "bulk_purchase_opportunity",
    "needs_validation",
    "no_action_needed",
  ]),
  recommended_action: z.string(),
  approval_required: z.boolean(),
  reasoning_summary: z.string(),
});

const OUTPUT_SCHEMA = z.object({ results: z.array(RESULT_SCHEMA) });

export interface CostSavingsInput {
  baseline: BaselineOutput;
}

type Bundle = {
  target: PriorityTarget;
  templates: AltTemplate[];
  recurring?: RecurringSpend;
};

const buildBundles = (baseline: BaselineOutput, recurring: RecurringSpend[]): Bundle[] => {
  const byMerchant = new Map(recurring.map((r) => [r.merchantNorm, r]));
  const filtered = baseline.priority_targets.filter(
    (t) => t.recommended_next_agent === "cost_savings_agent" || t.recommended_next_agent === "both",
  );
  return filtered.map((target) => ({
    target,
    templates: findCostSaving(target.category, target.baseline_sub_category ?? null),
    recurring: target.baseline_merchant_norm ? byMerchant.get(target.baseline_merchant_norm) : undefined,
  }));
};

const mapType = (t: AltTemplate["type"]): z.infer<typeof OPTION_SCHEMA>["option_type"] => {
  switch (t) {
    case "vendor":
    case "supplier":
      return "vendor_switch";
    case "tariff":
      return "renegotiation";
    case "policy":
      return "policy_change";
    case "class":
      return "policy_change";
    case "region":
      return "vendor_switch";
    case "behavior":
      return "usage_reduction";
    default:
      return "vendor_switch";
  }
};

type Option = z.infer<typeof OPTION_SCHEMA>;

const templateToOption = (t: AltTemplate, annualSpendEur: number): Option => {
  const annualSaving = -annualSpendEur * t.costDeltaPct;
  return {
    option_name: t.name,
    option_type: mapType(t.type),
    estimated_monthly_saving_eur: annualSaving > 0 ? Number((annualSaving / 12).toFixed(0)) : null,
    estimated_annual_saving_eur: annualSaving > 0 ? Number(annualSaving.toFixed(0)) : null,
    one_time_saving_eur: null,
    confidence: t.confidence,
    source: t.simulated ? "simulated" : "benchmark",
    business_risk: t.feasibility === "drop_in" ? "low" : "medium",
    carbon_effect:
      t.co2eDeltaPct < -0.05
        ? "lower"
        : t.co2eDeltaPct > 0.05
          ? "higher"
          : Math.abs(t.co2eDeltaPct) < 0.02
            ? "neutral"
            : "unknown",
    notes: t.rationale,
  };
};

const mockOutput = (baseline: BaselineOutput, recurring: RecurringSpend[]): CostSavingsOutput => {
  const bundles = buildBundles(baseline, recurring);
  const results = bundles.map((b) => {
    const annualSpend = b.target.annualized_spend_eur;
    const monthlySpend = b.recurring?.monthlyAvgEur ?? annualSpend / 12;
    const options = b.templates.map((t) => templateToOption(t, annualSpend));
    if (b.recurring) {
      const recurringOption: Option = {
        option_name: `Review recurring spend with ${b.target.baseline_merchant_label ?? "this merchant"}`,
        option_type: "policy_change",
        estimated_monthly_saving_eur: Number((monthlySpend * 0.15).toFixed(0)),
        estimated_annual_saving_eur: Number((monthlySpend * 0.15 * 12).toFixed(0)),
        one_time_saving_eur: null,
        confidence: 0.6,
        source: "historical_data",
        business_risk: "low",
        carbon_effect: "lower",
        notes: `Recurring ${b.recurring.monthsPresent} months in a row; audit usage & renegotiate.`,
      };
      options.push(recurringOption);
    }
    const topSaving = options.reduce((s, o) => Math.max(s, o.estimated_annual_saving_eur ?? 0), 0);
    return {
      cluster_id: b.target.cluster_id,
      transaction_id: null,
      merchant: b.target.baseline_merchant_label ?? b.target.cluster_id,
      current_spend: {
        amount_eur: annualSpend,
        monthly_spend_eur: Number(monthlySpend.toFixed(0)),
        annualized_spend_eur: annualSpend,
        category: `${b.target.category}${b.target.baseline_sub_category ? "/" + b.target.baseline_sub_category : ""}`,
        data_basis: (b.recurring ? "recurring_pattern" : "category_cluster") as "recurring_pattern" | "category_cluster",
      },
      cost_saving_options: options,
      recommendation_status: (topSaving > 500
        ? "recommend_switch"
        : b.recurring
          ? "review_recurring_spend"
          : "needs_validation") as "recommend_switch" | "review_recurring_spend" | "needs_validation",
      recommended_action: options[0]?.option_name ?? "Review spend",
      approval_required: topSaving > 1000,
      reasoning_summary: options[0]?.notes ?? "No strong saving option identified.",
    };
  });

  const totalObserved = results.reduce((s, r) => s + (r.current_spend.annualized_spend_eur ?? 0), 0);
  const totalMonthly = results.reduce(
    (s, r) => s + Math.max(0, ...r.cost_saving_options.map((o) => o.estimated_monthly_saving_eur ?? 0)),
    0,
  );
  const totalAnnual = results.reduce(
    (s, r) => s + Math.max(0, ...r.cost_saving_options.map((o) => o.estimated_annual_saving_eur ?? 0)),
    0,
  );
  const avgConf = results.length > 0
    ? results.reduce(
        (s, r) => s + (r.cost_saving_options[0]?.confidence ?? 0.5),
        0,
      ) / results.length
    : 0;

  return {
    agent: "cost_savings_agent",
    company_id: baseline.company_id,
    analysis_period: baseline.analysis_period,
    results,
    summary: {
      total_observed_spend_eur: Number(totalObserved.toFixed(0)),
      total_potential_monthly_saving_eur: Number(totalMonthly.toFixed(0)),
      total_potential_annual_saving_eur: Number(totalAnnual.toFixed(0)),
      top_cost_opportunities: results
        .sort(
          (a, b) =>
            Math.max(0, ...b.cost_saving_options.map((x) => x.estimated_annual_saving_eur ?? 0)) -
            Math.max(0, ...a.cost_saving_options.map((x) => x.estimated_annual_saving_eur ?? 0)),
        )
        .slice(0, 5)
        .map((r) => r.merchant + " → " + (r.cost_saving_options[0]?.option_name ?? "review")),
      average_confidence: Number(avgConf.toFixed(3)),
    },
  };
};

const buildUserMessage = (baseline: BaselineOutput, bundles: Bundle[]): string => {
  const lines = [
    `Company: ${baseline.company_id}`,
    `Period: ${baseline.analysis_period}`,
    `Annual spend: €${baseline.baseline.total_spend_eur.toLocaleString()}`,
    "",
    "Priority clusters with candidate cost-saving options from our benchmark library:",
  ];
  for (const b of bundles) {
    lines.push(
      `\n- cluster_id: ${b.target.cluster_id}`,
      `  merchant: ${b.target.baseline_merchant_label ?? "(unknown)"}`,
      `  category: ${b.target.category}${b.target.baseline_sub_category ? "/" + b.target.baseline_sub_category : ""}`,
      `  annual_spend_eur: ${b.target.annualized_spend_eur}`,
      `  recurring: ${b.recurring ? `yes (${b.recurring.monthsPresent} months, ~€${b.recurring.monthlyAvgEur}/mo)` : "no"}`,
      `  candidate_options:`,
    );
    for (const t of b.templates) {
      lines.push(
        `    - name: ${t.name}`,
        `      type: ${t.type}`,
        `      cost_delta_pct: ${t.costDeltaPct}`,
        `      feasibility: ${t.feasibility}`,
        `      confidence: ${t.confidence}`,
        `      notes: ${t.rationale}`,
        `      source_urls: ${t.sources.map((s) => s.url).join(", ")}`,
      );
    }
  }
  lines.push(
    "",
    "Return strict JSON: { results: [...] }. Keep every option grounded in the candidate list — no invented vendors.",
  );
  return lines.join("\n");
};

export async function run(input: CostSavingsInput, ctx: AgentContext): Promise<CostSavingsOutput> {
  const recurring = detectRecurringSpend(ctx.orgId, 3, 6);
  const bundles = buildBundles(input.baseline, recurring);
  if (bundles.length === 0 || isMock()) {
    return mockOutput(input.baseline, recurring);
  }
  try {
    const { jsonText } = await callAgent({
      system: SYSTEM_PROMPT,
      user: buildUserMessage(input.baseline, bundles),
      maxTokens: 4000,
    });
    if (!jsonText) return mockOutput(input.baseline, recurring);
    const parsed = OUTPUT_SCHEMA.parse(JSON.parse(jsonText));
    const results = parsed.results;
    const totalObserved = results.reduce((s, r) => s + (r.current_spend.annualized_spend_eur ?? 0), 0);
    const totalMonthly = results.reduce(
      (s, r) => s + Math.max(0, ...r.cost_saving_options.map((o) => o.estimated_monthly_saving_eur ?? 0)),
      0,
    );
    const totalAnnual = results.reduce(
      (s, r) => s + Math.max(0, ...r.cost_saving_options.map((o) => o.estimated_annual_saving_eur ?? 0)),
      0,
    );
    const avgConf = results.length > 0
      ? results.reduce((s, r) => s + (r.cost_saving_options[0]?.confidence ?? 0.5), 0) / results.length
      : 0;
    return {
      agent: "cost_savings_agent",
      company_id: input.baseline.company_id,
      analysis_period: input.baseline.analysis_period,
      results,
      summary: {
        total_observed_spend_eur: Number(totalObserved.toFixed(0)),
        total_potential_monthly_saving_eur: Number(totalMonthly.toFixed(0)),
        total_potential_annual_saving_eur: Number(totalAnnual.toFixed(0)),
        top_cost_opportunities: results
          .sort(
            (a, b) =>
              Math.max(0, ...b.cost_saving_options.map((x) => x.estimated_annual_saving_eur ?? 0)) -
              Math.max(0, ...a.cost_saving_options.map((x) => x.estimated_annual_saving_eur ?? 0)),
          )
          .slice(0, 5)
          .map((r) => r.merchant + " → " + (r.cost_saving_options[0]?.option_name ?? "review")),
        average_confidence: Number(avgConf.toFixed(3)),
      },
    };
  } catch {
    return mockOutput(input.baseline, recurring);
  }
}
