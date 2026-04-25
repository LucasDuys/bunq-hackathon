"use client";

/**
 * LaunchHeroCockpit — the S01D wow-factor composition.
 *
 * Replaces the boring static dashboard for the opening product reveal. A single
 * cinematic frame that fires every Carbo capability simultaneously so the
 * viewer registers the full surface area in one look. The rest of the timeline
 * elaborates each beat individually.
 *
 *   ┌──────────────────────── tx ticker ─────────────────────────┐
 *   │ INBOX (bunq + email + receipt)  HERO IMPACT   ACTIONS       │
 *   │   live tx feed                  €28,766       SWAPS list    │
 *   │   classification + confidence   confidence    RESERVE move  │
 *   │   gap rows                      MoM trend     CSRD progress │
 *   │   8-agent pipeline dots                                     │
 *   └─────────────────────────────────────────────────────────────┘
 *
 * Everything animates off `progress` (0..1). No internal RAF — driven by the
 * scene's elapsedMs so it stays scrubber-friendly and identical across
 * playthroughs.
 */

import {
  ArrowDownRight,
  ArrowRight,
  Banknote,
  CheckCircle2,
  FileText,
  Inbox,
  Leaf,
  Loader2,
  Mail,
  Receipt,
  ShieldCheck,
  Sparkles,
  TrendingDown,
  Wallet,
  Zap,
} from "lucide-react";
import { Card, CardBody, CodeLabel, ConfidenceBar } from "@/components/ui";

// ── Helpers ──────────────────────────────────────────────────────────────────

function clamp01(v: number): number {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

/** Map outer progress in [a,b] to local 0..1 (clamped). */
function band(progress: number, a: number, b: number): number {
  if (b <= a) return progress >= b ? 1 : 0;
  return clamp01((progress - a) / (b - a));
}

function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}

function fmtEur(n: number): string {
  return n.toLocaleString("nl-NL", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });
}

// ── Fixture data (kept local so this scene is self-contained) ────────────────

type FeedRow = {
  source: "bunq" | "email" | "receipt";
  merchant: string;
  amountEur: number;
  category: string;
  tco2eKg: number | null; // null until classified
  confidence: number | null;
};

const FEED: FeedRow[] = [
  { source: "bunq",    merchant: "KLM AMS–FRA",        amountEur: 312,   category: "Travel · short-haul",  tco2eKg: 184, confidence: 0.91 },
  { source: "bunq",    merchant: "AWS",                amountEur: 1842,  category: "Cloud · compute",      tco2eKg: 12,  confidence: 0.78 },
  { source: "email",   merchant: "Vendor inv. #4821",  amountEur: 4280,  category: "Office · pending",     tco2eKg: null, confidence: null },
  { source: "bunq",    merchant: "NS Reizigers",       amountEur: 89,    category: "Travel · train",       tco2eKg: 6,   confidence: 0.94 },
  { source: "receipt", merchant: "Albert Heijn",       amountEur: 487,   category: "Catering · fresh",     tco2eKg: 421, confidence: 0.87 },
  { source: "bunq",    merchant: "Eneco Zakelijk",     amountEur: 980,   category: "Energy · green",       tco2eKg: 22,  confidence: 0.96 },
  { source: "bunq",    merchant: "Coolblue Zakelijk",  amountEur: 1259,  category: "Office · hardware",    tco2eKg: 312, confidence: 0.82 },
];

const AGENTS: Array<{ key: string; label: string; tier: number }> = [
  { key: "baseline",  label: "Baseline",   tier: 1 },
  { key: "research",  label: "Research",   tier: 2 },
  { key: "green",     label: "Green alt.", tier: 3 },
  { key: "cost",      label: "Cost",       tier: 3 },
  { key: "judge_g",   label: "Judge · G",  tier: 4 },
  { key: "judge_c",   label: "Judge · C",  tier: 4 },
  { key: "credit",    label: "Credits",    tier: 5 },
  { key: "report",    label: "Report",     tier: 6 },
];

