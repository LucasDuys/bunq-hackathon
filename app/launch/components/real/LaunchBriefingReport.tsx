"use client";

/**
 * LaunchBriefingReport — S13C scene body. The "monthly briefing that wrote
 * itself". Renders a hero report layout (huge sentence-case headline → KPI
 * strip card with internal vertical dividers → executive read paragraph) on
 * the dark Carbo canvas inside MacWindow.macInterior.
 *
 * Animation choreography is driven by `progress` (0..1, the scene's
 * normalized elapsed time) so timing stays scene-relative and frame-stable:
 *   - 0.00 → Eyebrow + Download PDF pill mount.
 *   - 0.05–0.40 → Hero headline reveals 3 lines staggered (200ms apart),
 *                 then sub-paragraph fades in.
 *   - 0.30 → Period · Transactions · Confidence · Generated meta row mounts.
 *   - 0.36 → KPI strip card mounts; KPI numbers count up via CountUpNumber.
 *   - 0.45 → Delta indicators ("↘ -21%", "↘ -15%") slide in.
 *   - 0.50 → Confidence bar fills 0 → 27% in red.
 *   - 0.55 → Executive read paragraph types in over ~2.5s (perCharMs 14).
 *
 * Numbers come from sample-run data shaped to match the screenshot:
 *   total CO₂e 7474 kg = 7.47 tCO₂e, spend €20,448, confidence 27%, reserve
 *   €0, 73 transactions, 1 anomaly, top swap saves ~440 kg. fmtKg in
 *   lib/utils handles the kg→t flip for display.
 */
import { useMemo } from "react";
import { Download, ArrowDownRight, Leaf } from "lucide-react";
import { CodeLabel } from "@/components/ui";
import { CountUpNumber } from "@/app/launch/components/CountUpNumber";
import { TypedText } from "@/app/launch/components/TypedText";
import { fmtKg } from "@/lib/utils";

export type LaunchBriefingReportProps = {
  /** 0..1 normalized progress through the scene. */
  progress: number;
};

// ── Briefing fixture ────────────────────────────────────────────────────────
const BRIEFING = {
  period: { from: "2026-04-01", to: "2026-05-01", monthLabel: "2026-04" },
  totalCo2eKg: 7474,
  totalCo2eDeltaPct: -21,
  spendEur: 20448,
  spendDeltaPct: -15,
  confidence: 0.27,
  reserveEur: 0,
  transactions: 73,
  anomalies: 1,
  generatedAt: "25/04/2026, 05:06",
  prevMonth: "2026-03",
  topDriverCategory: "other",
  topDriverKg: 2642,
  topDriverPct: 35,
  topSwap: {
    label: "Refurbished electronics + consolidated bulk orders",
    savesKg: 440,
  },
} as const;

const HERO_LINES = [
  "A clear-eyed read",
  "on bunq B.V.'s",
  "carbon position.",
] as const;

const SUB_PARAGRAPH =
  "Monthly internal summary — not a regulatory disclosure. Every CO₂e number ships with a confidence band; the swaps below are the highest-leverage adjustments we found in this period's spend.";

const EXECUTIVE_READ =
  `In ${BRIEFING.period.monthLabel}, ${BRIEFING.transactions} transactions produced ${BRIEFING.totalCo2eKg.toLocaleString("en-NL")} kg CO₂e (${BRIEFING.totalCo2eDeltaPct}% vs ${BRIEFING.prevMonth}) at ${Math.round(BRIEFING.confidence * 100)}% confidence. ${BRIEFING.topDriverCategory} is the largest driver at ${BRIEFING.topDriverKg.toLocaleString("en-NL")} kg (${BRIEFING.topDriverPct}% of total). ${BRIEFING.anomalies} anomaly flagged this period. Top swap opportunity: ${BRIEFING.topSwap.label} (saves ~${BRIEFING.topSwap.savesKg} kg).`;

// ── helpers ────────────────────────────────────────────────────────────────
function fadeInAt(progress: number, start: number, fadeMs = 0.06): number {
  const local = (progress - start) / fadeMs;
  return Math.max(0, Math.min(1, local));
}

function slideUpAt(progress: number, start: number, fadeMs = 0.08) {
  const t = fadeInAt(progress, start, fadeMs);
  return { opacity: t, transform: `translateY(${(1 - t) * 8}px)` };
}

