"use client";

/**
 * S15C — Public proof page + QR code.
 *
 * "One link. Anyone can verify." Shows a mock of the /proof/[orgId] page:
 * verified badge, business name, green ring with CO₂e, equivalencies
 * (trees, flights, km), reserve + credit stats, chain-verified footer,
 * and a small QR code in the bottom-right — subtle, not gimmicky.
 *
 * Rendered inside a phone-width MacWindow to sell "anyone can open this on
 * their phone." Progress-driven reveals so everything is scrubber-friendly.
 *
 *   ──── beats ─────────────────────────────────────────────────────────
 *   0.00–0.10  Window fades in
 *   0.08–0.22  Verified badge + business name
 *   0.18–0.40  Ring draws + CO₂e counts up
 *   0.35–0.60  Equivalencies stagger in (trees, flights, km)
 *   0.50–0.70  Reserve + credits pills
 *   0.60–0.78  Chain verified bar
 *   0.72–0.88  QR code fades in bottom-right
 *   0.88–1.00  Hold
 */

import type { SceneProps } from "../types";
import { CameraScript } from "../components/CameraScript";
import { MacWindow } from "../components/MacWindow";
import { ShieldCheck, TreePine, Plane, Car, Leaf } from "lucide-react";

const ORG_NAME = "Acme BV";
const CO2E_KG = 1842;
const TREES = 84;
const FLIGHTS = 2.1;
const KM = 7368;
const RESERVE_EUR = 412;
const CREDITS_T = 2.84;
const EVENTS = 12;
const HASH = "a1c4…6ef0…62b9…d471…0099…ace7";

function phase(progress: number, start: number, end: number): number {
  if (end <= start) return progress >= end ? 1 : 0;
  return Math.max(0, Math.min(1, (progress - start) / (end - start)));
}

function easeOut(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}

