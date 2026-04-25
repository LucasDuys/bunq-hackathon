"use client";

/**
 * S13B — Impact workspace · savings & emissions calculus.
 *
 * Lives between S13 (alternatives matrix abstraction) and S13C (CFO compliance
 * briefing). This is THE savings moment of the launch video — the screen that
 * pairs the calculated CO₂e upside with the EUR upside in one frame.
 *
 * Layout mirrors the Carbo Impacts workspace screenshot:
 *   - Eyebrow + title row + tax-advisor pill, "View as: CO₂e / €" toggle.
 *   - Hero: 18.49 tCO₂e (huge, brand-green, count-up from 0 over 1.0s).
 *     Right of the hero: a 2x2 KPI grid (CO₂e reducible, direct savings,
 *     avoided credits, jurisdiction).
 *   - Tabs row (Overview / Trade-off matrix 12 / Switches 9 / Research 20).
 *   - Scenario planner card: slider (0..9) animates 0 → 5 between scene
 *     progress 0.4 → 0.7. Three projection tiles (Δ cost, Δ CO₂e + confidence,
 *     evidence coverage) count-up to their tier values.
 *   - Top recommendations: two rows fade+slide in with 100ms stagger from
 *     progress 0.7 → 1.0.
 *
 * Camera: gentle wide-to-tight push capped at scale 1.06 — explicit fix for
 * S11's blurred 1.28 zoom complaint. Scenario planner stays crisp.
 */

import type { SceneProps } from "../types";
import { MacWindow } from "../components/MacWindow";
import { CameraScript } from "../components/CameraScript";
import { LaunchSidebar } from "../components/real/LaunchSidebar";
import { CountUpNumber } from "../components/CountUpNumber";

// ── Fixture data (matches the screenshot the user provided) ────────────────
type Switch = {
  rank: number;
  baseline: string;
  alternative: string;
  costDeltaEur: number; // negative = saving
  co2eDeltaT: number; // negative = reduction
  sources: number;
};

const SWITCHES: Switch[] = [
  {
    rank: 1,
    baseline: "Coolblue",
    alternative: "Refurbished laptops from Leapp / Back Market",
    costDeltaEur: -8303,
    co2eDeltaT: -6.52,
    sources: 2,
  },
  {
    rank: 2,
    baseline: "KLM",
    alternative: "Rail for routes under 700 km",
    costDeltaEur: 330,
    co2eDeltaT: -3.65,
    sources: 2,
  },
];

const SCENARIO_PROJECTION = {
  costEur: -8924, // net saving
  co2eT: -15.68,
  confidence: 0.85,
  evidenceCovered: 5,
  evidenceTotal: 5,
};

const HERO_TCO2E = 18.49;
const HERO_NET_SAVINGS_EUR = 2182;
const HERO_AVOIDED_CREDITS_EUR = 703;
const TARGET_SLIDER = 5;
const SLIDER_TOTAL = 9;

// ── Helpers ─────────────────────────────────────────────────────────────────
function clamp01(t: number): number {
  return Math.max(0, Math.min(1, t));
}
function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}
function fmtSignedEurInline(eur: number): string {
  const abs = Math.abs(Math.round(eur));
  const formatted = abs.toLocaleString("en-NL");
  if (eur < 0) return `−€${formatted}`;
  if (eur > 0) return `+€${formatted}`;
  return `€${formatted}`;
}
function fmtSignedTco2e(t: number, decimals = 2): string {
  const abs = Math.abs(t).toFixed(decimals);
  if (t < 0) return `−${abs} tCO₂e`;
  if (t > 0) return `+${abs} tCO₂e`;
  return `${abs} tCO₂e`;
}

