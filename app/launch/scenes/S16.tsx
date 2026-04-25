"use client";

/**
 * S16 — Final lockup.
 *
 * White canvas (no MacWindow). The Leaf settles to its end position (handled
 * automatically by the Leaf component when totalElapsedMs > 95% of total).
 * Beside it, the wordmark "Carbo" types in. Once typing finishes, the tagline
 * "Built on bunq." fades in below.
 */

import type { SceneProps } from "../types";
import { TypedText } from "../components/TypedText";

const WORDMARK = "Carbo";
const TAGLINE = "Built on bunq.";

export default function S16({ progress }: SceneProps) {
  // Tagline appears after the wordmark has typed in (~ progress 0.4).
  const showTagline = progress > 0.4;

  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        background: "#ffffff",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <div
        style={{
          // Slight nudge right so we sit alongside (not over) the leaf, which
          // settles at viewport (35vw, 50vh).
          marginLeft: "12vw",
          display: "flex",
          flexDirection: "column",
          alignItems: "flex-start",
          gap: 16,
          maxWidth: "min(720px, 60vw)",
        }}
      >
        <h1
          style={{
            fontFamily: "var(--font-inter), system-ui, sans-serif",
            fontSize: 64,
            fontWeight: 500,
            lineHeight: 1,
            letterSpacing: "-0.02em",
            color: "#0a0a0a",
            margin: 0,
          }}
        >
          <TypedText text={WORDMARK} perCharMs={120} />
        </h1>

        <div
          style={{
            fontFamily: "var(--font-inter), system-ui, sans-serif",
            fontSize: 18,
            fontWeight: 400,
            lineHeight: 1.4,
            color: "#4d4d4d",
            opacity: showTagline ? 1 : 0,
            transition: "opacity 400ms ease-out",
            minHeight: 26,
          }}
        >
          {showTagline ? <TypedText text={TAGLINE} perCharMs={45} /> : null}
        </div>
      </div>
    </div>
  );
}
