"use client";

/**
 * S12B — Savings stack.
 *
 * The "how" behind Carbo's savings claim. Sits between S12 (Carbo finds the
 * swaps that pay you back) and S13 (alternatives matrix). One animated bar
 * fills in two pulses, each pulse ticking up its own percentage — vendor
 * swaps, then NL BV tax shield. The hero counter (top-right) ticks up to
 * 4.13% in lock-step.
 *
 * Numbers come from the live end-to-end run (.forge/reports/e2e-live-...),
 * expressed as PERCENTAGES of annual spend so the pitch generalises across
 * company sizes — a €100k SME and a €100M enterprise read the same number.
 *
 * Dark canvas, no MacWindow chrome. The bar IS the artifact.
 *
 * Reduced-motion: all transitions collapse to opacity-only via the global
 * `prefers-reduced-motion` rule below.
 */

import type { SceneProps } from "../types";
import { CameraScript } from "../components/CameraScript";
import { CountUpNumber } from "../components/CountUpNumber";

// ── Fixture ────────────────────────────────────────────────────────────────
// Live e2e run v5 (2026-04-25): €9,168 net impact across €221,960 spend =
// 4.13%. Split: €7,288 vendor swaps (3.28%) + €1,880 NL BV tax shield (0.85%).
// Carbon credits to cover the remainder cost only €772 = 0.35% of spend.
const PCT_VENDOR = 3.28;
const PCT_TAX = 0.85;
const PCT_TOTAL = PCT_VENDOR + PCT_TAX; // 4.13
const PCT_CREDITS = 0.35;

// Bar segment widths as fraction of the bar's full width (the bar represents
// 100% of recovered spend — Seg1 + Seg2 = 100% of the bar, i.e. 100% of the
// 4.13%). Computed proportionally so the visual ratio matches the data.
const BAR_VENDOR_PCT = (PCT_VENDOR / PCT_TOTAL) * 100; // ≈ 79.4
const BAR_TAX_PCT = (PCT_TAX / PCT_TOTAL) * 100; // ≈ 20.6

// Animation cues (scene-local ms).
const FADE_IN_MS = 320;
const SEG1_AT = 360;
const SEG1_DUR = 720;
const SEG2_AT = 1500;
const SEG2_DUR = 700;
const TOTAL_AT = 2700;
const TOTAL_DUR = 1100;

const clamp01 = (n: number) => Math.max(0, Math.min(1, n));
const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);

function segProgress(elapsedMs: number, at: number, dur: number): number {
  return easeOutCubic(clamp01((elapsedMs - at) / dur));
}

export default function S12B({ elapsedMs, durationMs }: SceneProps) {
  const fadeIn = clamp01(elapsedMs / FADE_IN_MS);
  const seg1 = segProgress(elapsedMs, SEG1_AT, SEG1_DUR);
  const seg2 = segProgress(elapsedMs, SEG2_AT, SEG2_DUR);
  const totalActive = elapsedMs >= TOTAL_AT;

  return (
    <div
      className="ca-s12b"
      style={{
        position: "absolute",
        inset: 0,
        background: "var(--bg-canvas)",
        overflow: "hidden",
      }}
    >
      <CameraScript
        keyframes={[
          { at: 0, scale: 0.97, x: 0, y: 12 },
          { at: 0.35, scale: 1.0, x: 0, y: 0 },
          { at: 1.0, scale: 1.04, x: 0, y: -16 },
        ]}
        elapsedMs={elapsedMs}
        durationMs={durationMs}
      >
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            opacity: fadeIn,
            transition: "opacity 120ms linear",
          }}
        >
          <div
            style={{
              width: "min(1080px, 92vw)",
              display: "flex",
              flexDirection: "column",
              gap: 36,
              fontFamily: "var(--font-inter), system-ui, sans-serif",
              color: "var(--fg-primary)",
            }}
          >
            <HeaderRow totalActive={totalActive} />
            <SavingsBar seg1={seg1} seg2={seg2} />
            <LegendRow seg1={seg1} seg2={seg2} />
            <FooterStats />
          </div>
        </div>
      </CameraScript>

      <style jsx global>{`
        @media (prefers-reduced-motion: reduce) {
          .ca-s12b *,
          .ca-s12b *::before,
          .ca-s12b *::after {
            animation: none !important;
            transition: none !important;
          }
        }
      `}</style>
    </div>
  );
}

// ── Header row — eyebrow + title left, hero percent right ──────────────────
function HeaderRow({ totalActive }: { totalActive: boolean }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "flex-end",
        justifyContent: "space-between",
        gap: 32,
        flexWrap: "wrap",
      }}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <CodeEyebrow>HOW WE TURN SPEND INTO SAVINGS</CodeEyebrow>
        <h2
          style={{
            margin: 0,
            fontSize: "clamp(28px, 3.6vw, 48px)",
            fontWeight: 400,
            lineHeight: 1.05,
            letterSpacing: "-0.02em",
            color: "var(--fg-primary)",
            maxWidth: "20ch",
            textWrap: "balance",
          }}
        >
          Two swaps. 4.13% of your spend, returned.
        </h2>
      </div>

      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "flex-end",
          gap: 6,
          minWidth: 240,
        }}
        aria-live="polite"
      >
        <CodeEyebrow>RECOVERED ANNUALLY</CodeEyebrow>
        <span
          style={{
            fontSize: "clamp(64px, 8vw, 112px)",
            fontWeight: 400,
            lineHeight: 1.0,
            letterSpacing: "-0.025em",
            color: "var(--brand-green)",
            fontVariantNumeric: "tabular-nums",
          }}
        >
          {totalActive ? (
            <CountUpNumber
              value={PCT_TOTAL}
              decimals={2}
              durationMs={TOTAL_DUR}
              suffix="%"
              restartKey="s12b-total"
            />
          ) : (
            "0.00%"
          )}
        </span>
        <span
          style={{
            fontSize: 13,
            color: "var(--fg-muted)",
            fontFamily:
              "var(--font-source-code-pro), ui-monospace, monospace",
            letterSpacing: "1.2px",
            textTransform: "uppercase",
          }}
        >
          of annual spend, every year
        </span>
      </div>
    </div>
  );
}

