"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  ArrowRight,
  CheckCircle2,
  FileText,
  FileUp,
  Leaf,
  Loader2,
  MessageCircle,
  Shuffle,
  Sparkles,
  Upload,
  X,
} from "lucide-react";
import { Button, CodeLabel, Card, CardBody } from "@/components/ui";
import { labelFor, type CompanyProfile } from "@/lib/onboarding/profile";
import type { ParserGap, ParserUnsupported } from "@/lib/onboarding/types";
import type { Policy } from "@/lib/policy/schema";
import { CREDIT_PROJECTS } from "@/lib/credits/projects";

/* ────────────────────────────────────────────────────────────
   Shared stage primitives
   ──────────────────────────────────────────────────────────── */

const Stage = ({ children, stepKey }: { children: ReactNode; stepKey: string }) => (
  <div
    key={stepKey}
    className="ob-step"
    style={{ animation: "ob-step-in 320ms ease-out both" }}
  >
    {children}
  </div>
);

const ProgressRail = ({ value }: { value: number }) => (
  <div
    className="fixed top-0 left-0 right-0 h-[2px] z-40"
    style={{ background: "var(--border-faint)" }}
    aria-hidden
  >
    <div
      className="h-full"
      style={{
        width: `${Math.max(4, Math.min(100, value * 100))}%`,
        background: "var(--brand-green)",
        transition: "width 500ms ease-out",
      }}
    />
  </div>
);

const Headline = ({ children }: { children: ReactNode }) => (
  <h1
    className="text-[36px] md:text-[44px] tracking-[-0.015em] m-0"
    style={{
      color: "var(--fg-primary)",
      fontWeight: 400,
      lineHeight: 1.1,
      textWrap: "balance",
    }}
  >
    {children}
  </h1>
);

const Sublead = ({ children }: { children: ReactNode }) => (
  <p
    className="text-[16px] leading-[1.5] max-w-[38rem] m-0"
    style={{ color: "var(--fg-secondary)", textWrap: "pretty" }}
  >
    {children}
  </p>
);

/* ────────────────────────────────────────────────────────────
   Intro (pre-run): welcome → company → track
   ──────────────────────────────────────────────────────────── */

type IntroStep = "welcome" | "company" | "track";

