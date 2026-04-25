import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import {
  Badge,
  Card,
  CardBody,
  CardHeader,
  CardTitle,
  CodeLabel,
  Stat,
} from "@/components/ui";
import {
  getAgentMessagesForRun,
  getAgentRunById,
  getDagResultByRunId,
} from "@/lib/impacts/store";
import type { AgentName } from "@/lib/agents/dag/types";

export const dynamic = "force-dynamic";

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

export default async function AgentRunDetailPage({
  params,
}: {
  params: Promise<{ runId: string }>;
}) {
  const { runId } = await params;
  const run = getAgentRunById(runId);
  if (!run) notFound();
  const dag = getDagResultByRunId(runId);
  const messages = getAgentMessagesForRun(runId);

  // Group messages by agent for the per-agent rollup table.
  const byAgent = new Map<
    string,
    {
      tokensIn: number;
      tokensOut: number;
      cached: boolean;
      usedMock: boolean;
      rowCount: number;
      serverToolUseCount: number;
      webSearchRequests: number;
    }
  >();
  for (const m of messages) {
    const a = byAgent.get(m.agentName) ?? {
      tokensIn: 0,
      tokensOut: 0,
      cached: false,
      usedMock: false,
      rowCount: 0,
      serverToolUseCount: 0,
      webSearchRequests: 0,
    };
    a.tokensIn += m.tokensIn ?? 0;
    a.tokensOut += m.tokensOut ?? 0;
    if (m.cached) a.cached = true;
    if (m.mockPath === 1) a.usedMock = true;
    a.serverToolUseCount += m.serverToolUseCount ?? 0;
    a.webSearchRequests += m.webSearchRequests ?? 0;
    a.rowCount += 1;
    byAgent.set(m.agentName, a);
  }
  const totalTokensIn = messages.reduce((s, m) => s + (m.tokensIn ?? 0), 0);
  const totalTokensOut = messages.reduce((s, m) => s + (m.tokensOut ?? 0), 0);
  const mockedCount = dag?.mock_agent_count ?? 0;

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-2">
        <Link
          href="/agents"
          className="text-[12px] inline-flex items-center gap-1 self-start"
          style={{ color: "var(--fg-muted)" }}
        >
          <ArrowLeft className="h-3 w-3" aria-hidden />
          All runs
        </Link>
        <CodeLabel>Agent run · {run.month}</CodeLabel>
        <h1
          className="font-mono text-[20px] leading-tight"
          style={{ color: "var(--fg-primary)" }}
        >
          {run.id}
        </h1>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardBody>
            <Stat
              label="Total latency"
              value={`${(run.totalLatencyMs / 1000).toFixed(2)} s`}
              sub={`${messages.length} agent_messages rows`}
            />
          </CardBody>
        </Card>
        <Card>
          <CardBody>
            <Stat
              label="Mode"
              value={run.mock ? "mock" : "live"}
              sub={
                mockedCount > 0
                  ? `${mockedCount}/7 LLM agents fell back to mock`
                  : "every Sonnet agent reached the API"
              }
              tone={run.mock || mockedCount > 0 ? "warning" : "positive"}
            />
          </CardBody>
        </Card>
        <Card>
          <CardBody>
            <Stat
              label="Tokens in"
              value={totalTokensIn.toLocaleString("en-NL")}
              sub="cached + uncached"
            />
          </CardBody>
        </Card>
        <Card>
          <CardBody>
            <Stat
              label="Tokens out"
              value={totalTokensOut.toLocaleString("en-NL")}
              sub="across all agents"
            />
          </CardBody>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div>
            <CodeLabel className="block mb-1">Per-agent rollup</CodeLabel>
            <CardTitle>What each agent did</CardTitle>
          </div>
        </CardHeader>
        <CardBody className="p-0">
          <div
            className="grid grid-cols-[1fr_auto_auto_auto_auto_auto] gap-x-6 px-4 py-2.5"
            style={{ borderBottom: "1px solid var(--border-faint)" }}
          >
            <CodeLabel>Agent</CodeLabel>
            <CodeLabel className="text-right">Latency</CodeLabel>
            <CodeLabel className="text-right">In</CodeLabel>
            <CodeLabel className="text-right">Out</CodeLabel>
            <CodeLabel className="text-right">Web</CodeLabel>
            <CodeLabel className="text-right">Path</CodeLabel>
          </div>
          {ORDER.map((name, i) => {
            const m = dag?.metrics[name];
            const a = byAgent.get(name);
            const isBaseline = name === "spend_emissions_baseline_agent";
            return (
              <div
                key={name}
                className="grid grid-cols-[1fr_auto_auto_auto_auto_auto] gap-x-6 px-4 py-3 items-center"
                style={{
                  borderBottom:
                    i < ORDER.length - 1
                      ? "1px solid var(--border-faint)"
                      : "none",
                }}
              >
                <span className="text-[13px]" style={{ color: "var(--fg-primary)" }}>
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
                  {isBaseline ? "—" : (a?.tokensIn ?? 0).toLocaleString("en-NL")}
                </span>
                <span
                  className="text-[13px] tabular-nums text-right"
                  style={{ color: "var(--fg-secondary)" }}
                >
                  {isBaseline ? "—" : (a?.tokensOut ?? 0).toLocaleString("en-NL")}
                </span>
                <span
                  className="text-[13px] tabular-nums text-right"
                  style={{ color: "var(--fg-secondary)" }}
                >
                  {a?.webSearchRequests ? a.webSearchRequests : "—"}
                </span>
                <span className="text-right">
                  {isBaseline ? (
                    <Badge tone="default">deterministic</Badge>
                  ) : a?.usedMock ? (
                    <Badge tone="warning">mock</Badge>
                  ) : a ? (
                    <Badge tone="positive">live</Badge>
                  ) : (
                    <Badge tone="default">no row</Badge>
                  )}
                </span>
              </div>
            );
          })}
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <div>
            <CodeLabel className="block mb-1">agent_messages · raw</CodeLabel>
            <CardTitle>Per-call observability rows</CardTitle>
          </div>
          <span
            className="text-[12px] tabular-nums"
            style={{ color: "var(--fg-muted)" }}
          >
            {messages.length} rows
          </span>
        </CardHeader>
        <CardBody className="p-0">
          {messages.length === 0 && (
            <div className="px-5 py-8 text-center text-sm text-[var(--fg-muted)]">
              No agent_messages rows for this run yet.
            </div>
          )}
          <div
            className="grid grid-cols-[auto_1fr_auto_auto_auto_auto] gap-x-6 px-4 py-2.5"
            style={{ borderBottom: "1px solid var(--border-faint)" }}
          >
            <CodeLabel>#</CodeLabel>
            <CodeLabel>Agent · content</CodeLabel>
            <CodeLabel className="text-right">Tokens</CodeLabel>
            <CodeLabel className="text-right">Cached</CodeLabel>
            <CodeLabel className="text-right">Mock</CodeLabel>
            <CodeLabel className="text-right">When</CodeLabel>
          </div>
          {messages.map((m, i) => (
            <div
              key={m.id}
              className="grid grid-cols-[auto_1fr_auto_auto_auto_auto] gap-x-6 px-4 py-2.5 items-start"
              style={{
                borderBottom:
                  i < messages.length - 1
                    ? "1px solid var(--border-faint)"
                    : "none",
              }}
            >
              <span
                className="font-mono text-[11px] tabular-nums"
                style={{ color: "var(--fg-muted)" }}
              >
                {m.id}
              </span>
              <div className="min-w-0 flex flex-col gap-0.5">
                <span
                  className="text-[12px]"
                  style={{ color: "var(--fg-primary)" }}
                >
                  {AGENT_LABELS[m.agentName as AgentName] ?? m.agentName}
                </span>
                <span
                  className="font-mono text-[11px] truncate"
                  style={{ color: "var(--fg-muted)" }}
                  title={m.content}
                >
                  {m.content}
                </span>
              </div>
              <span
                className="text-[12px] tabular-nums text-right"
                style={{ color: "var(--fg-secondary)" }}
              >
                {(m.tokensIn ?? 0)} / {(m.tokensOut ?? 0)}
              </span>
              <span
                className="text-[12px] text-right"
                style={{ color: m.cached ? "var(--brand-green)" : "var(--fg-muted)" }}
              >
                {m.cached ? "yes" : "no"}
              </span>
              <span
                className="text-[12px] text-right"
                style={{
                  color:
                    m.mockPath === 1
                      ? "var(--status-warning)"
                      : m.mockPath === 0
                        ? "var(--brand-green)"
                        : "var(--fg-muted)",
                }}
              >
                {m.mockPath === 1 ? "mock" : m.mockPath === 0 ? "live" : "—"}
              </span>
              <span
                className="text-[11px] tabular-nums text-right"
                style={{ color: "var(--fg-muted)" }}
              >
                {new Date(m.createdAt * 1000).toLocaleTimeString("en-NL", {
                  hour: "2-digit",
                  minute: "2-digit",
                  second: "2-digit",
                })}
              </span>
            </div>
          ))}
        </CardBody>
      </Card>

      {dag && (
        <Card>
          <CardHeader>
            <CardTitle>Headline outputs</CardTitle>
          </CardHeader>
          <CardBody className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Stat
              label="Net annual impact"
              value={`€ ${dag.executiveReport.kpis.net_company_scale_financial_impact_eur.toLocaleString("en-NL")}`}
              sub="after tax, credits & ETS"
              tone={
                dag.executiveReport.kpis.net_company_scale_financial_impact_eur >= 0
                  ? "positive"
                  : "danger"
              }
            />
            <Stat
              label="Emissions reduced"
              value={`${dag.executiveReport.kpis.emissions_reduced_tco2e.toFixed(2)} tCO₂e`}
              sub={`${dag.executiveReport.top_recommendations.length} top recommendations`}
            />
            <Stat
              label="Evidence sources"
              value={String(dag.executiveReport.kpis.evidence_source_count ?? 0)}
              sub={`${dag.research?.summary.cache_hits ?? 0} from cache`}
            />
          </CardBody>
        </Card>
      )}
    </div>
  );
}
