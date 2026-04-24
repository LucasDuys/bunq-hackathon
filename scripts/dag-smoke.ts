import { runDag } from "@/lib/agents/dag";

const main = async () => {
  const out = await runDag(
    { orgId: "org_acme_bv", month: "2026-03" },
    {
      orgId: "org_acme_bv",
      analysisPeriod: "2026-03",
      dryRun: true,
      mock: true,
      auditLog: async () => {},
    },
  );

  console.log("runDag smoke ─────────────────────────");
  console.log("runId:                    ", out.runId);
  console.log("baseline priority targets:", out.baseline.priority_targets.length);
  console.log("baseline analysis_period: ", out.baseline.analysis_period);
  console.log("greenAlt consumed:        ", out.greenAlt.analysis_period, "items=", out.greenAlt.results.length);
  console.log("costSavings consumed:     ", out.costSavings.analysis_period, "items=", out.costSavings.results.length);
  console.log("greenJudge consumed:      ", out.greenJudge.analysis_period, "items=", out.greenJudge.judged_results.length);
  console.log("costJudge consumed:       ", out.costJudge.analysis_period, "items=", out.costJudge.judged_results.length);
  console.log("creditStrategy consumed:  ", out.creditStrategy.analysis_period);
  console.log("executiveReport consumed: ", out.executiveReport.analysis_period, "title=", JSON.stringify(out.executiveReport.report_title));
  console.log("total latency ms:         ", Math.round(out.totalLatencyMs));
  console.log();
  console.log("sample baseline priority target passed to green/cost agents:");
  console.log(JSON.stringify(out.baseline.priority_targets[0], null, 2));
};

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
