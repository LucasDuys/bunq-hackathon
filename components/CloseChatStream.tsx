"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useRouter } from "next/navigation";
import {
  ArrowDown,
  Banknote,
  Calculator,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  ClipboardCheck,
  Coins,
  Copy,
  HelpCircle,
  Search,
  Sparkles,
  Wallet,
} from "lucide-react";

type NarratePhase =
  | "INGEST"
  | "CLASSIFY"
  | "ESTIMATE"
  | "CLUSTER"
  | "REFINE"
  | "POLICY"
  | "PROPOSE"
  | "EXECUTE"
  | "COMPLETE";
type NarrateRole =
  | "thinking"
  | "tool_call"
  | "tool_result"
  | "summary"
  | "error";

type NarratePayload = {
  phase: NarratePhase;
  role: NarrateRole;
  title: string;
  body?: string;
  meta?: Record<string, unknown>;
  tool?: string;
};

type EventRow = {
  id: number;
  actor: "agent" | "user" | "system" | "webhook";
  type: string;
  createdAt: number;
  hash: string;
  payload: unknown;
};

type QuestionRow = {
  id: number;
  closeRunId: string;
  clusterId: string;
  question: string;
  options: string;
  answer: string | null;
  affectedTxIds?: string;
};

type EventsResponse = {
  runId: string;
  state: string;
  status: string;
  month: string;
  initialCo2eKg: number | null;
  finalCo2eKg: number | null;
  initialConfidence: number | null;
  finalConfidence: number | null;
  reserveEur: number | null;
  approved: boolean;
  events: EventRow[];
  questions: QuestionRow[];
};

type StepStatus = "pending" | "active" | "done" | "waiting" | "error";

type PhaseDef = {
  key: NarratePhase;
  label: string;
  lede: string;
  icon: typeof Wallet;
  optional?: boolean;
};

// User-facing phase order. CLASSIFY isn't narrated separately — it folds into INGEST.
const PHASE_ORDER: PhaseDef[] = [
  {
    key: "INGEST",
    label: "Reading your transactions",
    lede: "Pulling every booked transaction from your bunq journal for the month.",
    icon: Wallet,
  },
  {
    key: "ESTIMATE",
    label: "Estimating CO₂e",
    lede: "Pricing each merchant against EU emission factors with confidence on every row.",
    icon: Calculator,
  },
  {
    key: "CLUSTER",
    label: "Looking for unusual spend",
    lede: "Grouping merchants and flagging the ones that move the total most for review.",
    icon: Search,
  },
  {
    key: "REFINE",
    label: "Locking in your answers",
    lede: "Reclassifying the flagged clusters from your answers and updating the merchant cache.",
    icon: Sparkles,
    optional: true,
  },
  {
    key: "POLICY",
    label: "Pricing the impact",
    lede: "Applying your reserve policy to turn tonnes into euros owed.",
    icon: Coins,
  },
  {
    key: "PROPOSE",
    label: "Building your reserve plan",
    lede: "Picking an EU-registered credit mix and a single reserve transfer.",
    icon: ClipboardCheck,
  },
  {
    key: "EXECUTE",
    label: "Moving funds & credits",
    lede: "Sending the reserve to your bunq sub-account and reserving carbon credits.",
    icon: Banknote,
  },
  {
    key: "COMPLETE",
    label: "All done",
    lede: "Loop closed — the run is reproducible from the audit ledger.",
    icon: CheckCircle2,
  },
];

const STATE_TO_PHASE: Record<string, NarratePhase> = {
  AGGREGATE: "INGEST",
  ESTIMATE_INITIAL: "ESTIMATE",
  CLUSTER_UNCERTAINTY: "CLUSTER",
  QUESTIONS_GENERATED: "CLUSTER",
  AWAITING_ANSWERS: "CLUSTER",
  APPLY_ANSWERS: "REFINE",
  ESTIMATE_FINAL: "ESTIMATE",
  APPLY_POLICY: "POLICY",
  PROPOSED: "PROPOSE",
  AWAITING_APPROVAL: "PROPOSE",
  EXECUTING: "EXECUTE",
  COMPLETED: "COMPLETE",
};

