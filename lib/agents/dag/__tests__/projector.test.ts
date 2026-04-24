import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  forecastAnnualSavings,
  type ForecastInput,
  type ForecastOutput,
} from "../projector";

const defaultDistribution: ForecastInput["spendDistribution"] = {
  travel: 0.2,
  procurement: 0.2,
  food: 0.2,
  services: 0.2,
  cloud: 0.2,
};

const baseInput = (overrides: Partial<ForecastInput> = {}): ForecastInput => ({
  jurisdiction: "NL",
  entityType: "BV",
  monthlySpendEur: 100_000,
  spendDistribution: defaultDistribution,
  switchAdoptionPct: 0.5,
  ...overrides,
});

describe("forecastAnnualSavings (R006)", () => {
  it("AC2: NL/BV/€100k/equal-spread/0.5 → positive net impact, non-negative payback", () => {
    const out: ForecastOutput = forecastAnnualSavings(baseInput());
    assert.ok(
      out.projected_savings.net_company_scale_financial_impact_eur > 0,
      "net_company_scale_financial_impact_eur must be > 0 for realistic baseline",
    );
    assert.ok(
      out.projected_savings.payback_period_months >= 0,
      "payback_period_months must be >= 0",
    );
  });

  it("AC3: zero adoption → zero savings", () => {
    const out = forecastAnnualSavings(baseInput({ switchAdoptionPct: 0 }));
    assert.equal(
      out.projected_savings.net_company_scale_financial_impact_eur,
      0,
      "zero adoption must yield zero net impact",
    );
    assert.equal(
      out.projected_savings.direct_procurement_eur,
      0,
      "zero adoption must yield zero direct procurement savings",
    );
    assert.equal(
      out.projected_savings.avoided_offset_purchase_eur,
      0,
      "zero adoption must yield zero avoided offset",
    );
  });

  it("AC4: zero spend → zero savings, no throw", () => {
    assert.doesNotThrow(() => forecastAnnualSavings(baseInput({ monthlySpendEur: 0 })));
    const out = forecastAnnualSavings(baseInput({ monthlySpendEur: 0 }));
    assert.equal(out.baseline_annual_spend_eur, 0);
    assert.equal(out.baseline_annual_tco2e, 0);
    assert.equal(
      out.projected_savings.net_company_scale_financial_impact_eur,
      0,
      "zero spend must yield zero net impact",
    );
  });

  it("AC5: doubling monthlySpendEur roughly doubles direct_procurement_eur (±5%)", () => {
    const baseline = forecastAnnualSavings(baseInput({ monthlySpendEur: 100_000 }));
    const doubled = forecastAnnualSavings(baseInput({ monthlySpendEur: 200_000 }));
    const ratio =
      doubled.projected_savings.direct_procurement_eur /
      baseline.projected_savings.direct_procurement_eur;
    assert.ok(
      ratio >= 1.95 && ratio <= 2.05,
      `linearity broken: ratio=${ratio.toFixed(3)}, expected ~2.0 (±5%)`,
    );
  });

  it("AC6: confidence drops when 50% of distribution lands on 'other'", () => {
    const known = forecastAnnualSavings(baseInput());
    const wildcardHeavy = forecastAnnualSavings(
      baseInput({
        spendDistribution: {
          travel: 0.125,
          procurement: 0.125,
          food: 0.125,
          services: 0.125,
          other: 0.5,
        },
      }),
    );
    assert.ok(
      wildcardHeavy.confidence < known.confidence,
      `confidence must drop when half of distribution is wildcard — known=${known.confidence.toFixed(3)}, wildcard=${wildcardHeavy.confidence.toFixed(3)}`,
    );
    assert.ok(wildcardHeavy.confidence >= 0 && wildcardHeavy.confidence <= 1);
    assert.ok(known.confidence >= 0 && known.confidence <= 1);
  });

  it("AC7: sensitivity[100%].net_impact_eur >= sensitivity[25%].net_impact_eur", () => {
    const out = forecastAnnualSavings(baseInput());
    assert.ok(Array.isArray(out.sensitivity), "sensitivity must be an array");
    assert.equal(out.sensitivity.length, 4, "sensitivity must have 4 entries (25/50/75/100%)");
    const low = out.sensitivity.find((s) => Math.abs(s.adoption_pct - 0.25) < 0.01);
    const high = out.sensitivity.find((s) => Math.abs(s.adoption_pct - 1.0) < 0.01);
    assert.ok(low, "sensitivity must contain 25% adoption entry");
    assert.ok(high, "sensitivity must contain 100% adoption entry");
    assert.ok(
      high.net_impact_eur >= low.net_impact_eur,
      `100% adoption must not yield less than 25% — low=${low.net_impact_eur}, high=${high.net_impact_eur}`,
    );
  });
});