type Swap = {
  baseline: string;
  alternative: string;
  costDeltaEur: number;
  co2eDelta: number;
};

const SWAPS: Swap[] = [
  { baseline: "KLM AMS–FRA", alternative: "ICE rail", costDeltaEur: -9400, co2eDelta: -73.9 },
  { baseline: "Confluence",  alternative: "Notion",   costDeltaEur: -3700, co2eDelta: -0.8 },
  { baseline: "New laptops", alternative: "Refurb.",  costDeltaEur: -4300, co2eDelta: -8.1 },
];

// Sparkline points (14d MoM dive) — pre-computed so SVG path is stable.
const SPARK_POINTS = [
  62, 64, 60, 58, 61, 55, 53, 50, 48, 46, 47, 44, 42, 41,
];

// ── Component ────────────────────────────────────────────────────────────────

export type LaunchHeroCockpitProps = {
  /** ms elapsed within this scene's slot. */
  elapsedMs: number;
  /** Total slot duration in ms. */
  durationMs: number;
};

export function LaunchHeroCockpit({ elapsedMs, durationMs }: LaunchHeroCockpitProps) {
  const progress = clamp01(durationMs > 0 ? elapsedMs / durationMs : 1);

  // Scene-wide entrance.
  const enter = easeOutCubic(band(progress, 0.0, 0.12));

  // Hero number tween (0..1) drives the count-up.
  const heroT = easeOutCubic(band(progress, 0.08, 0.55));
  const netImpact = Math.round(28766 * heroT);
  const tco2e = (76 * heroT).toFixed(0);
  const momPct = (-12.4 * heroT).toFixed(1);
  const confT = clamp01(0.81 * easeOutCubic(band(progress, 0.10, 0.62)));

  // Tx feed: rows reveal one at a time across 0.05..0.55, then the email row
  // (idx 2) "auto-classifies" near the end (its tco2e/conf appear).
  const visibleRows = Math.min(
    FEED.length,
    Math.floor(band(progress, 0.05, 0.55) * (FEED.length + 0.5)),
  );
  const emailClassified = progress >= 0.62;

  // Agent dots — sequential light-up across 0.18..0.78.
  const agentT = band(progress, 0.18, 0.78);
  const agentCount = Math.min(AGENTS.length, Math.floor(agentT * (AGENTS.length + 0.4)));

  // Swaps stagger.
  const swapT = (i: number) => clamp01(band(progress, 0.32 + i * 0.08, 0.55 + i * 0.08));

  // Reserve transfer slide-in.
  const reserveT = easeOutCubic(band(progress, 0.55, 0.78));
  const reservePct = clamp01(reserveT);
  const reserveAmt = Math.round(412 * reservePct);

  // CSRD progress fill.
  const csrdT = easeOutCubic(band(progress, 0.62, 0.98));
  const csrdPct = Math.round(100 * csrdT);
  const csrdDone = csrdPct >= 100;

  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        background: "var(--bg-canvas)",
        opacity: 0.4 + 0.6 * enter,
        transform: `translateY(${(1 - enter) * 8}px)`,
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
      }}
    >
      {/* ── Live tx ticker (slim band along the very top) ─────────────────── */}
      <TxTicker progress={progress} />

      {/* ── Header strip ──────────────────────────────────────────────────── */}
      <div
        style={{
          padding: "20px 28px 12px",
          display: "flex",
          alignItems: "flex-end",
          justifyContent: "space-between",
          gap: 24,
          borderBottom: "1px solid var(--border-faint)",
        }}
      >
        <div style={{ minWidth: 0 }}>
          <CodeLabel>LIVE · APRIL 2026 · BUNQ BUSINESS</CodeLabel>
          <h1
            style={{
              fontSize: 30,
              fontWeight: 400,
              lineHeight: 1.05,
              letterSpacing: "-0.015em",
              color: "var(--fg-primary)",
              margin: "6px 0 0 0",
            }}
          >
            Your books, in carbon.
          </h1>
        </div>
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <Pill icon={<Zap size={11} />} label="bunq · webhook" tone="green" />
          <Pill icon={<Mail size={11} />} label="inbox · live" tone="info" />
          <Pill icon={<ShieldCheck size={11} />} label="audit · chained" tone="default" />
        </div>
      </div>

      {/* ── Main 3-column body ────────────────────────────────────────────── */}
      <div
        style={{
          flex: 1,
          minHeight: 0,
          display: "grid",
          gridTemplateColumns: "minmax(0, 0.95fr) minmax(0, 1.25fr) minmax(0, 1.05fr)",
          gap: 16,
          padding: 20,
          boxSizing: "border-box",
        }}
      >
        {/* ── LEFT: ingestion column ──────────────────────────────────── */}
        <Column>
          <ColumnHeader icon={<Inbox size={12} />} label="EVERY EURO IN" />
          <Card>
            <CardBody style={{ padding: "14px 14px 10px" }}>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {FEED.map((row, i) => (
                  <FeedItem
                    key={row.merchant}
                    row={row}
                    visible={i < visibleRows}
                    showResolved={emailClassified && i === 2}
                  />
                ))}
              </div>
            </CardBody>
          </Card>

          {/* Agent pipeline dots — running underneath the inbox */}
          <Card>
            <CardBody style={{ padding: 14 }}>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  marginBottom: 10,
                }}
              >
                <CodeLabel>8-AGENT DAG · SONNET 4.6</CodeLabel>
                <span
                  style={{
                    fontFamily:
                      "var(--font-source-code-pro), ui-monospace, monospace",
                    fontSize: 11,
                    color:
                      agentCount === AGENTS.length
                        ? "var(--brand-green)"
                        : "var(--fg-muted)",
                    letterSpacing: "0.6px",
                  }}
                >
                  {agentCount === AGENTS.length
                    ? "READY"
                    : `${agentCount}/${AGENTS.length}`}
                </span>
              </div>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(8, 1fr)",
                  gap: 6,
                  alignItems: "center",
                }}
              >
                {AGENTS.map((a, i) => (
                  <AgentDot
                    key={a.key}
                    label={a.label}
                    state={
                      i < agentCount
                        ? "done"
                        : i === agentCount
                          ? "active"
                          : "pending"
                    }
                  />
                ))}
              </div>
            </CardBody>
          </Card>
        </Column>

        {/* ── CENTER: hero impact column ──────────────────────────────── */}
        <Column>
          <ColumnHeader icon={<Sparkles size={12} />} label="NET ANNUAL IMPACT" />
          <div
            style={{
              border: "1px solid var(--brand-green-border)",
              borderRadius: 16,
              background:
                "linear-gradient(180deg, rgba(62,207,142,0.04) 0%, rgba(62,207,142,0.00) 60%)",
              padding: "20px 22px 18px",
              display: "flex",
              flexDirection: "column",
              gap: 16,
              flex: 1,
              minHeight: 0,
            }}
          >
            {/* Hero number */}
            <div style={{ display: "flex", alignItems: "flex-end", gap: 12 }}>
              <div
                style={{
                  fontSize: 76,
                  lineHeight: 1.0,
                  fontWeight: 400,
                  letterSpacing: "-0.025em",
                  color: "var(--brand-green)",
                  fontVariantNumeric: "tabular-nums",
                  whiteSpace: "nowrap",
                }}
              >
                € {fmtEur(netImpact)}
              </div>
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: 4,
                  paddingBottom: 10,
                }}
              >
                <span
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 4,
                    fontSize: 13,
                    color: "var(--brand-green)",
                    fontVariantNumeric: "tabular-nums",
                  }}
                >
                  <TrendingDown size={13} /> {momPct}% MoM
                </span>
                <span
                  style={{
                    fontSize: 12,
                    color: "var(--fg-muted)",
                    fontVariantNumeric: "tabular-nums",
                  }}
                >
                  {tco2e} tCO₂e reduced
                </span>
              </div>
            </div>

            {/* Trio sub-row: confidence ring · sparkline · scope breakdown */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "auto 1fr auto",
                gap: 16,
                alignItems: "center",
              }}
            >
              <ConfidenceRing value={confT} />
              <Sparkline progress={progress} />
              <ScopeBreakdown progress={progress} />
            </div>

            {/* Bottom strip: ConfidenceBar + factor sources */}
            <div style={{ marginTop: "auto" }}>
              <ConfidenceBar value={confT} />
              <div
                style={{
                  marginTop: 12,
                  display: "flex",
                  justifyContent: "space-between",
                  gap: 8,
                  flexWrap: "wrap",
                }}
              >
                <CodeLabel>Factors · DEFRA 2024 · ADEME · Exiobase v3</CodeLabel>
                <CodeLabel>Spend · €128,430 analysed</CodeLabel>
              </div>
            </div>
          </div>
        </Column>

        {/* ── RIGHT: outcomes column ──────────────────────────────────── */}
        <Column>
          <ColumnHeader icon={<ArrowRight size={12} />} label="WHAT CARBO DOES" />

          {/* Swaps */}
          <Card>
            <CardBody style={{ padding: "14px 14px 10px" }}>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  marginBottom: 10,
                }}
              >
                <CodeLabel>SWAP THIS · SAVE THAT</CodeLabel>
                <span
                  style={{
                    fontSize: 12,
                    color: "var(--brand-green)",
                    fontVariantNumeric: "tabular-nums",
                  }}
                >
                  €17.4k · 82.8 tCO₂e
                </span>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {SWAPS.map((s, i) => (
                  <SwapRow key={s.baseline} swap={s} t={swapT(i)} />
                ))}
              </div>
            </CardBody>
          </Card>

          {/* Reserve transfer */}
          <Card>
            <CardBody style={{ padding: 14 }}>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 8,
                  marginBottom: 10,
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "baseline",
                    gap: 8,
                    minWidth: 0,
                  }}
                >
                  <CodeLabel>RESERVE · BUNQ SUB-ACCOUNT</CodeLabel>
                  <span
                    style={{
                      fontSize: 13,
                      color: "var(--brand-green)",
                      fontVariantNumeric: "tabular-nums",
                      letterSpacing: "-0.01em",
                    }}
                  >
                    €{reserveAmt}
                  </span>
                </div>
                <span
                  style={{
                    fontSize: 11,
                    color:
                      reservePct >= 1
                        ? "var(--brand-green)"
                        : "var(--status-warning)",
                    fontFamily:
                      "var(--font-source-code-pro), ui-monospace, monospace",
                    letterSpacing: "0.6px",
                    flexShrink: 0,
                  }}
                >
                  {reservePct >= 1 ? "TRANSFERRED" : "PROPOSED"}
                </span>
              </div>
              <ReserveLine progress={reservePct} />
              <div
                style={{
                  marginTop: 8,
                  fontSize: 12,
                  color: "var(--fg-muted)",
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                }}
              >
                <Leaf size={11} color="var(--brand-green)" />
                Puro.earth credit · 18.5 tCO₂e queued
              </div>
            </CardBody>
          </Card>

          {/* CSRD report progress */}
          <Card>
            <CardBody style={{ padding: 14 }}>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  marginBottom: 10,
                }}
              >
                <CodeLabel>CSRD ESRS E1 · DRAFTING</CodeLabel>
                <span
                  style={{
                    fontFamily:
                      "var(--font-source-code-pro), ui-monospace, monospace",
                    fontSize: 11,
                    color: csrdDone ? "var(--brand-green)" : "var(--fg-secondary)",
                    letterSpacing: "0.6px",
                  }}
                >
                  {csrdPct}%
                </span>
              </div>
              <div
                style={{
                  height: 6,
                  borderRadius: 9999,
                  background: "var(--bg-inset)",
                  overflow: "hidden",
                }}
              >
                <div
                  style={{
                    height: "100%",
                    width: `${csrdPct}%`,
                    background: "var(--brand-green)",
                    borderRadius: 9999,
                  }}
                />
              </div>
              <div
                style={{
                  marginTop: 10,
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  fontSize: 12,
                  color: "var(--fg-secondary)",
                }}
              >
                {csrdDone ? (
                  <CheckCircle2 size={13} color="var(--brand-green)" />
                ) : (
                  <Loader2
                    size={13}
                    color="var(--fg-muted)"
                    style={{
                      animation: "ca-spin 1.4s linear infinite",
                    }}
                  />
                )}
                <span>
                  {csrdDone
                    ? "Briefing ready · 12 pages"
                    : "Drafting your monthly briefing"}
                </span>
                <span style={{ marginLeft: "auto" }}>
                  <FileText size={13} color="var(--fg-muted)" />
                </span>
              </div>
            </CardBody>
          </Card>
        </Column>
      </div>

      {/* Local keyframes */}
      <style>{`
        @keyframes ca-spin { from { transform: rotate(0); } to { transform: rotate(360deg); } }
        @keyframes ca-pulse-soft {
          0%, 100% { opacity: 0.55; }
          50% { opacity: 1; }
        }
      `}</style>
    </div>
  );
}

