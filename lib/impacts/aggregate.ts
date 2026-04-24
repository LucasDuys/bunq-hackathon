import { and, eq, gte } from "drizzle-orm";
import { db, transactions } from "@/lib/db/client";
import { estimateEmission } from "@/lib/emissions/estimate";
import { factorFor } from "@/lib/factors";

export type BaselineItem = {
  key: string;
  merchantNorm: string;
  merchantLabel: string;
  category: string;
  subCategory: string | null;
  annualSpendEur: number;
  annualCo2eKg: number;
  confidence: number;
  txCount: number;
  factorKgPerEur: number;
  factorUncertaintyPct: number;
};

export const IMPACT_CATEGORIES = ["cloud", "travel", "utilities"] as const;
export type ImpactCategory = (typeof IMPACT_CATEGORIES)[number];

const LOOKBACK_DAYS = 90;
const MIN_TX_COUNT = 1;
const MIN_ANNUAL_SPEND_EUR = 250;
const TOP_N_PER_CATEGORY = 4;

const isImpactCategory = (c: string | null): c is ImpactCategory =>
  !!c && (IMPACT_CATEGORIES as readonly string[]).includes(c);

export const computeBaselines = (orgId: string, now = new Date()): BaselineItem[] => {
  const sinceSec = Math.floor((now.getTime() - LOOKBACK_DAYS * 86_400_000) / 1000);
  const rows = db
    .select()
    .from(transactions)
    .where(and(eq(transactions.orgId, orgId), gte(transactions.timestamp, sinceSec)))
    .all();

  type Bucket = {
    merchantNorm: string;
    merchantLabel: string;
    category: string;
    subCategory: string | null;
    spendEur: number;
    co2eKg: number;
    confidence: number;
    txCount: number;
    factorKgPerEur: number;
    factorUncertaintyPct: number;
  };
  const buckets = new Map<string, Bucket>();

  for (const tx of rows) {
    if (!isImpactCategory(tx.category)) continue;
    const key = `${tx.merchantNorm}|${tx.category}|${tx.subCategory ?? "_"}`;
    const amountEur = tx.amountCents / 100;
    const est = estimateEmission({
      category: tx.category,
      subCategory: tx.subCategory ?? null,
      amountEur,
      classifierConfidence: tx.categoryConfidence ?? 0.6,
    });
    const factor = factorFor(tx.category, tx.subCategory ?? null);
    const existing = buckets.get(key);
    if (existing) {
      existing.spendEur += amountEur;
      existing.co2eKg += est.co2eKgPoint;
      existing.confidence = (existing.confidence * existing.txCount + est.confidence) / (existing.txCount + 1);
      existing.txCount += 1;
    } else {
      buckets.set(key, {
        merchantNorm: tx.merchantNorm,
        merchantLabel: tx.merchantRaw,
        category: tx.category,
        subCategory: tx.subCategory ?? null,
        spendEur: amountEur,
        co2eKg: est.co2eKgPoint,
        confidence: est.confidence,
        txCount: 1,
        factorKgPerEur: factor.factorKgPerEur,
        factorUncertaintyPct: factor.uncertaintyPct,
      });
    }
  }

  const annualizer = 365 / LOOKBACK_DAYS;
  const baselines: BaselineItem[] = [];
  for (const b of buckets.values()) {
    const annualSpendEur = b.spendEur * annualizer;
    if (b.txCount < MIN_TX_COUNT || annualSpendEur < MIN_ANNUAL_SPEND_EUR) continue;
    baselines.push({
      key: `${b.merchantNorm}|${b.category}|${b.subCategory ?? "_"}`,
      merchantNorm: b.merchantNorm,
      merchantLabel: b.merchantLabel,
      category: b.category,
      subCategory: b.subCategory,
      annualSpendEur: Number(annualSpendEur.toFixed(2)),
      annualCo2eKg: Number((b.co2eKg * annualizer).toFixed(3)),
      confidence: Number(b.confidence.toFixed(3)),
      txCount: b.txCount,
      factorKgPerEur: b.factorKgPerEur,
      factorUncertaintyPct: b.factorUncertaintyPct,
    });
  }

  const byCategory = new Map<string, BaselineItem[]>();
  for (const item of baselines) {
    const arr = byCategory.get(item.category) ?? [];
    arr.push(item);
    byCategory.set(item.category, arr);
  }
  const picked: BaselineItem[] = [];
  for (const cat of IMPACT_CATEGORIES) {
    const arr = (byCategory.get(cat) ?? []).sort((a, b) => b.annualCo2eKg - a.annualCo2eKg);
    picked.push(...arr.slice(0, TOP_N_PER_CATEGORY));
  }
  return picked.sort((a, b) => b.annualCo2eKg - a.annualCo2eKg);
};
