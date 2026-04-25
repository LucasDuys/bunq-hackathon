import { MODEL_SONNET, anthropic, withAnthropicFallback } from "@/lib/anthropic/client";
import {
  LABELS,
  MIN_REQUIRED_FIELDS,
  ambitionOptions,
  cloudIntensityOptions,
  companyProfileSchema,
  creditPrefOptions,
  csrdObligationOptions,
  footprintOptions,
  geographyOptions,
  headcountOptions,
  profileCoverage,
  profileMissing,
  removalMixOptions,
  revenueOptions,
  sectorOptions,
  travelIntensityOptions,
  vehicleOptions,
  type CompanyProfile,
} from "@/lib/onboarding/profile";
import {
  interviewerOutputSchema,
  type InterviewerOutput,
  type ParserGap,
  type QuestionKind,
} from "@/lib/onboarding/types";

type AnsweredTurn = {
  topic: string;
  kind: QuestionKind;
  question: string;
  answer: string | null;
  parsed: unknown;
};

export type InterviewerInput = {
  profile: CompanyProfile;
  answers: AnsweredTurn[];
  gaps?: ParserGap[];
  turnIndex: number;
  maxQuestions: number;
};

/**
 * Deterministic, profile-driven question plan used:
 *   1. As the script the mock interviewer walks through.
 *   2. As the fallback when the Sonnet interviewer returns something unparseable.
 *   3. As hints that are appended to the Sonnet prompt so it doesn't ask
 *      questions we've already answered or skipped.
 */
type Planned = {
  topic: string;
  kind: QuestionKind;
  question: string;
  options?: string[];
  required: boolean;
  rationale: string;
  skipIf?: (p: CompanyProfile) => boolean;
  fillsField: keyof CompanyProfile;
};

const mcOptions = (optionsKey: keyof typeof LABELS, values: readonly string[]): string[] =>
  values.map((v) => LABELS[optionsKey][v] ?? v);

const plan: Planned[] = [
  {
    topic: "profile.sector",
    kind: "multiple_choice",
    question: "What does your business do?",
    options: mcOptions("sector", sectorOptions),
    required: true,
    rationale: "Sector drives the baseline reserve rules and flags missing scopes (e.g. retail → procurement is large).",
    fillsField: "sector",
  },
  {
    topic: "profile.geography",
    kind: "multiple_choice",
    question: "Where does your company operate?",
    options: mcOptions("geography", geographyOptions),
    required: true,
    rationale: "Geography sets the default credit preference (EU-first or ANY).",
    fillsField: "geography",
  },
  {
    topic: "profile.headcount",
    kind: "multiple_choice",
    question: "How many people work at the company?",
    options: mcOptions("headcount", headcountOptions),
    required: false,
    rationale: "Headcount is needed for the CSRD E1 intensity metric (tCO₂e / FTE).",
    fillsField: "headcount",
  },
  {
    topic: "profile.revenueBand",
    kind: "multiple_choice",
    question: "What's the annual revenue band?",
    options: mcOptions("revenueBand", revenueOptions),
    required: false,
    rationale: "Revenue drives the default approval threshold and monthly cap.",
    fillsField: "revenueBand",
  },
  {
    topic: "profile.physicalFootprint",
    kind: "multiple_choice",
    question: "What does your physical footprint look like?",
    options: mcOptions("physicalFootprint", footprintOptions),
    required: true,
    rationale: "If fully remote, we skip utilities + fuel rules entirely.",
    fillsField: "physicalFootprint",
  },
  {
    topic: "profile.ownedVehicles",
    kind: "multiple_choice",
    question: "Does the company own any vehicles?",
    options: mcOptions("ownedVehicles", vehicleOptions),
    required: false,
    rationale: "Determines whether a Scope 1 fuel rule is needed.",
    skipIf: (p) => p.physicalFootprint === "fully_remote",
    fillsField: "ownedVehicles",
  },
  {
    topic: "profile.ambition",
    kind: "multiple_choice",
    question: "How ambitious should the carbon reserve be?",
    options: mcOptions("ambition", ambitionOptions),
    required: true,
    rationale: "Sets the overall reserve multiplier (0.5x / 1.0x / 1.5x).",
    fillsField: "ambition",
  },
  {
    topic: "profile.travelIntensity",
    kind: "multiple_choice",
    question: "How travel-heavy is the business?",
    options: mcOptions("travelIntensity", travelIntensityOptions),
    required: false,
    rationale: "Tunes the travel reserve rule (rare = 0.6x, product = 1.8x).",
    fillsField: "travelIntensity",
  },
  {
    topic: "profile.cloudIntensity",
    kind: "multiple_choice",
    question: "How cloud-heavy is the business?",
    options: mcOptions("cloudIntensity", cloudIntensityOptions),
    required: false,
    rationale: "Tunes the cloud reserve — heavy compute lifts the rule up to 1.8x.",
    skipIf: (p) => p.sector === "hospitality",
    fillsField: "cloudIntensity",
  },
  {
    topic: "profile.creditPreference",
    kind: "multiple_choice",
    question: "Which carbon credits should we buy?",
    options: mcOptions("creditPreference", creditPrefOptions),
    required: true,
    rationale: "Sets the credit region + type mix in the policy.",
    fillsField: "creditPreference",
  },
  {
    topic: "profile.removalMix",
    kind: "multiple_choice",
    question: "How much of the credit mix should be removals (vs. reductions)?",
    options: mcOptions("removalMix", removalMixOptions),
    required: false,
    rationale: "Sets the minRemovalPct threshold in the policy.",
    fillsField: "removalMix",
  },
  {
    topic: "profile.approvalThresholdEur",
    kind: "numeric",
    question: "Above what monthly reserve (€) should a person approve the transfer?",
    required: true,
    rationale: "Reserves above this threshold need a human sign-off. Lower number = more review.",
    fillsField: "approvalThresholdEur",
  },
  {
    topic: "profile.maxReservePerMonthEur",
    kind: "numeric",
    question: "What's the most the reserve should ever take in a single month (€)?",
    required: false,
    rationale: "Hard cap — protects against a runaway classification error moving too much money.",
    fillsField: "maxReservePerMonthEur",
  },
  {
    topic: "profile.csrdObligation",
    kind: "multiple_choice",
    question: "Is your company in scope for CSRD reporting?",
    options: mcOptions("csrdObligation", csrdObligationOptions),
    required: false,
    rationale: "Labels the policy document correctly for the auditor.",
    fillsField: "csrdObligation",
  },
  {
    topic: "profile.existingDataNotes",
    kind: "free_text",
    question: "Do you already track Scope 1 or Scope 2 emissions outside of bank data (utility bills, fleet fuel logs)? Anything we should know?",
    required: false,
    rationale: "Captures what the spend-based pipeline can't see — surfaces in the policy doc.",
    fillsField: "existingDataNotes",
  },
];