const isNarrate = (
  e: EventRow,
): e is EventRow & { payload: NarratePayload } => {
  if (e.type !== "agent.narrate") return false;
  const p = e.payload;
  return (
    typeof p === "object" &&
    p !== null &&
    typeof (p as { phase?: unknown }).phase === "string" &&
    typeof (p as { role?: unknown }).role === "string" &&
    typeof (p as { title?: unknown }).title === "string"
  );
};

const isLiveStatus = (status: string, state: string) =>
  status === "active" &&
  state !== "AWAITING_ANSWERS" &&
  state !== "AWAITING_APPROVAL" &&
  state !== "FAILED" &&
  state !== "COMPLETED";

const formatHM = (unix: number) => {
  const d = new Date(unix * 1000);
  return `${String(d.getHours()).padStart(2, "0")}:${String(
    d.getMinutes(),
  ).padStart(2, "0")}`;
};

const formatHMS = (unix: number) => {
  const d = new Date(unix * 1000);
  return `${String(d.getHours()).padStart(2, "0")}:${String(
    d.getMinutes(),
  ).padStart(2, "0")}:${String(d.getSeconds()).padStart(2, "0")}`;
};

const formatJson = (value: unknown): string => {
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
};

const copyText = async (text: string) => {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    // Older browsers / iframes — silent fail.
  }
};

// Hide pure-plumbing tool calls from the friendly view. Auditors still see
// them in dev view and the audit ledger.
const isFriendlyEntry = (p: NarratePayload): boolean => {
  if (p.role !== "tool_call") return true;
  const tool = p.tool ?? "";
  return tool !== "sqlite" && !tool.startsWith("claude-");
};

const StatusPill = ({ status }: { status: StepStatus }) => {
  if (status === "pending") return null;
  if (status === "active") {
    return (
      <span className="cs-status-pill cs-status-pill--working">
        <span className="cs-typing" aria-hidden="true">
          <span />
          <span />
          <span />
        </span>
        Working
      </span>
    );
  }
  if (status === "done") {
    return (
      <span className="cs-status-pill cs-status-pill--done">
        <CheckCircle2 className="h-3 w-3" aria-hidden="true" />
        Done
      </span>
    );
  }
  if (status === "waiting") {
    return (
      <span className="cs-status-pill cs-status-pill--waiting">
        <HelpCircle className="h-3 w-3" aria-hidden="true" />
        Awaiting you
      </span>
    );
  }
  return (
    <span className="cs-status-pill cs-status-pill--error">Failed</span>
  );
};

type Chip = { label: string; value: string };

const formatNum = (n: number, opts: { unit?: string; fraction?: number } = {}): string => {
  const fraction = opts.fraction ?? 0;
  const formatter = new Intl.NumberFormat("en-NL", {
    minimumFractionDigits: fraction,
    maximumFractionDigits: fraction,
  });
  return `${formatter.format(n)}${opts.unit ?? ""}`;
};

