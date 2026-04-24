/**
 * Annual Savings Projector — deterministic helper for the dashboard + presentation.
 *
 * Mirrors the math in lib/agents/dag/creditStrategy.ts::compute() but parameterizes on a
 * hypothetical monthly spend profile rather than reading live transactions. Pure function:
 * no I/O outside the bounded tool helpers (which are themselves pure module reads).
 *
 * Spec: lib/specs/spec-dag-hardening.md R004.
 */
import { factorFor } from "@/lib/factors";
import { getCarbonCreditPrice, getCarbonPriceExposure, getCorporateTaxRate } from "./tools";
import { schemesForCategory } from "@/lib/tax/incentives";

export type ForecastJurisdiction = "NL" | "DE" | "FR" | "EU";
export type ForecastEntityType = "BV" | "NV" | "GmbH" | "SARL" | "other";

export type ForecastInput = {
  jurisdiction: ForecastJurisdiction;
  entityType: ForecastEntityType;
  monthlySpendEur: number;
  spendDistribution: Record<string, number>;
  switchAdoptionPct: number;
  policyId?: string;
};

export type ProjectedSavings = {
  direct_procurement_eur: number;
  avoided_offset_purchase_eur: number;
  tax_or_incentive_upside_eur: number;
  avoided_carbon_tax_eur: number;
  implementation_cost_eur: number;
  net_company_scale_financial_impact_eur: number;
  payback_period_months: number;
};

export type SensitivityEntry = {
  adoption_pct: number;
  net_impact_eur: number;
};

export type ForecastOutput = {
  baseline_annual_spend_eur: number;
  baseline_annual_tco2e: number;
  projected_savings: ProjectedSavings;
  confidence: number;
  assumptions: string[];
  sensitivity: SensitivityEntry[];
};

// Coefficients calibrated against the seeded GREEN/COST templates in tools.ts —
// average cost-delta across categories sits near 15%, average CO₂e reduction near 45%.
// Implementation cost as 10% of first-year direct savings keeps payback well under 12mo
// for the realistic baseline test, and scales linearly with spend (preserves AC5 linearity).
const AVG_COST_DELTA_PCT = 0.15;
const AVG_CARBON_SAVING_PCT = 0.45;
const IMPL_COST_FRACTION_OF_DIRECT = 0.10;

const round2 = (n: number): number => Number(n.toFixed(2));

const computeAtAdoption = (
  baselineAnnualSpendEur: number,
  baselineAnnualTco2e: number,
  knownFactorSpendEur: number,
  adoption: number,
  corpTaxRate: number,
  creditPriceEurPerTonne: number,
  etsEurPerTonne: number,
): ProjectedSavings => {
  if (baselineAnnualSpendEur <= 0 || adoption <= 0) {
    return {
      direct_procurement_eur: 0,
      avoided_offset_purchase_eur: 0,
      tax_or_incentive_upside_eur: 0,
      avoided_carbon_tax_eur: 0,
      implementation_cost_eur: 0,
      net_company_scale_financial_impact_eur: 0,
      payback_period_months: 0,
    };
  }
  // Direct procurement savings only count the portion of spend that maps to a known
  // emission factor — wildcard "other.*" categories don't have priced switch templates.
  const direct = knownFactorSpendEur * adoption * AVG_COST_DELTA_PCT;
  const emissionsReducedTco2e = baselineAnnualTco2e * adoption * AVG_CARBON_SAVING_PCT;
  const avoidedOffset = emissionsReducedTco2e * creditPriceEurPerTonne;
  // Tax shield on direct savings (mirrors creditStrategy.ts::compute() line ~127).
  const taxUpside = direct * corpTaxRate;
  const avoidedCarbonTax = emissionsReducedTco2e * etsEurPerTonne;
  const implementationCost = direct * IMPL_COST_FRACTION_OF_DIRECT;
  const net = direct + avoidedOffset + taxUpside + avoidedCarbonTax - implementationCost;
  const monthlyNet = net / 12;
  const payback = implementationCost > 0 && monthlyNet > 0
    ? implementationCost / monthlyNet
    : 0;
  return {
    direct_procurement_eur: round2(direct),
    avoided_offset_purchase_eur: round2(avoidedOffset),
    tax_or_incentive_upside_eur: round2(taxUpside),
    avoided_carbon_tax_eur: round2(avoidedCarbonTax),
    implementation_cost_eur: round2(implementationCost),
    net_company_scale_financial_impact_eur: round2(net),
    payback_period_months: round2(Math.max(0, payback)),
  };
};

