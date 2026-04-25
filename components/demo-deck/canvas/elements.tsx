"use client";

import { motion, AnimatePresence } from "motion/react";
import { MORPH_TRANSITION } from "@/components/demo-deck/pace";
import {
  AGENTS,
  CLUSTERS,
  RECOMMENDATIONS,
  TRANSACTIONS,
  type AgentId,
  type ClusterId,
  type RecId,
  type Transaction,
  type TxId,
} from "./data";
import type { ElementLayout, StageConfig } from "./stages";

// ─── Generic morph wrapper ─────────────────────────────────────────────────
function MorphBox({
  layoutId,
  cfg,
  children,
}: {
  layoutId: string;
  cfg: ElementLayout | undefined;
  children: React.ReactNode;
}) {
  if (!cfg || cfg.shape === "hidden") {
    // Element is invisible at this stage — but we keep the layoutId mounted
    // off-screen so motion can morph back to it on reverse.
    return (
      <motion.div
        layoutId={layoutId}
        layout
        className="pointer-events-none absolute"
        style={{ left: "50%", top: "50%", width: 0, height: 0, opacity: 0 }}
        transition={MORPH_TRANSITION}
      />
    );
  }
  return (
    <motion.div
      layoutId={layoutId}
      layout
      className="absolute"
      style={cfg.pos}
      animate={{ opacity: cfg.opacity ?? 1 }}
      transition={MORPH_TRANSITION}
    >
      {children}
    </motion.div>
  );
}

// ─── Category color pulled from the live app's design tokens ───────────────
const CATEGORY_COLOR: Record<ClusterId, string> = {
  logistics: "var(--cat-fuel)",
  travel: "var(--cat-travel)",
  goods: "var(--cat-goods)",
  cloud: "var(--cat-electricity)",
};

// Long rec titles get a stranger-readable shorthand for the matrix dot.
// (Full title still appears in the chip on stages 5–6.) v3.5: shortened
// further so labels fit comfortably within an 11%-wide stacked container.
const MATRIX_LABEL: Record<string, string> = {
  "Switch DHL air → DB Schenker rail (NL→DE)": "Air → Rail",
  "Maersk · low-sulphur fuel premium": "Maersk LSF",
  "FedEx → consolidate weekly shipments": "FedEx weekly",
  "Replace EU short-haul flights with rail": "Flights → Rail",
  "Amazon · switch to refurb electronics": "Refurb tech",
};
const matrixLabelFor = (title: string) => MATRIX_LABEL[title] ?? title;

const verdictLabel = (v: "approved" | "approved_caveats" | "rejected") =>
  v === "approved" ? "Approved" : v === "approved_caveats" ? "Caveats" : "Rejected";

// ─── TransactionElement ────────────────────────────────────────────────────
export function TransactionElement({ tx, stage }: { tx: Transaction; stage: StageConfig }) {
  const cfg = stage.txs[tx.id];
  const color = CATEGORY_COLOR[tx.category];
  const isHighlight = cfg?.shape === "row" && cfg.highlight === true;
  return (
    <MorphBox layoutId={`tx-${tx.id}`} cfg={cfg}>
      <AnimatePresence mode="wait" initial={false}>
        {cfg?.shape === "row" && !isHighlight && (
          <motion.div
            key="row"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="flex h-full w-full items-center gap-3 rounded-lg border border-[var(--border-default)] bg-[var(--bg-button)] px-3"
          >
            <span className="h-3 w-1 rounded-full" style={{ backgroundColor: color }} />
            <span className="flex-1 truncate text-xs font-medium text-[var(--fg-primary)] md:text-sm">
              {tx.merchant}
            </span>
            <span className="tabular-nums text-xs text-[var(--fg-secondary)] md:text-sm">
              €{tx.amountEur.toLocaleString("en-US")}
            </span>
          </motion.div>
        )}
        {isHighlight && (
          <motion.div
            key="row-highlight"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="flex h-full w-full items-center gap-3 rounded-lg border bg-[var(--bg-button)] px-3"
            style={{
              borderColor: "rgba(247, 185, 85, 0.65)",
              boxShadow: "0 0 22px rgba(247, 185, 85, 0.22)",
            }}
          >
            <span className="h-3 w-1 rounded-full" style={{ backgroundColor: color }} />
            <div className="flex min-w-0 flex-1 flex-col leading-tight">
              <span className="truncate text-xs font-medium text-[var(--fg-primary)] md:text-sm">
                {tx.merchant}
              </span>
              <span className="font-mono text-[8px] uppercase tracking-[0.18em] text-[var(--status-warning)] md:text-[9px]">
                receipt needed · conf 0.42
              </span>
            </div>
            <span className="tabular-nums text-xs text-[var(--fg-secondary)] md:text-sm">
              €{tx.amountEur.toLocaleString("en-US")}
            </span>
          </motion.div>
        )}
        {cfg?.shape === "cluster-member" && (
          <motion.div
            key="member"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="h-full w-full rounded-full"
            style={{ backgroundColor: color, boxShadow: `0 0 12px ${color}66` }}
          />
        )}
      </AnimatePresence>
    </MorphBox>
  );
}

