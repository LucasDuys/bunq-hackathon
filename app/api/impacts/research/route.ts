import { NextResponse } from "next/server";
import { runDag } from "@/lib/agents/dag";
import type { AgentContext } from "@/lib/agents/dag/types";
import { appendAudit } from "@/lib/audit/append";
import { env } from "@/lib/env";
import { persistDagRun } from "@/lib/impacts/store";
import { DEFAULT_ORG_ID, currentMonth } from "@/lib/queries";

export const POST = async (req: Request) => {
  const body = (await req.json().catch(() => ({}))) as { orgId?: string; month?: string };
  const orgId = body.orgId ?? DEFAULT_ORG_ID;
  const month = body.month ?? currentMonth();

  const ctx: AgentContext = {
    orgId,
    analysisPeriod: month,
    dryRun: env.dryRun,
    mock: env.anthropicMock || !env.anthropicKey,
    auditLog: async (event) => {
      appendAudit({ orgId, actor: "agent", type: event.type, payload: event.payload });
    },
  };

  try {
    const dag = await runDag({ orgId, month }, ctx);
    const { agentRunId, researchRunId, insertedRecommendations } = persistDagRun({
      orgId,
      month,
      dag,
      mock: ctx.mock,
    });

    appendAudit({
      orgId,
      actor: "agent",
      type: "agent.run.dag",
      payload: {
        agentRunId,
        researchRunId,
        month,
        mock: ctx.mock,
        totalLatencyMs: dag.totalLatencyMs,
        net_financial_impact_eur: dag.executiveReport.kpis.net_company_scale_financial_impact_eur,
        emissions_reduced_tco2e: dag.executiveReport.kpis.emissions_reduced_tco2e,
        top_recommendations: dag.executiveReport.top_recommendations.length,
        inserted_recommendations: insertedRecommendations,
      },
    });

    return NextResponse.json({
      agentRunId,
      researchRunId,
      month,
      insertedRecommendations,
      metrics: dag.metrics,
      totalLatencyMs: dag.totalLatencyMs,
      kpis: dag.executiveReport.kpis,
    });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
};
