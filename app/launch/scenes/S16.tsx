"use client";

/**
 * S16 — Final lockup, dark-canvas finale.
 *
 * Replaces the old white "Carbo / Built on bunq" wordmark with a Carbo-native
 * dark closer that matches the product UI: brand-green leaf, stagger-revealed
 * wordmark, tagline, headline stat (1.87% net annual impact, ± confidence),
 * signature line, drifting leaf particles, and a quiet radial pulse so the
 * frame doesn't go static. Every number ships with confidence.
 *
 * Choreography (driven by `progress` 0..1, scene = 7000ms):
 *   0.00–0.10  Dark layer wipes over the white shell (radial reveal).
 *   0.06–0.20  Hero wordmark scales in, characters stagger.
 *   0.12–0.24  Inline leaf glyph strokes + fills.
 *   0.20–0.34  Green divider draws left → right.
 *   0.30–0.42  Tagline types in.
 *   0.42–0.65  Stat lifts in, percentage counts up to 1.87%, confidence bar fills.
 *   0.65–0.80  Signature line + meta reveal.
 *   0.80–1.00  Soft radial pulse + drifting leaves continue, frame settles.
 */

import type { SceneProps } from "../types";
import { useMemo } from "react";

const HEADLINE = "Carbo.";
const TAGLINE = "The carbon book that wrote itself.";
// Numbers from the real live e2e run (2026-04-25):
// €9,168 net impact / €221,960 analysed spend = 4.13% recovered.
// 81.58 tCO₂e baseline · 14 evidence sources.
const STAT_LABEL = "Net annual impact";
const STAT_VALUE_PCT = 4.13;
const STAT_CONFIDENCE = 0.90;
const STAT_SUFFIX = "of analysed annual spend, recovered";
const SIGNATURE = "Built on bunq";
const SIGNATURE_META = "Live · April 2026";

const HEADLINE_START = 0.06;
const HEADLINE_END = 0.20;
const LEAF_DRAW_START = 0.12;
const LEAF_DRAW_END = 0.24;
const DIVIDER_START = 0.20;
const DIVIDER_END = 0.34;
const TAGLINE_START = 0.30;
const TAGLINE_END = 0.42;
const STAT_START = 0.42;
const STAT_END = 0.65;
const SIGNATURE_START = 0.65;
const SIGNATURE_END = 0.80;

