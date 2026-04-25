import { and, desc, eq, gte, lt, sql } from "drizzle-orm";
import {
  auditEvents,
  closeRuns,
  creditProjects,
  db,
  emissionEstimates,
  invoiceLineItems,
  invoices,
  orgs,
  policies,
  refinementQa,
  transactions,
} from "@/lib/db/client";
import { estimateEmission } from "@/lib/emissions/estimate";
import { computeClusters, type Cluster } from "@/lib/agent/clusters";
import {
  calculateTransactionSavings,
  rollupMonthlySavings,
  type MonthlySavingsSummary,
} from "@/lib/tax";

export const DEFAULT_ORG_ID = "org_acme_bv";

export const getOrg = (orgId = DEFAULT_ORG_ID) =>
  db.select().from(orgs).where(eq(orgs.id, orgId)).all()[0];

export const getActivePolicyRaw = (orgId = DEFAULT_ORG_ID) =>
  db.select().from(policies).where(and(eq(policies.orgId, orgId), eq(policies.active, true))).all()[0];

export const monthBounds = (month: string) => {
  const [y, m] = month.split("-").map(Number);
  return {
    start: Math.floor(Date.UTC(y, m - 1, 1) / 1000),
    end: Math.floor(Date.UTC(y, m, 1) / 1000),
  };
};

export const currentMonth = () => {
  const d = new Date();
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
};

export const getTransactionsForMonth = (orgId: string, month: string) => {
  const { start, end } = monthBounds(month);
  return db.select().from(transactions).where(and(eq(transactions.orgId, orgId), gte(transactions.timestamp, start), lt(transactions.timestamp, end))).all();
};

export const getAllTransactions = (orgId: string) =>
  db.select().from(transactions).where(eq(transactions.orgId, orgId)).orderBy(desc(transactions.timestamp)).all();

export const getLatestCloseRun = (orgId: string) =>
  db.select().from(closeRuns).where(eq(closeRuns.orgId, orgId)).orderBy(desc(closeRuns.startedAt)).limit(1).all()[0];

export const getCloseRun = (id: string) =>
  db.select().from(closeRuns).where(eq(closeRuns.id, id)).all()[0];

export const getQuestionsForRun = (runId: string) =>
  db.select().from(refinementQa).where(eq(refinementQa.closeRunId, runId)).orderBy(refinementQa.id).all();

export const getAuditForRun = (runId: string) =>
  db.select().from(auditEvents).where(eq(auditEvents.closeRunId, runId)).orderBy(auditEvents.id).all();

export const getAllAudit = (orgId: string, limit = 200) =>
  db.select().from(auditEvents).where(eq(auditEvents.orgId, orgId)).orderBy(desc(auditEvents.id)).limit(limit).all();

export const getCreditProjects = () => db.select().from(creditProjects).all();

export const getCategorySpendForMonth = (orgId: string, month: string) => {
  const { start, end } = monthBounds(month);
  return db.select({
    category: transactions.category,
    count: sql<number>`count(*)`.as("cnt"),
    spendEur: sql<number>`sum(${transactions.amountCents}) / 100.0`.as("spend"),
  }).from(transactions)
    .where(and(eq(transactions.orgId, orgId), gte(transactions.timestamp, start), lt(transactions.timestamp, end)))
    .groupBy(transactions.category)
    .all();
};

export const getMonthlyTrend = (orgId: string, months = 6) => {
  // returns [{month, co2eKg, spendEur}] for the past N months incl current
  const out: Array<{ month: string; co2eKg: number; spendEur: number }> = [];
  const now = new Date();
  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
    const month = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
    const { start, end } = monthBounds(month);
    const spendRow = db.select({ s: sql<number>`coalesce(sum(${transactions.amountCents}),0) / 100.0` }).from(transactions)
      .where(and(eq(transactions.orgId, orgId), gte(transactions.timestamp, start), lt(transactions.timestamp, end))).all()[0];
    // naive estimate: sum of emission_estimates for txs in that range (latest run) — fallback to 0
    const co2Row = db.select({
      c: sql<number>`coalesce(sum(${emissionEstimates.co2eKgPoint}),0)`,
    }).from(emissionEstimates).innerJoin(transactions, eq(transactions.id, emissionEstimates.txId))
      .where(and(eq(transactions.orgId, orgId), gte(transactions.timestamp, start), lt(transactions.timestamp, end))).all()[0];
    out.push({ month, co2eKg: co2Row?.c ?? 0, spendEur: spendRow?.s ?? 0 });
  }
  return out;
};