export const OnboardingIntroFlow = ({
  defaultCompanyName,
  hasActivePolicy,
  orgName,
}: {
  defaultCompanyName: string;
  hasActivePolicy: boolean;
  orgName: string;
}) => {
  const router = useRouter();
  const [step, setStep] = useState<IntroStep>("welcome");
  const [companyName, setCompanyName] = useState(defaultCompanyName);
  const [track, setTrack] = useState<"generate" | "upload" | "mix" | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const stepOrder: IntroStep[] = ["welcome", "company", "track"];
  const progress = (stepOrder.indexOf(step) + 1) / 8;

  const go = (next: IntroStep) => {
    setError(null);
    setStep(next);
  };

  const start = async () => {
    if (!track) return;
    setBusy(true);
    setError(null);
    try {
      const resp = await fetch("/api/onboarding/start", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ track, companyName: companyName || undefined }),
      });
      if (!resp.ok) {
        const j = await resp.json().catch(() => ({}));
        throw new Error(j.error ?? "Failed to start");
      }
      const j = (await resp.json()) as { id: string };
      router.push(`/onboarding/${j.id}`);
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  };

  return (
    <>
      <ProgressRail value={progress} />

      <div className="ob-shell">
        {step === "welcome" && (
          <Stage stepKey="welcome">
            <div className="flex flex-col items-start gap-7 max-w-2xl mx-auto w-full">
              <div
                className="w-11 h-11 rounded-[12px] grid place-items-center"
                style={{
                  background: "var(--bg-inset)",
                  border: "1px solid var(--border-default)",
                  color: "var(--brand-green)",
                }}
              >
                <Leaf className="h-5 w-5" />
              </div>

              <CodeLabel>Welcome to Carbo</CodeLabel>
              <Headline>Your carbon close, on autopilot.</Headline>
              <Sublead>
                In the next few minutes we&apos;ll calibrate Carbo to your business — reserve rules, credit
                preferences, and CSRD-ready reporting. You approve everything before anything goes live.
              </Sublead>

              <div className="flex items-center gap-4 mt-2">
                <Button onClick={() => go("company")}>
                  Let&apos;s begin
                  <ArrowRight className="h-4 w-4" />
                </Button>
                <span className="text-[12px]" style={{ color: "var(--fg-muted)" }}>
                  ~3 minutes · nothing activates without approval
                </span>
              </div>

              {hasActivePolicy && (
                <div
                  className="mt-4 text-[13px] px-3 py-2 rounded-[6px]"
                  style={{
                    color: "var(--status-warning)",
                    border: "1px solid rgba(247,185,85,0.30)",
                    background: "transparent",
                  }}
                >
                  A policy is already active for {orgName} — finishing this flow will replace it.
                </div>
              )}
            </div>
          </Stage>
        )}

        {step === "company" && (
          <Stage stepKey="company">
            <div className="flex flex-col gap-7 max-w-xl mx-auto w-full">
              <CodeLabel>Step 1 of 3</CodeLabel>
              <Headline>What&apos;s your company called?</Headline>
              <Sublead>
                We&apos;ll use this on your policy document and on the dashboard. You can change it later.
              </Sublead>

              <div className="mt-2">
                <input
                  autoFocus
                  type="text"
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  onKeyDown={(e) =>
                    e.key === "Enter" && companyName.trim() && go("track")
                  }
                  placeholder="Acme BV"
                  className="w-full bg-transparent text-[32px] md:text-[36px] tracking-[-0.015em] pb-3 focus-visible:outline-none"
                  style={{
                    color: "var(--fg-primary)",
                    borderBottom: "1px solid var(--border-default)",
                    caretColor: "var(--brand-green)",
                    fontWeight: 400,
                  }}
                />
              </div>

              <div className="flex items-center justify-between pt-4">
                <Button variant="ghost" size="sm" onClick={() => go("welcome")}>
                  ← Back
                </Button>
                <Button
                  onClick={() => go("track")}
                  disabled={!companyName.trim()}
                >
                  Continue
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </Stage>
        )}

        {step === "track" && (
          <Stage stepKey="track">
            <div className="flex flex-col gap-7 max-w-3xl mx-auto w-full">
              <CodeLabel>Step 2 of 3</CodeLabel>
              <Headline>How would you like to set things up?</Headline>
              <Sublead>
                Pick the path that fits you. You can upload an existing policy, have Carbo draft one for you,
                or blend both.
              </Sublead>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-2">
                <TrackCard
                  active={track === "generate"}
                  onClick={() => setTrack("generate")}
                  icon={<MessageCircle className="h-5 w-5" />}
                  title="Guide me through it"
                  blurb="A few short questions and we'll draft a full policy calibrated to your business."
                  time="~3 min"
                />
                <TrackCard
                  active={track === "upload"}
                  onClick={() => setTrack("upload")}
                  icon={<FileUp className="h-5 w-5" />}
                  title="I already have a policy"
                  blurb="Upload PDF / DOCX / Markdown / YAML / JSON. We parse and map it to Carbo."
                  time="~1 min"
                />
                <TrackCard
                  active={track === "mix"}
                  onClick={() => setTrack("mix")}
                  icon={<Shuffle className="h-5 w-5" />}
                  title="Blend both"
                  blurb="Start from what you have, then fill any gaps interactively."
                  time="~2 min"
                />
              </div>

              {error && (
                <div className="text-[13px]" style={{ color: "var(--status-danger)" }}>
                  {error}
                </div>
              )}

              <div className="flex items-center justify-between pt-4">
                <Button variant="ghost" size="sm" onClick={() => go("company")}>
                  ← Back
                </Button>
                <Button onClick={start} disabled={!track || busy}>
                  {busy ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Starting…
                    </>
                  ) : (
                    <>
                      Begin setup
                      <ArrowRight className="h-4 w-4" />
                    </>
                  )}
                </Button>
              </div>
            </div>
          </Stage>
        )}
      </div>
    </>
  );
};

const TrackCard = ({
  active,
  onClick,
  icon,
  title,
  blurb,
  time,
}: {
  active: boolean;
  onClick: () => void;
  icon: ReactNode;
  title: string;
  blurb: string;
  time: string;
}) => (
  <button
    type="button"
    onClick={onClick}
    className="ob-track-card text-left flex flex-col gap-3 p-5 rounded-[12px] relative transition-[border-color] duration-150 ease-out"
    data-active={active}
    style={{
      background: "var(--bg-surface)",
      border: `1px solid ${
        active ? "var(--brand-green-border)" : "var(--border-default)"
      }`,
    }}
  >
    <div className="flex items-center justify-between">
      <div
        className="w-9 h-9 rounded-[6px] grid place-items-center"
        style={{
          background: "var(--bg-inset)",
          border: "1px solid var(--border-faint)",
          color: active ? "var(--brand-green)" : "var(--fg-secondary)",
        }}
      >
        {icon}
      </div>
      <CodeLabel>{time}</CodeLabel>
    </div>
    <div className="text-[15px]" style={{ color: "var(--fg-primary)" }}>
      {title}
    </div>
    <div
      className="text-[13px] leading-[1.5]"
      style={{ color: "var(--fg-secondary)" }}
    >
      {blurb}
    </div>
    {active && (
      <div
        className="absolute top-3 right-3 w-4 h-4 rounded-full grid place-items-center"
        style={{
          border: "1px solid var(--brand-green)",
          color: "var(--brand-green)",
        }}
      >
        <CheckCircle2 className="h-3 w-3" />
      </div>
    )}
  </button>
);