// ── Scene component ─────────────────────────────────────────────────────────
export default function S13B({ elapsedMs, durationMs, progress }: SceneProps) {
  // Hero count-up restart key — fire once at scene mount, lasts ~1.0s.
  const heroRestartKey = "s13b-hero";

  // Slider progress (0..1) maps scene 0.4..0.7 → 0..1.
  const sliderLocal = clamp01((progress - 0.4) / 0.3);
  const sliderEased = easeOutCubic(sliderLocal);
  const sliderValue = sliderEased * TARGET_SLIDER;
  const sliderLanded = sliderLocal >= 1;
  // Restart key ticks when slider lands so the projection tiles count-up cleanly.
  const projectionRestartKey = sliderLanded ? "lock" : "pre";

  // KPI cards fade-in: progress 0.15 → 0.4.
  const kpiOpacity = clamp01((progress - 0.15) / 0.25);

  // Top recommendations: progress 0.7 → 1.0 with 100ms stagger.
  const recsBase = clamp01((progress - 0.7) / 0.3);
  const sceneSecs = durationMs / 1000;
  const staggerSecs = 0.1;
  const recOpacity = (idx: number) => {
    const startProgress = (idx * staggerSecs) / sceneSecs / 0.3;
    return clamp01((recsBase - startProgress) / 0.4);
  };

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
          { at: 0, scale: 0.92, x: 0, y: 30 },
          { at: 0.25, scale: 1.0, x: 0, y: 0 },
          { at: 0.7, scale: 1.04, x: 0, y: -28 },
          { at: 1.0, scale: 1.06, x: 0, y: -40 },
        ]}
        elapsedMs={elapsedMs}
        durationMs={durationMs}
      >
        <MacWindow
          title="Carbo — Impacts"
          showSidebar
          width={1480}
          height={900}
          glass
        >
          <div style={{ display: "flex", height: "100%" }}>
            <LaunchSidebar activeKey="impacts" />
            <div style={{ flex: 1, minWidth: 0, overflow: "hidden" }}>
              <ImpactWorkspaceBody
                heroRestartKey={heroRestartKey}
                kpiOpacity={kpiOpacity}
                sliderValue={sliderValue}
                sliderLanded={sliderLanded}
                projectionRestartKey={projectionRestartKey}
                recOpacity={recOpacity}
              />
            </div>
          </div>
        </MacWindow>
      </CameraScript>

      {/* Honour reduced motion globally for this scene. */}
      <style jsx global>{`
        @media (prefers-reduced-motion: reduce) {
          .ca-s13b * {
            animation: none !important;
            transition: none !important;
          }
        }
      `}</style>
    </div>
  );
}

// ── Body ────────────────────────────────────────────────────────────────────
type BodyProps = {
  heroRestartKey: string;
  kpiOpacity: number;
  sliderValue: number;
  sliderLanded: boolean;
  projectionRestartKey: string;
  recOpacity: (idx: number) => number;
};

function ImpactWorkspaceBody({
  heroRestartKey,
  kpiOpacity,
  sliderValue,
  sliderLanded,
  projectionRestartKey,
  recOpacity,
}: BodyProps) {
  return (
    <div
      className="ca-s13b"
      style={{
        width: "100%",
        height: "100%",
        background: "var(--bg-canvas)",
        overflow: "hidden",
        fontFamily: "var(--font-inter), system-ui, sans-serif",
        color: "var(--fg-primary)",
      }}
    >
      <div
        style={{
          maxWidth: 1200,
          margin: "0 auto",
          padding: "28px 32px 32px 32px",
          display: "flex",
          flexDirection: "column",
          gap: 24,
        }}
      >
        <Header />
        <BriefingRow />
        <HeroRow heroRestartKey={heroRestartKey} kpiOpacity={kpiOpacity} />
        <TabsRow />
        <ScenarioPlanner
          sliderValue={sliderValue}
          sliderLanded={sliderLanded}
          projectionRestartKey={projectionRestartKey}
        />
        <RecommendationsList recOpacity={recOpacity} />
      </div>
    </div>
  );
}

// ── Header / eyebrow + title ────────────────────────────────────────────────
function Header() {
  return (
    <div>
      <CodeEyebrow>IMPACT WORKSPACE</CodeEyebrow>
      <h1
        style={{
          fontSize: 36,
          fontWeight: 400,
          lineHeight: 1.1,
          letterSpacing: "-0.015em",
          color: "var(--fg-primary)",
          margin: "8px 0 0 0",
        }}
      >
        Impact workspace
      </h1>
      <p
        style={{
          fontSize: 14,
          color: "var(--fg-secondary)",
          marginTop: 8,
          maxWidth: "70ch",
          lineHeight: 1.5,
        }}
      >
        Where swapping a vendor or policy cuts the most CO₂e per euro across
        your tracked spend.
      </p>
    </div>
  );
}

