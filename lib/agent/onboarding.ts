import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { and, eq, desc } from "drizzle-orm";
import { appendAudit } from "@/lib/audit/append";
import { createSubAccount } from "@/lib/bunq/accounts";
import {
  db,
  onboardingQa,
  onboardingRuns,
  orgs,
  policies,
} from "@/lib/db/client";
import { env } from "@/lib/env";
import { buildPolicyFromProfile } from "@/lib/onboarding/calibration";
import { renderPolicyMarkdown } from "@/lib/onboarding/markdown";
import { companyProfileSchema, EMPTY_PROFILE, type CompanyProfile } from "@/lib/onboarding/profile";
import { type DrafterOutput, type InterviewerOutput, type ParserOutput, type PartialPolicy, type QuestionKind } from "@/lib/onboarding/types";
import { policySchema, type Policy } from "@/lib/policy/schema";
import { startCloseRun } from "./close";
import { draftPolicy } from "./onboarding-drafter";
import { getPlannedTopics, mapMcAnswer, parseAnswerIntoProfile, runInterviewer } from "./onboarding-interviewer";
import { isParserBarren, parseUploadedPolicy } from "./onboarding-parser";

export type OnboardingTrack = "generate" | "upload" | "mix";

export type OnboardingState =
  | "INIT"
  | "UPLOAD_PARSING"
  | "UPLOAD_MAPPED"
  | "PROFILE_COLLECT"
  | "AWAITING_ANSWER"
  | "DRAFT_POLICY"
  | "AWAITING_APPROVAL"
  | "FINALIZE"
  | "SEED_FIRST_CLOSE"
  | "COMPLETED"
  | "FAILED"
  | "ABANDONED";

const MAX_QUESTIONS = 12;
const ABANDON_AFTER_SECONDS = 24 * 60 * 60;

const uploadsDir = () => {
  const dbPath = env.dbUrl.replace(/^file:/, "");
  return path.join(path.dirname(dbPath), "onboarding-uploads");
};

const nowSec = () => Math.floor(Date.now() / 1000);

const parseJson = <T>(raw: string | null, fallback: T): T => {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
};

const readProfile = (raw: string | null): CompanyProfile => {
  const obj = parseJson<unknown>(raw, {});
  const v = companyProfileSchema.safeParse(obj);
  return v.success ? v.data : EMPTY_PROFILE;
};

const updateRun = (id: string, fields: Record<string, unknown>) => {
  db.update(onboardingRuns)
    .set({ ...fields, updatedAt: nowSec() })
    .where(eq(onboardingRuns.id, id))
    .run();
};

const getRun = (id: string) => db.select().from(onboardingRuns).where(eq(onboardingRuns.id, id)).all()[0];

const getQa = (runId: string) =>
  db.select().from(onboardingQa).where(eq(onboardingQa.runId, runId)).orderBy(onboardingQa.turnIndex).all();

export const getActiveRunForOrg = (orgId: string) => {
  const rows = db
    .select()
    .from(onboardingRuns)
    .where(and(eq(onboardingRuns.orgId, orgId), eq(onboardingRuns.status, "active")))
    .orderBy(desc(onboardingRuns.updatedAt))
    .all();
  if (rows.length === 0) return null;
  const run = rows[0];
  // Auto-abandon stale runs
  if (run.updatedAt < nowSec() - ABANDON_AFTER_SECONDS) {
    db.update(onboardingRuns)
      .set({ status: "abandoned", state: "ABANDONED" })
      .where(eq(onboardingRuns.id, run.id))
      .run();
    appendAudit({ orgId, actor: "system", type: "onboarding.abandoned", payload: { runId: run.id, reason: "stale_24h" } });
    return null;
  }
  return run;
};

export const getLatestRunForOrg = (orgId: string) =>
  db
    .select()
    .from(onboardingRuns)
    .where(eq(onboardingRuns.orgId, orgId))
    .orderBy(desc(onboardingRuns.createdAt))
    .all()[0];