// ── The savings bar — two segments fill in two pulses ──────────────────────
function SavingsBar({ seg1, seg2 }: { seg1: number; seg2: number }) {
  return (
    <div
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round((seg1 + seg2) * 50)}
      aria-label="Annual recovery stacked from two sources"
      style={{
        position: "relative",
        height: 56,
        width: "100%",
        background: "var(--bg-inset)",
        border: "1px solid var(--border-default)",
        borderRadius: 9999,
        overflow: "hidden",
        display: "flex",
      }}
    >
      <BarSegment widthPct={BAR_VENDOR_PCT * seg1} fill="var(--brand-green)" />
      <BarSegment widthPct={BAR_TAX_PCT * seg2} fill="rgba(62, 207, 142, 0.55)" />
    </div>
  );
}

function BarSegment({ widthPct, fill }: { widthPct: number; fill: string }) {
  return (
    <div
      style={{
        height: "100%",
        width: `${widthPct}%`,
        background: fill,
        transition: "width 120ms linear",
      }}
    />
  );
}

// ── Legend — two cards, each with eyebrow + percent + caption ──────────────
function LegendRow({ seg1, seg2 }: { seg1: number; seg2: number }) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
        gap: 24,
      }}
    >
      <LegendItem
        opacity={seg1}
        eyebrow="01 · CHEAPER VENDORS"
        amount={
          <span style={{ color: "var(--brand-green)" }}>
            {seg1 > 0.02 ? (
              <CountUpNumber
                value={PCT_VENDOR}
                decimals={2}
                durationMs={SEG1_DUR}
                suffix="%"
                restartKey="s12b-v"
              />
            ) : (
              "0.00%"
            )}
            <span style={{ color: "var(--fg-muted)" }}> of spend</span>
          </span>
        }
        caption="Two validated swaps Carbo found in your books — backed by 14 evidence sources."
        swatch="var(--brand-green)"
      />

      <LegendItem
        opacity={seg2}
        eyebrow="02 · TAX SHIELD"
        amount={
          <span style={{ color: "var(--brand-green)" }}>
            {seg2 > 0.02 ? (
              <CountUpNumber
                value={PCT_TAX}
                decimals={2}
                durationMs={SEG2_DUR}
                suffix="%"
                restartKey="s12b-t"
              />
            ) : (
              "0.00%"
            )}
            <span style={{ color: "var(--fg-muted)" }}> of spend</span>
          </span>
        }
        caption="NL BV deductions on the two approved swaps. Pending tax-advisor review."
        swatch="rgba(62, 207, 142, 0.55)"
      />
    </div>
  );
}

function LegendItem({
  opacity,
  eyebrow,
  amount,
  caption,
  swatch,
}: {
  opacity: number;
  eyebrow: string;
  amount: React.ReactNode;
  caption: string;
  swatch: string;
}) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 8,
        opacity: Math.max(0.2, opacity),
        transform: `translateY(${(1 - opacity) * 8}px)`,
        transition: "opacity 220ms ease-out, transform 220ms ease-out",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span
          aria-hidden="true"
          style={{
            display: "inline-block",
            width: 14,
            height: 14,
            borderRadius: 3,
            background: swatch,
          }}
        />
        <CodeEyebrow>{eyebrow}</CodeEyebrow>
      </div>
      <div
        style={{
          fontSize: 26,
          fontWeight: 400,
          lineHeight: 1.1,
          letterSpacing: "-0.01em",
          fontVariantNumeric: "tabular-nums",
        }}
      >
        {amount}
      </div>
      <p
        style={{
          margin: 0,
          fontSize: 13,
          lineHeight: 1.55,
          color: "var(--fg-secondary)",
          maxWidth: "38ch",
        }}
      >
        {caption}
      </p>
    </div>
  );
}

// ── Footer — credits-cost note + evidence/mock stats ───────────────────────
function FooterStats() {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 24,
        flexWrap: "wrap",
        paddingTop: 20,
        borderTop: "1px solid var(--border-faint)",
      }}
    >
      <span
        style={{
          fontSize: 13,
          color: "var(--fg-secondary)",
          fontVariantNumeric: "tabular-nums",
        }}
      >
        Only{" "}
        <span style={{ color: "var(--fg-primary)" }}>
          {PCT_CREDITS.toFixed(2)}% of spend
        </span>{" "}
        on EU credits to cover what the swaps don&apos;t.
      </span>
      <span
        style={{
          fontFamily: "var(--font-source-code-pro), ui-monospace, monospace",
          fontSize: 11,
          letterSpacing: "1.2px",
          textTransform: "uppercase",
          color: "var(--fg-muted)",
          fontVariantNumeric: "tabular-nums",
        }}
      >
        14 evidence sources · 0/7 mock · live sonnet 4.6
      </span>
    </div>
  );
}

// ── Local code-eyebrow primitive — Source Code Pro 12px upper 1.2px ────────
function CodeEyebrow({ children }: { children: React.ReactNode }) {
  return (
    <span
      style={{
        fontFamily: "var(--font-source-code-pro), ui-monospace, monospace",
        fontSize: 12,
        letterSpacing: "1.2px",
        textTransform: "uppercase",
        color: "var(--fg-muted)",
      }}
    >
      {children}
    </span>
  );
}
