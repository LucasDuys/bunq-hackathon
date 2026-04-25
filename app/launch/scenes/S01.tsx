"use client";

/**
 * S01 — Title only.
 * "Your books already know your carbon."
 *
 * Centered title card on white shell. No MacWindow. The TitleCard owns its
 * own enter/type/exit timing; we just hand it the text and a hold time
 * generous enough that it stays on-screen for the scene's full slot.
 */

import type { SceneProps } from "../types";
import { TIMELINE } from "../data";
import { TitleCard } from "../components/TitleCard";

const SPEC = TIMELINE.find((t) => t.id === "S01")!;

export default function S01(_props: SceneProps) {
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
