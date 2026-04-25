"use client";

/**
 * LaunchCFOReport — static visual clone of the CFO report section from
 * app/presentation/page.tsx (data-section="report"). Renders the headline,
 * 4-up KPI row, and 2x2 price-vs-carbon impact matrix.
 *
 * Data is sourced from /fixtures/demo-runs/sample-run.json (executiveReport)
 * and the launch fixture MATRIX_POINTS (for cell items). All ui.tsx primitives
 * are reused (Card, CardBody, CardHeader, CardTitle, Stat, ConfidenceBar,
 * CodeLabel) — no inline duplication.
 */
import {
  Card,
  CardBody,
  CardHeader,
  CardTitle,
  CodeLabel,
  ConfidenceBar,
  Stat,
} from "@/components/ui";
import { MATRIX_POINTS } from "@/app/launch/data";
import { fmtEur } from "@/lib/utils";
import sampleRun from "@/fixtures/demo-runs/sample-run.json";

type ExecutiveReport = {
  report_title: string;
  executive_summary: string;
  kpis: {
    direct_procurement_savings_eur: number;
    recommended_credit_purchase_cost_eur: number;
    estimated_tax_incentive_upside_eur: number;
    net_company_scale_financial_impact_eur: number;
    emissions_reduced_tco2e: number;
    payback_period_months: number;
    confidence: number;
  };
};

const exec = (sampleRun as { executiveReport: ExecutiveReport }).executiveReport;

type MatrixCell = {
  key: string;
  title: string;
  // The MATRIX_POINTS quadrant taxonomy uses win_win + pay_to_decarbonize +
  // status_quo_trap + avoid. We map:
  // - low cost · low carbon → win_win (cost < 0 & co2 < 0)
  // - high cost · low carbon → pay_to_decarbonize (cost > 0 & co2 < 0)
  // - low cost · high carbon → status_quo_trap (cost < 0 & co2 > 0)
  // - high cost · high carbon → avoid (cost > 0 & co2 > 0)
  filter: (p: (typeof MATRIX_POINTS)[number]) => boolean;
  accent?: boolean;
  empty: string;
};

const CELLS: MatrixCell[] = [
  {
    key: "hclc",
    title: "HIGH COST · LOW CARBON",
    filter: (p) => p.costDeltaEur > 0 && p.co2eDelta < 0,
    empty: "No paid-to-decarbonize switches surfaced.",
  },
  {
    key: "lclc",
    title: "LOW COST · LOW CARBON",
    filter: (p) => p.costDeltaEur < 0 && p.co2eDelta < 0,
    accent: true,
    empty: "Win-win quadrant is empty.",
  },
  {
    key: "hchc",
    title: "HIGH COST · HIGH CARBON",
    filter: (p) => p.costDeltaEur > 0 && p.co2eDelta > 0,
    empty: "Nothing to avoid in this run.",
  },
  {
    key: "lchc",
    title: "LOW COST · HIGH CARBON",
    filter: (p) => p.costDeltaEur < 0 && p.co2eDelta > 0,
    empty: "No status-quo traps.",
  },
];

const fmtDelta = (eur: number, kg: number) => {
  const eurStr =
    eur === 0
      ? "€0"
      : `${eur > 0 ? "+" : "−"}${fmtEur(Math.abs(eur), 0)}`;
  const kgStr =
    kg === 0 ? "0 tCO₂e" : `${kg > 0 ? "+" : "−"}${Math.abs(kg).toFixed(1)} tCO₂e`;
  return `${eurStr} · ${kgStr}`;
};

