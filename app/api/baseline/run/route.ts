/**
 * T006 / spec R006 — POST /api/baseline/run.
 *
 * Standalone entry point for the Spend & Emissions Baseline agent. Not wired
 * into the 12-state close machine (that's a follow-on spec) — this lets us
 * iterate on the Baseline in isolation and lets the presentation page call
 * into a real computation path when it's time.
 */

import { NextResponse } from "next/server";
import { appendAudit } from "@/lib/audit/append";
import { run as runBaseline } from "@/lib/agents/dag/spendBaseline";
import { DEFAULT_ORG_ID, currentMonth } from "@/lib/queries";

const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/;

export const POST = async (req: Request) => {
  let body: { orgId?: string; month?: string } = {};
  try {
    body = (await req.json()) as typeof body;
  } catch {
    // Empty body is fine; use defaults.
  }

  const orgId = body.orgId ?? DEFAULT_ORG_ID;
  const month = body.month ?? currentMonth();

  if (!MONTH_RE.test(month)) {
    return NextResponse.json(
      { error: "invalid_month", details: `month must match YYYY-MM, got: ${month}` },
      { status: 400 },
    );
  }

  const t0 = performance.now();
  try {
    const output = await runBaseline({ orgId, month });
    const runMs = Math.round(performance.now() - t0);

    appendAudit({
      orgId,
      actor: "agent",
      type: "baseline.run.completed",
      payload: {
        orgId,
        month,
        runMs,
        totalSpendEur: output.baseline.total_spend_eur,
        totalTco2e: output.baseline.estimated_total_tco2e,
        priorityTargetCount: output.priority_targets.length,
        policyBreachCount: output.priority_targets.filter((t) => t.reason_for_priority === "policy_relevant").length,
      },
    });

    return NextResponse.json(output);
  } catch (e) {
    const runMs = Math.round(performance.now() - t0);
    console.error(`[/api/baseline/run] failed in ${runMs}ms:`, e);
    return NextResponse.json({ error: "baseline_failed", details: (e as Error).message }, { status: 500 });
  }
};