/* ────────────────────────────────────────────────────────────
   Run flow (post-start)
   ──────────────────────────────────────────────────────────── */

type QaKind = "multiple_choice" | "free_text" | "numeric" | "confirm";

export type OnboardingRunData = {
  runId: string;
  orgName: string;
  state: string;
  track: "generate" | "upload" | "mix";
  questionCount: number;
  profile: CompanyProfile;
  gaps: ParserGap[];
  unsupported: ParserUnsupported[];
  draft: Policy | null;
  draftMarkdown: string;
  creditShortlist: string[];
  calibrationNotes: string | null;
  seedCloseRunId: string | null;
  pendingQa: {
    id: number;
    question: string;
    rationale: string | null;
    kind: QaKind;
    options: string[] | null;
    required: boolean;
  } | null;
  answeredQa: Array<{ id: number; question: string; answer: string }>;
};

const STATE_WEIGHTS: Record<string, number> = {
  INIT: 0.2,
  UPLOAD_PARSING: 0.3,
  UPLOAD_MAPPED: 0.4,
  PROFILE_COLLECT: 0.5,
  AWAITING_ANSWER: 0.55,
  DRAFT_POLICY: 0.75,
  AWAITING_APPROVAL: 0.85,
  FINALIZE: 0.95,
  SEED_FIRST_CLOSE: 0.98,
  COMPLETED: 1,
};

