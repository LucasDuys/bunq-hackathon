import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { Badge, Card, CardBody, CardHeader, CardTitle, CodeLabel } from "@/components/ui";
import type { DagRunResult, AgentName } from "@/lib/agents/dag/types";
import type { AgentMessage } from "@/lib/db/schema";
import { fmtEur } from "@/lib/utils";

const AGENT_LABELS: Record<AgentName, string> = {
  spend_emissions_baseline_agent: "Baseline",
  research_agent: "Research",
  green_alternatives_agent: "Green alternatives",
  cost_savings_agent: "Cost savings",
  green_judge_agent: "Green judge",
  cost_judge_agent: "Cost judge",
  carbon_credit_incentive_strategy_agent: "Credit strategy",
  executive_report_agent: "Executive report",
};

const ORDER: AgentName[] = [
  "spend_emissions_baseline_agent",
  "research_agent",
  "green_alternatives_agent",
  "cost_savings_agent",
  "green_judge_agent",
  "cost_judge_agent",
  "carbon_credit_incentive_strategy_agent",
  "executive_report_agent",
];

type Aggregated = {
  tokensIn: number;
  tokensOut: number;
  cached: boolean;
  usedMock: boolean;
  rowCount: number;
};

const aggregate = (messages: AgentMessage[]): Map<string, Aggregated> => {
  const map = new Map<string, Aggregated>();
  for (const m of messages) {
    const a = map.get(m.agentName) ?? {
      tokensIn: 0,
      tokensOut: 0,
      cached: false,
      usedMock: false,
      rowCount: 0,
    };
    a.tokensIn += m.tokensIn ?? 0;
    a.tokensOut += m.tokensOut ?? 0;
    if (m.cached) a.cached = true;
    if (m.mockPath === 1) a.usedMock = true;
    a.rowCount += 1;
    map.set(m.agentName, a);
  }
  return map;
};

