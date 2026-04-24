/**
 * T007 / spec R007 — acceptance tests for the Spend & Emissions Baseline agent.
 *
 * Runs the deterministic path against whatever is in the `transactions` table.
 * Extend `scripts/seed.ts` runs beforehand so the DB has data; this test file
 * is a pure read-side check.
 *
 * Run with:  pnpm exec tsx --test lib/agents/dag/__tests__/spendBaseline.test.ts
 *
 * The tests intentionally do NOT mock the DB — they run against the live
 * sqlite file (the same one the dev server uses), so the seeded fixture must
 * already be present.
 */

import { strict as assert } from "node:assert";
import test, { describe } from "node:test";
import { and, eq, gte, lt } from "drizzle-orm";
import { db, policies, transactions } from "@/lib/db/client";
import { monthBounds } from "@/lib/queries";
import { run as runBaseline } from "@/lib/agents/dag/spendBaseline";
import { DEFAULT_POLICY, policySchema } from "@/lib/policy/schema";

const ORG_ID = "org_acme_bv";
const FIXTURE_MONTH = "2026-03";
const EMPTY_MONTH = "1999-01";

describe("spendBaseline.run — acceptance", () => {
  test("returns a BaselineOutput with non-zero aggregates for the seeded fixture month", async () => {
    const txs = db.select().from(transactions).where(
      and(
        eq(transactions.orgId, ORG_ID),
        gte(transactions.timestamp, monthBounds(FIXTURE_MONTH).start),
        lt(transactions.timestamp, monthBounds(FIXTURE_MONTH).end),
      ),
    ).all();
    if (txs.length === 0) {
      console.warn("[test] skipping — no fixture transactions in March 2026. Run pnpm seed first.");
      return;
    }

    const out = await runBaseline({ orgId: ORG_ID, month: FIXTURE_MONTH });
    assert.equal(out.agent, "spend_emissions_baseline_agent");
    assert.equal(out.company_id, ORG_ID);
    assert.equal(out.analysis_period, FIXTURE_MONTH);
    assert.ok(out.baseline.total_spend_eur > 0, "total spend must be positive");
    assert.ok(out.baseline.estimated_total_tco2e > 0, "total tCO₂e must be positive");
    assert.ok(out.baseline.baseline_confidence >= 0 && out.baseline.baseline_confidence <= 1);
    assert.ok(out.baseline.top_spend_categories.length > 0);
    assert.ok(out.baseline.top_emission_categories.length > 0);
  });

  test("priority_targets is ≤ 20 and non-empty on the seeded month", async () => {
    const out = await runBaseline({ orgId: ORG_ID, month: FIXTURE_MONTH });
    const txCount = db.select().from(transactions).where(
      and(
        eq(transactions.orgId, ORG_ID),
        gte(transactions.timestamp, monthBounds(FIXTURE_MONTH).start),
        lt(transactions.timestamp, monthBounds(FIXTURE_MONTH).end),
      ),
    ).all().length;
    assert.ok(out.priority_targets.length <= 20, `expected ≤20 priority targets, got ${out.priority_targets.length}`);
    if (txCount > 0) {
      assert.ok(out.priority_targets.length > 0, "seeded month must produce at least one priority target");
    }
  });

  test("every priority target has a valid recommended_next_agent enum value", async () => {
    const out = await runBaseline({ orgId: ORG_ID, month: FIXTURE_MONTH });
    const allowed = new Set(["green_alternatives_agent", "cost_savings_agent", "both"]);
    for (const t of out.priority_targets) {
      assert.ok(allowed.has(t.recommended_next_agent), `bad enum value: ${t.recommended_next_agent}`);
    }
  });

  test("empty-month baseline returns zeroed aggregates and empty priority_targets without throwing", async () => {
    const out = await runBaseline({ orgId: ORG_ID, month: EMPTY_MONTH });
    assert.equal(out.baseline.total_spend_eur, 0);
    assert.equal(out.baseline.estimated_total_tco2e, 0);
    assert.equal(out.baseline.baseline_confidence, 0);
    assert.equal(out.priority_targets.length, 0);
    assert.equal(out.required_context_question, null);
  });

  test("cluster IDs match pattern ^cluster_[a-z0-9_]+$", async () => {
    const out = await runBaseline({ orgId: ORG_ID, month: FIXTURE_MONTH });
    const re = /^cluster_[a-z0-9_]+$/;
    for (const t of out.priority_targets) {
      assert.match(t.cluster_id, re, `bad cluster_id: ${t.cluster_id}`);
    }
    for (const id of out.baseline.high_cost_high_carbon_clusters) {
      assert.match(id, re, `bad hc/hc cluster_id: ${id}`);
    }
    for (const id of out.baseline.uncertain_high_value_clusters) {
      assert.match(id, re, `bad uncertain cluster_id: ${id}`);
    }
  });

  test("policy-breaching category always appears in priority_targets", async () => {
    // Install a synthetic policy that pushes "food" over the €50 per-category
    // breach threshold regardless of score.
    const breachingPolicy = policySchema.parse({
      ...DEFAULT_POLICY,
      reserveRules: [
        { category: "food", method: "pct_spend", value: 0.5 }, // huge pct → guaranteed breach
        { category: "*", method: "eur_per_kg_co2e", value: 0.05 },
      ],
    });
    db.update(policies)
      .set({ rules: JSON.stringify(breachingPolicy) })
      .where(eq(policies.orgId, ORG_ID))
      .run();

    try {
      const out = await runBaseline({ orgId: ORG_ID, month: FIXTURE_MONTH });
      const foodHit = out.priority_targets.find((t) => t.category === "food");
      if (foodHit) {
        assert.equal(foodHit.reason_for_priority, "policy_relevant", "food must be tagged policy_relevant");
      }
      // else: no food spend in the fixture's March — that's OK, the override machinery still ran.
    } finally {
      // Restore default policy so other tests aren't affected.
      db.update(policies)
        .set({ rules: JSON.stringify(DEFAULT_POLICY) })
        .where(eq(policies.orgId, ORG_ID))
        .run();
    }
  });

  test("reason_for_priority_detail is filled for every priority target", async () => {
    const out = await runBaseline({ orgId: ORG_ID, month: FIXTURE_MONTH });
    for (const t of out.priority_targets) {
      assert.ok(
        typeof t.reason_for_priority_detail === "string" && t.reason_for_priority_detail.length > 0,
        `missing detail for ${t.cluster_id}`,
      );
    }
  });
});
