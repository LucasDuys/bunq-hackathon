"use client";

/**
 * TransactionTable — spreadsheet-style transaction grid with three modes:
 *
 *  1. STATIC: render rows as-is. Gap rows render with amber tint, "?" chips,
 *     and AlertCircle markers.
 *  2. FILL-IN (S6 → S7): when `fillRow` is set, the matching gap row animates
 *     its missing cells in three phases driven by `fillProgress` (0..1):
 *       a) 0.00 → 0.30 — AlertCircle pulses, "?" chip fades out, amber tint stays.
 *       b) 0.30 → 0.70 — sub-category text typewriters in (~18ms / char).
 *       c) 0.70 → 1.00 — CO₂e count-up + ConfidenceBar fills + amber tint
 *                        eases to neutral.
 *  3. CLUSTER (S9): when `clusterByCategory` is true, rows reorganize using a
 *     FLIP transform (recorded initial position → eased translateY toward sorted
 *     position). At progress=1 the grouping is visually complete and a coloured
 *     left-edge band marks each category group.
 *
 * No external animation libs — pure React state + CSS transforms + minimal RAF
 * for the count-up. Honours `prefers-reduced-motion`.
 */

import { useMemo } from "react";
import { AlertCircle } from "lucide-react";
import type { TransactionRow } from "../types";
import { fmtEur, fmtKg } from "@/lib/utils";

const CATEGORY_DOT: Record<string, string> = {
  Travel: "var(--cat-travel)",
  Office: "var(--cat-goods)",
  Software: "var(--cat-digital)",
  Energy: "var(--cat-electricity)",
  Catering: "var(--cat-services)",
  Fuel: "var(--cat-fuel)",
};

const dotForCategory = (cat: string): string =>
  CATEGORY_DOT[cat] ?? "var(--cat-other)";

/** Stable sort priority so identical-category rows keep input order under FLIP. */
const CATEGORY_ORDER: Record<string, number> = {
  Travel: 0,
  Energy: 1,
  Office: 2,
  Software: 3,
  Catering: 4,
  Fuel: 5,
};
const orderForCategory = (cat: string): number =>
  CATEGORY_ORDER[cat] ?? 99;

/** Mini cubic-bezier(0.32, 0.72, 0, 1) approximation — same swift-out feel
 *  as CameraFrame but inlined to keep this file self-contained. */
function easeSwift(t: number): number {
  if (t <= 0) return 0;
  if (t >= 1) return 1;
  // closed-form approx good enough for FLIP rows; max error ~0.01
  return 1 - Math.pow(1 - t, 3);
}

const ROW_HEIGHT = 44;

export type TransactionTableProps = {
  transactions: TransactionRow[];
  /** Animate filling in this row's missing cells. */
  fillRow?: { id: string; subCategory: string; tco2eKg: number; confidence: number };
  /** 0..1 progress of the cell-fill animation if fillRow is active. */
  fillProgress?: number;
  /** When true, animate row reorganization grouped by category color (S9). */
  clusterByCategory?: boolean;
  /** 0..1 progress of the clustering animation. */
  clusterProgress?: number;
  /** Scroll viewport offset (pixels). */
  scrollY?: number;
};