export function LaunchBriefingReport({ progress }: LaunchBriefingReportProps) {
  // Hero line reveals — staggered 200ms apart at 8000ms scene = 0.025 progress per 200ms
  const heroLineDelay = 0.025;
  const heroStart = 0.05;

  // KPI strip mounts at 0.36, count-up via CountUpNumber re-tweens via restartKey
  const kpiMounted = progress >= 0.36;
  const kpiRestartKey = kpiMounted ? "mounted" : "pre";

  // Delta indicators at 0.45
  const deltaT = fadeInAt(progress, 0.45, 0.06);

  // Confidence bar fill at 0.50
  const confT = fadeInAt(progress, 0.5, 0.18);
  const confPct = Math.round(BRIEFING.confidence * 100 * confT);

  // Period meta row at 0.30
  const metaT = fadeInAt(progress, 0.3, 0.08);

  // Executive read typewriter starts at 0.55
  const execStarted = progress >= 0.55;
  const execKey = useMemo(() => (execStarted ? "exec" : "pre"), [execStarted]);

  // Sub-paragraph fade after hero settles
  const subT = fadeInAt(progress, 0.18, 0.1);

  // Eyebrow + Download CTA mount immediately
  const headerT = fadeInAt(progress, 0.0, 0.06);

  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        background: "var(--bg-canvas)",
        overflowY: "auto",
      }}
    >
      <div
        style={{
          maxWidth: 1200,
          margin: "0 auto",
          padding: "40px 32px 48px 32px",
          display: "flex",
          flexDirection: "column",
          gap: 32,
        }}
      >
        {/* ── Top bar: eyebrow + Download PDF pill ─────────────────────── */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 16,
            opacity: headerT,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Leaf
              style={{
                height: 14,
                width: 14,
                color: "var(--brand-green)",
                flexShrink: 0,
              }}
              aria-hidden
            />
            <CodeLabel>
              MONTHLY BRIEFING · {BRIEFING.period.monthLabel}
            </CodeLabel>
          </div>
          <button
            type="button"
            style={{
              height: 36,
              padding: "0 18px",
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              background: "var(--bg-button)",
              border: "1px solid var(--border-default)",
              borderRadius: 9999,
              color: "var(--fg-primary)",
              fontSize: 13,
              fontWeight: 500,
              fontFamily: "var(--font-inter), system-ui, sans-serif",
              cursor: "pointer",
            }}
          >
            <Download
              style={{ height: 14, width: 14, color: "var(--fg-secondary)" }}
              aria-hidden
            />
            Download PDF
          </button>
        </div>

        {/* ── Hero headline (3 lines, staggered) ───────────────────────── */}
        <h1
          style={{
            fontFamily: "var(--font-inter), system-ui, sans-serif",
            fontWeight: 400,
            fontSize: "clamp(56px, 7.6vw, 88px)",
            lineHeight: 1.0,
            letterSpacing: "-0.02em",
            color: "var(--fg-primary)",
            margin: "8px 0 0 0",
            display: "flex",
            flexDirection: "column",
            gap: 0,
          }}
          aria-label={HERO_LINES.join(" ")}
        >
          {HERO_LINES.map((line, i) => {
            const start = heroStart + i * heroLineDelay;
            const s = slideUpAt(progress, start, 0.08);
            return (
              <span
                key={line}
                aria-hidden
                style={{
                  display: "block",
                  opacity: s.opacity,
                  transform: s.transform,
                  transition: "none",
                }}
              >
                {line}
              </span>
            );
          })}
        </h1>

        {/* ── Sub paragraph ────────────────────────────────────────────── */}
        <p
          style={{
            fontSize: 16,
            lineHeight: 1.55,
            color: "var(--fg-secondary)",
            maxWidth: "62ch",
            margin: 0,
            opacity: subT,
            transform: `translateY(${(1 - subT) * 6}px)`,
          }}
        >
          {SUB_PARAGRAPH}
        </p>

        {/* ── Period · Transactions · Confidence · Generated meta row ──── */}
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: "12px 32px",
            paddingTop: 4,
            opacity: metaT,
            transform: `translateY(${(1 - metaT) * 4}px)`,
          }}
        >
          <MetaItem label="PERIOD">
            <span
              style={{
                fontFamily:
                  "var(--font-source-code-pro), ui-monospace, monospace",
                fontSize: 13,
                color: "var(--fg-secondary)",
                fontVariantNumeric: "tabular-nums",
              }}
            >
              {BRIEFING.period.from} → {BRIEFING.period.to}
            </span>
          </MetaItem>
          <MetaItem label="TRANSACTIONS">
            <span
              style={{
                fontSize: 13,
                color: "var(--fg-secondary)",
                fontVariantNumeric: "tabular-nums",
              }}
            >
              {BRIEFING.transactions}
            </span>
          </MetaItem>
          <MetaItem label="CONFIDENCE">
            <span
              style={{
                fontSize: 13,
                color: "var(--fg-secondary)",
                fontVariantNumeric: "tabular-nums",
              }}
            >
              {Math.round(BRIEFING.confidence * 100)}%
            </span>
          </MetaItem>
          <MetaItem label="GENERATED">
            <span
              style={{
                fontFamily:
                  "var(--font-source-code-pro), ui-monospace, monospace",
                fontSize: 13,
                color: "var(--fg-secondary)",
                fontVariantNumeric: "tabular-nums",
              }}
            >
              {BRIEFING.generatedAt}
            </span>
          </MetaItem>
        </div>

        {/* ── Faint divider ───────────────────────────────────────────── */}
        <hr
          style={{
            border: 0,
            height: 1,
            background: "var(--border-faint)",
            margin: "8px 0 0 0",
          }}
        />

        {/* ── KPI strip: single card, 4 columns, internal vertical dividers ── */}
        <div
          style={{
            background: "var(--bg-canvas)",
            border: "1px solid var(--border-default)",
            borderRadius: 12,
            display: "grid",
            gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
            opacity: kpiMounted ? 1 : 0,
            transform: kpiMounted ? "translateY(0)" : "translateY(8px)",
            transition: "opacity 280ms ease-out, transform 280ms ease-out",
          }}
        >
          {/* Total CO2e */}
          <KpiCell isFirst>
            <CodeLabel>TOTAL CO₂E</CodeLabel>
            <KpiValue>
              <CountUpNumber
                value={BRIEFING.totalCo2eKg / 1000}
                durationMs={900}
                decimals={2}
                restartKey={kpiRestartKey}
              />
              <span
                style={{
                  fontSize: 18,
                  marginLeft: 6,
                  color: "var(--fg-secondary)",
                }}
              >
                tCO₂e
              </span>
            </KpiValue>
            <DeltaRow t={deltaT} pct={BRIEFING.totalCo2eDeltaPct}>
              <span style={{ color: "var(--fg-muted)" }}>
                vs {BRIEFING.prevMonth}
              </span>
            </DeltaRow>
          </KpiCell>

          {/* Spend analysed */}
          <KpiCell>
            <CodeLabel>SPEND ANALYSED</CodeLabel>
            <KpiValue>
              <CountUpNumber
                value={BRIEFING.spendEur}
                durationMs={900}
                decimals={0}
                restartKey={kpiRestartKey}
              />
              <span
                style={{
                  fontSize: 18,
                  marginLeft: 6,
                  color: "var(--fg-secondary)",
                }}
              >
                EUR
              </span>
            </KpiValue>
            <DeltaRow t={deltaT} pct={BRIEFING.spendDeltaPct}>
              <span style={{ color: "var(--fg-muted)" }}>
                vs {BRIEFING.prevMonth}
              </span>
            </DeltaRow>
          </KpiCell>

          {/* Confidence */}
          <KpiCell>
            <CodeLabel>CONFIDENCE</CodeLabel>
            <KpiValue>
              <CountUpNumber
                value={Math.round(BRIEFING.confidence * 100)}
                durationMs={900}
                decimals={0}
                restartKey={kpiRestartKey}
              />
              <span
                style={{
                  fontSize: 18,
                  marginLeft: 6,
                  color: "var(--fg-secondary)",
                }}
              >
                %
              </span>
            </KpiValue>
            {/* In-cell confidence bar — red because 27% < 60% */}
            <div style={{ width: "100%", paddingTop: 4 }}>
              <div
                role="progressbar"
                aria-valuenow={Math.round(BRIEFING.confidence * 100)}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label="Report-level confidence"
                style={{
                  height: 6,
                  width: "100%",
                  background: "var(--bg-inset)",
                  borderRadius: 9999,
                  overflow: "hidden",
                }}
              >
                <div
                  style={{
                    height: "100%",
                    width: `${confPct}%`,
                    background: "var(--confidence-low)",
                    borderRadius: 9999,
                    transition: "width 200ms linear",
                  }}
                />
              </div>
              <div
                style={{
                  marginTop: 6,
                  fontSize: 11,
                  letterSpacing: 1.2,
                  textTransform: "uppercase",
                  color: "var(--fg-muted)",
                  fontFamily:
                    "var(--font-source-code-pro), ui-monospace, monospace",
                }}
              >
                spend-weighted
              </div>
            </div>
          </KpiCell>

          {/* Reserve balance */}
          <KpiCell>
            <CodeLabel>RESERVE BALANCE</CodeLabel>
            <KpiValue>
              <CountUpNumber
                value={BRIEFING.reserveEur}
                durationMs={700}
                decimals={0}
                restartKey={kpiRestartKey}
              />
              <span
                style={{
                  fontSize: 18,
                  marginLeft: 6,
                  color: "var(--fg-secondary)",
                }}
              >
                EUR
              </span>
            </KpiValue>
            <div
              style={{
                fontSize: 12,
                color: "var(--fg-muted)",
                fontFamily:
                  "var(--font-source-code-pro), ui-monospace, monospace",
                letterSpacing: 1.2,
                textTransform: "uppercase",
                paddingTop: 4,
              }}
            >
              last close
            </div>
          </KpiCell>
        </div>

        {/* ── Executive read ───────────────────────────────────────────── */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span
              aria-hidden
              style={{
                width: 6,
                height: 6,
                borderRadius: 9999,
                background: "var(--brand-green)",
                flexShrink: 0,
              }}
            />
            <CodeLabel
              style={{
                color: "var(--brand-green-link)",
              }}
            >
              EXECUTIVE READ
            </CodeLabel>
          </div>
          <p
            style={{
              fontSize: 18,
              lineHeight: 1.55,
              color: "var(--fg-primary)",
              maxWidth: "66ch",
              margin: 0,
              fontVariantNumeric: "tabular-nums",
              minHeight: "5em",
            }}
          >
            {execStarted ? (
              <TypedText
                key={execKey}
                text={EXECUTIVE_READ}
                perCharMs={14}
                startDelayMs={0}
              />
            ) : (
              <span aria-hidden style={{ opacity: 0 }}>
                {EXECUTIVE_READ}
              </span>
            )}
          </p>
        </div>
      </div>
    </div>
  );
}

