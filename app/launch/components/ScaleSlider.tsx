"use client";

/**
 * ScaleSlider — multiplier sweep for S15.
 *
 * Two columns:
 *   left  — horizontal slider with three labelled tick marks (mock / mid / ent).
 *   right — two giant tabular-nums stats stacked (NET ANNUAL + CO₂E REDUCED)
 *           plus a "= ~N cars off the road" badge.
 *
 * `progress` (0..1) sweeps through the tier array. Linear interpolation between
 * adjacent tiers; the displayed numbers count up smoothly via RAF so the React
 * tree only re-renders at most once per frame.
 *
 * Honours `prefers-reduced-motion`.
 */

import { useEffect, useRef, useState } from "react";
import { Car } from "lucide-react";
import type { ScaleTier } from "../types";
import { CodeLabel } from "@/components/ui";

export type ScaleSliderProps = {
  tiers: ScaleTier[];
  /** 0..1 progress sweeping through tiers (0 = first tier, 1 = last). */
  progress: number;
};

export function ScaleSlider({ tiers, progress }: ScaleSliderProps) {
  // ── Interpolated values (RAF-smoothed) ──
  const target = interpolateTier(tiers, progress);
  const smoothed = useRafSmoothed(target);

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "1fr 1fr",
        gap: 64,
        alignItems: "center",
        background: "#171717",
        color: "var(--fg-primary)",
        width: "100%",
        height: "100%",
        padding: "32px 48px",
      }}
    >
      <SliderColumn tiers={tiers} progress={progress} currentLabel={smoothed.label} />
      <StatsColumn smoothed={smoothed} />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Interpolation
// ─────────────────────────────────────────────────────────────────────────────

type Smoothed = {
  netEur: number;
  tco2e: number;
  carEquivalents: number;
  label: string;
};