const askedTopics = (answers: AnsweredTurn[]): Set<string> => new Set(answers.map((a) => a.topic));

const nextPlanned = (input: InterviewerInput): Planned | null => {
  const asked = askedTopics(input.answers);
  const gapTopics = new Set((input.gaps ?? []).map((g) => `gap.${g.field}`));
  // Priority: required fields, then gap-targeted fields, then optional fields.
  const required = plan.filter((p) => p.required);
  const optional = plan.filter((p) => !p.required);
  for (const q of [...required, ...optional]) {
    if (asked.has(q.topic)) continue;
    if (q.skipIf && q.skipIf(input.profile)) continue;
    if (input.profile[q.fillsField] !== undefined && input.profile[q.fillsField] !== "") continue;
    if (gapTopics.size > 0 && !q.required) {
      // In upload/mix mode, only ask optional questions when they map to an explicit gap.
      const mapsToGap = Array.from(gapTopics).some((g) => g.includes(q.fillsField));
      if (!mapsToGap) continue;
    }
    return q;
  }
  return null;
};

const canDraft = (profile: CompanyProfile, answers: AnsweredTurn[]): boolean => {
  const missing = profileMissing(profile);
  if (missing.length === 0) return true;
  // Allow drafting once every required field has at least been asked (user may have skipped).
  const askedSet = askedTopics(answers);
  const stillMissing = missing.filter((field) => {
    const topic = plan.find((p) => p.fillsField === field)?.topic;
    return topic && !askedSet.has(topic);
  });
  return stillMissing.length === 0;
};

const plannedToOutput = (p: Planned, profileCov: number): InterviewerOutput => ({
  done: false,
  nextQuestion: {
    topic: p.topic,
    kind: p.kind,
    question: p.question,
    options: p.options,
    required: p.required,
    rationale: p.rationale,
  },
  profileDelta: undefined,
});

const deterministicInterviewer = (input: InterviewerInput): InterviewerOutput => {
  if (input.turnIndex >= input.maxQuestions || canDraft(input.profile, input.answers)) {
    return { done: true, nextQuestion: null };
  }
  const p = nextPlanned(input);
  if (!p) return { done: true, nextQuestion: null };
  return plannedToOutput(p, profileCoverage(input.profile));
};

const summaryForPrompt = (input: InterviewerInput): string => {
  const lines: string[] = [];
  lines.push(`Turn index: ${input.turnIndex} of max ${input.maxQuestions}.`);
  lines.push("Profile so far:");
  const filled = Object.entries(input.profile).filter(([, v]) => v !== undefined && v !== "");
  if (filled.length === 0) lines.push("  (empty)");
  for (const [k, v] of filled) lines.push(`  - ${k}: ${String(v)}`);
  lines.push("Questions asked so far:");
  if (input.answers.length === 0) lines.push("  (none)");
  for (const a of input.answers)
    lines.push(`  - topic=${a.topic} answer=${a.answer ?? "(skipped)"} parsed=${JSON.stringify(a.parsed ?? null)}`);
  if (input.gaps && input.gaps.length > 0) {
    lines.push("Policy gaps (from upload) still open:");
    for (const g of input.gaps) lines.push(`  - ${g.field}: ${g.reason}`);
  }
  lines.push(`Required fields: ${MIN_REQUIRED_FIELDS.join(", ")}.`);
  return lines.join("\n");
};

