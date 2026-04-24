/**
 * T001 / spec R004.AC8 — category → recommended_next_agent lookup.
 *
 * The Spend & Emissions Baseline Agent uses this table to tag each priority
 * target with the agent best positioned to work on it:
 *  - green_alternatives_agent: categories with viable lower-carbon substitutes
 *    (travel → rail/EV; food → plant-forward; fuel → EV; utilities → green grid)
 *  - cost_savings_agent: categories whose wins are cost/consolidation plays
 *    (cloud SaaS overlap; services vendor consolidation; retail bulk contracts)
 *  - both: categories where carbon AND cost levers are comparable
 *    (procurement, electronics, furniture, mixed / unknown)
 *
 * Keep this synchronized with `lib/factors/` categories. When a new category
 * appears that isn't mapped here, the lookup falls back to "both" so no
 * priority target gets dropped silently.
 */

import type { BaselineOutput } from "./types";

export type RecommendedAgent = BaselineOutput["priority_targets"][number]["recommended_next_agent"];

export const CATEGORY_TO_AGENT: Record<string, RecommendedAgent> = {
  travel: "green_alternatives_agent",
  food: "green_alternatives_agent",
  fuel: "green_alternatives_agent",
  utilities: "green_alternatives_agent",
  energy: "green_alternatives_agent",

  cloud: "cost_savings_agent",
  software: "cost_savings_agent",
  services: "cost_savings_agent",

  procurement: "both",
  electronics: "both",
  furniture: "both",
  office: "both",
  retail: "both",
  grocery: "both",
};

export const recommendedAgentFor = (category: string | null | undefined): RecommendedAgent => {
  if (!category) return "both";
  return CATEGORY_TO_AGENT[category.toLowerCase()] ?? "both";
};
