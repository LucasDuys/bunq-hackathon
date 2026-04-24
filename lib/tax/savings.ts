import { factorById, type FactorRow } from "@/lib/factors";
import { type EmissionEstimate } from "@/lib/emissions/estimate";
import {
  TAX_SCHEMES,
  EU_ETS_PRICE_EUR_PER_TONNE,
  NL_CORP_TAX_RATE,
  schemesForCategory,
  type TaxScheme,
} from "./incentives";
import { alternativeFor, type GreenAlternative } from "./alternatives";

export type TaxSaving = {
  schemeId: string;
  schemeName: string;
  savingsEur: number;
  method: string;
  description: string;
};

export type AlternativeSaving = {
  alternative: GreenAlternative;
  currentCo2eKg: number;
  alternativeCo2eKg: number;
  co2eReductionKg: number;
  co2eReductionPct: number;
  costDifferenceEur: number;
  annualizedSavingsEur: number;
};

export type TransactionTaxSummary = {
  factorId: string;
  category: string;
  amountEur: number;
  co2eKg: number;
  taxSavings: TaxSaving[];
  alternativeSaving: AlternativeSaving | null;
  totalPotentialSavingsEur: number;
};

/**
 * Calculate tax savings for a single transaction based on its emission estimate.
 */
export function calculateTransactionSavings(params: {
  category: string;
  subCategory: string | null;
  amountEur: number;
  estimate: EmissionEstimate;
}): TransactionTaxSummary {
  const { category, amountEur, estimate } = params;
  const factor = factorById(estimate.factorId);
  if (!factor) {
    return {
      factorId: estimate.factorId,
      category,
      amountEur,
      co2eKg: estimate.co2eKgPoint,
      taxSavings: [],
      alternativeSaving: null,
      totalPotentialSavingsEur: 0,
    };
  }

  const taxSavings = calculateSchemeSavings(factor, amountEur, estimate.co2eKgPoint);
  const alternativeSaving = calculateAlternativeSaving(factor, amountEur);

  const totalPotentialSavingsEur =
    taxSavings.reduce((sum, ts) => sum + ts.savingsEur, 0) +
    (alternativeSaving ? alternativeSaving.annualizedSavingsEur : 0);

  return {
    factorId: estimate.factorId,
    category,
    amountEur,
    co2eKg: estimate.co2eKgPoint,
    taxSavings,
    alternativeSaving,
    totalPotentialSavingsEur: Number(totalPotentialSavingsEur.toFixed(2)),
  };
}

function calculateSchemeSavings(
  factor: FactorRow,
  amountEur: number,
  co2eKg: number,
): TaxSaving[] {
  const schemes = schemesForCategory(factor.category);
  const savings: TaxSaving[] = [];

  for (const scheme of schemes) {
    const saving = applySingleScheme(scheme, factor, amountEur, co2eKg);
    if (saving && saving.savingsEur > 0) {
      savings.push(saving);
    }
  }

  return savings;
}

function applySingleScheme(
  scheme: TaxScheme,
  _factor: FactorRow,
  amountEur: number,
  co2eKg: number,
): TaxSaving | null {
  if (scheme.minInvestmentEur && amountEur < scheme.minInvestmentEur) return null;

  let savingsEur = 0;
  let description = "";

  switch (scheme.method) {
    case "pct_of_deduction": {
      // Extra deduction × corporate tax rate = actual cash saving
      const extraDeduction = amountEur * scheme.rate;
      savingsEur = extraDeduction * scheme.corpTaxRate;
      description = `${(scheme.rate * 100).toFixed(1)}% extra deduction → €${savingsEur.toFixed(0)} tax saved on €${amountEur.toFixed(0)} investment`;
      break;
    }
    case "pct_of_investment": {
      // Accelerated depreciation: cash-flow benefit modeled as NPV advantage
      // Simplified: 75% write-off in year 1 vs 20% straight-line = ~55% pull-forward
      // At corp tax rate, that's a timing benefit worth roughly rate × corpTax × discount
      const timingBenefit = amountEur * scheme.rate * scheme.corpTaxRate * 0.15; // ~15% NPV of timing
      savingsEur = timingBenefit;
      description = `${(scheme.rate * 100).toFixed(0)}% accelerated depreciation → €${savingsEur.toFixed(0)} cash-flow benefit`;
      break;
    }
    case "eur_per_tonne": {
      const tonnesCo2 = co2eKg / 1000;
      savingsEur = tonnesCo2 * scheme.rate;
      description = `${tonnesCo2.toFixed(3)} tonnes × €${scheme.rate}/t = €${savingsEur.toFixed(2)} carbon cost avoided`;
      break;
    }
    case "rate_reduction_bps": {
      // Not applicable at transaction level — org-level benefit
      return null;
    }
  }

  if (savingsEur < 0.01) return null;

  return {
    schemeId: scheme.id,
    schemeName: scheme.name,
    savingsEur: Number(savingsEur.toFixed(2)),
    method: scheme.method,
    description,
  };
}

