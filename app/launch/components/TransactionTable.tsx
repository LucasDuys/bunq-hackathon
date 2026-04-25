"use client";

/**
 * TransactionTable — spreadsheet-style transaction grid with four modes:
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
 *  4. SCAN (S2): when `scanProgress` is set (0..1) the rows reveal progressively
 *     as if the agent is reading them top-to-bottom. The active row gets a
 *     brand-green left edge + faint tint and lingers for ~one row-step before
 *     the scan moves on. Pending rows render as low-opacity skeletons; done rows
 *     render full content. Each row, on the frame the scan crosses it, runs a
 *     250ms staggered fade across its cells (date → confidence). Gap rows stay
 *     un-classified after the scan passes — the amber `?` chip keeps pulsing.
 *
 * Modes are mutually exclusive in practice. SCAN is gated to fire only when
 * neither fillRow nor clusterByCategory is active.
 *
 * No external animation libs — pure React state + CSS transforms + minimal RAF
 * for the count-up. Honours `prefers-reduced-motion`.
 */

import { useMemo } from "react";
import { AlertCircle } from "lucide-react";
import type { TransactionRow } from "../types";
import { fmtEur, fmtKg, displayConfidence } from "@/lib/utils";

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
  /**
   * S02 scan-in: 0..1 progress of the row-by-row reveal. When set (and no
   * other mode is active), rows render as pending / active / done depending
   * on which side of the scan they sit. Ignored if `fillRow` or
   * `clusterByCategory` is active.
   */
  scanProgress?: number;
  /** Scroll viewport offset (pixels). */
  scrollY?: number;
};

export function TransactionTable({
  transactions,
  fillRow,
  fillProgress = 0,
  clusterByCategory = false,
  clusterProgress = 0,
  scanProgress,
  scrollY = 0,
}: TransactionTableProps) {
  // Scan mode is mutually exclusive with fill / cluster.
  const scanActive =
    scanProgress !== undefined && !fillRow && !clusterByCategory;
  // Floating index: e.g. 6.4 means row 6 is "active" and row 7 is "pending".
  // We extend the range slightly past N so the final row gets a full active beat.
  const scanFloatIdx = scanActive
    ? Math.max(0, Math.min(transactions.length, (scanProgress ?? 0) * transactions.length))
    : -1;
  const scanActiveIdx = scanActive ? Math.floor(scanFloatIdx) : -1;
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

            // Scan-mode per-row state.
            // pending: row > activeIdx (skeleton, very low opacity)
            // active : row === activeIdx (brand-green band, faint tint)
            // done   : row < activeIdx (full content, no special tint)
            // For cell-stagger reveal, capture how long the active row has been
            // sitting on this position (0..1 within its slot).
            let scanState: "pending" | "active" | "done" | "off" = "off";
            let cellRevealProgress = 1;
            if (scanActive) {
              if (originalIdx > scanActiveIdx) scanState = "pending";
              else if (originalIdx < scanActiveIdx) scanState = "done";
              else {
                scanState = "active";
                // Local 0..1 within this row's slot; cell stagger uses this.
                cellRevealProgress = Math.max(
                  0,
                  Math.min(1, scanFloatIdx - scanActiveIdx)
                );
              }
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
                scanState={scanState}
                cellRevealProgress={cellRevealProgress}
              />
            );
          })}
        </div>
      </div>

      {/* Skeleton shimmer for scan-pending rows. Subtle, pauses under reduced motion. */}
      <style jsx global>{`
        @keyframes ca-launch-skel-shimmer {
          0% {
            background-position: 200% 0;
          }
          100% {
            background-position: -200% 0;
          }
        }
        @media (prefers-reduced-motion: reduce) {
          .ca-launch-row,
          .ca-launch-row * {
            animation: none !important;
            transition: none !important;
          }
        }
      `}</style>
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
  /** S02 scan-in mode. "off" means no scan is active. */
  scanState?: "pending" | "active" | "done" | "off";
  /** 0..1 progress of the active row's cell-stagger reveal. */
  cellRevealProgress?: number;
};