const chipsForPhase = (
  phase: NarratePhase,
  entries: Array<EventRow & { payload: NarratePayload }>,
  data: EventsResponse,
): Chip[] => {
  const chips: Chip[] = [];
  if (phase === "INGEST") {
    const result = entries.find((e) => e.payload.role === "tool_result");
    const meta = result?.payload.meta as
      | { txCount?: number; totalSpendEur?: number }
      | undefined;
    if (meta?.txCount != null) chips.push({ label: "Transactions", value: String(meta.txCount) });
    if (meta?.totalSpendEur != null)
      chips.push({ label: "Total spend", value: `€${formatNum(meta.totalSpendEur, { fraction: 0 })}` });
  }
  if (phase === "ESTIMATE") {
    if (data.finalCo2eKg != null) {
      chips.push({ label: "Final CO₂e", value: `${formatNum(data.finalCo2eKg, { fraction: 0 })} kg` });
    } else if (data.initialCo2eKg != null) {
      chips.push({ label: "First estimate", value: `${formatNum(data.initialCo2eKg, { fraction: 0 })} kg` });
    }
    const conf = data.finalConfidence ?? data.initialConfidence;
    if (conf != null) {
      chips.push({ label: "Confidence", value: `${Math.round(conf * 100)}%` });
    }
  }
  if (phase === "CLUSTER") {
    const result = entries.find(
      (e) =>
        e.payload.role === "tool_result" &&
        typeof (e.payload.meta as { flagged?: unknown[] } | undefined)?.flagged !== "undefined",
    );
    const meta = result?.payload.meta as
      | { flagged?: unknown[]; totalClusters?: number }
      | undefined;
    if (meta?.flagged) chips.push({ label: "Flagged", value: String(meta.flagged.length) });
    if (meta?.totalClusters != null)
      chips.push({ label: "Merchants", value: String(meta.totalClusters) });
  }
  if (phase === "REFINE") {
    const answered = entries.filter((e) => e.payload.role === "summary").length;
    if (answered > 0) chips.push({ label: "Answers locked", value: String(answered) });
  }
  if (phase === "POLICY" && data.reserveEur != null) {
    chips.push({ label: "Reserve due", value: `€${formatNum(data.reserveEur, { fraction: 2 })}` });
  }
  if (phase === "PROPOSE") {
    const summary = entries.find((e) => e.payload.role === "summary");
    const meta = summary?.payload.meta as
      | { tonnesCovered?: number; creditProjects?: unknown[] }
      | undefined;
    if (meta?.tonnesCovered != null)
      chips.push({ label: "Coverage", value: `${formatNum(meta.tonnesCovered, { fraction: 2 })} t` });
    if (meta?.creditProjects)
      chips.push({ label: "EU projects", value: String(meta.creditProjects.length) });
  }
  if (phase === "EXECUTE" && data.reserveEur != null) {
    chips.push({ label: "Transferred", value: `€${formatNum(data.reserveEur, { fraction: 2 })}` });
  }
  return chips;
};

const Line = ({
  entry,
}: {
  entry: EventRow & { payload: NarratePayload };
}) => {
  const p = entry.payload;
  const variant =
    p.role === "summary"
      ? "summary"
      : p.role === "tool_result"
        ? "result"
        : p.role === "error"
          ? "error"
          : p.role === "thinking"
            ? "thinking"
            : "default";
  return (
    <li className={`cs-line cs-line--${variant}`}>
      <span className="cs-line__bullet" aria-hidden="true" />
      <div>
        <span className="cs-line__title">{p.title}</span>
        {p.body && <span className="cs-line__body">{p.body}</span>}
      </div>
      <span className="cs-line__time" title={new Date(entry.createdAt * 1000).toString()}>
        {formatHMS(entry.createdAt)}
      </span>
    </li>
  );
};

