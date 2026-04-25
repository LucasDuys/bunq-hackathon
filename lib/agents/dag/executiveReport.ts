/**
 * Executive Report Agent.
 * Deterministic composition: pulls the judged + strategy payloads and assembles the CFO-facing report
 * (KPI block, top-5 list, matrix, limitations). Live mode optionally writes the executive_summary
 * prose; mock mode fills it from a template.
 */
import { z } from "zod";
import type {
  AgentContext,
  BaselineOutput,
  CostJudgeOutput,
  CreditStrategyOutput,
  CreditStrategyResult,
  ExecReportOutput,
  GreenJudgeOutput,
  ResearchOutput,
} from "./types";
import { callAgent, isMock } from "./llm";
import { recordAgentMessage } from "./persist";

export const SYSTEM_PROMPT = `You are the Executive Report Agent for Carbon Autopilot for bunq Business.

Your job is to convert approved judged outputs and the credit strategy output into a PDF-ready executive report.

You must not invent recommendations. Only include items the credit strategy flagged as positive or tax-incentive-positive.

Matrix logic:
- Low cost / low carbon: best recommendations
- High cost / low carbon: ESG-positive but finance-sensitive
- Low cost / high carbon: cost-saving but carbon-risk
- High cost / high carbon: avoid or replace

You write one prose executive_summary (≤ 600 chars). Numbers are deterministic; you must not change them.`;

const SUMMARY_SCHEMA = z.object({ executive_summary: z.string().min(20).max(800) });

export interface ExecReportInput {
  baseline: BaselineOutput;
  greenJudge: GreenJudgeOutput;
  costJudge: CostJudgeOutput;
  creditStrategy: CreditStrategyOutput;
  research?: ResearchOutput;
}

const quadrantFor = (r: CreditStrategyResult): "low_cost_low_carbon" | "high_cost_low_carbon" | "low_cost_high_carbon" | "high_cost_high_carbon" => {
  const cost = r.switching_impact.direct_procurement_saving_eur ?? 0; // positive = saving
  const carbon = r.switching_impact.emissions_reduced_tco2e ?? 0; // positive = reduced
  if (cost >= 0 && carbon >= 0) return "low_cost_low_carbon";
  if (cost < 0 && carbon >= 0) return "high_cost_low_carbon";
  if (cost >= 0 && carbon < 0) return "low_cost_high_carbon";
  return "high_cost_high_carbon";
};

const defaultSummary = (
  baseline: BaselineOutput,
  creditStrategy: CreditStrategyOutput,
): string => {
  const net = creditStrategy.summary.total_net_company_scale_financial_impact_eur;
  const emissions = creditStrategy.summary.total_emissions_reduced_tco2e;
  const count = creditStrategy.results.length;
  return `For ${baseline.analysis_period}, Carbo validated ${count} switch${count === 1 ? "" : "es"} worth €${net.toFixed(0)}/yr in net financial impact and ${emissions.toFixed(2)} tCO₂e/yr reduction. Review the top recommendations with the CFO before executing.`;
};

