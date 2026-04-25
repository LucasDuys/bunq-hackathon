"use client";

/**
 * LaunchDashboard — static visual clone of the Carbo dashboard (app/page.tsx).
 *
 * Mirrors the page's vertical composition: header eyebrow + headline,
 * SectionDivider, 4-up KPI row (Stat + ConfidenceBar inside Card+CardBody),
 * SectionDivider, 2-up secondary row (emissions-by-category bars +
 * recent activity feed). Pure static fixture data; no DB.
 */
import {
  Card,
  CardBody,
  CodeLabel,
  ConfidenceBar,
  PulseDot,
  SectionDivider,
  Stat,
} from "@/components/ui";

type CatRow = { label: string; pct: number; color: string };
const CATEGORY_BARS: CatRow[] = [
  { label: "Travel", pct: 36, color: "var(--cat-travel)" },
  { label: "Procurement", pct: 29, color: "var(--cat-services)" },
  { label: "Food", pct: 18, color: "var(--cat-goods)" },
  { label: "Energy", pct: 12, color: "var(--cat-electricity)" },
  { label: "Other", pct: 5, color: "var(--cat-other)" },
];

type ActivityRow = {
  ago: string;
  text: string;
  color: string;
};
const RECENT_ACTIVITY: ActivityRow[] = [
  {
    ago: "2m ago",
    text: "Close auto-run started for April 2026",
    color: "var(--brand-green)",
  },
  {
    ago: "14m ago",
    text: "12 transactions classified by agent",
    color: "var(--status-info)",
  },
  {
    ago: "1h ago",
    text: "Albert Heijn invoice linked to tx_001",
    color: "var(--status-warning)",
  },
  {
    ago: "3h ago",
    text: "EU credit retirement queued · 18.5 tCO₂e",
    color: "var(--brand-green)",
  },
  {
    ago: "yesterday",
    text: "Reserve transferred · €412.30 → carbon sub-account",
    color: "var(--status-success)",
  },
];

export function LaunchDashboard() {
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        background: "var(--bg-canvas)",
        overflowY: "auto",
      }}
    >
      <div
        style={{
          maxWidth: 1200,
          margin: "0 auto",
          padding: "32px 24px",
          display: "flex",
          flexDirection: "column",
          gap: 32,
        }}
      >
        {/* Header */}
        <div>
          <CodeLabel>OVERVIEW · APRIL 2026</CodeLabel>
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
            Dashboard
          </h1>
          <p
            style={{
              fontSize: 14,
              color: "var(--fg-secondary)",
              marginTop: 8,
              maxWidth: "64ch",
              lineHeight: 1.5,
            }}
          >
            This month&rsquo;s emissions and savings, derived from your bunq
            Business spend.
          </p>
        </div>

        <SectionDivider />

        {/* KPI row: 4-up grid */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
            gap: 16,
          }}
        >
          <Card>
            <CardBody style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <Stat
                label="BASELINE EMISSIONS"
                value="41.2 tCO₂e"
                sub="€128,430 spend analysed"
              />
              <ConfidenceBar value={0.74} />
            </CardBody>
          </Card>
          <Card>
            <CardBody style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <Stat
                label="NET ANNUAL IMPACT"
                value="€28,766"
                tone="positive"
                sub="76 tCO₂e reduced"
              />
              <ConfidenceBar value={0.81} />
            </CardBody>
          </Card>
          <Card>
            <CardBody style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <Stat
                label="MONTH OVER MONTH"
                value="−12.4%"
                tone="positive"
                sub="vs. March 2026"
              />
            </CardBody>
          </Card>
          <Card>
            <CardBody style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <Stat
                label="CONFIDENCE"
                value="81%"
                sub="spend-weighted average"
              />
              <ConfidenceBar value={0.81} />
            </CardBody>
          </Card>
        </div>

        <SectionDivider />

        {/* Secondary row: 2-up grid */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
            gap: 16,
          }}
        >
          {/* Emissions by category */}
          <Card>
            <CardBody>
              <CodeLabel>EMISSIONS BY CATEGORY</CodeLabel>
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: 14,
                  marginTop: 16,
                }}
              >
                {CATEGORY_BARS.map((row) => (
                  <div
                    key={row.label}
                    style={{
                      display: "grid",
                      gridTemplateColumns: "120px 1fr 48px",
                      alignItems: "center",
                      gap: 12,
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                        minWidth: 0,
                      }}
                    >
                      <span
                        aria-hidden
                        style={{
                          width: 6,
                          height: 6,
                          borderRadius: 9999,
                          background: row.color,
                          flexShrink: 0,
                        }}
                      />
                      <span
                        style={{
                          fontSize: 13,
                          color: "var(--fg-primary)",
                        }}
                      >
                        {row.label}
                      </span>
                    </div>
                    <div
                      style={{
                        height: 6,
                        borderRadius: 9999,
                        background: "var(--bg-inset)",
                        overflow: "hidden",
                      }}
                    >
                      <div
                        style={{
                          height: "100%",
                          width: `${row.pct}%`,
                          background: row.color,
                          borderRadius: 9999,
                        }}
                      />
                    </div>
                    <div
                      style={{
                        fontSize: 13,
                        color: "var(--fg-secondary)",
                        textAlign: "right",
                        fontVariantNumeric: "tabular-nums",
                      }}
                    >
                      {row.pct}%
                    </div>
                  </div>
                ))}
              </div>
            </CardBody>
          </Card>

          {/* Recent activity */}
          <Card>
            <CardBody>
              <CodeLabel>RECENT ACTIVITY</CodeLabel>
              <ul
                style={{
                  listStyle: "none",
                  padding: 0,
                  margin: "16px 0 0 0",
                  display: "flex",
                  flexDirection: "column",
                  gap: 12,
                }}
              >
                {RECENT_ACTIVITY.map((row) => (
                  <li
                    key={`${row.ago}-${row.text}`}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 12,
                      paddingBottom: 12,
                      borderBottom: "1px solid var(--border-faint)",
                    }}
                  >
                    <PulseDot color={row.color} />
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div
                        style={{
                          fontSize: 13,
                          color: "var(--fg-primary)",
                          lineHeight: 1.4,
                        }}
                      >
                        {row.text}
                      </div>
                      <div style={{ marginTop: 2 }}>
                        <CodeLabel>{row.ago}</CodeLabel>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            </CardBody>
          </Card>
        </div>

        {/* Footer attribution */}
        <div
          style={{
            marginTop: 8,
            paddingTop: 24,
            borderTop: "1px solid var(--border-faint)",
            display: "flex",
            justifyContent: "space-between",
            gap: 12,
            flexWrap: "wrap",
          }}
        >
          <CodeLabel>Factors · DEFRA 2024 · ADEME · Exiobase v3</CodeLabel>
          <CodeLabel>Reserve · bunq sub-account · Credits Puro.earth</CodeLabel>
        </div>
      </div>
    </div>
  );
}