export function CloseDagPanel({
  dag,
  messages,
}: {
  dag: DagRunResult;
  messages: AgentMessage[];
}) {
  const agg = aggregate(messages);
  const topRecs = dag.executiveReport.top_recommendations.slice(0, 3);
  const greenSummary = dag.greenJudge.summary;
  const costSummary = dag.costJudge.summary;
  const greenApprovedCount = dag.greenJudge.judged_results.filter(
    (j) => j.verdict === "approved" || j.verdict === "approved_with_caveats",
  ).length;
  const costApprovedCount = dag.costJudge.judged_results.filter(
    (j) => j.verdict === "approved" || j.verdict === "approved_with_caveats",
  ).length;
  const netImpactEur =
    dag.executiveReport.kpis.net_company_scale_financial_impact_eur ?? 0;
  const tCO2e = dag.executiveReport.kpis.emissions_reduced_tco2e ?? 0;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <CodeLabel className="block mb-1">Agent panel · 8-agent DAG</CodeLabel>
            <CardTitle>What the agents found</CardTitle>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Badge tone={dag.mock_agent_count === 0 ? "positive" : "warning"}>
              {dag.mock_agent_count === 0
                ? "All live"
                : `${dag.mock_agent_count}/7 mock`}
            </Badge>
            <Link
              href={`/agents/${dag.runId}`}
              className="text-[12px] inline-flex items-center gap-1"
              style={{ color: "var(--brand-green-link)" }}
            >
              Inspect run
              <ArrowUpRight className="h-3 w-3" aria-hidden />
            </Link>
          </div>
        </div>
      </CardHeader>
      <CardBody className="flex flex-col gap-6">
        {/* Per-agent strip */}
        <div
          className="rounded-[8px]"
          style={{ border: "1px solid var(--border-faint)" }}
        >
          <div
            className="grid grid-cols-[1fr_auto_auto_auto] gap-x-6 px-4 py-2.5"
            style={{ borderBottom: "1px solid var(--border-faint)" }}
          >
            <CodeLabel>Agent</CodeLabel>
            <CodeLabel className="text-right">Latency</CodeLabel>
            <CodeLabel className="text-right">Tokens</CodeLabel>
            <CodeLabel className="text-right">Path</CodeLabel>
          </div>
          {ORDER.map((name, i) => {
            const m = dag.metrics[name];
            const a = agg.get(name);
            const isBaseline = name === "spend_emissions_baseline_agent";
            const usedMock = a?.usedMock ?? false;
            return (
              <div
                key={name}
                className="grid grid-cols-[1fr_auto_auto_auto] gap-x-6 px-4 py-2.5 items-center"
                style={{
                  borderBottom:
                    i < ORDER.length - 1
                      ? "1px solid var(--border-faint)"
                      : "none",
                }}
              >
                <span
                  className="text-[13px]"
                  style={{ color: "var(--fg-primary)" }}
                >
                  {AGENT_LABELS[name]}
                </span>
                <span
                  className="text-[13px] tabular-nums text-right"
                  style={{ color: "var(--fg-secondary)" }}
                >
                  {m ? `${Math.round(m.latencyMs)} ms` : "—"}
                </span>
                <span
                  className="text-[13px] tabular-nums text-right"
                  style={{ color: "var(--fg-secondary)" }}
                >
                  {isBaseline
                    ? "—"
                    : a
                      ? `${a.tokensIn} / ${a.tokensOut}`
                      : "0 / 0"}
                </span>
                <span className="text-right">
                  {isBaseline ? (
                    <Badge tone="default">deterministic</Badge>
                  ) : usedMock ? (
                    <Badge tone="warning">mock</Badge>
                  ) : (
                    <Badge tone="positive">live</Badge>
                  )}
                </span>
              </div>
            );
          })}
        </div>

        {/* Headline */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div
            className="rounded-[8px] p-4"
            style={{ border: "1px solid var(--border-faint)" }}
          >
            <CodeLabel className="block mb-2">Net annual impact</CodeLabel>
            <div
              className="text-[24px] tabular-nums leading-none"
              style={{
                color:
                  netImpactEur >= 0
                    ? "var(--brand-green)"
                    : "var(--status-danger)",
              }}
            >
              {fmtEur(netImpactEur, 0)}
            </div>
            <div
              className="text-[12px] mt-1"
              style={{ color: "var(--fg-muted)" }}
            >
              after tax, credits & ETS
            </div>
          </div>
          <div
            className="rounded-[8px] p-4"
            style={{ border: "1px solid var(--border-faint)" }}
          >
            <CodeLabel className="block mb-2">Emissions reduced</CodeLabel>
            <div
              className="text-[24px] tabular-nums leading-none"
              style={{ color: "var(--fg-primary)" }}
            >
              {tCO2e.toFixed(2)} tCO₂e
            </div>
            <div
              className="text-[12px] mt-1"
              style={{ color: "var(--fg-muted)" }}
            >
              {greenSummary.high_confidence_green_opportunities.length} high-confidence
              switches
            </div>
          </div>
          <div
            className="rounded-[8px] p-4"
            style={{ border: "1px solid var(--border-faint)" }}
          >
            <CodeLabel className="block mb-2">Judge verdicts</CodeLabel>
            <div
              className="text-[24px] tabular-nums leading-none"
              style={{ color: "var(--fg-primary)" }}
            >
              {greenApprovedCount}G / {costApprovedCount}C
            </div>
            <div
              className="text-[12px] mt-1"
              style={{ color: "var(--fg-muted)" }}
            >
              approved by green / cost
            </div>
          </div>
        </div>

        {/* Top recommendations */}
        {topRecs.length > 0 && (
          <div className="flex flex-col gap-3">
            <CodeLabel>Top recommendations</CodeLabel>
            <ol className="flex flex-col gap-2">
              {topRecs.map((r) => (
                <li
                  key={r.rank}
                  className="rounded-[8px] px-4 py-3 flex items-start justify-between gap-4"
                  style={{ border: "1px solid var(--border-faint)" }}
                >
                  <div className="min-w-0 flex flex-col gap-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span
                        className="text-[11px] tabular-nums"
                        style={{ color: "var(--fg-muted)" }}
                      >
                        #{r.rank}
                      </span>
                      <span
                        className="text-[14px]"
                        style={{ color: "var(--fg-primary)" }}
                      >
                        {r.title}
                      </span>
                      {r.approval_required && (
                        <Badge tone="warning">Approval required</Badge>
                      )}
                    </div>
                    <p
                      className="text-[13px] leading-snug"
                      style={{ color: "var(--fg-secondary)" }}
                    >
                      {r.action}
                    </p>
                  </div>
                  <div className="flex items-center gap-4 shrink-0 tabular-nums">
                    {r.annual_saving_eur !== null && (
                      <div className="flex flex-col items-end">
                        <span
                          className="text-[10px] uppercase tracking-wide"
                          style={{ color: "var(--fg-muted)" }}
                        >
                          €/yr
                        </span>
                        <span
                          className="text-[13px]"
                          style={{
                            color:
                              r.annual_saving_eur > 0
                                ? "var(--status-success)"
                                : "var(--fg-secondary)",
                          }}
                        >
                          {r.annual_saving_eur > 0 ? "+" : ""}
                          {fmtEur(r.annual_saving_eur, 0)}
                        </span>
                      </div>
                    )}
                    {r.carbon_saving_kg !== null && (
                      <div className="flex flex-col items-end">
                        <span
                          className="text-[10px] uppercase tracking-wide"
                          style={{ color: "var(--fg-muted)" }}
                        >
                          kgCO₂e/yr
                        </span>
                        <span
                          className="text-[13px]"
                          style={{ color: "var(--brand-green)" }}
                        >
                          −{Math.abs(r.carbon_saving_kg).toFixed(0)}
                        </span>
                      </div>
                    )}
                    <div className="flex flex-col items-end">
                      <span
                        className="text-[10px] uppercase tracking-wide"
                        style={{ color: "var(--fg-muted)" }}
                      >
                        Conf
                      </span>
                      <span
                        className="text-[13px]"
                        style={{ color: "var(--fg-secondary)" }}
                      >
                        {(r.confidence * 100).toFixed(0)}%
                      </span>
                    </div>
                  </div>
                </li>
              ))}
            </ol>
            <Link
              href="/impacts"
              className="text-[12px] inline-flex items-center gap-1 self-start"
              style={{ color: "var(--brand-green-link)" }}
            >
              Open impact workspace
              <ArrowUpRight className="h-3 w-3" aria-hidden />
            </Link>
          </div>
        )}
      </CardBody>
    </Card>
  );
}