export default function S16({ progress }: SceneProps) {
  const headlineP = phase(progress, HEADLINE_START, HEADLINE_END);
  const leafP = phase(progress, LEAF_DRAW_START, LEAF_DRAW_END);
  const dividerP = phase(progress, DIVIDER_START, DIVIDER_END);
  const taglineP = phase(progress, TAGLINE_START, TAGLINE_END);
  const statP = phase(progress, STAT_START, STAT_END);
  const signatureP = phase(progress, SIGNATURE_START, SIGNATURE_END);

  const statEased = easeOutCubic(statP);
  const statValue = STAT_VALUE_PCT * statEased;
  const confidencePct = Math.round(STAT_CONFIDENCE * statEased * 100);

  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        background: "#ffffff",
        overflow: "hidden",
      }}
    >
      {/* Subtle radial brand-green tint — soft warmth on the white shell. */}
      <div
        aria-hidden="true"
        style={{
          position: "absolute",
          inset: 0,
          background:
            "radial-gradient(ellipse 60% 50% at 50% 55%, rgba(62,207,142,0.07) 0%, rgba(62,207,142,0.03) 35%, transparent 70%)",
          pointerEvents: "none",
        }}
      />

      {/* Drifting leaf particles — ambient, behind the lockup. */}
      <ParticleField progress={progress} opacity={1} />

      {/* Soft pulse during the settle phase (after 0.80). */}
      <SettlePulse progress={progress} />

      {/* Lockup column. */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 0,
            maxWidth: "min(960px, 88vw)",
            padding: "0 24px",
          }}
        >
          {/* Wordmark row: leaf + "Carbo." */}
          <div
            style={{
              display: "flex",
              alignItems: "baseline",
              gap: "clamp(12px, 1.4vw, 22px)",
              opacity: easeOutCubic(headlineP),
              transform: `translateY(${(1 - easeOutCubic(headlineP)) * 14}px) scale(${0.96 + easeOutCubic(headlineP) * 0.04})`,
              transformOrigin: "center bottom",
            }}
          >
            <InlineLeaf progress={leafP} />
            <h1
              style={{
                fontFamily: "var(--font-inter), system-ui, sans-serif",
                fontSize: "clamp(72px, 11vw, 144px)",
                fontWeight: 400,
                lineHeight: 1.0,
                letterSpacing: "-0.035em",
                color: "#0a0a0a",
                margin: 0,
                fontVariantNumeric: "tabular-nums",
                textWrap: "balance",
              }}
            >
              <StaggerText text={HEADLINE} progress={headlineP} />
            </h1>
          </div>

          {/* Brand-green divider — draws left→right. */}
          <div
            style={{
              width: "clamp(160px, 22vw, 280px)",
              height: 1,
              background: "var(--brand-green, #3ecf8e)",
              transformOrigin: "left center",
              transform: `scaleX(${easeOutCubic(dividerP)})`,
              marginTop: "clamp(18px, 2.4vh, 28px)",
              opacity: 0.85,
            }}
          />

          {/* Tagline. */}
          <p
            style={{
              fontFamily: "var(--font-inter), system-ui, sans-serif",
              fontSize: "clamp(16px, 1.6vw, 22px)",
              fontWeight: 400,
              lineHeight: 1.4,
              letterSpacing: "-0.005em",
              color: "#4d4d4d",
              margin: 0,
              marginTop: "clamp(20px, 2.6vh, 32px)",
              textAlign: "center",
              maxWidth: "60ch",
              opacity: easeOutCubic(taglineP),
              transform: `translateY(${(1 - easeOutCubic(taglineP)) * 10}px)`,
              textWrap: "pretty",
            }}
          >
            {TAGLINE}
          </p>

          {/* Headline stat card. */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 10,
              marginTop: "clamp(36px, 5vh, 56px)",
              padding: "clamp(20px, 2.6vh, 28px) clamp(28px, 3vw, 44px)",
              border: "1px solid #ececec",
              borderRadius: 16,
              background: "rgba(255,255,255,0.7)",
              backdropFilter: "blur(6px)",
              WebkitBackdropFilter: "blur(6px)",
              opacity: easeOutCubic(statP),
              transform: `translateY(${(1 - easeOutCubic(statP)) * 18}px) scale(${0.97 + easeOutCubic(statP) * 0.03})`,
              minWidth: "min(420px, 80vw)",
            }}
          >
            {/* Source Code Pro KPI label */}
            <span
              style={{
                fontFamily: "var(--font-source-code-pro), ui-monospace, monospace",
                fontSize: 12,
                letterSpacing: "1.2px",
                textTransform: "uppercase",
                color: "#6e6e6e",
              }}
            >
              {STAT_LABEL}
            </span>

            {/* Big number, brand green */}
            <div
              style={{
                fontFamily: "var(--font-inter), system-ui, sans-serif",
                fontSize: "clamp(56px, 7vw, 88px)",
                fontWeight: 400,
                lineHeight: 1.0,
                letterSpacing: "-0.025em",
                color: "var(--brand-green, #3ecf8e)",
                fontVariantNumeric: "tabular-nums",
                display: "inline-flex",
                alignItems: "baseline",
                gap: 2,
              }}
            >
              <span>{statValue.toFixed(2)}</span>
              <span style={{ fontSize: "0.5em", letterSpacing: "-0.01em" }}>%</span>
            </div>

            <span
              style={{
                fontFamily: "var(--font-inter), system-ui, sans-serif",
                fontSize: 14,
                color: "#4d4d4d",
                lineHeight: 1.3,
                textAlign: "center",
              }}
            >
              {STAT_SUFFIX}
            </span>

            {/* Confidence pair — DESIGN.md non-negotiable. */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                marginTop: 6,
                width: "100%",
                maxWidth: 280,
              }}
              role="progressbar"
              aria-label="Confidence in net impact projection"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={confidencePct}
            >
              <span
                style={{
                  fontFamily: "var(--font-source-code-pro), ui-monospace, monospace",
                  fontSize: 10,
                  letterSpacing: "1.2px",
                  textTransform: "uppercase",
                  color: "#6e6e6e",
                  whiteSpace: "nowrap",
                }}
              >
                Confidence
              </span>
              <div
                style={{
                  flex: 1,
                  height: 4,
                  background: "#ececec",
                  borderRadius: 9999,
                  overflow: "hidden",
                }}
              >
                <div
                  style={{
                    height: "100%",
                    width: `${confidencePct}%`,
                    background: "var(--brand-green, #3ecf8e)",
                    transition: "width 80ms linear",
                  }}
                />
              </div>
              <span
                style={{
                  fontFamily: "var(--font-source-code-pro), ui-monospace, monospace",
                  fontSize: 10,
                  letterSpacing: "1.2px",
                  textTransform: "uppercase",
                  color: "#0a0a0a",
                  fontVariantNumeric: "tabular-nums",
                  minWidth: 28,
                  textAlign: "right",
                }}
              >
                {confidencePct}%
              </span>
            </div>
          </div>

          {/* Signature line. */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 14,
              marginTop: "clamp(28px, 3.6vh, 44px)",
              opacity: easeOutCubic(signatureP),
              transform: `translateY(${(1 - easeOutCubic(signatureP)) * 8}px)`,
            }}
          >
            <SmallLeaf size={14} />
            <span
              style={{
                fontFamily: "var(--font-inter), system-ui, sans-serif",
                fontSize: 14,
                fontWeight: 500,
                color: "#0a0a0a",
                letterSpacing: "-0.005em",
              }}
            >
              {SIGNATURE}
            </span>
            <span
              aria-hidden="true"
              style={{
                width: 1,
                height: 12,
                background: "#d4d4d4",
              }}
            />
            <span
              style={{
                fontFamily: "var(--font-source-code-pro), ui-monospace, monospace",
                fontSize: 11,
                letterSpacing: "1.2px",
                textTransform: "uppercase",
                color: "#6e6e6e",
              }}
            >
              {SIGNATURE_META}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Stagger reveal — character-by-character via opacity + slight rise.
