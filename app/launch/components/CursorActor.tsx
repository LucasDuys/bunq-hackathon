"use client";

/**
 * CursorActor — a macOS-style arrow cursor that performs a scripted
 * drag-drop ballet for S4 of the launch video.
 *
 * Driven by an external clock (`elapsedMs`) — never self-clocks. The cursor's
 * position is linearly interpolated between the two adjacent keyframes from
 * `script` whose `at` brackets the current time. Action keyframes (`press`,
 * `release`, `drag`, `show`, `exit`) toggle visual state (ripple ring,
 * carry attachment, opacity).
 *
 * Ripple choreography:
 *   - 'press'   → a 500ms neutral ring (white→outline) at cursor pos
 *   - 'release' → same ripple in brand-green (drop confirmation)
 *
 * Carry: while between a 'press'/'drag' and the next 'release' the
 * `carry` slot is rendered offset (16, 16) from the cursor with a slight
 * tilt and reduced opacity, mimicking a held macOS proxy icon.
 *
 * z-index 10001 keeps it above every scene element including the leaf.
 */

import { useMemo } from "react";
import type { CSSProperties, ReactNode } from "react";
import type { CursorAction, CursorKeyframe } from "../types";

// Reference frame: scripts are authored against 1920x1080. The cursor's
// transform is expressed in viewport pixels, so we do *no* re-scaling here —
// the parent stage is full-viewport and we trust the scripted coords. (If the
// parent ever scales, the cursor will scale with it via translate.)

type Props = {
  script: CursorKeyframe[];
  /** External clock in ms; required (no self-clocking). */
  elapsedMs: number;
  /** What's being dragged — rendered attached to cursor during 'drag' phase. */
  carry?: ReactNode;
};

const RIPPLE_DURATION_MS = 500;
const SHOW_FADE_MS = 300;

/** Find the segment around `t`. Returns [prev, next, lerp]. */
function locate(script: CursorKeyframe[], t: number) {
  if (script.length === 0) {
    return { prev: null as CursorKeyframe | null, next: null as CursorKeyframe | null, u: 0 };
  }
  if (t <= script[0].at) {
    return { prev: script[0], next: script[0], u: 0 };
  }
  for (let i = 0; i < script.length - 1; i++) {
    const a = script[i];
    const b = script[i + 1];
    if (t >= a.at && t <= b.at) {
      const span = Math.max(1, b.at - a.at);
      return { prev: a, next: b, u: (t - a.at) / span };
    }
  }
  const last = script[script.length - 1];
  return { prev: last, next: last, u: 1 };
}

/**
 * Determine current "phase" — whether the cursor should be visible, in a
 * dragging state (carry attached), and which ripple (if any) is active.
 */
function deriveState(script: CursorKeyframe[], t: number) {
  // Visibility: invisible before the first 'show' and after 'exit' completes.
  let visible = false;
  // Drag: between a 'press' (or first 'drag' after press) and a 'release'.
  let dragging = false;
  // Latest 'press'/'release' timestamps for ripple timing.
  let pressAt: number | null = null;
  let releaseAt: number | null = null;
  let exitAt: number | null = null;

  for (const kf of script) {
    if (kf.at > t) break;
    switch (kf.action satisfies CursorAction) {
      case "show":
        visible = true;
        break;
      case "hover":
        // pure motion, no state change
        break;
      case "press":
        pressAt = kf.at;
        dragging = true;
        break;
      case "drag":
        // still dragging
        break;
      case "release":
        releaseAt = kf.at;
        dragging = false;
        break;
      case "exit":
        exitAt = kf.at;
        break;
    }
  }

  // Fade-out window after 'exit'
  let opacity = visible ? 1 : 0;
  if (exitAt !== null) {
    const dt = t - exitAt;
    opacity = Math.max(0, 1 - dt / SHOW_FADE_MS);
  }

  // Active ripple: whichever press/release is most recent and within window.
  let ripple: { color: string; age: number } | null = null;
  if (pressAt !== null) {
    const age = t - pressAt;
    if (age >= 0 && age <= RIPPLE_DURATION_MS) {
      ripple = { color: "rgba(255, 255, 255, 0.85)", age };
    }
  }
  if (releaseAt !== null) {
    const age = t - releaseAt;
    if (age >= 0 && age <= RIPPLE_DURATION_MS) {
      // release ripple wins if it's actively running
      ripple = { color: "var(--brand-green)", age };
    }
  }

  return { visible, dragging, opacity, ripple };
}