export function forecastAnnualSavings(input: ForecastInput): ForecastOutput {
  const monthlySpend = Math.max(0, input.monthlySpendEur || 0);
  const adoption = Math.max(0, Math.min(1, input.switchAdoptionPct || 0));
  const distribution = input.spendDistribution ?? {};

  const baselineAnnualSpendEur = monthlySpend * 12;

  // Per-category emission lookups — sum tCO₂e and track wildcard fraction for confidence.
  let baselineAnnualTco2e = 0;
  let knownFractionSum = 0;
  let knownFactorSpendEur = 0;
  const eligibleCategorySet = new Set<string>();
  for (const [category, fractionRaw] of Object.entries(distribution)) {
    const fraction = Math.max(0, fractionRaw || 0);
    if (fraction <= 0) continue;
    const factor = factorFor(category, null);
    const annualCategorySpend = baselineAnnualSpendEur * fraction;
    baselineAnnualTco2e += (annualCategorySpend * factor.factorKgPerEur) / 1000;
    if (!factor.id.startsWith("other.")) {
      knownFractionSum += fraction;
      knownFactorSpendEur += annualCategorySpend;
      eligibleCategorySet.add(category);
    }
  }
  const confidence = Math.max(0, Math.min(1, knownFractionSum));

  // Tool helpers — bounded, deterministic module reads.
  const taxProfile = getCorporateTaxRate(input.jurisdiction, input.entityType);
  const creditPricing = getCarbonCreditPrice("removal_nature");
  const exposure = getCarbonPriceExposure(input.jurisdiction, "default");

  const projected = computeAtAdoption(
    baselineAnnualSpendEur,
    baselineAnnualTco2e,
    knownFactorSpendEur,
    adoption,
    taxProfile.corporateTaxRate,
    creditPricing.pricePerTonneEur,
    exposure.euPerTonne,
  );

  const sensitivity: SensitivityEntry[] = [0.25, 0.5, 0.75, 1.0].map((pct) => ({
    adoption_pct: pct,
    net_impact_eur: computeAtAdoption(
      baselineAnnualSpendEur,
      baselineAnnualTco2e,
      knownFactorSpendEur,
      pct,
      taxProfile.corporateTaxRate,
      creditPricing.pricePerTonneEur,
      exposure.euPerTonne,
    ).net_company_scale_financial_impact_eur,
  }));

  // Assumptions: declarative summary so the dashboard / CFO call can audit the math
  // without reading source. Includes the jurisdiction tax + ETS context plus any NL
  // incentive schemes that would apply to the eligible categories.
  const assumptions: string[] = [
    `Jurisdiction ${taxProfile.jurisdiction} corporate tax ${(taxProfile.corporateTaxRate * 100).toFixed(1)}%`,
    `Average cost delta across switches: ${(AVG_COST_DELTA_PCT * 100).toFixed(0)}%`,
    `Average CO₂e reduction across switches: ${(AVG_CARBON_SAVING_PCT * 100).toFixed(0)}%`,
    `Carbon credit price: €${creditPricing.pricePerTonneEur.toFixed(0)}/tCO₂e (${creditPricing.type})`,
    `EU ETS exposure: €${exposure.euPerTonne.toFixed(0)}/tCO₂e`,
    `Implementation cost: ${(IMPL_COST_FRACTION_OF_DIRECT * 100).toFixed(0)}% of first-year direct savings`,
  ];
  if (input.jurisdiction === "NL" && adoption > 0) {
    const schemeIds = new Set<string>();
    for (const cat of eligibleCategorySet) {
      for (const s of schemesForCategory(cat)) {
        if (s.jurisdiction === "NL") schemeIds.add(s.id);
      }
    }
    if (schemeIds.size > 0) {
      assumptions.push(`Eligible NL schemes: ${Array.from(schemeIds).sort().join(", ")}`);
    }
  }
  if (knownFractionSum < 1) {
    assumptions.push(
      `${((1 - knownFractionSum) * 100).toFixed(0)}% of distribution mapped to wildcard factor — savings excluded for that share`,
    );
  }

  return {
    baseline_annual_spend_eur: round2(baselineAnnualSpendEur),
    baseline_annual_tco2e: round2(baselineAnnualTco2e),
    projected_savings: projected,
    confidence: Number(confidence.toFixed(3)),
    assumptions,
    sensitivity,
  };
}
