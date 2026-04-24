import Link from "next/link";
import { notFound } from "next/navigation";
import {
  AlertCircle,
  ArrowRight,
  Calculator,
  CheckCircle2,
  FileText,
  ShieldCheck,
  Tags,
  Zap,
} from "lucide-react";
import {
  Badge,
  Button,
  Card,
  CardBody,
  CardHeader,
  CardTitle,
  CodeLabel,
  ConfidenceBar,
  Stat,
} from "@/components/ui";
import { CloseActions } from "@/components/CloseActions";
import { fmtEur, fmtKg } from "@/lib/utils";
import {
  DEFAULT_ORG_ID,
  getAuditForRun,
  getCloseRun,
  getQuestionsForRun,
} from "@/lib/queries";
import { verifyChain } from "@/lib/audit/append";
import type { ProposedAction } from "@/lib/agent/close";

type CreditMixRow = {
  project: { id: string; name: string };
  tonnes: number;
  eur: number;
};

export const dynamic = "force-dynamic";

/**
 * Backend has 12 discrete close-run states; the UI collapses them into the
 * six canonical phases from DESIGN.md §4.10. Map is one-way and purely visual.
 */
const PHASES = [
  { key: "INGEST", label: "Ingest", icon: Zap },
  { key: "CLASSIFY", label: "Classify", icon: Tags },
  { key: "ESTIMATE", label: "Estimate", icon: Calculator },
  { key: "CLUSTER", label: "Cluster", icon: AlertCircle },
  { key: "READY", label: "Ready", icon: CheckCircle2 },
  { key: "APPROVED", label: "Approved", icon: ShieldCheck },
] as const;

type PhaseKey = (typeof PHASES)[number]["key"];

const STATE_TO_PHASE: Record<string, PhaseKey> = {
  AGGREGATE: "INGEST",
  ESTIMATE_INITIAL: "CLASSIFY",
  CLUSTER_UNCERTAINTY: "CLUSTER",
  QUESTIONS_GENERATED: "CLUSTER",
  AWAITING_ANSWERS: "CLUSTER",
  APPLY_ANSWERS: "ESTIMATE",
  ESTIMATE_FINAL: "ESTIMATE",
  APPLY_POLICY: "READY",
  PROPOSED: "READY",
  AWAITING_APPROVAL: "READY",
  EXECUTING: "READY",
  COMPLETED: "APPROVED",
};

const phaseColor = (phase: PhaseKey): string => {
  switch (phase) {
    case "INGEST":
      return "var(--fg-muted)";
    case "CLASSIFY":
    case "ESTIMATE":
      return "var(--fg-secondary)";
    case "CLUSTER":
      return "var(--status-warning)";
    case "READY":
      return "var(--brand-green)";
    case "APPROVED":
      return "var(--status-success)";
  }
};

const phaseCopy = (phase: PhaseKey, questionCount: number): string => {
  switch (phase) {
    case "INGEST":
      return "Ingesting transactions…";
    case "CLASSIFY":
      return "Matching merchants…";
    case "ESTIMATE":
      return "Estimating emissions…";
    case "CLUSTER":
      return questionCount > 0
        ? `${questionCount} questions for you.`
        : "Clustering uncertainty…";
    case "READY":
      return "Ready to approve.";
    case "APPROVED":
      return "Reserve transferred.";
  }
};

