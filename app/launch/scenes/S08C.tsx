"use client";

/**
 * S08C — Orbiting cube of agent windows.
 *
 * Eight mini MacWindow tiles slowly rotate on a CSS 3D cube. The single most
 * ChatGPT-5.5-style beat in the video. Sets up S11 (DAG full run-through).
 */

import type { SceneProps } from "../types";
import { OrbitingCube } from "../components/OrbitingCube";

export default function S08C({ elapsedMs, durationMs }: SceneProps) {
  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        background: "#0f0f0f",
      }}
    >
      <OrbitingCube elapsedMs={elapsedMs} durationMs={durationMs} />
    </div>
  );
}
