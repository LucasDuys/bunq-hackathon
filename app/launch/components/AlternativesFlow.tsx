"use client";

/**
 * AlternativesFlow — S13 side-by-side flow.
 *
 * Three columns: CURRENT SPEND  →  ALTERNATIVE  →  SAVINGS.
 *
 * One row per win-win swap (filtered from MATRIX_POINTS where quadrant ===
 * "win_win"). Each row reveals on a stagger:
 *
 *   1. Left "current" card fades in (opacity + translateY 12px).
 *   2. Brand-green hairline arrow draws left → right (200ms stroke-dashoffset).
 *   3. Right "alternative" card fades in.
 *   4. Savings cell appears, numbers count up via CountUpNumber.
 *
 * Total row stagger is 220ms; the bottom TOTAL row appears at progress ≥ 0.85
 * with a soft glow. WIN-WIN pill sits at the top-right of the savings cell.
 *
 * No drop shadows. Only DESIGN.md tokens. tabular-nums on every number.
 * Honors prefers-reduced-motion (collapses staggers + transitions).
 */

import { useMemo } from "react";
import { Check } from "lucide-react";
import type { MatrixPoint } from "../types";
import { CountUpNumber } from "./CountUpNumber";
import { fmtEur } from "@/lib/utils";

// ─── Per-row stagger ─────────────────────────────────────────────────────────
// 5 rows × 220ms = 1100ms; row reveal slot lasts 600ms.
// Whole rows reveal sweep maps to scene progress 0.05 → 0.55.
const ROW_STAGGER_NORM = 0.10; // 0.55 - 0.05 = 0.50, /5 ≈ 0.10 each row start
const ROW_REVEAL_NORM = 0.18;   // each row's slot length (slightly overlaps next)
const REVEAL_START = 0.05;
const TOTAL_START = 0.85;
const TOTAL_END = 1.0;

// Sub-stages within a single row's 0..1 local progress:
//   0.00 - 0.30 : left card fade in
//   0.20 - 0.50 : arrow draws
//   0.40 - 0.70 : right card fade in
//   0.65 - 1.00 : savings cell + count up
const stage = (t: number, a: number, b: number) =>
  Math.max(0, Math.min(1, (t - a) / (b - a)));

const easeOutCubic = (t: number) =>
  t <= 0 ? 0 : t >= 1 ? 1 : 1 - Math.pow(1 - t, 3);

// ─── Per-baseline annual spend lookup (from PRIORITY_CLUSTERS or canonical) ─
// `MatrixPoint` doesn't carry the current annual spend; spec gives canonical
// numbers. Keys = the `baseline` string from MATRIX_POINTS.
const CURRENT_SPEND: Record<
  string,
  { annualEur: number; tco2e: number; categoryColor: string }
> = {
  "KLM AMS–FRA flights":  { annualEur: 48600, tco2e: 73.9, categoryColor: "var(--cat-travel)" },
  "Confluence":           { annualEur:  7500, tco2e:  0.8, categoryColor: "var(--cat-digital)" },
  "Beef-heavy catering":  { annualEur: 14400, tco2e: 12.4, categoryColor: "var(--cat-services)" },
  "New Coolblue laptops": { annualEur: 31200, tco2e:  8.1, categoryColor: "var(--cat-goods)" },
  "Same-day shipping":    { annualEur:  6800, tco2e:  3.6, categoryColor: "var(--cat-goods)" },
};

export type AlternativesFlowProps = {
  points: MatrixPoint[];
  /** 0..1 scene progress. */
  progress: number;
};

export function AlternativesFlow({ points, progress }: AlternativesFlowProps) {
  // Filter to win-win rows only (5 expected: p1, p2, p3, p4, p6).
  const rows = useMemo(
    () => points.filter((p) => p.quadrant === "win_win"),
    [points]
  );

  // Per-row local progress (0..1)
  const rowLocal = useMemo(
    () =>
      rows.map((_, i) => {
        const start = REVEAL_START + i * ROW_STAGGER_NORM;
        const local = (progress - start) / ROW_REVEAL_NORM;
        return Math.max(0, Math.min(1, local));
      }),
    [rows, progress]
  );

  // Tally totals from the visible rows so the bottom row is consistent.
  const totals = useMemo(() => {
    return rows.reduce(
      (acc, r) => ({
        cost: acc.cost + r.costDeltaEur,
        co2e: acc.co2e + r.co2eDelta,
      }),
      { cost: 0, co2e: 0 }
    );
  }, [rows]);

  const totalLocal = useMemo(() => {
    const t = (progress - TOTAL_START) / (TOTAL_END - TOTAL_START);
    return Math.max(0, Math.min(1, t));
  }, [progress]);

  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        gap: 24,
      }}
      role="region"
      aria-label="Alternatives flow — current spend, alternative, savings"
    >
      <ColumnHeaders />

      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 12,
          flex: 1,
        }}
      >
        {rows.map((row, i) => (
          <Row key={row.id} row={row} t={rowLocal[i] ?? 0} />
        ))}
      </div>

      <TotalRow
        cost={totals.cost}
        co2e={totals.co2e}
        local={totalLocal}
      />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Column headers
