"use client";

/**
 * S10 — Title only.
 * "Eight agents. Five tiers. Two parallel fan-outs."
 */

import type { SceneProps } from "../types";
import { TIMELINE } from "../data";
import { TitleCard } from "../components/TitleCard";

const SPEC = TIMELINE.find((t) => t.id === "S10")!;

export default function S10(_props: SceneProps) {
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
