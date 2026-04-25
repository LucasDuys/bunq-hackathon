import { eq, and, desc, gte, lt, sql } from "drizzle-orm";
import { db, closeRuns, auditEvents, creditPurchases, orgs, transactions, emissionEstimates } from "@/lib/db/client";
import { verifyChain } from "./append";
import { monthBounds, getTransactionsForMonth } from "@/lib/queries";
import { estimateEmission } from "@/lib/emissions/estimate";
import { calculateTransactionSavings, rollupMonthlySavings } from "@/lib/tax";

export interface ProofMonth {
  month: string;
  co2eKg: number;
  confidence: number;
  reserveEur: number;
  approvedAt: number | null;
}

export interface CategoryBreakdown {
  category: string;
  co2eKg: number;
  spendEur: number;
  txCount: number;
}

export interface SavingsOverview {
  totalPotentialEur: number;
  annualProjection: number;
  topSchemes: { name: string; totalEur: number }[];
  topCategories: { category: string; savingsEur: number; co2eKg: number }[];
}

export interface ProofStats {
  org: { id: string; name: string; createdAt: number };
  totalCo2eKg: number;
  totalSpendEur: number;
  totalReserveEur: number;
  totalCreditsEur: number;
  totalCreditsTonnes: number;
  totalTxCount: number;
  monthsTracked: number;
  avgConfidence: number;
  closedMonths: ProofMonth[];
  categoryBreakdown: CategoryBreakdown[];
  savings: SavingsOverview;
  chainIntegrity: { valid: boolean; eventCount: number };
  latestHash: string;
  memberSince: string;
  treesEquivalent: number;
  flightsEquivalent: number;
  kmDrivenEquivalent: number;
}

