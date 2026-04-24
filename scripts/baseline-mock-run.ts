/**
 * Mock run of the Baseline agent — no Next.js, no HTTP, no LLM.
 * Runs `runBaseline()` directly against the seeded DB and dumps the output
 * so we can eyeball what the /api/baseline/run response looks like.
 *
 *   pnpm exec tsx scripts/baseline-mock-run.ts [YYYY-MM]
 */

import { run as runBaseline } from "@/lib/agents/dag/spendBaseline";
import { DEFAULT_ORG_ID } from "@/lib/queries";

const month = process.argv[2] ?? "2026-03";

const main = async () => {
  const t0 = performance.now();
  const out = await runBaseline({ orgId: DEFAULT_ORG_ID, month });
  const runMs = Math.round(performance.now() - t0);

  console.log("=".repeat(78));
  console.log(`Baseline run · org=${DEFAULT_ORG_ID} · month=${month} · ${runMs}ms`);
  console.log("=".repeat(78));
  console.log();
  console.log("─── baseline ─".padEnd(78, "─"));
  console.log(`  total spend          €${out.baseline.total_spend_eur.toLocaleString("en-NL")}`);
  console.log(`  total emissions      ${out.baseline.estimated_total_tco2e.toFixed(3)} tCO2e`);
  console.log(`  baseline confidence  ${(out.baseline.baseline_confidence * 100).toFixed(1)}%`);
  console.log();
  console.log("  top spend categories:");
  for (const r of out.baseline.top_spend_categories) {
    console.log(`    ${r.category.padEnd(16)} €${String(r.spend_eur).padStart(9)}  (${r.share_pct}%)`);
  }
  console.log();
  console.log("  top emission categories:");
  for (const r of out.baseline.top_emission_categories) {
    console.log(`    ${r.category.padEnd(16)} ${r.tco2e.toFixed(3)} tCO2e  (${r.share_pct}%)`);
  }
  console.log();
  console.log(`  high_cost_high_carbon_clusters: ${out.baseline.high_cost_high_carbon_clusters.join(", ") || "—"}`);
  console.log(`  uncertain_high_value_clusters:  ${out.baseline.uncertain_high_value_clusters.join(", ") || "—"}`);
  console.log();
  console.log("─── priority targets ".padEnd(78, "─"));
  for (const t of out.priority_targets) {
    const hdr = `  [${t.reason_for_priority.padEnd(16)}] ${t.cluster_id}`;
    console.log(hdr);
    console.log(
      `    annualized €${t.annualized_spend_eur.toLocaleString("en-NL").padEnd(9)}` +
        ` · ${t.estimated_tco2e.toFixed(2)} tCO2e` +
        ` · ${t.transaction_count ?? "?"} txs` +
        ` · conf ${((t.avg_confidence ?? 0) * 100).toFixed(0)}%`,
    );
    console.log(`    → ${t.recommended_next_agent}`);
    console.log(`    ${t.reason_for_priority_detail ?? ""}`);
    console.log();
  }
  console.log(`required_context_question: ${out.required_context_question ?? "null"}`);
  console.log();
  console.log("─── full JSON (what /api/baseline/run returns) ".padEnd(78, "─"));
  console.log(JSON.stringify(out, null, 2));
};

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
