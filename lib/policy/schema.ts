import { z } from "zod";

export const reserveRuleSchema = z.object({
  category: z.string(),
  method: z.enum(["pct_spend", "eur_per_kg_co2e", "flat_eur"]),
  value: z.number().nonnegative(),
});

export const creditPreferenceSchema = z.object({
  region: z.enum(["EU", "ANY"]).default("EU"),
  types: z.array(z.enum(["removal_technical", "removal_nature", "reduction"])).default([
    "removal_technical",
    "removal_nature",
  ]),
  minRemovalPct: z.number().min(0).max(1).default(0.7),
});

export const policySchema = z.object({
  reserveRules: z.array(reserveRuleSchema).min(1),
  approvalThresholdEur: z.number().nonnegative().default(500),
  creditPreference: creditPreferenceSchema.default({
    region: "EU",
    types: ["removal_technical", "removal_nature"],
    minRemovalPct: 0.7,
  }),
  maxReservePerMonthEur: z.number().nonnegative().default(5000),
});

export type Policy = z.infer<typeof policySchema>;
export type ReserveRule = z.infer<typeof reserveRuleSchema>;

export const DEFAULT_POLICY: Policy = {
  reserveRules: [
    { category: "travel", method: "pct_spend", value: 0.03 },
    { category: "food", method: "pct_spend", value: 0.02 },
    { category: "procurement", method: "pct_spend", value: 0.015 },
    { category: "cloud", method: "pct_spend", value: 0.01 },
    { category: "services", method: "pct_spend", value: 0.01 },
    { category: "*", method: "eur_per_kg_co2e", value: 0.08 },
  ],
  approvalThresholdEur: 500,
  creditPreference: {
    region: "EU",
    types: ["removal_technical", "removal_nature"],
    minRemovalPct: 0.7,
  },
  maxReservePerMonthEur: 5000,
};