const DevDrawer = ({
  entries,
}: {
  entries: Array<EventRow & { payload: NarratePayload }>;
}) => {
  const [open, setOpen] = useState(false);
  const techy = entries.filter((e) => !!e.payload.meta || !!e.payload.tool);
  if (techy.length === 0) return null;
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="cs-step__dev-toggle"
        aria-expanded={open}
      >
        {open ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
        {open ? "Hide" : "Show"} {techy.length} technical detail{techy.length === 1 ? "" : "s"}
      </button>
      {open && (
        <div className="cs-dev-block" aria-label="Raw audit entries">
          {techy.map((e) => (
            <div key={e.id} className="cs-dev-block__row">
              <span style={{ color: "var(--fg-faint)" }}>
                {e.payload.tool ?? e.payload.role}
              </span>
              <div>
                <div style={{ color: "var(--fg-secondary)" }}>{e.payload.title}</div>
                {e.payload.meta && (
                  <details style={{ marginTop: 4 }}>
                    <summary
                      style={{
                        color: "var(--fg-muted)",
                        cursor: "pointer",
                        fontSize: 11,
                      }}
                    >
                      payload · {e.hash.slice(0, 8)}
                    </summary>
                    <pre
                      style={{
                        marginTop: 6,
                        padding: 8,
                        borderRadius: 6,
                        background: "var(--bg-canvas)",
                        border: "1px solid var(--border-faint)",
                        color: "var(--fg-secondary)",
                        fontSize: 11,
                        lineHeight: 1.5,
                        overflowX: "auto",
                      }}
                    >
                      {formatJson(e.payload.meta)}
                    </pre>
                    <button
                      type="button"
                      onClick={() => copyText(formatJson(e.payload.meta))}
                      style={{
                        marginTop: 4,
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 4,
                        fontSize: 11,
                        color: "var(--fg-muted)",
                        fontFamily: "var(--font-mono)",
                      }}
                    >
                      <Copy className="h-3 w-3" />
                      copy payload
                    </button>
                  </details>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
};

type StepGroup = {
  phase: NarratePhase;
  status: StepStatus;
  startedAt: number | null;
  endedAt: number | null;
  entries: Array<EventRow & { payload: NarratePayload }>;
};

/**
 * Walk the event log once and produce one StepGroup per phase in PHASE_ORDER.
 * Phases without entries get status "pending" (or are skipped if optional).
 */
const buildGroups = (
  events: EventRow[],
  data: EventsResponse,
): StepGroup[] => {
  const buckets = new Map<NarratePhase, Array<EventRow & { payload: NarratePayload }>>();
  for (const e of events) {
    if (!isNarrate(e)) continue;
    const arr = buckets.get(e.payload.phase) ?? [];
    arr.push(e);
    buckets.set(e.payload.phase, arr);
  }

  const currentPhase = STATE_TO_PHASE[data.state] ?? "INGEST";
  const finished = data.state === "COMPLETED";
  const failed = data.state === "FAILED";

  const groups: StepGroup[] = [];
  for (const def of PHASE_ORDER) {
    const entries = buckets.get(def.key) ?? [];
    const isCurrent = def.key === currentPhase;

    if (def.optional && entries.length === 0) {
      // Skip optional phase if it never happened.
      continue;
    }

    let status: StepStatus = "pending";
    if (entries.length === 0) {
      status = "pending";
    } else if (finished && def.key === "COMPLETE") {
      status = "done";
    } else if (failed && isCurrent) {
      status = "error";
    } else if (isCurrent) {
      if (data.state === "AWAITING_ANSWERS" || data.state === "AWAITING_APPROVAL") {
        status = "waiting";
      } else if (finished) {
        status = "done";
      } else {
        status = "active";
      }
    } else {
      // Phase has entries but isn't current → completed.
      status = "done";
    }

    const startedAt = entries[0]?.createdAt ?? null;
    const endedAt = entries[entries.length - 1]?.createdAt ?? null;

    groups.push({ phase: def.key, status, startedAt, endedAt, entries });
  }
  return groups;
};

const Step = ({
  group,
  index,
  isLast,
  showDeveloper,
  data,
}: {
  group: StepGroup;
  index: number;
  isLast: boolean;
  showDeveloper: boolean;
  data: EventsResponse;
}) => {
  const def = PHASE_ORDER.find((p) => p.key === group.phase)!;
  const Icon = group.status === "done" ? CheckCircle2 : def.icon;
  const visibleEntries = useMemo(
    () => (showDeveloper ? group.entries : group.entries.filter((e) => isFriendlyEntry(e.payload))),
    [group.entries, showDeveloper],
  );
  const summaryEntry = visibleEntries.find((e) => e.payload.role === "summary");
  const lede = summaryEntry?.payload.body ?? def.lede;

  return (
    <article className={`cs-step cs-step--${group.status}`}>
      <div className="cs-step__rail">
        <div className="cs-step__icon-wrap">
          {group.status === "active" && (
            <span className="cs-step__icon-pulse" aria-hidden="true" />
          )}
          <span className="cs-step__icon" aria-hidden="true">
            <Icon className="h-4 w-4" />
          </span>
        </div>
        {!isLast && <span className="cs-step__connector" aria-hidden="true" />}
      </div>

      <div className="cs-step__body">
        <header className="cs-step__head">
          <span className="cs-step__num">Step {index + 1}</span>
          <h3 className="cs-step__title">{def.label}</h3>
          <StatusPill status={group.status} />
          {group.endedAt && group.status === "done" && (
            <span className="cs-step__time">{formatHM(group.endedAt)}</span>
          )}
        </header>

        {group.status !== "pending" && lede && (
          <p className="cs-step__lede">{lede}</p>
        )}

        {(() => {
          const chips = chipsForPhase(group.phase, group.entries, data);
          if (chips.length === 0) return null;
          return (
            <ul className="cs-step__chips" aria-label="Step highlights">
              {chips.map((c) => (
                <li key={c.label} className="cs-chip">
                  <span className="cs-chip__label">{c.label}</span>
                  <span>{c.value}</span>
                </li>
              ))}
            </ul>
          );
        })()}

        {visibleEntries.length > 0 && (
          <ul className="cs-step__lines" aria-label={`${def.label} updates`}>
            {visibleEntries
              .filter((e) => e.payload.role !== "summary" || e !== summaryEntry)
              .map((e) => (
                <Line key={e.id} entry={e} />
              ))}
          </ul>
        )}

        {showDeveloper && <DevDrawer entries={group.entries} />}
      </div>
    </article>
  );
};

const RefinementPrompt = ({
  questions,
}: {
  questions: QuestionRow[];
}) => {
  const open = questions.filter((q) => !q.answer);
  if (open.length === 0) return null;
  return (
    <div className="cs-prompt-card cs-prompt-card--warning">
      <span
        className="inline-grid place-items-center w-9 h-9 rounded-full shrink-0"
        style={{
          background: "rgba(247, 185, 85, 0.18)",
          color: "var(--status-warning)",
          border: "1px solid rgba(247, 185, 85, 0.30)",
        }}
        aria-hidden="true"
      >
        <HelpCircle className="h-4 w-4" />
      </span>
      <div className="flex-1 min-w-0">
        <div
          className="text-[14px] leading-[1.5]"
          style={{ color: "var(--fg-primary)", letterSpacing: "-0.005em" }}
        >
          {open.length} question{open.length === 1 ? "" : "s"} for you in the
          Review panel above
        </div>
        <p
          className="text-[13px] leading-[1.55] mt-1"
          style={{ color: "var(--fg-secondary)", margin: "4px 0 0" }}
        >
          Each answer locks in a category and lifts confidence — I'll continue
          the close as soon as the last one's done.
        </p>
      </div>
    </div>
  );
};

const ApprovalPrompt = ({
  reserveEur,
  onApprove,
  approving,
}: {
  reserveEur: number | null;
  onApprove: () => void;
  approving: boolean;
}) => (
  <div className="cs-prompt-card">
    <span
      className="inline-grid place-items-center w-9 h-9 rounded-full shrink-0"
      style={{
        background: "var(--brand-green-soft)",
        color: "var(--brand-green)",
        border: "1px solid var(--brand-green-border)",
      }}
      aria-hidden="true"
    >
      <ClipboardCheck className="h-4 w-4" />
    </span>
    <div className="flex-1 min-w-0">
      <div
        className="text-[14px] leading-[1.5]"
        style={{ color: "var(--fg-primary)", letterSpacing: "-0.005em" }}
      >
        Ready when you are — approve the proposal to move funds.
      </div>
      {reserveEur != null && (
        <p
          className="text-[13px] leading-[1.55] mt-1"
          style={{ color: "var(--fg-secondary)", margin: "4px 0 0" }}
        >
          Reserve transfer of{" "}
          <span className="tabular-nums" style={{ color: "var(--fg-primary)" }}>
            €{reserveEur.toFixed(2)}
          </span>{" "}
          plus EU credit reservations are queued.
        </p>
      )}
      <button
        type="button"
        onClick={onApprove}
        disabled={approving}
        className="mt-3 inline-flex h-9 items-center gap-1.5 px-4 text-[13px] font-medium rounded-full transition-[border-color,opacity] duration-150 disabled:opacity-50"
        style={{
          color: "var(--fg-primary)",
          background: "var(--bg-button)",
          border: "1px solid var(--fg-primary)",
        }}
      >
        <CheckCircle2 className="h-3.5 w-3.5" />
        {approving ? "Approving…" : "Approve & transfer"}
      </button>
    </div>
  </div>
);

export const CloseChatStream = ({
  runId,
  initial,
}: {
  runId: string;
  initial: EventsResponse;
}) => {
  const router = useRouter();
  const [data, setData] = useState<EventsResponse>(initial);
  const [autoFollow, setAutoFollow] = useState(true);
  const [approving, setApproving] = useState(false);
  const [showDeveloper, setShowDeveloper] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const lastEventIdRef = useRef<number>(
    initial.events.length > 0
      ? initial.events[initial.events.length - 1].id
      : 0,
  );

  const live = isLiveStatus(data.status, data.state);

  const fetchEvents = useCallback(async () => {
    try {
      const res = await fetch(
        `/api/close/${runId}/events?since=${lastEventIdRef.current}`,
        { cache: "no-store" },
      );
      if (!res.ok) return;
      const next = (await res.json()) as EventsResponse;
      if (next.events.length > 0) {
        lastEventIdRef.current = next.events[next.events.length - 1].id;
      }
      setData((prev) => {
        const merged = [...prev.events];
        const seen = new Set(merged.map((e) => e.id));
        for (const e of next.events) {
          if (!seen.has(e.id)) merged.push(e);
        }
        return { ...next, events: merged };
      });
      const stateChanged =
        next.state !== data.state || next.status !== data.status;
      const newQuestionsAnswered = next.questions.some((q) => {
        const before = data.questions.find((d) => d.id === q.id);
        return before && !before.answer && q.answer;
      });
      if (stateChanged || newQuestionsAnswered) {
        router.refresh();
      }
    } catch {
      // Network blip — next tick will retry.
    }
  }, [runId, data.state, data.status, data.questions, router]);

  useEffect(() => {
    if (!live) return;
    const id = setInterval(fetchEvents, 1500);
    return () => clearInterval(id);
  }, [live, fetchEvents]);

  useEffect(() => {
    if (!autoFollow) return;
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [data.events.length, autoFollow]);

  const onScroll = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;
    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    setAutoFollow(distanceFromBottom < 80);
  }, []);

  const groups = useMemo(() => buildGroups(data.events, data), [data.events, data]);

  const approve = useCallback(async () => {
    setApproving(true);
    try {
      await fetch(`/api/close/${runId}/approve`, { method: "POST" });
      router.refresh();
      fetchEvents();
    } finally {
      setApproving(false);
    }
  }, [runId, router, fetchEvents]);

  const renderedSteps = groups.filter(
    (g) => g.status !== "pending" || g.entries.length === 0,
  );
  const completedSteps = renderedSteps.filter((g) => g.status === "done").length;
  const totalSteps = renderedSteps.length;
  const progressPct = totalSteps > 0 ? (completedSteps / totalSteps) * 100 : 0;
  const currentStep = renderedSteps.find(
    (g) => g.status === "active" || g.status === "waiting",
  );

  const headlineCopy = (() => {
    if (data.state === "COMPLETED") return "Loop closed";
    if (data.state === "FAILED") return "Run failed";
    if (data.state === "AWAITING_ANSWERS")
      return `Waiting on you · ${currentStep ? PHASE_ORDER.find((p) => p.key === currentStep.phase)?.label : "questions"}`;
    if (data.state === "AWAITING_APPROVAL")
      return "Waiting on you · approval";
    if (currentStep) {
      const def = PHASE_ORDER.find((p) => p.key === currentStep.phase)!;
      return `Working · ${def.label.toLowerCase()}`;
    }
    return "Starting…";
  })();

  return (
    <section className="ca-card cs-stream" aria-label="Live agent transcript">
      <header className="cs-stream__head">
        <div className="cs-stream__progress">
          <div className="flex items-center gap-2 flex-wrap">
            <span
              className="text-[15px] leading-[1.4]"
              style={{ color: "var(--fg-primary)", letterSpacing: "-0.005em" }}
            >
              {headlineCopy}
            </span>
            {live && (
              <span className="cs-status-pill cs-status-pill--working">
                <span
                  className="inline-block w-1.5 h-1.5 rounded-full"
                  style={{
                    background: "var(--brand-green)",
                    animation: "pulse-dot 1.5s ease-in-out infinite",
                  }}
                />
                Live
              </span>
            )}
          </div>
          <div className="flex items-center gap-3">
            <span
              className="font-mono text-[11px] tabular-nums"
              style={{ color: "var(--fg-faint)" }}
            >
              {completedSteps} of {totalSteps} done
            </span>
            <div className="cs-stream__progress-track flex-1 max-w-[260px]">
              <div
                className="cs-stream__progress-fill"
                style={{ width: `${progressPct}%` }}
                role="progressbar"
                aria-valuenow={Math.round(progressPct)}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label="Close progress"
              />
            </div>
          </div>
        </div>
        <label
          className="inline-flex items-center gap-2 cursor-pointer select-none shrink-0"
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: 11,
            letterSpacing: 1.2,
            textTransform: "uppercase",
            color: showDeveloper ? "var(--brand-green)" : "var(--fg-muted)",
          }}
        >
          <input
            type="checkbox"
            checked={showDeveloper}
            onChange={(e) => setShowDeveloper(e.target.checked)}
            className="sr-only"
          />
          <span
            className="relative inline-block w-7 h-4 rounded-full"
            style={{
              background: showDeveloper ? "var(--brand-green-soft)" : "var(--bg-inset)",
              border: `1px solid ${showDeveloper ? "var(--brand-green-border)" : "var(--border-default)"}`,
              transition: "background 150ms ease-out, border-color 150ms ease-out",
            }}
            aria-hidden="true"
          >
            <span
              className="absolute top-[2px] w-2.5 h-2.5 rounded-full"
              style={{
                left: showDeveloper ? "12px" : "2px",
                background: showDeveloper ? "var(--brand-green)" : "var(--fg-muted)",
                transition: "left 150ms ease-out, background 150ms ease-out",
              }}
            />
          </span>
          Developer view
        </label>
      </header>

      <div ref={containerRef} onScroll={onScroll} className="cs-stream__body">
        {renderedSteps.length === 0 && (
          <div
            className="flex items-center gap-3 text-[13px] py-4"
            style={{ color: "var(--fg-muted)" }}
          >
            <span
              className="cs-typing"
              aria-hidden="true"
              style={{ marginRight: 4 }}
            >
              <span />
              <span />
              <span />
            </span>
            Spinning up — first events land in a moment.
          </div>
        )}

        {renderedSteps.map((g, i) => (
          <Step
            key={`${g.phase}-${g.startedAt ?? i}`}
            group={g}
            index={i}
            isLast={
              i === renderedSteps.length - 1 &&
              data.state !== "AWAITING_ANSWERS" &&
              data.state !== "AWAITING_APPROVAL"
            }
            showDeveloper={showDeveloper}
            data={data}
          />
        ))}

        {data.state === "AWAITING_ANSWERS" && (
          <div className="pl-[58px] pr-2 mt-1 mb-4">
            <RefinementPrompt questions={data.questions} />
          </div>
        )}
        {data.state === "AWAITING_APPROVAL" && (
          <div className="pl-[58px] pr-2 mt-1 mb-4">
            <ApprovalPrompt
              reserveEur={data.reserveEur}
              onApprove={approve}
              approving={approving}
            />
          </div>
        )}

        <div ref={bottomRef} />

        {!autoFollow && live && (
          <button
            type="button"
            onClick={() => {
              setAutoFollow(true);
              bottomRef.current?.scrollIntoView({
                behavior: "smooth",
                block: "end",
              });
            }}
            className="cs-jump-btn"
            aria-label="Jump to latest"
          >
            <ArrowDown className="h-3.5 w-3.5" />
            Jump to latest
          </button>
        )}
      </div>
    </section>
  );
};