function Row({
  row,
  flipY,
  clusterProgress,
  clusterByCategory,
  isGroupStart,
  fillRow,
  fillProgress,
  scanState = "off",
  cellRevealProgress = 1,
}: RowProps) {
  const isGap = !!row.isGap;
  // While fillProgress crosses 1.0 the row is no longer treated as a gap.
  const visiblyFilled = fillRow && fillProgress >= 1;
  const showAsGap = isGap && !visiblyFilled;

  // Scan-mode shorthands.
  const isScanPending = scanState === "pending";
  const isScanActive = scanState === "active";
  // Hide gap markers (amber tint, "?" chip, AlertCircle) until the scan has
  // reached this row. After it has, gap rows look the same as in static mode.
  const scanSuppressGap = isScanPending;
  // For pending rows, classified cells render as "—" / faint skeleton.
  const scanHideClassified = isScanPending;

  // Amber tint eases out toward the end of the fill animation.
  // In scan mode, the amber tint only appears once the scan has crossed.
  const amberAlpha = (() => {
    if (!isGap) return 0;
    if (scanSuppressGap) return 0;
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

  // Per-cell stagger reveal during active scan. Cell idx 0..6, ~30ms apart
  // over a ~250ms reveal. cellRevealProgress is 0..1 inside the active slot.
  // Each cell's reveal target = clamp01((reveal * 7 - cellIdx) / 1).
  const scanCellOpacity = (cellIdx: number): number => {
    if (!isScanActive) return 1;
    // Total cells animate in over the first ~70% of the slot.
    const t = Math.max(0, Math.min(1, cellRevealProgress / 0.7));
    const local = t * 7 - cellIdx;
    return Math.max(0, Math.min(1, local));
  };

  // Whole-row opacity:
  //   pending: 0.18 (skeleton)
  //   active : 1 (cells stagger inside)
  //   done   : 1
  //   off    : 1
  const rowOpacity = isScanPending ? 0.18 : 1;

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
        background: isScanActive
          ? "rgba(62,207,142,0.06)"
          : amberAlpha > 0
            ? `rgba(247,185,85,${amberAlpha})`
            : "transparent",
        transform: `translateY(${flipY}px)`,
        transition: "background 320ms ease-out, opacity 200ms ease-out",
        willChange: flipY !== 0 ? "transform" : undefined,
        position: "relative",
        opacity: rowOpacity,
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

      {/* Scan-mode active-row left edge (brand green) */}
      {isScanActive && (
        <span
          aria-hidden="true"
          style={{
            position: "absolute",
            left: 0,
            top: 0,
            bottom: 0,
            width: 2,
            background: "var(--brand-green)",
            opacity: 1,
          }}
        />
      )}

      <div
        role="cell"
        style={{
          color: "var(--fg-muted)",
          fontSize: 12,
          fontFamily: "var(--font-source-code-pro), ui-monospace, monospace",
          opacity: scanCellOpacity(0),
          transition: "opacity 150ms ease-out",
        }}
      >
        {row.date}
      </div>

      <div
        role="cell"
        style={{
          color: "var(--fg-primary)",
          fontSize: 13,
          opacity: scanCellOpacity(1),
          transition: "opacity 150ms ease-out",
        }}
      >
        {row.merchant}
      </div>

      <div
        role="cell"
        style={{
          color: "var(--fg-primary)",
          fontSize: 13,
          textAlign: "right",
          fontVariantNumeric: "tabular-nums",
          opacity: scanCellOpacity(2),
          transition: "opacity 150ms ease-out",
        }}
      >
        {fmtEur(row.amountEur, 2)}
      </div>

      <div
        role="cell"
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          opacity: scanCellOpacity(3),
          transition: "opacity 150ms ease-out",
        }}
      >
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

      {/* Sub-category — animated typewriter when filling, skeleton when scan-pending */}
      <div
        role="cell"
        style={{
          color: showAsGap ? "var(--fg-faint)" : "var(--fg-primary)",
          fontSize: 13,
          opacity: scanCellOpacity(4),
          transition: "opacity 150ms ease-out",
        }}
      >
        {scanHideClassified ? (
          <SkeletonStripe width={120} />
        ) : fillRow ? (
          <SubCategoryFill text={fillRow.subCategory} progress={fillProgress} />
        ) : showAsGap ? (
          <span style={{ color: "var(--fg-faint)" }}>—</span>
        ) : (
          row.subCategory ?? <span style={{ color: "var(--fg-faint)" }}>—</span>
        )}
      </div>

      {/* CO₂e — animated count-up when filling, skeleton when scan-pending */}
      <div
        role="cell"
        style={{
          color: showAsGap ? "var(--fg-faint)" : "var(--fg-primary)",
          fontSize: 13,
          textAlign: "right",
          fontVariantNumeric: "tabular-nums",
          opacity: scanCellOpacity(5),
          transition: "opacity 150ms ease-out",
        }}
      >
        {scanHideClassified ? (
          <SkeletonStripe width={56} align="right" />
        ) : fillRow ? (
          <Co2eFill target={fillRow.tco2eKg} progress={fillProgress} />
        ) : row.tco2eKg !== null ? (
          fmtKg(row.tco2eKg)
        ) : (
          <span style={{ color: "var(--fg-faint)" }}>—</span>
        )}
      </div>

      {/* Confidence cell — "?" chip while gap, mini ConfidenceBar otherwise */}
      <div
        role="cell"
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          position: "relative",
          justifyContent: "flex-start",
          opacity: scanCellOpacity(6),
          transition: "opacity 150ms ease-out",
        }}
      >
        {scanHideClassified ? (
          <SkeletonStripe width={80} />
        ) : fillRow ? (
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

        {/* Right-edge AlertCircle — pulses while still a gap, suppressed pre-scan */}
        {isGap && !visiblyFilled && !scanSuppressGap && (
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
// Skeleton stripe — used for scan-pending classified cells.
// Very subtle; pauses under prefers-reduced-motion via CSS media query.
// ─────────────────────────────────────────────────────────────────────────────

function SkeletonStripe({
  width,
  align = "left",
}: {
  width: number;
  align?: "left" | "right";
}) {
  return (
    <span
      aria-hidden="true"
      style={{
        display: "inline-block",
        width,
        height: 6,
        borderRadius: 9999,
        background:
          "linear-gradient(90deg, rgba(255,255,255,0.04) 0%, rgba(255,255,255,0.10) 50%, rgba(255,255,255,0.04) 100%)",
        backgroundSize: "200% 100%",
        animation: "ca-launch-skel-shimmer 1500ms linear infinite",
        verticalAlign: "middle",
        marginLeft: align === "right" ? "auto" : 0,
      }}
    />
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
  const calibrated = displayConfidence(value);
  const pct = Math.max(0, Math.min(100, Math.round(calibrated * 100)));
  const tone =
    calibrated >= 0.85
      ? "var(--confidence-high)"
      : calibrated >= 0.6
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
