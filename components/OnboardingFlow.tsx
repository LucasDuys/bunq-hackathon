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
import { Button } from "@/components/ui";
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
    style={{ animation: "ob-step-in 380ms cubic-bezier(.22,.8,.2,1) both" }}
  >
    {children}
  </div>
);

const ProgressRail = ({ value }: { value: number }) => (
  <div
    className="fixed top-0 left-0 right-0 h-[3px] z-40"
    style={{ background: "rgba(255,255,255,0.04)" }}
    aria-hidden
  >
    <div
      className="h-full"
      style={{
        width: `${Math.max(4, Math.min(100, value * 100))}%`,
        background: "linear-gradient(90deg, var(--green-soft), var(--green-bright) 70%, var(--green-bright))",
        boxShadow: "0 0 12px rgba(74,222,128,0.45)",
        transition: "width 600ms cubic-bezier(.22,.8,.2,1)",
      }}
    />
  </div>
);

const Eyebrow = ({ children }: { children: ReactNode }) => (
  <div
    className="text-[11px] uppercase tracking-[0.14em] font-semibold flex items-center gap-2"
    style={{ color: "var(--green-bright)" }}
  >
    <span
      className="inline-block w-1.5 h-1.5 rounded-full"
      style={{ background: "var(--green-bright)", boxShadow: "0 0 8px var(--green-bright)" }}
    />
    {children}
  </div>
);

const Headline = ({ children }: { children: ReactNode }) => (
  <h1
    className="font-serif text-[44px] md:text-[56px] leading-[1.02] tracking-[-0.02em]"
    style={{ color: "var(--text)", textWrap: "balance" }}
  >
    {children}
  </h1>
);

