"use client";

/**
 * AlternativesMatrix — quadrant scatter chart for S13.
 *
 * 720 × 720 dark canvas. Origin at center. Negative cost = saving (left),
 * negative CO₂e = reduction (down). Four tinted quadrants:
 *   bottom-left  win-win               (brand-green)
 *   top-left     pay-to-decarbonize    (status-warning)
 *   bottom-right status-quo trap       (status-info)
 *   top-right    avoid                 (status-danger)
 *
 * Points reveal staggered (100ms each) with a bounce-overshoot scale
 * (0 → 1.15 → 1.0 over 500ms via cubic-bezier). When `zoomToWinWin` flips on,
 * the entire chart eases into a 80%-frame zoom on the bottom-left quadrant
 * (~0.8s, swift-out cubic-bezier).
 */

import { useMemo } from "react";
import type { MatrixPoint, Quadrant } from "../types";

export type AlternativesMatrixProps = {
  points: MatrixPoint[];
  /** 0..1 progress controlling stagger of point reveal + zoom-in. */
  progress: number;
  /** When true, zoom into the win-win quadrant for the camera close-up. */
  zoomToWinWin?: boolean;
};

const SIZE = 720;
const PAD = 56; // axis padding so labels don't clip
const PLOT = SIZE - PAD * 2;
const HALF = PLOT / 2;
// Domain in real units (€ on x, kgCO₂e on y).
const X_DOMAIN = 12000; // ±12k €
const Y_DOMAIN = 100; // ±100 kgCO₂e

// Colour-per-quadrant
const QUADRANT_COLOR: Record<Quadrant, string> = {
  win_win: "var(--brand-green)",
  pay_to_decarbonize: "var(--status-warning)",
  status_quo_trap: "var(--status-info)",
  avoid: "var(--status-danger)",
};

const QUADRANT_LABEL: Record<Quadrant, string> = {
  win_win: "Win-win",
  pay_to_decarbonize: "Pay to decarbonize",
  status_quo_trap: "Status-quo trap",
  avoid: "Avoid",
};

const STAGGER_MS = 100;
const REVEAL_DURATION_MS = 500;