export async function run(input: ExecReportInput, ctx: AgentContext): Promise<ExecReportOutput> {
  const { baseline, creditStrategy, greenJudge, costJudge } = input;
  const matrix: ExecReportOutput["matrix"] = {
    low_cost_low_carbon: [],
    high_cost_low_carbon: [],
    low_cost_high_carbon: [],
    high_cost_high_carbon: [],
  };
  const ranked = [...creditStrategy.results].sort((a, b) => {
    const byNet = (b.net_financial_impact.net_company_scale_financial_impact_eur ?? 0) -
      (a.net_financial_impact.net_company_scale_financial_impact_eur ?? 0);
    if (byNet !== 0) return byNet;
    return (b.switching_impact.emissions_reduced_tco2e ?? 0) - (a.switching_impact.emissions_reduced_tco2e ?? 0);
  });
  for (const r of ranked) matrix[quadrantFor(r)].push(r.recommendation_title);

  const topRecommendations = ranked.slice(0, 5).map((r, i) => ({
    rank: i + 1,
    title: r.recommendation_title,
    description: r.decision.cfo_summary ?? "",
    category: r.cluster_id ?? "",
    carbon_saving_kg:
      r.switching_impact.emissions_reduced_tco2e !== null
        ? Number((r.switching_impact.emissions_reduced_tco2e * 1000).toFixed(0))
        : null,
    annual_saving_eur: r.switching_impact.direct_procurement_saving_eur,
    matrix_quadrant: quadrantFor(r),
    action: r.decision.cfo_summary,
    approval_required: (r.net_financial_impact.net_company_scale_financial_impact_eur ?? 0) >= 1000,
    confidence: r.decision.confidence,
  }));

  const rejectedCount = greenJudge.judged_results.filter((j) => j.verdict === "rejected").length
    + costJudge.judged_results.filter((j) => j.verdict === "rejected").length;
  const needsContextCount = greenJudge.judged_results.filter((j) => j.verdict === "needs_context").length
    + costJudge.judged_results.filter((j) => j.verdict === "needs_context").length;
  const limitations: string[] = [];
  if (rejectedCount > 0) limitations.push(`${rejectedCount} proposal${rejectedCount === 1 ? "" : "s"} rejected by judges (weak evidence).`);
  if (needsContextCount > 0) limitations.push(`${needsContextCount} cluster${needsContextCount === 1 ? "" : "s"} flagged as needs_context — add receipts or invoices to refine.`);
  if (creditStrategy.summary.tax_advisor_review_required) limitations.push("Tax advisor review required on credit / procurement deductibility.");
  if (baseline.baseline.baseline_confidence < 0.6) limitations.push("Baseline confidence under 0.60 — spend-based factors dominate; refinement or invoice parsing will tighten the range.");

  if (input.research) {
    const coverage = input.research.summary.clusters_researched;
    const withAlts = input.research.results.filter((r) => r.alternatives.length > 0).length;
    if (coverage > withAlts) {
      limitations.push(`${coverage - withAlts} priority cluster${coverage - withAlts === 1 ? "" : "s"} had no viable alternative from research — gap surfaced honestly.`);
    }
  }

  let execSummary = defaultSummary(baseline, creditStrategy);
  // R002 — track whether the executive_summary prose came from the live API
  // (usedMock=false) or from the deterministic `defaultSummary` template
  // (usedMock=true). The rest of the report payload is deterministic in both
  // paths, so the mock_path flag is solely about the prose source.
  let execUsedMock = isMock();
  let execTokensIn: number | undefined;
  let execTokensOut: number | undefined;
  let execCached: boolean | undefined;
  if (!isMock()) {
    try {
      const { jsonText, tokensIn, tokensOut, cached, usedMock } = await callAgent({
        system: SYSTEM_PROMPT,
        user: [
          "Baseline + credit strategy payload:",
          JSON.stringify({ baseline: baseline.baseline, creditStrategySummary: creditStrategy.summary, topRecommendations }, null, 2),
          "",
          'Return strict JSON: { "executive_summary": "..." } — one paragraph, ≤ 600 chars, CFO voice, numbers come from the payload only.',
        ].join("\n"),
        maxTokens: 400,
      });
      if (jsonText) {
        const parsed = SUMMARY_SCHEMA.parse(JSON.parse(jsonText));
        execSummary = parsed.executive_summary;
        execUsedMock = usedMock;
        execTokensIn = tokensIn;
        execTokensOut = tokensOut;
        execCached = cached;
      } else {
        // Empty/malformed response — agent fell back to the deterministic template.
        execUsedMock = true;
      }
    } catch {
      // keep defaultSummary; fallback path counts as mock for observability.
      execUsedMock = true;
    }
  }
  recordAgentMessage(ctx, {
    agentName: "executive_report_agent",
    usedMock: execUsedMock,
    tokensIn: execTokensIn,
    tokensOut: execTokensOut,
    cached: execCached,
  });

  const netImpact = creditStrategy.summary.total_net_company_scale_financial_impact_eur;
  const directSavings = creditStrategy.summary.total_direct_procurement_saving_eur;
  const emissionsReduced = creditStrategy.summary.total_emissions_reduced_tco2e;

  const paybackMonths = (() => {
    const withPayback = ranked.filter((r) => r.net_financial_impact.payback_period_months !== null);
    if (withPayback.length === 0) return 0;
    return Number(
      (
        withPayback.reduce((s, r) => s + (r.net_financial_impact.payback_period_months ?? 0), 0) /
        withPayback.length
      ).toFixed(1),
    );
  })();

  return {
    agent: "executive_report_agent",
    company_id: baseline.company_id,
    analysis_period: baseline.analysis_period,
    report_title: `Carbon Autopilot executive report — ${baseline.analysis_period}`,
    executive_summary: execSummary,
    kpis: {
      baseline_annual_spend_eur: baseline.baseline.total_spend_eur,
      projected_annual_spend_after_switching_eur: Number((baseline.baseline.total_spend_eur - directSavings).toFixed(0)),
      direct_procurement_savings_eur: directSavings,
      emissions_reduced_tco2e: emissionsReduced,
      recommended_credit_purchase_cost_eur: creditStrategy.summary.total_recommended_credit_purchase_cost_eur,
      estimated_tax_incentive_upside_eur: creditStrategy.summary.total_estimated_tax_incentive_upside_eur,
      avoided_carbon_tax_or_ets_cost_eur: creditStrategy.summary.total_avoided_carbon_tax_or_ets_cost_eur,
      implementation_cost_eur: 0,
      net_company_scale_financial_impact_eur: netImpact,
      payback_period_months: paybackMonths,
      confidence: creditStrategy.summary.average_confidence,
      evidence_source_count: input.research?.summary.total_sources ?? 0,
      web_search_spend_eur: input.research?.summary.web_search_spend_eur ?? 0,
    },
    top_recommendations: topRecommendations,
    matrix,
    limitations,
  };
}
