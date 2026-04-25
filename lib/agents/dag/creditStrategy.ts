/**
 * Carbon Credit & Incentive Strategy Agent.
 *
 * Combines approved judge outputs with a jurisdiction table (NL/DE/FR/EU) + lib/credits/projects.ts
 * to compute CFO-grade net financial impact per approved switch. Math is deterministic — the agent
 * (live mode) only writes the CFO prose summary + picks credit-type labels. Mock mode fills the prose
 * from a template so /impacts works without an API key.
 */
import type {
  AgentContext,
  BaselineOutput,
  CostJudgeOutput,
  CreditStrategyOutput,
  CreditStrategyResult,
  GreenJudgeOutput,
} from "./types";
import { getCarbonCreditPrice, getCarbonPriceExposure, getCorporateTaxRate } from "./tools";
import { callAgent, isMock } from "./llm";
import { recordAgentMessage } from "./persist";
import { z } from "zod";

export const SYSTEM_PROMPT = `You are the Carbon Credit & Incentive Strategy Agent for Carbon Autopilot for bunq Business.

Your job is to estimate company-scale financial upside from greener switching, carbon-credit strategy, tax incentives, subsidies, avoided carbon costs, and reduced offset requirements.

You are not a tax lawyer. You do not provide legal advice. You produce structured labels and a short CFO summary; numeric math is computed in code and supplied to you — you may re-phrase, not re-compute.

Operating rules:
1. Return JSON only.
2. Use the credit_type values supplied in the user message — do not invent projects.
3. Tax treatment: use "confirmed" only if the jurisdiction table marks it; default "scenario_only" or "requires_verification".
4. Never claim carbon credits automatically reduce tax.
5. Keep cfo_summary under 220 characters.

Output JSON schema: see docs/agents/06-credit-strategy.md.`;

const PROSE_SCHEMA = z.object({
  results: z.array(
    z.object({
      cluster_id: z.string().nullable(),
      credit_type: z.enum(["removal_technical", "removal_nature", "reduction", "mixed", "unknown"]),
      tax_treatment: z.enum(["confirmed", "scenario_only", "not_applicable", "requires_verification"]),
      cfo_summary: z.string().max(400),
      verification_needed: z.array(z.string()),
      recommendation_status: z.enum([
        "strong_financial_case",
        "positive_with_tax_incentive",
        "positive_only_if_policy_required",
        "not_financially_positive",
        "requires_tax_verification",
        "insufficient_data",
      ]),
    }),
  ),
});

export interface CreditStrategyInput {
  greenJudge: GreenJudgeOutput;
  costJudge: CostJudgeOutput;
  baseline: BaselineOutput;
}

type ProseDecision = z.infer<typeof PROSE_SCHEMA>["results"][number];

type Computed = {
  cluster_id: string | null;
  greenTitle: string | null;
  costTitle: string | null;
  direct_saving_eur: number;
  emissions_reduced_tco2e: number;
  currentAnnualSpendEur: number | null;
  newAnnualSpendEur: number | null;
  baselineTco2e: number | null;
  newTco2e: number | null;
  implementation_cost_eur: number;
  credit_price_per_tonne_eur: number;
  residual_tco2e: number;
  credit_purchase_cost_eur: number;
  avoided_credit_purchase_cost_eur: number;
  tax_deduction_value_eur: number;
  avoided_carbon_price_eur: number;
  gross_before_tax_eur: number;
  net_eur: number;
  payback_months: number | null;
  confidence: number;
};

const IMPLEMENTATION_COST_DEFAULT = 0; // Deterministic zero unless we learn otherwise; keeps "not invented".