export function TransactionTable({
  transactions,
  fillRow,
  fillProgress = 0,
  clusterByCategory = false,
  clusterProgress = 0,
  scrollY = 0,
}: TransactionTableProps) {
  // ── FLIP positions ──
  // Compute the index each row would occupy after a stable category-grouped sort.
  const sortedIndexById = useMemo(() => {
    const sorted = [...transactions]
      .map((t, i) => ({ t, i }))
      .sort((a, b) => {
        const c = orderForCategory(a.t.category) - orderForCategory(b.t.category);
        return c !== 0 ? c : a.i - b.i;
      });
    const map = new Map<string, number>();
    sorted.forEach(({ t }, idx) => map.set(t.id, idx));
    return map;
  }, [transactions]);

  // Build category-group color bands so the right-most column knows its tint.
  const groupBoundaries = useMemo(() => {
    if (!clusterByCategory) return new Map<string, boolean>();
    const sorted = [...transactions].sort(
      (a, b) =>
        orderForCategory(a.category) - orderForCategory(b.category) ||
        transactions.indexOf(a) - transactions.indexOf(b)
    );
    const m = new Map<string, boolean>();
    sorted.forEach((row, idx) => {
      const prev = sorted[idx - 1];
      m.set(row.id, !prev || prev.category !== row.category);
    });
    return m;
  }, [transactions, clusterByCategory]);

  return (
    <div
      style={{
        background: "#171717",
        color: "var(--fg-primary)",
        width: "100%",
        height: "100%",
        overflow: "hidden",
        fontFamily: "var(--font-inter), system-ui, sans-serif",
        position: "relative",
      }}
    >
      <div
        style={{
          transform: `translateY(${-scrollY}px)`,
          transition: "transform 250ms cubic-bezier(0.32,0.72,0,1)",
          willChange: "transform",
        }}
      >
        <Header />

        <div role="rowgroup" style={{ position: "relative" }}>
          {transactions.map((row, originalIdx) => {
            const isFilling = !!fillRow && fillRow.id === row.id;

            // FLIP translation: how many ROW_HEIGHT to slide.
            let flipY = 0;
            if (clusterByCategory) {
              const targetIdx = sortedIndexById.get(row.id) ?? originalIdx;
              const delta = (targetIdx - originalIdx) * ROW_HEIGHT;
              flipY = delta * easeSwift(clusterProgress);
            }

            return (
              <Row
                key={row.id}
                row={row}
                originalIdx={originalIdx}
                flipY={flipY}
                clusterProgress={clusterProgress}
                clusterByCategory={clusterByCategory}
                isGroupStart={!!groupBoundaries.get(row.id)}
                fillRow={isFilling ? fillRow : undefined}
                fillProgress={isFilling ? fillProgress : 0}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Header
// ─────────────────────────────────────────────────────────────────────────────

const HEADERS: Array<{ label: string; width: string; align?: "left" | "right" }> = [
  { label: "Date", width: "110px" },
  { label: "Merchant", width: "1.2fr" },
  { label: "Amount", width: "120px", align: "right" },
  { label: "Category", width: "140px" },
  { label: "Sub-category", width: "1fr" },
  { label: "CO₂e", width: "120px", align: "right" },
  { label: "Confidence", width: "160px" },
];

const GRID_TEMPLATE = HEADERS.map((h) => h.width).join(" ");

function Header() {
  return (
    <div
      role="row"
      style={{
        display: "grid",
        gridTemplateColumns: GRID_TEMPLATE,
        position: "sticky",
        top: 0,
        zIndex: 2,
        background: "#171717",
        borderBottom: "1px solid var(--border-default)",
        height: 36,
        alignItems: "center",
        padding: "0 16px",
        gap: 12,
      }}
    >
      {HEADERS.map((h) => (
        <div
          key={h.label}
          role="columnheader"
          style={{
            fontFamily: "var(--font-source-code-pro), ui-monospace, monospace",
            fontSize: 11,
            letterSpacing: "1.2px",
            textTransform: "uppercase",
            color: "var(--fg-muted)",
            textAlign: h.align ?? "left",
          }}
        >
          {h.label}
        </div>
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Row
// ─────────────────────────────────────────────────────────────────────────────

type RowProps = {
  row: TransactionRow;
  originalIdx: number;
  flipY: number;
  clusterProgress: number;
  clusterByCategory: boolean;
  isGroupStart: boolean;
  fillRow?: { id: string; subCategory: string; tco2eKg: number; confidence: number };
  fillProgress: number;
};

function Row({
  row,
  flipY,
  clusterProgress,
  clusterByCategory,
  isGroupStart,
  fillRow,
  fillProgress,
}: RowProps) {
  const isGap = !!row.isGap;
  // While fillProgress crosses 1.0 the row is no longer treated as a gap.
  const visiblyFilled = fillRow && fillProgress >= 1;
  const showAsGap = isGap && !visiblyFilled;

  // Amber tint eases out toward the end of the fill animation.
  const amberAlpha = (() => {
    if (!isGap) return 0;
    if (!fillRow) return 0.06;
    if (fillProgress >= 1) return 0;
    if (fillProgress < 0.7) return 0.06;
    // 0.7 → 1.0 → 0.06 → 0
    const local = (fillProgress - 0.7) / 0.3;
    return 0.06 * (1 - local);
  })();

  // Cluster band on the left edge once grouping has settled.
  const bandOpacity = clusterByCategory ? Math.max(0, clusterProgress - 0.4) / 0.6 : 0;
  const bandColor = dotForCategory(row.category);

  return (
    <div
      role="row"
      className="ca-launch-row"
      style={{
        display: "grid",
        gridTemplateColumns: GRID_TEMPLATE,
        alignItems: "center",
        height: ROW_HEIGHT,
        padding: "0 16px",
        gap: 12,
        borderBottom: "1px solid var(--border-faint)",
        background: amberAlpha > 0 ? `rgba(247,185,85,${amberAlpha})` : "transparent",
        transform: `translateY(${flipY}px)`,
        transition: "background 320ms ease-out",
        willChange: flipY !== 0 ? "transform" : undefined,
        position: "relative",
      }}
    >
      {/* Cluster group band (left edge) */}
      {clusterByCategory && isGroupStart && (
        <span
          aria-hidden="true"
          style={{
            position: "absolute",
            left: 0,
            top: 0,
            bottom: 0,
            width: 2,
            background: bandColor,
            opacity: bandOpacity,
            transition: "opacity 250ms ease-out",
          }}
        />
      )}

      <div role="cell" style={{ color: "var(--fg-muted)", fontSize: 12, fontFamily: "var(--font-source-code-pro), ui-monospace, monospace" }}>
        {row.date}
      </div>

      <div role="cell" style={{ color: "var(--fg-primary)", fontSize: 13 }}>
        {row.merchant}
      </div>

      <div
        role="cell"
        style={{
          color: "var(--fg-primary)",
          fontSize: 13,
          textAlign: "right",
          fontVariantNumeric: "tabular-nums",
        }}
      >
        {fmtEur(row.amountEur, 2)}
      </div>

      <div role="cell" style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span
          aria-hidden="true"
          style={{
            display: "inline-block",
            width: 6,
            height: 6,
            borderRadius: "50%",
            background: dotForCategory(row.category),
            flexShrink: 0,
          }}
        />
        <span style={{ color: "var(--fg-secondary)", fontSize: 13 }}>
          {row.category}
        </span>
      </div>

      {/* Sub-category — animated typewriter when filling */}
      <div role="cell" style={{ color: showAsGap ? "var(--fg-faint)" : "var(--fg-primary)", fontSize: 13 }}>
        {fillRow ? (
          <SubCategoryFill text={fillRow.subCategory} progress={fillProgress} />
        ) : showAsGap ? (
          <span style={{ color: "var(--fg-faint)" }}>—</span>
        ) : (
          row.subCategory ?? <span style={{ color: "var(--fg-faint)" }}>—</span>
        )}
      </div>

      {/* CO₂e — animated count-up when filling */}
      <div
        role="cell"
        style={{
          color: showAsGap ? "var(--fg-faint)" : "var(--fg-primary)",
          fontSize: 13,
          textAlign: "right",
          fontVariantNumeric: "tabular-nums",
        }}
      >
        {fillRow ? (
          <Co2eFill target={fillRow.tco2eKg} progress={fillProgress} />
        ) : row.tco2eKg !== null ? (
          fmtKg(row.tco2eKg)
        ) : (
          <span style={{ color: "var(--fg-faint)" }}>—</span>
        )}
      </div>

      {/* Confidence cell — "?" chip while gap, mini ConfidenceBar otherwise */}
      <div role="cell" style={{ display: "flex", alignItems: "center", gap: 8, position: "relative", justifyContent: "flex-start" }}>
        {fillRow ? (
          <ConfidenceFill target={fillRow.confidence} progress={fillProgress} />
        ) : showAsGap ? (
          <UnknownChip />
        ) : row.confidence !== null ? (
          <div style={{ width: 80 }}>
            <MiniConfidenceBar value={row.confidence} />
          </div>
        ) : (
          <span style={{ color: "var(--fg-faint)" }}>—</span>
        )}

        {/* Right-edge AlertCircle — pulses while still a gap */}
        {isGap && !visiblyFilled && (
          <AlertCircle
            size={14}
            color="var(--status-warning)"
            strokeWidth={2}
            style={{
              marginLeft: "auto",
              opacity: fillRow ? Math.max(0, 1 - fillProgress / 0.3) : 1,
              animation: fillRow
                ? "ca-launch-alert-pulse 600ms ease-in-out 2"
                : "ca-launch-alert-pulse 1.6s ease-in-out infinite",
              transition: "opacity 200ms ease-out",
            }}
          />
        )}
      </div>

      <style jsx>{`
        @keyframes ca-launch-alert-pulse {
          0%, 100% {
            opacity: 1;
            transform: scale(1);
          }
          50% {
            opacity: 0.5;
            transform: scale(1.18);
          }
        }
      `}</style>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Sub-cells
// ─────────────────────────────────────────────────────────────────────────────

/** "?" chip with amber border + 12% alpha background. */
function UnknownChip() {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        minWidth: 22,
        height: 22,
        padding: "0 8px",
        borderRadius: 9999,
        background: "rgba(247,185,85,0.12)",
        border: "1px solid var(--status-warning)",
        color: "var(--status-warning)",
        fontSize: 12,
        fontWeight: 500,
        fontFamily: "var(--font-source-code-pro), ui-monospace, monospace",
      }}
    >
      ?
    </span>
  );
}

/** Mini ConfidenceBar — same colour rules as the full one but compact (no labels). */
function MiniConfidenceBar({ value, animate }: { value: number; animate?: boolean }) {
  const pct = Math.max(0, Math.min(100, Math.round(value * 100)));
  const tone =
    value >= 0.85
      ? "var(--confidence-high)"
      : value >= 0.6
        ? "var(--confidence-medium)"
        : "var(--confidence-low)";
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6, width: "100%" }}>
      <div
        role="progressbar"
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
        style={{
          height: 6,
          flex: 1,
          background: "var(--bg-inset)",
          borderRadius: 9999,
          overflow: "hidden",
        }}
      >
        <div
          style={{
            width: `${pct}%`,
            height: "100%",
            background: tone,
            transition: animate ? "width 500ms ease-out" : undefined,
          }}
        />
      </div>
      <span
        style={{
          color: "var(--fg-secondary)",
          fontSize: 11,
          fontVariantNumeric: "tabular-nums",
          fontWeight: 500,
          minWidth: 30,
          textAlign: "right",
        }}
      >
        {pct}%
      </span>
    </div>
  );
}

/** Sub-category typewriter — phase 0.30→0.70 of fillProgress, 18ms/char. */
function SubCategoryFill({ text, progress }: { text: string; progress: number }) {
  if (progress < 0.3) {
    return <span style={{ color: "var(--fg-faint)" }}>—</span>;
  }
  const local = Math.min(1, (progress - 0.3) / 0.4); // 0.30→0.70
  const charCount = Math.round(text.length * local);
  const visible = text.slice(0, charCount);
  return (
    <span style={{ color: "var(--fg-primary)" }}>
      {visible}
      {charCount < text.length && (
        <span
          aria-hidden="true"
          style={{
            display: "inline-block",
            width: 1,
            height: "1em",
            background: "var(--brand-green)",
            marginLeft: 1,
            verticalAlign: "text-bottom",
            animation: "ca-launch-caret 700ms steps(2) infinite",
          }}
        />
      )}
      <style jsx>{`
        @keyframes ca-launch-caret {
          50% {
            opacity: 0;
          }
        }
      `}</style>
    </span>
  );
}

/** CO₂e count-up — phase 0.70→1.00 of fillProgress. */
function Co2eFill({ target, progress }: { target: number; progress: number }) {
  if (progress < 0.7) {
    return <span style={{ color: "var(--fg-faint)" }}>—</span>;
  }
  const local = Math.min(1, (progress - 0.7) / 0.3);
  const eased = easeSwift(local);
  const value = target * eased;
  return <span style={{ color: "var(--fg-primary)" }}>{fmtKg(value)}</span>;
}

/** Confidence cell during fill — chip until 0.7, then ConfidenceBar fills. */
function ConfidenceFill({ target, progress }: { target: number; progress: number }) {
  if (progress < 0.3) return <UnknownChip />;
  if (progress < 0.7) {
    return (
      <span
        style={{
          opacity: 1 - (progress - 0.3) / 0.4,
          transition: "opacity 100ms linear",
        }}
      >
        <UnknownChip />
      </span>
    );
  }
  const local = Math.min(1, (progress - 0.7) / 0.3);
  const eased = easeSwift(local);
  return (
    <div style={{ width: 80 }}>
      <MiniConfidenceBar value={target * eased} />
    </div>
  );
}
