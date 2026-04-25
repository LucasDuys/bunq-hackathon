/**
 * System prelude + per-call user message builder for the Explain assistant.
 *
 * The prelude is org-stable so it cache-hits across every metric open for the
 * same org. Anything per-call (scope, context payload, conversation history)
 * goes in the user message. Cap conversation history to the last 8 turns.
 */

import { ALL_CATEGORIES, FACTORS } from "@/lib/factors";
import type { ScopeArgs } from "./metrics";
import type { ExplainMessage } from "./schema";

type OrgLike = { name?: string | null } | null | undefined;
type PolicySummary = Record<string, unknown> | null;

const factorSources = (): string[] => Array.from(new Set(FACTORS.map((f) => f.source)));

export const buildSystemPrelude = (org: OrgLike, policy: PolicySummary): string => {
  const orgName = org?.name ?? "this org";
  const sources = factorSources().slice(0, 6).join("; ");
  const policyLine = policy
    ? `Policy: ambition=${policy.ambition ?? "?"}, creditPreference=${policy.creditPreference ?? "?"}, removalMix=${policy.removalMix ?? "?"}, approvalThresholdEur=${policy.approvalThresholdEur ?? "?"}.`
    : "Policy: not yet set — onboarding incomplete.";

  return [
    "You are Carbo's carbon analyst. You explain audit-grade carbon accounting for SMBs in plain English.",
    "",
    "Lexicon (use these terms):",
    "- Close: the monthly state-machine run that estimates emissions and proposes a reserve.",
    "- Reserve: the bunq sub-account where carbon credits are funded.",
    "- Cluster: a group of merchants the agent is uncertain about.",
    "- Credit: an EU-registered carbon credit (Puro.earth, Gold Standard).",
    "- Factor: a kg-CO₂e-per-EUR multiplier from DEFRA, ADEME, or Exiobase.",
    "- Ledger: the append-only audit log with SHA-256 hash chaining.",
    "",
    "Methodology:",
    "- CO₂e per transaction = factor.kgPerEur × spend_eur. Lower/upper bound applies factor.uncertaintyPct.",
    "- Confidence per estimate = (1 − factor.uncertaintyPct) × classifier_confidence × tier_weight.",
    "- Rollup: spend-weighted mean of confidence; total CO₂e via quadrature sum of bounds.",
    "- Tier 2 factors (DEFRA, ADEME) are higher fidelity than Tier 3 (Exiobase economy-wide).",
    `- Factor sources in use: ${sources}.`,
    `- Categories tracked: ${ALL_CATEGORIES.join(", ")}.`,
    "",
    `Org: ${orgName}. ${policyLine}`,
    "",
    "Style rules:",
    "- Be concise: 3–5 sentences unless asked for detail.",
    "- Pair every CO₂e number with a confidence band, e.g. `245 ± 18 kg`.",
    "- Use markdown bold only on the headline number.",
    "- Use thousand-separators and units (kg, t, €).",
    "- Never invent transaction IDs, merchant names, or factor values that aren't in the provided context.",
    "- If data is missing or zero, say so plainly. Don't guess.",
    "- Reference data with markers when relevant: `[tx:<id>]`, `[run:<id>]`, `[factor:<key>]`.",
    "- Speak in second person ('your footprint', 'your reserve').",
  ].join("\n");
};

const truncateHistory = (messages: ExplainMessage[], maxTurns = 8): ExplainMessage[] => {
  if (messages.length <= maxTurns) return messages;
  return messages.slice(messages.length - maxTurns);
};

export const buildUserMessage = (opts: {
  metric: string;
  scope: ScopeArgs;
  context: Record<string, unknown>;
  history: ExplainMessage[];
  question: string;
}): string => {
  const trimmedHistory = truncateHistory(opts.history.slice(0, -1));
  const transcript = trimmedHistory.length
    ? trimmedHistory
        .map((m) => `${m.role === "assistant" ? "ASSISTANT" : "USER"}: ${m.content}`)
        .join("\n")
    : "(none — first turn)";

  const scopePairs = Object.entries(opts.scope)
    .filter(([, v]) => v !== undefined && v !== "")
    .map(([k, v]) => `${k}=${v}`)
    .join(" ");

  return [
    `METRIC: ${opts.metric}`,
    `SCOPE: ${scopePairs || "(none)"}`,
    "",
    "CONTEXT (live data, do not invent beyond this):",
    "```json",
    JSON.stringify(opts.context, null, 2),
    "```",
    "",
    "PRIOR CONVERSATION:",
    transcript,
    "",
    `USER: ${opts.question}`,
  ].join("\n");
};
