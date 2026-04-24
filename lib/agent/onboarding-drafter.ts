import { MODEL_SONNET, anthropic, isAnthropicMock } from "@/lib/anthropic/client";
import { buildPolicyFromProfile, creditShortlistFromProfile, mergePartialPolicy } from "@/lib/onboarding/calibration";
import { renderPolicyMarkdown } from "@/lib/onboarding/markdown";
import type { CompanyProfile } from "@/lib/onboarding/profile";
import { drafterOutputSchema, type DrafterOutput, type PartialPolicy } from "@/lib/onboarding/types";
import { policySchema, type Policy } from "@/lib/policy/schema";

export type DrafterInput = {
  companyName: string;
  profile: CompanyProfile;
  answers: Array<{ topic: string; question: string; answer: string | null }>;
  partial: PartialPolicy;
  uploadedFromDoc: boolean;
};

const deterministicDrafter = (input: DrafterInput): DrafterOutput => {
  const base = buildPolicyFromProfile(input.profile);
  const merged = input.uploadedFromDoc ? mergePartialPolicy(base, input.partial as Partial<Policy>) : base;
  const policy = policySchema.parse({
    reserveRules: merged.reserveRules,
    approvalThresholdEur: merged.approvalThresholdEur,
    creditPreference: merged.creditPreference,
    maxReservePerMonthEur: merged.maxReservePerMonthEur,
  });
  const creditShortlist = creditShortlistFromProfile(input.profile);
  const calibrationNotes = [
    `Ambition: ${input.profile.ambition ?? "balanced"} (multiplier ${input.profile.ambition === "aggressive" ? "1.5x" : input.profile.ambition === "starter" ? "0.5x" : "1.0x"} on pct_spend rules).`,
    `Travel intensity: ${input.profile.travelIntensity ?? "monthly"}; cloud intensity: ${input.profile.cloudIntensity ?? "standard"}.`,
    ...base.notes,
  ].join(" ");
  const markdown = renderPolicyMarkdown({
    companyName: input.companyName,
    profile: input.profile,
    policy,
    creditShortlist,
    calibrationNotes,
    uploadedFromDoc: input.uploadedFromDoc,
  });
  return { policy, markdown, creditShortlist, calibrationNotes };
};

const liveDrafter = async (input: DrafterInput): Promise<DrafterOutput> => {
  const client = anthropic();
  const baseline = buildPolicyFromProfile(input.profile);
  const prompt = `You are drafting a Carbon policy for a bunq Business customer using Carbo. You MUST return valid JSON that matches the schema described below. If you are unsure, fall back to the provided baseline values.

Company name: ${input.companyName}
Company profile: ${JSON.stringify(input.profile)}
Uploaded from existing policy document: ${input.uploadedFromDoc}
Parsed partial policy from the upload (if any): ${JSON.stringify(input.partial)}
Answers collected during onboarding:
${input.answers.map((a) => `  - ${a.topic}: "${a.answer ?? "(skipped)"}"`).join("\n")}

Baseline policy already calibrated for this profile (use as the starting point — adjust only with reason):
${JSON.stringify(baseline)}

Schema requirements (strict — validated with Zod):
- policy.reserveRules: non-empty array; each has { category (string), method ("pct_spend"|"eur_per_kg_co2e"|"flat_eur"), value (number ≥ 0) }. Must include a "*" fallback rule.
- policy.approvalThresholdEur: number ≥ 0
- policy.creditPreference.region: "EU" or "ANY"
- policy.creditPreference.types: subset of ["removal_technical","removal_nature","reduction"]
- policy.creditPreference.minRemovalPct: number between 0 and 1
- policy.maxReservePerMonthEur: number ≥ 0
- markdown: sentence-case headings, at least 200 chars. Sections required: "Scope and approach", "Reserve rules by category" (as a markdown table), "Approval and caps", "Credit preference", "What this policy does not cover".
- creditShortlist: up to 3 strings picked from ["biochar-nl-gelderland","reforestation-ee-baltic","peatland-ie-midlands"].
- calibrationNotes: 2–3 sentences explaining why you chose these numbers.

Return JSON only, no prose outside the JSON:
{
  "policy": { ... },
  "markdown": "...",
  "creditShortlist": ["..."],
  "calibrationNotes": "..."
}`;

  const msg = await client.messages.create({
    model: MODEL_SONNET,
    max_tokens: 4500,
    messages: [{ role: "user", content: prompt }],
  });
  const text = msg.content
    .filter((c) => c.type === "text")
    .map((c) => (c as { text: string }).text)
    .join("");
  const m = text.match(/\{[\s\S]*\}\s*$/m) ?? text.match(/\{[\s\S]*\}/);
  if (!m) return deterministicDrafter(input);
  try {
    const raw = JSON.parse(m[0]);
    const parsed = drafterOutputSchema.parse(raw);
    return parsed;
  } catch {
    return deterministicDrafter(input);
  }
};

export const draftPolicy = async (input: DrafterInput): Promise<DrafterOutput> => {
  if (isAnthropicMock()) return deterministicDrafter(input);
  try {
    return await liveDrafter(input);
  } catch {
    return deterministicDrafter(input);
  }
};