export default function S15C({ elapsedMs, durationMs, progress }: SceneProps) {
  const badgeP = easeOut(phase(progress, 0.08, 0.22));
  const ringP = easeOut(phase(progress, 0.18, 0.40));
  const equivP = [
    easeOut(phase(progress, 0.35, 0.48)),
    easeOut(phase(progress, 0.40, 0.53)),
    easeOut(phase(progress, 0.45, 0.58)),
  ];
  const statsP = easeOut(phase(progress, 0.50, 0.68));
  const chainP = easeOut(phase(progress, 0.60, 0.76));
  const qrP = easeOut(phase(progress, 0.72, 0.86));

  const ringSize = 160;
  const ringStroke = 6;
  const r = (ringSize - ringStroke) / 2;
  const c = ringSize / 2;
  const circumference = 2 * Math.PI * r;
  const ringDash = circumference * (1 - 0.78 * ringP);
  const co2eDisplay = Math.round(CO2E_KG * ringP);

  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        background: "#ffffff",
        overflow: "hidden",
      }}
    >
      <CameraScript
        keyframes={[
          { at: 0, scale: 0.94, x: 0, y: 12 },
          { at: 0.15, scale: 0.98, x: 0, y: 4 },
          { at: 0.5, scale: 1.0, x: 0, y: 0 },
          { at: 1.0, scale: 1.02, x: 0, y: -4 },
        ]}
        elapsedMs={elapsedMs}
        durationMs={durationMs}
      >
        <MacWindow
          title="carbo.app/proof/acme-bv"
          width={480}
          height={780}
          glass
        >
          <div
            style={{
              height: "100%",
              background: "#171717",
              color: "#fafafa",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              padding: "28px 24px",
              overflow: "hidden",
              fontFamily: "var(--font-inter), system-ui, sans-serif",
            }}
          >
            {/* "PROOF OF GREEN" eyebrow */}
            <span
              style={{
                fontFamily:
                  "var(--font-source-code-pro), ui-monospace, monospace",
                fontSize: 10,
                letterSpacing: "1.6px",
                textTransform: "uppercase",
                color: "#3ecf8e",
                opacity: badgeP,
                transform: `translateY(${(1 - badgeP) * 8}px)`,
                marginBottom: 10,
              }}
            >
              Proof of Green
            </span>

            {/* Verified badge */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                padding: "5px 14px",
                borderRadius: 9999,
                border: "1px solid rgba(62,207,142,0.30)",
                background: "rgba(62,207,142,0.06)",
                fontSize: 12,
                fontWeight: 500,
                color: "#3ecf8e",
                opacity: badgeP,
                transform: `translateY(${(1 - badgeP) * 8}px)`,
              }}
            >
              <ShieldCheck size={13} strokeWidth={2} />
              Verified
            </div>

            {/* Business name */}
            <div
              style={{
                marginTop: 16,
                textAlign: "center",
                opacity: badgeP,
                transform: `translateY(${(1 - badgeP) * 6}px)`,
              }}
            >
              <h2
                style={{
                  fontSize: 28,
                  fontWeight: 400,
                  lineHeight: 1.0,
                  letterSpacing: "-0.02em",
                  margin: 0,
                }}
              >
                {ORG_NAME}
              </h2>
              <span
                style={{
                  fontSize: 11,
                  color: "#898989",
                  marginTop: 6,
                  display: "block",
                }}
              >
                Tracking since Mar 2026 · 2 months closed
              </span>
            </div>

            {/* Ring */}
            <div
              style={{
                position: "relative",
                marginTop: 22,
                width: ringSize,
                height: ringSize,
                opacity: ringP,
                transform: `scale(${0.9 + ringP * 0.1})`,
              }}
            >
              <svg
                width={ringSize}
                height={ringSize}
                viewBox={`0 0 ${ringSize} ${ringSize}`}
              >
                <circle
                  cx={c}
                  cy={c}
                  r={r}
                  fill="none"
                  stroke="#242424"
                  strokeWidth={ringStroke}
                />
                <circle
                  cx={c}
                  cy={c}
                  r={r}
                  fill="none"
                  stroke="#3ecf8e"
                  strokeWidth={ringStroke}
                  strokeLinecap="round"
                  strokeDasharray={circumference}
                  strokeDashoffset={ringDash}
                  transform={`rotate(-90 ${c} ${c})`}
                  style={{ transition: "stroke-dashoffset 80ms linear" }}
                />
              </svg>
              <div
                style={{
                  position: "absolute",
                  inset: 0,
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 2,
                }}
              >
                <Leaf size={16} color="#3ecf8e" />
                <span
                  style={{
                    fontSize: 32,
                    fontWeight: 400,
                    lineHeight: 1.0,
                    fontVariantNumeric: "tabular-nums",
                    letterSpacing: "-0.02em",
                  }}
                >
                  {co2eDisplay >= 1000
                    ? `${(co2eDisplay / 1000).toFixed(1)}`
                    : co2eDisplay}
                  <span style={{ fontSize: 14, marginLeft: 2 }}>
                    {co2eDisplay >= 1000 ? "t" : "kg"}
                  </span>
                </span>
                <span style={{ fontSize: 10, color: "#898989" }}>
                  CO₂e tracked
                </span>
              </div>
            </div>

            {/* Equivalencies */}
            <div
              style={{
                width: "100%",
                display: "flex",
                flexDirection: "column",
                gap: 8,
                marginTop: 18,
              }}
            >
              {[
                {
                  icon: <TreePine size={14} color="#3ecf8e" />,
                  iconBg: "rgba(62,207,142,0.08)",
                  iconBorder: "rgba(62,207,142,0.20)",
                  value: `${Math.round(TREES * equivP[0]!)} trees`,
                  sub: "needed to absorb this for a year",
                  p: equivP[0]!,
                },
                {
                  icon: <Plane size={14} color="#5fb9ff" />,
                  iconBg: "rgba(95,185,255,0.08)",
                  iconBorder: "rgba(95,185,255,0.20)",
                  value: `${(FLIGHTS * equivP[1]!).toFixed(1)} flights`,
                  sub: "Amsterdam → New York equivalent",
                  p: equivP[1]!,
                },
                {
                  icon: <Car size={14} color="#f7b955" />,
                  iconBg: "rgba(247,185,85,0.08)",
                  iconBorder: "rgba(247,185,85,0.20)",
                  value: `${Math.round(KM * equivP[2]!).toLocaleString("en-NL")} km`,
                  sub: "driven by an average car",
                  p: equivP[2]!,
                },
              ].map((eq, i) => (
                <div
                  key={i}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    padding: "8px 12px",
                    borderRadius: 10,
                    border: "1px solid #2e2e2e",
                    opacity: eq.p,
                    transform: `translateY(${(1 - eq.p) * 8}px)`,
                  }}
                >
                  <div
                    style={{
                      width: 28,
                      height: 28,
                      borderRadius: "50%",
                      display: "grid",
                      placeItems: "center",
                      background: eq.iconBg,
                      border: `1px solid ${eq.iconBorder}`,
                      flexShrink: 0,
                    }}
                  >
                    {eq.icon}
                  </div>
                  <div style={{ display: "flex", flexDirection: "column" }}>
                    <span
                      style={{
                        fontSize: 13,
                        fontVariantNumeric: "tabular-nums",
                      }}
                    >
                      {eq.value}
                    </span>
                    <span style={{ fontSize: 10, color: "#898989" }}>
                      {eq.sub}
                    </span>
                  </div>
                </div>
              ))}
            </div>

            {/* Savings callout */}
            <div
              style={{
                width: "100%",
                marginTop: 14,
                borderRadius: 10,
                padding: "10px 14px",
                border: "1px solid rgba(62,207,142,0.20)",
                background: "rgba(62,207,142,0.04)",
                display: "flex",
                alignItems: "center",
                gap: 10,
                opacity: statsP,
                transform: `translateY(${(1 - statsP) * 8}px)`,
              }}
            >
              <span
                style={{
                  fontSize: 18,
                  fontVariantNumeric: "tabular-nums",
                  color: "#3ecf8e",
                  lineHeight: 1,
                  fontWeight: 400,
                }}
              >
                {"€"}
                {Math.round(8924 * statsP).toLocaleString("en-NL")}
              </span>
              <span style={{ fontSize: 10, color: "#b4b4b4", lineHeight: 1.3 }}>
                saved by reducing emissions at source — fewer credits needed
              </span>
            </div>

            {/* Reserve + credits pills */}
            <div
              style={{
                width: "100%",
                display: "flex",
                gap: 10,
                marginTop: 10,
                opacity: statsP,
                transform: `translateY(${(1 - statsP) * 8}px)`,
              }}
            >
              <div
                style={{
                  flex: 1,
                  borderRadius: 10,
                  padding: "12px 0",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: 4,
                  border: "1px solid #2e2e2e",
                }}
              >
                <span
                  style={{
                    fontSize: 18,
                    fontVariantNumeric: "tabular-nums",
                    lineHeight: 1,
                  }}
                >
                  {"€"}{Math.round(RESERVE_EUR * statsP)}
                </span>
                <span
                  style={{
                    fontSize: 9,
                    letterSpacing: "1px",
                    textTransform: "uppercase",
                    color: "#898989",
                    fontFamily:
                      "var(--font-source-code-pro), ui-monospace, monospace",
                  }}
                >
                  Reserved
                </span>
              </div>
              <div
                style={{
                  flex: 1,
                  borderRadius: 10,
                  padding: "12px 0",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: 4,
                  border: "1px solid rgba(62,207,142,0.30)",
                }}
              >
                <span
                  style={{
                    fontSize: 18,
                    fontVariantNumeric: "tabular-nums",
                    lineHeight: 1,
                    color: "#3ecf8e",
                  }}
                >
                  {(CREDITS_T * statsP).toFixed(1)}t
                </span>
                <span
                  style={{
                    fontSize: 9,
                    letterSpacing: "1px",
                    textTransform: "uppercase",
                    color: "#898989",
                    fontFamily:
                      "var(--font-source-code-pro), ui-monospace, monospace",
                  }}
                >
                  Offset
                </span>
              </div>
            </div>

            {/* Chain verified bar */}
            <div
              style={{
                width: "100%",
                marginTop: 16,
                borderRadius: 10,
                padding: "10px 14px",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                border: "1px solid #2e2e2e",
                opacity: chainP,
                transform: `translateY(${(1 - chainP) * 6}px)`,
              }}
            >
              <div
                style={{ display: "flex", alignItems: "center", gap: 8 }}
              >
                <div
                  style={{
                    width: 22,
                    height: 22,
                    borderRadius: "50%",
                    display: "grid",
                    placeItems: "center",
                    border: "1px solid rgba(62,207,142,0.20)",
                    background: "rgba(62,207,142,0.06)",
                  }}
                >
                  <ShieldCheck size={11} color="#3ecf8e" strokeWidth={2} />
                </div>
                <div style={{ display: "flex", flexDirection: "column" }}>
                  <span style={{ fontSize: 11 }}>Tamper-proof</span>
                  <span style={{ fontSize: 9, color: "#898989" }}>
                    {EVENTS} events cryptographically chained
                  </span>
                </div>
              </div>
              <span
                style={{
                  fontSize: 10,
                  letterSpacing: "1px",
                  textTransform: "uppercase",
                  color: "#3ecf8e",
                  fontFamily:
                    "var(--font-source-code-pro), ui-monospace, monospace",
                  fontVariantNumeric: "tabular-nums",
                }}
              >
                Intact
              </span>
            </div>

            {/* Hash + powered by */}
            <div
              style={{
                marginTop: 14,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 6,
                opacity: chainP * 0.7,
              }}
            >
              <span
                style={{
                  fontSize: 8,
                  fontFamily:
                    "var(--font-source-code-pro), ui-monospace, monospace",
                  fontVariantNumeric: "tabular-nums",
                  color: "#4d4d4d",
                  textAlign: "center",
                  maxWidth: 280,
                  wordBreak: "break-all",
                  lineHeight: 1.8,
                }}
              >
                {HASH}
              </span>
              <span style={{ fontSize: 9, color: "#4d4d4d" }}>
                Verified by Carbo for bunq Business
              </span>
            </div>
          </div>
        </MacWindow>

        {/* QR code — small, bottom-right of the scene, not inside the window */}
        <div
          style={{
            position: "absolute",
            bottom: 60,
            right: 80,
            opacity: qrP,
            transform: `translateY(${(1 - qrP) * 12}px) scale(${0.95 + qrP * 0.05})`,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 8,
          }}
        >
          <QRCodeSVG size={88} />
          <span
            style={{
              fontFamily:
                "var(--font-source-code-pro), ui-monospace, monospace",
              fontSize: 9,
              letterSpacing: "1.2px",
              textTransform: "uppercase",
              color: "#6e6e6e",
            }}
          >
            Scan to verify
          </span>
        </div>
      </CameraScript>
    </div>
  );
}