const Sublead = ({ children }: { children: ReactNode }) => (
  <p
    className="text-base md:text-lg leading-relaxed max-w-[38rem]"
    style={{ color: "var(--text-dim)", textWrap: "pretty" }}
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
  const progress = (stepOrder.indexOf(step) + 1) / 8; // ~8 implicit future steps in full flow

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
            <div className="flex flex-col items-center text-center gap-8 max-w-2xl mx-auto">
              <div
                className="w-16 h-16 rounded-2xl grid place-items-center"
                style={{
                  background: "linear-gradient(180deg, rgba(74,222,128,0.18), rgba(48,192,111,0.06))",
                  border: "1px solid rgba(74,222,128,0.22)",
                  boxShadow: "0 0 40px rgba(74,222,128,0.18)",
                }}
              >
                <Leaf className="h-7 w-7" style={{ color: "var(--green-bright)" }} />
              </div>

              <Eyebrow>Welcome to Carbo</Eyebrow>
              <Headline>
                Your carbon close, <span className="grad-text-green">on autopilot.</span>
              </Headline>
              <Sublead>
                In the next few minutes we&apos;ll calibrate Carbo to your business — reserve rules, credit
                preferences, and CSRD-ready reporting. You approve everything before anything goes live.
              </Sublead>

              <div className="flex flex-col items-center gap-3 mt-2">
                <Button onClick={() => go("company")} className="gap-2 h-12 px-7 text-[15px]">
                  Let&apos;s begin
                  <ArrowRight className="h-4 w-4" />
                </Button>
                <div className="text-xs" style={{ color: "var(--text-mute)" }}>
                  Takes about 3 minutes · nothing activates without approval
                </div>
              </div>

              {hasActivePolicy && (
                <div
                  className="mt-6 text-xs px-3 py-1.5 rounded-full"
                  style={{
                    color: "var(--amber)",
                    background: "rgba(217,164,65,0.08)",
                    border: "1px solid rgba(217,164,65,0.22)",
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
            <div className="flex flex-col gap-8 max-w-xl mx-auto w-full">
              <Eyebrow>Step 1 of 3</Eyebrow>
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
                  onKeyDown={(e) => e.key === "Enter" && companyName.trim() && go("track")}
                  placeholder="Acme BV"
                  className="w-full bg-transparent font-serif text-[36px] md:text-[44px] tracking-[-0.02em] pb-3 focus-visible:outline-none"
                  style={{
                    color: "var(--text)",
                    borderBottom: "1px solid var(--border-strong)",
                    caretColor: "var(--green-bright)",
                  }}
                />
              </div>

              <div className="flex items-center justify-between pt-4">
                <button
                  type="button"
                  onClick={() => go("welcome")}
                  className="text-sm hover:underline"
                  style={{ color: "var(--text-mute)" }}
                >
                  ← Back
                </button>
                <Button
                  onClick={() => go("track")}
                  disabled={!companyName.trim()}
                  className="gap-2 h-12 px-7 text-[15px]"
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
            <div className="flex flex-col gap-8 max-w-3xl mx-auto w-full">
              <Eyebrow>Step 2 of 3</Eyebrow>
              <Headline>How would you like to set things up?</Headline>
              <Sublead>
                Pick the path that fits you. You can upload an existing policy, have Carbo draft one for you,
                or blend both.
              </Sublead>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-4">
                <TrackCard
                  active={track === "generate"}
                  onClick={() => setTrack("generate")}
                  icon={<MessageCircle className="h-5 w-5" />}
                  title="Guide me through it"
                  blurb="A few short questions and we&apos;ll draft a full policy calibrated to your business."
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
                <div className="text-sm" style={{ color: "var(--red)" }}>
                  {error}
                </div>
              )}

              <div className="flex items-center justify-between pt-4">
                <button
                  type="button"
                  onClick={() => go("company")}
                  className="text-sm hover:underline"
                  style={{ color: "var(--text-mute)" }}
                >
                  ← Back
                </button>
                <Button
                  onClick={start}
                  disabled={!track || busy}
                  className="gap-2 h-12 px-7 text-[15px]"
                >
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
    className="ob-track-card text-left flex flex-col gap-3 p-5 rounded-2xl relative"
    data-active={active}
    style={{
      background: active
        ? "linear-gradient(180deg, rgba(74,222,128,0.08), rgba(48,192,111,0.02))"
        : "linear-gradient(180deg, var(--bg-card) 0%, var(--bg-card-2) 100%)",
      border: `1px solid ${active ? "rgba(74,222,128,0.45)" : "var(--border)"}`,
      boxShadow: active
        ? "0 0 0 4px rgba(74,222,128,0.08), 0 12px 32px rgba(0,0,0,0.28)"
        : "var(--shadow-card)",
      transition: "transform 160ms ease, border-color 160ms, box-shadow 200ms, background 200ms",
    }}
  >
    <div className="flex items-center justify-between">
      <div
        className="w-9 h-9 rounded-xl grid place-items-center"
        style={{
          background: active ? "rgba(74,222,128,0.14)" : "var(--bg-inset)",
          color: active ? "var(--green-bright)" : "var(--text-dim)",
          border: `1px solid ${active ? "rgba(74,222,128,0.28)" : "var(--border-faint)"}`,
          transition: "background 200ms, color 200ms",
        }}
      >
        {icon}
      </div>
      <span
        className="text-[10.5px] uppercase tracking-[0.08em] font-semibold"
        style={{ color: "var(--text-mute)" }}
      >
        {time}
      </span>
    </div>
    <div className="font-semibold text-[15px]" style={{ color: "var(--text)" }}>
      {title}
    </div>
    <div className="text-[13px] leading-relaxed" style={{ color: "var(--text-dim)" }}>
      {blurb}
    </div>
    {active && (
      <div
        className="absolute top-3 right-3 w-5 h-5 rounded-full grid place-items-center"
        style={{ background: "var(--green-bright)", color: "#08140c" }}
      >
        <CheckCircle2 className="h-3.5 w-3.5" />
      </div>
    )}
  </button>
);

/* ────────────────────────────────────────────────────────────
   Run flow (post-start): upload → interview → draft → review → done
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
  const isTransitional = data.state === "UPLOAD_PARSING" || data.state === "DRAFT_POLICY" || data.state === "FINALIZE" || data.state === "SEED_FIRST_CLOSE";

  // Gentle polling when a server-side transition is in flight
  useEffect(() => {
    if (!isTransitional) return;
    const t = setInterval(() => router.refresh(), 1600);
    return () => clearInterval(t);
  }, [isTransitional, router]);

  const progress = STATE_WEIGHTS[data.state] ?? 0.4;
  const needsUpload = data.state === "INIT" && (data.track === "upload" || data.track === "mix");
  const questionPct = data.pendingQa ? Math.min(1, data.questionCount / 12) : 0;

  return (
    <>
      <ProgressRail value={progress} />

      <div className="ob-shell">
        {/* Tiny meta strip */}
        <div className="ob-meta flex items-center justify-between max-w-3xl mx-auto w-full mb-8">
          <div className="flex items-center gap-2.5">
            <Leaf className="h-4 w-4" style={{ color: "var(--green-bright)" }} />
            <span className="text-[11px] uppercase tracking-[0.14em] font-semibold" style={{ color: "var(--text-mute)" }}>
              Setup · {data.orgName}
            </span>
          </div>
          {data.state !== "COMPLETED" && <ResetLink runId={data.runId} />}
        </div>

        {needsUpload && (
          <Stage stepKey="upload">
            <div className="flex flex-col gap-7 max-w-2xl mx-auto w-full">
              <Eyebrow>Upload your policy</Eyebrow>
              <Headline>Drop in what you already have.</Headline>
              <Sublead>
                PDF, DOCX, Markdown, YAML, JSON — we&apos;ll parse it, map it to Carbo&apos;s schema, and only ask
                about what&apos;s missing.
              </Sublead>

              <UploadDrop runId={data.runId} />
              <div className="text-xs" style={{ color: "var(--text-mute)" }}>
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

        {data.unsupported.length > 0 && data.pendingQa === null && data.state !== "AWAITING_APPROVAL" && !needsUpload && (
          <Stage stepKey="unsupported">
            <div className="flex flex-col gap-5 max-w-2xl mx-auto w-full">
              <Eyebrow>Heads up</Eyebrow>
              <Headline>A few things from your document need attention.</Headline>
              <div className="flex flex-col gap-2.5 mt-2">
                {data.unsupported.map((u, i) => (
                  <div
                    key={i}
                    className="flex items-start gap-3 p-4 rounded-xl"
                    style={{
                      background: "var(--bg-card)",
                      border: "1px solid var(--border)",
                    }}
                  >
                    <div
                      className="mt-0.5 text-[10px] uppercase tracking-wide font-semibold px-2 py-0.5 rounded-full"
                      style={{
                        color: u.severity === "error" ? "var(--red)" : "var(--amber)",
                        background: u.severity === "error" ? "rgba(224,111,111,0.1)" : "rgba(217,164,65,0.1)",
                        border: `1px solid ${u.severity === "error" ? "rgba(224,111,111,0.24)" : "rgba(217,164,65,0.24)"}`,
                      }}
                    >
                      {u.severity}
                    </div>
                    <div className="flex-1">
                      <div className="font-medium text-sm" style={{ color: "var(--text)" }}>
                        {u.found}
                      </div>
                      <div className="text-xs mt-0.5" style={{ color: "var(--text-mute)" }}>
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
              <div className="flex items-center justify-between">
                <Eyebrow>
                  Question {data.questionCount} · up to 12
                </Eyebrow>
                <div
                  className="flex-1 ml-5 h-[2px] rounded-full overflow-hidden"
                  style={{ background: "rgba(255,255,255,0.05)" }}
                >
                  <div
                    className="h-full"
                    style={{
                      width: `${Math.round(questionPct * 100)}%`,
                      background: "var(--green-bright)",
                      transition: "width 400ms ease-out",
                    }}
                  />
                </div>
              </div>

              <Headline>{data.pendingQa.question}</Headline>

              {data.pendingQa.rationale && (
                <Sublead>{data.pendingQa.rationale}</Sublead>
              )}

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
                    className="text-xs cursor-pointer select-none inline-flex items-center gap-1.5"
                    style={{ color: "var(--text-mute)" }}
                  >
                    <Sparkles className="h-3 w-3" />
                    What you&apos;ve told me so far ({data.answeredQa.length})
                  </summary>
                  <div
                    className="mt-3 flex flex-col gap-1.5 pl-4"
                    style={{ borderLeft: "1px solid var(--border)" }}
                  >
                    {data.answeredQa.map((q) => (
                      <div key={q.id} className="flex justify-between gap-4 text-xs py-1">
                        <span style={{ color: "var(--text-mute)" }}>{q.question}</span>
                        <span
                          className="font-medium truncate max-w-[50%] text-right"
                          style={{ color: "var(--text-dim)" }}
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

        {/* Profile peek — unobtrusive footer once we have any */}
        {Object.keys(data.profile).length > 0 && data.state !== "COMPLETED" && (
          <div className="max-w-2xl mx-auto w-full mt-10 pt-6" style={{ borderTop: "1px solid var(--border-faint)" }}>
            <div className="text-[10px] uppercase tracking-[0.14em] font-semibold mb-3" style={{ color: "var(--text-faint)" }}>
              What Carbo knows so far
            </div>
            <div className="flex flex-wrap gap-2">
              {Object.entries(data.profile).map(([k, v]) => (
                <span
                  key={k}
                  className="text-[11px] px-2.5 py-1 rounded-full"
                  style={{
                    color: "var(--text-dim)",
                    background: "var(--bg-card)",
                    border: "1px solid var(--border)",
                  }}
                >
                  <span style={{ color: "var(--text-mute)" }}>{k}</span>
                  <span className="mx-1" style={{ color: "var(--text-faint)" }}>·</span>
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
   Busy / animated waiting state
   ──────────────────────────────────────────────────────────── */

const BusyScreen = ({ title, subtitle }: { title: string; subtitle: string }) => (
  <div className="flex flex-col items-center text-center gap-6 max-w-lg mx-auto">
    <div className="relative">
      <div
        className="w-20 h-20 rounded-full"
        style={{
          background: "radial-gradient(circle at 50% 40%, rgba(74,222,128,0.18), transparent 70%)",
          animation: "ob-pulse 2.4s ease-in-out infinite",
        }}
      />
      <Loader2
        className="absolute inset-0 m-auto h-6 w-6 animate-spin"
        style={{ color: "var(--green-bright)" }}
      />
    </div>
    <Headline>{title}</Headline>
    <Sublead>{subtitle}</Sublead>
    <div className="ob-dots mt-2" aria-hidden>
      <span />
      <span />
      <span />
    </div>
  </div>
);

/* ────────────────────────────────────────────────────────────
   Answer form (typeform-style, big + focused)
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
                <span className="text-[15px]" style={{ color: "var(--text)" }}>
                  {o}
                </span>
              </span>
              {busy === o ? (
                <Loader2 className="h-4 w-4 animate-spin" style={{ color: "var(--green-bright)" }} />
              ) : (
                <ArrowRight
                  className="h-4 w-4 opacity-0 group-hover:opacity-100 transition-opacity"
                  style={{ color: "var(--green-bright)" }}
                />
              )}
            </button>
          ))}
        </div>
      )}

      {kind === "confirm" && (
        <div className="flex gap-2">
          <Button disabled={busy !== null} onClick={() => submit("Yes", "yes")} className="gap-2 h-12 px-7">
            {busy === "yes" && <Loader2 className="h-4 w-4 animate-spin" />}
            Yes
          </Button>
          <Button
            variant="secondary"
            disabled={busy !== null}
            onClick={() => submit("No", "no")}
            className="gap-2 h-12 px-7"
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
            style={{ borderBottom: "1px solid var(--border-strong)" }}
          >
            <span className="font-serif text-[28px]" style={{ color: "var(--text-mute)" }}>
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
              className="bg-transparent outline-none tabular-nums font-serif text-[32px] flex-1 min-w-0"
              style={{ color: "var(--text)", caretColor: "var(--green-bright)" }}
              placeholder="0"
            />
          </div>
          <Button type="submit" disabled={busy !== null || !text.trim()} className="gap-2 h-12 px-7">
            {busy !== null ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
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
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey) && text.trim()) submit(text.trim());
            }}
            rows={3}
            placeholder="Type your answer…"
            className="w-full bg-transparent p-4 rounded-xl text-[15px] leading-relaxed resize-none focus-visible:outline-none"
            style={{
              color: "var(--text)",
              background: "var(--bg-card)",
              border: "1px solid var(--border-strong)",
              caretColor: "var(--green-bright)",
            }}
          />
          <div className="flex items-center justify-between">
            <span className="text-[11px]" style={{ color: "var(--text-faint)" }}>
              ⌘ + Enter to submit
            </span>
            <div className="flex items-center gap-2">
              {!required && (
                <Button type="button" variant="ghost" disabled={busy !== null} onClick={skip}>
                  Skip
                </Button>
              )}
              <Button type="submit" disabled={busy !== null || !text.trim()} className="gap-2 h-11 px-6">
                {busy !== null ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
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
          className="text-xs self-start hover:underline disabled:opacity-50"
          style={{ color: "var(--text-mute)" }}
        >
          Skip this one
        </button>
      )}

      {error && (
        <div className="text-sm" style={{ color: "var(--red)" }}>
          {error}
        </div>
      )}
    </div>
  );
};

/* ────────────────────────────────────────────────────────────
   Upload drop (fullscreen-friendly)
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
      const resp = await fetch(`/api/onboarding/${runId}/upload`, { method: "POST", body: form });
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
          className="w-14 h-14 rounded-2xl grid place-items-center"
          style={{
            background: busy ? "rgba(74,222,128,0.14)" : "var(--bg-inset)",
            border: "1px solid var(--border)",
            color: busy ? "var(--green-bright)" : "var(--text-dim)",
            transition: "background 200ms, color 200ms",
          }}
        >
          {busy ? (
            <Loader2 className="h-6 w-6 animate-spin" />
          ) : filename ? (
            <CheckCircle2 className="h-6 w-6" style={{ color: "var(--green-bright)" }} />
          ) : (
            <Upload className="h-6 w-6" />
          )}
        </div>
        <div className="text-[15px]" style={{ color: "var(--text)" }}>
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
                style={{ color: "var(--green-bright)" }}
              >
                choose one
              </button>
            </>
          )}
        </div>
        <div className="text-[11px] uppercase tracking-[0.12em]" style={{ color: "var(--text-mute)" }}>
          PDF · DOCX · MD · YAML · JSON · TXT
        </div>
        {error && (
          <div className="text-sm mt-2" style={{ color: "var(--red)" }}>
            {error}
          </div>
        )}
      </div>
    </div>
  );
};

/* ────────────────────────────────────────────────────────────
   Review step
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
      const resp = await fetch(`/api/onboarding/${runId}/approve`, { method: "POST" });
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
      <Eyebrow>Final review</Eyebrow>
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

      <div
        className="rounded-2xl overflow-hidden"
        style={{
          background: "var(--bg-card)",
          border: "1px solid var(--border)",
          boxShadow: "var(--shadow-card)",
        }}
      >
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
            className="ml-auto mr-1 mb-0.5 inline-flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-md hover:bg-[var(--bg-hover)]"
            style={{ color: "var(--text-dim)" }}
          >
            <FileText className="h-3.5 w-3.5" /> Download .md
          </button>
        </div>

        {view === "rules" && (
          <div className="overflow-x-auto px-5 py-4">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="text-left text-[10px] uppercase tracking-[0.1em]" style={{ color: "var(--text-mute)" }}>
                  <th className="py-2 pr-4 font-semibold">Category</th>
                  <th className="py-2 pr-4 font-semibold">Method</th>
                  <th className="py-2 pr-4 text-right font-semibold">Value</th>
                </tr>
              </thead>
              <tbody className="tabular-nums">
                {draft.reserveRules.map((r, i) => (
                  <tr
                    key={i}
                    className="text-[13px]"
                    style={{ borderTop: "1px solid var(--border-faint)" }}
                  >
                    <td className="py-2.5 pr-4 font-medium" style={{ color: "var(--text)" }}>
                      {r.category}
                    </td>
                    <td className="py-2.5 pr-4" style={{ color: "var(--text-dim)" }}>
                      {r.method.replace(/_/g, " ")}
                    </td>
                    <td className="py-2.5 pr-4 text-right" style={{ color: "var(--text)" }}>
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
            className="whitespace-pre-wrap text-[13px] leading-[1.6] font-mono px-5 py-4 max-h-[420px] overflow-auto"
            style={{ color: "var(--text-dim)" }}
          >
            {markdown}
          </pre>
        )}
      </div>

      {creditShortlist.length > 0 && (
        <div
          className="rounded-2xl p-5"
          style={{
            background: "var(--bg-card)",
            border: "1px solid var(--border)",
          }}
        >
          <div
            className="text-[10px] uppercase tracking-[0.12em] font-semibold mb-3"
            style={{ color: "var(--text-mute)" }}
          >
            Initial credit shortlist
          </div>
          <ul className="flex flex-col gap-2">
            {creditShortlist.map((id) => {
              const p = CREDIT_PROJECTS.find((pp) => pp.id === id);
              if (!p) return (
                <li key={id} className="text-[11px] font-mono" style={{ color: "var(--text-mute)" }}>
                  {id}
                </li>
              );
              return (
                <li key={id} className="flex items-center justify-between text-[13px]">
                  <span style={{ color: "var(--text)" }}>
                    {p.name}{" "}
                    <span style={{ color: "var(--text-mute)" }}>· {p.country}</span>
                  </span>
                  <span className="tabular-nums font-semibold" style={{ color: "var(--green-bright)" }}>
                    €{p.pricePerTonneEur}
                    <span className="text-[11px]" style={{ color: "var(--text-mute)" }}>/t</span>
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {calibrationNotes && (
        <div
          className="rounded-2xl p-5 text-[13px] leading-relaxed"
          style={{
            background: "rgba(107,155,210,0.04)",
            border: "1px solid rgba(107,155,210,0.14)",
            color: "var(--text-dim)",
          }}
        >
          <div
            className="text-[10px] uppercase tracking-[0.12em] font-semibold mb-2 flex items-center gap-1.5"
            style={{ color: "var(--blue)" }}
          >
            <Sparkles className="h-3 w-3" /> Calibration notes
          </div>
          {calibrationNotes}
        </div>
      )}

      {error && (
        <div className="text-sm" style={{ color: "var(--red)" }}>
          {error}
        </div>
      )}

      <div
        className="sticky bottom-4 flex items-center justify-between gap-4 p-4 rounded-2xl"
        style={{
          background: "rgba(20,22,26,0.86)",
          backdropFilter: "blur(12px)",
          WebkitBackdropFilter: "blur(12px)",
          border: "1px solid var(--border-strong)",
          boxShadow: "var(--shadow-pop)",
        }}
      >
        <div className="text-xs" style={{ color: "var(--text-mute)" }}>
          Approving activates Carbo and creates your Carbon Reserve sub-account.
        </div>
        <Button onClick={approve} disabled={busy} className="gap-2 h-12 px-7 text-[15px]">
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
          Approve &amp; activate
        </Button>
      </div>
    </div>
  );
};

const ReviewStat = ({ label, value, accent }: { label: string; value: string; accent?: boolean }) => (
  <div
    className="rounded-xl p-4"
    style={{
      background: "var(--bg-card)",
      border: "1px solid var(--border)",
    }}
  >
    <div
      className="text-[10px] uppercase tracking-[0.12em] font-semibold mb-1.5"
      style={{ color: "var(--text-mute)" }}
    >
      {label}
    </div>
    <div
      className="font-serif text-[24px] tabular-nums tracking-[-0.01em]"
      style={{ color: accent ? "var(--green-bright)" : "var(--text)" }}
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
    style={{ color: active ? "var(--text)" : "var(--text-mute)" }}
  >
    {children}
    {active && (
      <span
        className="absolute left-2 right-2 -bottom-px h-[2px] rounded-full"
        style={{ background: "var(--green-bright)" }}
      />
    )}
  </button>
);

/* ────────────────────────────────────────────────────────────
   Done
   ──────────────────────────────────────────────────────────── */

const DoneStep = ({ seedCloseRunId }: { seedCloseRunId: string | null }) => (
  <div className="flex flex-col items-center text-center gap-7 max-w-lg mx-auto">
    <div
      className="w-20 h-20 rounded-full grid place-items-center"
      style={{
        background: "radial-gradient(circle, rgba(74,222,128,0.22), rgba(74,222,128,0.02) 70%)",
        animation: "ob-pulse 2.4s ease-in-out infinite",
      }}
    >
      <CheckCircle2 className="h-10 w-10" style={{ color: "var(--green-bright)" }} />
    </div>
    <Eyebrow>All set</Eyebrow>
    <Headline>
      Carbo is <span className="grad-text-green">live.</span>
    </Headline>
    <Sublead>
      Your policy is active and your Carbon Reserve sub-account is ready. {seedCloseRunId
        ? "We seeded a first monthly close so your dashboard has real data right away."
        : "We'll run your first close automatically at month-end once transactions arrive."}
    </Sublead>
    <div className="flex flex-col sm:flex-row gap-3 mt-2">
      <Link href="/">
        <Button className="gap-2 h-12 px-7 text-[15px]">
          Open dashboard
          <ArrowRight className="h-4 w-4" />
        </Button>
      </Link>
      {seedCloseRunId && (
        <Link href={`/close/${seedCloseRunId}`}>
          <Button variant="secondary" className="gap-2 h-12 px-7 text-[15px]">
            See first close
            <ArrowRight className="h-4 w-4" />
          </Button>
        </Link>
      )}
    </div>
  </div>
);

/* ────────────────────────────────────────────────────────────
   Reset / cancel link
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
      className="text-[11px] uppercase tracking-[0.12em] font-semibold inline-flex items-center gap-1.5 hover:text-[var(--red)] transition-colors"
      style={{ color: "var(--text-mute)" }}
    >
      {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : <X className="h-3 w-3" />}
      Start over
    </button>
  );
};
