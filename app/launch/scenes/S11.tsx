"use client";

/**
 * S11 — DAG runs through. The showpiece.
 *
 * Full-width MacWindow showing the 8-agent DAG. DagFlow consumes scene-elapsed
 * directly; we cap its internal duration at (durationMs - 2000) so all nodes
 * settle into "done" with a clear 2s tail before scene end.
 *
 * The DAG (6 tiers × 96px + 5 × 56px gaps ≈ 870px) overflows the MacWindow's
 * usable content area. Instead of relying on the camera (which moves the whole
 * MacWindow, not its inner content), we PROGRAMMATICALLY SCROLL the inner
 * overflow container so the active tier stays in frame. Without this, the
 * tier-6 executive_report node renders below the fold and gets cropped.
 *
 *   - Camera scale is capped at 1.0 (no zoom) — pixel-grid stays sharp.
 *   - Inner scroll auto-follows: starts at top, eases to bottom across the
 *     middle 60% of the scene, lands fully scrolled as tier 6 activates.
 */

import { useEffect, useRef } from "react";
import type { SceneProps } from "../types";
import { MacWindow } from "../components/MacWindow";
import { CameraScript } from "../components/CameraScript";
import { LaunchSidebar } from "../components/real/LaunchSidebar";
import { DagFlow } from "../components/DagFlow";
import { DAG_NODES } from "../data";

const SCROLL_START = 0.25;
const SCROLL_END = 0.92;
const easeInOutCubic = (t: number) =>
  t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

export default function S11({ elapsedMs, durationMs, progress }: SceneProps) {
  const dagDuration = Math.max(8000, durationMs - 2000);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Drive scrollTop from scene progress so the bottom tiers come into frame.
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const t = Math.max(
      0,
      Math.min(1, (progress - SCROLL_START) / (SCROLL_END - SCROLL_START))
    );
    const eased = easeInOutCubic(t);
    const maxScroll = Math.max(0, el.scrollHeight - el.clientHeight);
    el.scrollTop = eased * maxScroll;
  }, [progress]);

  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        background: "#ffffff",
      }}
    >
      <CameraScript
        keyframes={[
          { at: 0, scale: 0.94, x: 0, y: 18 },
          { at: 0.25, scale: 1.0, x: 0, y: 0 },
          { at: 1.0, scale: 1.0, x: 0, y: 0 },
        ]}
        elapsedMs={elapsedMs}
        durationMs={durationMs}
      >
        <MacWindow
          title="Carbo — DAG executor"
          showSidebar
          width={1480}
          height={900}
          glass
        >
          <div style={{ display: "flex", height: "100%" }}>
            <LaunchSidebar activeKey="close" />
            <div
              ref={scrollRef}
              style={{
                flex: 1,
                minWidth: 0,
                overflow: "auto",
                scrollBehavior: "auto",
              }}
            >
              <div
                style={{
                  width: "100%",
                  display: "flex",
                  alignItems: "flex-start",
                  justifyContent: "center",
                  padding: "32px 24px 48px",
                  boxSizing: "border-box",
                }}
              >
                <DagFlow
                  nodes={DAG_NODES}
                  elapsedMs={elapsedMs}
                  durationMs={dagDuration}
                />
              </div>
            </div>
          </div>
        </MacWindow>
      </CameraScript>
    </div>
  );
}
