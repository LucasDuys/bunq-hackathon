import { CREDIT_PROJECTS } from "@/lib/credits/projects";
import type { Policy, ReserveRule } from "@/lib/policy/schema";
import { LABELS, labelFor, type CompanyProfile } from "./profile";

/**
 * Deterministic markdown renderer for a Carbo Policy.
 *
 * Used:
 *   1. Directly when the LLM drafter is skipped or invalid (fallback).
 *   2. As a reference the Sonnet drafter is told to follow.
 *
 * Output follows DESIGN §9: sentence-case headings, plain voice, numbers with
 * units next to them.
 */

const fmtMethod = (r: ReserveRule): string => {
  switch (r.method) {
    case "pct_spend":
      return `${(r.value * 100).toFixed(2)}% of spend`;
    case "eur_per_kg_co2e":
      return `€${r.value.toFixed(3)} per kg CO₂e`;
    case "flat_eur":
      return `€${r.value.toFixed(2)} flat`;
  }
};

const creditProjectName = (id: string) => CREDIT_PROJECTS.find((p) => p.id === id)?.name ?? id;

const profileLine = (topic: keyof typeof LABELS & keyof CompanyProfile, profile: CompanyProfile): string => {
  const v = profile[topic] as string | undefined;
  if (!v) return `- ${topic}: not specified`;
  return `- ${topic}: ${labelFor(topic, v)}`;
};

export const renderPolicyMarkdown = (params: {
  companyName: string;
  profile: CompanyProfile;
  policy: Policy;
  creditShortlist: string[];
  calibrationNotes: string;
  uploadedFromDoc?: boolean;
  generatedAt?: Date;
}): string => {
  const { companyName, profile, policy, creditShortlist, calibrationNotes, uploadedFromDoc } = params;
  const when = (params.generatedAt ?? new Date()).toISOString().slice(0, 10);
  const reserveRows = policy.reserveRules
    .map((r) => `| ${r.category} | ${fmtMethod(r)} | ${methodExplainer(r)} |`)
    .join("\n");
  const shortlistRows = creditShortlist
    .map((id) => `- ${creditProjectName(id)} (\`${id}\`)`)
    .join("\n");
  const sourceLine = uploadedFromDoc
    ? "Derived from the policy document you uploaded, then refined via targeted questions."
    : "Generated during onboarding by the Carbo interviewer agent, using the answers below.";

  return `# Carbon policy — ${companyName}

Generated on ${when}. ${sourceLine}

## 1. Scope and approach

Carbo allocates funds each month to a dedicated Carbon Reserve sub-account on bunq Business, based on the measured carbon emissions of your company's spend. This policy governs how those allocations are sized, when they require human approval, and how the collected funds are turned into EU-registered carbon credits.

The approach is **spend-based** (ISO 14064 / GHG Protocol Scope 3 Tier 3): emissions are estimated by applying sector factors (DEFRA 2024, ADEME, Exiobase) to EUR spend in each category, with explicit uncertainty ranges. Every figure on the Carbo dashboard pairs with a confidence indicator.

## 2. Company profile

${profileLine("sector", profile)}
${profileLine("headcount", profile)}
${profileLine("geography", profile)}
${profileLine("revenueBand", profile)}
${profileLine("physicalFootprint", profile)}
${profileLine("ownedVehicles", profile)}
${profileLine("csrdObligation", profile)}
${profile.existingDataNotes ? `- existing Scope 1 / 2 data sources: ${profile.existingDataNotes}\n` : ""}

## 3. Reserve rules by category

Each transaction is classified into one of the categories below and the rule is applied to the monthly spend aggregate.

| Category | Rule | What this means |
|---|---|---|
${reserveRows}

If a category isn't matched, the fallback rule \`*\` applies (currently **${fmtMethod(policy.reserveRules.find((r) => r.category === "*") ?? policy.reserveRules[policy.reserveRules.length - 1])}**).

## 4. Approval and caps

- **Approval threshold:** any monthly reserve over €${policy.approvalThresholdEur.toFixed(0)} must be approved by the CFO before the transfer is executed.
- **Monthly cap:** total reserve for any single month is capped at €${policy.maxReservePerMonthEur.toFixed(0)}. Anything above is logged but not transferred without an explicit override.
- **Audit trail:** every decision — classification, reserve, approval, transfer — is recorded in a SHA-256 hash-chained ledger (append-only, UPDATE and DELETE blocked at the database trigger).

## 5. Credit preference

- **Region:** ${policy.creditPreference.region === "EU" ? "EU registry projects only" : "any region"}
- **Types accepted:** ${policy.creditPreference.types.join(", ")}
- **Minimum removal share:** ${(policy.creditPreference.minRemovalPct * 100).toFixed(0)}% of tonnes must come from *removal* projects (nature or technical), not reduction-only credits.

Initial shortlist of projects matching this preference:

${shortlistRows || "- (none selected yet)"}

## 6. Calibration notes

${calibrationNotes}

## 7. What this policy does not cover

Spend-based accounting misses two important channels:

- **Scope 1 — direct combustion.** Owned-vehicle fuel and on-site combustion aren't fully captured unless invoices are paid from a bunq account. ${profile.ownedVehicles === "none" || !profile.ownedVehicles ? "You reported no owned vehicles, so this is minor for now." : "You have owned vehicles — a separate fuel log is recommended alongside this policy."}
- **Scope 2 — market-based electricity.** If you buy green electricity via a PPA, the location-based factor in Carbo will overstate emissions. A utility-bill upload channel is planned.

These gaps should be declared in the annual CSRD narrative (${profile.csrdObligation ? labelFor("csrdObligation", profile.csrdObligation) : "applicability not specified"}).

## 8. Review cadence

This policy is reviewed at each monthly close. Material changes (new sectors, a change in sub-account structure, or an external assurance finding) trigger a new onboarding run and a new signed version of this document. The prior version is retained read-only.

_— End of policy —_
`;
};

const methodExplainer = (r: ReserveRule): string => {
  switch (r.method) {
    case "pct_spend":
      return `Reserve = ${(r.value * 100).toFixed(2)}% × monthly ${r.category} spend`;
    case "eur_per_kg_co2e":
      return `Reserve = €${r.value.toFixed(3)} × kg CO₂e estimated in this category`;
    case "flat_eur":
      return `Flat €${r.value.toFixed(2)} per month regardless of spend`;
  }
};