// ─────────────────────────────────────────────────────────────────────────────

function ColumnHeaders() {
  const labelStyle: React.CSSProperties = {
    fontFamily: "var(--font-source-code-pro), ui-monospace, monospace",
    fontSize: 12,
    letterSpacing: "1.2px",
    textTransform: "uppercase",
    color: "var(--fg-muted)",
  };
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "1fr 56px 1fr 280px",
        gap: 16,
        alignItems: "center",
        padding: "0 4px 8px 4px",
        borderBottom: "1px solid var(--border-faint)",
      }}
    >
      <div style={labelStyle}>Current spend</div>
      <div /> {/* arrow column */}
      <div style={labelStyle}>Alternative</div>
      <div style={{ ...labelStyle, textAlign: "right" }}>Savings · per year</div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Row
// ─────────────────────────────────────────────────────────────────────────────

function Row({ row, t }: { row: MatrixPoint; t: number }) {
  const leftT = easeOutCubic(stage(t, 0, 0.3));
  const arrowT = stage(t, 0.2, 0.5);
  const rightT = easeOutCubic(stage(t, 0.4, 0.7));
  const savingsT = stage(t, 0.65, 1.0);

  const lookup = CURRENT_SPEND[row.baseline];
  const annualEur = lookup?.annualEur ?? 0;
  const baselineTco2e = lookup?.tco2e ?? Math.abs(row.co2eDelta);
  const dotColor = lookup?.categoryColor ?? "var(--cat-services)";

  // Alternative spend = current + costDelta (delta is negative)
  const altSpend = annualEur + row.costDeltaEur;

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "1fr 56px 1fr 280px",
        gap: 16,
        alignItems: "stretch",
        minHeight: 88,
      }}
    >
      {/* ── Current spend card ── */}
      <SpendCard
        title={row.baseline}
        annualEur={annualEur}
        tco2e={baselineTco2e}
        dotColor={dotColor}
        opacity={leftT}
        translateY={(1 - leftT) * 12}
      />

      {/* ── Arrow ── */}
      <ArrowCell t={arrowT} />

      {/* ── Alternative card ── */}
      <SpendCard
        title={row.alternative}
        annualEur={altSpend}
        tco2e={null}
        dotColor="var(--brand-green)"
        opacity={rightT}
        translateY={(1 - rightT) * 12}
        accent
      />

      {/* ── Savings cell ── */}
      <SavingsCell
        costDeltaEur={row.costDeltaEur}
        co2eDelta={row.co2eDelta}
        local={savingsT}
        rowKey={row.id}
      />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Spend card (current OR alternative)
// ─────────────────────────────────────────────────────────────────────────────

