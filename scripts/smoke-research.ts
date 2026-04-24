/**
 * Smoke test for the research-enabled DAG. Runs in mock mode and prints:
 *  - Researched alternatives per cluster
 *  - Evidence source count
 *  - Number of clusters where Green Judge said zero-source → rejected
 *
 * Exit non-zero if the DAG throws.
 *
 *   ANTHROPIC_MOCK=1 npx tsx scripts/smoke-research.ts
 */
import { DEFAULT_ORG_ID } from "@/lib/queries";
import { runDag } from "@/lib/agents/dag";
import { appendAudit } from "@/lib/audit/append";

const nowMonth = () => {
  const d = new Date();
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
};

async function main() {
  const orgId = DEFAULT_ORG_ID;
  const month = nowMonth();
  const result = await runDag(
    { orgId, month },
    {
      orgId,
      analysisPeriod: month,
      dryRun: true,
      mock: true,
      auditLog: async (event) => {
        appendAudit({ orgId, actor: "agent", type: event.type, payload: event.payload });
      },
    },
  );

  console.log("runId:", result.runId);
  console.log("baseline priority targets:", result.baseline.priority_targets.length);
  console.log("research summary:", result.research.summary);
  console.log("executive KPIs:", {
    evidence_source_count: result.executiveReport.kpis.evidence_source_count,
    web_search_spend_eur: result.executiveReport.kpis.web_search_spend_eur,
    confidence: result.executiveReport.kpis.confidence,
  });

  const clustersWithAlts = result.research.results.filter((r) => r.alternatives.length > 0).length;
  const totalProvenanceCounts = result.research.results.flatMap((r) => r.alternatives).reduce<Record<string, number>>((acc, a) => {
    acc[a.provenance] = (acc[a.provenance] ?? 0) + 1;
    return acc;
  }, {});
  console.log("clusters with alternatives:", clustersWithAlts, "/", result.research.results.length);
  console.log("provenance breakdown:", totalProvenanceCounts);

  const rejectedWithZeroSources = result.greenJudge.judged_results.filter((j) => j.verdict === "rejected" && j.issues_found.includes("zero_sources")).length;
  console.log("rejected for zero_sources (green):", rejectedWithZeroSources);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
