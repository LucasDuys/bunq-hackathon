"use client";

import Link from "next/link";
import { Fragment, type ReactNode } from "react";
import { CodeLabel, PulseDot } from "./ui";
import type { ExplainMessage } from "@/lib/explain/schema";

/**
 * Lightweight markdown renderer for assistant prose. We avoid `react-markdown`
 * to keep the bundle small — the surface we accept is intentionally small:
 *
 *   - `**bold**` → <strong>
 *   - inline `` `code` `` → <code>
 *   - bulleted lists (`- ` / `* `) become a <ul>
 *   - blank line → paragraph break
 *   - citation markers `[tx:<id>]`, `[run:<id>]`, `[event:<id>]`,
 *     `[factor:<key>]` → linked Badge chips
 *
 * Anything else stays as plain text. Live Sonnet output styled per the system
 * prelude in `lib/explain/prompt.ts` lands within this surface comfortably.
 */

const CITATION_RE = /\[(tx|run|event|factor):([a-zA-Z0-9_./-]+)\]/g;
const BOLD_RE = /\*\*([^*]+)\*\*/g;
const CODE_RE = /`([^`]+)`/g;

const hrefForCitation = (kind: string, id: string): string | null => {
  if (kind === "tx") return `/ledger?tx=${encodeURIComponent(id)}`;
  if (kind === "run") return `/close/${encodeURIComponent(id)}`;
  if (kind === "event") return "/ledger";
  if (kind === "factor") return null;
  return null;
};

const Citation = ({ kind, id }: { kind: string; id: string }) => {
  const href = hrefForCitation(kind, id);
  const label =
    kind === "factor" ? id : `${kind}:${id.length > 14 ? `${id.slice(0, 12)}…` : id}`;
  const className =
    "inline-flex items-center gap-1 px-2 py-[1px] rounded-full text-[11px] font-medium tabular-nums whitespace-nowrap align-baseline";
  const style: React.CSSProperties = {
    color: "var(--status-info)",
    border: "1px solid rgba(95,185,255,0.30)",
    background: "transparent",
    margin: "0 1px",
  };
  if (href) {
    return (
      <Link href={href} className={className} style={style}>
        {label}
      </Link>
    );
  }
  return (
    <span className={className} style={style}>
      {label}
    </span>
  );
};

const renderInline = (text: string): ReactNode[] => {
  // Tokenize on citations, bold, and code. Order matters: citations first
  // (they're brackets so they don't conflict), then bold/code.
  type Tok =
    | { kind: "text"; v: string }
    | { kind: "cite"; t: string; id: string }
    | { kind: "bold"; v: string }
    | { kind: "code"; v: string };

  const splitOn = (
    input: string,
    re: RegExp,
    onMatch: (m: RegExpExecArray) => Tok,
  ): Tok[] => {
    const out: Tok[] = [];
    let last = 0;
    let m: RegExpExecArray | null;
    re.lastIndex = 0;
    while ((m = re.exec(input)) !== null) {
      if (m.index > last) out.push({ kind: "text", v: input.slice(last, m.index) });
      out.push(onMatch(m));
      last = m.index + m[0].length;
    }
    if (last < input.length) out.push({ kind: "text", v: input.slice(last) });
    return out;
  };

  let toks: Tok[] = splitOn(text, CITATION_RE, (m) => ({
    kind: "cite",
    t: m[1],
    id: m[2],
  }));
  toks = toks.flatMap((t) =>
    t.kind === "text"
      ? splitOn(t.v, BOLD_RE, (m) => ({ kind: "bold", v: m[1] }))
      : [t],
  );
  toks = toks.flatMap((t) =>
    t.kind === "text"
      ? splitOn(t.v, CODE_RE, (m) => ({ kind: "code", v: m[1] }))
      : [t],
  );

  return toks.map((t, i) => {
    if (t.kind === "text") return <Fragment key={i}>{t.v}</Fragment>;
    if (t.kind === "bold")
      return (
        <strong
          key={i}
          style={{ color: "var(--fg-primary)", fontWeight: 500 }}
        >
          {t.v}
        </strong>
      );
    if (t.kind === "code")
      return (
        <code
          key={i}
          className="font-mono text-[12.5px]"
          style={{
            background: "var(--bg-inset)",
            border: "1px solid var(--border-faint)",
            borderRadius: 4,
            padding: "1px 5px",
          }}
        >
          {t.v}
        </code>
      );
    return <Citation key={i} kind={t.t} id={t.id} />;
  });
};

const renderBody = (text: string): ReactNode => {
  if (!text) return null;
  const blocks = text.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean);
  return blocks.map((block, i) => {
    const lines = block.split("\n").map((l) => l.trim());
    const isList = lines.every((l) => /^[-*]\s+/.test(l));
    if (isList) {
      return (
        <ul key={i} className="flex flex-col gap-1.5 list-disc pl-5 m-0">
          {lines.map((l, j) => (
            <li
              key={j}
              className="text-[14px] leading-[1.55]"
              style={{ color: "var(--fg-secondary)" }}
            >
              {renderInline(l.replace(/^[-*]\s+/, ""))}
            </li>
          ))}
        </ul>
      );
    }
    return (
      <p
        key={i}
        className="text-[14px] leading-[1.55] m-0"
        style={{ color: "var(--fg-secondary)" }}
      >
        {renderInline(block)}
      </p>
    );
  });
};

export const ExplainThread = ({
  messages,
  headline,
  streaming,
  error,
}: {
  messages: ExplainMessage[];
  headline: string | null;
  streaming: boolean;
  error: string | null;
}) => {
  return (
    <div className="explain-thread flex flex-col gap-5 tabular-nums">
      {headline && (
        <div className="flex flex-col gap-2">
          <CodeLabel>Headline</CodeLabel>
          <div
            className="text-[20px] leading-[1.3] tracking-[-0.01em]"
            style={{ color: "var(--fg-primary)" }}
          >
            {renderInline(headline)}
          </div>
        </div>
      )}

      {messages.map((m, i) => {
        const isAssistant = m.role === "assistant";
        const isLast = i === messages.length - 1;
        const isPlaceholder =
          isAssistant && isLast && streaming && m.content.length === 0;
        return (
          <Fragment key={i}>
            <div className="flex flex-col gap-2">
              <CodeLabel>{isAssistant ? "Assistant" : "You"}</CodeLabel>
              <div
                className={isAssistant ? "flex flex-col gap-3" : "flex flex-col gap-1"}
                style={{
                  color: isAssistant ? "var(--fg-secondary)" : "var(--fg-primary)",
                }}
              >
                {isPlaceholder ? (
                  <div className="flex items-center gap-1.5 py-1" aria-label="thinking">
                    <PulseDot color="var(--fg-muted)" />
                    <PulseDot color="var(--fg-muted)" />
                    <PulseDot color="var(--fg-muted)" />
                  </div>
                ) : isAssistant ? (
                  renderBody(m.content)
                ) : (
                  <p className="text-[14px] leading-[1.55] m-0">{m.content}</p>
                )}
              </div>
            </div>
          </Fragment>
        );
      })}

      {error && (
        <div
          className="flex flex-col gap-1.5 px-3 py-2.5 rounded-[8px]"
          style={{
            border: "1px solid rgba(229,72,77,0.30)",
            background: "rgba(229,72,77,0.06)",
          }}
          role="alert"
        >
          <CodeLabel style={{ color: "var(--status-danger)" }}>Error</CodeLabel>
          <span className="text-[13px]" style={{ color: "var(--fg-secondary)" }}>
            {error}
          </span>
        </div>
      )}
    </div>
  );
};