// ── Sub-components ───────────────────────────────────────────────────────────

function Column({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 12,
        minWidth: 0,
        minHeight: 0,
      }}
    >
      {children}
    </div>
  );
}

function ColumnHeader({
  icon,
  label,
}: {
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 6,
        color: "var(--fg-muted)",
      }}
    >
      <span style={{ display: "inline-flex" }}>{icon}</span>
      <CodeLabel>{label}</CodeLabel>
    </div>
  );
}

function Pill({
  icon,
  label,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  tone: "green" | "info" | "default";
}) {
  const colorMap = {
    green: { fg: "var(--brand-green)", border: "var(--brand-green-border)" },
    info: { fg: "var(--status-info)", border: "rgba(95,185,255,0.30)" },
    default: { fg: "var(--fg-secondary)", border: "var(--border-default)" },
  } as const;
  const c = colorMap[tone];
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        height: 24,
        padding: "0 10px",
        borderRadius: 9999,
        border: `1px solid ${c.border}`,
        color: c.fg,
        fontSize: 11,
        letterSpacing: 0,
      }}
    >
      <span
        style={{
          display: "inline-flex",
          width: 6,
          height: 6,
          borderRadius: 9999,
          background: c.fg,
          animation: "ca-pulse-soft 2s ease-in-out infinite",
        }}
        aria-hidden
      />
      <span style={{ display: "inline-flex" }}>{icon}</span>
      <span style={{ fontFamily: "var(--font-inter), system-ui, sans-serif" }}>
        {label}
      </span>
    </span>
  );
}

