/**
 * One-shot backfill: insert an `agent_runs` placeholder row for a live E2E run
 * that completed before `persistDagRun` was wired into `dag-e2e-live.ts`.
 *
 * Future live E2E runs persist themselves — see scripts/dag-e2e-live.ts.
 */
import { agentRuns, db, agentMessages } from "@/lib/db/client";
import { eq } from "drizzle-orm";

const RUN_ID = process.argv[2] ?? "run_0ad4f78c-8762-4d2e-a6bd-216b3d9f67c2";
const ORG_ID = process.argv[3] ?? "org_acme_bv";
const MONTH = process.argv[4] ?? "2026-03";

const messages = db
  .select()
  .from(agentMessages)
  .where(eq(agentMessages.agentRunId, RUN_ID))
  .all();
console.log(`agent_messages rows: ${messages.length}`);
if (messages.length === 0) {
  console.log("No agent_messages — refusing to insert empty stub.");
  process.exit(2);
}

const existing = db.select().from(agentRuns).where(eq(agentRuns.id, RUN_ID)).all()[0];
if (existing) {
  console.log(`agent_runs row already exists for ${RUN_ID}`);
  process.exit(0);
}

db.insert(agentRuns)
  .values({
    id: RUN_ID,
    orgId: ORG_ID,
    month: MONTH,
    researchRunId: null,
    dagPayload: "{}",
    totalLatencyMs: 314830,
    mock: false,
  })
  .run();
console.log(`inserted agent_runs row for ${RUN_ID}`);
