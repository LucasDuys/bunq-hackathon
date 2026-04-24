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
import { generateRefinementQuestions } from "./questions";

export type CloseState =
  | "AGGREGATE"
  | "ESTIMATE_INITIAL"
  | "CLUSTER_UNCERTAINTY"
  | "QUESTIONS_GENERATED"
  | "AWAITING_ANSWERS"
  | "APPLY_ANSWERS"
  | "ESTIMATE_FINAL"
  | "APPLY_POLICY"
  | "PROPOSED"
  | "AWAITING_APPROVAL"
  | "EXECUTING"
  | "COMPLETED"
  | "FAILED";

export type Cluster = {
  id: string;
  merchantLabel: string;
  merchantNorms: string[];
  txIds: string[];
  totalSpendEur: number;
  likelyCategory: string | null;
  likelySubCategory: string | null;
  avgClassifierConfidence: number;
  impactScore: number;
};

export type ProposedAction =
  | { kind: "reserve_transfer"; amountEur: number; description: string }
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

const getActivePolicy = (orgId: string): Policy => {
  const rows = db.select().from(policies).where(and(eq(policies.orgId, orgId), eq(policies.active, true))).all();
  if (rows.length === 0) return DEFAULT_POLICY;
  return parsePolicy(rows[0].rules);
};

/**
 * Start a close run. Runs AGGREGATE → ESTIMATE_INITIAL → CLUSTER → QUESTIONS in one go,
 * then halts at AWAITING_ANSWERS until POST /close/[id]/answer resolves them.
 */
