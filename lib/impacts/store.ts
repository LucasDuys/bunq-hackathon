import { randomUUID } from "node:crypto";
import { and, desc, eq } from "drizzle-orm";
import { agentRuns, db, impactRecommendations } from "@/lib/db/client";
import type { AgentRun, ImpactRecommendation } from "@/lib/db/schema";
import type { BaselineItem } from "@/lib/impacts/aggregate";
import type { ResolvedAlternative } from "@/lib/agent/impacts";
import type { DagRunResult } from "@/lib/agents/dag/types";

export const persistRecommendations = (params: {
  orgId: string;
  month: string;
  baselines: BaselineItem[];
  alternatives: ResolvedAlternative[];
}): { researchRunId: string; inserted: number } => {
  const researchRunId = `ir_${randomUUID().slice(0, 8)}`;
  const baselineMap = new Map(params.baselines.map((b) => [b.key, b]));
  const rows = params.alternatives.flatMap((a) => {
    const b = baselineMap.get(a.baselineKey);
    if (!b) return [];
    return [
      {
        id: `ira_${randomUUID().slice(0, 10)}`,
        orgId: params.orgId,
        researchRunId,
        month: params.month,
        baselineKey: b.key,
        baselineMerchantNorm: b.merchantNorm,
        baselineMerchantLabel: b.merchantLabel,
        baselineCategory: b.category,
        baselineSubCategory: b.subCategory,
        baselineAnnualSpendEur: b.annualSpendEur,
        baselineAnnualCo2eKg: b.annualCo2eKg,
        baselineConfidence: b.confidence,
        altName: a.name,
        altType: a.type,
        altDescription: a.description,
        altCostDeltaPct: a.costDeltaPct,
        altCo2eDeltaPct: a.co2eDeltaPct,
        altCostDeltaEurYear: a.costDeltaEurYear,
        altCo2eDeltaKgYear: a.co2eDeltaKgYear,
        altConfidence: a.confidence,
        altFeasibility: a.feasibility,
        altRationale: a.rationale,
        altSources: JSON.stringify(a.sources),
        quadrant: a.quadrant,
      },
    ];
  });
  if (rows.length > 0) db.insert(impactRecommendations).values(rows).run();
  return { researchRunId, inserted: rows.length };
};

export const getLatestResearchRun = (orgId: string): string | null => {
  const row = db
    .select({ researchRunId: impactRecommendations.researchRunId, createdAt: impactRecommendations.createdAt })
    .from(impactRecommendations)
    .where(eq(impactRecommendations.orgId, orgId))
    .orderBy(desc(impactRecommendations.createdAt))
    .limit(1)
    .all()[0];
  return row?.researchRunId ?? null;
};

export const getRecommendationsForRun = (orgId: string, researchRunId: string): ImpactRecommendation[] =>
  db
    .select()
    .from(impactRecommendations)
    .where(and(eq(impactRecommendations.orgId, orgId), eq(impactRecommendations.researchRunId, researchRunId)))
    .all();

export const getLatestRecommendations = (orgId: string): ImpactRecommendation[] => {
  const runId = getLatestResearchRun(orgId);
  return runId ? getRecommendationsForRun(orgId, runId) : [];
};

/**
 * Persist the full DAG payload (baseline → report) and flatten approved green alternatives
 * into the legacy impactRecommendations table so the existing /impacts UI keeps rendering.
 */
