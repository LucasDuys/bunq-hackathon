"use client";

/**
 * S01C — Title only.
 * "Meet Carbo."
 *
 * Brand reveal. Sits between S01B's premise ("we just need to extract it")
 * and S01D's first product surface.
 */

import type { SceneProps } from "../types";
import { TIMELINE } from "../data";
import { TitleCard } from "../components/TitleCard";

const SPEC = TIMELINE.find((t) => t.id === "S01C")!;

export default function S01C(_props: SceneProps) {
  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        background: "#ffffff",
      }}
    >
      <TitleCard text={SPEC.title ?? ""} holdMs={1400} />
    </div>
  );
}
