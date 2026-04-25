"use client";

/**
 * OrbitingCube — eight mini MacWindow tiles arranged on the four side faces
 * of a slowly-rotating cube. Implies "Carbo juggles many contexts at once" —
 * the same gesture the ChatGPT-5.5 launch video uses to introduce its agent
 * stack.
 *
 * Pure CSS 3D transforms — no Three.js. Runs entirely from the parent's
 * elapsedMs/progress so a single screen-recording captures it deterministically.
 *
 * Each face is one of the 8 DAG agents from `lib/agents/dag/index.ts`, with a
 * model-tier badge (Haiku / Sonnet / Deterministic) so viewers can connect
 * this to the next beat (S11 DAG run-through).
 */

import { Calculator, Coins, FileText, Leaf, Search, ShieldCheck, Wallet } from "lucide-react";

type CubeFace = {
  label: string;
  model: "DETERMINISTIC" | "SONNET 4.6" | "HAIKU 4.5";
  icon: typeof Search;
  accent: string;
};

const FACES: CubeFace[] = [
  { label: "Spend & Emissions Baseline",  model: "DETERMINISTIC", icon: Calculator,  accent: "#898989" },
  { label: "Research",                     model: "SONNET 4.6",    icon: Search,      accent: "#5fb9ff" },
  { label: "Green Alternatives",           model: "SONNET 4.6",    icon: Leaf,        accent: "#3ecf8e" },
  { label: "Cost Savings",                 model: "SONNET 4.6",    icon: Wallet,      accent: "#f7b955" },
  { label: "Green Judge",                  model: "SONNET 4.6",    icon: ShieldCheck, accent: "#9d72ff" },
  { label: "Cost Judge",                   model: "SONNET 4.6",    icon: ShieldCheck, accent: "#7c66dc" },
  { label: "Credit & Incentive Strategy",  model: "SONNET 4.6",    icon: Coins,       accent: "#3ecf8e" },
  { label: "Executive Report",             model: "SONNET 4.6",    icon: FileText,    accent: "#fafafa" },
];

export type OrbitingCubeProps = {
  /** ms elapsed in the parent scene — drives rotation. */
  elapsedMs: number;
  /** total scene duration */
  durationMs: number;
};

const TILE_W = 280;
const TILE_H = 180;
const RADIUS = 360; // Distance from cube center to face centers (px in CSS 3D space)

export function OrbitingCube({ elapsedMs, durationMs }: OrbitingCubeProps) {
  // Two stacked rings of 4 tiles, slowly rotating opposite directions.
  // Top ring rotates +Y, bottom ring rotates -Y. Full revolution ≈ scene length.
  const baseDeg = (elapsedMs / Math.max(durationMs, 1)) * 90; // 90° over scene = subtle
  const enterT = Math.min(1, elapsedMs / 480); // 480ms scale-in

  const topFaces = FACES.slice(0, 4);
  const bottomFaces = FACES.slice(4);

  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        perspective: 1600,
        perspectiveOrigin: "center center",
        background: "#171717",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          position: "relative",
          width: TILE_W,
          height: TILE_H,
          transformStyle: "preserve-3d",
          transform: `scale(${0.92 + 0.08 * enterT}) rotateX(-12deg) rotateY(${baseDeg}deg)`,
          opacity: enterT,
          transition: "opacity 220ms linear",
          willChange: "transform, opacity",
        }}
      >
        {topFaces.map((face, i) => (
          <CubeTile
            key={face.label}
            face={face}
            angleDeg={i * 90}
            yOffset={-TILE_H * 0.6}
          />
        ))}
        {bottomFaces.map((face, i) => (
          <CubeTile
            key={face.label}
            face={face}
            angleDeg={i * 90 + 45 - baseDeg * 2}
            yOffset={TILE_H * 0.6}
          />
        ))}
      </div>
    </div>
  );
}

function CubeTile({
  face,
  angleDeg,
  yOffset,
}: {
  face: CubeFace;
  angleDeg: number;
  yOffset: number;
}) {
  const Icon = face.icon;
  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        transform: `translateY(${yOffset}px) rotateY(${angleDeg}deg) translateZ(${RADIUS}px)`,
        backfaceVisibility: "hidden",
      }}
    >
      <div
        style={{
          width: "100%",
          height: "100%",
          background: "#1a1a1a",
          border: "1px solid #2e2e2e",
          borderRadius: 12,
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
          boxShadow: "0 12px 32px rgba(0, 0, 0, 0.4)",
        }}
      >
        {/* Mini titlebar */}
        <div
          style={{
            height: 26,
            background: "#222",
            borderBottom: "1px solid #2e2e2e",
            display: "flex",
            alignItems: "center",
            padding: "0 10px",
            gap: 5,
          }}
        >
          <span style={{ width: 7, height: 7, borderRadius: 9999, background: "#ff5f57" }} />
          <span style={{ width: 7, height: 7, borderRadius: 9999, background: "#febc2e" }} />
          <span style={{ width: 7, height: 7, borderRadius: 9999, background: "#28c840" }} />
        </div>
        <div
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            padding: 16,
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
            }}
          >
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: 10,
                background: `${face.accent}1f`,
                color: face.accent,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Icon size={18} strokeWidth={2} />
            </div>
            <div
              style={{
                fontFamily: "var(--font-inter), system-ui, sans-serif",
                fontSize: 14,
                fontWeight: 500,
                color: "#fafafa",
                lineHeight: 1.2,
              }}
            >
              {face.label}
            </div>
          </div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              fontFamily: "var(--font-source-code-pro), ui-monospace, monospace",
              fontSize: 10,
              letterSpacing: "1.2px",
              textTransform: "uppercase",
              color: "#898989",
            }}
          >
            <span
              style={{
                width: 4,
                height: 4,
                borderRadius: 9999,
                background: face.accent,
              }}
            />
            {face.model}
          </div>
        </div>
      </div>
    </div>
  );
}
