"use client";

/**
 * CameraFrame — animates scale + translate on its child over `durationMs`.
 *
 * If `elapsedMs` is provided, the frame is driven externally (lets a parent
 * scene timer own the clock). Otherwise CameraFrame self-clocks via RAF from
 * mount.
 *
 * The default ease is a JS approximation of cubic-bezier(0.32, 0.72, 0, 1).
 * We solve the bezier for x → t numerically (Newton + bisection fallback)
 * each frame, which is exact within 1e-6 — fine for animation purposes.
 */
import { useEffect, useRef, useState } from "react";
import type { CSSProperties, ReactNode } from "react";

export type CameraTransform = {
  scale: number;
  x: number;
  y: number;
};

export type CameraFrameProps = {
  from: CameraTransform;
  to: CameraTransform;
  durationMs: number;
  ease?: (t: number) => number;
  elapsedMs?: number;
  children: ReactNode;
};

/** cubic-bezier(0.32, 0.72, 0, 1) — Apple-like overshoot-free swift ease. */
export const easeSwiftOut = makeCubicBezier(0.32, 0.72, 0, 1);

export function CameraFrame({
  from,
  to,
  durationMs,
  ease = easeSwiftOut,
  elapsedMs,
  children,
}: CameraFrameProps) {
  const isExternal = elapsedMs !== undefined;
  const [internal, setInternal] = useState(0);

  useEffect(() => {
    if (isExternal) return;
    let frame = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const e = now - start;
      setInternal(e);
      if (e < durationMs) frame = requestAnimationFrame(tick);
      else setInternal(durationMs);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [isExternal, durationMs]);

  const e = isExternal ? (elapsedMs as number) : internal;
  const t = durationMs > 0 ? clamp(e / durationMs, 0, 1) : 1;
  const k = ease(t);

  const scale = lerp(from.scale, to.scale, k);
  const x = lerp(from.x, to.x, k);
  const y = lerp(from.y, to.y, k);

  const style: CSSProperties = {
    transformOrigin: "center center",
    transform: `translate3d(${x}px, ${y}px, 0) scale(${scale})`,
    willChange: "transform",
    width: "100%",
    height: "100%",
  };

  return <div style={style}>{children}</div>;
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}

/**
 * Make a cubic-bezier easing function for control points (x1, y1, x2, y2).
 * Solves bezier-x(t) = inputX for t (Newton-Raphson + bisection fallback),
 * then evaluates bezier-y(t).
 *
 * This is the same algorithm WebKit/Blink use for CSS cubic-bezier().
 */
export function makeCubicBezier(
  x1: number,
  y1: number,
  x2: number,
  y2: number
): (t: number) => number {
  // Polynomial coefficients for bezier curve
  // B(t) = 3(1-t)^2 t P1 + 3(1-t) t^2 P2 + t^3
  //      = (3P1 - 3P2 + 1)t^3 + (3P2 - 6P1)t^2 + 3P1 t
  const ax = 3 * x1 - 3 * x2 + 1;
  const bx = 3 * x2 - 6 * x1;
  const cx = 3 * x1;

  const ay = 3 * y1 - 3 * y2 + 1;
  const by = 3 * y2 - 6 * y1;
  const cy = 3 * y1;

  const sampleX = (t: number) => ((ax * t + bx) * t + cx) * t;
  const sampleY = (t: number) => ((ay * t + by) * t + cy) * t;
  const sampleDerivativeX = (t: number) => (3 * ax * t + 2 * bx) * t + cx;

  const solveX = (x: number) => {
    if (x <= 0) return 0;
    if (x >= 1) return 1;
    let t = x;
    // Newton-Raphson — usually converges in <8 iterations.
    for (let i = 0; i < 8; i++) {
      const cur = sampleX(t) - x;
      if (Math.abs(cur) < 1e-6) return t;
      const d = sampleDerivativeX(t);
      if (Math.abs(d) < 1e-6) break;
      t -= cur / d;
    }
    // Bisection fallback for pathological curves.
    let lo = 0;
    let hi = 1;
    let t2 = x;
    for (let i = 0; i < 32; i++) {
      const cur = sampleX(t2) - x;
      if (Math.abs(cur) < 1e-6) return t2;
      if (cur < 0) lo = t2;
      else hi = t2;
      t2 = (lo + hi) / 2;
    }
    return t2;
  };

  return (t: number) => {
    if (t <= 0) return 0;
    if (t >= 1) return 1;
    return sampleY(solveX(t));
  };
}
