"use client";

import { ArrowUpRight, X, Sparkles, Maximize2, Minimize2 } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useExplain } from "./ExplainProvider";
import { ExplainThread } from "./ExplainThread";
import { ExplainComposer, type ExplainComposerHandle } from "./ExplainComposer";
import { Badge, CodeLabel } from "./ui";
import { METRIC_REGISTRY } from "@/lib/explain/metrics";

const encodeScope = (scope: Record<string, unknown>): string => {
  if (typeof window === "undefined") return "";
  try {
    const json = JSON.stringify(scope ?? {});
    const bytes = new TextEncoder().encode(json);
    let bin = "";
    for (const b of bytes) bin += String.fromCharCode(b);
    return btoa(bin);
  } catch {
    return "";
  }
};

export const ExplainModal = () => {
  const { open, metric, scope, messages, headline, status, error, ask, stop, close } = useExplain();
  const pathname = usePathname();
  const [mounted, setMounted] = useState(false);
  const [visible, setVisible] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const composerRef = useRef<ExplainComposerHandle | null>(null);
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const threadScrollRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => setMounted(true), []);

  // Reset expand state each time the modal closes so the next open feels predictable.
  useEffect(() => {
    if (!open) setExpanded(false);
  }, [open]);

  // Suppress the modal on the full-page assistant route — the page renders
  // the same provider state inline at full width.
  const onAssistantPage = pathname === "/assistant" || pathname?.startsWith("/assistant/");

  // Animate in/out: drive `visible` one frame after `open` toggles.
  useLayoutEffect(() => {
    if (open) {
      const id = requestAnimationFrame(() => setVisible(true));
      return () => cancelAnimationFrame(id);
    }
    setVisible(false);
  }, [open]);

  // Focus composer when the dialog mounts.
  useEffect(() => {
    if (open) {
      const t = setTimeout(() => composerRef.current?.focus(), 100);
      return () => clearTimeout(t);
    }
  }, [open]);

  // Auto-scroll to bottom while streaming, but only when near the bottom.
  useEffect(() => {
    if (!threadScrollRef.current) return;
    const el = threadScrollRef.current;
    const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
    if (nearBottom) el.scrollTop = el.scrollHeight;
  }, [messages, headline, status]);

  // Lightweight focus trap: cycle Tab inside the dialog + ESC to close.
  useEffect(() => {
    if (!open || !dialogRef.current) return;
    const dlg = dialogRef.current;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        close();
        return;
      }
      if (e.key !== "Tab") return;
      const focusables = dlg.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])',
      );
      if (focusables.length === 0) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      const active = document.activeElement as HTMLElement | null;
      if (e.shiftKey && active === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
      }
    };
    dlg.addEventListener("keydown", onKey);
    return () => dlg.removeEventListener("keydown", onKey);
  }, [open, close]);

  if (!mounted || !open || !metric || onAssistantPage) return null;

  const entry = METRIC_REGISTRY[metric];
  const chips = entry.scopeChips(scope);
  const streaming = status === "streaming";
  const showFollowUps =
    !streaming && messages.length > 0 && messages[messages.length - 1].role === "assistant";

  const fullViewHref = `/assistant?metric=${encodeURIComponent(metric)}&scope=${encodeURIComponent(encodeScope(scope))}`;

  return createPortal(
    <div
      className="explain-overlay"
      data-visible={visible ? "true" : "false"}
      data-expanded={expanded ? "true" : "false"}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) close();
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="explain-title"
        className="explain-dialog"
        data-visible={visible ? "true" : "false"}
        data-expanded={expanded ? "true" : "false"}
      >
        {/* ── Header ── */}
        <div className="explain-header">
          <div className="flex items-center gap-2 min-w-0">
            <Sparkles
              className="h-3.5 w-3.5 shrink-0"
              style={{ color: "var(--brand-green)" }}
              aria-hidden
            />
            <CodeLabel id="explain-title">Explain · {entry.label}</CodeLabel>
          </div>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setExpanded((v) => !v)}
              aria-label={expanded ? "Collapse" : "Expand to full screen"}
              aria-pressed={expanded}
              title={expanded ? "Collapse" : "Expand to full screen"}
              className="explain-icon-btn"
            >
              {expanded ? (
                <Minimize2 className="h-3.5 w-3.5" aria-hidden />
              ) : (
                <Maximize2 className="h-3.5 w-3.5" aria-hidden />
              )}
            </button>
            <Link
              href={fullViewHref}
              onClick={close}
              aria-label="Open in dedicated page"
              title="Open in dedicated page"
              className="explain-icon-btn"
            >
              <ArrowUpRight className="h-3.5 w-3.5" aria-hidden />
            </Link>
            <button
              type="button"
              onClick={close}
              aria-label="Close"
              title="Close (ESC)"
              className="explain-icon-btn"
            >
              <X className="h-3.5 w-3.5" aria-hidden />
            </button>
          </div>
        </div>

        {/* ── Scope chips ── */}
        {chips.length > 0 && (
          <div className="explain-scope">
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

        {/* ── Thread ── */}
        <div className="explain-thread-scroll" ref={threadScrollRef}>
          <ExplainThread
            messages={messages}
            headline={headline}
            streaming={streaming}
            error={error}
          />
        </div>

        {/* ── Suggested follow-ups ── */}
        {showFollowUps && (
          <div className="explain-followups">
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

        {/* ── Composer ── */}
        <div className="explain-footer">
          <ExplainComposer
            ref={composerRef}
            streaming={streaming}
            onSubmit={ask}
            onStop={stop}
            placeholder={messages.length === 0 ? "Ask anything…" : "Ask a follow-up…"}
          />
        </div>
      </div>
    </div>,
    document.body,
  );
};
