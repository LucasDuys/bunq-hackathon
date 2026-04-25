"use client";

/**
 * CameraScript — multi-keyframe camera. The grown-up sibling of CameraFrame.
 *
 * Where CameraFrame interpolates between a single (from → to) pair, CameraScript
 * walks an arbitrary list of keyframes ordered by `at` (normalized 0..1 through
 * the scene). It finds the active segment for the current normalized progress,
 * then eases the LOCAL segment progress to compute scale/x/y.
 *
 * This lets us choreograph multi-beat camera moves (wide hold → snap-push →
 * tight close) on top of CameraFrame's single bezier solver, while keeping the
 * macOS chrome visible at the start of every scene by anchoring `at:0`.
 *
 * Hard contract:
 *   - keyframes MUST include `at: 0` and `at: 1`.
 *   - keyframes MUST be sorted ascending by `at`.
 *   - transform-origin: center center, willChange: transform.
 */

import type { CSSProperties, ReactNode } from "react";

export type Keyframe = {
  /** Normalized timeline progress 0..1 within the scene. */
  at: number;
  scale: number;
  x: number;
  y: number;
};

export type CameraScriptProps = {
  keyframes: Keyframe[];
  elapsedMs: number;
  durationMs: number;
  /** Easing applied to the SEGMENT progress (default: easeInOutCubic — snappy mid-scene). */
  ease?: (t: number) => number;
  children: ReactNode;
};

/** Snappy mid-scene ease — close cousin of cubic-bezier(0.32, 0.72, 0, 1). */
function easeInOutCubic(t: number): number {
  return t < 0.5
    ? 4 * t * t * t
    : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

export function CameraScript({
  keyframes,
  elapsedMs,
  durationMs,
  ease = easeInOutCubic,
  children,
}: CameraScriptProps) {
  const t = durationMs > 0 ? clamp(elapsedMs / durationMs, 0, 1) : 1;

  // Find the segment containing t — keyframes are sorted, but we keep this O(n)
  // because n ≤ 6 in practice.
  let i = 0;
  for (let k = 0; k < keyframes.length - 1; k++) {
    if (t >= keyframes[k]!.at && t <= keyframes[k + 1]!.at) {
      i = k;
      break;
    }
    // Edge: past the last keyframe — clamp to final segment.
    if (k === keyframes.length - 2 && t > keyframes[k + 1]!.at) {
      i = k;
    }
  }

  const a = keyframes[i]!;
  const b = keyframes[i + 1] ?? a;
  const span = b.at - a.at;
  const localT = span > 0 ? clamp((t - a.at) / span, 0, 1) : 1;
  const k = ease(localT);

  const scale = lerp(a.scale, b.scale, k);
  const x = lerp(a.x, b.x, k);
  const y = lerp(a.y, b.y, k);

  const style: CSSProperties = {
    transformOrigin: "center center",
    transform: `translate3d(${x}px, ${y}px, 0) scale(${scale})`,
    willChange: "transform",
    width: "100%",
    height: "100%",
  };

  return <div style={style}>{children}</div>;
}
