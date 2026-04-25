import { randomUUID } from "node:crypto";
import { and, desc, eq, gte, lt } from "drizzle-orm";
import {
  bunqSessions,
  closeRuns,
  db,
  emissionEstimates,
  orgs,
  policies,
  refinementQa,
  transactions,
} from "@/lib/db/client";
import { appendAudit } from "@/lib/audit/append";
import { loadContext } from "@/lib/bunq/context";
import { intraUserTransfer } from "@/lib/bunq/payments";
import { reclassifyMerchant } from "@/lib/classify/merchant";
import { normalizeMerchant } from "@/lib/classify/rules";
import { CREDIT_PROJECTS, totalBudgetMix } from "@/lib/credits/projects";
import { estimateEmission, rollup } from "@/lib/emissions/estimate";
import { factorFor } from "@/lib/factors";
import { evaluatePolicy, type CategoryAggregate } from "@/lib/policy/evaluate";
import { DEFAULT_POLICY, policySchema, type Policy } from "@/lib/policy/schema";
import { env } from "@/lib/env";
import { runDag } from "@/lib/agents/dag";
import type { AgentContext } from "@/lib/agents/dag/types";
import { persistDagRun } from "@/lib/impacts/store";
import { computeClusters, type Cluster } from "./clusters";
import { getTaxSavingsForMonth } from "@/lib/queries";

export type { Cluster };

export type CloseState =
  | "AGGREGATE"
  | "ESTIMATE_INITIAL"
  | "CLUSTER_UNCERTAINTY"
  | "DAG_RUNNING"
  | "AWAITING_ANSWERS"
  | "APPLY_ANSWERS"
  | "ESTIMATE_FINAL"
  | "APPLY_POLICY"
  | "PROPOSED"
  | "AWAITING_APPROVAL"
  | "EXECUTING"
  | "COMPLETED"
  | "FAILED";

export type ProposedAction =
  | { kind: "reserve_transfer"; amountEur: number; description: string }
  | { kind: "tax_reserve_transfer"; amountEur: number; description: string; schemesCovered: string[] }
  | { kind: "credit_purchase"; projectId: string; tonnes: number; eur: number };

const monthBounds = (month: string) => {
  const [y, m] = month.split("-").map(Number);
  const start = Math.floor(Date.UTC(y, m - 1, 1) / 1000);
  const end = Math.floor(Date.UTC(y, m, 1) / 1000);
  return { start, end };
};

const parsePolicy = (raw: string): Policy => {
  try {
    return policySchema.parse(JSON.parse(raw));
  } catch {
    return DEFAULT_POLICY;
  }
};

/**
 * Narration events power the live close transcript at /close/[id].
 * Each call appends to the same audit chain (so the SHA-256 ledger covers the
 * agent's reasoning, not just its side effects). The UI keys off `payload.role`
 * to render thinking / tool_call / tool_result / summary differently.
 */
type NarratePhase =
  | "INGEST"
  | "CLASSIFY"
  | "ESTIMATE"
  | "CLUSTER"
  | "REFINE"
  | "POLICY"
  | "PROPOSE"
  | "EXECUTE"
  | "COMPLETE";

type NarrateRole = "thinking" | "tool_call" | "tool_result" | "summary" | "error";

const narrate = (
  orgId: string,
  closeRunId: string,
  phase: NarratePhase,
  role: NarrateRole,
  title: string,
  detail?: { body?: string; meta?: Record<string, unknown>; tool?: string },
) => {
  appendAudit({
    orgId,
    actor: "agent",
    type: "agent.narrate",
    closeRunId,
    payload: {
      phase,
      role,
      title,
      body: detail?.body,
      meta: detail?.meta,
      tool: detail?.tool,
    },
  });
};

const getActivePolicy = (orgId: string): Policy => {
  const rows = db.select().from(policies).where(and(eq(policies.orgId, orgId), eq(policies.active, true))).all();
  if (rows.length === 0) return DEFAULT_POLICY;
  return parsePolicy(rows[0].rules);
};