function TxTicker({ progress }: { progress: number }) {
  // Slide content right-to-left across the whole scene.
  const x = -progress * 1100;
  const items = [
    "bunq · KLM AMS–FRA · €312",
    "inbox · Vendor #4821 · €4,280",
    "bunq · AWS · €1,842",
    "receipt · Albert Heijn · €487",
    "bunq · NS Reizigers · €89",
    "bunq · Eneco · €980",
    "bunq · Coolblue · €1,259",
    "bunq · Slack · €240",
  ];
  return (
    <div
      style={{
        height: 28,
        flexShrink: 0,
        background: "var(--bg-inset)",
        borderBottom: "1px solid var(--border-faint)",
        overflow: "hidden",
        position: "relative",
      }}
    >
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          height: "100%",
          display: "flex",
          alignItems: "center",
          gap: 32,
          padding: "0 16px",
          transform: `translateX(${x}px)`,
          willChange: "transform",
          whiteSpace: "nowrap",
          fontFamily: "var(--font-source-code-pro), ui-monospace, monospace",
          fontSize: 11,
          color: "var(--fg-muted)",
          letterSpacing: "0.6px",
        }}
      >
        {[...items, ...items].map((t, i) => (
          <span
            key={i}
            style={{ display: "inline-flex", alignItems: "center", gap: 8 }}
          >
            <span
              aria-hidden
              style={{
                width: 5,
                height: 5,
                borderRadius: 9999,
                background: "var(--brand-green)",
              }}
            />
            {t}
          </span>
        ))}
      </div>
    </div>
  );
}