const compute = (
  baseline: BaselineOutput,
  greenJudge: GreenJudgeOutput,
  costJudge: CostJudgeOutput,
  taxRate: number,
  etsEurPerTonne: number,
  creditPricePerTonne: number,
): Computed[] => {
  const greenByCluster = new Map(greenJudge.judged_results.map((g) => [g.cluster_id, g]));
  const costByCluster = new Map(costJudge.judged_results.map((c) => [c.cluster_id, c]));
  const clusterIds = new Set<string>();
  for (const g of greenJudge.judged_results) if (g.cluster_id) clusterIds.add(g.cluster_id);
  for (const c of costJudge.judged_results) if (c.cluster_id) clusterIds.add(c.cluster_id);

  const out: Computed[] = [];
  for (const cluster_id of clusterIds) {
    const g = greenByCluster.get(cluster_id);
    const c = costByCluster.get(cluster_id);
    const gApproved = g && (g.verdict === "approved" || g.verdict === "approved_with_caveats");
    const cApproved = c && (c.verdict === "approved" || c.verdict === "approved_with_caveats");
    if (!gApproved && !cApproved) continue;

    const emissions_reduced_kg = gApproved ? (g?.corrected_potential_kg_co2e_saved ?? 0) : 0;
    const emissions_reduced_tco2e = emissions_reduced_kg / 1000;
    const direct_saving_eur = cApproved ? c?.corrected_annual_saving_eur ?? 0 : 0;

    // Pull the baseline cluster for spend context
    const bl = baseline.priority_targets.find((t) => t.cluster_id === cluster_id);
    const currentAnnualSpendEur = bl?.annualized_spend_eur ?? null;
    const newAnnualSpendEur =
      currentAnnualSpendEur !== null ? Math.max(0, currentAnnualSpendEur - direct_saving_eur) : null;
    const baselineTco2e = bl?.estimated_tco2e ?? null;
    const newTco2e = baselineTco2e !== null ? Math.max(0, baselineTco2e - emissions_reduced_tco2e) : null;

    const residual_tco2e = Math.max(0, newTco2e ?? 0);
    const credit_purchase_cost_eur = Number((residual_tco2e * creditPricePerTonne).toFixed(2));
    const avoided_credit_purchase_cost_eur = Number((emissions_reduced_tco2e * creditPricePerTonne).toFixed(2));
    const tax_deduction_value_eur = Number((direct_saving_eur * taxRate).toFixed(2));
    const avoided_carbon_price_eur = Number((emissions_reduced_tco2e * etsEurPerTonne).toFixed(2));
    const gross_before_tax_eur = Number(
      (direct_saving_eur + avoided_credit_purchase_cost_eur + avoided_carbon_price_eur).toFixed(2),
    );
    const net_eur = Number(
      (gross_before_tax_eur + tax_deduction_value_eur - IMPLEMENTATION_COST_DEFAULT).toFixed(2),
    );
    const monthlyNet = net_eur / 12;
    const payback_months =
      IMPLEMENTATION_COST_DEFAULT > 0 && monthlyNet > 0
        ? Number((IMPLEMENTATION_COST_DEFAULT / monthlyNet).toFixed(1))
        : null;
    const confidence = Math.min(
      (gApproved ? (g?.confidence ?? 0.5) : 0.5),
      (cApproved ? (c?.confidence ?? 0.5) : 0.5),
    );

    out.push({
      cluster_id,
      greenTitle: gApproved ? g?.approved_recommendation ?? null : null,
      costTitle: cApproved ? c?.approved_recommendation ?? null : null,
      direct_saving_eur,
      emissions_reduced_tco2e,
      currentAnnualSpendEur,
      newAnnualSpendEur,
      baselineTco2e,
      newTco2e,
      implementation_cost_eur: IMPLEMENTATION_COST_DEFAULT,
      credit_price_per_tonne_eur: creditPricePerTonne,
      residual_tco2e,
      credit_purchase_cost_eur,
      avoided_credit_purchase_cost_eur,
      tax_deduction_value_eur,
      avoided_carbon_price_eur,
      gross_before_tax_eur,
      net_eur,
      payback_months,
      confidence: Number(confidence.toFixed(3)),
    });
  }
  return out.sort((a, b) => b.net_eur - a.net_eur);
};

const statusFor = (c: Computed): CreditStrategyResult["decision"]["recommendation_status"] => {
  if (c.net_eur > 500 && c.direct_saving_eur > 0 && c.emissions_reduced_tco2e > 0) return "strong_financial_case";
  if (c.net_eur > 0 && c.tax_deduction_value_eur > 0) return "positive_with_tax_incentive";
  if (c.net_eur > 0 && c.emissions_reduced_tco2e > 0) return "positive_only_if_policy_required";
  if (c.direct_saving_eur < 0) return "not_financially_positive";
  return "requires_tax_verification";
};

const titleFor = (c: Computed): string => c.greenTitle ?? c.costTitle ?? (c.cluster_id ?? "Unnamed switch");

const cfoSummaryFor = (c: Computed): string => {
  const parts: string[] = [];
  if (c.direct_saving_eur > 0) parts.push(`€${c.direct_saving_eur.toFixed(0)}/yr direct saving`);
  if (c.emissions_reduced_tco2e > 0) parts.push(`${c.emissions_reduced_tco2e.toFixed(2)} tCO₂e/yr reduced`);
  if (c.avoided_credit_purchase_cost_eur > 0)
    parts.push(`€${c.avoided_credit_purchase_cost_eur.toFixed(0)} avoided credit`);
  if (c.tax_deduction_value_eur > 0) parts.push(`€${c.tax_deduction_value_eur.toFixed(0)} tax upside`);
  if (parts.length === 0) return "Net impact is marginal — keep as optional policy lever.";
  return `Net €${c.net_eur.toFixed(0)}/yr: ${parts.join(", ")}.`;
};

