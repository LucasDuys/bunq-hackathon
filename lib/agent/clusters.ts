import type { EmissionEstimate } from "@/lib/emissions/estimate";
import type { Transaction } from "@/lib/db/schema";

export type Cluster = {
  id: string;
  merchantLabel: string;
  merchantNorms: string[];
  txIds: string[];
  txCount: number;
  totalSpendEur: number;
  likelyCategory: string | null;
  likelySubCategory: string | null;
  avgClassifierConfidence: number;
  co2eKgPoint: number;
  co2eKgLow: number;
  co2eKgHigh: number;
  rangeHalfKg: number;
  impactScore: number;
  flagged: boolean;
};

export type ClusterInput = {
  tx: Pick<
    Transaction,
    | "id"
    | "merchantNorm"
    | "merchantRaw"
    | "amountCents"
    | "category"
    | "subCategory"
    | "categoryConfidence"
  >;
  est: Pick<EmissionEstimate, "co2eKgLow" | "co2eKgPoint" | "co2eKgHigh">;
};

export type ClusterOptions = {
  minSpendEur?: number;
  maxConfidence?: number;
  topN?: number;
};

const DEFAULT_OPTS: Required<ClusterOptions> = {
  minSpendEur: 300,
  maxConfidence: 0.85,
  topN: 3,
};

export const computeClusters = (
  items: ClusterInput[],
  opts: ClusterOptions = {},
): Cluster[] => {
  const { minSpendEur, maxConfidence, topN } = { ...DEFAULT_OPTS, ...opts };

  const byMerchant = new Map<string, ClusterInput[]>();
  for (const item of items) {
    const key = item.tx.merchantNorm;
    if (!byMerchant.has(key)) byMerchant.set(key, []);
    byMerchant.get(key)!.push(item);
  }

  const clusters: Cluster[] = [];
  for (const [merchantNorm, group] of byMerchant) {
    const totalSpendEur = group.reduce((s, g) => s + g.tx.amountCents / 100, 0);
    const avgConf =
      group.reduce((s, g) => s + (g.tx.categoryConfidence ?? 0.5), 0) / group.length;
    const co2eKgPoint = group.reduce((s, g) => s + g.est.co2eKgPoint, 0);
    const co2eKgLow = group.reduce((s, g) => s + g.est.co2eKgLow, 0);
    const co2eKgHigh = group.reduce((s, g) => s + g.est.co2eKgHigh, 0);
    const rangeHalf = group.reduce(
      (s, g) => s + (g.est.co2eKgHigh - g.est.co2eKgLow) / 2,
      0,
    );
    const impactScore = rangeHalf * (1 - avgConf);
    clusters.push({
      id: `cl_${merchantNorm.replace(/\s+/g, "_").slice(0, 32)}`,
      merchantLabel: group[0].tx.merchantRaw,
      merchantNorms: [merchantNorm],
      txIds: group.map((g) => g.tx.id),
      txCount: group.length,
      totalSpendEur,
      likelyCategory: group[0].tx.category,
      likelySubCategory: group[0].tx.subCategory,
      avgClassifierConfidence: avgConf,
      co2eKgPoint,
      co2eKgLow,
      co2eKgHigh,
      rangeHalfKg: rangeHalf,
      impactScore,
      flagged: false,
    });
  }

  clusters.sort((a, b) => b.impactScore - a.impactScore);

  let flaggedCount = 0;
  for (const c of clusters) {
    if (flaggedCount >= topN) break;
    if (c.totalSpendEur < minSpendEur) continue;
    if (c.avgClassifierConfidence > maxConfidence) continue;
    c.flagged = true;
    flaggedCount++;
  }

  return clusters;
};

/** Subset that the close state machine would act on. */
export const flaggedClusters = (clusters: Cluster[]): Cluster[] =>
  clusters.filter((c) => c.flagged);