function FeedItem({
  row,
  visible,
  showResolved,
}: {
  row: FeedRow;
  visible: boolean;
  showResolved: boolean;
}) {
  const Icon =
    row.source === "bunq"
      ? Banknote
      : row.source === "email"
        ? Mail
        : Receipt;

  // Email row uses the "showResolved" flag to flip pending → classified.
  const tco2e = row.tco2eKg ?? (showResolved ? 312 : null);
  const conf = row.confidence ?? (showResolved ? 0.79 : null);
  const isGap = tco2e === null;

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "16px 1fr auto",
        gap: 10,
        alignItems: "center",
        padding: "8px 10px",
        borderRadius: 8,
        border: `1px solid ${
          isGap ? "rgba(247,185,85,0.22)" : "var(--border-faint)"
        }`,
        background: isGap ? "rgba(247,185,85,0.04)" : "transparent",
        opacity: visible ? 1 : 0,
        transform: visible ? "translateY(0)" : "translateY(4px)",
        transition: "opacity 280ms ease-out, transform 280ms ease-out",
      }}
    >
      <Icon
        size={14}
        color={
          row.source === "bunq"
            ? "var(--brand-green)"
            : row.source === "email"
              ? "var(--status-info)"
              : "var(--cat-services)"
        }
      />
      <div style={{ minWidth: 0 }}>
        <div
          style={{
            fontSize: 13,
            color: "var(--fg-primary)",
            lineHeight: 1.25,
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {row.merchant}
        </div>
        <div
          style={{
            fontSize: 11,
            color: "var(--fg-muted)",
            fontFamily: "var(--font-source-code-pro), ui-monospace, monospace",
            letterSpacing: "0.4px",
            marginTop: 2,
          }}
        >
          {row.category}
        </div>
      </div>
      <div style={{ textAlign: "right", minWidth: 76 }}>
        <div
          style={{
            fontSize: 13,
            color: "var(--fg-primary)",
            fontVariantNumeric: "tabular-nums",
            lineHeight: 1.25,
          }}
        >
          €{row.amountEur.toLocaleString("nl-NL")}
        </div>
        <div
          style={{
            fontSize: 11,
            color: isGap ? "var(--status-warning)" : "var(--fg-muted)",
            fontFamily: "var(--font-source-code-pro), ui-monospace, monospace",
            letterSpacing: "0.4px",
            marginTop: 2,
            fontVariantNumeric: "tabular-nums",
          }}
        >
          {isGap
            ? "GAP"
            : `${tco2e} kg · ${Math.round((conf ?? 0) * 100)}%`}
        </div>
      </div>
    </div>
  );
}

