import { z } from "zod";

/**
 * A monthly (or on-demand) carbon briefing for the user. Internal-facing,
 * not regulatory. Distinct from `CarbonReport` (annual, audit-grade).
 */

export const periodSchema = z.object({
  kind: z.enum(["month", "quarter", "ytd", "custom"]),
  label: z.string(),
  startTs: z.number(),
  endTs: z.number(),
  priorLabel: z.string().nullable(),
});

export const briefingSummarySchema = z.object({
  totalCo2eKg: z.number(),
  totalSpendEur: z.number(),
  txCount: z.number(),
  confidence: z.number(),
  deltaCo2ePct: z.number().nullable(),
  deltaSpendPct: z.number().nullable(),
  reserveBalanceEur: z.number(),
});

export const merchantBreakdownSchema = z.object({
  merchantNorm: z.string(),
  merchantRaw: z.string(),
  txCount: z.number(),
  spendEur: z.number(),
  co2eKg: z.number(),
  sharePct: z.number(),
  category: z.string().nullable(),
});

export const categoryBreakdownSchema = z.object({
  category: z.string(),
  spendEur: z.number(),
  co2eKg: z.number(),
  sharePct: z.number(),
});

export const anomalySchema = z.object({
  kind: z.enum([
    "merchant_surge",
    "category_surge",
    "new_high_emitter",
    "confidence_drop",
  ]),
  subject: z.string(),
  deltaPct: z.number().nullable(),
  currentCo2eKg: z.number().nullable(),
  priorCo2eKg: z.number().nullable(),
  message: z.string(),
});

export const swapSuggestionSchema = z.object({
  from: z.string(),
  to: z.string(),
  expectedSavingKg: z.number(),
  expectedSavingPct: z.number(),
  rationale: z.string(),
  currentCo2eKg: z.number(),
  currentSpendEur: z.number(),
});

export const reserveRecommendationSchema = z.object({
  recommendedTonnes: z.number(),
  recommendedSpendEur: z.number(),
  projectMix: z.array(
    z.object({
      projectId: z.string(),
      projectName: z.string(),
      tonnes: z.number(),
      eur: z.number(),
    }),
  ),
});

export const carbonBriefingSchema = z.object({
  orgId: z.string(),
  orgName: z.string(),
  generatedAt: z.string(),
  period: periodSchema,
  summary: briefingSummarySchema,
  topMerchants: z.array(merchantBreakdownSchema),
  topCategories: z.array(categoryBreakdownSchema),
  anomalies: z.array(anomalySchema),
  swaps: z.array(swapSuggestionSchema),
  reserve: reserveRecommendationSchema,
  narrative: z.string(),
});

export type CarbonBriefing = z.infer<typeof carbonBriefingSchema>;
export type Period = z.infer<typeof periodSchema>;
export type Anomaly = z.infer<typeof anomalySchema>;
export type SwapSuggestion = z.infer<typeof swapSuggestionSchema>;
