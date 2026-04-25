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
  SectionDivider,
  Stat,
} from "@/components/ui";
import { ApproveButton, QuestionCard } from "@/components/CloseActions";
import { CloseChatStream } from "@/components/CloseChatStream";
import { CloseDagFlow } from "@/components/CloseDagFlow";
import { CloseDagPanel } from "@/components/CloseDagPanel";
import { RerunCloseButton } from "@/components/RerunCloseButton";
import { ExplainButton } from "@/components/ExplainButton";
import { fmtEur, fmtKg } from "@/lib/utils";
import {
  DEFAULT_ORG_ID,
  getAuditForRun,
  getCloseRun,
  getQuestionsForRun,
} from "@/lib/queries";
import { verifyChain } from "@/lib/audit/append";
import {
  getAgentMessagesForRun,
  getDagResultByRunId,
} from "@/lib/impacts/store";
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
  // T012 — DAG_RUNNING replaces QUESTIONS_GENERATED; both map to the
  // CLUSTER phase visually since they're the same "agent thinking" beat.
  DAG_RUNNING: "CLUSTER",
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

const phaseHeadline = (
  phase: PhaseKey,
  state: string,
  unanswered: number,
  approved: boolean,
): string => {
  if (approved) return "Reserve transferred.";
  if (state === "DAG_RUNNING") return "Running the 8-agent DAG…";
  switch (phase) {
    case "INGEST":
      return "Ingesting transactions…";
    case "CLASSIFY":
      return "Matching merchants…";
    case "ESTIMATE":
      return state === "ESTIMATE_FINAL"
        ? "Refining the estimate…"
        : "Estimating emissions…";
    case "CLUSTER":
      return unanswered > 0
        ? `${unanswered} question${unanswered === 1 ? "" : "s"} for you.`
        : "Clustering uncertainty…";
    case "READY":
      return state === "EXECUTING"
        ? "Transferring to reserve…"
        : "Ready to approve.";
    case "APPROVED":
      return "Reserve transferred.";
  }
};