// ─── ReceiptElement ────────────────────────────────────────────────────────
// Multi-modal source documents that bunq doesn't have but Carbo finds:
//   - "invoice" → PDF, parsed by structured extraction
//   - "receipt" → photo, OCR'd
// The element shows kind + matched amount (cross-referenced against the bunq
// line) so the visual demonstrates the value-search match.
export function ReceiptElement({ tx, stage }: { tx: Transaction; stage: StageConfig }) {
  const cfg = stage.receipts[tx.id];
  const isReceipt = tx.receiptKind === "receipt";
  const accent = isReceipt ? "var(--status-info)" : "var(--brand-green)";
  return (
    <MorphBox layoutId={`receipt-${tx.id}`} cfg={cfg}>
      {cfg?.shape === "row" && (
        <div
          className="flex h-full w-full items-center gap-2.5 rounded-lg border border-dashed bg-[var(--bg-button)] px-3"
          style={{ borderColor: `${accent}66` }}
        >
          {isReceipt ? <CameraIcon color={accent} /> : <PdfIcon color={accent} />}
          <div className="flex flex-1 flex-col leading-tight">
            <span
              className="font-mono text-[9px] uppercase tracking-[0.18em]"
              style={{ color: accent }}
            >
              {isReceipt ? "Photo · OCR" : "PDF · parsed"}
            </span>
            <span className="tabular-nums text-[11px] font-medium text-[var(--fg-primary)]">
              €{tx.amountEur.toLocaleString("en-US")} ✓
            </span>
          </div>
        </div>
      )}
    </MorphBox>
  );
}

// ─── ClusterElement ────────────────────────────────────────────────────────
export function ClusterElement({ id, stage }: { id: ClusterId; stage: StageConfig }) {
  const cluster = CLUSTERS.find((c) => c.id === id)!;
  const cfg = stage.clusters[id];
  const color = CATEGORY_COLOR[id];
  const isFocus = stage.id === 5 && id === "logistics";

  return (
    <MorphBox layoutId={`cluster-${id}`} cfg={cfg}>
      {cfg && cfg.shape !== "hidden" && (
        <div
          className="relative h-full w-full overflow-hidden rounded-3xl"
          style={{
            background: `radial-gradient(circle at center top, ${color}22 0%, ${color}08 55%, transparent 100%)`,
            border: `1.5px solid ${color}${cfg.highlight ? "88" : "44"}`,
            boxShadow: cfg.highlight ? `0 0 28px ${color}44` : "none",
          }}
        >
          {/* Text anchored at the TOP of the card; the bottom ~40% is left
              empty so the cluster-member dots (separate elements positioned
              at canvas coords with dy=+8) sit clearly below the text. */}
          {!isFocus && (
            <div className="absolute inset-x-0 top-4 flex flex-col items-center gap-1 px-3 text-center">
              <span
                className="font-mono text-[11px] uppercase tracking-[0.22em]"
                style={{ color }}
              >
                {cluster.label}
              </span>
              <span className="text-xl font-medium tabular-nums text-[var(--fg-primary)] md:text-2xl">
                €{(cluster.totalEur / 1000).toFixed(0)}k
              </span>
              <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--fg-secondary)]">
                {cluster.tco2e} tCO₂e · {Math.round(cluster.confidence * 100)}% conf
              </span>
            </div>
          )}
          {isFocus && (
            <div className="absolute inset-x-0 top-6 flex flex-col items-center gap-2 px-4 text-center">
              <span
                className="font-mono text-xs uppercase tracking-[0.22em]"
                style={{ color }}
              >
                {cluster.label}
              </span>
              <span className="text-3xl font-normal tabular-nums text-[var(--fg-primary)] md:text-4xl">
                €{(cluster.totalEur / 1000).toFixed(0)}k
              </span>
              <span className="text-sm text-[var(--fg-secondary)]">
                {cluster.tco2e} tCO₂e · confidence {Math.round(cluster.confidence * 100)}%
              </span>
            </div>
          )}
        </div>
      )}
    </MorphBox>
  );
}

// ─── AgentElement ──────────────────────────────────────────────────────────
export function AgentElement({ id, stage }: { id: AgentId; stage: StageConfig }) {
  const agent = AGENTS.find((a) => a.id === id)!;
  const cfg = stage.agents[id];
  return (
    <MorphBox layoutId={`agent-${id}`} cfg={cfg}>
      {cfg && cfg.shape !== "hidden" && (
        <div className="flex h-full w-full flex-col justify-center gap-1 rounded-lg border border-[#9d72ff44] bg-[#9d72ff10] px-4">
          <div className="font-mono text-xs uppercase tracking-[0.22em] text-[#b39bff]">
            {agent.label}
          </div>
          <div className="text-sm text-[var(--fg-secondary)] md:text-base">
            {agent.role}
          </div>
          <div className="mt-1 inline-flex w-fit rounded-full border border-[#9d72ff33] px-2 py-0.5 font-mono text-[9px] uppercase tracking-[0.18em] text-[#b39bff]">
            Sonnet 4.6
          </div>
        </div>
      )}
    </MorphBox>
  );
}