/* ── Internal building blocks ────────────────────────────────────────── */

function MetaItem({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      <CodeLabel>{label}</CodeLabel>
      <div>{children}</div>
    </div>
  );
}

function KpiCell({
  children,
  isFirst,
}: {
  children: React.ReactNode;
  isFirst?: boolean;
}) {
  return (
    <div
      style={{
        padding: "20px 24px",
        display: "flex",
        flexDirection: "column",
        gap: 10,
        borderLeft: isFirst ? "none" : "1px solid var(--border-faint)",
        minWidth: 0,
      }}
    >
      {children}
    </div>
  );
}

function KpiValue({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        fontSize: 32,
        fontWeight: 400,
        lineHeight: 1,
        color: "var(--fg-primary)",
        fontVariantNumeric: "tabular-nums",
        letterSpacing: "-0.01em",
        display: "flex",
        alignItems: "baseline",
      }}
    >
      {children}
    </div>
  );
}

function DeltaRow({
  t,
  pct,
  children,
}: {
  t: number;
  pct: number;
  children?: React.ReactNode;
}) {
  // Always show negative-down-right glyph for negative pct. Green = good
  // (carbon and spend going down) — never green-fill, only colored text.
  const negative = pct < 0;
  const tone = negative ? "var(--brand-green)" : "var(--status-danger)";
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        opacity: t,
        transform: `translateY(${(1 - t) * 4}px)`,
        fontSize: 12,
        fontVariantNumeric: "tabular-nums",
      }}
    >
      <span
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 4,
          color: tone,
          fontWeight: 500,
        }}
      >
        <ArrowDownRight
          style={{ width: 13, height: 13 }}
          aria-hidden
        />
        {pct > 0 ? "+" : ""}
        {pct}%
      </span>
      <span
        style={{
          fontFamily: "var(--font-source-code-pro), ui-monospace, monospace",
          letterSpacing: 1.2,
          textTransform: "uppercase",
          fontSize: 11,
        }}
      >
        {children}
      </span>
    </div>
  );
}

// Export the briefing fixture for any sibling that wants to reference the
// numbers without duplicating them. Keeps fmtKg in lib/utils as the canonical
// kg→tCO₂e formatter (used elsewhere in the launch flow).
export const BRIEFING_FIXTURE = BRIEFING;
export const BRIEFING_TOTAL_KG_LABEL = fmtKg(BRIEFING.totalCo2eKg);
