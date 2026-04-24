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

export function forecastAnnualSavings(_input: ForecastInput): ForecastOutput {
  throw new Error("forecastAnnualSavings not implemented (awaiting T004 — R004)");
}