/**
 * Inserts the close_runs row + "close.start" audit event + first narrate, and
 * returns the new run id. Split out from startCloseRun so the API route can
 * hand the id back to the browser before the long DAG work begins (the close
 * page then polls /events and animates as state transitions stream in).
 */
const initializeCloseRun = (orgId: string, month: string): string => {
  const id = `run_${randomUUID()}`;
  db.insert(closeRuns).values({ id, orgId, month, status: "active", state: "AGGREGATE", startedAt: Math.floor(Date.now() / 1000) }).run();
  appendAudit({ orgId, actor: "agent", type: "close.start", payload: { closeRunId: id, month }, closeRunId: id });
  narrate(orgId, id, "INGEST", "thinking", `Starting carbon close for ${month}`, {
    body: "I'll pull every booked transaction in the period, classify what's new, estimate emissions with confidence, then ask about anything I'm not sure on.",
  });
  return id;
};

/**
 * Start a close run. Runs AGGREGATE → ESTIMATE_INITIAL → CLUSTER → QUESTIONS in one go,
 * then halts at AWAITING_ANSWERS until POST /close/[id]/answer resolves them.
 */
export const startCloseRun = async (orgId: string, month: string) => {
  const id = initializeCloseRun(orgId, month);
  return await executeCloseRun(id, orgId, month);
};

/**
 * Same contract as startCloseRun, but fires the heavy DAG work in the
 * background and returns the new run id immediately. Used by
 * POST /api/close/run so the "Run new close" button can redirect to
 * /close/[id] while the pipeline is still running — otherwise the whole close
 * finishes before the user lands on the page and every phase animation is
 * already completed on first paint.
 */
export const startCloseRunDetached = (orgId: string, month: string): { id: string } => {
  const id = initializeCloseRun(orgId, month);
  void executeCloseRun(id, orgId, month).catch((err) => {
    const row = db.select().from(closeRuns).where(eq(closeRuns.id, id)).all()[0];
    if (row && row.status === "active") {
      db.update(closeRuns)
        .set({ state: "FAILED", status: "failed", completedAt: Math.floor(Date.now() / 1000) })
        .where(eq(closeRuns.id, id))
        .run();
    }
    appendAudit({
      orgId,
      actor: "agent",
      type: "close.failed",
      payload: { error: String(err) },
      closeRunId: id,
    });
  });
  return { id };
};

