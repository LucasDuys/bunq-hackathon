import type { Policy, ReserveRule } from "./schema";

export type CategoryAggregate = {
  category: string;
  spendEur: number;
  co2eKg: number;
};

export type PolicyOutcome = {
  perCategory: Array<{
    category: string;
    spendEur: number;
    co2eKg: number;
    ruleApplied: ReserveRule;
    reserveEur: number;
  }>;
  reserveTotalEur: number;
  cappedByMax: boolean;
  requiresApproval: boolean;
};

const ruleEurForCategory = (rule: ReserveRule, agg: CategoryAggregate): number => {
  switch (rule.method) {
    case "pct_spend":
      return agg.spendEur * rule.value;
    case "eur_per_kg_co2e":
      return agg.co2eKg * rule.value;
    case "flat_eur":
      return rule.value;
    default: {
      const _exhaustive: never = rule.method;
      return agg.co2eKg * rule.value;
    }
  }
};

const pickRule = (policy: Policy, category: string): ReserveRule => {
  return (
    policy.reserveRules.find((r) => r.category === category) ??
    policy.reserveRules.find((r) => r.category === "*") ?? {
      category: "*",
      method: "eur_per_kg_co2e",
      value: 0.05,
    }
  );
};

export const evaluatePolicy = (policy: Policy, aggregates: CategoryAggregate[]): PolicyOutcome => {
  const perCategory = aggregates.map((agg) => {
    const rule = pickRule(policy, agg.category);
    return {
      category: agg.category,
      spendEur: agg.spendEur,
      co2eKg: agg.co2eKg,
      ruleApplied: rule,
      reserveEur: Number(ruleEurForCategory(rule, agg).toFixed(2)),
    };
  });
  const raw = perCategory.reduce((s, r) => s + r.reserveEur, 0);
  const capped = raw > policy.maxReservePerMonthEur;
  const reserveTotalEur = capped ? policy.maxReservePerMonthEur : Number(raw.toFixed(2));
  return {
    perCategory,
    reserveTotalEur,
    cappedByMax: capped,
    requiresApproval: reserveTotalEur > policy.approvalThresholdEur,
  };
};