const liveInterviewer = async (input: InterviewerInput): Promise<InterviewerOutput> => {
  const client = anthropic();
  const prompt = `You are the onboarding interviewer for Carbo — a carbon accounting product for bunq Business customers.
Your goal is to draft a defensible carbon reserve policy in no more than ${input.maxQuestions} total questions.

The policy schema allows these reserve rule methods: pct_spend, eur_per_kg_co2e, flat_eur.
Allowed reserve rule categories: travel, food, procurement, cloud, services, utilities, fuel, "*" fallback.
The policy also needs: approvalThresholdEur (number), maxReservePerMonthEur (number), and creditPreference { region, types, minRemovalPct }.

Rules:
- Prefer multiple_choice. Only use free_text when the answer is genuinely open.
- Skip questions already answered. Skip questions implied by prior answers (e.g. don't ask about fuel if owned_vehicles = none).
- Each question must reduce the most uncertainty for the policy draft. Rationale should be one sentence.
- Mark done=true only when you have enough to draft: sector, geography, physicalFootprint, ambition, creditPreference, approvalThresholdEur.
- Never ask the same topic twice. Never more than ${input.maxQuestions} total.

${summaryForPrompt(input)}

Return pure JSON: { "done": boolean, "nextQuestion": { "topic": string, "kind": "multiple_choice"|"free_text"|"numeric"|"confirm", "question": string, "options"?: string[], "required": boolean, "rationale": string } | null, "profileDelta"?: { ...CompanyProfile partial... } }`;

  const msg = await client.messages.create({
    model: MODEL_SONNET,
    max_tokens: 1200,
    messages: [{ role: "user", content: prompt }],
  });
  const text = msg.content
    .filter((c) => c.type === "text")
    .map((c) => (c as { text: string }).text)
    .join("");
  const m = text.match(/\{[\s\S]*\}/);
  if (!m) return deterministicInterviewer(input);
  try {
    const parsed = interviewerOutputSchema.parse(JSON.parse(m[0]));
    if (parsed.profileDelta) {
      const validated = companyProfileSchema.partial().safeParse(parsed.profileDelta);
      parsed.profileDelta = validated.success ? validated.data : undefined;
    }
    return parsed;
  } catch {
    return deterministicInterviewer(input);
  }
};

export const runInterviewer = async (input: InterviewerInput): Promise<InterviewerOutput> =>
  withAnthropicFallback(
    () => liveInterviewer(input),
    () => deterministicInterviewer(input),
    "onboarding.runInterviewer",
  );

/**
 * Parse a free-text or numeric answer into structured profile data. Used when
 * the user types rather than picks a pill. MC answers are mapped by option
 * index in the state machine; this function handles the other two kinds.
 */
export const parseAnswerIntoProfile = (
  topic: string,
  kind: QuestionKind,
  answerRaw: string,
): { profile: Partial<CompanyProfile>; parsed: unknown } => {
  const answer = answerRaw.trim();
  if (kind === "numeric") {
    const n = Number(answer.replace(/[^0-9.]/g, ""));
    if (!Number.isFinite(n)) return { profile: {}, parsed: null };
    if (topic === "profile.approvalThresholdEur") return { profile: { approvalThresholdEur: n }, parsed: n };
    if (topic === "profile.maxReservePerMonthEur") return { profile: { maxReservePerMonthEur: n }, parsed: n };
    return { profile: {}, parsed: n };
  }
  if (kind === "free_text") {
    if (topic === "profile.existingDataNotes") return { profile: { existingDataNotes: answer }, parsed: answer };
    return { profile: {}, parsed: answer };
  }
  if (kind === "confirm") {
    const v = /^(y|yes|true|confirm)/i.test(answer);
    return { profile: {}, parsed: v };
  }
  return { profile: {}, parsed: answer };
};

/**
 * Map a multiple-choice label back onto the typed profile value. We store the
 * human label in onboarding_qa.answer (so it renders nicely in audit + UI) and
 * the structured value in parsed_answer.
 */
export const mapMcAnswer = (
  topic: string,
  label: string,
): { profile: Partial<CompanyProfile>; parsed: string | null } => {
  const field = plan.find((p) => p.topic === topic)?.fillsField;
  if (!field) return { profile: {}, parsed: null };
  const bucket = LABELS[field];
  if (!bucket) return { profile: {}, parsed: null };
  const entry = Object.entries(bucket).find(([, v]) => v === label);
  if (!entry) return { profile: {}, parsed: null };
  const [key] = entry;
  return { profile: { [field]: key } as Partial<CompanyProfile>, parsed: key };
};

export const getPlannedTopics = () => plan.map((p) => p.topic);