// ─── RecommendationElement ─────────────────────────────────────────────────
export function RecommendationElement({ id, stage }: { id: RecId; stage: StageConfig }) {
  const rec = RECOMMENDATIONS.find((r) => r.id === id)!;
  const cfg = stage.recs[id];

  const verdictColor =
    rec.verdict === "rejected"
      ? "var(--status-danger)"
      : rec.verdict === "approved_caveats"
      ? "var(--status-warning)"
      : "var(--brand-green)";

  return (
    <MorphBox layoutId={`rec-${id}`} cfg={cfg}>
      <AnimatePresence mode="wait" initial={false}>
        {cfg?.shape === "rec-chip" && (
          <motion.div
            key="chip"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="flex h-full w-full items-center gap-3 rounded-lg border bg-[var(--bg-button)] px-4"
            style={{ borderColor: `${verdictColor}66` }}
          >
            <span
              className="h-2.5 w-2.5 shrink-0 rounded-full"
              style={{ backgroundColor: verdictColor }}
            />
            <div className="flex min-w-0 flex-1 flex-col justify-center gap-0.5">
              <span className="truncate text-sm font-medium text-[var(--fg-primary)]">
                {rec.title}
              </span>
              {rec.savingEur > 0 ? (
                <div className="flex items-baseline gap-3 text-xs tabular-nums text-[var(--fg-secondary)]">
                  <span>€{rec.savingEur.toLocaleString("en-US")} / yr</span>
                  <span>−{(rec.carbonKg / 1000).toFixed(1)} tCO₂e</span>
                </div>
              ) : (
                <span className="text-xs italic text-[var(--fg-muted)]">
                  zero source citations
                </span>
              )}
            </div>
            <span
              className="shrink-0 rounded-full px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.18em]"
              style={{
                color: verdictColor,
                backgroundColor: `${verdictColor}1a`,
                border: `1px solid ${verdictColor}55`,
              }}
            >
              {verdictLabel(rec.verdict)}
            </span>
          </motion.div>
        )}
        {cfg?.shape === "matrix-dot" && (
          <motion.div
            key="dot"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="flex h-full w-full flex-col items-center gap-1"
          >
            <span
              className="h-2.5 w-2.5 shrink-0 rounded-full"
              style={{
                backgroundColor: verdictColor,
                boxShadow: `0 0 12px ${verdictColor}88`,
              }}
            />
            <div className="flex flex-col items-center leading-tight">
              <span className="whitespace-nowrap text-[10px] text-[var(--fg-primary)]">
                {matrixLabelFor(rec.title)}
              </span>
              {rec.savingEur > 0 && (
                <span className="font-mono text-[9px] tabular-nums text-[var(--fg-muted)]">
                  €{(rec.savingEur / 1000).toFixed(1)}k
                </span>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </MorphBox>
  );
}

// ─── Driver components ─────────────────────────────────────────────────────
// Each renders the population of its kind so Canvas can stay tidy.

export function AllTransactions({ stage }: { stage: StageConfig }) {
  return (
    <>
      {TRANSACTIONS.map((tx) => (
        <TransactionElement key={tx.id} tx={tx} stage={stage} />
      ))}
    </>
  );
}

export function AllReceipts({ stage }: { stage: StageConfig }) {
  return (
    <>
      {TRANSACTIONS.map((tx) => (
        <ReceiptElement key={tx.id} tx={tx} stage={stage} />
      ))}
    </>
  );
}

export function AllClusters({ stage }: { stage: StageConfig }) {
  return (
    <>
      {CLUSTERS.map((c) => (
        <ClusterElement key={c.id} id={c.id} stage={stage} />
      ))}
    </>
  );
}

export function AllAgents({ stage }: { stage: StageConfig }) {
  return (
    <>
      {AGENTS.map((a) => (
        <AgentElement key={a.id} id={a.id} stage={stage} />
      ))}
    </>
  );
}

export function AllRecommendations({ stage }: { stage: StageConfig }) {
  return (
    <>
      {RECOMMENDATIONS.map((r) => (
        <RecommendationElement key={r.id} id={r.id} stage={stage} />
      ))}
    </>
  );
}

// ─── Document icons ────────────────────────────────────────────────────────
function PdfIcon({ color }: { color: string }) {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
      <path
        d="M3 2h6l4 4v8a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V3a1 1 0 0 1 1-1z"
        stroke={color}
        strokeWidth="1.2"
      />
      <path d="M9 2v4h4" stroke={color} strokeWidth="1.2" />
      <text
        x="8"
        y="13"
        textAnchor="middle"
        fontSize="4"
        fontWeight="600"
        fontFamily="monospace"
        fill={color}
      >
        PDF
      </text>
    </svg>
  );
}

function CameraIcon({ color }: { color: string }) {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
      <rect x="1.5" y="4" width="13" height="9" rx="1.5" stroke={color} strokeWidth="1.2" />
      <path d="M5.5 4l1-1.5h3l1 1.5" stroke={color} strokeWidth="1.2" />
      <circle cx="8" cy="8.5" r="2.4" stroke={color} strokeWidth="1.2" />
    </svg>
  );
}