/**
 * Minimal deterministic QR-code-shaped SVG. Not a real QR — just a
 * plausible pattern for visual purposes. Keeps the demo self-contained
 * without a QR library dependency.
 */
function QRCodeSVG({ size }: { size: number }) {
  const grid = 21;
  const cell = size / grid;

  // Finder patterns (3 corners) + some deterministic data modules.
  const filled = new Set<string>();

  // Top-left finder
  for (let r = 0; r < 7; r++)
    for (let c = 0; c < 7; c++)
      if (
        r === 0 || r === 6 || c === 0 || c === 6 ||
        (r >= 2 && r <= 4 && c >= 2 && c <= 4)
      )
        filled.add(`${r},${c}`);

  // Top-right finder
  for (let r = 0; r < 7; r++)
    for (let c = 14; c < 21; c++)
      if (
        r === 0 || r === 6 || c === 14 || c === 20 ||
        (r >= 2 && r <= 4 && c >= 16 && c <= 18)
      )
        filled.add(`${r},${c}`);

  // Bottom-left finder
  for (let r = 14; r < 21; r++)
    for (let c = 0; c < 7; c++)
      if (
        r === 14 || r === 20 || c === 0 || c === 6 ||
        (r >= 16 && r <= 18 && c >= 2 && c <= 4)
      )
        filled.add(`${r},${c}`);

  // Timing patterns
  for (let i = 7; i < 14; i++) {
    if (i % 2 === 0) {
      filled.add(`6,${i}`);
      filled.add(`${i},6`);
    }
  }

  // Deterministic data fill (seeded from a simple hash pattern)
  const dataPositions = [
    [8,8],[8,10],[8,12],[9,9],[9,11],[9,13],[10,8],[10,10],[10,14],
    [11,9],[11,11],[11,13],[12,8],[12,12],[12,14],[13,9],[13,11],
    [14,8],[14,10],[14,12],[14,14],[15,9],[15,13],[16,10],[16,12],
    [17,11],[17,13],[18,8],[18,10],[18,14],[19,9],[19,11],[19,13],
    [8,15],[9,16],[10,15],[10,17],[11,16],[12,15],[13,17],
    [8,19],[9,18],[10,19],[11,18],[12,19],[13,18],
  ];
  for (const [r, c] of dataPositions) filled.add(`${r},${c}`);

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      style={{
        borderRadius: 6,
        background: "#ffffff",
        padding: 4,
        boxSizing: "content-box",
      }}
    >
      {Array.from(filled).map((key) => {
        const [r, c] = key.split(",").map(Number);
        return (
          <rect
            key={key}
            x={c! * cell}
            y={r! * cell}
            width={cell}
            height={cell}
            fill="#0a0a0a"
            rx={cell * 0.15}
          />
        );
      })}
    </svg>
  );
}
