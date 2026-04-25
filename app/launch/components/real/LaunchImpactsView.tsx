"use client";

/**
 * LaunchImpactsView — static visual clone of the Carbo impacts page
 * (app/impacts/page.tsx + components/ImpactsWorkspace.tsx) trimmed for the
 * launch video. Renders headline, headline KPI strip, and a vertical list
 * of recommendation rows (baseline → alternative + Δcost/ΔCO₂e + sources).
 *
 * Uses launch fixture data (MATRIX_POINTS) to drive the recommendation list,
 * so it stays in sync with the CFO report scene.
 */
import { ArrowRight } from "lucide-react";
import {
  Badge,
  Card,
  CardBody,
  CodeLabel,
  ConfidenceBar,
  Stat,
} from "@/components/ui";
import { MATRIX_POINTS } from "@/app/launch/data";
import { fmtEur } from "@/lib/utils";

type Recommendation = {
  id: string;
  baseline: string;
  alternative: string;
  costDeltaEur: number;
  co2eDelta: number;
  confidence: number;
  rationale: string;
  sources: string[];
  isWinWin: boolean;
};

const RATIONALES: Record<string, string> = {
  p1: "Switching short-haul AMS–FRA flights to ICE rail captures the ~73 tCO₂e saving while reducing booking + ground-transfer cost. Door-to-door parity on 3/3 routes.",
  p2: "Confluence and Notion overlap on 18 active docs. Migrate, retire Confluence by May 1, save €3.7k/yr with negligible business risk.",
  p3: "Plant-forward catering swap holds the same caterer + headcount; vendor confirms cost neutrality and 12.4 tCO₂e saving annually.",
  p4: "Refurbished hardware from Coolblue's certified Refit programme cuts embodied CO₂e by 8 tCO₂e and lands €4.3k under list price.",
  p6: "Default to standard 3-day shipping for non-urgent procurement. Saves €2.1k/yr in expedited fees and 3.6 tCO₂e in last-mile emissions.",
};

const SOURCES_BY_ID: Record<string, string[]> = {
  p1: ["DEFRA 2024", "ADEME Base Carbone"],
  p2: ["DAG · cost_judge", "Vendor data"],
  p3: ["DEFRA 2024", "Agribalyse v3.1"],
  p4: ["Exiobase v3", "Coolblue Refit specs"],
  p6: ["DEFRA 2024", "DHL Sustainability"],
};

const ALL_RECS: Recommendation[] = MATRIX_POINTS.filter(
  (p) => p.quadrant === "win_win" || p.quadrant === "pay_to_decarbonize",
).map((p) => ({
  id: p.id,
  baseline: p.baseline,
  alternative: p.alternative,
  costDeltaEur: p.costDeltaEur,
  co2eDelta: p.co2eDelta,
  confidence: p.quadrant === "win_win" ? 0.86 : 0.74,
  rationale:
    RATIONALES[p.id] ??
    "Sourced switch with verified emission factors and cost benchmarks.",
  sources: SOURCES_BY_ID[p.id] ?? ["DEFRA 2024", "ADEME"],
  isWinWin: p.quadrant === "win_win",
}));

const RECS = ALL_RECS.slice(0, 5);
const WIN_WIN_COUNT = ALL_RECS.filter((r) => r.isWinWin).length;

const totalAnnualSavings = ALL_RECS.filter((r) => r.costDeltaEur < 0).reduce(
  (s, r) => s + Math.abs(r.costDeltaEur),
  0,
);
const totalCo2eReducedT = ALL_RECS.filter((r) => r.co2eDelta < 0).reduce(
  (s, r) => s + Math.abs(r.co2eDelta),
  0,
);

const fmtSignedEur = (eur: number) =>
  `${eur > 0 ? "+" : eur < 0 ? "−" : ""}${fmtEur(Math.abs(eur), 0)}`;
const fmtSignedT = (t: number) =>
  `${t > 0 ? "+" : t < 0 ? "−" : ""}${Math.abs(t).toFixed(1)} tCO₂e`;

