"use client";

/**
 * AuditLedgerScroll — append-only ledger view that scrolls in monospace
 * rows representing the SHA-256 hash chain from `lib/audit/append.ts`.
 *
 * Each row appends with a typed reveal of its hash + a green ✓ once verified
 * against the prior. By the end of the scene every row is solid green and the
 * footer reads "chain verified · 18 events".
 *
 * Visual: terminal-feel — black-fill rows, mono text, brand-green for the
 * verified state.
 */

import { Check, Lock } from "lucide-react";

type LedgerEntry = {
  ts: string;
  op: string;
  ref: string;
  hash: string;
};

const ENTRIES: LedgerEntry[] = [
  { ts: "12:04:18", op: "ONBOARD_COMPLETE",  ref: "run_oa_5f12",  hash: "f8a2…b310" },
  { ts: "12:04:22", op: "BASELINE_SNAPSHOT", ref: "run_b1_92ab",  hash: "01cd…f41e" },
  { ts: "12:09:01", op: "WEBHOOK_TX_INGEST", ref: "tx_001",       hash: "7e93…0a55" },
  { ts: "12:09:04", op: "CLASSIFY_RESULT",   ref: "tx_001",       hash: "44b1…e2c8" },
  { ts: "12:09:11", op: "VISION_EXTRACT",    ref: "rcpt_4821",    hash: "9c08…2dd0" },
  { ts: "12:09:14", op: "ESTIMATE_EMISSION", ref: "tx_001",       hash: "23ee…7a14" },
  { ts: "12:11:42", op: "DAG_RUN_COMPLETE",  ref: "run_dag_8bb",  hash: "55fa…b9c0" },
  { ts: "12:11:48", op: "REFINE_QUESTIONS",  ref: "cluster_food", hash: "108e…d3a2" },
  { ts: "12:12:30", op: "POLICY_PROPOSAL",   ref: "close_2026_04", hash: "ef72…0119" },
  { ts: "12:13:01", op: "RESERVE_TRANSFER",  ref: "€412.00",      hash: "a1c4…6ef0" },
  { ts: "12:13:02", op: "CREDIT_PURCHASE",   ref: "puro_NL_002",  hash: "62b9…d471" },
  { ts: "12:13:08", op: "CSRD_REPORT_EMIT",  ref: "report_2026_04", hash: "0099…ace7" },
];

export type AuditLedgerScrollProps = {
  /** ms elapsed in the parent scene. */
  elapsedMs: number;
  /** total scene duration */
  durationMs: number;
};

export function AuditLedgerScroll({ elapsedMs, durationMs }: AuditLedgerScrollProps) {
  // Reveal rows one by one over ~70% of the scene; verify them over the next ~20%.
  const revealEnd = durationMs * 0.7;
  const revealedFloat = Math.min(ENTRIES.length, (elapsedMs / revealEnd) * ENTRIES.length);
  const revealedCount = Math.floor(revealedFloat);

  // Verification sweep starts at 70% and lights each row green over remaining time.
  const verifyT = Math.max(0, Math.min(1, (elapsedMs - revealEnd) / Math.max(1, durationMs - revealEnd)));
  const verifiedCount = Math.floor(verifyT * ENTRIES.length);

  return (
    <div
      style={{
        height: "100%",
        background: "#0f0f0f",
        color: "#fafafa",
        fontFamily: "var(--font-source-code-pro), ui-monospace, monospace",
        display: "flex",
        flexDirection: "column",
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: "16px 24px",
          borderBottom: "1px solid #242424",
          display: "flex",
          alignItems: "center",
          gap: 12,
        }}
      >
        <Lock size={14} color="var(--brand-green, #3ecf8e)" strokeWidth={2} />
        <span
          style={{
            fontSize: 11,
            letterSpacing: "1.2px",
            textTransform: "uppercase",
            color: "#b4b4b4",
          }}
        >
          Audit ledger · SHA-256 hash chain · append-only
        </span>
        <span style={{ flex: 1 }} />
        <span
          style={{
            fontSize: 11,
            letterSpacing: "1.2px",
            textTransform: "uppercase",
            color: verifiedCount >= ENTRIES.length ? "var(--brand-green, #3ecf8e)" : "#898989",
            transition: "color 220ms ease-out",
          }}
        >
          {verifiedCount >= ENTRIES.length
            ? `chain verified · ${ENTRIES.length} events`
            : `verifying… ${verifiedCount}/${ENTRIES.length}`}
        </span>
      </div>

      {/* Column header */}
      <div
        style={{
          padding: "10px 24px",
          display: "grid",
          gridTemplateColumns: "70px 200px 1fr 140px 24px",
          gap: 12,
          fontSize: 10,
          letterSpacing: "1.2px",
          textTransform: "uppercase",
          color: "#4d4d4d",
          borderBottom: "1px solid #1a1a1a",
        }}
      >
        <span>Time</span>
        <span>Op</span>
        <span>Ref</span>
        <span>Hash</span>
        <span />
      </div>

      {/* Rows */}
      <div style={{ flex: 1, overflow: "hidden" }}>
        {ENTRIES.map((e, i) => {
          const visible = i < revealedCount;
          const verified = i < verifiedCount;
          const justAppearing = i === revealedCount;
          const partialChars = justAppearing
            ? Math.floor((revealedFloat - revealedCount) * 28)
            : 0;
          const hashShown = justAppearing ? e.hash.slice(0, partialChars) : e.hash;

          return (
            <div
              key={e.hash}
              style={{
                padding: "8px 24px",
                display: "grid",
                gridTemplateColumns: "70px 200px 1fr 140px 24px",
                gap: 12,
                fontSize: 12,
                color: verified ? "var(--brand-green, #3ecf8e)" : visible ? "#b4b4b4" : "#2e2e2e",
                opacity: visible || justAppearing ? 1 : 0.18,
                borderBottom: "1px solid #161616",
                transition: "color 240ms ease-out, opacity 240ms ease-out",
                lineHeight: 1.5,
                fontVariantNumeric: "tabular-nums",
              }}
            >
              <span>{e.ts}</span>
              <span style={{ color: verified ? "var(--brand-green, #3ecf8e)" : "#fafafa" }}>{e.op}</span>
              <span style={{ color: verified ? "var(--brand-green, #3ecf8e)" : "#898989" }}>{e.ref}</span>
              <span>{visible ? e.hash : hashShown}</span>
              <span style={{ display: "flex", alignItems: "center", justifyContent: "flex-end" }}>
                {verified ? (
                  <Check size={14} color="var(--brand-green, #3ecf8e)" strokeWidth={2.5} />
                ) : null}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