function AgentDot({
  label,
  state,
}: {
  label: string;
  state: "done" | "active" | "pending";
}) {
  const color =
    state === "done"
      ? "var(--brand-green)"
      : state === "active"
        ? "var(--status-warning)"
        : "var(--fg-faint)";
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 6,
        minWidth: 0,
      }}
    >
      <span
        aria-hidden
        style={{
          width: 10,
          height: 10,
          borderRadius: 9999,
          background: state === "pending" ? "transparent" : color,
          border: `1px solid ${color}`,
          animation:
            state === "active" ? "ca-pulse-soft 1.2s ease-in-out infinite" : undefined,
        }}
      />
      <span
        style={{
          fontFamily: "var(--font-source-code-pro), ui-monospace, monospace",
          fontSize: 9.5,
          letterSpacing: "0.4px",
          color: state === "pending" ? "var(--fg-faint)" : "var(--fg-muted)",
          textAlign: "center",
          whiteSpace: "nowrap",
          overflow: "hidden",
          textOverflow: "ellipsis",
          maxWidth: "100%",
        }}
      >
        {label}
      </span>
    </div>
  );
}

function ConfidenceRing({ value }: { value: number }) {
  const size = 84;
  const stroke = 8;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const dash = c * value;
  const gap = c - dash;
  return (
    <div
      style={{ position: "relative", width: size, height: size }}
      aria-hidden
    >
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="var(--bg-inset)"
          strokeWidth={stroke}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="var(--brand-green)"
          strokeWidth={stroke}
          strokeDasharray={`${dash} ${gap}`}
          strokeLinecap="butt"
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </svg>
      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 2,
        }}
      >
        <span
          style={{
            fontSize: 18,
            color: "var(--fg-primary)",
            fontVariantNumeric: "tabular-nums",
            lineHeight: 1,
          }}
        >
          {Math.round(value * 100)}%
        </span>
        <span
          style={{
            fontFamily: "var(--font-source-code-pro), ui-monospace, monospace",
            fontSize: 9,
            letterSpacing: "0.6px",
            color: "var(--fg-muted)",
          }}
        >
          CONF
        </span>
      </div>
    </div>
  );
}