// ── Briefing row + view-as toggle ───────────────────────────────────────────
function BriefingRow() {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 16,
        flexWrap: "wrap",
        paddingBottom: 12,
        borderBottom: "1px solid var(--border-faint)",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <CodeEyebrow>CARBON CFO BRIEFING · 2026-03 · NL · ESRS E1</CodeEyebrow>
        <span
          style={{
            display: "inline-flex",
            alignItems: "center",
            fontSize: 11,
            fontFamily:
              "var(--font-source-code-pro), ui-monospace, monospace",
            color: "var(--brand-green-link)",
            padding: "2px 10px",
            border: "1px solid var(--brand-green-border)",
            borderRadius: 9999,
            background: "transparent",
            letterSpacing: "0.04em",
            textTransform: "uppercase",
          }}
        >
          Tax advisor review
        </span>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <CodeEyebrow>VIEW AS</CodeEyebrow>
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            background: "var(--bg-inset)",
            border: "1px solid var(--border-default)",
            borderRadius: 9999,
            padding: 2,
            gap: 2,
          }}
        >
          <ToggleChip active>CO₂e</ToggleChip>
          <ToggleChip>€</ToggleChip>
        </div>
      </div>
    </div>
  );
}

function ToggleChip({
  children,
  active,
}: {
  children: React.ReactNode;
  active?: boolean;
}) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        height: 26,
        padding: "0 12px",
        borderRadius: 9999,
        fontSize: 12,
        fontWeight: 500,
        color: active ? "var(--fg-primary)" : "var(--fg-muted)",
        background: active ? "var(--bg-button)" : "transparent",
        border: active
          ? "1px solid var(--border-default)"
          : "1px solid transparent",
        fontVariantNumeric: "tabular-nums",
      }}
    >
      {active ? (
        <span
          aria-hidden="true"
          style={{
            display: "inline-block",
            width: 6,
            height: 6,
            borderRadius: "50%",
            background: "var(--brand-green)",
          }}
        />
      ) : null}
      {children}
    </span>
  );
}

// ── Hero (giant 18.49 tCO₂e + KPI grid) ─────────────────────────────────────
function HeroRow({
  heroRestartKey,
  kpiOpacity,
}: {
  heroRestartKey: string;
  kpiOpacity: number;
}) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "minmax(0, 1.4fr) minmax(0, 1fr)",
        gap: 32,
        alignItems: "stretch",
      }}
    >
      {/* Hero */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 14,
          minWidth: 0,
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "baseline",
            gap: 12,
            flexWrap: "wrap",
            color: "var(--brand-green)",
            fontFamily: "var(--font-inter), system-ui, sans-serif",
          }}
        >
          <span
            style={{
              fontSize: 96,
              fontWeight: 400,
              lineHeight: 1.0,
              letterSpacing: "-0.02em",
              fontVariantNumeric: "tabular-nums",
            }}
          >
            <CountUpNumber
              value={HERO_TCO2E}
              decimals={2}
              durationMs={1000}
              restartKey={heroRestartKey}
            />
          </span>
          <span
            style={{
              fontSize: 32,
              fontWeight: 400,
              lineHeight: 1.0,
              letterSpacing: "-0.01em",
            }}
          >
            tCO₂e
          </span>
        </div>

        <div>
          <CodeEyebrow>AVOIDABLE / YR</CodeEyebrow>
          <p
            style={{
              fontSize: 13,
              color: "var(--fg-secondary)",
              margin: "6px 0 0 0",
            }}
          >
            across surfaced switches
          </p>
        </div>

        <p
          style={{
            fontSize: 14,
            color: "var(--fg-secondary)",
            lineHeight: 1.55,
            margin: 0,
            maxWidth: "60ch",
          }}
        >
          For 2026-03, Carbo validated 9 switches worth{" "}
          <span
            style={{
              color: "var(--fg-primary)",
              fontVariantNumeric: "tabular-nums",
            }}
          >
            €2,182
          </span>
          /yr in net financial impact and{" "}
          <span
            style={{
              color: "var(--fg-primary)",
              fontVariantNumeric: "tabular-nums",
            }}
          >
            18.49 tCO₂e
          </span>
          /yr reduction. Review the top recommendations with the CFO before
          executing.
        </p>

        <div style={{ marginTop: 4 }}>
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              height: 32,
              padding: "0 16px",
              borderRadius: 9999,
              border: "1px solid var(--border-default)",
              background: "var(--bg-button)",
              color: "var(--fg-primary)",
              fontSize: 13,
              fontWeight: 500,
            }}
          >
            Refresh research
          </span>
        </div>
      </div>

      {/* KPI grid */}
      <div
        style={{
          opacity: kpiOpacity,
          transform: `translateY(${(1 - kpiOpacity) * 8}px)`,
          transition: "opacity 200ms ease-out, transform 200ms ease-out",
          display: "grid",
          gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
          gap: 12,
          alignContent: "center",
        }}
      >
        <KpiCard
          label="CO₂E REDUCIBLE"
          value={`${HERO_TCO2E.toFixed(2)}`}
          unit="tCO₂e"
          tone="positive"
        />
        <KpiCard
          label="DIRECT SAVINGS"
          value={`€${HERO_NET_SAVINGS_EUR.toLocaleString("en-NL")}`}
          unit="net / yr"
        />
        <KpiCard
          label="AVOIDED CREDITS"
          value={`+€${HERO_AVOIDED_CREDITS_EUR}`}
          unit="EU credit / yr"
          tone="positive"
        />
        <KpiCard
          label="TAX SCHEMES"
          value="EIA · MIA · VAMIL"
          unit="Dutch green-investment deductions"
        />
      </div>
    </div>
  );
}