const assemble = (
  baseline: BaselineOutput,
  greenJudge: GreenJudgeOutput,
  costJudge: CostJudgeOutput,
  computeds: Computed[],
  proseByCluster: Map<string, ProseDecision>,
  taxProfile: { corporateTaxRate: number; jurisdiction: string; entityType: string },
  creditPrice: { type: "removal_nature" | "removal_technical" | "reduction"; pricePerTonneEur: number; region: "EU" },
): CreditStrategyOutput => {
  const results: CreditStrategyResult[] = computeds.map((c) => {
    const prose = c.cluster_id ? proseByCluster.get(c.cluster_id) : undefined;
    const credit_type = prose?.credit_type ?? creditPrice.type;
    const tax_treatment = prose?.tax_treatment ?? "scenario_only";
    const status = prose?.recommendation_status ?? statusFor(c);
    const verification: string[] =
      prose?.verification_needed ?? (tax_treatment === "scenario_only" ? ["Confirm corporate tax deductibility with advisor"] : []);
    const summary = prose?.cfo_summary ?? cfoSummaryFor(c);
    return {
      cluster_id: c.cluster_id,
      recommendation_title: titleFor(c),
      switching_impact: {
        current_annual_spend_eur: c.currentAnnualSpendEur,
        new_annual_spend_eur: c.newAnnualSpendEur,
        direct_procurement_saving_eur: c.direct_saving_eur,
        implementation_cost_eur: c.implementation_cost_eur,
        baseline_tco2e: c.baselineTco2e,
        new_tco2e: c.newTco2e,
        emissions_reduced_tco2e: c.emissions_reduced_tco2e,
      },
      credit_strategy: {
        remaining_tco2e_after_switch: c.residual_tco2e,
        recommended_credit_purchase_tco2e: c.residual_tco2e,
        credit_type,
        project_region: creditPrice.region,
        credit_price_per_tonne_eur: c.credit_price_per_tonne_eur,
        credit_purchase_cost_eur: c.credit_purchase_cost_eur,
        avoided_credit_purchase_cost_eur: c.avoided_credit_purchase_cost_eur,
        eligibility_basis: tax_treatment === "confirmed" ? "confirmed" : "requires_verification",
      },
      tax_and_incentives: {
        estimated_credit_tax_value_eur: null,
        estimated_procurement_tax_value_eur: c.tax_deduction_value_eur,
        avoided_carbon_tax_or_ets_cost_eur: c.avoided_carbon_price_eur,
        tax_treatment,
      },
      net_financial_impact: {
        gross_savings_before_tax_eur: c.gross_before_tax_eur,
        total_tax_incentive_upside_eur: c.tax_deduction_value_eur,
        total_avoided_carbon_cost_eur: c.avoided_carbon_price_eur,
        total_credit_cost_eur: c.credit_purchase_cost_eur,
        net_company_scale_financial_impact_eur: c.net_eur,
        payback_period_months: c.payback_months,
      },
      decision: {
        recommendation_status: status,
        cfo_summary: summary,
        verification_needed: verification,
        confidence: c.confidence,
      },
    };
  });

  const summary = {
    total_direct_procurement_saving_eur: Number(computeds.reduce((s, c) => s + c.direct_saving_eur, 0).toFixed(0)),
    total_emissions_reduced_tco2e: Number(computeds.reduce((s, c) => s + c.emissions_reduced_tco2e, 0).toFixed(2)),
    total_avoided_credit_purchase_cost_eur: Number(
      computeds.reduce((s, c) => s + c.avoided_credit_purchase_cost_eur, 0).toFixed(0),
    ),
    total_recommended_credit_purchase_cost_eur: Number(
      computeds.reduce((s, c) => s + c.credit_purchase_cost_eur, 0).toFixed(0),
    ),
    total_estimated_tax_incentive_upside_eur: Number(
      computeds.reduce((s, c) => s + c.tax_deduction_value_eur, 0).toFixed(0),
    ),
    total_avoided_carbon_tax_or_ets_cost_eur: Number(
      computeds.reduce((s, c) => s + c.avoided_carbon_price_eur, 0).toFixed(0),
    ),
    total_net_company_scale_financial_impact_eur: Number(
      computeds.reduce((s, c) => s + c.net_eur, 0).toFixed(0),
    ),
    average_confidence:
      computeds.length > 0
        ? Number((computeds.reduce((s, c) => s + c.confidence, 0) / computeds.length).toFixed(3))
        : 0,
    tax_advisor_review_required: results.some((r) => r.tax_and_incentives.tax_treatment !== "confirmed"),
  };

  return {
    agent: "carbon_credit_incentive_strategy_agent",
    company_id: baseline.company_id,
    analysis_period: baseline.analysis_period,
    jurisdiction: {
      country: taxProfile.jurisdiction,
      tax_jurisdiction: taxProfile.jurisdiction,
      entity_type: taxProfile.entityType,
      corporate_tax_rate: taxProfile.corporateTaxRate,
    },
    baseline: {
      baseline_annual_spend_eur: baseline.baseline.total_spend_eur,
      baseline_annual_tco2e: baseline.baseline.estimated_total_tco2e,
    },
    results,
    summary,
  };
};