function Sparkline({ progress }: { progress: number }) {
  const w = 220;
  const h = 64;
  const max = Math.max(...SPARK_POINTS);
  const min = Math.min(...SPARK_POINTS);
  const reveal = clamp01(band(progress, 0.15, 0.7));
  const lastIdx = Math.floor(reveal * (SPARK_POINTS.length - 1));
  const visible = SPARK_POINTS.slice(0, lastIdx + 1);
  const points = visible
    .map((v, i) => {
      const x = (i / (SPARK_POINTS.length - 1)) * w;
      const y = h - ((v - min) / (max - min || 1)) * (h - 6) - 3;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
  const areaPoints =
    visible.length > 1 ? `0,${h} ${points} ${(((lastIdx) / (SPARK_POINTS.length - 1)) * w).toFixed(1)},${h}` : "";

  // End-dot.
  const lastX = ((lastIdx) / (SPARK_POINTS.length - 1)) * w;
  const lastY =
    h -
    (((SPARK_POINTS[lastIdx] ?? min) - min) / (max - min || 1)) * (h - 6) -
    3;

  return (
    <div style={{ width: "100%" }}>
      <CodeLabel>14-DAY TREND · MoM −12.4%</CodeLabel>
      <svg
        width="100%"
        height={h}
        viewBox={`0 0 ${w} ${h}`}
        preserveAspectRatio="none"
        style={{ marginTop: 6, display: "block" }}
        aria-hidden
      >
        <defs>
          <linearGradient id="ca-spark-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="rgba(62,207,142,0.35)" />
            <stop offset="100%" stopColor="rgba(62,207,142,0)" />
          </linearGradient>
        </defs>
        {areaPoints ? (
          <polygon points={areaPoints} fill="url(#ca-spark-fill)" />
        ) : null}
        {visible.length > 1 ? (
          <polyline
            points={points}
            fill="none"
            stroke="var(--brand-green)"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        ) : null}
        {visible.length > 0 ? (
          <circle cx={lastX} cy={lastY} r="3" fill="var(--brand-green)" />
        ) : null}
      </svg>
    </div>
  );
}

function ScopeBreakdown({ progress }: { progress: number }) {
  const t = easeOutCubic(band(progress, 0.18, 0.7));
  const rows: Array<{ label: string; pct: number; color: string }> = [
    { label: "Travel",       pct: 36 * t, color: "var(--cat-travel)" },
    { label: "Procurement",  pct: 29 * t, color: "var(--cat-services)" },
    { label: "Food",         pct: 18 * t, color: "var(--cat-goods)" },
    { label: "Energy",       pct: 12 * t, color: "var(--cat-electricity)" },
  ];
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6, minWidth: 140 }}>
      <CodeLabel>BY CATEGORY</CodeLabel>
      <div style={{ display: "flex", flexDirection: "column", gap: 4, marginTop: 4 }}>
        {rows.map((r) => (
          <div
            key={r.label}
            style={{
              display: "grid",
              gridTemplateColumns: "8px 1fr 28px",
              alignItems: "center",
              gap: 8,
            }}
          >
            <span
              aria-hidden
              style={{
                width: 6,
                height: 6,
                borderRadius: 9999,
                background: r.color,
              }}
            />
            <div
              style={{
                height: 4,
                background: "var(--bg-inset)",
                borderRadius: 9999,
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  height: "100%",
                  width: `${r.pct}%`,
                  background: r.color,
                }}
              />
            </div>
            <span
              style={{
                fontSize: 11,
                color: "var(--fg-secondary)",
                fontVariantNumeric: "tabular-nums",
                textAlign: "right",
              }}
            >
              {Math.round(r.pct)}%
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function SwapRow({ swap, t }: { swap: Swap; t: number }) {
  const reveal = easeOutCubic(t);
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "1fr auto",
        alignItems: "center",
        gap: 10,
        padding: "8px 10px",
        borderRadius: 8,
        border: "1px solid var(--border-faint)",
        background: "rgba(62,207,142,0.04)",
        opacity: reveal,
        transform: `translateY(${(1 - reveal) * 6}px)`,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
        <span
          style={{
            fontSize: 12,
            color: "var(--fg-muted)",
            textDecoration: "line-through",
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
            maxWidth: 110,
          }}
        >
          {swap.baseline}
        </span>
        <ArrowRight size={11} color="var(--fg-muted)" />
        <span
          style={{
            fontSize: 13,
            color: "var(--fg-primary)",
            whiteSpace: "nowrap",
          }}
        >
          {swap.alternative}
        </span>
      </div>
      <div
        style={{
          textAlign: "right",
          fontVariantNumeric: "tabular-nums",
          display: "flex",
          flexDirection: "column",
          gap: 2,
          minWidth: 84,
        }}
      >
        <span style={{ fontSize: 13, color: "var(--brand-green)", lineHeight: 1.1 }}>
          €{Math.abs(swap.costDeltaEur).toLocaleString("nl-NL")}
        </span>
        <span
          style={{
            fontSize: 11,
            color: "var(--fg-muted)",
            fontFamily: "var(--font-source-code-pro), ui-monospace, monospace",
            letterSpacing: "0.4px",
          }}
        >
          {swap.co2eDelta} tCO₂e
        </span>
      </div>
    </div>
  );
}

function ReserveLine({ progress }: { progress: number }) {
  // Grid layout guarantees the labels never collide with the puck:
  //   [Books pill] · [center track — puck travels here only] · [Vault pill]
  return (
    <div
      style={{
        height: 44,
        borderRadius: 8,
        background: "var(--bg-inset)",
        border: "1px solid var(--border-faint)",
        display: "grid",
        gridTemplateColumns: "auto minmax(0, 1fr) auto",
        alignItems: "center",
        gap: 10,
        padding: "0 10px",
      }}
    >
      {/* From pill */}
      <div
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
          fontSize: 12,
          color: "var(--fg-secondary)",
          whiteSpace: "nowrap",
        }}
      >
        <Banknote size={12} color="var(--fg-muted)" />
        Books
      </div>

      {/* Center track — relative parent so puck is bounded by this column */}
      <div style={{ position: "relative", height: 28 }} aria-hidden>
        {/* Hairline */}
        <div
          style={{
            position: "absolute",
            top: "50%",
            left: 4,
            right: 4,
            height: 1,
            background: "var(--border-faint)",
            transform: "translateY(-0.5px)",
          }}
        />
        {/* Moving puck — travels from 0% to 100% of THIS track only */}
        <div
          style={{
            position: "absolute",
            top: "50%",
            left: `calc(${progress * 100}% )`,
            transform: "translate(-50%, -50%)",
            width: 26,
            height: 26,
            borderRadius: 9999,
            background: "var(--brand-green-soft)",
            border: "1px solid var(--brand-green-border)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            boxSizing: "border-box",
          }}
        >
          <Wallet size={12} color="var(--brand-green)" />
        </div>
      </div>

      {/* To pill */}
      <div
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
          fontSize: 12,
          color: progress >= 1 ? "var(--brand-green)" : "var(--fg-secondary)",
          whiteSpace: "nowrap",
        }}
      >
        Carbon vault
        <ArrowDownRight size={12} />
      </div>
    </div>
  );
}