const phaseSub = (
  phase: PhaseKey,
  state: string,
  unanswered: number,
  approved: boolean,
): string => {
  if (approved) return "Loop closed for this month.";
  if (state === "DAG_RUNNING")
    return "Baseline → research → green/cost proposals → judges → credit strategy → executive report.";
  switch (phase) {
    case "INGEST":
      return "Pulling this month's bunq transactions into the run.";
    case "CLASSIFY":
      return "Mapping each merchant to a category and emission factor.";
    case "ESTIMATE":
      return state === "ESTIMATE_FINAL"
        ? "Re-running the estimate with your refinements."
        : "Computing tonnes from spend with confidence per row.";
    case "CLUSTER":
      return unanswered > 0
        ? "Answer to lift confidence on the most uncertain clusters."
        : "Grouping uncertain merchants for review.";
    case "READY":
      return state === "EXECUTING"
        ? "Moving funds to your bunq Carbon Reserve sub-account."
        : "Approve to transfer the reserve and route credits.";
    case "APPROVED":
      return "Loop closed for this month.";
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
  const headline = phaseHeadline(
    currentPhase,
    run.state,
    unansweredCount,
    run.approved,
  );
  const sub = phaseSub(currentPhase, run.state, unansweredCount, run.approved);
  const statusColor = phaseColor(currentPhase);

  const proposed = run.proposedActions
    ? (JSON.parse(run.proposedActions) as ProposedAction[])
    : null;

  // R008 / T012 — load the DAG payload + per-agent messages keyed off the run's
  // `dagRunId`. Both reads are cheap (one row + ~7-8 rows). Renders nothing when
  // the close hasn't reached DAG_RUNNING yet, or when the row is missing
  // (degraded mid-run state).
  const dagPayload = run.dagRunId ? getDagResultByRunId(run.dagRunId) : null;
  const dagMessages = run.dagRunId ? getAgentMessagesForRun(run.dagRunId) : [];

  const creditMix: CreditMixRow[] = run.creditRecommendation
    ? (JSON.parse(run.creditRecommendation) as CreditMixRow[])
    : [];
  const totalTonnes = creditMix.reduce((s, m) => s + m.tonnes, 0);
  const isApproved = run.approved;
  const isReady =
    currentPhaseIdx >= PHASES.findIndex((p) => p.key === "READY");
  const chain = isReady ? verifyChain(DEFAULT_ORG_ID) : null;

  const confidenceInitial = run.initialConfidence ?? 0;
  const confidenceFinal = run.finalConfidence ?? confidenceInitial;
  const confidenceDelta = confidenceFinal - confidenceInitial;
  const confidencePct = Math.round(confidenceFinal * 100);

  const finalKg = run.finalCo2eKg;
  const initialKg = run.initialCo2eKg;
  const displayKg = finalKg ?? initialKg ?? null;
  const deltaKg =
    finalKg != null && initialKg != null ? finalKg - initialKg : null;
  // ± range derived from (1 − confidence) applied to the chosen estimate
  const rangeKg =
    displayKg != null
      ? Math.max(0.1, displayKg * (1 - confidenceFinal))
      : null;

  // Sum of EUR transfers (defensive: today there's always exactly one)
  const reserveAmount =
    run.reserveEur ??
    (proposed
      ? proposed
          .filter((a): a is Extract<ProposedAction, { kind: "reserve_transfer" }> =>
            a.kind === "reserve_transfer",
          )
          .reduce((s, a) => s + a.amountEur, 0) || null
      : null);

  // Hydrate the live chat stream with whatever's already in the audit chain so
  // it renders on first paint with no flash. The client polls /events for new
  // ids after that.
  const initialEvents = audit.map((e) => {
    let payload: unknown = null;
    try {
      payload = JSON.parse(e.payload);
    } catch {
      payload = e.payload;
    }
    return {
      id: e.id,
      actor: e.actor as "agent" | "user" | "system" | "webhook",
      type: e.type,
      createdAt: e.createdAt,
      hash: e.hash,
      payload,
    };
  });
  const initialStream = {
    runId: id,
    state: run.state,
    status: run.status,
    month: run.month,
    initialCo2eKg: run.initialCo2eKg,
    finalCo2eKg: run.finalCo2eKg,
    initialConfidence: run.initialConfidence,
    finalConfidence: run.finalConfidence,
    reserveEur: run.reserveEur,
    approved: run.approved,
    events: initialEvents,
    questions: questions.map((q) => ({
      id: q.id,
      closeRunId: q.closeRunId,
      clusterId: q.clusterId,
      question: q.question,
      options: q.options,
      answer: q.answer,
      affectedTxIds: q.affectedTxIds,
    })),
  };

  return (
    <div className="relative z-[1] flex flex-col gap-12">
      {/* ─── Sticky 6-dot progress rail ─── */}
      <div
        className="close-rail-sticky -mx-6 px-6 py-4 backdrop-blur"
        style={{
          background: "var(--bg-translucent)",
          borderBottom: "1px solid var(--border-faint)",
        }}
      >
        <div className="flex items-center justify-between gap-6 max-w-[1200px] mx-auto">
          <div className="flex items-center gap-3 min-w-0">
            <CodeLabel>Monthly close · {run.month}</CodeLabel>
            <span
              aria-hidden="true"
              className="hidden sm:inline-block w-1 h-1 rounded-full shrink-0"
              style={{ background: "var(--border-strong)" }}
            />
            <span
              className="hidden sm:inline text-[12px]"
              style={{ color: "var(--fg-muted)" }}
            >
              {PHASES[currentPhaseIdx]?.label ?? "—"}
            </span>
          </div>

          <ol
            className="flex items-center gap-3 shrink-0"
            aria-label="Close progress"
          >
            {PHASES.map((p, i) => {
              const done = i < currentPhaseIdx || isApproved;
              const active = !isApproved && i === currentPhaseIdx;
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

      {/* ─── Hero status ─── */}
      <section className="flex flex-col gap-6">
        <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-6">
          <div className="flex flex-col gap-3 max-w-[640px]">
            <h1
              className="text-[36px] leading-[1.1] tracking-[-0.015em] m-0"
              style={{ color: "var(--fg-primary)" }}
            >
              {headline}
            </h1>
            <p
              className="text-[15px] leading-[1.5] m-0"
              style={{ color: "var(--fg-secondary)" }}
            >
              {sub}
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0 flex-wrap justify-end">
            <ExplainButton metric="close-summary" scope={{ runId: id }} />
            {!isApproved && proposed && unansweredCount === 0 && (
              <ApproveButton runId={id} amountEur={reserveAmount} />
            )}
            <RerunCloseButton month={run.month} size="sm" variant="ghost" />
            <Link href={`/report/${run.month}`}>
              <Button variant="ghost" size="sm" className="gap-1.5">
                <FileText className="h-3.5 w-3.5" aria-hidden="true" />
                Export CSRD
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* ─── Stat row — emissions, confidence, reserve ─── */}
      <section className="flex flex-col gap-6">
        <SectionDivider label="Results" />

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Emissions card spans 1; confidence inline */}
          <Card className="md:col-span-1">
            <CardBody className="flex flex-col gap-4">
              <Stat
                label="Estimated CO₂e"
                value={displayKg != null ? fmtKg(displayKg) : "—"}
                sub={
                  rangeKg != null
                    ? `± ${rangeKg.toFixed(1)} kg`
                    : "Pending estimate"
                }
              />
              {displayKg != null && (
                <ConfidenceBar value={confidenceFinal} animate />
              )}
            </CardBody>
          </Card>

          <Card>
            <CardBody className="flex flex-col gap-2">
              <Stat
                label="Confidence"
                value={displayKg != null ? `${confidencePct}%` : "—"}
                sub={
                  deltaKg != null && deltaKg !== 0
                    ? `${deltaKg >= 0 ? "+" : ""}${deltaKg.toFixed(1)} kg vs initial · ${confidenceDelta >= 0 ? "+" : ""}${Math.round(confidenceDelta * 100)} pts`
                    : confidenceDelta !== 0
                      ? `${confidenceDelta >= 0 ? "+" : ""}${Math.round(confidenceDelta * 100)} pts vs initial`
                      : unansweredCount > 0
                        ? "Refines after questions"
                        : "No refinement yet"
                }
                tone={
                  confidenceFinal >= 0.85
                    ? "positive"
                    : confidenceFinal >= 0.6
                      ? "warning"
                      : displayKg != null
                        ? "danger"
                        : "default"
                }
              />
            </CardBody>
          </Card>

          <Card>
            <CardBody>
              <Stat
                label="Reserve"
                value={reserveAmount != null ? fmtEur(reserveAmount, 0) : "—"}
                sub={
                  isApproved
                    ? "Transferred to Carbon Reserve"
                    : reserveAmount != null
                      ? unansweredCount > 0
                        ? "Pending answers"
                        : "Awaiting approval"
                      : "Not yet computed"
                }
                tone={isApproved ? "positive" : undefined}
              />
            </CardBody>
          </Card>
        </div>
      </section>

      {/* ─── 8-agent DAG flow — animated visual ─── */}
      {(run.state === "DAG_RUNNING" || dagPayload) && (
        <section className="flex flex-col gap-6">
          <SectionDivider label="DAG · agents" />
          <p
            className="text-[14px] leading-[1.5] m-0 max-w-[640px] -mt-2"
            style={{ color: "var(--fg-secondary)" }}
          >
            Six tiers run baseline → research → green/cost proposals (parallel) → green/cost
            judges (parallel) → credit strategy → executive report. Each box lights as its
            agent completes.
          </p>
          <CloseDagFlow
            startedAtUnix={run.startedAt}
            isRunning={run.state === "DAG_RUNNING"}
          />
        </section>
      )}

      {/* ─── Live agent transcript — Claude-Code style ─── */}
      <section className="flex flex-col gap-6">
        <SectionDivider label="Agent · live" />
        <p
          className="text-[14px] leading-[1.5] m-0 max-w-[640px] -mt-2"
          style={{ color: "var(--fg-secondary)" }}
        >
          Watch the close run end-to-end: every tool call, every refinement,
          every reserve transfer. Each line is hashed into the same audit chain
          your CSRD report cites.
        </p>
        <CloseChatStream runId={id} initial={initialStream} />
      </section>

      {/* ─── 8-agent DAG panel — structured output of the LLM panel ─── */}
      {dagPayload && (
        <section className="flex flex-col gap-6">
          <SectionDivider label={`DAG · ${dagPayload.runId.slice(0, 12)}…`} />
          <CloseDagPanel dag={dagPayload} messages={dagMessages} />
        </section>
      )}

      {/* ─── Questions (pending) ─── */}
      {questions.length > 0 && unansweredCount > 0 && (
        <section className="flex flex-col gap-6">
          <SectionDivider
            label={`Review · ${unansweredCount} of ${questions.length} open`}
          />
          <p
            className="text-[14px] leading-[1.5] m-0 max-w-[640px]"
            style={{ color: "var(--fg-secondary)" }}
          >
            Each answer locks a cluster's category and re-runs the estimate.
            Confidence updates live on the rail above.
          </p>
          <div className="flex flex-col gap-3">
            {questions
              .filter((q) => !q.answer)
              .map((q) => (
                <QuestionCard key={q.id} runId={id} question={q} />
              ))}
          </div>
        </section>
      )}

      {/* ─── Questions (answered) ─── */}
      {questions.length > 0 && unansweredCount === 0 && (
        <section className="flex flex-col gap-6">
          <SectionDivider label={`Refinements · ${questions.length} answered`} />
          <Card>
            <CardBody className="flex flex-col">
              {questions.map((q, i) => (
                <div
                  key={q.id}
                  className="flex items-start justify-between gap-6 py-3"
                  style={{
                    borderBottom:
                      i < questions.length - 1
                        ? "1px solid var(--border-faint)"
                        : "none",
                  }}
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
          <SectionDivider label="Proposal" />

          <Card>
            <CardHeader>
              <CardTitle>
                {isApproved ? "What you approved" : "Proposed actions"}
              </CardTitle>
              {!isApproved && unansweredCount === 0 && (
                <ApproveButton runId={id} amountEur={reserveAmount} />
              )}
              {!isApproved && unansweredCount > 0 && (
                <Badge tone="warning">
                  Answer {unansweredCount} question
                  {unansweredCount === 1 ? "" : "s"} to unlock
                </Badge>
              )}
              {isApproved && <Badge tone="positive">Executed</Badge>}
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
                    className="flex-1 min-w-0"
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
                    ) : a.kind === "tax_reserve_transfer" ? (
                      <>
                        Earmark{" "}
                        <span
                          className="tabular-nums"
                          style={{ color: "var(--fg-primary)" }}
                        >
                          {fmtEur(a.amountEur)}
                        </span>{" "}
                        to Tax Reserve
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
                    tone={
                      a.kind === "reserve_transfer"
                        ? "info"
                        : a.kind === "tax_reserve_transfer"
                          ? "positive"
                          : "default"
                    }
                  >
                    {a.kind.replace(/_/g, " ")}
                  </Badge>
                </div>
              ))}
            </CardBody>
          </Card>
        </section>
      )}

      {/* ─── Approved · credit mix + ledger ─── */}
      {isApproved && (
        <section className="flex flex-col gap-6">
          <SectionDivider label="Loop closed" />

          <Card className="ca-card--branded">
            <CardHeader>
              <div>
                <CodeLabel className="block mb-2">
                  Reserve · credits · ledger
                </CodeLabel>
                <CardTitle>Coverage routed for {run.month}</CardTitle>
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
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
                <Stat
                  label="Approved"
                  value={
                    run.approvedAt
                      ? new Date(run.approvedAt * 1000).toLocaleDateString(
                          "en-NL",
                          { day: "2-digit", month: "short", year: "numeric" },
                        )
                      : "—"
                  }
                  sub="Recorded in audit chain"
                  tone="positive"
                />
              </div>

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
                          aria-hidden="true"
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
                      <ArrowRight
                        className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5"
                        aria-hidden="true"
                      />
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