export const startOnboarding = async (params: { orgId: string; track: OnboardingTrack; companyName?: string }) => {
  const id = `onb_${randomUUID()}`;
  db.insert(onboardingRuns)
    .values({
      id,
      orgId: params.orgId,
      track: params.track,
      state: params.track === "generate" ? "PROFILE_COLLECT" : "INIT",
      status: "active",
      profile: JSON.stringify(params.companyName ? { companyName: params.companyName } : {}),
    })
    .run();
  appendAudit({ orgId: params.orgId, actor: "user", type: "onboarding.started", payload: { runId: id, track: params.track } });

  if (params.track === "generate") {
    await askNextQuestion(id);
  }
  return { id, track: params.track };
};

const applyTrack = async (runId: string) => {
  const run = getRun(runId);
  if (!run) throw new Error("run not found");
  if (run.track === "generate") {
    updateRun(runId, { state: "PROFILE_COLLECT" });
    await askNextQuestion(runId);
  } else {
    updateRun(runId, { state: "INIT" });
  }
};

export const attachUpload = async (params: {
  runId: string;
  filename: string;
  mime: string;
  bytes: Buffer;
}): Promise<ParserOutput> => {
  const run = getRun(params.runId);
  if (!run) throw new Error("run not found");
  if (run.track === "generate") throw new Error("upload not allowed on generate track");
  const dir = uploadsDir();
  await mkdir(dir, { recursive: true });
  const ext = path.extname(params.filename).toLowerCase() || ".bin";
  const savePath = path.join(dir, `${params.runId}${ext}`);
  await writeFile(savePath, params.bytes);
  updateRun(params.runId, {
    state: "UPLOAD_PARSING",
    uploadRef: savePath,
    uploadMime: params.mime,
  });
  appendAudit({
    orgId: run.orgId,
    actor: "user",
    type: "onboarding.upload.received",
    payload: { runId: params.runId, filename: params.filename, mime: params.mime, bytes: params.bytes.length },
  });

  const parsed = await parseUploadedPolicy({ filePath: savePath, mime: params.mime });
  const barren = isParserBarren(parsed);

  if (barren) {
    updateRun(params.runId, {
      state: "PROFILE_COLLECT",
      track: "generate",
      partialPolicy: JSON.stringify(parsed.partial ?? {}),
      gapList: JSON.stringify(parsed.gaps ?? []),
      unsupportedList: JSON.stringify(parsed.unsupported ?? []),
      profile: JSON.stringify(parsed.profile ?? {}),
      uploadExtract: "",
    });
    appendAudit({
      orgId: run.orgId,
      actor: "agent",
      type: "onboarding.upload.barren",
      payload: { runId: params.runId, gapCount: parsed.gaps.length },
    });
    await askNextQuestion(params.runId);
    return parsed;
  }

  updateRun(params.runId, {
    state: "UPLOAD_MAPPED",
    partialPolicy: JSON.stringify(parsed.partial ?? {}),
    gapList: JSON.stringify(parsed.gaps ?? []),
    unsupportedList: JSON.stringify(parsed.unsupported ?? []),
    profile: JSON.stringify({ ...readProfile(run.profile), ...parsed.profile }),
  });
  appendAudit({
    orgId: run.orgId,
    actor: "agent",
    type: "onboarding.upload.parsed",
    payload: { runId: params.runId, gapCount: parsed.gaps.length, unsupportedCount: parsed.unsupported.length },
  });

  // If nothing's missing, go straight to draft. Otherwise, interview the gaps.
  if (parsed.gaps.length === 0 && parsed.unsupported.filter((u) => u.severity === "error").length === 0) {
    await runDrafter(params.runId);
  } else {
    updateRun(params.runId, { state: "PROFILE_COLLECT" });
    await askNextQuestion(params.runId);
  }
  return parsed;
};

