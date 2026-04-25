"use client";

import { Sparkles } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { ExplainComposer, type ExplainComposerHandle } from "./ExplainComposer";
import { ExplainThread } from "./ExplainThread";
import { useExplain } from "./ExplainProvider";
import { Badge, CodeLabel } from "./ui";
import {
  METRIC_REGISTRY,
  isMetricKey,
  type MetricKey,
  type ScopeArgs,
} from "@/lib/explain/metrics";

const decodeScope = (raw: string | null): ScopeArgs => {
  if (!raw) return {};
  try {
    const bin = atob(raw);
    const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
    const json = new TextDecoder().decode(bytes);
    const parsed = JSON.parse(json);
    return typeof parsed === "object" && parsed ? (parsed as ScopeArgs) : {};
  } catch {
    return {};
  }
};

export const AssistantWorkspace = ({
  initialMetric,
  initialScope,
}: {
  initialMetric: string | null;
  initialScope: string | null;
}) => {
  const {
    metric,
    scope,
    messages,
    headline,
    status,
    error,
    openExplain,
    ask,
    stop,
  } = useExplain();
  const composerRef = useRef<ExplainComposerHandle | null>(null);
  const threadScrollRef = useRef<HTMLDivElement | null>(null);
  const [hydrated, setHydrated] = useState(false);

  // Hydrate provider state from URL on mount, then focus the composer.
  useEffect(() => {
    if (hydrated) return;
    setHydrated(true);
    const m = initialMetric;
    if (m && isMetricKey(m) && metric !== m) {
      openExplain({ metric: m as MetricKey, scope: decodeScope(initialScope) });
    } else if (!metric) {
      openExplain({ metric: "free-form" });
    }
    setTimeout(() => composerRef.current?.focus(), 200);
  }, [hydrated, initialMetric, initialScope, metric, openExplain]);

  // Auto-scroll thread to bottom while streaming, but only if the user
  // hasn't scrolled up to read earlier messages.
  useEffect(() => {
    const el = threadScrollRef.current;
    if (!el) return;
    const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
    if (nearBottom) el.scrollTop = el.scrollHeight;
  }, [messages, headline, status]);

  const entry = metric ? METRIC_REGISTRY[metric] : null;
  const chips = entry ? entry.scopeChips(scope) : [];
  const streaming = status === "streaming";
  const showFollowUps =
    !!entry &&
    !streaming &&
    messages.length > 0 &&
    messages[messages.length - 1].role === "assistant";

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex flex-col gap-3">
        <div className="flex items-center gap-2">
          <Sparkles
            className="h-3.5 w-3.5 shrink-0"
            style={{ color: "var(--brand-green)" }}
            aria-hidden
          />
          <CodeLabel>Assistant{entry ? ` · ${entry.label}` : ""}</CodeLabel>
        </div>
        <h1
          className="text-[36px] leading-[1.05] tracking-[-0.015em] m-0"
          style={{ color: "var(--fg-primary)" }}
        >
          Ask anything about your carbon accounting.
        </h1>
        <p
          className="text-[14px] leading-[1.55] m-0 max-w-[60ch]"
          style={{ color: "var(--fg-secondary)" }}
        >
          The assistant has full context: transactions, factors, policy,
          calibration, audit ledger. Numbers come straight from your data.
        </p>
      </div>

      {/* Scope chips */}
      {chips.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {chips.map((chip) => (
            <Badge key={chip.label} tone="default">
              <span
                className="code-label"
                style={{ color: "var(--fg-muted)", marginRight: 6 }}
              >
                {chip.label}
              </span>
              <span style={{ color: "var(--fg-primary)" }}>{chip.value}</span>
            </Badge>
          ))}
        </div>
      )}

      {/* Card-shell containing thread + composer */}
      <div
        className="flex flex-col rounded-[16px]"
        style={{
          background: "var(--bg-canvas)",
          border: "1px solid var(--border-default)",
          minHeight: 480,
        }}
      >
        <div
          ref={threadScrollRef}
          className="flex-1 overflow-y-auto px-7 py-7 rounded-t-[16px]"
          style={{ maxHeight: "min(60dvh, 720px)" }}
        >
          <ExplainThread
            messages={messages}
            headline={headline}
            streaming={streaming}
            error={error}
          />
        </div>

        {showFollowUps && entry && (
          <div className="explain-followups" style={{ padding: "12px 24px" }}>
            <CodeLabel className="block mb-2">Suggested</CodeLabel>
            <div className="flex flex-wrap gap-2">
              {entry.followUps.map((q) => (
                <button
                  key={q}
                  type="button"
                  onClick={() => ask(q)}
                  disabled={streaming}
                  className="explain-followup"
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="explain-footer" style={{ padding: "14px 24px 18px" }}>
          <ExplainComposer
            ref={composerRef}
            streaming={streaming}
            onSubmit={ask}
            onStop={stop}
            placeholder={messages.length === 0 ? "Ask anything…" : "Ask a follow-up…"}
          />
        </div>
      </div>

      {/* Quick-pick metrics when there's no active scope */}
      {(!entry || entry.label === "Ask the assistant") && (
        <div className="flex flex-col gap-2 mt-2">
          <CodeLabel>Or jump to</CodeLabel>
          <div className="flex flex-wrap gap-2">
            {(["month-co2e", "month-confidence", "month-reserve", "trend", "impact-summary", "ledger"] as MetricKey[]).map((k) => (
              <button
                key={k}
                type="button"
                onClick={() => openExplain({ metric: k })}
                className="explain-followup"
              >
                {METRIC_REGISTRY[k].label}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