export function AlternativesMatrix({
  points,
  progress,
  zoomToWinWin = false,
}: AlternativesMatrixProps) {
  const cx = SIZE / 2;
  const cy = SIZE / 2;

  // Convert real-unit deltas to pixel positions inside the plot area.
  const toPx = (p: MatrixPoint) => {
    const x = cx + (p.costDeltaEur / X_DOMAIN) * HALF;
    // Y inverts (higher CO2e = up in real life but DOWN visually means "less
    // CO2"). Spec says: negative co2e = reduction = bottom. So y grows downward
    // for positive co2e, meaning we flip sign.
    const y = cy - (p.co2eDelta / Y_DOMAIN) * HALF;
    return { x, y };
  };

  // ── Per-point reveal progress ──
  // Each point unlocks at start = i * STAGGER, completes after REVEAL_DURATION.
  // We treat the "scene local clock" as derived from `progress` * total reveal
  // window so the caller can sweep it via a single 0..1 value.
  const total = points.length * STAGGER_MS + REVEAL_DURATION_MS;
  const localMs = progress * total;
  const pointProgress = useMemo(
    () =>
      points.map((_, i) => {
        const start = i * STAGGER_MS;
        const local = (localMs - start) / REVEAL_DURATION_MS;
        return Math.max(0, Math.min(1, local));
      }),
    [points, localMs]
  );

  // ── Win-win quadrant zoom ──
  // Bottom-left quadrant centre = (cx - HALF/2, cy + HALF/2). The chart wrapper
  // scales around `center center`; after a `scale(s)` around the frame centre,
  // a point P maps to (cx + (P.x - cx)*s, cy + (P.y - cy)*s). Adding a
  // translate(tx, ty) lets us pull the win-win centre back to (cx, cy):
  //   tx =  (HALF/2) * s    (compensate the leftward shift)
  //   ty = -(HALF/2) * s    (compensate the downward shift)
  // 1.6× makes the quadrant fill ~80% of the frame.
  const zoomScale = 1.6;
  const zoomTx = zoomToWinWin ? (HALF / 2) * zoomScale : 0;
  const zoomTy = zoomToWinWin ? -(HALF / 2) * zoomScale : 0;
  const zoomTransform = zoomToWinWin
    ? `translate(${zoomTx}px, ${zoomTy}px) scale(${zoomScale})`
    : `translate(0px, 0px) scale(1)`;

  return (
    <div
      style={{
        position: "relative",
        width: SIZE,
        height: SIZE,
        background: "#171717",
        overflow: "hidden",
      }}
      role="img"
      aria-label="Cost vs CO₂e alternatives matrix"
    >
      <div
        style={{
          width: SIZE,
          height: SIZE,
          transform: zoomTransform,
          transformOrigin: "center center",
          transition: "transform 800ms cubic-bezier(0.32, 0.72, 0, 1)",
          willChange: "transform",
        }}
      >
        <svg
          width={SIZE}
          height={SIZE}
          viewBox={`0 0 ${SIZE} ${SIZE}`}
          style={{ display: "block" }}
        >
          {/* ── Quadrant background tints ── */}
          {/* Bottom-left = win-win */}
          <rect
            x={PAD}
            y={cy}
            width={HALF}
            height={HALF}
            fill="var(--brand-green)"
            fillOpacity={0.06}
          />
          {/* Top-left = pay-to-decarbonize */}
          <rect
            x={PAD}
            y={PAD}
            width={HALF}
            height={HALF}
            fill="var(--status-warning)"
            fillOpacity={0.06}
          />
          {/* Bottom-right = status-quo trap */}
          <rect
            x={cx}
            y={cy}
            width={HALF}
            height={HALF}
            fill="var(--status-info)"
            fillOpacity={0.06}
          />
          {/* Top-right = avoid */}
          <rect
            x={cx}
            y={PAD}
            width={HALF}
            height={HALF}
            fill="var(--status-danger)"
            fillOpacity={0.06}
          />

          {/* ── Tick marks every €5k and 25 kgCO₂e ── */}
          {tickMarks(cx, cy)}

          {/* ── Axes ── */}
          {/* Vertical axis (X = 0) */}
          <line
            x1={cx}
            y1={PAD}
            x2={cx}
            y2={SIZE - PAD}
            stroke="var(--border-strong)"
            strokeWidth={1}
          />
          {/* Horizontal axis (Y = 0) */}
          <line
            x1={PAD}
            y1={cy}
            x2={SIZE - PAD}
            y2={cy}
            stroke="var(--border-strong)"
            strokeWidth={1}
          />

          {/* ── Axis labels (€ X axis, CO₂e Y axis) ── */}
          {axisLabels(cx, cy)}

          {/* ── Points ── */}
          {points.map((p, i) => {
            const { x, y } = toPx(p);
            const t = pointProgress[i] ?? 0;
            // Bounce overshoot: 0 → 1.15 (at t=0.7) → 1.0 (at t=1)
            const scale = bounceScale(t);
            const opacity = Math.min(1, t * 2);
            const color = QUADRANT_COLOR[p.quadrant];
            return (
              <g key={p.id} style={{ pointerEvents: "none" }}>
                <circle
                  cx={x}
                  cy={y}
                  r={7}
                  fill={color}
                  stroke="#fafafa"
                  strokeWidth={1}
                  opacity={opacity}
                  style={{
                    transformBox: "fill-box",
                    transformOrigin: "center",
                    transform: `scale(${scale})`,
                    transition: "opacity 200ms linear",
                  }}
                />
              </g>
            );
          })}
        </svg>

        {/* ── Quadrant corner labels — overlay (HTML for crisp text) ── */}
        <QuadrantLabel
          quadrant="pay_to_decarbonize"
          style={{ top: PAD + 8, left: PAD + 12 }}
        />
        <QuadrantLabel
          quadrant="avoid"
          style={{ top: PAD + 8, right: PAD + 12, textAlign: "right" }}
        />
        <QuadrantLabel
          quadrant="win_win"
          emphasised={zoomToWinWin}
          style={{ bottom: PAD + 8, left: PAD + 12 }}
        />
        <QuadrantLabel
          quadrant="status_quo_trap"
          style={{ bottom: PAD + 8, right: PAD + 12, textAlign: "right" }}
        />

        {/* ── Per-point text labels (Baseline → Alternative) ── */}
        {points.map((p, i) => {
          const { x, y } = toPx(p);
          const t = pointProgress[i] ?? 0;
          const opacity = Math.max(0, t * 2 - 1); // appears in second half of stagger
          const isWinWin = p.quadrant === "win_win";
          const emphasised = zoomToWinWin && isWinWin;
          return (
            <div
              key={p.id}
              style={{
                position: "absolute",
                left: x,
                top: y + 14,
                transform: "translateX(-50%)",
                opacity: emphasised ? 1 : opacity * 0.75,
                color: "var(--fg-secondary)",
                fontSize: emphasised ? 13 : 11,
                fontWeight: emphasised ? 500 : 400,
                fontFamily: "var(--font-inter), system-ui, sans-serif",
                whiteSpace: "nowrap",
                pointerEvents: "none",
                transition: "opacity 200ms linear, font-size 400ms ease-out, font-weight 400ms ease-out",
                textShadow: "0 1px 2px rgba(0,0,0,0.7)",
              }}
            >
              {p.baseline} → {p.alternative}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function bounceScale(t: number): number {
  if (t <= 0) return 0;
  if (t >= 1) return 1;
  // 0 → 1.15 over 0..0.7, 1.15 → 1.0 over 0.7..1
  if (t <= 0.7) {
    const local = t / 0.7;
    return 1.15 * easeOutCubic(local);
  }
  const local = (t - 0.7) / 0.3;
  return 1.15 - 0.15 * easeOutCubic(local);
}

function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}

function tickMarks(cx: number, cy: number) {
  // X ticks every €5k → 12k domain → ticks at -10k, -5k, 5k, 10k.
  const xTicks = [-10000, -5000, 5000, 10000];
  // Y ticks every 25 kg → 100 domain → ticks at -75, -50, -25, 25, 50, 75.
  const yTicks = [-75, -50, -25, 25, 50, 75];

  return (
    <>
      {xTicks.map((v) => {
        const px = cx + (v / X_DOMAIN) * HALF;
        return (
          <line
            key={`xt-${v}`}
            x1={px}
            y1={cy - 4}
            x2={px}
            y2={cy + 4}
            stroke="var(--border-strong)"
            strokeWidth={1}
          />
        );
      })}
      {yTicks.map((v) => {
        const py = cy - (v / Y_DOMAIN) * HALF;
        return (
          <line
            key={`yt-${v}`}
            x1={cx - 4}
            y1={py}
            x2={cx + 4}
            y2={py}
            stroke="var(--border-strong)"
            strokeWidth={1}
          />
        );
      })}
    </>
  );
}

function axisLabels(cx: number, cy: number) {
  const xTicks = [
    { v: -10000, label: "-€10k" },
    { v: -5000, label: "-€5k" },
    { v: 5000, label: "+€5k" },
    { v: 10000, label: "+€10k" },
  ];
  const yTicks = [
    { v: -75, label: "-75" },
    { v: -50, label: "-50" },
    { v: -25, label: "-25" },
    { v: 25, label: "+25" },
    { v: 50, label: "+50" },
    { v: 75, label: "+75" },
  ];
  return (
    <>
      {xTicks.map(({ v, label }) => {
        const px = cx + (v / X_DOMAIN) * HALF;
        return (
          <text
            key={`xl-${v}`}
            x={px}
            y={cy + 18}
            fill="var(--fg-muted)"
            fontSize={11}
            textAnchor="middle"
            fontFamily="var(--font-source-code-pro), ui-monospace, monospace"
            style={{ letterSpacing: "1.2px", textTransform: "uppercase" }}
          >
            {label}
          </text>
        );
      })}
      {yTicks.map(({ v, label }) => {
        const py = cy - (v / Y_DOMAIN) * HALF;
        return (
          <text
            key={`yl-${v}`}
            x={cx - 8}
            y={py + 4}
            fill="var(--fg-muted)"
            fontSize={11}
            textAnchor="end"
            fontFamily="var(--font-source-code-pro), ui-monospace, monospace"
            style={{ letterSpacing: "1.2px", textTransform: "uppercase" }}
          >
            {label}
          </text>
        );
      })}
      {/* Axis titles */}
      <text
        x={SIZE - PAD}
        y={cy - 8}
        fill="var(--fg-muted)"
        fontSize={11}
        textAnchor="end"
        fontFamily="var(--font-source-code-pro), ui-monospace, monospace"
        style={{ letterSpacing: "1.2px", textTransform: "uppercase" }}
      >
        Cost Δ €/yr
      </text>
      <text
        x={cx + 8}
        y={PAD - 8}
        fill="var(--fg-muted)"
        fontSize={11}
        textAnchor="start"
        fontFamily="var(--font-source-code-pro), ui-monospace, monospace"
        style={{ letterSpacing: "1.2px", textTransform: "uppercase" }}
      >
        CO₂e Δ kg/yr
      </text>
    </>
  );
}

function QuadrantLabel({
  quadrant,
  style,
  emphasised,
}: {
  quadrant: Quadrant;
  style: React.CSSProperties;
  emphasised?: boolean;
}) {
  return (
    <div
      style={{
        position: "absolute",
        fontFamily: "var(--font-source-code-pro), ui-monospace, monospace",
        fontSize: emphasised ? 13 : 11,
        letterSpacing: "1.2px",
        textTransform: "uppercase",
        color: QUADRANT_COLOR[quadrant],
        fontWeight: emphasised ? 500 : 400,
        transition: "font-size 400ms ease-out, font-weight 400ms ease-out",
        pointerEvents: "none",
        textShadow: "0 1px 2px rgba(0,0,0,0.7)",
        ...style,
      }}
    >
      {QUADRANT_LABEL[quadrant]}
    </div>
  );
}