// ─────────────────────────────────────────────────────────────────────────────

function StaggerText({ text, progress }: { text: string; progress: number }) {
  const chars = useMemo(() => Array.from(text), [text]);
  return (
    <span aria-label={text} style={{ display: "inline-block" }}>
      {chars.map((ch, i) => {
        // Per-char window: each char takes 1/N of progress with a slight overlap.
        const slotWidth = 1 / Math.max(1, chars.length);
        const start = i * slotWidth * 0.7;
        const local = clamp((progress - start) / 0.5, 0, 1);
        const eased = easeOutCubic(local);
        return (
          <span
            key={i}
            aria-hidden="true"
            style={{
              display: "inline-block",
              opacity: eased,
              transform: `translateY(${(1 - eased) * 14}px)`,
              transition: "opacity 60ms linear",
              willChange: "transform, opacity",
            }}
          >
            {ch === " " ? " " : ch}
          </span>
        );
      })}
    </span>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Inline brand leaf — strokes its outline then fills. Sized to track the
// wordmark's cap-height so it sits visually grounded next to "Carbo."
// ─────────────────────────────────────────────────────────────────────────────

function InlineLeaf({ progress }: { progress: number }) {
  const eased = easeOutCubic(progress);
  // Path length ~280; reveal stroke from start → full.
  const dash = 280;
  const offset = dash * (1 - eased);
  const fillOpacity = clamp((progress - 0.55) / 0.45, 0, 1);

  return (
    <span
      aria-hidden="true"
      style={{
        display: "inline-block",
        width: "clamp(56px, 8vw, 108px)",
        height: "clamp(56px, 8vw, 108px)",
        position: "relative",
        // Drop the leaf so its base aligns with the wordmark's baseline.
        transform: "translateY(8%)",
        opacity: clamp(progress * 1.4, 0, 1),
      }}
    >
      <svg
        viewBox="0 0 100 100"
        width="100%"
        height="100%"
        style={{
          filter: `drop-shadow(0 0 24px rgba(62,207,142,${0.18 + 0.18 * eased}))`,
        }}
      >
        <path
          d="M50 6 C 22 22, 12 50, 18 76 C 28 92, 56 96, 76 80 C 92 64, 92 36, 78 18 C 70 10, 60 6, 50 6 Z"
          fill="var(--brand-green, #3ecf8e)"
          fillOpacity={fillOpacity}
          stroke="var(--brand-green, #3ecf8e)"
          strokeWidth="2"
          strokeDasharray={dash}
          strokeDashoffset={offset}
          style={{ transition: "stroke-dashoffset 80ms linear, fill-opacity 120ms linear" }}
        />
        <path
          d="M50 10 C 50 30, 50 60, 42 88"
          stroke="rgba(0,0,0,0.22)"
          strokeWidth="1.4"
          strokeLinecap="round"
          fill="none"
          opacity={fillOpacity}
        />
      </svg>
    </span>
  );
}

function SmallLeaf({ size }: { size: number }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 100 100"
      width={size}
      height={size}
      style={{ flexShrink: 0 }}
    >
      <path
        d="M50 6 C 22 22, 12 50, 18 76 C 28 92, 56 96, 76 80 C 92 64, 92 36, 78 18 C 70 10, 60 6, 50 6 Z"
        fill="var(--brand-green, #3ecf8e)"
      />
    </svg>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Particle field — small leaves drift upward, ambient. Deterministic seed so
// frame layout is stable across renders.
// ─────────────────────────────────────────────────────────────────────────────

const PARTICLE_COUNT = 7;

type Particle = {
  xPct: number;       // horizontal anchor (0..100)
  drift: number;      // horizontal sway amount (px)
  size: number;       // px
  delay: number;      // 0..1 of scene progress
  speed: number;      // travel speed multiplier
  rot: number;        // rotation amount (deg)
  alpha: number;      // base opacity
};

const PARTICLES: Particle[] = Array.from({ length: PARTICLE_COUNT }, (_, i) => {
  // Deterministic pseudo-random so SSR/CSR match.
  const r = (n: number) => ((Math.sin((i + 1) * n) + 1) / 2);
  return {
    xPct: 8 + r(12.9898) * 84,
    drift: 24 + r(78.233) * 60,
    size: 12 + r(37.719) * 22,
    delay: r(94.673) * 0.5,
    speed: 0.6 + r(55.123) * 0.8,
    rot: -28 + r(11.41) * 56,
    alpha: 0.10 + r(48.501) * 0.18,
  };
});

function ParticleField({ progress, opacity }: { progress: number; opacity: number }) {
  return (
    <div
      aria-hidden="true"
      style={{
        position: "absolute",
        inset: 0,
        pointerEvents: "none",
        opacity,
      }}
    >
      {PARTICLES.map((p, i) => {
        // Per-particle progress 0..1, looping isn't needed — single rise.
        const local = clamp((progress - p.delay) * p.speed * 1.4, 0, 1);
        // Bottom (110%) → top (-10%), horizontal sway via sin.
        const yPct = 110 - local * 120;
        const sway = Math.sin(local * Math.PI * 1.6 + i) * p.drift;
        const rot = p.rot + local * 30;
        // Fade in/out: ramp up early, ramp down at top.
        const fade =
          local < 0.15
            ? local / 0.15
            : local > 0.85
              ? (1 - local) / 0.15
              : 1;
        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: `calc(${p.xPct}% + ${sway}px)`,
              top: `${yPct}%`,
              width: p.size,
              height: p.size,
              opacity: p.alpha * fade,
              transform: `rotate(${rot}deg)`,
              willChange: "transform, top, opacity",
            }}
          >
            <SmallLeaf size={p.size} />
          </div>
        );
      })}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Settle pulse — gentle radial breath in the last 20% so the static frame
// keeps a heartbeat instead of dying.
// ─────────────────────────────────────────────────────────────────────────────

function SettlePulse({ progress }: { progress: number }) {
  const local = clamp((progress - 0.78) / 0.22, 0, 1);
  if (local <= 0) return null;
  // Two soft pulses across the remaining window.
  const wave = (Math.sin(local * Math.PI * 2.4) + 1) / 2;
  const alpha = 0.04 + wave * 0.06;
  return (
    <div
      aria-hidden="true"
      style={{
        position: "absolute",
        inset: 0,
        background: `radial-gradient(ellipse 50% 40% at 50% 55%, rgba(62,207,142,${alpha}) 0%, transparent 70%)`,
        pointerEvents: "none",
      }}
    />
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Math helpers
// ─────────────────────────────────────────────────────────────────────────────

function phase(progress: number, start: number, end: number): number {
  if (end <= start) return progress >= end ? 1 : 0;
  return clamp((progress - start) / (end - start), 0, 1);
}

function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}

function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}