const executeCloseRun = async (id: string, orgId: string, month: string) => {
  const { start, end } = monthBounds(month);

  // 1. AGGREGATE
  narrate(orgId, id, "INGEST", "tool_call", "db.transactions.range", {
    tool: "sqlite",
    meta: { orgId, month, startUnix: start, endUnix: end },
  });
  const txs = db.select().from(transactions).where(and(eq(transactions.orgId, orgId), gte(transactions.timestamp, start), lt(transactions.timestamp, end))).all();
  if (txs.length === 0) {
    db.update(closeRuns).set({ state: "FAILED", status: "failed", completedAt: Math.floor(Date.now() / 1000) }).where(eq(closeRuns.id, id)).run();
    narrate(orgId, id, "INGEST", "error", "No transactions for this month", {
      body: `Aborting close — the bunq journal returned 0 rows in ${month}. Run a webhook re-sync or pick another month.`,
    });
    appendAudit({ orgId, actor: "agent", type: "close.no_transactions", payload: { month }, closeRunId: id });
    throw new Error(`No transactions for ${month}`);
  }

  const totalSpend = txs.reduce((s, t) => s + t.amountCents / 100, 0);
  const classified = txs.filter((t) => t.category && t.category !== "other").length;
  narrate(orgId, id, "INGEST", "tool_result", `${txs.length} transactions · €${totalSpend.toFixed(0)} total spend`, {
    meta: {
      txCount: txs.length,
      totalSpendEur: totalSpend,
      preClassified: classified,
      pendingClassify: txs.length - classified,
    },
  });

  // 2. ESTIMATE_INITIAL
  narrate(orgId, id, "ESTIMATE", "thinking", "Estimating per-transaction CO₂e", {
    body: "Pairing each merchant category with its DEFRA / ADEME / Exiobase emission factor (tier + uncertainty embedded). Confidence rolls up via quadrature, spend-weighted.",
  });
  db.update(closeRuns).set({ state: "ESTIMATE_INITIAL" }).where(eq(closeRuns.id, id)).run();
  const estimates = txs.map((t) => {
    const est = estimateEmission({
      category: t.category ?? "other",
      subCategory: t.subCategory,
      amountEur: t.amountCents / 100,
      classifierConfidence: t.categoryConfidence ?? 0.5,
    });
    db.insert(emissionEstimates).values({
      txId: t.id,
      factorId: est.factorId,
      co2eKgLow: est.co2eKgLow,
      co2eKgPoint: est.co2eKgPoint,
      co2eKgHigh: est.co2eKgHigh,
      confidence: est.confidence,
      method: est.method,
      closeRunId: id,
    }).run();
    return { tx: t, est };
  });
  const initial = rollup(estimates.map((e) => e.est));
  db.update(closeRuns).set({
    initialCo2eKg: initial.co2eKgPoint,
    initialConfidence: initial.confidence,
  }).where(eq(closeRuns.id, id)).run();
  narrate(orgId, id, "ESTIMATE", "summary", `First estimate · ${initial.co2eKgPoint.toFixed(0)} kgCO₂e`, {
    body: `Confidence ${(initial.confidence * 100).toFixed(0)}%. Range ± ${(initial.co2eKgPoint * (1 - initial.confidence)).toFixed(1)} kg.`,
    meta: {
      initialCo2eKg: initial.co2eKgPoint,
      initialConfidence: initial.confidence,
      sampleEstimates: estimates.slice(0, 3).map(({ tx, est }) => ({
        merchant: tx.merchantRaw,
        category: tx.category,
        co2eKg: est.co2eKgPoint,
        method: est.method,
      })),
    },
  });

  // 3. CLUSTER_UNCERTAINTY: group tx by merchantNorm, pick top-N by (spend × (1-confidence)).
  narrate(orgId, id, "CLUSTER", "thinking", "Looking for the merchants that move the total most", {
    body: "Grouping by normalized merchant, scoring impact = spend × (1 - confidence). Anything above €300 with confidence below 0.85 is a refinement candidate.",
  });
  db.update(closeRuns).set({ state: "CLUSTER_UNCERTAINTY" }).where(eq(closeRuns.id, id)).run();
  const clusters = computeClusters(estimates);
  const topClusters = clusters.filter((c) => c.flagged);
  narrate(orgId, id, "CLUSTER", "tool_result", `${topClusters.length} cluster${topClusters.length === 1 ? "" : "s"} flagged for refinement`, {
    meta: {
      flagged: topClusters.map((c) => ({
        id: c.id,
        merchant: c.merchantLabel,
        spendEur: c.totalSpendEur,
        rangeKg: c.rangeHalfKg,
        currentCategory: c.likelyCategory,
        classifierConfidence: c.avgClassifierConfidence,
      })),
      totalClusters: clusters.length,
    },
  });

  // 4. DAG_RUNNING — R008.AC1 / T012.
  // Replaces the old QUESTIONS_GENERATED state. The 8-agent DAG produces the
  // single `required_context_question` (or null) and is the only LLM touchpoint
  // the close machine has. The DAG's `runId` is persisted on `close_runs.dagRunId`
  // so reviewers can pull the full agent trace from `agent_messages`.
  narrate(orgId, id, "REFINE", "thinking", "Running the 8-agent DAG", {
    body: "Baseline → research (web search) → green + cost proposals → judges → credit strategy → executive report. The DAG is the single LLM touchpoint for the close machine; its runId lands on close_runs.dag_run_id for full agent-trace replay.",
  });
  db.update(closeRuns).set({ state: "DAG_RUNNING" }).where(eq(closeRuns.id, id)).run();
  const dagCtx: AgentContext = {
    orgId,
    analysisPeriod: month,
    dryRun: env.dryRun,
    mock: env.anthropicMock || !env.anthropicKey,
    auditLog: async (event) => {
      appendAudit({ orgId, actor: "agent", type: event.type, payload: event.payload, closeRunId: id });
    },
  };
  const dag = await runDag({ orgId, month }, dagCtx);
  // Persist the full DagRunResult into `agent_runs` (and flatten approved
  // alternatives into `impact_recommendations`) so the close page's
  // `CloseDagPanel`, the `/agents/[runId]` inspector, and the `/impacts`
  // workspace can all read the run by `runId`. Mirrors what
  // `POST /api/impacts/research` does on its own DAG path; without this the
  // close-machine-driven DAG runs leave no persisted payload.
  try {
    persistDagRun({ orgId, month, dag, mock: dagCtx.mock });
  } catch (err) {
    appendAudit({
      orgId,
      actor: "agent",
      type: "close.dag_persist_failed",
      payload: { error: String(err), dagRunId: dag.runId },
      closeRunId: id,
    });
  }
  db.update(closeRuns).set({ dagRunId: dag.runId }).where(eq(closeRuns.id, id)).run();
  appendAudit({
    orgId,
    actor: "agent",
    type: "close.dag_run",
    payload: {
      dagRunId: dag.runId,
      requiredContextQuestion: dag.baseline.required_context_question,
      mockAgentCount: dag.mock_agent_count,
      totalLatencyMs: Math.round(dag.totalLatencyMs),
    },
    closeRunId: id,
  });
  narrate(orgId, id, "REFINE", "summary", `DAG complete · runId ${dag.runId.slice(0, 12)}…`, {
    body: `${Math.round(dag.totalLatencyMs / 1000)}s wall, ${dag.mock_agent_count}/7 mock-fallback agents.`,
    meta: {
      dagRunId: dag.runId,
      mockAgentCount: dag.mock_agent_count,
      requiredContextQuestion: dag.baseline.required_context_question,
    },
  });

  // R008.AC3 — only park in AWAITING_ANSWERS if the DAG returned a context
  // question. Otherwise advance the close machine straight to the policy/
  // proposal chain via finalizeEstimates (idempotent when there are no
  // refinement answers to apply).
  const required = dag.baseline.required_context_question;
  if (required != null) {
    // Persist the single DAG-surfaced question. We can't re-classify a tx from
    // it (no options, no category mapping), so we attach a one-shot
    // acknowledge option and an empty affected-tx list. answerQuestion()
    // accepts the acknowledge label and short-circuits to finalizeEstimates,
    // which is the same control flow the original questions.ts path used.
    const cluster = topClusters[0];
    db.insert(refinementQa).values({
      closeRunId: id,
      clusterId: cluster?.id ?? "dag",
      question: required,
      options: JSON.stringify([
        { label: "acknowledge", category: cluster?.likelyCategory ?? "other", subCategory: cluster?.likelySubCategory ?? null },
      ]),
      affectedTxIds: JSON.stringify([]),
    }).run();
    db.update(closeRuns).set({ state: "AWAITING_ANSWERS" }).where(eq(closeRuns.id, id)).run();
    return { id, initialCo2eKg: initial.co2eKgPoint, initialConfidence: initial.confidence, questionCount: 1, dagRunId: dag.runId };
  }

  // No question — close machine flows straight through finalizeEstimates →
  // APPLY_POLICY → PROPOSED (or AWAITING_APPROVAL).
  await finalizeEstimates(id);
  return { id, initialCo2eKg: initial.co2eKgPoint, initialConfidence: initial.confidence, questionCount: 0, dagRunId: dag.runId };
};