function interpolateTier(tiers: ScaleTier[], p: number): Smoothed {
  if (tiers.length === 0) {
    return { netEur: 0, tco2e: 0, carEquivalents: 0, label: "—" };
  }
  if (tiers.length === 1) {
    const t = tiers[0]!;
    return { netEur: t.netEur, tco2e: t.tco2e, carEquivalents: t.carEquivalents, label: t.label };
  }
  const clamped = Math.max(0, Math.min(1, p));
  const segCount = tiers.length - 1;
  const idx = Math.min(segCount - 1, Math.floor(clamped * segCount));
  const local = clamped * segCount - idx;
  const a = tiers[idx]!;
  const b = tiers[idx + 1]!;
  return {
    netEur: lerp(a.netEur, b.netEur, local),
    tco2e: lerp(a.tco2e, b.tco2e, local),
    carEquivalents: lerp(a.carEquivalents, b.carEquivalents, local),
    label: local < 0.5 ? a.label : b.label,
  };
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/** RAF count-up — animates current → target each frame without per-tick setState
 *  outside of RAF. Returns the smoothed snapshot. */
function useRafSmoothed(target: Smoothed): Smoothed {
  const [snap, setSnap] = useState<Smoothed>(target);
  const targetRef = useRef(target);
  const snapRef = useRef(target);
  const reducedMotion = usePrefersReducedMotion();

  // Keep the latest target visible to the RAF loop without restarting it.
  useEffect(() => {
    targetRef.current = target;
    if (reducedMotion) {
      snapRef.current = target;
      setSnap(target);
    }
  }, [target, reducedMotion]);

  useEffect(() => {
    if (reducedMotion) return;
    let raf = 0;
    const tick = () => {
      const t = targetRef.current;
      const s = snapRef.current;
      // Critically-damped-ish ease toward the target — 18% closer each frame.
      const k = 0.18;
      const next: Smoothed = {
        netEur: s.netEur + (t.netEur - s.netEur) * k,
        tco2e: s.tco2e + (t.tco2e - s.tco2e) * k,
        carEquivalents: s.carEquivalents + (t.carEquivalents - s.carEquivalents) * k,
        label: t.label, // label snaps; no count-up
      };
      // Stop integrating noise: snap when the gap is sub-pixel.
      const close =
        Math.abs(next.netEur - t.netEur) < 1 &&
        Math.abs(next.tco2e - t.tco2e) < 0.05 &&
        Math.abs(next.carEquivalents - t.carEquivalents) < 0.5;
      const settled = close ? t : next;
      snapRef.current = settled;
      setSnap(settled);
      if (!close) {
        raf = requestAnimationFrame(tick);
      } else {
        // keep looping at low rate so a fresh `progress` is picked up next frame
        raf = requestAnimationFrame(tick);
      }
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [reducedMotion]);

  return snap;
}

function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    if (typeof window === "undefined") return;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReduced(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);
  return reduced;
}

// ─────────────────────────────────────────────────────────────────────────────
// Slider column
// ─────────────────────────────────────────────────────────────────────────────

function SliderColumn({
  tiers,
  progress,
  currentLabel,
}: {
  tiers: ScaleTier[];
  progress: number;
  currentLabel: string;
}) {
  const clamped = Math.max(0, Math.min(1, progress));

  // Three tick positions (0, 0.5, 1) labelled with tier labels.
  const ticks = tiers.map((t, i) => ({
    pos: tiers.length === 1 ? 0 : i / (tiers.length - 1),
    label: t.label,
  }));

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>
      <CodeLabel>Monthly scale multiplier</CodeLabel>

      {/* Track */}
      <div style={{ position: "relative", height: 40, paddingTop: 18 }}>
        <div
          style={{
            position: "absolute",
            top: 18,
            left: 0,
            right: 0,
            height: 4,
            background: "var(--border-default)",
            borderRadius: 9999,
          }}
        />
        <div
          style={{
            position: "absolute",
            top: 18,
            left: 0,
            width: `${clamped * 100}%`,
            height: 4,
            background: "var(--brand-green)",
            borderRadius: 9999,
            transition: "width 200ms cubic-bezier(0.32,0.72,0,1)",
          }}
        />
        {/* Handle */}
        <div
          style={{
            position: "absolute",
            top: 12,
            left: `calc(${clamped * 100}% - 8px)`,
            width: 16,
            height: 16,
            borderRadius: "50%",
            background: "var(--brand-green)",
            border: "2px solid #171717",
            boxShadow: "0 0 0 1px var(--brand-green)",
            transition: "left 200ms cubic-bezier(0.32,0.72,0,1)",
          }}
          aria-hidden="true"
        />
      </div>

      {/* Tick labels */}
      <div style={{ position: "relative", height: 24 }}>
        {ticks.map((tk) => (
          <div
            key={tk.label}
            style={{
              position: "absolute",
              left: `${tk.pos * 100}%`,
              transform:
                tk.pos === 0
                  ? "translateX(0)"
                  : tk.pos === 1
                    ? "translateX(-100%)"
                    : "translateX(-50%)",
              fontFamily: "var(--font-source-code-pro), ui-monospace, monospace",
              fontSize: 11,
              letterSpacing: "1.2px",
              textTransform: "uppercase",
              color: "var(--fg-muted)",
              whiteSpace: "nowrap",
            }}
          >
            {tk.label}
          </div>
        ))}
      </div>

      {/* Current label (interpolated) */}
      <div
        style={{
          marginTop: 12,
          color: "var(--fg-secondary)",
          fontSize: 14,
          fontFamily: "var(--font-inter), system-ui, sans-serif",
        }}
      >
        Current scale:{" "}
        <span style={{ color: "var(--fg-primary)", fontWeight: 500 }}>
          {currentLabel}
        </span>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Stats column
// ─────────────────────────────────────────────────────────────────────────────

function StatsColumn({ smoothed }: { smoothed: Smoothed }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 32 }}>
      {/* NET ANNUAL */}
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <CodeLabel>Net annual impact</CodeLabel>
        <div
          style={{
            color: "var(--brand-green)",
            fontSize: 64,
            fontWeight: 400,
            fontVariantNumeric: "tabular-nums",
            letterSpacing: "-0.02em",
            lineHeight: 1.0,
            fontFamily: "var(--font-inter), system-ui, sans-serif",
          }}
        >
          {fmtCompactEur(smoothed.netEur)}
        </div>
        <div style={{ color: "var(--fg-muted)", fontSize: 13 }}>
          savings + tax incentives, annualized
        </div>
      </div>

      {/* CO₂E REDUCED */}
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <CodeLabel>CO₂e reduced</CodeLabel>
        <div
          style={{
            color: "var(--fg-primary)",
            fontSize: 48,
            fontWeight: 400,
            fontVariantNumeric: "tabular-nums",
            letterSpacing: "-0.015em",
            lineHeight: 1.0,
            fontFamily: "var(--font-inter), system-ui, sans-serif",
          }}
        >
          {fmtCompactTons(smoothed.tco2e)}
        </div>

        {/* Cars badge */}
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            marginTop: 8,
            padding: "6px 12px",
            border: "1px solid var(--brand-green-border)",
            borderRadius: 9999,
            color: "var(--brand-green)",
            fontSize: 12,
            fontWeight: 500,
            background: "var(--brand-green-soft)",
            alignSelf: "flex-start",
            fontFamily: "var(--font-inter), system-ui, sans-serif",
          }}
        >
          <Car size={14} strokeWidth={1.75} />
          <span>
            ={" "}
            <span style={{ fontVariantNumeric: "tabular-nums" }}>
              ~{Math.round(smoothed.carEquivalents).toLocaleString("en-NL")}
            </span>{" "}
            cars off the road
          </span>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Number formatters (compact M / k for big stats)
// ─────────────────────────────────────────────────────────────────────────────

function fmtCompactEur(v: number): string {
  if (v >= 1_000_000) return `€${(v / 1_000_000).toFixed(2)} M`;
  if (v >= 10_000) return `€${(v / 1000).toFixed(1)} k`;
  return v.toLocaleString("en-NL", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  });
}

function fmtCompactTons(v: number): string {
  if (v >= 10_000) return `${(v / 1000).toFixed(1)} ktCO₂e`;
  if (v >= 1000) return `${v.toLocaleString("en-NL", { maximumFractionDigits: 0 })} tCO₂e`;
  return `${v.toLocaleString("en-NL", { maximumFractionDigits: 1 })} tCO₂e`;
}