export function CursorActor({ script, elapsedMs, carry }: Props) {
  const sortedScript = useMemo(
    () => [...script].sort((a, b) => a.at - b.at),
    [script]
  );

  const { prev, next, u } = locate(sortedScript, elapsedMs);
  const x = prev && next ? prev.x + (next.x - prev.x) * u : 0;
  const y = prev && next ? prev.y + (next.y - prev.y) * u : 0;

  const { dragging, opacity, ripple } = deriveState(sortedScript, elapsedMs);

  const containerStyle: CSSProperties = {
    position: "absolute",
    left: 0,
    top: 0,
    transform: `translate(${x}px, ${y}px)`,
    pointerEvents: "none",
    zIndex: 10001,
    opacity,
    transition: `opacity ${SHOW_FADE_MS}ms ease-out`,
    willChange: "transform, opacity",
  };

  return (
    <div style={containerStyle} aria-hidden="true">
      {/* Ripple — emitted at cursor position. We rebuild via key so each new
          press/release restarts the CSS animation cleanly. */}
      {ripple ? (
        <RippleRing color={ripple.color} keyId={`${ripple.color}-${ripple.age < 50 ? "fresh" : "tail"}`} />
      ) : null}

      {/* Carried payload — only visible during a held drag */}
      {dragging && carry ? (
        <div
          style={{
            position: "absolute",
            left: 16,
            top: 16,
            transform: "rotate(-4deg)",
            opacity: 0.85,
            pointerEvents: "none",
            transformOrigin: "0 0",
          }}
        >
          {carry}
        </div>
      ) : null}

      {/* The cursor SVG itself — standard NW-pointing macOS arrow. */}
      <CursorSvg />
    </div>
  );
}

/** macOS-style arrow cursor (~22px tall) drawn inline. */
function CursorSvg() {
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 22 22"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      style={{
        display: "block",
        position: "absolute",
        left: 0,
        top: 0,
        // Hot-spot at (1, 1) — near the tip of the arrow.
        transform: "translate(-1px, -1px)",
        // Tiny shadow to lift the cursor over both light & dark surfaces.
        filter: "drop-shadow(0 1px 1px rgba(0, 0, 0, 0.25))",
      }}
    >
      {/*
        Classic NW-pointing arrow polygon. Two filled paths layered for the
        macOS double-stroke look: black outline drawn first, white fill on top.
      */}
      <path
        d="M2 2 L2 17 L6.4 13.4 L9 19.5 L11.5 18.5 L9 12.4 L14.5 12.4 Z"
        fill="#000000"
      />
      <path
        d="M3.1 3.5 L3.1 14.7 L6.6 11.8 L9.3 17.9 L10.6 17.4 L8 11.3 L13 11.3 Z"
        fill="#ffffff"
      />
    </svg>
  );
}

/**
 * RippleRing — a single 500ms expanding ring. Mounted only while active so
 * a fresh `key` change restarts the keyframe animation reliably.
 */
function RippleRing({ color, keyId }: { color: string; keyId: string }) {
  const style: CSSProperties = {
    position: "absolute",
    left: 0,
    top: 0,
    width: 40,
    height: 40,
    transform: "translate(-20px, -20px)",
    borderRadius: "9999px",
    border: `2px solid ${color}`,
    opacity: 0.6,
    pointerEvents: "none",
    animation: `cursor-ripple ${RIPPLE_DURATION_MS}ms ease-out forwards`,
  };
  return (
    <>
      <style>{`
        @keyframes cursor-ripple {
          0%   { transform: translate(-20px, -20px) scale(1);   opacity: 0.6; }
          100% { transform: translate(-40px, -40px) scale(2);   opacity: 0;   }
        }
        @media (prefers-reduced-motion: reduce) {
          @keyframes cursor-ripple {
            0%, 100% { opacity: 0; }
          }
        }
      `}</style>
      <span key={keyId} style={style} />
    </>
  );
}