export const answerQuestion = async (closeRunId: string, qaId: number, answerLabel: string) => {
  const run = db.select().from(closeRuns).where(eq(closeRuns.id, closeRunId)).all()[0];
  if (!run) throw new Error("close run not found");
  const qa = db.select().from(refinementQa).where(eq(refinementQa.id, qaId)).all()[0];
  if (!qa) throw new Error("question not found");

  const options = JSON.parse(qa.options) as Array<{ label: string; category: string; subCategory: string | null }>;
  const chosen = options.find((o) => o.label === answerLabel);
  if (!chosen) throw new Error(`answer "${answerLabel}" not among options`);

  db.update(refinementQa).set({ answer: answerLabel, answeredAt: Math.floor(Date.now() / 1000) }).where(eq(refinementQa.id, qaId)).run();
  appendAudit({ orgId: run.orgId, actor: "user", type: "refinement.answered", payload: { qaId, answerLabel, category: chosen.category, subCategory: chosen.subCategory }, closeRunId });
  narrate(run.orgId, closeRunId, "REFINE", "summary", `Got it — "${answerLabel}"`, {
    body: `Reclassifying ${qa.clusterId.replace(/^cl_/, "")} as ${chosen.category}${chosen.subCategory ? ` · ${chosen.subCategory}` : ""}, then updating the merchant cache so future months don't ask again.`,
    meta: { qaId, answerLabel, category: chosen.category, subCategory: chosen.subCategory },
  });

  // Reclassify the affected txs
  const affectedIds = JSON.parse(qa.affectedTxIds) as string[];
  const affectedTxs = affectedIds.length > 0 ? db.select().from(transactions).where(eq(transactions.id, affectedIds[0])).all().concat(
    ...affectedIds.slice(1).map((tid) => db.select().from(transactions).where(eq(transactions.id, tid)).all())
  ) : [];
  for (const tx of affectedTxs) {
    db.update(transactions).set({
      category: chosen.category,
      subCategory: chosen.subCategory,
      categoryConfidence: 0.95,
      classifierSource: "refinement",
    }).where(eq(transactions.id, tx.id)).run();
    await reclassifyMerchant(tx.merchantNorm, chosen.category, chosen.subCategory, 0.95);
  }

  // If all questions answered, move to FINAL
  const remaining = db.select().from(refinementQa).where(eq(refinementQa.closeRunId, closeRunId)).all().filter((r) => !r.answer);
  if (remaining.length > 0) {
    return { state: "AWAITING_ANSWERS", remaining: remaining.length };
  }
  return await finalizeEstimates(closeRunId);
};