export function getProofStats(orgId: string): ProofStats | null {
  const org = db.select().from(orgs).where(eq(orgs.id, orgId)).all()[0];
  if (!org) return null;

  const completed = db
    .select()
    .from(closeRuns)
    .where(and(eq(closeRuns.orgId, orgId), eq(closeRuns.approved, true)))
    .orderBy(desc(closeRuns.completedAt))
    .all();

  // Deduplicate: keep latest approved run per month
  const byMonth = new Map<string, ProofMonth>();
  for (const r of completed) {
    if (byMonth.has(r.month)) continue;
    byMonth.set(r.month, {
      month: r.month,
      co2eKg: r.finalCo2eKg ?? r.initialCo2eKg ?? 0,
      confidence: r.finalConfidence ?? r.initialConfidence ?? 0,
      reserveEur: r.reserveEur ?? 0,
      approvedAt: r.approvedAt ?? null,
    });
  }

  const closedMonths = [...byMonth.values()].sort((a, b) =>
    a.month.localeCompare(b.month),
  );

  let totalCo2eKg = 0;
  let totalReserveEur = 0;
  let confidenceSum = 0;
  for (const m of closedMonths) {
    totalCo2eKg += m.co2eKg;
    totalReserveEur += m.reserveEur;
    confidenceSum += m.confidence;
  }

  const allCredits = db
    .select()
    .from(creditPurchases)
    .innerJoin(closeRuns, eq(closeRuns.id, creditPurchases.closeRunId))
    .where(eq(closeRuns.orgId, orgId))
    .all();

  let totalCreditsEur = 0;
  let totalCreditsTonnes = 0;
  for (const c of allCredits) {
    totalCreditsEur += c.credit_purchases.eur;
    totalCreditsTonnes += c.credit_purchases.tonnes;
  }

  const chain = verifyChain(orgId);
  const events = db
    .select()
    .from(auditEvents)
    .where(eq(auditEvents.orgId, orgId))
    .orderBy(desc(auditEvents.id))
    .limit(1)
    .all();

  const createdDate = new Date(org.createdAt * 1000);
  const memberSince = createdDate.toLocaleDateString("en-GB", {
    month: "short",
    year: "numeric",
  });

  // Category breakdown across all closed months
  const categoryBreakdown: CategoryBreakdown[] = [];
  for (const m of closedMonths) {
    const { start, end } = monthBounds(m.month);
    const cats = db
      .select({
        category: transactions.category,
        co2eKg: sql<number>`coalesce(sum(${emissionEstimates.co2eKgPoint}), 0)`,
        spendEur: sql<number>`sum(${transactions.amountCents}) / 100.0`,
        txCount: sql<number>`count(*)`,
      })
      .from(transactions)
      .leftJoin(emissionEstimates, eq(emissionEstimates.txId, transactions.id))
      .where(
        and(
          eq(transactions.orgId, orgId),
          gte(transactions.timestamp, start),
          lt(transactions.timestamp, end),
        ),
      )
      .groupBy(transactions.category)
      .all();

    for (const c of cats) {
      const existing = categoryBreakdown.find((cb) => cb.category === (c.category ?? "other"));
      if (existing) {
        existing.co2eKg += c.co2eKg;
        existing.spendEur += c.spendEur;
        existing.txCount += c.txCount;
      } else {
        categoryBreakdown.push({
          category: c.category ?? "other",
          co2eKg: c.co2eKg,
          spendEur: c.spendEur,
          txCount: c.txCount,
        });
      }
    }
  }
  categoryBreakdown.sort((a, b) => b.co2eKg - a.co2eKg);

  const totalSpendEur = categoryBreakdown.reduce((s, c) => s + c.spendEur, 0);
  const totalTxCount = categoryBreakdown.reduce((s, c) => s + c.txCount, 0);

  // Compute savings across all closed months
  let totalPotentialSavings = 0;
  const schemeAgg = new Map<string, { name: string; eur: number }>();
  const catSavingsAgg = new Map<string, { savingsEur: number; co2eKg: number }>();
  for (const m of closedMonths) {
    const txs = getTransactionsForMonth(orgId, m.month);
    const summaries = txs
      .filter((tx) => tx.category && tx.amountCents > 0)
      .map((tx) => {
        const est = estimateEmission({
          category: tx.category!,
          subCategory: tx.subCategory,
          amountEur: tx.amountCents / 100,
          classifierConfidence: tx.categoryConfidence ?? 0.5,
        });
        return calculateTransactionSavings({
          category: tx.category!,
          subCategory: tx.subCategory,
          amountEur: tx.amountCents / 100,
          estimate: est,
        });
      });
    const rollup = rollupMonthlySavings(m.month, summaries);
    totalPotentialSavings += rollup.totalPotentialSavingsEur;
    for (const sv of rollup.byScheme) {
      const prev = schemeAgg.get(sv.schemeId) ?? { name: sv.schemeName, eur: 0 };
      prev.eur += sv.totalEur;
      schemeAgg.set(sv.schemeId, prev);
    }
    for (const cv of rollup.byCategory) {
      const prev = catSavingsAgg.get(cv.category) ?? { savingsEur: 0, co2eKg: 0 };
      prev.savingsEur += cv.potentialSavingsEur;
      prev.co2eKg += cv.co2eKg;
      catSavingsAgg.set(cv.category, prev);
    }
  }

  const savings: SavingsOverview = {
    totalPotentialEur: totalPotentialSavings,
    annualProjection: totalPotentialSavings * (12 / Math.max(closedMonths.length, 1)),
    topSchemes: [...schemeAgg.values()]
      .sort((a, b) => b.eur - a.eur)
      .slice(0, 5)
      .map((sv) => ({ name: sv.name, totalEur: sv.eur })),
    topCategories: [...catSavingsAgg.entries()]
      .sort((a, b) => b[1].savingsEur - a[1].savingsEur)
      .slice(0, 5)
      .map(([cat, v]) => ({ category: cat, savingsEur: v.savingsEur, co2eKg: v.co2eKg })),
  };

  // 1 tCO₂ ≈ 50 trees absorbing per year, ≈ 1 transatlantic flight, ≈ 6000 km driven
  const tonnes = totalCo2eKg / 1000;

  return {
    org: { id: org.id, name: org.name, createdAt: org.createdAt },
    totalCo2eKg,
    totalSpendEur,
    totalReserveEur,
    totalCreditsEur,
    totalCreditsTonnes,
    totalTxCount,
    monthsTracked: closedMonths.length,
    avgConfidence: closedMonths.length > 0 ? confidenceSum / closedMonths.length : 0,
    closedMonths,
    categoryBreakdown,
    savings,
    chainIntegrity: {
      valid: chain.valid,
      eventCount: "count" in chain ? (chain.count as number) : 0,
    },
    latestHash: events[0]?.hash ?? "0".repeat(64),
    memberSince,
    treesEquivalent: Math.round(tonnes * 50),
    flightsEquivalent: Math.round(tonnes),
    kmDrivenEquivalent: Math.round(tonnes * 6000),
  };
}