export const getTaxSavingsForMonth = (orgId: string, month: string): MonthlySavingsSummary => {
  const txs = getTransactionsForMonth(orgId, month);
  const summaries = txs
    .filter((tx) => tx.category && tx.amountCents > 0)
    .map((tx) => {
      const amountEur = tx.amountCents / 100;
      const estimate = estimateEmission({
        category: tx.category!,
        subCategory: tx.subCategory,
        amountEur,
        classifierConfidence: tx.categoryConfidence ?? 0.5,
      });
      return calculateTransactionSavings({
        category: tx.category!,
        subCategory: tx.subCategory,
        amountEur,
        estimate,
      });
    });
  return rollupMonthlySavings(month, summaries);
};

export type ClusterWithQuestion = Cluster & {
  runId: string | null;
  question: string | null;
  answer: string | null;
  answered: boolean;
};

/**
 * Build a live view of merchant clusters for the given month.
 * Combines deterministic recomputation from current transactions with
 * any persisted refinement Q&A from the latest close run, so the UI can show
 * which clusters the agent has asked about and what the user answered.
 */
export const getClustersForMonth = (
  orgId: string,
  month: string,
): ClusterWithQuestion[] => {
  const txs = getTransactionsForMonth(orgId, month);
  if (txs.length === 0) return [];

  const items = txs.map((tx) => {
    const est = estimateEmission({
      category: tx.category ?? "other",
      subCategory: tx.subCategory,
      amountEur: tx.amountCents / 100,
      classifierConfidence: tx.categoryConfidence ?? 0.5,
    });
    return { tx, est };
  });

  const clusters = computeClusters(items);

  const latestRun = getLatestCloseRun(orgId);
  const runId = latestRun?.id ?? null;
  const qas = runId ? getQuestionsForRun(runId) : [];
  const byClusterId = new Map(qas.map((q) => [q.clusterId, q]));

  return clusters.map((c) => {
    const qa = byClusterId.get(c.id);
    return {
      ...c,
      runId,
      question: qa?.question ?? null,
      answer: qa?.answer ?? null,
      answered: !!qa?.answer,
      flagged: c.flagged || !!qa,
    };
  });
};

export const getLatestEstimatesForMonth = (orgId: string, month: string) => {
  const { start, end } = monthBounds(month);
  return db.select({
    txId: transactions.id,
    merchantRaw: transactions.merchantRaw,
    category: transactions.category,
    amountCents: transactions.amountCents,
    co2eKgPoint: emissionEstimates.co2eKgPoint,
    co2eKgLow: emissionEstimates.co2eKgLow,
    co2eKgHigh: emissionEstimates.co2eKgHigh,
    confidence: emissionEstimates.confidence,
    method: emissionEstimates.method,
  }).from(emissionEstimates)
    .innerJoin(transactions, eq(transactions.id, emissionEstimates.txId))
    .where(and(eq(transactions.orgId, orgId), gte(transactions.timestamp, start), lt(transactions.timestamp, end)))
    .all();
};

// ── Invoice queries ──

export const getInvoicesForOrg = (orgId: string, limit = 100) =>
  db.select().from(invoices).where(eq(invoices.orgId, orgId)).orderBy(desc(invoices.createdAt)).limit(limit).all();

export const getInvoice = (id: string) =>
  db.select().from(invoices).where(eq(invoices.id, id)).all()[0];

export const getInvoiceLineItems = (invoiceId: string) =>
  db.select().from(invoiceLineItems).where(eq(invoiceLineItems.invoiceId, invoiceId)).all();

export const getInvoiceWithItems = (id: string) => {
  const inv = getInvoice(id);
  if (!inv) return null;
  const items = getInvoiceLineItems(id);
  return { ...inv, lineItems: items };
};

export const getInvoiceStats = (orgId: string) =>
  db.select({
    total: sql<number>`count(*)`,
    linked: sql<number>`coalesce(sum(case when linked_tx_id is not null then 1 else 0 end), 0)`,
    totalAmountCents: sql<number>`coalesce(sum(total_cents), 0)`,
  }).from(invoices).where(eq(invoices.orgId, orgId)).all()[0];