const finalizeEstimates = async (closeRunId: string) => {
  const run = db.select().from(closeRuns).where(eq(closeRuns.id, closeRunId)).all()[0];
  const { start, end } = monthBounds(run.month);

  db.update(closeRuns).set({ state: "APPLY_ANSWERS" }).where(eq(closeRuns.id, closeRunId)).run();
  narrate(run.orgId, closeRunId, "ESTIMATE", "thinking", "Re-rolling emissions with the refined categories", {
    body: "Discarding the initial estimates for this run and re-estimating every transaction; refined merchants now use higher-tier factors.",
  });

  // Re-estimate every tx with refined categories
  const txs = db.select().from(transactions).where(and(eq(transactions.orgId, run.orgId), gte(transactions.timestamp, start), lt(transactions.timestamp, end))).all();
  // Clear prior estimates for this run
  db.delete(emissionEstimates).where(eq(emissionEstimates.closeRunId, closeRunId)).run();
  const newEstimates = txs.map((t) => {
    const est = estimateEmission({
      category: t.category ?? "other",
      subCategory: t.subCategory,
      amountEur: t.amountCents / 100,
      classifierConfidence: t.categoryConfidence ?? 0.5,
      method: t.classifierSource === "refinement" ? "refined" : "spend_based",
    });
    db.insert(emissionEstimates).values({
      txId: t.id,
      factorId: est.factorId,
      co2eKgLow: est.co2eKgLow,
      co2eKgPoint: est.co2eKgPoint,
      co2eKgHigh: est.co2eKgHigh,
      confidence: est.confidence,
      method: est.method,
      closeRunId,
    }).run();
    return { tx: t, est };
  });

  db.update(closeRuns).set({ state: "ESTIMATE_FINAL" }).where(eq(closeRuns.id, closeRunId)).run();
  const finalRollup = rollup(newEstimates.map((e) => e.est));
  narrate(run.orgId, closeRunId, "ESTIMATE", "summary", `Final estimate · ${finalRollup.co2eKgPoint.toFixed(0)} kgCO₂e`, {
    body: `Confidence ${(finalRollup.confidence * 100).toFixed(0)}%. Range ± ${(finalRollup.co2eKgPoint * (1 - finalRollup.confidence)).toFixed(1)} kg.`,
    meta: {
      finalCo2eKg: finalRollup.co2eKgPoint,
      finalConfidence: finalRollup.confidence,
      deltaVsInitial: run.initialCo2eKg != null ? finalRollup.co2eKgPoint - run.initialCo2eKg : null,
    },
  });

  // 5. APPLY_POLICY
  narrate(run.orgId, closeRunId, "POLICY", "thinking", "Applying your reserve policy", {
    body: "Pricing this month's emissions against your policy's per-category €/kgCO₂e schedule, then summing into a reserve transfer.",
  });
  db.update(closeRuns).set({ state: "APPLY_POLICY" }).where(eq(closeRuns.id, closeRunId)).run();
  const policy = getActivePolicy(run.orgId);
  const byCategory = new Map<string, CategoryAggregate>();
  for (const { tx, est } of newEstimates) {
    const cat = tx.category ?? "other";
    const a = byCategory.get(cat) ?? { category: cat, spendEur: 0, co2eKg: 0 };
    a.spendEur += tx.amountCents / 100;
    a.co2eKg += est.co2eKgPoint;
    byCategory.set(cat, a);
  }
  const outcome = evaluatePolicy(policy, Array.from(byCategory.values()));
  narrate(run.orgId, closeRunId, "POLICY", "tool_result", `Reserve due · €${outcome.reserveTotalEur.toFixed(2)}`, {
    body: outcome.requiresApproval
      ? "Above your auto-approval threshold — this one needs you to sign off."
      : "Under your auto-approval threshold — I'll execute the transfer once the proposal is logged.",
    meta: {
      reserveTotalEur: outcome.reserveTotalEur,
      requiresApproval: outcome.requiresApproval,
      perCategory: Array.from(byCategory.values()).map((a) => ({ category: a.category, spendEur: a.spendEur, co2eKg: a.co2eKg })),
    },
  });

  // 6. PROPOSE_ACTIONS
  narrate(run.orgId, closeRunId, "PROPOSE", "thinking", "Picking an EU-registered credit mix", {
    body: "Diversifying across nature-based and engineered removals to spread registry risk; only EU-registered projects from the static catalogue.",
  });
  db.update(closeRuns).set({ state: "PROPOSED" }).where(eq(closeRuns.id, closeRunId)).run();
  const creditMix = totalBudgetMix(finalRollup.co2eKgPoint / 1000);

  // Tax savings capture — compute monthly EUR figure from scheme-specific rollups
  // (MIA / VAMIL / EIA / EU ETS pass-through / green-financing rate advantage).
  // Earmark the amount into a dedicated Tax Reserve sub-account for year-end
  // reconciliation against actual RVO-approved deductions. "Potential" never
  // "realized" — labels enforced here and in every downstream surface.
  const taxSavings = getTaxSavingsForMonth(run.orgId, run.month);
  const taxReserveAmountEur = Math.round(taxSavings.totalPotentialSavingsEur * 100) / 100;
  const taxSchemesCovered = taxSavings.byScheme
    .filter((s) => s.totalEur > 0)
    .map((s) => s.schemeId);

  const actions: ProposedAction[] = [
    { kind: "reserve_transfer", amountEur: outcome.reserveTotalEur, description: `Carbo ${run.month} close` },
    ...(taxReserveAmountEur > 0
      ? [{
          kind: "tax_reserve_transfer" as const,
          amountEur: taxReserveAmountEur,
          description: `Potential tax savings capture · ${run.month} · year-end reconciliation`,
          schemesCovered: taxSchemesCovered,
        }]
      : []),
    ...creditMix.map((m) => ({ kind: "credit_purchase" as const, projectId: m.project.id, tonnes: m.tonnes, eur: m.eur })),
  ];

  const nextState: CloseState = outcome.requiresApproval ? "AWAITING_APPROVAL" : "PROPOSED";
  db.update(closeRuns).set({
    state: nextState,
    finalCo2eKg: finalRollup.co2eKgPoint,
    finalConfidence: finalRollup.confidence,
    reserveEur: outcome.reserveTotalEur,
    creditRecommendation: JSON.stringify(creditMix),
    proposedActions: JSON.stringify(actions),
  }).where(eq(closeRuns.id, closeRunId)).run();

  appendAudit({ orgId: run.orgId, actor: "agent", type: "close.proposed", payload: { actions, outcome, finalCo2eKg: finalRollup.co2eKgPoint, finalConfidence: finalRollup.confidence }, closeRunId });
  narrate(run.orgId, closeRunId, "PROPOSE", "summary", `Proposal ready · ${actions.length} action${actions.length === 1 ? "" : "s"}`, {
    body: outcome.requiresApproval ? "Awaiting your approval to execute." : "Auto-executing now.",
    meta: {
      reserveEur: outcome.reserveTotalEur,
      tonnesCovered: creditMix.reduce((s, m) => s + m.tonnes, 0),
      creditProjects: creditMix.map((m) => ({ id: m.project.id, name: m.project.name, tonnes: m.tonnes, eur: m.eur })),
    },
  });

  // Per spec (CONCEPT.md "Agentic action"): low-risk reserves under the policy
  // threshold auto-execute; only over-threshold runs wait for human approval.
  if (!outcome.requiresApproval) {
    const exec = await approveAndExecute(closeRunId, "system");
    return {
      state: exec.state,
      finalCo2eKg: finalRollup.co2eKgPoint,
      finalConfidence: finalRollup.confidence,
      reserveEur: outcome.reserveTotalEur,
      actions,
      requiresApproval: false,
      autoExecuted: true,
      executed: exec.executed,
    };
  }

  return { state: nextState, finalCo2eKg: finalRollup.co2eKgPoint, finalConfidence: finalRollup.confidence, reserveEur: outcome.reserveTotalEur, actions, requiresApproval: outcome.requiresApproval };
};

