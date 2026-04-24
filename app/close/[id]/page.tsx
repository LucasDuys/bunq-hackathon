import { notFound } from "next/navigation";
import { CheckCircle2, Circle, Clock } from "lucide-react";
import { Badge, Card, CardBody, CardHeader, CardTitle, ConfidenceBar, SectionDivider, Stat } from "@/components/ui";
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
    <div className="relative z-[1] flex flex-col gap-6">
      <div>
        <div className="text-[11px] uppercase tracking-[0.8px] font-semibold" style={{ color: "var(--text-mute)" }}>
          Monthly close · {run.month}
        </div>
        <h1 className="text-2xl font-semibold mt-1.5" style={{ color: "var(--text)" }}>
          Close run <span className="font-mono text-base" style={{ color: "var(--text-mute)" }}>{id.slice(0, 12)}…</span>
        </h1>
      </div>

      <SectionDivider />

      {/* Pipeline */}
      <Card>
        <CardHeader><CardTitle>Pipeline</CardTitle></CardHeader>
        <CardBody>
          <div className="grid grid-cols-4 md:grid-cols-6 gap-2">
            {STEPS.map((s, i) => {
              const done = i < stepIdx || run.state === "COMPLETED";
              const active = i === stepIdx && run.state !== "COMPLETED";
              return (
                <div
                  key={s.key}
                  className="rounded-xl px-3 py-2.5 transition-all"
                  style={{
                    background: active ? "rgba(48,192,111,0.08)" : done ? "var(--bg-card-2)" : "var(--bg-inset)",
                    border: `1px solid ${active ? "rgba(48,192,111,0.35)" : done ? "var(--border-strong)" : "var(--border-faint)"}`,
                  }}
                >
                  <div className="flex items-center gap-2 mb-1">
                    {done ? (
                      <div className="w-4 h-4 rounded-full grid place-items-center" style={{ background: "var(--green)" }}>
                        <CheckCircle2 className="h-2.5 w-2.5" style={{ color: "#0d3b23" }} />
                      </div>
                    ) : active ? (
                      <div className="w-4 h-4 rounded-full" style={{ border: "1.5px solid var(--green)", background: "rgba(48,192,111,0.15)", animation: "pulse-dot 1.4s infinite" }} />
                    ) : (
                      <Circle className="h-4 w-4" style={{ color: "var(--border-strong)" }} />
                    )}
                    <span className="text-[11px] font-semibold" style={{ color: done || active ? "var(--text)" : "var(--text-mute)" }}>
                      {s.label}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </CardBody>
      </Card>

      <SectionDivider label="Results" />

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card><CardBody><Stat label="Initial CO₂e" value={run.initialCo2eKg != null ? fmtKg(run.initialCo2eKg) : "—"} /></CardBody></Card>
        <Card><CardBody><Stat label="Final CO₂e" value={run.finalCo2eKg != null ? fmtKg(run.finalCo2eKg) : "—"} sub={run.finalCo2eKg != null && run.initialCo2eKg != null ? `${run.finalCo2eKg >= run.initialCo2eKg ? "+" : ""}${(run.finalCo2eKg - run.initialCo2eKg).toFixed(1)} kg refined` : undefined} /></CardBody></Card>
        <Card><CardBody className="space-y-2">
          <Stat
            label="Confidence"
            value={`${(confidenceFinal * 100).toFixed(0)}%`}
            sub={confidenceDelta !== 0 ? `${confidenceDelta >= 0 ? "+" : ""}${(confidenceDelta * 100).toFixed(0)} pts vs. initial` : undefined}
            tone={confidenceFinal > 0.85 ? "positive" : "warning"}
          />
          <ConfidenceBar value={confidenceFinal} animate />
        </CardBody></Card>
        <Card><CardBody><Stat label="Reserve" value={run.reserveEur != null ? fmtEur(run.reserveEur, 0) : "—"} sub={run.approved ? "Transferred" : run.reserveEur != null ? "Awaiting approval" : "Not yet computed"} tone={run.approved ? "positive" : undefined} /></CardBody></Card>
      </div>

      <SectionDivider label="Review" />

      {/* Unanswered questions */}
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

      {/* Answered questions */}
      {questions.length > 0 && questions.every((q) => q.answer) && (
        <Card>
          <CardHeader><CardTitle>Answered</CardTitle></CardHeader>
          <CardBody className="flex flex-col gap-2 text-sm">
            {questions.map((q) => (
              <div key={q.id} className="flex justify-between gap-4">
                <span style={{ color: "var(--text-dim)" }}>{q.question}</span>
                <Badge tone="positive">{q.answer}</Badge>
              </div>
            ))}
          </CardBody>
        </Card>
      )}

      {/* Proposed actions */}
      {proposed && (
        <Card>
          <CardHeader className="flex items-center justify-between">
            <CardTitle>Proposed actions</CardTitle>
            {run.state !== "COMPLETED" && <CloseActions.ApproveButton runId={id} />}
            {run.state === "COMPLETED" && <Badge tone="positive">Executed</Badge>}
          </CardHeader>
          <CardBody className="flex flex-col gap-2 text-sm">
            {proposed.map((a, i) => (
              <div key={i} className="flex items-center justify-between py-2.5" style={{ borderBottom: i < proposed.length - 1 ? "1px solid var(--border-faint)" : "none" }}>
                <div style={{ color: "var(--text-dim)" }}>
                  {a.kind === "reserve_transfer" ? (
                    <span>Transfer <span className="font-semibold" style={{ color: "var(--text)" }}>{fmtEur(a.amountEur)}</span> to Carbon Reserve — <span style={{ color: "var(--text-mute)" }}>{a.description}</span></span>
                  ) : (
                    <span>Purchase <span className="font-semibold" style={{ color: "var(--text)" }}>{a.tonnes.toFixed(3)} t</span> from <span className="font-mono">{a.projectId}</span> ({fmtEur(a.eur)})</span>
                  )}
                </div>
                <Badge tone={a.kind === "reserve_transfer" ? "info" : "default"}>{a.kind.replace(/_/g, " ")}</Badge>
              </div>
            ))}
          </CardBody>
        </Card>
      )}

      <SectionDivider label="Audit" />

      {/* Audit trail */}
      <Card>
        <CardHeader><CardTitle>Audit trail</CardTitle></CardHeader>
        <CardBody>
          <ol className="flex flex-col gap-1.5 text-xs font-mono">
            {audit.map((e) => (
              <li key={e.id} className="flex items-center gap-3">
                <span style={{ color: "var(--text-faint)" }}>{new Date(e.createdAt * 1000).toLocaleTimeString()}</span>
                <Badge tone={e.actor === "agent" ? "info" : e.actor === "user" ? "positive" : "default"}>{e.actor}</Badge>
                <span style={{ color: "var(--text)" }}>{e.type}</span>
                <span className="tabular-nums" style={{ color: "var(--text-faint)" }}>{e.hash.slice(0, 10)}</span>
              </li>
            ))}
          </ol>
        </CardBody>
      </Card>
    </div>
  );
}