function KpiCard({
  label,
  value,
  unit,
  tone,
}: {
  label: string;
  value: string;
  unit?: string;
  tone?: "positive";
}) {
  return (
    <div
      style={{
        background: "var(--bg-canvas)",
        border: "1px solid var(--border-default)",
        borderRadius: 12,
        padding: "14px 16px",
        display: "flex",
        flexDirection: "column",
        gap: 6,
        minWidth: 0,
      }}
    >
      <CodeEyebrow>{label}</CodeEyebrow>
      <span
        style={{
          fontSize: 22,
          fontWeight: 400,
          lineHeight: 1.1,
          letterSpacing: "-0.005em",
          color:
            tone === "positive" ? "var(--brand-green)" : "var(--fg-primary)",
          fontVariantNumeric: "tabular-nums",
        }}
      >
        {value}
      </span>
      {unit ? (
        <span
          style={{
            fontSize: 12,
            color: "var(--fg-muted)",
          }}
        >
          {unit}
        </span>
      ) : null}
    </div>
  );
}

// ── Tabs ────────────────────────────────────────────────────────────────────
function TabsRow() {
  const TABS: Array<{ label: string; count?: number; active?: boolean }> = [
    { label: "Overview", active: true },
    { label: "Trade-off matrix", count: 12 },
    { label: "Switches", count: 9 },
    { label: "Research", count: 20 },
  ];
  return (
    <div
      role="tablist"
      style={{
        display: "flex",
        alignItems: "center",
        gap: 4,
        borderBottom: "1px solid var(--border-faint)",
        paddingBottom: 0,
      }}
    >
      {TABS.map((t) => (
        <div
          key={t.label}
          role="tab"
          aria-selected={!!t.active}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            height: 36,
            padding: "0 14px",
            fontSize: 13,
            fontWeight: 500,
            color: t.active ? "var(--fg-primary)" : "var(--fg-muted)",
            position: "relative",
          }}
        >
          {t.label}
          {t.count !== undefined ? (
            <span
              style={{
                fontSize: 11,
                fontFamily:
                  "var(--font-source-code-pro), ui-monospace, monospace",
                color: t.active ? "var(--brand-green-link)" : "var(--fg-faint)",
                fontVariantNumeric: "tabular-nums",
              }}
            >
              {t.count}
            </span>
          ) : null}
          {t.active ? (
            <span
              aria-hidden="true"
              style={{
                position: "absolute",
                left: 8,
                right: 8,
                bottom: -1,
                height: 2,
                background: "var(--brand-green)",
                borderRadius: 1,
              }}
            />
          ) : null}
        </div>
      ))}
    </div>
  );
}

