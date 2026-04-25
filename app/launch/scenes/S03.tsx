"use client";

/**
 * S03 — Title only.
 * "Some spend doesn't explain itself."
 */

import type { SceneProps } from "../types";
import { TIMELINE } from "../data";
import { TitleCard } from "../components/TitleCard";

const SPEC = TIMELINE.find((t) => t.id === "S03")!;

export default function S03(_props: SceneProps) {
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
