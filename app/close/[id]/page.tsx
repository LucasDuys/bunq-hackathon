import { notFound } from "next/navigation";
import { CheckCircle2, Circle, Clock } from "lucide-react";
import { Badge, Card, CardBody, CardHeader, CardTitle, ConfidenceBar, Stat } from "@/components/ui";
import { CloseActions } from "@/components/CloseActions";
import { fmtEur, fmtKg } from "@/lib/utils";
import { getAuditForRun, getCloseRun, getQuestionsForRun } from "@/lib/queries";
import type { ProposedAction } from "@/lib/agent/close";

export const dynamic = "force-dynamic";

const STEPS = [
  { key: "AGGREGATE", label: "Aggregate" },
  { key: "ESTIMATE_INITIAL", label: "Estimate (initial)" },
  { key: "CLUSTER_UNCERTAINTY", label: "Cluster uncertainty" },
  { key: "QUESTIONS_GENERATED", label: "Generate questions" },
  { key: "AWAITING_ANSWERS", label: "Awaiting answers" },
  { key: "APPLY_ANSWERS", label: "Apply answers" },
  { key: "ESTIMATE_FINAL", label: "Estimate (refined)" },
  { key: "APPLY_POLICY", label: "Apply policy" },
  { key: "PROPOSED", label: "Propose actions" },
  { key: "AWAITING_APPROVAL", label: "Awaiting approval" },
  { key: "EXECUTING", label: "Execute" },
  { key: "COMPLETED", label: "Completed" },
];

export default async function CloseRunPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const run = getCloseRun(id);
  if (!run) notFound();
  const questions = getQuestionsForRun(id);
  const audit = getAuditForRun(id);

  const stepIdx = STEPS.findIndex((s) => s.key === run.state);
  const proposed = run.proposedActions ? (JSON.parse(run.proposedActions) as ProposedAction[]) : null;

  const confidenceInitial = run.initialConfidence ?? 0;
  const confidenceFinal = run.finalConfidence ?? confidenceInitial;
  const confidenceDelta = confidenceFinal - confidenceInitial;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <div className="text-xs uppercase tracking-wide text-zinc-500">Monthly close · {run.month}</div>
        <h1 className="text-2xl font-semibold mt-1">Close run <span className="font-mono text-base text-zinc-500">{id.slice(0, 12)}…</span></h1>
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
                  <span className={done ? "text-zinc-900 dark:text-zinc-100" : active ? "text-amber-700 dark:text-amber-400 font-medium" : "text-zinc-400"}>{s.label}</span>
                </li>
              );
            })}
          </ol>
        </CardBody>
      </Card>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card><CardBody><Stat label="Initial CO₂e" value={run.initialCo2eKg != null ? fmtKg(run.initialCo2eKg) : "—"} /></CardBody></Card>
        <Card><CardBody><Stat label="Final CO₂e" value={run.finalCo2eKg != null ? fmtKg(run.finalCo2eKg) : "—"} sub={run.finalCo2eKg != null && run.initialCo2eKg != null ? `${run.finalCo2eKg >= run.initialCo2eKg ? "+" : ""}${(run.finalCo2eKg - run.initialCo2eKg).toFixed(1)} kg refined` : undefined} /></CardBody></Card>
        <Card><CardBody className="space-y-2">
          <Stat label="Confidence" value={`${(confidenceFinal * 100).toFixed(0)}%`} sub={confidenceDelta !== 0 ? `${confidenceDelta >= 0 ? "+" : ""}${(confidenceDelta * 100).toFixed(0)} pts vs. initial` : undefined} tone={confidenceFinal > 0.85 ? "positive" : "warning"} />
          <ConfidenceBar value={confidenceFinal} />
        </CardBody></Card>
        <Card><CardBody><Stat label="Reserve" value={run.reserveEur != null ? fmtEur(run.reserveEur, 0) : "—"} sub={run.approved ? "Transferred" : run.reserveEur != null ? "Awaiting approval" : "Not yet computed"} tone={run.approved ? "positive" : "default"} /></CardBody></Card>
      </div>

      {questions.length > 0 && questions.some((q) => !q.answer) && (
        <Card>
          <CardHeader><CardTitle>Refinement questions</CardTitle></CardHeader>
          <CardBody className="flex flex-col gap-4">
            {questions.map((q) => (
              <CloseActions.QuestionCard key={q.id} runId={id} question={q} />
            ))}
          </CardBody>
        </Card>
      )}

      {questions.length > 0 && questions.every((q) => q.answer) && (
        <Card>
          <CardHeader><CardTitle>Answered</CardTitle></CardHeader>
          <CardBody className="flex flex-col gap-2 text-sm">
            {questions.map((q) => (
              <div key={q.id} className="flex justify-between gap-4">
                <span className="text-zinc-600 dark:text-zinc-400">{q.question}</span>
                <Badge tone="positive">{q.answer}</Badge>
              </div>
            ))}
          </CardBody>
        </Card>
      )}

      {proposed && (
        <Card>
          <CardHeader className="flex items-center justify-between">
            <CardTitle>Proposed actions</CardTitle>
            {run.state !== "COMPLETED" && <CloseActions.ApproveButton runId={id} />}
            {run.state === "COMPLETED" && <Badge tone="positive">Executed</Badge>}
          </CardHeader>
          <CardBody className="flex flex-col gap-2 text-sm">
            {proposed.map((a, i) => (
              <div key={i} className="flex items-center justify-between border-b last:border-0 border-zinc-100 dark:border-zinc-900 py-2">
                <div>
                  {a.kind === "reserve_transfer" ? (
                    <span>Transfer <span className="font-semibold">{fmtEur(a.amountEur)}</span> to Carbon Reserve — <span className="text-zinc-500">{a.description}</span></span>
                  ) : (
                    <span>Purchase <span className="font-semibold">{a.tonnes.toFixed(3)} t</span> from <span className="font-mono">{a.projectId}</span> ({fmtEur(a.eur)})</span>
                  )}
                </div>
                <Badge tone={a.kind === "reserve_transfer" ? "info" : "default"}>{a.kind.replace(/_/g, " ")}</Badge>
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
          </ol>
        </CardBody>
      </Card>
    </div>
  );
}
