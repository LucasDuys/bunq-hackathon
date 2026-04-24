import { notFound } from "next/navigation";
import { OnboardingRunFlow, type OnboardingRunData } from "@/components/OnboardingFlow";
import { getOnboardingQuestions, getOnboardingRun } from "@/lib/agent/onboarding";
import { getOrg } from "@/lib/queries";
import type { CompanyProfile } from "@/lib/onboarding/profile";
import type { ParserGap, ParserUnsupported } from "@/lib/onboarding/types";
import type { Policy } from "@/lib/policy/schema";

export const dynamic = "force-dynamic";

const parseJson = <T,>(raw: string | null, fallback: T): T => {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
};

export default async function OnboardingRunPage({ params }: { params: Promise<{ runId: string }> }) {
  const { runId } = await params;
  const run = getOnboardingRun(runId);
  if (!run) notFound();

  const org = getOrg(run.orgId);
  const qa = getOnboardingQuestions(runId);

  const profile = parseJson<CompanyProfile>(run.profile, {});
  const gaps = parseJson<ParserGap[]>(run.gapList, []);
  const unsupported = parseJson<ParserUnsupported[]>(run.unsupportedList, []);
  const draft = parseJson<Policy | null>(run.draftPolicy, null);
  const creditShortlist = parseJson<string[]>(run.creditShortlist, []);

  const pending = qa.find((q) => !q.answer) ?? null;
  const answered = qa.filter((q) => q.answer);

  const data: OnboardingRunData = {
    runId,
    orgName: org?.name ?? run.orgId,
    state: run.state,
    track: run.track as OnboardingRunData["track"],
    questionCount: run.questionCount,
    profile,
    gaps,
    unsupported,
    draft,
    draftMarkdown: run.draftMarkdown ?? "",
    creditShortlist,
    calibrationNotes: run.calibrationNotes,
    seedCloseRunId: run.seedCloseRunId,
    pendingQa: pending
      ? {
          id: pending.id,
          question: pending.question,
          rationale: pending.rationale,
          kind: pending.kind as "multiple_choice" | "free_text" | "numeric" | "confirm",
          options: pending.options ? (JSON.parse(pending.options) as string[]) : null,
          required: pending.required,
        }
      : null,
    answeredQa: answered.map((q) => ({ id: q.id, question: q.question, answer: q.answer ?? "" })),
  };

  return <OnboardingRunFlow data={data} />;
}
