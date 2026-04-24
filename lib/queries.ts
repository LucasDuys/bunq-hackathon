import { and, desc, eq, gte, lt, sql } from "drizzle-orm";
import {
  auditEvents,
  closeRuns,
  creditProjects,
  db,
  emissionEstimates,
  orgs,
  policies,
  refinementQa,
  transactions,
} from "@/lib/db/client";

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