// ── Scenario planner ────────────────────────────────────────────────────────
function ScenarioPlanner({
  sliderValue,
  sliderLanded,
  projectionRestartKey,
}: {
  sliderValue: number;
  sliderLanded: boolean;
  projectionRestartKey: string;
}) {
  const sliderInt = Math.round(sliderValue);
  const sliderPct = (sliderValue / SLIDER_TOTAL) * 100;

  // Tile values: while slider moves, show a soft proportional preview;
  // when it lands, count-up to the exact projection numbers.
  const ratio = sliderValue / TARGET_SLIDER;
  const liveCost = SCENARIO_PROJECTION.costEur * ratio;
  const liveCo2 = SCENARIO_PROJECTION.co2eT * ratio;
  const liveCovered = Math.min(
    SCENARIO_PROJECTION.evidenceTotal,
    Math.round(SCENARIO_PROJECTION.evidenceCovered * ratio),
  );

  return (
    <div
      style={{
        background: "var(--bg-canvas)",
        border: "1px solid var(--border-default)",
        borderRadius: 12,
        padding: "20px 22px",
        display: "flex",
        flexDirection: "column",
        gap: 18,
      }}
    >
      {/* Title block */}
      <div>
        <h2
          style={{
            fontSize: 18,
            fontWeight: 400,
            margin: 0,
            letterSpacing: "-0.005em",
            color: "var(--fg-primary)",
          }}
        >
          Scenario planner
        </h2>
        <p
          style={{
            fontSize: 13,
            color: "var(--fg-secondary)",
            margin: "4px 0 0 0",
            lineHeight: 1.5,
          }}
        >
          If we adopt the top N switches (one per merchant), here is the
          projected annual impact.
        </p>
      </div>

      {/* Slider row */}
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <CodeEyebrow>SWITCHES ADOPTED</CodeEyebrow>
          <span
            style={{
              fontSize: 13,
              fontWeight: 500,
              fontVariantNumeric: "tabular-nums",
              color: "var(--fg-primary)",
            }}
          >
            {sliderInt}{" "}
            <span style={{ color: "var(--fg-muted)" }}>/ {SLIDER_TOTAL}</span>
          </span>
        </div>

        <div
          role="slider"
          aria-valuemin={0}
          aria-valuemax={SLIDER_TOTAL}
          aria-valuenow={sliderInt}
          aria-label="Switches adopted"
          style={{
            position: "relative",
            height: 6,
            background: "var(--bg-inset)",
            borderRadius: 9999,
          }}
        >
          {/* Filled portion */}
          <div
            style={{
              position: "absolute",
              left: 0,
              top: 0,
              bottom: 0,
              width: `${sliderPct}%`,
              background: "var(--brand-green)",
              borderRadius: 9999,
              transition: "width 80ms linear",
            }}
          />
          {/* Tick marks */}
          {Array.from({ length: SLIDER_TOTAL + 1 }).map((_, i) => (
            <span
              key={i}
              aria-hidden="true"
              style={{
                position: "absolute",
                left: `${(i / SLIDER_TOTAL) * 100}%`,
                top: "50%",
                width: 2,
                height: 2,
                background: "var(--border-strong)",
                borderRadius: "50%",
                transform: "translate(-50%, -50%)",
              }}
            />
          ))}
          {/* Thumb */}
          <span
            aria-hidden="true"
            style={{
              position: "absolute",
              left: `${sliderPct}%`,
              top: "50%",
              width: 16,
              height: 16,
              background: "var(--bg-canvas)",
              border: "2px solid var(--brand-green)",
              borderRadius: "50%",
              transform: "translate(-50%, -50%)",
              transition: "left 80ms linear",
            }}
          />
        </div>
      </div>

      {/* Projection tiles — three columns */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
          gap: 12,
          paddingTop: 4,
        }}
      >
        <ProjectionTile
          label="PROJECTED Δ COST / YR"
          mainEl={
            sliderLanded ? (
              <CountUpNumber
                value={Math.abs(SCENARIO_PROJECTION.costEur)}
                decimals={0}
                prefix="−€"
                durationMs={500}
                restartKey={projectionRestartKey}
              />
            ) : (
              <span>{fmtSignedEurInline(liveCost)}</span>
            )
          }
          sub="net saving"
          tone="positive"
        />

        <ProjectionTile
          label="PROJECTED Δ CO₂E / YR"
          mainEl={
            sliderLanded ? (
              <CountUpNumber
                value={Math.abs(SCENARIO_PROJECTION.co2eT)}
                decimals={2}
                prefix="−"
                suffix=" tCO₂e"
                durationMs={500}
                restartKey={projectionRestartKey}
              />
            ) : (
              <span>{fmtSignedTco2e(liveCo2)}</span>
            )
          }
          sub={
            <div style={{ width: "100%" }}>
              <MiniConfidence value={SCENARIO_PROJECTION.confidence} />
            </div>
          }
          tone="positive"
        />

        <ProjectionTile
          label="EVIDENCE COVERAGE"
          mainEl={
            <span style={{ fontVariantNumeric: "tabular-nums" }}>
              {sliderLanded
                ? `${SCENARIO_PROJECTION.evidenceCovered}/${SCENARIO_PROJECTION.evidenceTotal}`
                : `${liveCovered}/${SCENARIO_PROJECTION.evidenceTotal}`}
            </span>
          }
          sub="every switch has ≥1 source"
        />
      </div>
    </div>
  );
}