export const approveAndExecute = async (closeRunId: string, approver: "user" | "system" = "user") => {
  const run = db.select().from(closeRuns).where(eq(closeRuns.id, closeRunId)).all()[0];
  if (!run) throw new Error("not found");
  if (!run.proposedActions) throw new Error("no proposed actions");

  db.update(closeRuns).set({ state: "EXECUTING", approved: true, approvedAt: Math.floor(Date.now() / 1000) }).where(eq(closeRuns.id, closeRunId)).run();
  appendAudit({ orgId: run.orgId, actor: approver, type: "close.approved", payload: { closeRunId, auto: approver === "system" }, closeRunId });
  narrate(run.orgId, closeRunId, "EXECUTE", "thinking", approver === "system" ? "Auto-approved — executing now" : "Approved by user — executing now", {
    body: "Calling the bunq /v1/payment endpoint via the signed RSA-SHA256 client. Each action lands in the audit chain.",
  });

  const actions = JSON.parse(run.proposedActions) as ProposedAction[];
  const org = db.select().from(orgs).where(eq(orgs.id, run.orgId)).all()[0];
  const ctx = loadContext();
  const session = db.select().from(bunqSessions).where(eq(bunqSessions.orgId, run.orgId)).orderBy(desc(bunqSessions.id)).limit(1).all()[0];
  // Mock-mode placeholders: callBunq returns canned responses so these don't need to be real.
  const userId = org?.bunqUserId ?? ctx.userId ?? "0";
  const fromAccountId = ctx.mainAccountId ?? "1";
  const reserveAccountId = org?.reserveAccountId ?? ctx.reserveAccountId ?? "reserve_1";
  const taxReserveAccountId = org?.taxReserveAccountId ?? "tax_reserve_1";
  const token = session?.sessionToken ?? "mock_session_token";

  for (const a of actions) {
    appendAudit({ orgId: run.orgId, actor: "agent", type: `action.${a.kind}`, payload: a, closeRunId });
    if (a.kind === "reserve_transfer") {
      narrate(run.orgId, closeRunId, "EXECUTE", "tool_call", `Sending €${a.amountEur.toFixed(2)} to your Carbon Reserve`, {
        tool: "bunq",
        meta: { fromAccountId, toAccountId: reserveAccountId, amountEur: a.amountEur, description: a.description },
      });
      await intraUserTransfer({
        userId,
        fromAccountId,
        toAccountId: reserveAccountId,
        amountEur: a.amountEur,
        description: a.description,
        token,
        closeRunId,
      });
      narrate(run.orgId, closeRunId, "EXECUTE", "tool_result", `Carbon Reserve credited · €${a.amountEur.toFixed(2)}`);
    } else if (a.kind === "tax_reserve_transfer") {
      narrate(run.orgId, closeRunId, "EXECUTE", "tool_call", `Earmarking €${a.amountEur.toFixed(2)} to your Tax Reserve`, {
        tool: "bunq",
        meta: {
          fromAccountId,
          toAccountId: taxReserveAccountId,
          amountEur: a.amountEur,
          description: a.description,
          schemesCovered: a.schemesCovered,
        },
      });
      await intraUserTransfer({
        userId,
        fromAccountId,
        toAccountId: taxReserveAccountId,
        amountEur: a.amountEur,
        description: a.description,
        token,
        closeRunId,
      });
      narrate(run.orgId, closeRunId, "EXECUTE", "tool_result", `Tax Reserve credited · €${a.amountEur.toFixed(2)} · ${a.schemesCovered.length} scheme${a.schemesCovered.length === 1 ? "" : "s"}`);
    } else if (a.kind === "credit_purchase") {
      const project = CREDIT_PROJECTS.find((p) => p.id === a.projectId);
      const projectLabel = project?.name ?? a.projectId;
      narrate(run.orgId, closeRunId, "EXECUTE", "tool_call", `Reserving ${a.tonnes.toFixed(2)} t from ${projectLabel}`, {
        tool: "credits-marketplace",
        meta: { ...a, projectName: project?.name, registry: project?.registry, country: project?.country },
      });
    }
    // credit_purchase actions stay audit-only for the hackathon (simulated marketplace).
  }

  db.update(closeRuns).set({ state: "COMPLETED", status: "completed", completedAt: Math.floor(Date.now() / 1000) }).where(eq(closeRuns.id, closeRunId)).run();
  appendAudit({ orgId: run.orgId, actor: "agent", type: "close.completed", payload: { actionCount: actions.length }, closeRunId });
  narrate(run.orgId, closeRunId, "COMPLETE", "summary", "Loop closed", {
    body: `${actions.length} action${actions.length === 1 ? "" : "s"} executed. Audit chain extended; the run is reproducible from /ledger.`,
  });

  // Snapshot a briefing into the audit chain so the run is reproducible later.
  // Skip narrative to keep the close fast and deterministic; the report page
  // re-renders narrative on demand.
  try {
    const { buildBriefing } = await import("@/lib/reports/briefing");
    const briefing = await buildBriefing({ orgId: run.orgId, kind: "month", label: run.month, skipNarrative: true });
    appendAudit({ orgId: run.orgId, actor: "agent", type: "briefing.snapshot", payload: briefing, closeRunId });
  } catch (e) {
    appendAudit({ orgId: run.orgId, actor: "agent", type: "briefing.snapshot_failed", payload: { error: String(e) }, closeRunId });
  }

  return { state: "COMPLETED", executed: actions.length };
};

export { finalizeEstimates };
