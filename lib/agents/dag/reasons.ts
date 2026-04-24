/**
 * T002 / spec R005.AC3 — static reason_for_priority_detail strings.
 *
 * When `env.anthropicMock === true` (v0, no Anthropic key), the Baseline agent
 * fills `reason_for_priority_detail` from this table instead of calling an LLM.
 * When the LLM hook is active, it replaces these defaults with per-cluster
 * context-aware sentences.
 */

import type { BaselineOutput } from "./types";

export type ReasonForPriority = BaselineOutput["priority_targets"][number]["reason_for_priority"];

export const REASON_DETAIL: Record<ReasonForPriority, string> = {
  high_spend:
    "Cluster ranks in the top spend band for the period. Worth validating that the outlay aligns with expected volume or whether a cheaper equivalent is available.",
  high_emissions:
    "Cluster is a disproportionate contributor to the month's tCO₂e. Lower-carbon alternatives are likely to move the total materially.",
  high_uncertainty:
    "Cluster has low classifier confidence combined with meaningful spend. Further context (schema hint, invoice attachment) will unlock a tighter estimate and better downstream recommendations.",
  policy_relevant:
    "Cluster falls under a category the company has an active reserve policy for. Even a modest emission footprint here is in scope for the monthly close and an explicit recommendation is expected.",
};

export const detailFor = (reason: ReasonForPriority): string => REASON_DETAIL[reason];