export const startCloseRun = async (orgId: string, month: string) => {
  const id = `run_${randomUUID()}`;
  const { start, end } = monthBounds(month);

  db.insert(closeRuns).values({ id, orgId, month, status: "active", state: "AGGREGATE", startedAt: Math.floor(Date.now() / 1000) }).run();
  appendAudit({ orgId, actor: "agent", type: "close.start", payload: { closeRunId: id, month }, closeRunId: id });

  // 1. AGGREGATE
  const txs = db.select().from(transactions).where(and(eq(transactions.orgId, orgId), gte(transactions.timestamp, start), lt(transactions.timestamp, end))).all();
  if (txs.length === 0) {
    db.update(closeRuns).set({ state: "FAILED", status: "failed", completedAt: Math.floor(Date.now() / 1000) }).where(eq(closeRuns.id, id)).run();
    appendAudit({ orgId, actor: "agent", type: "close.no_transactions", payload: { month }, closeRunId: id });
    throw new Error(`No transactions for ${month}`);
  }

  // 2. ESTIMATE_INITIAL
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

  // 3. CLUSTER_UNCERTAINTY: group tx by merchantNorm, pick top-N by (spend × (1-confidence)).
  db.update(closeRuns).set({ state: "CLUSTER_UNCERTAINTY" }).where(eq(closeRuns.id, id)).run();
  const byMerchant = new Map<string, typeof estimates>();
  for (const e of estimates) {
    const key = e.tx.merchantNorm;
    if (!byMerchant.has(key)) byMerchant.set(key, []);
    byMerchant.get(key)!.push(e);
  }
  const clusters: Cluster[] = [];
  for (const [merchantNorm, group] of byMerchant) {
    const totalSpendEur = group.reduce((s, g) => s + g.tx.amountCents / 100, 0);
    const avgConf = group.reduce((s, g) => s + (g.tx.categoryConfidence ?? 0.5), 0) / group.length;
    const pointCo2 = group.reduce((s, g) => s + g.est.co2eKgPoint, 0);
    const rangeHalf = group.reduce((s, g) => s + (g.est.co2eKgHigh - g.est.co2eKgLow) / 2, 0);
    const impactScore = rangeHalf * (1 - avgConf);
    // Only worth asking about if there's real uncertainty and material spend
    if (totalSpendEur < 300 || avgConf > 0.85) continue;
    clusters.push({
      id: `cl_${merchantNorm.replace(/\s+/g, "_").slice(0, 32)}`,
      merchantLabel: group[0].tx.merchantRaw,
      merchantNorms: [merchantNorm],
      txIds: group.map((g) => g.tx.id),
      totalSpendEur,
      likelyCategory: group[0].tx.category,
      likelySubCategory: group[0].tx.subCategory,
      avgClassifierConfidence: avgConf,
      impactScore,
    });
  }
  clusters.sort((a, b) => b.impactScore - a.impactScore);
  const topClusters = clusters.slice(0, 3);

  // 4. GENERATE QUESTIONS
  db.update(closeRuns).set({ state: "QUESTIONS_GENERATED" }).where(eq(closeRuns.id, id)).run();
  const questions = await generateRefinementQuestions(topClusters);
  for (const q of questions) {
    const cluster = topClusters.find((c) => c.id === q.clusterId) ?? topClusters[0];
    db.insert(refinementQa).values({
      closeRunId: id,
      clusterId: q.clusterId,
      question: q.question,
      options: JSON.stringify(q.options),
      affectedTxIds: JSON.stringify(cluster?.txIds ?? []),
    }).run();
  }
  appendAudit({ orgId, actor: "agent", type: "close.questions_generated", payload: { count: questions.length, clusterIds: questions.map((q) => q.clusterId) }, closeRunId: id });
  db.update(closeRuns).set({ state: "AWAITING_ANSWERS" }).where(eq(closeRuns.id, id)).run();

  return { id, initialCo2eKg: initial.co2eKgPoint, initialConfidence: initial.confidence, questionCount: questions.length };
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

  // 5. APPLY_POLICY
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

  // 6. PROPOSE_ACTIONS
  db.update(closeRuns).set({ state: "PROPOSED" }).where(eq(closeRuns.id, closeRunId)).run();
  const creditMix = totalBudgetMix(finalRollup.co2eKgPoint / 1000);
  const actions: ProposedAction[] = [
    { kind: "reserve_transfer", amountEur: outcome.reserveTotalEur, description: `Carbo ${run.month} close` },
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
  return { state: nextState, finalCo2eKg: finalRollup.co2eKgPoint, finalConfidence: finalRollup.confidence, reserveEur: outcome.reserveTotalEur, actions, requiresApproval: outcome.requiresApproval };
};

export const approveAndExecute = async (closeRunId: string) => {
  const run = db.select().from(closeRuns).where(eq(closeRuns.id, closeRunId)).all()[0];
  if (!run) throw new Error("not found");
  if (!run.proposedActions) throw new Error("no proposed actions");

  db.update(closeRuns).set({ state: "EXECUTING", approved: true, approvedAt: Math.floor(Date.now() / 1000) }).where(eq(closeRuns.id, closeRunId)).run();
  appendAudit({ orgId: run.orgId, actor: "user", type: "close.approved", payload: { closeRunId }, closeRunId });

  const actions = JSON.parse(run.proposedActions) as ProposedAction[];
  const org = db.select().from(orgs).where(eq(orgs.id, run.orgId)).all()[0];
  const ctx = loadContext();
  const session = db.select().from(bunqSessions).where(eq(bunqSessions.orgId, run.orgId)).orderBy(desc(bunqSessions.id)).limit(1).all()[0];
  // Mock-mode placeholders: callBunq returns canned responses so these don't need to be real.
  const userId = org?.bunqUserId ?? ctx.userId ?? "0";
  const fromAccountId = ctx.mainAccountId ?? "1";
  const reserveAccountId = org?.reserveAccountId ?? ctx.reserveAccountId ?? "reserve_1";
  const token = session?.sessionToken ?? "mock_session_token";

  for (const a of actions) {
    appendAudit({ orgId: run.orgId, actor: "agent", type: `action.${a.kind}`, payload: a, closeRunId });
    if (a.kind === "reserve_transfer") {
      await intraUserTransfer({
        userId,
        fromAccountId,
        toAccountId: reserveAccountId,
        amountEur: a.amountEur,
        description: a.description,
        token,
      });
    }
    // credit_purchase actions stay audit-only for the hackathon (simulated marketplace).
  }

  db.update(closeRuns).set({ state: "COMPLETED", status: "completed", completedAt: Math.floor(Date.now() / 1000) }).where(eq(closeRuns.id, closeRunId)).run();
  appendAudit({ orgId: run.orgId, actor: "agent", type: "close.completed", payload: { actionCount: actions.length }, closeRunId });
  return { state: "COMPLETED", executed: actions.length };
};

export { finalizeEstimates };