export async function run(input: CreditStrategyInput, ctx: AgentContext): Promise<CreditStrategyOutput> {
  const tax = getCorporateTaxRate("NL", "BV");
  const exposure = getCarbonPriceExposure("NL", "default");
  const credit = getCarbonCreditPrice("removal_nature");
  const computeds = compute(input.baseline, input.greenJudge, input.costJudge, tax.corporateTaxRate, exposure.euPerTonne, credit.pricePerTonneEur);
  if (computeds.length === 0) {
    // No clusters means no Sonnet call would have happened either way; the agent
    // ran deterministically. Treat that as the live (non-mock) path so the
    // mock-agent count tracks Sonnet-fallbacks, not vacuous skips.
    recordAgentMessage(ctx, { agentName: "carbon_credit_incentive_strategy_agent", usedMock: false });
    return assemble(input.baseline, input.greenJudge, input.costJudge, [], new Map(), tax, credit);
  }

  if (isMock()) {
    recordAgentMessage(ctx, { agentName: "carbon_credit_incentive_strategy_agent", usedMock: true });
    return assemble(input.baseline, input.greenJudge, input.costJudge, computeds, new Map(), tax, credit);
  }

  try {
    const userPayload = {
      jurisdiction: tax,
      ets: exposure,
      credit,
      computeds: computeds.map((c) => ({
        cluster_id: c.cluster_id,
        title: titleFor(c),
        direct_saving_eur: c.direct_saving_eur,
        emissions_reduced_tco2e: c.emissions_reduced_tco2e,
        net_eur: c.net_eur,
        residual_tco2e: c.residual_tco2e,
        tax_deduction_value_eur: c.tax_deduction_value_eur,
        avoided_carbon_price_eur: c.avoided_carbon_price_eur,
      })),
    };
    const { jsonText, tokensIn, tokensOut, cached, usedMock } = await callAgent({
      system: SYSTEM_PROMPT,
      user: [
        "Jurisdiction + computed impacts for each approved switch:",
        JSON.stringify(userPayload, null, 2),
        "",
        "Return strict JSON: { results: [{ cluster_id, credit_type, tax_treatment, cfo_summary, verification_needed, recommendation_status }] }.",
        "Keep credit_type consistent with the supplied `credit.type` unless you have strong evidence otherwise.",
        "recommendation_status MUST be EXACTLY one of: strong_financial_case | positive_with_tax_incentive | positive_only_if_policy_required | not_financially_positive | requires_tax_verification | insufficient_data. Do not paraphrase or invent values.",
      ].join("\n"),
      maxTokens: 20000,
    });
    if (!jsonText) {
      recordAgentMessage(ctx, { agentName: "carbon_credit_incentive_strategy_agent", usedMock: true });
      return assemble(input.baseline, input.greenJudge, input.costJudge, computeds, new Map(), tax, credit);
    }
    recordAgentMessage(ctx, {
      agentName: "carbon_credit_incentive_strategy_agent",
      usedMock,
      tokensIn,
      tokensOut,
      cached,
    });
    const parsed = PROSE_SCHEMA.parse(JSON.parse(jsonText));
    const proseMap = new Map<string, ProseDecision>();
    for (const p of parsed.results) if (p.cluster_id) proseMap.set(p.cluster_id, p);
    return assemble(input.baseline, input.greenJudge, input.costJudge, computeds, proseMap, tax, credit);
  } catch (err) {
    console.error("[carbon_credit_incentive_strategy_agent] live call failed, falling back to mock:", err);
    recordAgentMessage(ctx, { agentName: "carbon_credit_incentive_strategy_agent", usedMock: true });
    return assemble(input.baseline, input.greenJudge, input.costJudge, computeds, new Map(), tax, credit);
  }
}