export const OnboardingRunFlow = ({ data }: { data: OnboardingRunData }) => {
  const router = useRouter();
  const isTransitional =
    data.state === "UPLOAD_PARSING" ||
    data.state === "DRAFT_POLICY" ||
    data.state === "FINALIZE" ||
    data.state === "SEED_FIRST_CLOSE";

  useEffect(() => {
    if (!isTransitional) return;
    const t = setInterval(() => router.refresh(), 1600);
    return () => clearInterval(t);
  }, [isTransitional, router]);

  const progress = STATE_WEIGHTS[data.state] ?? 0.4;
  const needsUpload =
    data.state === "INIT" && (data.track === "upload" || data.track === "mix");
  const questionPct = data.pendingQa ? Math.min(1, data.questionCount / 12) : 0;

  return (
    <>
      <ProgressRail value={progress} />

      <div className="ob-shell">
        <div className="flex items-center justify-between max-w-3xl mx-auto w-full mb-10">
          <div className="flex items-center gap-2.5">
            <Leaf className="h-4 w-4" style={{ color: "var(--brand-green)" }} />
            <CodeLabel>Setup · {data.orgName}</CodeLabel>
          </div>
          {data.state !== "COMPLETED" && <ResetLink runId={data.runId} />}
        </div>

        {needsUpload && (
          <Stage stepKey="upload">
            <div className="flex flex-col gap-7 max-w-2xl mx-auto w-full">
              <CodeLabel>Upload your policy</CodeLabel>
              <Headline>Drop in what you already have.</Headline>
              <Sublead>
                PDF, DOCX, Markdown, YAML, JSON — we&apos;ll parse it, map it to Carbo&apos;s schema, and only ask
                about what&apos;s missing.
              </Sublead>

              <UploadDrop runId={data.runId} />
              <div className="text-[12px]" style={{ color: "var(--fg-muted)" }}>
                Max 5 MB · everything stays on your Carbo workspace.
              </div>
            </div>
          </Stage>
        )}

        {data.state === "UPLOAD_PARSING" && (
          <Stage stepKey="parsing">
            <BusyScreen
              title="Reading your document…"
              subtitle="Pulling out reserve rules, caps, and credit preferences."
            />
          </Stage>
        )}

        {data.unsupported.length > 0 &&
          data.pendingQa === null &&
          data.state !== "AWAITING_APPROVAL" &&
          !needsUpload && (
            <Stage stepKey="unsupported">
              <div className="flex flex-col gap-5 max-w-2xl mx-auto w-full">
                <CodeLabel>Heads up</CodeLabel>
                <Headline>A few things from your document need attention.</Headline>
                <div className="flex flex-col gap-2.5 mt-2">
                  {data.unsupported.map((u, i) => (
                    <div
                      key={i}
                      className="flex items-start gap-3 p-4 rounded-[12px]"
                      style={{
                        background: "var(--bg-surface)",
                        border: "1px solid var(--border-default)",
                      }}
                    >
                      <div
                        className="mt-0.5 px-2 py-0.5 rounded-full"
                        style={{
                          color:
                            u.severity === "error"
                              ? "var(--status-danger)"
                              : "var(--status-warning)",
                          border: `1px solid ${
                            u.severity === "error"
                              ? "rgba(229,72,77,0.30)"
                              : "rgba(247,185,85,0.30)"
                          }`,
                          fontFamily: "var(--font-mono)",
                          fontSize: "10px",
                          textTransform: "uppercase",
                          letterSpacing: "1.2px",
                        }}
                      >
                        {u.severity}
                      </div>
                      <div className="flex-1">
                        <div
                          className="text-[14px]"
                          style={{ color: "var(--fg-primary)" }}
                        >
                          {u.found}
                        </div>
                        <div
                          className="text-[12px] mt-0.5"
                          style={{ color: "var(--fg-muted)" }}
                        >
                          {u.note}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </Stage>
          )}

        {data.pendingQa && data.state !== "COMPLETED" && (
          <Stage stepKey={`qa-${data.pendingQa.id}`}>
            <div className="flex flex-col gap-7 max-w-2xl mx-auto w-full">
              <div className="flex items-center justify-between gap-5">
                <CodeLabel>
                  Question {data.questionCount} · up to 12
                </CodeLabel>
                <div
                  className="flex-1 h-[2px] rounded-full overflow-hidden"
                  style={{ background: "var(--border-faint)" }}
                >
                  <div
                    className="h-full"
                    style={{
                      width: `${Math.round(questionPct * 100)}%`,
                      background: "var(--brand-green)",
                      transition: "width 400ms ease-out",
                    }}
                  />
                </div>
              </div>

              <Headline>{data.pendingQa.question}</Headline>

              {data.pendingQa.rationale && <Sublead>{data.pendingQa.rationale}</Sublead>}

              <AnswerForm
                runId={data.runId}
                qaId={data.pendingQa.id}
                kind={data.pendingQa.kind}
                options={data.pendingQa.options ?? undefined}
                required={data.pendingQa.required}
              />

              {data.answeredQa.length > 0 && (
                <details className="mt-4 group">
                  <summary
                    className="text-[12px] cursor-pointer select-none inline-flex items-center gap-1.5"
                    style={{ color: "var(--fg-muted)" }}
                  >
                    <Sparkles className="h-3 w-3" />
                    What you&apos;ve told me so far ({data.answeredQa.length})
                  </summary>
                  <div
                    className="mt-3 flex flex-col gap-1.5 pl-4"
                    style={{ borderLeft: "1px solid var(--border-default)" }}
                  >
                    {data.answeredQa.map((q) => (
                      <div
                        key={q.id}
                        className="flex justify-between gap-4 text-[12px] py-1"
                      >
                        <span style={{ color: "var(--fg-muted)" }}>{q.question}</span>
                        <span
                          className="truncate max-w-[50%] text-right"
                          style={{ color: "var(--fg-secondary)" }}
                        >
                          {q.answer}
                        </span>
                      </div>
                    ))}
                  </div>
                </details>
              )}
            </div>
          </Stage>
        )}

        {data.state === "DRAFT_POLICY" && (
          <Stage stepKey="drafting">
            <BusyScreen
              title="Drafting your policy…"
              subtitle="Calibrating reserve rules, CSRD narrative, and a starting credit shortlist."
            />
          </Stage>
        )}

        {data.state === "AWAITING_APPROVAL" && data.draft && (
          <Stage stepKey="review">
            <ReviewStep
              runId={data.runId}
              draft={data.draft}
              markdown={data.draftMarkdown}
              creditShortlist={data.creditShortlist}
              calibrationNotes={data.calibrationNotes}
            />
          </Stage>
        )}

        {(data.state === "FINALIZE" || data.state === "SEED_FIRST_CLOSE") && (
          <Stage stepKey="finalize">
            <BusyScreen
              title="Activating Carbo…"
              subtitle="Writing your policy, opening your Carbon Reserve sub-account, seeding a first close."
            />
          </Stage>
        )}

        {data.state === "COMPLETED" && (
          <Stage stepKey="done">
            <DoneStep seedCloseRunId={data.seedCloseRunId} />
          </Stage>
        )}

        {Object.keys(data.profile).length > 0 && data.state !== "COMPLETED" && (
          <div
            className="max-w-2xl mx-auto w-full mt-10 pt-6"
            style={{ borderTop: "1px solid var(--border-faint)" }}
          >
            <CodeLabel>What Carbo knows so far</CodeLabel>
            <div className="flex flex-wrap gap-2 mt-3">
              {Object.entries(data.profile).map(([k, v]) => (
                <span
                  key={k}
                  className="text-[12px] px-2.5 py-1 rounded-full"
                  style={{
                    color: "var(--fg-secondary)",
                    background: "transparent",
                    border: "1px solid var(--border-default)",
                  }}
                >
                  <span style={{ color: "var(--fg-muted)" }}>{k}</span>
                  <span className="mx-1" style={{ color: "var(--fg-faint)" }}>·</span>
                  {labelFor(k, typeof v === "string" ? v : String(v))}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    </>
  );
};

/* ────────────────────────────────────────────────────────────
   Busy
   ──────────────────────────────────────────────────────────── */

const BusyScreen = ({ title, subtitle }: { title: string; subtitle: string }) => (
  <div className="flex flex-col items-start gap-6 max-w-lg mx-auto w-full">
    <div
      className="w-11 h-11 rounded-[12px] grid place-items-center"
      style={{
        background: "var(--bg-inset)",
        border: "1px solid var(--border-default)",
      }}
    >
      <Loader2
        className="h-5 w-5 animate-spin"
        style={{ color: "var(--brand-green)" }}
      />
    </div>
    <Headline>{title}</Headline>
    <Sublead>{subtitle}</Sublead>
    <div className="ob-dots mt-1" aria-hidden>
      <span />
      <span />
      <span />
    </div>
  </div>
);

/* ────────────────────────────────────────────────────────────
   Answer form
   ──────────────────────────────────────────────────────────── */

const AnswerForm = ({
  runId,
  qaId,
  kind,
  options,
  required,
}: {
  runId: string;
  qaId: number;
  kind: QaKind;
  options?: string[];
  required: boolean;
}) => {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);

  const submit = async (answer: string, loadingKey = "submit") => {
    setBusy(loadingKey);
    setError(null);
    try {
      const resp = await fetch(`/api/onboarding/${runId}/answer`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "answer", qaId, answer }),
      });
      if (!resp.ok) {
        const j = await resp.json().catch(() => ({}));
        throw new Error(j.error ?? "Failed to submit");
      }
      setText("");
      router.refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  const skip = async () => {
    setBusy("skip");
    setError(null);
    try {
      const resp = await fetch(`/api/onboarding/${runId}/answer`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "skip", qaId }),
      });
      if (!resp.ok) {
        const j = await resp.json().catch(() => ({}));
        throw new Error(j.error ?? "Skip failed");
      }
      router.refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="flex flex-col gap-3.5">
      {kind === "multiple_choice" && options && (
        <div className="flex flex-col gap-2">
          {options.map((o, i) => (
            <button
              key={o}
              type="button"
              disabled={busy !== null}
              onClick={() => submit(o, o)}
              className="ob-option text-left flex items-center justify-between group"
            >
              <span className="flex items-center gap-3">
                <span className="ob-option-key">{String.fromCharCode(65 + i)}</span>
                <span className="text-[15px]" style={{ color: "var(--fg-primary)" }}>
                  {o}
                </span>
              </span>
              {busy === o ? (
                <Loader2
                  className="h-4 w-4 animate-spin"
                  style={{ color: "var(--brand-green)" }}
                />
              ) : (
                <ArrowRight
                  className="h-4 w-4 opacity-0 group-hover:opacity-100 transition-opacity"
                  style={{ color: "var(--brand-green)" }}
                />
              )}
            </button>
          ))}
        </div>
      )}

      {kind === "confirm" && (
        <div className="flex gap-2">
          <Button disabled={busy !== null} onClick={() => submit("Yes", "yes")}>
            {busy === "yes" && <Loader2 className="h-4 w-4 animate-spin" />}
            Yes
          </Button>
          <Button
            variant="secondary"
            disabled={busy !== null}
            onClick={() => submit("No", "no")}
          >
            {busy === "no" && <Loader2 className="h-4 w-4 animate-spin" />}
            No
          </Button>
        </div>
      )}

      {kind === "numeric" && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (text.trim()) submit(text.trim());
          }}
          className="flex items-center gap-3"
        >
          <div
            className="flex items-baseline gap-2 py-3 flex-1"
            style={{ borderBottom: "1px solid var(--border-default)" }}
          >
            <span
              className="text-[26px]"
              style={{ color: "var(--fg-muted)", fontWeight: 400 }}
            >
              €
            </span>
            <input
              autoFocus
              type="number"
              inputMode="decimal"
              min={0}
              step="any"
              value={text}
              onChange={(e) => setText(e.target.value)}
              className="bg-transparent outline-none tabular-nums text-[30px] flex-1 min-w-0"
              style={{
                color: "var(--fg-primary)",
                caretColor: "var(--brand-green)",
                fontWeight: 400,
              }}
              placeholder="0"
            />
          </div>
          <Button type="submit" disabled={busy !== null || !text.trim()}>
            {busy !== null ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <ArrowRight className="h-4 w-4" />
            )}
            Submit
          </Button>
        </form>
      )}

      {kind === "free_text" && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (text.trim()) submit(text.trim());
          }}
          className="flex flex-col gap-3"
        >
          <textarea
            autoFocus
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey) && text.trim())
                submit(text.trim());
            }}
            rows={3}
            placeholder="Type your answer…"
            className="w-full p-4 rounded-[6px] text-[15px] leading-[1.5] resize-none focus-visible:outline-none"
            style={{
              color: "var(--fg-primary)",
              background: "var(--bg-inset)",
              border: "1px solid var(--border-default)",
              caretColor: "var(--brand-green)",
            }}
          />
          <div className="flex items-center justify-between">
            <span className="text-[11px]" style={{ color: "var(--fg-faint)" }}>
              ⌘ + Enter to submit
            </span>
            <div className="flex items-center gap-2">
              {!required && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={busy !== null}
                  onClick={skip}
                >
                  Skip
                </Button>
              )}
              <Button type="submit" disabled={busy !== null || !text.trim()}>
                {busy !== null ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <ArrowRight className="h-4 w-4" />
                )}
                Submit
              </Button>
            </div>
          </div>
        </form>
      )}

      {!required && kind !== "free_text" && (
        <button
          type="button"
          disabled={busy !== null}
          onClick={skip}
          className="text-[12px] self-start hover:underline disabled:opacity-50"
          style={{ color: "var(--fg-muted)" }}
        >
          Skip this one
        </button>
      )}

      {error && (
        <div className="text-[13px]" style={{ color: "var(--status-danger)" }}>
          {error}
        </div>
      )}
    </div>
  );
};