export const askNextQuestion = async (runId: string) => {
  const run = getRun(runId);
  if (!run) throw new Error("run not found");
  const profile = readProfile(run.profile);
  const asked = getQa(runId);
  const turnIndex = asked.length;
  const answered = asked.map((a) => ({
    topic: a.topic,
    kind: a.kind as QuestionKind,
    question: a.question,
    answer: a.answer,
    parsed: parseJson<unknown>(a.parsedAnswer, null),
  }));
  const gaps = parseJson<ParserOutput["gaps"]>(run.gapList, []);
  const out: InterviewerOutput = await runInterviewer({
    profile,
    answers: answered,
    gaps,
    turnIndex,
    maxQuestions: MAX_QUESTIONS,
  });

  if (out.profileDelta && Object.keys(out.profileDelta).length > 0) {
    const merged = { ...profile, ...out.profileDelta };
    updateRun(runId, { profile: JSON.stringify(merged) });
  }

  if (out.done || !out.nextQuestion) {
    // Move into draft
    await runDrafter(runId);
    return;
  }
  const q = out.nextQuestion;
  const validTopic = getPlannedTopics().includes(q.topic) || q.topic.startsWith("profile.") || q.topic.startsWith("gap.");
  if (!validTopic) {
    // Unknown topic from the LLM — fall back to the deterministic planner
    const mock = await runInterviewer({
      profile,
      answers: answered,
      gaps,
      turnIndex,
      maxQuestions: MAX_QUESTIONS,
    });
    if (mock.done || !mock.nextQuestion) {
      await runDrafter(runId);
      return;
    }
    await persistQuestion(runId, mock.nextQuestion, turnIndex);
    return;
  }
  await persistQuestion(runId, q, turnIndex);
};

const persistQuestion = async (
  runId: string,
  q: NonNullable<InterviewerOutput["nextQuestion"]>,
  turnIndex: number,
) => {
  const run = getRun(runId);
  if (!run) throw new Error("run not found");
  db.insert(onboardingQa)
    .values({
      runId,
      turnIndex,
      topic: q.topic,
      kind: q.kind,
      question: q.question,
      options: q.options ? JSON.stringify(q.options) : null,
      rationale: q.rationale,
      required: q.required,
    })
    .run();
  updateRun(runId, { state: "AWAITING_ANSWER", questionCount: turnIndex + 1 });
  appendAudit({
    orgId: run.orgId,
    actor: "agent",
    type: "onboarding.question_asked",
    payload: { runId, topic: q.topic, kind: q.kind, turnIndex, rationale: q.rationale },
  });
};

export const answerOnboardingQuestion = async (runId: string, qaId: number, answerRaw: string) => {
  const run = getRun(runId);
  if (!run) throw new Error("run not found");
  const qaRow = db.select().from(onboardingQa).where(eq(onboardingQa.id, qaId)).all()[0];
  if (!qaRow) throw new Error("question not found");
  if (qaRow.runId !== runId) throw new Error("qa does not belong to this run");
  if (qaRow.answer) throw new Error("already answered");

  const profile = readProfile(run.profile);
  const kind = qaRow.kind as QuestionKind;
  let profileDelta: Partial<CompanyProfile> = {};
  let parsed: unknown = null;

  if (kind === "multiple_choice") {
    const mapped = mapMcAnswer(qaRow.topic, answerRaw);
    profileDelta = mapped.profile;
    parsed = mapped.parsed;
  } else {
    const mapped = parseAnswerIntoProfile(qaRow.topic, kind, answerRaw);
    profileDelta = mapped.profile;
    parsed = mapped.parsed;
  }

  const merged = { ...profile, ...profileDelta };
  db.update(onboardingQa)
    .set({ answer: answerRaw, parsedAnswer: parsed !== null ? JSON.stringify(parsed) : null, answeredAt: nowSec() })
    .where(eq(onboardingQa.id, qaId))
    .run();
  updateRun(runId, { profile: JSON.stringify(merged) });

  appendAudit({
    orgId: run.orgId,
    actor: "user",
    type: "onboarding.answered",
    payload: { runId, qaId, topic: qaRow.topic, answer: answerRaw, delta: profileDelta },
  });

  // Remove any gaps that are now filled
  const gaps = parseJson<ParserOutput["gaps"]>(run.gapList, []);
  const topicField = qaRow.topic.replace(/^profile\./, "");
  const remainingGaps = gaps.filter((g) => !g.field.endsWith(topicField));
  updateRun(runId, { gapList: JSON.stringify(remainingGaps) });

  await askNextQuestion(runId);
  return { state: getRun(runId)?.state, profile: merged };
};

export const skipOnboardingQuestion = async (runId: string, qaId: number) => {
  const run = getRun(runId);
  if (!run) throw new Error("run not found");
  const qaRow = db.select().from(onboardingQa).where(eq(onboardingQa.id, qaId)).all()[0];
  if (!qaRow) throw new Error("question not found");
  if (qaRow.required) throw new Error("required question cannot be skipped");
  db.update(onboardingQa)
    .set({ answer: "(skipped)", answeredAt: nowSec() })
    .where(eq(onboardingQa.id, qaId))
    .run();
  appendAudit({
    orgId: run.orgId,
    actor: "user",
    type: "onboarding.skipped",
    payload: { runId, qaId, topic: qaRow.topic },
  });
  await askNextQuestion(runId);
  return { state: getRun(runId)?.state };
};

