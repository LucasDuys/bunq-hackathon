"use client";

/**
 * S01B — Title only.
 * "We just need to extract it."
 *
 * Bridge between S01's premise ("your books already know") and S01D's first
 * real product surface (the dashboard). Same TitleCard treatment as S01/S03.
 */

import type { SceneProps } from "../types";
import { TIMELINE } from "../data";
import { TitleCard } from "../components/TitleCard";

const SPEC = TIMELINE.find((t) => t.id === "S01B")!;

export default function S01B(_props: SceneProps) {
  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        background: "#ffffff",
      }}
    >
      <TitleCard text={SPEC.title ?? ""} holdMs={1200} />
    </div>
  );
}