/* ────────────────────────────────────────────────────────────
   Upload
   ──────────────────────────────────────────────────────────── */

const UploadDrop = ({ runId }: { runId: string }) => {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const [filename, setFilename] = useState<string | null>(null);

  const upload = async (file: File) => {
    setBusy(true);
    setError(null);
    setFilename(file.name);
    try {
      const form = new FormData();
      form.set("file", file);
      const resp = await fetch(`/api/onboarding/${runId}/upload`, {
        method: "POST",
        body: form,
      });
      if (!resp.ok) {
        const j = await resp.json().catch(() => ({}));
        throw new Error(j.error ?? "Upload failed");
      }
      router.refresh();
    } catch (e) {
      setError((e as Error).message);
      setFilename(null);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragging(false);
        const file = e.dataTransfer.files?.[0];
        if (file) void upload(file);
      }}
      className="ob-drop"
      data-dragging={dragging}
      data-filled={!!filename}
    >
      <input
        ref={inputRef}
        type="file"
        className="sr-only"
        accept=".pdf,.docx,.md,.markdown,.yaml,.yml,.json,.txt"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void upload(f);
        }}
      />
      <div className="flex flex-col items-center gap-3 text-center">
        <div
          className="w-11 h-11 rounded-[12px] grid place-items-center"
          style={{
            background: "var(--bg-inset)",
            border: "1px solid var(--border-default)",
            color: busy || filename ? "var(--brand-green)" : "var(--fg-secondary)",
          }}
        >
          {busy ? (
            <Loader2 className="h-5 w-5 animate-spin" />
          ) : filename ? (
            <CheckCircle2 className="h-5 w-5" />
          ) : (
            <Upload className="h-5 w-5" />
          )}
        </div>
        <div className="text-[15px]" style={{ color: "var(--fg-primary)" }}>
          {busy ? (
            <>Parsing {filename}…</>
          ) : filename ? (
            <>Uploaded {filename}</>
          ) : (
            <>
              Drop a file here, or{" "}
              <button
                type="button"
                onClick={() => inputRef.current?.click()}
                className="underline"
                style={{ color: "var(--brand-green-link)" }}
              >
                choose one
              </button>
            </>
          )}
        </div>
        <CodeLabel>PDF · DOCX · MD · YAML · JSON · TXT</CodeLabel>
        {error && (
          <div className="text-[13px] mt-2" style={{ color: "var(--status-danger)" }}>
            {error}
          </div>
        )}
      </div>
    </div>
  );
};