export const persistDagRun = (params: {
  orgId: string;
  month: string;
  dag: DagRunResult;
  mock: boolean;
}): { agentRunId: string; researchRunId: string; insertedRecommendations: number } => {
  const { orgId, month, dag, mock } = params;
  const researchRunId = `ir_${randomUUID().slice(0, 8)}`;
  const agentRunId = dag.runId;

  // Flatten approved green alternatives into the legacy table.
  const approvedCluster = new Set(
    dag.greenJudge.judged_results
      .filter((j) => j.verdict === "approved" || j.verdict === "approved_with_caveats")
      .map((j) => j.cluster_id)
      .filter((c): c is string => !!c),
  );
  const priorityByCluster = new Map(dag.baseline.priority_targets.map((t) => [t.cluster_id, t]));
  const rows: Array<typeof impactRecommendations.$inferInsert> = [];
  for (const result of dag.greenAlt.results) {
    if (!result.cluster_id || !approvedCluster.has(result.cluster_id)) continue;
    const target = priorityByCluster.get(result.cluster_id);
    for (const alt of result.alternatives) {
      const costDeltaPct = (alt.price_delta_eur ?? 0) / 100;
      const co2eDeltaPct = (alt.carbon_saving_percent ?? 0) / -100;
      const quadrant = quadrantFromDeltas(costDeltaPct, co2eDeltaPct);
      rows.push({
        id: `ira_${randomUUID().slice(0, 10)}`,
        orgId,
        researchRunId,
        month,
        baselineKey: `${target?.baseline_merchant_norm ?? result.merchant}|${target?.category ?? "other"}|${target?.baseline_sub_category ?? "_"}`,
        baselineMerchantNorm: target?.baseline_merchant_norm ?? result.merchant,
        baselineMerchantLabel: target?.baseline_merchant_label ?? result.merchant,
        baselineCategory: target?.category ?? "other",
        baselineSubCategory: target?.baseline_sub_category ?? null,
        baselineAnnualSpendEur: target?.annualized_spend_eur ?? result.current_purchase.amount_eur,
        baselineAnnualCo2eKg: (target?.estimated_tco2e ?? 0) * 1000,
        baselineConfidence: target?.baseline_confidence ?? result.current_purchase.confidence,
        altName: alt.alternative_name,
        altType: alt.alternative_type,
        altDescription: alt.comparability_notes,
        altCostDeltaPct: costDeltaPct,
        altCo2eDeltaPct: co2eDeltaPct,
        altCostDeltaEurYear: Number(((target?.annualized_spend_eur ?? 0) * costDeltaPct).toFixed(2)),
        altCo2eDeltaKgYear: Number((-1 * (alt.carbon_saving_kg ?? 0)).toFixed(3)),
        altConfidence: alt.confidence,
        altFeasibility: inferFeasibility(alt.source),
        altRationale: alt.comparability_notes,
        altSources: JSON.stringify([]),
        quadrant,
      });
    }
  }
  if (rows.length > 0) db.insert(impactRecommendations).values(rows).run();

  db.insert(agentRuns)
    .values({
      id: agentRunId,
      orgId,
      month,
      researchRunId,
      dagPayload: JSON.stringify(dag),
      totalLatencyMs: Math.round(dag.totalLatencyMs),
      mock,
    })
    .run();

  return { agentRunId, researchRunId, insertedRecommendations: rows.length };
};

const quadrantFromDeltas = (costDeltaPct: number, co2eDeltaPct: number): string => {
  if (costDeltaPct <= 0 && co2eDeltaPct <= 0) return "win_win";
  if (costDeltaPct > 0 && co2eDeltaPct < 0) return "pay_to_decarbonize";
  if (costDeltaPct < 0 && co2eDeltaPct > 0) return "status_quo_trap";
  return "avoid";
};

const inferFeasibility = (source: string): "drop_in" | "migration" | "procurement" => {
  switch (source) {
    case "emission_factor_library":
    case "historical_data":
      return "drop_in";
    case "simulated":
    case "assumption":
      return "migration";
    default:
      return "procurement";
  }
};

export const getLatestAgentRun = (orgId: string): AgentRun | null => {
  const row = db
    .select()
    .from(agentRuns)
    .where(eq(agentRuns.orgId, orgId))
    .orderBy(desc(agentRuns.createdAt))
    .limit(1)
    .all()[0];
  return row ?? null;
};

export const getLatestDagResult = (orgId: string): DagRunResult | null => {
  const row = getLatestAgentRun(orgId);
  if (!row) return null;
  try {
    return JSON.parse(row.dagPayload) as DagRunResult;
  } catch {
    return null;
  }
};
