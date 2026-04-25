"use client";

/**
 * Leaf — single brand-green leaf SVG that drifts across the entire shell.
 *
 * Position is computed each frame from `elapsedMs` using the sin equations
 * specified in the launch spec. As the timeline approaches its end (>95% of
 * TOTAL_DURATION_MS) the leaf settles toward (35% viewport, 50% viewport,
 * rotation 0) over 800ms ease-out — a brief landing before the final fade.
 *
 * Opacity has THREE phases on top of CSS transition for per-scene re-keys:
 *   1. Intro (t < 800ms): force opacity 0 → prop value over the first 800ms,
 *      so the leaf doesn't pop into existence on page load.
 *   2. Mid-timeline: opacity reads the prop value reliably, with a 400ms CSS
 *      transition smoothing per-scene re-keys.
 *   3. Outro (t > 0.985 * TOTAL_DURATION_MS): force opacity 0 over 1200ms ease-out
 *      so the wordmark scene (S16) ends with the leaf invisible.
 */
import { useEffect, useState } from "react";
import { TOTAL_DURATION_MS } from "../data";

export type LeafProps = {
  elapsedMs?: number;
  opacity?: number;
};

const SETTLE_MS = 800;
const SETTLE_THRESHOLD = 0.95 * TOTAL_DURATION_MS;
const FADE_OUT_THRESHOLD = 0.985 * TOTAL_DURATION_MS;
const FADE_OUT_MS = 1200;
const INTRO_MS = 800;
const LEAF_WIDTH = 140;
const LEAF_HEIGHT = 140;

export function Leaf({ elapsedMs, opacity = 0.25 }: LeafProps) {
  const isExternal = elapsedMs !== undefined;
  const [internal, setInternal] = useState(0);
  const [mounted, setMounted] = useState(false);
  // Initial size matches SSR default so first client render hydrates cleanly;
  // real viewport size is read in the mount effect below.
  const [size, setSize] = useState<{ w: number; h: number }>({ w: 1920, h: 1080 });

  useEffect(() => {
    setMounted(true);
    setSize({ w: window.innerWidth, h: window.innerHeight });
    const onResize = () =>
      setSize({ w: window.innerWidth, h: window.innerHeight });
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  useEffect(() => {
    if (isExternal) return;
    let frame = 0;
    const start = performance.now();
    const tick = (now: number) => {
      setInternal(now - start);
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [isExternal]);

  const t = isExternal ? (elapsedMs as number) : internal;

  // Drifting position
  const driftX = size.w * (0.5 + 0.35 * Math.sin(t * 0.0003));
  const driftY = size.h * (0.4 + 0.25 * Math.sin(t * 0.00041 + 1.7));
  const driftRot = 15 * Math.sin(t * 0.0006);

  // Settlement target — brief landing before fade-out kicks in.
  const targetX = size.w * 0.35;
  const targetY = size.h * 0.5;
  const targetRot = 0;

  let cx = driftX;
  let cy = driftY;
  let rot = driftRot;

  if (t > SETTLE_THRESHOLD) {
    const settleElapsed = t - SETTLE_THRESHOLD;
    const k = clamp(settleElapsed / SETTLE_MS, 0, 1);
    const eased = easeOutQuint(k);
    cx = lerp(driftX, targetX, eased);
    cy = lerp(driftY, targetY, eased);
    rot = lerp(driftRot, targetRot, eased);
  }

  // Translate so the leaf's center is at (cx, cy).
  const left = cx - LEAF_WIDTH / 2;
  const top = cy - LEAF_HEIGHT / 2;

  // Three-phase opacity envelope.
  // - Intro (0..INTRO_MS):  0 → prop opacity, eased
  // - Mid:                  prop opacity (CSS transition smooths per-scene re-keys)
  // - Outro (>FADE_OUT):    prop → 0 over FADE_OUT_MS, eased
  let envelope = 1;
  if (t < INTRO_MS) {
    envelope = easeOutCubic(clamp(t / INTRO_MS, 0, 1));
  } else if (t > FADE_OUT_THRESHOLD) {
    const fadeElapsed = t - FADE_OUT_THRESHOLD;
    const k = clamp(fadeElapsed / FADE_OUT_MS, 0, 1);
    envelope = 1 - easeOutCubic(k);
  }
  // Skip hydration mismatch: don't render until the client has measured the
  // viewport. The leaf is purely decorative (aria-hidden), so server-skipping
  // it has no semantic cost.
  if (!mounted) return null;

  const effectiveOpacity = clamp(opacity * envelope, 0, 1);

  return (
    <div
      style={{
        position: "fixed",
        left: 0,
        top: 0,
        transform: `translate3d(${left}px, ${top}px, 0) rotate(${rot}deg)`,
        width: LEAF_WIDTH,
        height: LEAF_HEIGHT,
        pointerEvents: "none",
        zIndex: 10000,
        opacity: effectiveOpacity,
        transition: "opacity 400ms ease-out",
        willChange: "transform, opacity",
      }}
      aria-hidden="true"
    >
      <svg
        viewBox="0 0 100 100"
        width={LEAF_WIDTH}
        height={LEAF_HEIGHT}
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* Single curved teardrop leaf with central vein. Two paths only. */}
        <path
          d="M50 6 C 22 22, 12 50, 18 76 C 28 92, 56 96, 76 80 C 92 64, 92 36, 78 18 C 70 10, 60 6, 50 6 Z"
          fill="var(--brand-green)"
        />
        <path
          d="M50 10 C 50 30, 50 60, 42 88"
          stroke="rgba(0,0,0,0.18)"
          strokeWidth="1.4"
          strokeLinecap="round"
          fill="none"
        />
      </svg>
    </div>
  );
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}

function easeOutQuint(t: number): number {
  return 1 - Math.pow(1 - t, 5);
}

function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}
