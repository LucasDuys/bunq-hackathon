/**
 * Live E2E test: runs the full close flow with REAL Sonnet calls.
 * Prints CO2 numbers, savings, and timing per agent.
 *
 *   npx tsx scripts/live-close-test.ts
 *
 * Requires ANTHROPIC_API_KEY in .env.local and ANTHROPIC_MOCK=false.
 */
import { startCloseRun } from "@/lib/agent/close";
import { DEFAULT_ORG_ID } from "@/lib/queries";
import { db, transactions, emissionEstimates, closeRuns, auditEvents } from "@/lib/db/client";
import { eq, and, gte, lt, desc } from "drizzle-orm";
import { rollup } from "@/lib/emissions/estimate";

const nowMonth = () => {
  const d = new Date();
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
};

async function main() {
  const orgId = DEFAULT_ORG_ID;
  const month = nowMonth();

  console.log("═══════════════════════════════════════════════════════");
  console.log(`  LIVE CLOSE TEST — ${month} — org: ${orgId}`);
  console.log(`  ANTHROPIC_MOCK=${process.env.ANTHROPIC_MOCK ?? "default(true)"}`);
  console.log("═══════════════════════════════════════════════════════\n");

  const t0 = performance.now();

  try {
    const result = await startCloseRun(orgId, month);
    const elapsed = ((performance.now() - t0) / 1000).toFixed(1);

    console.log("\n═══════════════════════════════════════════════════════");
    console.log("  CLOSE RUN RESULT");
    console.log("═══════════════════════════════════════════════════════");
    console.log(`  Run ID:              ${result.id}`);
    console.log(`  State:               ${result.state}`);
    console.log(`  DAG Run ID:          ${result.dagRunId ?? "none"}`);
    console.log(`  Wall time:           ${elapsed}s`);
    console.log(`  Initial CO₂e:        ${result.initialCo2eKg?.toFixed(1)} kg`);
    console.log(`  Initial confidence:  ${((result.initialConfidence ?? 0) * 100).toFixed(0)}%`);
    console.log(`  Questions generated: ${result.questionCount}`);

    if ("finalCo2eKg" in result) {
      const r = result as any;
      console.log(`  Final CO₂e:          ${r.finalCo2eKg?.toFixed(1)} kg`);
      console.log(`  Final confidence:    ${((r.finalConfidence ?? 0) * 100).toFixed(0)}%`);
      console.log(`  Reserve EUR:         €${r.reserveEur?.toFixed(2)}`);
      console.log(`  Requires approval:   ${r.requiresApproval}`);
      if (r.actions) {
        console.log(`  Actions:             ${r.actions.length}`);
        for (const a of r.actions) {
          if (a.kind === "reserve_transfer") {
            console.log(`    → Reserve transfer: €${a.amountEur.toFixed(2)}`);
          } else if (a.kind === "credit_purchase") {
            console.log(`    → Credit purchase: ${a.tonnes.toFixed(2)}t @ €${a.eur.toFixed(2)} (${a.projectId})`);
          }
        }
      }
    }

    // Pull per-category breakdown
    console.log("\n═══════════════════════════════════════════════════════");
    console.log("  PER-CATEGORY CO₂e BREAKDOWN");
    console.log("═══════════════════════════════════════════════════════");
    const [y, m] = month.split("-").map(Number);
    const start = Math.floor(Date.UTC(y, m - 1, 1) / 1000);
    const end = Math.floor(Date.UTC(y, m, 1) / 1000);
    const txs = db.select().from(transactions)
      .where(and(eq(transactions.orgId, orgId), gte(transactions.timestamp, start), lt(transactions.timestamp, end)))
      .all();
    const estimates = db.select().from(emissionEstimates)
      .where(eq(emissionEstimates.closeRunId, result.id))
      .all();

    const byCategory = new Map<string, { spend: number; co2e: number; count: number }>();
    for (const tx of txs) {
      const est = estimates.find(e => e.txId === tx.id);
      const cat = tx.category ?? "other";
      const entry = byCategory.get(cat) ?? { spend: 0, co2e: 0, count: 0 };
      entry.spend += tx.amountCents / 100;
      entry.co2e += est?.co2eKgPoint ?? 0;
      entry.count++;
      byCategory.set(cat, entry);
    }

    const sorted = Array.from(byCategory.entries()).sort((a, b) => b[1].co2e - a[1].co2e);
    console.log(`  ${"Category".padEnd(25)} ${"Spend".padStart(10)} ${"CO₂e kg".padStart(10)} ${"Count".padStart(6)}`);
    console.log(`  ${"─".repeat(25)} ${"─".repeat(10)} ${"─".repeat(10)} ${"─".repeat(6)}`);
    let totalSpend = 0, totalCo2e = 0;
    for (const [cat, data] of sorted) {
      console.log(`  ${cat.padEnd(25)} ${("€" + data.spend.toFixed(0)).padStart(10)} ${data.co2e.toFixed(1).padStart(10)} ${String(data.count).padStart(6)}`);
      totalSpend += data.spend;
      totalCo2e += data.co2e;
    }
    console.log(`  ${"─".repeat(25)} ${"─".repeat(10)} ${"─".repeat(10)} ${"─".repeat(6)}`);
    console.log(`  ${"TOTAL".padEnd(25)} ${("€" + totalSpend.toFixed(0)).padStart(10)} ${totalCo2e.toFixed(1).padStart(10)} ${String(txs.length).padStart(6)}`);

    // Annualized projections
    console.log("\n═══════════════════════════════════════════════════════");
    console.log("  ANNUALIZED PROJECTIONS");
    console.log("═══════════════════════════════════════════════════════");
    const annualCo2e = totalCo2e * 12;
    console.log(`  Monthly CO₂e:        ${totalCo2e.toFixed(1)} kg (${(totalCo2e / 1000).toFixed(2)} tCO₂e)`);
    console.log(`  Annual CO₂e:         ${annualCo2e.toFixed(0)} kg (${(annualCo2e / 1000).toFixed(2)} tCO₂e)`);
    console.log(`  Monthly spend:       €${totalSpend.toFixed(0)}`);
    console.log(`  CO₂e intensity:      ${(totalCo2e / totalSpend * 1000).toFixed(1)} gCO₂e/€`);

    // Check DAG results if available
    if (result.dagRunId) {
      const { agentRuns } = await import("@/lib/db/client");
      const dagRun = db.select().from(agentRuns).where(eq(agentRuns.id, result.dagRunId)).all()[0];
      if (dagRun?.dagPayload) {
        try {
          const payload = JSON.parse(dagRun.dagPayload);
          console.log("\n═══════════════════════════════════════════════════════");
          console.log("  DAG AGENT RESULTS");
          console.log("═══════════════════════════════════════════════════════");
          console.log(`  Green alternatives:  ${payload.greenAlt?.results?.length ?? 0} proposals`);
          console.log(`  Cost savings:        ${payload.costSavings?.results?.length ?? 0} proposals`);
          console.log(`  Green judge approved: ${payload.greenJudge?.judged_results?.filter((r: any) => r.verdict === "approved" || r.verdict === "approved_with_caveats").length ?? 0}`);
          console.log(`  Cost judge approved:  ${payload.costJudge?.judged_results?.filter((r: any) => r.verdict === "approved" || r.verdict === "approved_with_caveats").length ?? 0}`);
          if (payload.creditStrategy?.summary) {
            const cs = payload.creditStrategy.summary;
            console.log(`  Net financial impact: €${cs.total_net_company_scale_financial_impact_eur?.toFixed(0) ?? "?"}`);
            console.log(`  Emissions reduced:   ${cs.total_emissions_reduced_tco2e?.toFixed(2) ?? "?"} tCO₂e`);
            console.log(`  Credit purchase cost: €${cs.total_recommended_credit_purchase_cost_eur?.toFixed(0) ?? "?"}`);
          }
          if (payload.executiveReport?.report_title) {
            console.log(`  Executive report:    "${payload.executiveReport.report_title}"`);
          }
          console.log(`  Mock agent count:    ${payload.mock_agent_count ?? "?"}/7`);
          console.log(`  DAG latency:         ${Math.round(payload.totalLatencyMs ?? 0)}ms`);
        } catch {}
      }
    }

    // Audit chain count
    const auditCount = db.select().from(auditEvents).where(eq(auditEvents.orgId, orgId)).all().length;
    console.log(`\n  Audit chain events:  ${auditCount}`);
    console.log("\n  ✓ CLOSE RUN COMPLETE");

  } catch (err) {
    const elapsed = ((performance.now() - t0) / 1000).toFixed(1);
    console.error(`\n  ✗ CLOSE RUN FAILED after ${elapsed}s`);
    console.error(`  Error: ${err}`);
    if (err instanceof Error) console.error(err.stack);
    process.exit(1);
  }
}

main();
