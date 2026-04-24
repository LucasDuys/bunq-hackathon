/**
 * 7-agent DAG runner.
 *   baseline → [greenAlt || costSavings] → [greenJudge || costJudge] → creditStrategy → executiveReport
 * See docs/agents/00-overview.md.
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

  const [[greenAlt, mGreenAlt], [cost, mCost]] = await Promise.all([
    timed(() => greenAlternatives.run({ baseline }, ctx)),
    timed(() => costSavings.run({ baseline }, ctx)),
  ]);
  metrics.green_alternatives_agent = mGreenAlt;
  metrics.cost_savings_agent = mCost;

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

  const [report, mReport] = await timed(() =>
    executiveReport.run({ greenJudge: gJudge, costJudge: cJudge, creditStrategy: strategy, baseline }, ctx),
  );
  metrics.executive_report_agent = mReport;

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