const runDrafter = async (runId: string) => {
  const run = getRun(runId);
  if (!run) throw new Error("run not found");
  updateRun(runId, { state: "DRAFT_POLICY" });
  appendAudit({ orgId: run.orgId, actor: "agent", type: "onboarding.drafting", payload: { runId } });

  const profile = readProfile(run.profile);
  const partial = parseJson<PartialPolicy>(run.partialPolicy, {});
  const org = db.select().from(orgs).where(eq(orgs.id, run.orgId)).all()[0];
  const companyName = profile.companyName ?? org?.name ?? "Your company";
  const qa = getQa(runId);

  let draft: DrafterOutput;
  try {
    draft = await draftPolicy({
      companyName,
      profile,
      answers: qa.map((q) => ({ topic: q.topic, question: q.question, answer: q.answer })),
      partial,
      uploadedFromDoc: run.track !== "generate" && !!run.uploadRef,
    });
  } catch (e) {
    // Deterministic fallback — should already be the drafter's own fallback, but guard anyway.
    const fallbackPolicy = policySchema.parse(buildPolicyFromProfile(profile));
    draft = {
      policy: fallbackPolicy,
      markdown: renderPolicyMarkdown({
        companyName,
        profile,
        policy: fallbackPolicy,
        creditShortlist: ["biochar-nl-gelderland", "peatland-ie-midlands"],
        calibrationNotes: `Drafter fell back to deterministic calibration (reason: ${(e as Error).message}).`,
      }),
      creditShortlist: ["biochar-nl-gelderland", "peatland-ie-midlands"],
      calibrationNotes: `Fallback calibration: ${(e as Error).message}`,
    };
  }

  updateRun(runId, {
    state: "AWAITING_APPROVAL",
    draftPolicy: JSON.stringify(draft.policy),
    draftMarkdown: draft.markdown,
    creditShortlist: JSON.stringify(draft.creditShortlist),
    calibrationNotes: draft.calibrationNotes,
  });
  appendAudit({
    orgId: run.orgId,
    actor: "agent",
    type: "onboarding.draft_ready",
    payload: {
      runId,
      reserveRuleCount: draft.policy.reserveRules.length,
      approvalThresholdEur: draft.policy.approvalThresholdEur,
      maxReservePerMonthEur: draft.policy.maxReservePerMonthEur,
      creditShortlist: draft.creditShortlist,
    },
  });
  return draft;
};

export const reviseDraft = async (runId: string, overrides: Partial<Policy>) => {
  const run = getRun(runId);
  if (!run) throw new Error("run not found");
  if (run.state !== "AWAITING_APPROVAL") throw new Error(`cannot revise in state ${run.state}`);
  const existing = parseJson<Policy | null>(run.draftPolicy, null);
  if (!existing) throw new Error("no draft to revise");
  const next = policySchema.parse({ ...existing, ...overrides });
  updateRun(runId, { draftPolicy: JSON.stringify(next) });
  appendAudit({
    orgId: run.orgId,
    actor: "user",
    type: "onboarding.draft_revised",
    payload: { runId, overrideKeys: Object.keys(overrides) },
  });
  return next;
};

const deactivatePriorPolicies = (orgId: string) => {
  db.update(policies).set({ active: false }).where(and(eq(policies.orgId, orgId), eq(policies.active, true))).run();
};