export function LaunchImpactsView() {
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
          gap: 28,
        }}
      >
        {/* Header */}
        <div>
          <CodeLabel>IMPACTS · ALTERNATIVES</CodeLabel>
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
            Top opportunities
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
            These switches save the most money and CO₂e together.
          </p>
        </div>

        {/* Toolbar */}
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
          <CodeLabel>
            {ALL_RECS.length} ALTERNATIVES EVALUATED · {WIN_WIN_COUNT} IN
            WIN-WIN QUADRANT
          </CodeLabel>
          <Badge tone="positive">WIN-WIN PRIORITY</Badge>
        </div>

        {/* Headline stat row */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
            gap: 16,
          }}
        >
          <Card>
            <CardBody>
              <Stat
                label="TOTAL POTENTIAL ANNUAL SAVINGS"
                value={fmtEur(totalAnnualSavings, 0)}
                tone="positive"
                sub="across all surfaced switches"
              />
            </CardBody>
          </Card>
          <Card>
            <CardBody>
              <Stat
                label="TOTAL POTENTIAL CO₂E REDUCED"
                value={`${totalCo2eReducedT.toFixed(0)} t`}
                tone="positive"
                sub="annualised, post-judge approval"
              />
            </CardBody>
          </Card>
          <Card>
            <CardBody>
              <Stat
                label="NUMBER OF RECOMMENDATIONS"
                value={String(ALL_RECS.length)}
                sub={`${WIN_WIN_COUNT} cheaper-and-greener`}
              />
            </CardBody>
          </Card>
        </div>

        {/* Recommendations list */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 12,
          }}
        >
          {RECS.map((rec) => {
            const costTone =
              rec.costDeltaEur < 0
                ? "var(--status-success)"
                : rec.costDeltaEur > 0
                  ? "var(--status-danger)"
                  : "var(--fg-muted)";
            const co2Tone =
              rec.co2eDelta < 0
                ? "var(--status-success)"
                : rec.co2eDelta > 0
                  ? "var(--status-danger)"
                  : "var(--fg-muted)";
            return (
              <Card key={rec.id}>
                <CardBody
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: 14,
                  }}
                >
                  {/* Header row: baseline → alternative + delta tiles */}
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: 16,
                      flexWrap: "wrap",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 10,
                        minWidth: 0,
                        flex: 1,
                      }}
                    >
                      <span
                        style={{
                          fontSize: 14,
                          fontWeight: 500,
                          color: "var(--fg-primary)",
                        }}
                      >
                        {rec.baseline}
                      </span>
                      <ArrowRight
                        style={{
                          height: 14,
                          width: 14,
                          color: "var(--fg-muted)",
                          flexShrink: 0,
                        }}
                      />
                      <span
                        style={{
                          fontSize: 13,
                          fontWeight: 500,
                          color: "var(--brand-green-link)",
                          padding: "2px 10px",
                          background: "var(--brand-green-soft)",
                          border: "1px solid var(--brand-green-border)",
                          borderRadius: 9999,
                        }}
                      >
                        {rec.alternative}
                      </span>
                    </div>
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 24,
                        flexShrink: 0,
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          flexDirection: "column",
                          alignItems: "flex-end",
                          gap: 2,
                        }}
                      >
                        <CodeLabel>COST / YR</CodeLabel>
                        <span
                          style={{
                            fontSize: 14,
                            fontVariantNumeric: "tabular-nums",
                            color: costTone,
                            fontWeight: 500,
                          }}
                        >
                          {fmtSignedEur(rec.costDeltaEur)}
                        </span>
                      </div>
                      <div
                        style={{
                          display: "flex",
                          flexDirection: "column",
                          alignItems: "flex-end",
                          gap: 2,
                        }}
                      >
                        <CodeLabel>CO₂E / YR</CodeLabel>
                        <span
                          style={{
                            fontSize: 14,
                            fontVariantNumeric: "tabular-nums",
                            color: co2Tone,
                            fontWeight: 500,
                          }}
                        >
                          {fmtSignedT(rec.co2eDelta)}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Confidence bar */}
                  <ConfidenceBar value={rec.confidence} />

                  {/* Rationale */}
                  <p
                    style={{
                      fontSize: 13,
                      lineHeight: 1.55,
                      color: "var(--fg-secondary)",
                      margin: 0,
                      maxWidth: "70ch",
                    }}
                  >
                    {rec.rationale}
                  </p>

                  {/* Sources pill list */}
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      flexWrap: "wrap",
                      paddingTop: 8,
                      borderTop: "1px solid var(--border-faint)",
                    }}
                  >
                    <CodeLabel>SOURCES</CodeLabel>
                    {rec.sources.map((s) => (
                      <span
                        key={s}
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          fontSize: 11,
                          fontFamily:
                            "var(--font-source-code-pro), ui-monospace, monospace",
                          color: "var(--brand-green-link)",
                          padding: "2px 8px",
                          border: "1px solid var(--brand-green-border)",
                          borderRadius: 9999,
                          background: "transparent",
                          letterSpacing: "0.04em",
                          textTransform: "uppercase",
                        }}
                      >
                        {s}
                      </span>
                    ))}
                  </div>
                </CardBody>
              </Card>
            );
          })}
        </div>
      </div>
    </div>
  );
}
