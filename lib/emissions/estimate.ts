import { factorFor, factorById, type FactorRow } from "@/lib/factors";

export type EmissionEstimate = {
  factorId: string;
  co2eKgLow: number;
  co2eKgPoint: number;
  co2eKgHigh: number;
  confidence: number;
  method: "spend_based" | "refined";
};

/**
 * Blend: factor uncertainty × classifier confidence → overall confidence (0..1).
 * Range: point × (1 ± uncertainty). High uncertainty → wide range.
 * See research/02-confidence-methodology.md.
 */
export const estimateEmission = (params: {
  category: string;
  subCategory: string | null;
  amountEur: number;
  classifierConfidence: number;
  factorOverrideId?: string;
  method?: "spend_based" | "refined";
}): EmissionEstimate => {
  const factor = params.factorOverrideId ? (factorById(params.factorOverrideId) ?? factorFor(params.category, params.subCategory)) : factorFor(params.category, params.subCategory);
  const point = params.amountEur * factor.factorKgPerEur;
  const u = factor.uncertaintyPct;
  const low = point * (1 - u);
  const high = point * (1 + u);
  // Confidence = (1 - factor_uncertainty) * classifier_confidence * tier_weight
  const tierWeight = factor.tier === 1 ? 1.0 : factor.tier === 2 ? 0.9 : 0.75;
  const confidence = Math.max(0, Math.min(1, (1 - u) * params.classifierConfidence * tierWeight));
  return {
    factorId: factor.id,
    co2eKgLow: Number(low.toFixed(3)),
    co2eKgPoint: Number(point.toFixed(3)),
    co2eKgHigh: Number(high.toFixed(3)),
    confidence: Number(confidence.toFixed(3)),
    method: params.method ?? "spend_based",
  };
};

export type Rollup = {
  co2eKgLow: number;
  co2eKgPoint: number;
  co2eKgHigh: number;
  confidence: number;
  count: number;
};

/**
 * Quadrature sum for ranges (assume independent errors), weighted-mean for confidence.
 */
export const rollup = (estimates: Array<Pick<EmissionEstimate, "co2eKgLow" | "co2eKgPoint" | "co2eKgHigh" | "confidence">>): Rollup => {
  if (estimates.length === 0) return { co2eKgLow: 0, co2eKgPoint: 0, co2eKgHigh: 0, confidence: 0, count: 0 };
  const point = estimates.reduce((s, e) => s + e.co2eKgPoint, 0);
  const varSum = estimates.reduce((s, e) => {
    const half = (e.co2eKgHigh - e.co2eKgLow) / 2;
    return s + half * half;
  }, 0);
  const halfRange = Math.sqrt(varSum);
  const totalPoint = estimates.reduce((s, e) => s + e.co2eKgPoint, 0);
  const weightedConf = totalPoint > 0
    ? estimates.reduce((s, e) => s + e.confidence * e.co2eKgPoint, 0) / totalPoint
    : estimates.reduce((s, e) => s + e.confidence, 0) / estimates.length;
  return {
    co2eKgLow: Number(Math.max(0, point - halfRange).toFixed(3)),
    co2eKgPoint: Number(point.toFixed(3)),
    co2eKgHigh: Number((point + halfRange).toFixed(3)),
    confidence: Number(weightedConf.toFixed(3)),
    count: estimates.length,
  };
};

export type { FactorRow };