const ensureSubAccount = async (params: {
  runId: string;
  orgId: string;
  description: string;
  existingId: string | null;
}): Promise<string | null> => {
  if (params.existingId) return params.existingId;
  const run = getRun(params.runId);
  if (!run) return null;
  const org = db.select().from(orgs).where(eq(orgs.id, params.orgId)).all()[0];
  if (env.dryRun) {
    // Audit the intent, skip the call. Generate a deterministic placeholder id.
    const id = `dry_${params.description.replace(/\s+/g, "_").toLowerCase()}_${Math.floor(Math.random() * 100000)}`;
    appendAudit({
      orgId: params.orgId,
      actor: "agent",
      type: "action.sub_account_create",
      payload: { runId: params.runId, description: params.description, dry_run: true, id },
    });
    return id;
  }
  try {
    const resp = await createSubAccount(org?.bunqUserId ?? "mock", "mock_token", params.description);
    const id = resp.Response?.[0]?.Id?.id;
    if (!id) return null;
    appendAudit({
      orgId: params.orgId,
      actor: "agent",
      type: "action.sub_account_create",
      payload: { runId: params.runId, description: params.description, dry_run: false, id: String(id) },
    });
    return String(id);
  } catch (e) {
    appendAudit({
      orgId: params.orgId,
      actor: "agent",
      type: "action.sub_account_create.failed",
      payload: { runId: params.runId, description: params.description, error: (e as Error).message },
    });
    return null;
  }
};

export const approveAndFinalize = async (runId: string) => {
  const run = getRun(runId);
  if (!run) throw new Error("run not found");
  if (run.state !== "AWAITING_APPROVAL") throw new Error(`cannot approve in state ${run.state}`);
  const draftRaw = parseJson<unknown>(run.draftPolicy, null);
  if (!draftRaw) throw new Error("no draft policy to approve");
  const policy = policySchema.parse(draftRaw);

  updateRun(runId, { state: "FINALIZE" });
  appendAudit({ orgId: run.orgId, actor: "user", type: "onboarding.approved", payload: { runId } });

  // Write the policy + deactivate prior
  deactivatePriorPolicies(run.orgId);
  const policyId = `pol_${randomUUID()}`;
  db.insert(policies).values({ id: policyId, orgId: run.orgId, rules: JSON.stringify(policy), active: true }).run();
  appendAudit({
    orgId: run.orgId,
    actor: "agent",
    type: "policy.activated",
    payload: { policyId, runId },
  });

  // Ensure sub-accounts exist
  const org = db.select().from(orgs).where(eq(orgs.id, run.orgId)).all()[0];
  const reserveId = await ensureSubAccount({
    runId,
    orgId: run.orgId,
    description: "Carbo Reserve",
    existingId: org?.reserveAccountId ?? null,
  });
  const creditsId = await ensureSubAccount({
    runId,
    orgId: run.orgId,
    description: "Carbo Credits",
    existingId: org?.creditsAccountId ?? null,
  });
  if (reserveId || creditsId) {
    const updates: Record<string, string> = {};
    if (reserveId) updates.reserveAccountId = reserveId;
    if (creditsId) updates.creditsAccountId = creditsId;
    db.update(orgs).set(updates).where(eq(orgs.id, run.orgId)).run();
  }

  // Seed a first close if there are transactions for the current month.
  updateRun(runId, { state: "SEED_FIRST_CLOSE" });
  let seedCloseRunId: string | null = null;
  try {
    const d = new Date();
    const month = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
    const res = await startCloseRun(run.orgId, month);
    seedCloseRunId = res.id;
    appendAudit({
      orgId: run.orgId,
      actor: "agent",
      type: "onboarding.seed_close_done",
      payload: { runId, closeRunId: res.id, initialCo2eKg: res.initialCo2eKg },
    });
  } catch (e) {
    appendAudit({
      orgId: run.orgId,
      actor: "agent",
      type: "onboarding.seed_close_skipped",
      payload: { runId, reason: (e as Error).message },
    });
  }

  updateRun(runId, {
    state: "COMPLETED",
    status: "completed",
    seedCloseRunId,
    completedAt: nowSec(),
  });
  appendAudit({
    orgId: run.orgId,
    actor: "agent",
    type: "onboarding.completed",
    payload: { runId, policyId, reserveId, creditsId, seedCloseRunId },
  });

  return { state: "COMPLETED", policyId, reserveId, creditsId, seedCloseRunId };
};

export const cancelOnboarding = (runId: string) => {
  const run = getRun(runId);
  if (!run) throw new Error("run not found");
  if (run.status !== "active") return;
  updateRun(runId, { status: "abandoned", state: "ABANDONED" });
  appendAudit({ orgId: run.orgId, actor: "user", type: "onboarding.cancelled", payload: { runId } });
};

export { getQa as getOnboardingQuestions, getRun as getOnboardingRun, applyTrack };