/* ────────────────────────────────────────────────────────────
   Review
   ──────────────────────────────────────────────────────────── */

const ReviewStep = ({
  runId,
  draft,
  markdown,
  creditShortlist,
  calibrationNotes,
}: {
  runId: string;
  draft: Policy;
  markdown: string;
  creditShortlist: string[];
  calibrationNotes: string | null;
}) => {
  const router = useRouter();
  const [view, setView] = useState<"rules" | "doc">("rules");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const approve = async () => {
    setBusy(true);
    setError(null);
    try {
      const resp = await fetch(`/api/onboarding/${runId}/approve`, {
        method: "POST",
      });
      if (!resp.ok) {
        const j = await resp.json().catch(() => ({}));
        throw new Error(j.error ?? "Approval failed");
      }
      router.refresh();
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  };

  const download = () => {
    const blob = new Blob([markdown], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `carbo-policy-${runId}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex flex-col gap-7 max-w-3xl mx-auto w-full">
      <CodeLabel>Final review</CodeLabel>
      <Headline>Your policy is drafted. Have a look?</Headline>
      <Sublead>
        Nothing is live until you approve. Approving writes your policy, opens the Carbon Reserve sub-account,
        and seeds a first monthly close so you have data on day one.
      </Sublead>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-2">
        <ReviewStat label="Reserve rules" value={String(draft.reserveRules.length)} />
        <ReviewStat
          label="Approval ≥"
          value={`€${draft.approvalThresholdEur.toLocaleString("en-NL")}`}
        />
        <ReviewStat
          label="Monthly cap"
          value={`€${draft.maxReservePerMonthEur.toLocaleString("en-NL")}`}
        />
        <ReviewStat
          label="Removal share"
          value={`${Math.round(draft.creditPreference.minRemovalPct * 100)}%`}
          accent
        />
      </div>

      <Card>
        <div
          className="flex items-center gap-1 px-3 pt-2"
          style={{ borderBottom: "1px solid var(--border-faint)" }}
        >
          <TabBtn active={view === "rules"} onClick={() => setView("rules")}>
            Reserve rules
          </TabBtn>
          <TabBtn active={view === "doc"} onClick={() => setView("doc")}>
            Policy document
          </TabBtn>
          <button
            type="button"
            onClick={download}
            className="ml-auto mr-1 mb-0.5 inline-flex items-center gap-1.5 text-[12px] px-2.5 py-1.5 rounded-[6px]"
            style={{ color: "var(--fg-secondary)" }}
          >
            <FileText className="h-3.5 w-3.5" /> Download .md
          </button>
        </div>

        {view === "rules" && (
          <div className="overflow-x-auto px-5 py-4">
            <table className="min-w-full text-[13px]">
              <thead>
                <tr className="text-left">
                  <th className="py-2 pr-4 font-normal">
                    <CodeLabel>Category</CodeLabel>
                  </th>
                  <th className="py-2 pr-4 font-normal">
                    <CodeLabel>Method</CodeLabel>
                  </th>
                  <th className="py-2 pr-4 text-right font-normal">
                    <CodeLabel>Value</CodeLabel>
                  </th>
                </tr>
              </thead>
              <tbody className="tabular-nums">
                {draft.reserveRules.map((r, i) => (
                  <tr key={i} style={{ borderTop: "1px solid var(--border-faint)" }}>
                    <td
                      className="py-2.5 pr-4"
                      style={{ color: "var(--fg-primary)" }}
                    >
                      {r.category}
                    </td>
                    <td className="py-2.5 pr-4" style={{ color: "var(--fg-secondary)" }}>
                      {r.method.replace(/_/g, " ")}
                    </td>
                    <td
                      className="py-2.5 pr-4 text-right"
                      style={{ color: "var(--fg-primary)" }}
                    >
                      {r.method === "pct_spend"
                        ? `${(r.value * 100).toFixed(2)}%`
                        : r.method === "eur_per_kg_co2e"
                          ? `€${r.value.toFixed(3)}/kg`
                          : `€${r.value.toFixed(2)} flat`}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {view === "doc" && (
          <pre
            className="whitespace-pre-wrap text-[12px] leading-[1.6] font-mono px-5 py-4 max-h-[420px] overflow-auto m-0"
            style={{ color: "var(--fg-secondary)" }}
          >
            {markdown}
          </pre>
        )}
      </Card>

      {creditShortlist.length > 0 && (
        <Card>
          <CardBody>
            <CodeLabel>Initial credit shortlist</CodeLabel>
            <ul className="flex flex-col gap-2 mt-3">
              {creditShortlist.map((id) => {
                const p = CREDIT_PROJECTS.find((pp) => pp.id === id);
                if (!p)
                  return (
                    <li
                      key={id}
                      className="text-[12px] font-mono"
                      style={{ color: "var(--fg-muted)" }}
                    >
                      {id}
                    </li>
                  );
                return (
                  <li
                    key={id}
                    className="flex items-center justify-between text-[13px]"
                  >
                    <span style={{ color: "var(--fg-primary)" }}>
                      {p.name}{" "}
                      <span style={{ color: "var(--fg-muted)" }}>· {p.country}</span>
                    </span>
                    <span
                      className="tabular-nums"
                      style={{ color: "var(--brand-green)" }}
                    >
                      €{p.pricePerTonneEur}
                      <span
                        className="text-[11px] ml-0.5"
                        style={{ color: "var(--fg-muted)" }}
                      >
                        /t
                      </span>
                    </span>
                  </li>
                );
              })}
            </ul>
          </CardBody>
        </Card>
      )}

      {calibrationNotes && (
        <div
          className="rounded-[12px] p-5 text-[13px] leading-[1.5]"
          style={{
            border: "1px solid rgba(95,185,255,0.22)",
            color: "var(--fg-secondary)",
          }}
        >
          <div
            className="mb-2 flex items-center gap-1.5"
            style={{
              color: "var(--status-info)",
              fontFamily: "var(--font-mono)",
              fontSize: "12px",
              textTransform: "uppercase",
              letterSpacing: "1.2px",
            }}
          >
            <Sparkles className="h-3 w-3" /> Calibration notes
          </div>
          {calibrationNotes}
        </div>
      )}

      {error && (
        <div className="text-[13px]" style={{ color: "var(--status-danger)" }}>
          {error}
        </div>
      )}

      <div
        className="sticky bottom-4 flex items-center justify-between gap-4 p-4 rounded-[12px]"
        style={{
          background: "var(--bg-translucent)",
          backdropFilter: "blur(12px)",
          WebkitBackdropFilter: "blur(12px)",
          border: "1px solid var(--border-default)",
        }}
      >
        <div className="text-[12px]" style={{ color: "var(--fg-muted)" }}>
          Approving activates Carbo and creates your Carbon Reserve sub-account.
        </div>
        <Button onClick={approve} disabled={busy}>
          {busy ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <CheckCircle2 className="h-4 w-4" />
          )}
          Approve &amp; activate
        </Button>
      </div>
    </div>
  );
};

const ReviewStat = ({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: boolean;
}) => (
  <div
    className="rounded-[12px] p-4 flex flex-col gap-2"
    style={{
      background: "var(--bg-surface)",
      border: "1px solid var(--border-default)",
    }}
  >
    <CodeLabel>{label}</CodeLabel>
    <div
      className="text-[24px] tabular-nums tracking-[-0.01em] leading-none"
      style={{
        color: accent ? "var(--brand-green)" : "var(--fg-primary)",
        fontWeight: 400,
      }}
    >
      {value}
    </div>
  </div>
);

const TabBtn = ({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}) => (
  <button
    type="button"
    onClick={onClick}
    className="relative text-[13px] font-medium px-3 py-2 transition-colors"
    style={{ color: active ? "var(--fg-primary)" : "var(--fg-muted)" }}
  >
    {children}
    {active && (
      <span
        className="absolute left-2 right-2 -bottom-px h-[2px] rounded-full"
        style={{ background: "var(--brand-green)" }}
      />
    )}
  </button>
);

/* ────────────────────────────────────────────────────────────
   Done
   ──────────────────────────────────────────────────────────── */

const DoneStep = ({ seedCloseRunId }: { seedCloseRunId: string | null }) => (
  <div className="flex flex-col items-start gap-7 max-w-lg mx-auto w-full">
    <div
      className="w-11 h-11 rounded-[12px] grid place-items-center"
      style={{
        background: "var(--bg-inset)",
        border: "1px solid var(--brand-green-border)",
        color: "var(--brand-green)",
      }}
    >
      <CheckCircle2 className="h-5 w-5" />
    </div>
    <CodeLabel>All set</CodeLabel>
    <Headline>Carbo is live.</Headline>
    <Sublead>
      Your policy is active and your Carbon Reserve sub-account is ready.{" "}
      {seedCloseRunId
        ? "We seeded a first monthly close so your dashboard has real data right away."
        : "We'll run your first close automatically at month-end once transactions arrive."}
    </Sublead>
    <div className="flex flex-col sm:flex-row gap-3 mt-2">
      <Link href="/">
        <Button>
          Open dashboard
          <ArrowRight className="h-4 w-4" />
        </Button>
      </Link>
      {seedCloseRunId && (
        <Link href={`/close/${seedCloseRunId}`}>
          <Button variant="secondary">
            See first close
            <ArrowRight className="h-4 w-4" />
          </Button>
        </Link>
      )}
    </div>
  </div>
);

/* ────────────────────────────────────────────────────────────
   Reset
   ──────────────────────────────────────────────────────────── */

const ResetLink = ({ runId }: { runId: string }) => {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const cancel = async () => {
    if (!confirm("Cancel this onboarding? You can start a new one after.")) return;
    setBusy(true);
    try {
      await fetch(`/api/onboarding/${runId}/cancel`, { method: "POST" });
      router.push("/onboarding");
    } finally {
      setBusy(false);
    }
  };
  return (
    <button
      type="button"
      onClick={cancel}
      disabled={busy}
      className="inline-flex items-center gap-1.5 hover:text-[var(--status-danger)] transition-colors"
      style={{
        color: "var(--fg-muted)",
        fontFamily: "var(--font-mono)",
        fontSize: "12px",
        textTransform: "uppercase",
        letterSpacing: "1.2px",
      }}
    >
      {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : <X className="h-3 w-3" />}
      Start over
    </button>
  );
};