function ProjectionTile({
  label,
  mainEl,
  sub,
  tone,
}: {
  label: string;
  mainEl: React.ReactNode;
  sub: React.ReactNode;
  tone?: "positive";
}) {
  return (
    <div
      style={{
        background: "var(--bg-button)",
        border: "1px solid var(--border-default)",
        borderRadius: 10,
        padding: "14px 14px 12px 14px",
        display: "flex",
        flexDirection: "column",
        gap: 8,
        minHeight: 96,
      }}
    >
      <CodeEyebrow>{label}</CodeEyebrow>
      <span
        style={{
          fontSize: 26,
          fontWeight: 400,
          lineHeight: 1.05,
          letterSpacing: "-0.01em",
          color:
            tone === "positive" ? "var(--brand-green)" : "var(--fg-primary)",
          fontVariantNumeric: "tabular-nums",
        }}
      >
        {mainEl}
      </span>
      <div
        style={{
          fontSize: 12,
          color: "var(--fg-muted)",
        }}
      >
        {sub}
      </div>
    </div>
  );
}

// Compact ConfidenceBar tuned for the projection tile (label + bar + %).
function MiniConfidence({ value }: { value: number }) {
  const pct = Math.max(0, Math.min(100, Math.round(value * 100)));
  const tone =
    value >= 0.85
      ? "var(--confidence-high)"
      : value >= 0.6
        ? "var(--confidence-medium)"
        : "var(--confidence-low)";
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <span
          style={{
            fontFamily: "var(--font-source-code-pro), ui-monospace, monospace",
            fontSize: 10,
            letterSpacing: "1.2px",
            textTransform: "uppercase",
            color: "var(--fg-muted)",
          }}
        >
          Confidence
        </span>
        <span
          style={{
            fontSize: 11,
            fontWeight: 500,
            fontVariantNumeric: "tabular-nums",
            color: "var(--fg-secondary)",
          }}
        >
          {pct}%
        </span>
      </div>
      <div
        role="progressbar"
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
        style={{
          height: 4,
          width: "100%",
          background: "var(--bg-inset)",
          borderRadius: 9999,
          overflow: "hidden",
        }}
      >
        <div
          style={{
            width: `${pct}%`,
            height: "100%",
            background: tone,
            transition: "width 500ms ease-out",
          }}
        />
      </div>
    </div>
  );
}