function calculateAlternativeSaving(
  factor: FactorRow,
  amountEur: number,
): AlternativeSaving | null {
  const alt = alternativeFor(factor.id);
  if (!alt) return null;

  const altFactor = factorById(alt.toFactorId);
  if (!altFactor) return null;

  const currentCo2e = amountEur * factor.factorKgPerEur;
  const altCost = amountEur * alt.priceRatio;
  const altCo2e = altCost * altFactor.factorKgPerEur;
  const co2eReduction = currentCo2e - altCo2e;
  const costDifference = amountEur - altCost;

  // Annualize: assume this is monthly spend × 12
  const annualCostSaving = costDifference * 12;
  const annualCarbonSaving = co2eReduction * 12;
  const annualEtsSaving = (annualCarbonSaving / 1000) * EU_ETS_PRICE_EUR_PER_TONNE;

  return {
    alternative: alt,
    currentCo2eKg: Number(currentCo2e.toFixed(3)),
    alternativeCo2eKg: Number(altCo2e.toFixed(3)),
    co2eReductionKg: Number(co2eReduction.toFixed(3)),
    co2eReductionPct: currentCo2e > 0 ? Number(((co2eReduction / currentCo2e) * 100).toFixed(1)) : 0,
    costDifferenceEur: Number(costDifference.toFixed(2)),
    annualizedSavingsEur: Number((annualCostSaving + annualEtsSaving).toFixed(2)),
  };
}

// ── Monthly rollup ──────────────────────────────────────────────────

export type MonthlySavingsSummary = {
  month: string;
  totalTransactions: number;
  totalSpendEur: number;
  totalCo2eKg: number;
  totalPotentialSavingsEur: number;
  byScheme: { schemeId: string; schemeName: string; totalEur: number }[];
  byCategory: {
    category: string;
    spendEur: number;
    co2eKg: number;
    potentialSavingsEur: number;
    topAlternative: AlternativeSaving | null;
  }[];
  annualProjection: number;
};

export function rollupMonthlySavings(
  month: string,
  summaries: TransactionTaxSummary[],
): MonthlySavingsSummary {
  const totalSpend = summaries.reduce((s, t) => s + t.amountEur, 0);
  const totalCo2e = summaries.reduce((s, t) => s + t.co2eKg, 0);
  const totalSavings = summaries.reduce((s, t) => s + t.totalPotentialSavingsEur, 0);

  // By scheme
  const schemeMap = new Map<string, { schemeName: string; totalEur: number }>();
  for (const summary of summaries) {
    for (const ts of summary.taxSavings) {
      const existing = schemeMap.get(ts.schemeId) ?? { schemeName: ts.schemeName, totalEur: 0 };
      existing.totalEur += ts.savingsEur;
      schemeMap.set(ts.schemeId, existing);
    }
  }

  // By category
  const catMap = new Map<
    string,
    { spendEur: number; co2eKg: number; savingsEur: number; topAlt: AlternativeSaving | null }
  >();
  for (const summary of summaries) {
    const existing = catMap.get(summary.category) ?? {
      spendEur: 0,
      co2eKg: 0,
      savingsEur: 0,
      topAlt: null,
    };
    existing.spendEur += summary.amountEur;
    existing.co2eKg += summary.co2eKg;
    existing.savingsEur += summary.totalPotentialSavingsEur;
    if (
      summary.alternativeSaving &&
      (!existing.topAlt ||
        summary.alternativeSaving.annualizedSavingsEur > existing.topAlt.annualizedSavingsEur)
    ) {
      existing.topAlt = summary.alternativeSaving;
    }
    catMap.set(summary.category, existing);
  }

  return {
    month,
    totalTransactions: summaries.length,
    totalSpendEur: Number(totalSpend.toFixed(2)),
    totalCo2eKg: Number(totalCo2e.toFixed(3)),
    totalPotentialSavingsEur: Number(totalSavings.toFixed(2)),
    byScheme: Array.from(schemeMap.entries())
      .map(([schemeId, v]) => ({
        schemeId,
        schemeName: v.schemeName,
        totalEur: Number(v.totalEur.toFixed(2)),
      }))
      .sort((a, b) => b.totalEur - a.totalEur),
    byCategory: Array.from(catMap.entries())
      .map(([category, v]) => ({
        category,
        spendEur: Number(v.spendEur.toFixed(2)),
        co2eKg: Number(v.co2eKg.toFixed(3)),
        potentialSavingsEur: Number(v.savingsEur.toFixed(2)),
        topAlternative: v.topAlt,
      }))
      .sort((a, b) => b.potentialSavingsEur - a.potentialSavingsEur),
    annualProjection: Number((totalSavings * 12).toFixed(2)),
  };
}
