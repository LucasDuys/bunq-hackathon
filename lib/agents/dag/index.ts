/**
 * 7-agent DAG runner.
 *   baseline → [greenAlt || costSavings] → [greenJudge || costJudge] → creditStrategy → executiveReport
 * See docs/agents/00-overview.md and plans/matrix-dag.md.
 */
import { randomUUID } from "node:crypto";
import * as spendBaseline from "./spendBaseline";
import * as greenAlternatives from "./greenAlternatives";
import * as costSavings from "./costSavings";
import * as greenJudge from "./greenJudge";
import * as costJudge from "./costJudge";
import * as creditStrategy from "./creditStrategy";
import * as executiveReport from "./executiveReport";
import type { AgentContext, AgentName, AgentRunMetrics, DagRunResult } from "./types";

async function timed<T>(fn: () => Promise<T>): Promise<[T, AgentRunMetrics]> {
  const start = performance.now();
  const out = await fn();
  return [
    out,
    { latencyMs: performance.now() - start, inputTokens: 0, outputTokens: 0, cached: false },
  ];
}

export async function runDag(
  input: { orgId: string; month: string },
  ctx: AgentContext,
): Promise<DagRunResult> {
  const metrics = {} as Record<AgentName, AgentRunMetrics>;
  const totalStart = performance.now();

  const [baseline, mBaseline] = await timed(() =>
    spendBaseline.run({ orgId: input.orgId, month: input.month }, ctx),
  );
  metrics.spend_emissions_baseline_agent = mBaseline;
  await ctx.auditLog({
    type: "agent.spend_baseline.run",
    payload: {
      priority_target_count: baseline.priority_targets.length,
      total_spend_eur: baseline.baseline.total_spend_eur,
      total_tco2e: baseline.baseline.estimated_total_tco2e,
      confidence: baseline.baseline.baseline_confidence,
    },
  });

  const [[greenAlt, mGreenAlt], [cost, mCost]] = await Promise.all([
    timed(() => greenAlternatives.run({ baseline }, ctx)),
    timed(() => costSavings.run({ baseline }, ctx)),
  ]);
  metrics.green_alternatives_agent = mGreenAlt;
  metrics.cost_savings_agent = mCost;
  await ctx.auditLog({
    type: "agent.green_alternatives.run",
    payload: {
      result_count: greenAlt.results.length,
      total_potential_kg_co2e_saved: greenAlt.summary.total_potential_kg_co2e_saved,
      average_confidence: greenAlt.summary.average_confidence,
    },
  });
  await ctx.auditLog({
    type: "agent.cost_savings.run",
    payload: {
      result_count: cost.results.length,
      total_potential_annual_saving_eur: cost.summary.total_potential_annual_saving_eur,
      average_confidence: cost.summary.average_confidence,
    },
  });

  const [[gJudge, mGJudge], [cJudge, mCJudge]] = await Promise.all([
    timed(() => greenJudge.run({ greenAlt }, ctx)),
    timed(() => costJudge.run({ costSavings: cost }, ctx)),
  ]);
  metrics.green_judge_agent = mGJudge;
  metrics.cost_judge_agent = mCJudge;

  const [strategy, mStrategy] = await timed(() =>
    creditStrategy.run({ greenJudge: gJudge, costJudge: cJudge, baseline }, ctx),
  );
  metrics.carbon_credit_incentive_strategy_agent = mStrategy;
  await ctx.auditLog({
    type: "agent.credit_strategy.run",
    payload: {
      net_financial_impact_eur: strategy.summary.total_net_company_scale_financial_impact_eur,
      emissions_reduced_tco2e: strategy.summary.total_emissions_reduced_tco2e,
      tax_advisor_review_required: strategy.summary.tax_advisor_review_required,
    },
  });

  const [report, mReport] = await timed(() =>
    executiveReport.run({ greenJudge: gJudge, costJudge: cJudge, creditStrategy: strategy, baseline }, ctx),
  );
  metrics.executive_report_agent = mReport;
  await ctx.auditLog({
    type: "agent.executive_report.run",
    payload: {
      top_recommendation_count: report.top_recommendations.length,
      limitations: report.limitations.length,
    },
  });

  return {
    runId: `run_${randomUUID()}`,
    baseline,
    greenAlt,
    costSavings: cost,
    greenJudge: gJudge,
    costJudge: cJudge,
    creditStrategy: strategy,
    executiveReport: report,
    metrics,
    totalLatencyMs: performance.now() - totalStart,
  };
}

export type { DagRunResult, AgentContext } from "./types";
