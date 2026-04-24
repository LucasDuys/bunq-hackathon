import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight, CheckCircle2, Circle, Clock, FileText } from "lucide-react";
import { Badge, Card, CardBody, CardHeader, CardTitle, Stat } from "@/components/ui";
import {
  OnboardingAnswerForm,
  OnboardingApprove,
  OnboardingDraftPreview,
  OnboardingResetLink,
  OnboardingUploadDrop,
} from "@/components/OnboardingClient";
import { getOnboardingQuestions, getOnboardingRun } from "@/lib/agent/onboarding";
import { getAllAudit, getOrg } from "@/lib/queries";
import { labelFor, type CompanyProfile } from "@/lib/onboarding/profile";
import type { ParserGap, ParserUnsupported } from "@/lib/onboarding/types";
import type { Policy } from "@/lib/policy/schema";
import { CREDIT_PROJECTS } from "@/lib/credits/projects";

export const dynamic = "force-dynamic";

const STEPS: Array<{ key: string; label: string }> = [
  { key: "INIT", label: "Start" },
  { key: "UPLOAD_PARSING", label: "Parse upload" },
  { key: "UPLOAD_MAPPED", label: "Map to schema" },
  { key: "PROFILE_COLLECT", label: "Interview" },
  { key: "AWAITING_ANSWER", label: "Awaiting answer" },
  { key: "DRAFT_POLICY", label: "Draft policy" },
  { key: "AWAITING_APPROVAL", label: "Review" },
  { key: "FINALIZE", label: "Activate policy" },
  { key: "SEED_FIRST_CLOSE", label: "Seed first close" },
  { key: "COMPLETED", label: "Completed" },
];

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
  const audit = getAllAudit(run.orgId, 100).filter((e) => {
    const p = e.payload ? JSON.parse(e.payload) : null;
    return p && typeof p === "object" && "runId" in p && (p as { runId: string }).runId === runId;
  });

  const stepIdx = STEPS.findIndex((s) => s.key === run.state);
  const profile = parseJson<CompanyProfile>(run.profile, {});
  const gaps = parseJson<ParserGap[]>(run.gapList, []);
  const unsupported = parseJson<ParserUnsupported[]>(run.unsupportedList, []);
  const draft = parseJson<Policy | null>(run.draftPolicy, null);
  const creditShortlist = parseJson<string[]>(run.creditShortlist, []);

  const pendingQa = qa.find((q) => !q.answer);
  const answeredQa = qa.filter((q) => q.answer);
  const isCompleted = run.state === "COMPLETED";
  const isAwaitingApproval = run.state === "AWAITING_APPROVAL";
  const needsUpload = run.state === "INIT" && (run.track === "upload" || run.track === "mix");

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-xs uppercase tracking-wide text-zinc-500">Onboarding · {run.track}</div>
          <h1 className="text-2xl font-semibold mt-1">
            {isCompleted ? "Carbo is live" : "Let&apos;s get Carbo set up"}
          </h1>
          <p className="text-sm text-zinc-500 mt-1">
            Run <span className="font-mono text-xs">{runId.slice(0, 16)}…</span> for {org?.name ?? run.orgId}.
          </p>
        </div>
        {!isCompleted && <OnboardingResetLink runId={runId} />}
      </div>

      <Card>
        <CardHeader><CardTitle>Pipeline</CardTitle></CardHeader>
        <CardBody>
          <ol className="flex flex-wrap gap-x-4 gap-y-2 text-sm">
            {STEPS.map((s, i) => {
              const done = i < stepIdx || run.state === "COMPLETED";
              const active = i === stepIdx && run.state !== "COMPLETED";
              return (
                <li key={s.key} className="flex items-center gap-1.5">
                  {done ? <CheckCircle2 className="h-4 w-4 text-emerald-600" /> : active ? <Clock className="h-4 w-4 text-amber-600 animate-pulse" /> : <Circle className="h-4 w-4 text-zinc-300" />}
                  <span className={done ? "text-zinc-900 dark:text-zinc-100" : active ? "text-amber-700 dark:text-amber-400 font-medium" : "text-zinc-400"}>
                    {s.label}
                  </span>
                </li>
              );
            })}
          </ol>
        </CardBody>
      </Card>

      {needsUpload && (
        <Card>
          <CardHeader>
            <CardTitle>Upload your existing policy</CardTitle>
          </CardHeader>
          <CardBody className="space-y-3">
            <p className="text-sm text-zinc-600 dark:text-zinc-400">
              Drop a PDF, DOCX, Markdown, YAML, or JSON file. Max 5 MB. We&apos;ll parse it, map it to Carbo&apos;s schema, and ask only what&apos;s missing.
            </p>
            <OnboardingUploadDrop runId={runId} />
          </CardBody>
        </Card>
      )}

      {unsupported.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Heads up from your upload</CardTitle>
          </CardHeader>
          <CardBody className="flex flex-col gap-2 text-sm">
            {unsupported.map((u, i) => (
              <div key={i} className="flex items-start gap-2">
                <Badge tone={u.severity === "error" ? "warning" : "default"}>{u.severity}</Badge>
                <div>
                  <div className="font-medium">{u.found}</div>
                  <div className="text-zinc-500 text-xs">{u.note}</div>
                </div>
              </div>
            ))}
          </CardBody>
        </Card>
      )}

      {pendingQa && !isCompleted && (
        <Card>
          <CardHeader className="flex items-center justify-between">
            <CardTitle>Question {run.questionCount} of up to 12</CardTitle>
            <Badge tone="info">{pendingQa.kind.replace(/_/g, " ")}</Badge>
          </CardHeader>
          <CardBody className="space-y-4">
            <div>
              <div className="text-base font-medium">{pendingQa.question}</div>
              {pendingQa.rationale && <div className="text-xs text-zinc-500 mt-1.5">{pendingQa.rationale}</div>}
            </div>
            <OnboardingAnswerForm
              runId={runId}
              qaId={pendingQa.id}
              kind={pendingQa.kind as "multiple_choice" | "free_text" | "numeric" | "confirm"}
              options={pendingQa.options ? (JSON.parse(pendingQa.options) as string[]) : undefined}
              required={pendingQa.required}
            />
          </CardBody>
        </Card>
      )}

      {answeredQa.length > 0 && (
        <Card>
          <CardHeader><CardTitle>Your answers so far</CardTitle></CardHeader>
          <CardBody className="flex flex-col gap-2 text-sm">
            {answeredQa.map((q) => (
              <div key={q.id} className="flex justify-between gap-4 border-b last:border-0 border-zinc-100 dark:border-zinc-900 py-1.5">
                <span className="text-zinc-600 dark:text-zinc-400">{q.question}</span>
                <Badge tone={q.answer === "(skipped)" ? "default" : "positive"}>{q.answer}</Badge>
              </div>
            ))}
          </CardBody>
        </Card>
      )}

      {gaps.length > 0 && !pendingQa && !isCompleted && (
        <Card>
          <CardHeader><CardTitle>Still missing from your document</CardTitle></CardHeader>
          <CardBody className="text-sm text-zinc-600 dark:text-zinc-400">
            <ul className="list-disc list-inside space-y-1">
              {gaps.map((g, i) => (
                <li key={i}><span className="font-mono text-xs">{g.field}</span> — {g.reason}</li>
              ))}
            </ul>
          </CardBody>
        </Card>
      )}

      {isAwaitingApproval && draft && (
        <Card>
          <CardHeader className="flex items-center justify-between">
            <CardTitle>Draft policy — review &amp; approve</CardTitle>
            <Badge tone="info">Draft</Badge>
          </CardHeader>
          <CardBody className="space-y-5">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Stat label="Reserve rules" value={String(draft.reserveRules.length)} />
              <Stat label="Approval ≥" value={`€${draft.approvalThresholdEur.toLocaleString("en-NL")}`} />
              <Stat label="Monthly cap" value={`€${draft.maxReservePerMonthEur.toLocaleString("en-NL")}`} />
              <Stat label="Removal share" value={`${Math.round(draft.creditPreference.minRemovalPct * 100)}%`} tone="positive" />
            </div>

            <OnboardingDraftPreview runId={runId} draft={draft} markdown={run.draftMarkdown ?? ""} />

            {creditShortlist.length > 0 && (
              <div className="rounded-md border border-zinc-200 dark:border-zinc-800 p-4">
                <div className="text-xs uppercase tracking-wide text-zinc-500 mb-2">Initial credit shortlist</div>
                <ul className="space-y-1.5 text-sm">
                  {creditShortlist.map((id) => {
                    const p = CREDIT_PROJECTS.find((pp) => pp.id === id);
                    if (!p) return <li key={id} className="font-mono text-xs">{id}</li>;
                    return (
                      <li key={id} className="flex items-center justify-between">
                        <span>{p.name} · <span className="text-zinc-500">{p.country}</span></span>
                        <Badge tone="default">€{p.pricePerTonneEur}/t</Badge>
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}

            {run.calibrationNotes && (
              <div className="rounded-md bg-zinc-50 dark:bg-zinc-900/50 p-4 text-sm text-zinc-600 dark:text-zinc-400">
                <div className="flex items-center gap-1.5 text-xs uppercase tracking-wide text-zinc-500 mb-1.5">
                  <FileText className="h-3.5 w-3.5" /> Calibration notes
                </div>
                {run.calibrationNotes}
              </div>
            )}

            <div className="flex items-center justify-between pt-2">
              <div className="text-xs text-zinc-500">
                Approving writes this policy to the database (deactivating any prior), creates Carbo Reserve + Credits sub-accounts, and seeds a first close for the current month.
              </div>
              <OnboardingApprove runId={runId} />
            </div>
          </CardBody>
        </Card>
      )}

      {isCompleted && (
        <Card>
          <CardHeader className="flex items-center justify-between">
            <CardTitle>You&apos;re all set</CardTitle>
            <Badge tone="positive">Policy active</Badge>
          </CardHeader>
          <CardBody className="space-y-3 text-sm">
            <p>
              Your Carbo policy is now live. {run.seedCloseRunId ? "We also seeded a first monthly close so you have data on the dashboard right away." : "Once transactions arrive, the first close will run automatically at month-end."}
            </p>
            <div className="flex items-center gap-3">
              <Link href="/" className="inline-flex items-center gap-1 text-emerald-700 dark:text-emerald-400 hover:underline">
                Open dashboard <ArrowRight className="h-3.5 w-3.5" />
              </Link>
              {run.seedCloseRunId && (
                <Link href={`/close/${run.seedCloseRunId}`} className="inline-flex items-center gap-1 text-emerald-700 dark:text-emerald-400 hover:underline">
                  View first close run <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              )}
            </div>
          </CardBody>
        </Card>
      )}

      {Object.keys(profile).length > 0 && (
        <Card>
          <CardHeader><CardTitle>What we&apos;ve learned about you</CardTitle></CardHeader>
          <CardBody className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm">
            {Object.entries(profile).map(([k, v]) => (
              <div key={k} className="flex flex-col">
                <span className="text-xs uppercase tracking-wide text-zinc-500">{k}</span>
                <span className="text-zinc-900 dark:text-zinc-50">{labelFor(k, typeof v === "string" ? v : String(v))}</span>
              </div>
            ))}
          </CardBody>
        </Card>
      )}

      <Card>
        <CardHeader><CardTitle>Audit trail</CardTitle></CardHeader>
        <CardBody>
          <ol className="flex flex-col gap-1.5 text-xs font-mono">
            {audit.map((e) => (
              <li key={e.id} className="flex items-center gap-3">
                <span className="text-zinc-400">{new Date(e.createdAt * 1000).toLocaleTimeString()}</span>
                <Badge tone={e.actor === "agent" ? "info" : e.actor === "user" ? "positive" : "default"}>{e.actor}</Badge>
                <span className="text-zinc-800 dark:text-zinc-200">{e.type}</span>
                <span className="text-zinc-400 truncate">{e.hash.slice(0, 10)}</span>
              </li>
            ))}
            {audit.length === 0 && <li className="text-zinc-400">No events yet.</li>}
          </ol>
        </CardBody>
      </Card>
    </div>
  );
}
