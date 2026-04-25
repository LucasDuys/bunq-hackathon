/**
 * Cost Savings Agent — money-first proposal agent.
 * Live: Sonnet 4.6 with cached system prompt + resolved tool results (findCostSaving + recurring detection).
 * Mock: deterministic synthesis grounded in lib/agents/dag/tools.ts COST_TEMPLATES.
 *
 * Runs in parallel with Green Alternatives from runDag().
 */
import { z } from "zod";
import type {
  AgentContext,
  BaselineOutput,
  CostSavingsOutput,
  PriorityTarget,
  ResearchedAlternative,
  ResearchedPool,
} from "./types";
import { detectRecurringSpend, findCostSaving, type AltTemplate, type RecurringSpend } from "./tools";
import { callAgent, isMock } from "./llm";
import { recordAgentMessage } from "./persist";

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
  // R010 / T006 — vendor-logo enrichment. Both fields default to null; the
  // post-parse pass in `run()` overwrites them via `matchVendorToSource` so
  // the LLM is never asked to emit them.
  suggested_vendor_domain: z.string().nullable().default(null),
  suggested_vendor_logo_url: z.string().nullable().default(null),
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
  researchedPool?: ResearchedPool;
}

type Bundle = {
  target: PriorityTarget;
  templates: AltTemplate[];
  researched: ResearchedAlternative[];
  recurring?: RecurringSpend;
};