export default async function CloseRunPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const run = getCloseRun(id);
  if (!run) notFound();
  const questions = getQuestionsForRun(id);
  const audit = getAuditForRun(id);

  const currentPhase: PhaseKey = STATE_TO_PHASE[run.state] ?? "INGEST";
  const currentPhaseIdx = PHASES.findIndex((p) => p.key === currentPhase);
  const unansweredCount = questions.filter((q) => !q.answer).length;
  const statusLine = phaseCopy(currentPhase, unansweredCount);
  const statusColor = phaseColor(currentPhase);

  const proposed = run.proposedActions
    ? (JSON.parse(run.proposedActions) as ProposedAction[])
    : null;

  const creditMix: CreditMixRow[] = run.creditRecommendation
    ? (JSON.parse(run.creditRecommendation) as CreditMixRow[])
    : [];
  const totalTonnes = creditMix.reduce((s, m) => s + m.tonnes, 0);
  const showTerminalPanel =
    currentPhaseIdx >= PHASES.findIndex((p) => p.key === "READY");
  const chain = showTerminalPanel ? verifyChain(DEFAULT_ORG_ID) : null;

  const confidenceInitial = run.initialConfidence ?? 0;
  const confidenceFinal = run.finalConfidence ?? confidenceInitial;
  const confidenceDelta = confidenceFinal - confidenceInitial;

  const finalKg = run.finalCo2eKg;
  const initialKg = run.initialCo2eKg;
  const deltaKg =
    finalKg != null && initialKg != null ? finalKg - initialKg : null;
  // ± range derived from (1 − confidence) applied to the emissions figure
  const rangeKg =
    finalKg != null
      ? Math.max(0.1, finalKg * (1 - confidenceFinal))
      : initialKg != null
        ? Math.max(0.1, initialKg * (1 - confidenceInitial))
        : null;

  return (
    <div className="relative z-[1] flex flex-col gap-12">
      {/* ─── Sticky 6-dot progress rail ─── */}
      <div
        className="sticky top-[56px] z-10 -mx-6 px-6 py-5 backdrop-blur"
        style={{
          background: "var(--bg-translucent)",
          borderBottom: "1px solid var(--border-faint)",
        }}
      >
        <div className="flex items-center justify-between gap-6 max-w-[1200px] mx-auto">
          <div className="flex flex-col gap-2 min-w-0">
            <CodeLabel>Monthly close · {run.month}</CodeLabel>
            <div className="flex items-center gap-3 flex-wrap">
              <h1
                className="text-[24px] leading-[1.1] tracking-[-0.015em] m-0"
                style={{ color: "var(--fg-primary)" }}
              >
                {statusLine}
              </h1>
              <span
                className="font-mono text-[12px]"
                style={{ color: "var(--fg-faint)" }}
              >
                {id.slice(0, 12)}…
              </span>
              <Link href={`/report/${run.month}`} className="ml-1">
                <Button variant="ghost" size="sm" className="gap-1.5">
                  <FileText className="h-3.5 w-3.5" />
                  Export CSRD
                </Button>
              </Link>
            </div>
          </div>

          <ol
            className="flex items-center gap-3 shrink-0"
            aria-label="Close progress"
          >
            {PHASES.map((p, i) => {
              const done = i < currentPhaseIdx;
              const active = i === currentPhaseIdx;
              const dotStyle: React.CSSProperties = done
                ? {
                    background: "var(--brand-green)",
                    border: "1px solid var(--brand-green)",
                  }
                : active
                  ? {
                      background: statusColor,
                      border: `1px solid ${statusColor}`,
                      animation: "pulse-dot 1.5s ease-in-out infinite",
                    }
                  : {
                      background: "transparent",
                      border: "1px solid var(--border-default)",
                    };
              return (
                <li
                  key={p.key}
                  className="flex items-center gap-2"
                  aria-current={active ? "step" : undefined}
                >
                  <span
                    className="inline-block w-2.5 h-2.5 rounded-full"
                    style={dotStyle}
                    aria-label={`${p.label}${done ? " — complete" : active ? " — active" : " — pending"}`}
                  />
                  <span
                    className="hidden md:inline text-[12px]"
                    style={{
                      color: done || active
                        ? "var(--fg-primary)"
                        : "var(--fg-faint)",
                    }}
                  >
                    {p.label}
                  </span>
                </li>
              );
            })}
          </ol>
        </div>
      </div>

      {/* ─── Stat grid ─── */}
      <section className="flex flex-col gap-6">
        <div className="flex items-center gap-3">
          <CodeLabel>Results</CodeLabel>
          <div
            className="flex-1 h-px"
            style={{ background: "var(--border-faint)" }}
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardBody>
              <Stat
                label="Initial CO₂e"
                value={initialKg != null ? fmtKg(initialKg) : "—"}
                sub={
                  initialKg != null
                    ? `± ${(initialKg * (1 - confidenceInitial)).toFixed(1)} kg`
                    : undefined
                }
              />
            </CardBody>
          </Card>

          <Card>
            <CardBody className="flex flex-col gap-3">
              <Stat
                label="Final CO₂e"
                value={finalKg != null ? fmtKg(finalKg) : "—"}
                sub={
                  finalKg != null && rangeKg != null
                    ? `± ${rangeKg.toFixed(1)} kg${
                        deltaKg != null && deltaKg !== 0
                          ? ` · ${deltaKg >= 0 ? "+" : ""}${deltaKg.toFixed(1)} kg refined`
                          : ""
                      }`
                    : undefined
                }
              />
              {finalKg != null && (
                <ConfidenceBar value={confidenceFinal} animate />
              )}
            </CardBody>
          </Card>

          <Card>
            <CardBody className="flex flex-col gap-3">
              <Stat
                label="Confidence"
                value={`${Math.round(confidenceFinal * 100)}%`}
                sub={
                  confidenceDelta !== 0
                    ? `${confidenceDelta >= 0 ? "+" : ""}${Math.round(
                        confidenceDelta * 100,
                      )} pts vs. initial`
                    : "No refinement yet"
                }
                tone={
                  confidenceFinal >= 0.85
                    ? "positive"
                    : confidenceFinal >= 0.6
                      ? "warning"
                      : "danger"
                }
              />
              <ConfidenceBar value={confidenceFinal} animate />
            </CardBody>
          </Card>

          <Card>
            <CardBody>
              <Stat
                label="Reserve"
                value={run.reserveEur != null ? fmtEur(run.reserveEur, 0) : "—"}
                sub={
                  run.approved
                    ? "Transferred"
                    : run.reserveEur != null
                      ? "Awaiting approval"
                      : "Not yet computed"
                }
                tone={run.approved ? "positive" : undefined}
              />
            </CardBody>
          </Card>
        </div>
      </section>

      {/* ─── Questions (pending) ─── */}
      {questions.length > 0 && unansweredCount > 0 && (
        <section className="flex flex-col gap-6">
          <div className="flex items-center gap-3">
            <CodeLabel>
              Review · {unansweredCount} open
            </CodeLabel>
            <div
              className="flex-1 h-px"
              style={{ background: "var(--border-faint)" }}
            />
          </div>
          <div className="flex flex-col gap-3">
            {questions
              .filter((q) => !q.answer)
              .map((q) => (
                <CloseActions.QuestionCard key={q.id} runId={id} question={q} />
              ))}
          </div>
        </section>
      )}

      {/* ─── Questions (answered) ─── */}
      {questions.length > 0 && unansweredCount === 0 && (
        <section className="flex flex-col gap-6">
          <div className="flex items-center gap-3">
            <CodeLabel>Answered</CodeLabel>
            <div
              className="flex-1 h-px"
              style={{ background: "var(--border-faint)" }}
            />
          </div>
          <Card>
            <CardBody className="flex flex-col gap-3 text-sm">
              {questions.map((q) => (
                <div
                  key={q.id}
                  className="flex items-start justify-between gap-6 py-2"
                >
                  <span
                    className="text-[14px] leading-[1.5]"
                    style={{ color: "var(--fg-secondary)" }}
                  >
                    {q.question}
                  </span>
                  <Badge tone="positive">{q.answer}</Badge>
                </div>
              ))}
            </CardBody>
          </Card>
        </section>
      )}

      {/* ─── Proposed actions ─── */}
      {proposed && (
        <section className="flex flex-col gap-6">
          <div className="flex items-center gap-3">
            <CodeLabel>Proposal</CodeLabel>
            <div
              className="flex-1 h-px"
              style={{ background: "var(--border-faint)" }}
            />
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Proposed actions</CardTitle>
              {run.state !== "COMPLETED" && (
                <CloseActions.ApproveButton runId={id} />
              )}
              {run.state === "COMPLETED" && (
                <Badge tone="positive">Executed</Badge>
              )}
            </CardHeader>
            <CardBody className="flex flex-col">
              {proposed.map((a, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between gap-4 py-3 text-sm"
                  style={{
                    borderBottom:
                      i < proposed.length - 1
                        ? "1px solid var(--border-faint)"
                        : "none",
                  }}
                >
                  <div
                    className="flex-1"
                    style={{ color: "var(--fg-secondary)" }}
                  >
                    {a.kind === "reserve_transfer" ? (
                      <>
                        Transfer{" "}
                        <span
                          className="tabular-nums"
                          style={{ color: "var(--fg-primary)" }}
                        >
                          {fmtEur(a.amountEur)}
                        </span>{" "}
                        to Carbon Reserve
                        <span
                          className="ml-2"
                          style={{ color: "var(--fg-muted)" }}
                        >
                          — {a.description}
                        </span>
                      </>
                    ) : (
                      <>
                        Purchase{" "}
                        <span
                          className="tabular-nums"
                          style={{ color: "var(--fg-primary)" }}
                        >
                          {a.tonnes.toFixed(3)} t
                        </span>{" "}
                        from{" "}
                        <span className="font-mono">{a.projectId}</span>{" "}
                        <span style={{ color: "var(--fg-muted)" }}>
                          ({fmtEur(a.eur)})
                        </span>
                      </>
                    )}
                  </div>
                  <Badge
                    tone={a.kind === "reserve_transfer" ? "info" : "default"}
                  >
                    {a.kind.replace(/_/g, " ")}
                  </Badge>
                </div>
              ))}
            </CardBody>
          </Card>
        </section>
      )}

      {/* ─── Audit trail ─── */}
      <section className="flex flex-col gap-6">
        <div className="flex items-center gap-3">
          <CodeLabel>Audit trail</CodeLabel>
          <div
            className="flex-1 h-px"
            style={{ background: "var(--border-faint)" }}
          />
        </div>

        <Card>
          <CardBody>
            <ol className="flex flex-col gap-2 text-[12px] font-mono">
              {audit.map((e) => (
                <li
                  key={e.id}
                  className="flex items-center gap-3 py-1.5"
                  style={{
                    borderBottom: "1px solid var(--border-faint)",
                  }}
                >
                  <span
                    className="tabular-nums shrink-0"
                    style={{ color: "var(--fg-faint)" }}
                  >
                    {new Date(e.createdAt * 1000).toLocaleTimeString()}
                  </span>
                  <Badge
                    tone={
                      e.actor === "agent"
                        ? "info"
                        : e.actor === "user"
                          ? "positive"
                          : "default"
                    }
                  >
                    {e.actor}
                  </Badge>
                  <span
                    className="flex-1 truncate"
                    style={{ color: "var(--fg-primary)" }}
                  >
                    {e.type}
                  </span>
                  <span
                    className="tabular-nums shrink-0"
                    style={{ color: "var(--fg-faint)" }}
                  >
                    {e.hash.slice(0, 10)}
                  </span>
                </li>
              ))}
            </ol>
          </CardBody>
        </Card>
      </section>

      {/* ─── Terminal panel — reserve + credits + audit chain ─── */}
      {showTerminalPanel && (
        <section className="flex flex-col gap-6">
          <div className="flex items-center gap-3">
            <CodeLabel>Loop closed</CodeLabel>
            <div className="flex-1 h-px" style={{ background: "var(--border-faint)" }} />
          </div>

          <Card>
            <CardHeader>
              <div>
                <CodeLabel className="block mb-2">Reserve · credits · ledger</CodeLabel>
                <CardTitle>What happens after approval</CardTitle>
              </div>
              {chain && (
                <Link href="/ledger" className="shrink-0">
                  <Badge tone={chain.valid ? "positive" : "danger"}>
                    {chain.valid
                      ? `Audit chain · verified${chain.count != null ? ` · ${chain.count}` : ""}`
                      : `Audit chain · broken at id=${chain.brokenAtId}`}
                  </Badge>
                </Link>
              )}
            </CardHeader>
            <CardBody className="flex flex-col gap-6">
              {/* Stats */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Stat
                  label="Reserve"
                  value={run.reserveEur != null ? fmtEur(run.reserveEur, 0) : "—"}
                  sub={
                    run.approved
                      ? "Transferred"
                      : run.reserveEur != null
                        ? "Awaiting approval"
                        : "Not yet computed"
                  }
                  tone={run.approved ? "positive" : undefined}
                />
                <Stat
                  label="Top credit project"
                  value={creditMix[0]?.project.name ?? "—"}
                  sub={
                    creditMix[0]
                      ? `${creditMix[0].tonnes.toFixed(2)} t · ${fmtEur(creditMix[0].eur, 0)}`
                      : "Pending recommendation"
                  }
                />
                <Stat
                  label="Projected coverage"
                  value={totalTonnes > 0 ? `${totalTonnes.toFixed(2)} t` : "—"}
                  sub={
                    creditMix.length > 0
                      ? `${creditMix.length} EU project${creditMix.length === 1 ? "" : "s"}`
                      : undefined
                  }
                />
              </div>

              {/* Mini credit-mix list */}
              {creditMix.length > 0 && (
                <div
                  className="rounded-[8px]"
                  style={{ border: "1px solid var(--border-faint)" }}
                >
                  <div
                    className="grid grid-cols-[1fr_auto_auto] gap-x-6 px-4 py-2.5"
                    style={{ borderBottom: "1px solid var(--border-faint)" }}
                  >
                    <CodeLabel>Project</CodeLabel>
                    <CodeLabel className="text-right">Tonnes</CodeLabel>
                    <CodeLabel className="text-right">Allocation</CodeLabel>
                  </div>
                  {creditMix.slice(0, 3).map((m, i) => (
                    <div
                      key={m.project.id}
                      className="grid grid-cols-[1fr_auto_auto] gap-x-6 px-4 py-2.5 items-center"
                      style={{
                        borderBottom:
                          i < Math.min(creditMix.length, 3) - 1
                            ? "1px solid var(--border-faint)"
                            : "none",
                      }}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span
                          className="w-[6px] h-[6px] rounded-full shrink-0"
                          style={{ background: "var(--brand-green)" }}
                        />
                        <span
                          className="text-[13px] truncate"
                          style={{ color: "var(--fg-primary)" }}
                        >
                          {m.project.name}
                        </span>
                      </div>
                      <span
                        className="text-[13px] tabular-nums text-right"
                        style={{ color: "var(--fg-secondary)" }}
                      >
                        {m.tonnes.toFixed(2)} t
                      </span>
                      <span
                        className="text-[13px] tabular-nums text-right w-[100px]"
                        style={{ color: "var(--fg-primary)" }}
                      >
                        {fmtEur(m.eur, 0)}
                      </span>
                    </div>
                  ))}
                  {creditMix.length > 3 && (
                    <Link
                      href="/reserve"
                      className="flex items-center justify-between px-4 py-2.5 text-[12px] group"
                      style={{
                        borderTop: "1px solid var(--border-faint)",
                        color: "var(--fg-muted)",
                      }}
                    >
                      <span>+{creditMix.length - 3} more in catalogue</span>
                      <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
                    </Link>
                  )}
                </div>
              )}
            </CardBody>
          </Card>
        </section>
      )}
    </div>
  );
}