export function LaunchCFOReport() {
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
          <CodeLabel>CFO REPORT · APRIL 2026</CodeLabel>
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
            {exec.report_title}
          </h1>
          <p
            style={{
              fontSize: 15,
              color: "var(--fg-secondary)",
              marginTop: 12,
              maxWidth: "70ch",
              lineHeight: 1.55,
            }}
          >
            {exec.executive_summary}
          </p>
        </div>

        {/* KPI row: 4-up */}
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
                label="PROCUREMENT SAVINGS"
                value={fmtEur(exec.kpis.direct_procurement_savings_eur, 0)}
                sub="annual, approved items only"
              />
            </CardBody>
          </Card>
          <Card>
            <CardBody style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <Stat
                label="CREDITS NEEDED"
                value={fmtEur(exec.kpis.recommended_credit_purchase_cost_eur, 0)}
                sub="EU removal, post-reduction"
              />
            </CardBody>
          </Card>
          <Card>
            <CardBody style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <Stat
                label="TAX / INCENTIVE UPSIDE"
                value={fmtEur(exec.kpis.estimated_tax_incentive_upside_eur, 0)}
                sub="scenario; advisor review required"
              />
            </CardBody>
          </Card>
          <Card>
            <CardBody style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <Stat
                label="NET IMPACT"
                value={fmtEur(exec.kpis.net_company_scale_financial_impact_eur, 0)}
                tone="positive"
                sub={`payback ${exec.kpis.payback_period_months} months · ${exec.kpis.emissions_reduced_tco2e.toFixed(1)} tCO₂e reduced`}
              />
              <ConfidenceBar value={exec.kpis.confidence} />
            </CardBody>
          </Card>
        </div>

        {/* Impact matrix */}
        <Card>
          <CardHeader>
            <div>
              <CodeLabel>PRICE × CARBON MATRIX</CodeLabel>
              <CardTitle style={{ marginTop: 8 }}>
                Where each switch lands on cost vs CO₂e
              </CardTitle>
            </div>
          </CardHeader>
          <CardBody style={{ padding: 0 }}>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
                gap: 1,
                background: "var(--border-faint)",
              }}
              aria-label="Price vs carbon matrix"
            >
              {CELLS.map((cell) => {
                const items = MATRIX_POINTS.filter(cell.filter);
                return (
                  <div
                    key={cell.key}
                    style={{
                      background: "var(--bg-canvas)",
                      padding: 20,
                      borderLeft: cell.accent
                        ? "2px solid var(--brand-green)"
                        : "2px solid transparent",
                      minHeight: 200,
                      display: "flex",
                      flexDirection: "column",
                      gap: 12,
                    }}
                  >
                    <CodeLabel
                      style={{
                        color: cell.accent
                          ? "var(--brand-green-link)"
                          : undefined,
                      }}
                    >
                      {cell.title}
                    </CodeLabel>
                    {items.length === 0 ? (
                      <p
                        style={{
                          fontSize: 12,
                          color: "var(--fg-muted)",
                          fontStyle: "italic",
                          margin: 0,
                        }}
                      >
                        {cell.empty}
                      </p>
                    ) : (
                      <ul
                        style={{
                          listStyle: "none",
                          padding: 0,
                          margin: 0,
                          display: "flex",
                          flexDirection: "column",
                          gap: 10,
                        }}
                      >
                        {items.slice(0, 3).map((p) => (
                          <li
                            key={p.id}
                            style={{
                              display: "flex",
                              flexDirection: "column",
                              gap: 4,
                              padding: "8px 10px",
                              background: "var(--bg-inset)",
                              border: "1px solid var(--border-faint)",
                              borderRadius: 8,
                            }}
                          >
                            <div
                              style={{
                                fontSize: 13,
                                color: "var(--fg-primary)",
                                lineHeight: 1.4,
                              }}
                            >
                              {p.baseline}{" "}
                              <span style={{ color: "var(--fg-muted)" }}>
                                →
                              </span>{" "}
                              {p.alternative}
                            </div>
                            <div
                              style={{
                                fontSize: 12,
                                color: "var(--fg-secondary)",
                                fontVariantNumeric: "tabular-nums",
                                fontFamily:
                                  "var(--font-source-code-pro), ui-monospace, monospace",
                              }}
                            >
                              {fmtDelta(p.costDeltaEur, p.co2eDelta)}
                            </div>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                );
              })}
            </div>
          </CardBody>
        </Card>

        {/* Footer attribution */}
        <div
          style={{
            paddingTop: 16,
            borderTop: "1px solid var(--border-faint)",
            display: "flex",
            justifyContent: "space-between",
            gap: 12,
            flexWrap: "wrap",
          }}
        >
          <CodeLabel>Generated · DAG run {sampleRun.runId}</CodeLabel>
          <CodeLabel>NL · AFM escrow · CSRD ESRS E1</CodeLabel>
        </div>
      </div>
    </div>
  );
}