const buildBundles = (
  baseline: BaselineOutput,
  recurring: RecurringSpend[],
  pool: ResearchedPool | undefined,
): Bundle[] => {
  const byMerchant = new Map(recurring.map((r) => [r.merchantNorm, r]));
  const filtered = baseline.priority_targets.filter(
    (t) => t.recommended_next_agent === "cost_savings_agent" || t.recommended_next_agent === "both",
  );
  return filtered.map((target) => ({
    target,
    templates: findCostSaving(target.category, target.baseline_sub_category ?? null),
    researched: pool?.[target.cluster_id] ?? [],
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

// R010 / T006 — case-insensitive substring match between a vendor name and the
// research sources for a single cluster. Matching against the FIRST domain
// segment (e.g. "transportenvironment" not "transportenvironment.org") keeps
// short vendor names (e.g. "FairPhone") from coincidentally matching every
// source's `.com` / `.org` suffix. Sources passed in must come from the same
// cluster — global-pool matches would surface logos from unrelated categories.
const matchVendorToSource = (
  vendorName: string | null,
  sources: { domain: string; title: string; logoUrl: string }[],
): { domain: string; logoUrl: string } | null => {
  if (!vendorName) return null;
  const v = vendorName.toLowerCase();
  for (const s of sources) {
    if (s.domain) {
      const head = s.domain.split(".")[0].toLowerCase();
      if (v.includes(head) || s.domain.toLowerCase().includes(v)) {
        return { domain: s.domain, logoUrl: s.logoUrl };
      }
    }
    if (s.title && s.title.toLowerCase().includes(v)) {
      return { domain: s.domain, logoUrl: s.logoUrl };
    }
  }
  return null;
};

// Flatten the per-cluster researched alternatives into a single source pool so
// the matcher sees every source the Research Agent surfaced for this cluster.
const collectClusterSources = (
  researched: ResearchedAlternative[],
): { domain: string; title: string; logoUrl: string }[] => {
  const out: { domain: string; title: string; logoUrl: string }[] = [];
  for (const a of researched) {
    for (const s of a.sources) {
      out.push({ domain: s.domain, title: s.title, logoUrl: s.logoUrl });
    }
  }
  return out;
};

// R010 / T006 — populate `suggested_vendor_*` on every option in-place using
// the per-cluster source pool. Vendor-switch + supplier_consolidation +
// renegotiation are the option types where matching a real merchant logo is
// meaningful; policy/usage/cancellation rows stay null. We treat the option's
// `option_name` as the vendor candidate string.
const enrichCostOptionsWithLogos = (
  options: Option[],
  researched: ResearchedAlternative[],
): void => {
  const sources = collectClusterSources(researched);
  for (const o of options) {
    const isVendorish =
      o.option_type === "vendor_switch" ||
      o.option_type === "supplier_consolidation" ||
      o.option_type === "renegotiation";
    if (!isVendorish) {
      o.suggested_vendor_domain = null;
      o.suggested_vendor_logo_url = null;
      continue;
    }
    const m = matchVendorToSource(o.option_name, sources);
    o.suggested_vendor_domain = m?.domain ?? null;
    o.suggested_vendor_logo_url = m?.logoUrl ?? null;
  }
};

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
    // R010 / T006 — filled in by the post-build matcher pass. Default null so
    // template-only options that have no matching research source are honest.
    suggested_vendor_domain: null,
    suggested_vendor_logo_url: null,
  };
};

const researchedToOption = (a: ResearchedAlternative, annualSpendEur: number): Option => {
  const cdPct = a.cost_delta_pct ?? 0;
  const annualSaving = -annualSpendEur * cdPct;
  const co2eDelta = a.co2e_delta_pct ?? 0;
  const carbonEffect: Option["carbon_effect"] =
    co2eDelta < -0.05 ? "lower" : co2eDelta > 0.05 ? "higher" : Math.abs(co2eDelta) < 0.02 ? "neutral" : "unknown";
  const businessRisk: Option["business_risk"] = a.feasibility === "drop_in" ? "low" : a.feasibility === "migration" ? "medium" : "medium";
  return {
    option_name: a.name,
    option_type: a.feasibility === "policy" ? "policy_change" : "vendor_switch",
    estimated_monthly_saving_eur: annualSaving > 0 ? Number((annualSaving / 12).toFixed(0)) : null,
    estimated_annual_saving_eur: annualSaving > 0 ? Number(annualSaving.toFixed(0)) : null,
    one_time_saving_eur: null,
    confidence: a.confidence,
    source: a.provenance === "template" ? "benchmark" : "historical_data",
    business_risk: businessRisk,
    carbon_effect: carbonEffect,
    notes: a.description,
    suggested_vendor_domain: null,
    suggested_vendor_logo_url: null,
  };
};

const mockOutput = (
  baseline: BaselineOutput,
  recurring: RecurringSpend[],
  pool: ResearchedPool | undefined,
): CostSavingsOutput => {
  const bundles = buildBundles(baseline, recurring, pool);
  const results = bundles.map((b) => {
    const annualSpend = b.target.annualized_spend_eur;
    const monthlySpend = b.recurring?.monthlyAvgEur ?? annualSpend / 12;
    // Prefer researched alternatives; fall back to templates.
    const options = b.researched.length > 0
      ? b.researched.map((r) => researchedToOption(r, annualSpend))
      : b.templates.map((t) => templateToOption(t, annualSpend));
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
        suggested_vendor_domain: null,
        suggested_vendor_logo_url: null,
      };
      options.push(recurringOption);
    }
    // R010 / T006 — code-side vendor logo enrichment. Mock path uses the same
    // pool the live path will see (b.researched), so the matcher exercise here
    // is identical to production.
    enrichCostOptionsWithLogos(options, b.researched);
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
    "Priority clusters with candidate options. Prefer researched alternatives (live web sources); fall back to library options only if no researched option applies.",
  ];
  for (const b of bundles) {
    lines.push(
      `\n- cluster_id: ${b.target.cluster_id}`,
      `  merchant: ${b.target.baseline_merchant_label ?? "(unknown)"}`,
      `  category: ${b.target.category}${b.target.baseline_sub_category ? "/" + b.target.baseline_sub_category : ""}`,
      `  annual_spend_eur: ${b.target.annualized_spend_eur}`,
      `  recurring: ${b.recurring ? `yes (${b.recurring.monthsPresent} months, ~€${b.recurring.monthlyAvgEur}/mo)` : "no"}`,
    );
    if (b.researched.length > 0) {
      lines.push(`  researched_options (provenance=web_search|cache|template):`);
      for (const r of b.researched) {
        lines.push(
          `    - name: ${r.name}`,
          `      vendor: ${r.vendor ?? "null"}`,
          `      provenance: ${r.provenance}`,
          `      cost_delta_pct: ${r.cost_delta_pct}`,
          `      co2e_delta_pct: ${r.co2e_delta_pct}`,
          `      feasibility: ${r.feasibility}`,
          `      confidence: ${r.confidence}`,
          `      description: ${r.description}`,
          `      source_urls: ${r.sources.map((s) => s.url).join(", ")}`,
        );
      }
    }
    if (b.templates.length > 0) {
      lines.push(`  library_options (fallback only):`);
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
  }
  lines.push(
    "",
    "Return strict JSON: { results: [...] }. Keep every option grounded in the researched or library list — no invented vendors.",
  );
  return lines.join("\n");
};

export async function run(input: CostSavingsInput, ctx: AgentContext): Promise<CostSavingsOutput> {
  const recurring = detectRecurringSpend(ctx.orgId, 3, 6);
  const bundles = buildBundles(input.baseline, recurring, input.researchedPool);
  if (bundles.length === 0 || isMock()) {
    recordAgentMessage(ctx, { agentName: "cost_savings_agent", usedMock: true });
    return mockOutput(input.baseline, recurring, input.researchedPool);
  }
  try {
    const { jsonText, tokensIn, tokensOut, cached, usedMock } = await callAgent({
      system: SYSTEM_PROMPT,
      user: buildUserMessage(input.baseline, bundles),
      maxTokens: 4000,
    });
    if (!jsonText) {
      recordAgentMessage(ctx, { agentName: "cost_savings_agent", usedMock: true });
      return mockOutput(input.baseline, recurring, input.researchedPool);
    }
    const parsed = OUTPUT_SCHEMA.parse(JSON.parse(jsonText));
    const results = parsed.results;
    // R010 / T006 — post-parse enrichment: walk each result, look up the
    // research sources for that cluster, run `enrichCostOptionsWithLogos` so
    // the LLM never sees `suggested_vendor_logo_url` and the matcher stays
    // deterministic. cluster_id null (rare — happens when LLM omits it) leaves
    // options unmatched, which is honest.
    const researchedByCluster = new Map<string, ResearchedAlternative[]>();
    for (const b of bundles) {
      researchedByCluster.set(b.target.cluster_id, b.researched);
    }
    for (const r of results) {
      const researched = r.cluster_id ? researchedByCluster.get(r.cluster_id) ?? [] : [];
      enrichCostOptionsWithLogos(r.cost_saving_options, researched);
    }
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
    recordAgentMessage(ctx, {
      agentName: "cost_savings_agent",
      usedMock,
      tokensIn,
      tokensOut,
      cached,
    });
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
    recordAgentMessage(ctx, { agentName: "cost_savings_agent", usedMock: true });
    return mockOutput(input.baseline, recurring, input.researchedPool);
  }
}