// ── Top recommendations ─────────────────────────────────────────────────────
function RecommendationsList({
  recOpacity,
}: {
  recOpacity: (idx: number) => number;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <CodeEyebrow>TOP RECOMMENDATIONS</CodeEyebrow>
        <CodeEyebrow>RANKED BY € · CO₂e</CodeEyebrow>
      </div>
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 8,
        }}
      >
        {SWITCHES.map((s, idx) => (
          <RecommendationRow
            key={s.rank}
            data={s}
            opacity={recOpacity(idx)}
          />
        ))}
      </div>
    </div>
  );
}

function RecommendationRow({
  data,
  opacity,
}: {
  data: Switch;
  opacity: number;
}) {
  const costNegative = data.costDeltaEur < 0;
  const co2Negative = data.co2eDeltaT < 0;
  const costColor = costNegative
    ? "var(--status-success)"
    : data.costDeltaEur > 0
      ? "var(--status-warning)"
      : "var(--fg-muted)";
  const co2Color = co2Negative
    ? "var(--status-success)"
    : "var(--status-warning)";

  return (
    <div
      style={{
        background: "var(--bg-canvas)",
        border: "1px solid var(--border-default)",
        borderRadius: 12,
        padding: "14px 16px",
        display: "grid",
        gridTemplateColumns: "32px minmax(0, 1fr) 130px 130px 90px",
        alignItems: "center",
        gap: 18,
        opacity,
        transform: `translateY(${(1 - opacity) * 6}px)`,
        transition: "opacity 220ms ease-out, transform 220ms ease-out",
      }}
    >
      {/* Rank */}
      <span
        style={{
          fontFamily: "var(--font-source-code-pro), ui-monospace, monospace",
          fontSize: 12,
          color: "var(--fg-muted)",
          letterSpacing: "1.2px",
          fontVariantNumeric: "tabular-nums",
        }}
      >
        #{data.rank}
      </span>

      {/* Description */}
      <div style={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
        <span
          style={{
            fontSize: 14,
            fontWeight: 500,
            color: "var(--fg-primary)",
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {data.alternative}
        </span>
        <span
          style={{
            fontSize: 12,
            color: "var(--fg-muted)",
            marginTop: 2,
          }}
        >
          replacing {data.baseline}
        </span>
      </div>

      {/* Cost delta */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "flex-end",
          gap: 2,
        }}
      >
        <CodeEyebrow>COST / YR</CodeEyebrow>
        <span
          style={{
            fontSize: 14,
            fontWeight: 500,
            color: costColor,
            fontVariantNumeric: "tabular-nums",
          }}
        >
          {fmtSignedEurInline(data.costDeltaEur)}
        </span>
      </div>

      {/* CO₂e delta + tiny confidence dot */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "flex-end",
          gap: 2,
        }}
      >
        <CodeEyebrow>CO₂E / YR</CodeEyebrow>
        <span
          style={{
            fontSize: 14,
            fontWeight: 500,
            color: co2Color,
            fontVariantNumeric: "tabular-nums",
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
          }}
        >
          {fmtSignedTco2e(data.co2eDeltaT, 2)}
          <span
            aria-hidden="true"
            title="High confidence"
            style={{
              display: "inline-block",
              width: 6,
              height: 6,
              borderRadius: "50%",
              background: "var(--confidence-high)",
            }}
          />
        </span>
      </div>

      {/* Sources pill */}
      <div style={{ display: "flex", justifyContent: "flex-end" }}>
        <span
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            fontSize: 11,
            fontFamily:
              "var(--font-source-code-pro), ui-monospace, monospace",
            color: "var(--brand-green-link)",
            padding: "2px 10px",
            border: "1px solid var(--brand-green-border)",
            borderRadius: 9999,
            background: "transparent",
            letterSpacing: "0.04em",
            textTransform: "uppercase",
            fontVariantNumeric: "tabular-nums",
          }}
        >
          {data.sources} src
        </span>
      </div>
    </div>
  );
}

// ── Local code-eyebrow primitive — Source Code Pro 12px uppercase 1.2px. ───
function CodeEyebrow({ children }: { children: React.ReactNode }) {
  return (
    <span
      style={{
        fontFamily: "var(--font-source-code-pro), ui-monospace, monospace",
        fontSize: 12,
        letterSpacing: "1.2px",
        textTransform: "uppercase",
        color: "var(--fg-muted)",
      }}
    >
      {children}
    </span>
  );
}
