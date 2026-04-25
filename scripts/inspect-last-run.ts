import { db, agentRuns, agentMessages } from "@/lib/db/client";
import { sql, desc } from "drizzle-orm";

const runs = db.select().from(agentRuns).orderBy(desc(agentRuns.createdAt)).limit(5).all();
console.log(`\n=== AGENT RUNS (${runs.length}) ===`);
for (const r of runs) {
  console.log(`  ${r.id}  month=${r.month}  mock=${r.mock}  latency=${r.totalLatencyMs}ms`);
}

if (runs.length === 0) {
  console.log("  (no runs found)");
  process.exit(0);
}

const latest = runs[0];
console.log(`\nInspecting latest: ${latest.id}`);

const msgs = db.select().from(agentMessages).orderBy(desc(agentMessages.id)).limit(30).all();
console.log(`\n=== AGENT MESSAGES (${msgs.length} total) ===`);
for (const m of msgs) {
  console.log(`  ${m.agentName?.padEnd(35)} tokens_in=${String(m.tokensIn ?? "?").padStart(6)} tokens_out=${String(m.tokensOut ?? "?").padStart(5)} cached=${m.cached} mock=${m.mockPath}`);
}

const p = JSON.parse(latest.dagPayload);

console.log("\n=== GREEN JUDGE ===");
for (const r of p.greenJudge.judged_results) {
  const icon = r.verdict === "rejected" ? "✗" : "✓";
  console.log(`  ${icon} ${r.category}/${r.sub_category}: ${r.verdict} — ${(r.issues_found ?? []).join(", ") || "none"}`);
  if (r.verdict === "rejected" && r.explanation) {
    console.log(`    reason: ${r.explanation.slice(0, 150)}`);
  }
}

console.log("\n=== COST JUDGE ===");
for (const r of p.costJudge.judged_results) {
  const icon = r.verdict === "rejected" ? "✗" : "✓";
  console.log(`  ${icon} ${r.category}/${r.sub_category}: ${r.verdict} — ${(r.issues_found ?? []).join(", ") || "none"}`);
}

console.log("\n=== CREDIT STRATEGY ===");
const cs = p.creditStrategy.summary;
console.log(`  Net financial impact:  €${cs.total_net_company_scale_financial_impact_eur}`);
console.log(`  Emissions reduced:    ${cs.total_emissions_reduced_tco2e} tCO₂e`);
console.log(`  Credit purchase cost: €${cs.total_recommended_credit_purchase_cost_eur}`);
console.log(`  Tax advisor needed:   ${cs.tax_advisor_review_required}`);

console.log("\n=== EXECUTIVE REPORT ===");
console.log(`  Title: ${p.executiveReport.report_title}`);
console.log(`  Top recs: ${p.executiveReport.top_recommendations.length}`);
for (const r of p.executiveReport.top_recommendations.slice(0, 5)) {
  console.log(`    - ${r.title}: ${r.description?.slice(0, 120)}`);
}
console.log(`  Limitations: ${p.executiveReport.limitations.length}`);
for (const l of p.executiveReport.limitations) {
  console.log(`    - ${String(l).slice(0, 120)}`);
}

console.log("\n=== RESEARCH ===");
console.log(`  Clusters researched: ${p.research.summary.clusters_researched}`);
console.log(`  Total alternatives:  ${p.research.summary.total_alternatives}`);
console.log(`  Total sources:       ${p.research.summary.total_sources}`);
console.log(`  Web searches used:   ${p.research.summary.total_searches_used}`);
console.log(`  Cache hits:          ${p.research.summary.cache_hits}`);

console.log("\n=== BASELINE ===");
console.log(`  Total spend:  €${p.baseline.baseline.total_spend_eur}`);
console.log(`  Total tCO₂e:  ${p.baseline.baseline.estimated_total_tco2e}`);
console.log(`  Confidence:   ${p.baseline.baseline.baseline_confidence}`);
console.log(`  Priority targets: ${p.baseline.priority_targets.length}`);
console.log(`  Context question: ${p.baseline.required_context_question ?? "none"}`);

console.log(`\n  Mock agent count: ${p.mock_agent_count}/7`);
console.log(`  Total latency:    ${Math.round(p.totalLatencyMs)}ms (${(p.totalLatencyMs / 1000).toFixed(1)}s)`);