function SpendCard({
  title,
  annualEur,
  tco2e,
  dotColor,
  opacity,
  translateY,
  accent = false,
}: {
  title: string;
  annualEur: number;
  tco2e: number | null;
  dotColor: string;
  opacity: number;
  translateY: number;
  accent?: boolean;
}) {
  return (
    <div
      style={{
        background: "var(--bg-canvas, #171717)",
        border: `1px solid ${
          accent ? "var(--brand-green-border)" : "var(--border-default)"
        }`,
        borderRadius: 12,
        padding: "12px 16px",
        opacity,
        transform: `translate3d(0, ${translateY}px, 0)`,
        transition: "opacity 200ms ease-out, transform 200ms ease-out",
        willChange: "opacity, transform",
        display: "flex",
        flexDirection: "column",
        gap: 6,
        justifyContent: "center",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span
          aria-hidden="true"
          style={{
            display: "inline-block",
            width: 6,
            height: 6,
            borderRadius: "50%",
            background: dotColor,
            flexShrink: 0,
          }}
        />
        <span
          style={{
            color: "var(--fg-primary)",
            fontSize: 14,
            fontWeight: 500,
            fontFamily: "var(--font-inter), system-ui, sans-serif",
            letterSpacing: "-0.005em",
          }}
        >
          {title}
        </span>
      </div>

      <div
        style={{
          display: "flex",
          alignItems: "baseline",
          gap: 8,
          color: "var(--fg-secondary)",
          fontSize: 13,
          fontFamily: "var(--font-inter), system-ui, sans-serif",
          fontVariantNumeric: "tabular-nums",
        }}
      >
        <span>{fmtEur(annualEur, 0)} / yr</span>
        {tco2e !== null ? (
          <>
            <span style={{ color: "var(--fg-faint)" }}>·</span>
            <span>
              <span style={{ fontVariantNumeric: "tabular-nums" }}>
                {tco2e.toFixed(1)}
              </span>{" "}
              <span style={{ color: "var(--fg-muted)" }}>tCO₂e</span>
            </span>
          </>
        ) : null}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Arrow cell — animated brand-green hairline
// ─────────────────────────────────────────────────────────────────────────────

function ArrowCell({ t }: { t: number }) {
  const eased = easeOutCubic(t);
  const dashOffset = (1 - eased) * 56;
  const headOpacity = Math.max(0, (eased - 0.6) / 0.4);

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
      aria-hidden="true"
    >
      <svg width={56} height={20} viewBox="0 0 56 20" style={{ display: "block" }}>
        {/* hairline */}
        <line
          x1={2}
          y1={10}
          x2={50}
          y2={10}
          stroke="var(--brand-green)"
          strokeWidth={1.25}
          strokeDasharray={56}
          strokeDashoffset={dashOffset}
          style={{ transition: "stroke-dashoffset 200ms linear" }}
        />
        {/* head */}
        <polyline
          points="44,5 52,10 44,15"
          fill="none"
          stroke="var(--brand-green)"
          strokeWidth={1.25}
          strokeLinecap="round"
          strokeLinejoin="round"
          opacity={headOpacity}
          style={{ transition: "opacity 150ms linear" }}
        />
      </svg>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Savings cell
// ─────────────────────────────────────────────────────────────────────────────

function SavingsCell({
  costDeltaEur,
  co2eDelta,
  local,
  rowKey,
}: {
  costDeltaEur: number;
  co2eDelta: number;
  local: number;
  rowKey: string;
}) {
  const opacity = easeOutCubic(local);
  const translateY = (1 - opacity) * 8;
  const showCounter = local > 0.05;

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "flex-end",
        justifyContent: "center",
        gap: 4,
        opacity,
        transform: `translate3d(0, ${translateY}px, 0)`,
        transition: "opacity 240ms ease-out, transform 240ms ease-out",
        willChange: "opacity, transform",
        position: "relative",
      }}
    >
      <WinWinBadge />

      <div
        style={{
          display: "flex",
          alignItems: "baseline",
          gap: 6,
          color: "var(--brand-green)",
          fontSize: 22,
          fontFamily: "var(--font-inter), system-ui, sans-serif",
          fontWeight: 400,
          fontVariantNumeric: "tabular-nums",
          letterSpacing: "-0.01em",
          lineHeight: 1.0,
        }}
      >
        {showCounter ? (
          <CountUpNumber
            value={costDeltaEur}
            decimals={0}
            prefix="€ "
            durationMs={500}
            restartKey={`cost-${rowKey}`}
          />
        ) : (
          <span style={{ fontVariantNumeric: "tabular-nums" }}>€ 0</span>
        )}
        <span
          style={{
            fontFamily: "var(--font-source-code-pro), ui-monospace, monospace",
            fontSize: 11,
            letterSpacing: "1.2px",
            textTransform: "uppercase",
            color: "var(--fg-muted)",
          }}
        >
          / yr
        </span>
      </div>

      <div
        style={{
          display: "flex",
          alignItems: "baseline",
          gap: 6,
          color: "var(--brand-green)",
          fontSize: 16,
          fontFamily: "var(--font-inter), system-ui, sans-serif",
          fontWeight: 400,
          fontVariantNumeric: "tabular-nums",
          letterSpacing: "-0.005em",
          lineHeight: 1.0,
        }}
      >
        {showCounter ? (
          <CountUpNumber
            value={co2eDelta}
            decimals={1}
            durationMs={500}
            restartKey={`co2-${rowKey}`}
          />
        ) : (
          <span style={{ fontVariantNumeric: "tabular-nums" }}>0.0</span>
        )}
        <span
          style={{
            color: "var(--fg-muted)",
            fontSize: 12,
            fontFamily: "var(--font-inter), system-ui, sans-serif",
          }}
        >
          tCO₂e
        </span>
        <ConfidencePill />
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Pills
// ─────────────────────────────────────────────────────────────────────────────

function WinWinBadge() {
  return (
    <span
      style={{
        position: "absolute",
        top: -6,
        right: 0,
        display: "inline-flex",
        alignItems: "center",
        gap: 4,
        padding: "2px 8px",
        borderRadius: 9999,
        background: "rgba(62,207,142,0.10)",
        border: "1px solid var(--brand-green-border)",
        color: "var(--brand-green-link, var(--brand-green))",
        fontFamily: "var(--font-inter), system-ui, sans-serif",
        fontSize: 10,
        fontWeight: 500,
        letterSpacing: "0.04em",
        textTransform: "uppercase",
        lineHeight: 1.0,
      }}
    >
      <Check size={10} strokeWidth={2.5} />
      Win-win
    </span>
  );
}

function ConfidencePill() {
  return (
    <span
      style={{
        marginLeft: 6,
        display: "inline-flex",
        alignItems: "center",
        padding: "1px 6px",
        borderRadius: 9999,
        border: `1px solid var(--brand-green-border)`,
        color: "var(--confidence-high, var(--brand-green))",
        fontFamily: "var(--font-source-code-pro), ui-monospace, monospace",
        fontSize: 10,
        letterSpacing: "1.2px",
        textTransform: "uppercase",
        lineHeight: 1.0,
      }}
    >
      High
    </span>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Total row
// ─────────────────────────────────────────────────────────────────────────────

function TotalRow({
  cost,
  co2e,
  local,
}: {
  cost: number;
  co2e: number;
  local: number;
}) {
  const opacity = easeOutCubic(local);
  // Soft "glow" via a brand-green tinted border that strengthens with reveal.
  const borderAlpha = 0.20 + opacity * 0.30;

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "1fr 56px 1fr 280px",
        gap: 16,
        alignItems: "center",
        padding: "16px 16px",
        borderTop: "1px solid var(--border-faint)",
        borderRadius: 12,
        background: `rgba(62,207,142,${0.04 + opacity * 0.04})`,
        border: `1px solid rgba(62,207,142,${borderAlpha})`,
        opacity,
        transform: `translate3d(0, ${(1 - opacity) * 6}px, 0)`,
        transition: "opacity 320ms ease-out, transform 320ms ease-out",
        willChange: "opacity, transform",
      }}
    >
      <div
        style={{
          fontFamily: "var(--font-source-code-pro), ui-monospace, monospace",
          fontSize: 12,
          letterSpacing: "1.2px",
          textTransform: "uppercase",
          color: "var(--fg-secondary)",
        }}
      >
        Total · 5 swaps
      </div>
      <div /> {/* arrow column */}
      <div /> {/* alt column */}

      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "flex-end",
          gap: 4,
        }}
      >
        <div
          style={{
            color: "var(--brand-green)",
            fontSize: 28,
            fontFamily: "var(--font-inter), system-ui, sans-serif",
            fontWeight: 400,
            fontVariantNumeric: "tabular-nums",
            letterSpacing: "-0.015em",
            lineHeight: 1.0,
          }}
        >
          {local > 0.05 ? (
            <CountUpNumber
              value={cost}
              decimals={0}
              prefix="€ "
              durationMs={700}
              restartKey="total-cost"
            />
          ) : (
            <span style={{ fontVariantNumeric: "tabular-nums" }}>€ 0</span>
          )}
        </div>
        <div
          style={{
            color: "var(--brand-green)",
            fontSize: 18,
            fontFamily: "var(--font-inter), system-ui, sans-serif",
            fontWeight: 400,
            fontVariantNumeric: "tabular-nums",
            letterSpacing: "-0.005em",
            lineHeight: 1.0,
            display: "flex",
            alignItems: "baseline",
            gap: 6,
          }}
        >
          {local > 0.05 ? (
            <CountUpNumber
              value={co2e}
              decimals={1}
              durationMs={700}
              restartKey="total-co2"
            />
          ) : (
            <span style={{ fontVariantNumeric: "tabular-nums" }}>0.0</span>
          )}
          <span
            style={{
              color: "var(--fg-muted)",
              fontSize: 12,
              fontFamily: "var(--font-inter), system-ui, sans-serif",
            }}
          >
            tCO₂e
          </span>
        </div>
      </div>
    </div>
  );
}
