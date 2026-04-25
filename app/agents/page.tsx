import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { Badge, Card, CardBody, CardHeader, CardTitle, CodeLabel } from "@/components/ui";
import { listAgentRuns } from "@/lib/impacts/store";
import { DEFAULT_ORG_ID } from "@/lib/queries";

export const dynamic = "force-dynamic";

export default function AgentRunsListPage() {
  const runs = listAgentRuns(DEFAULT_ORG_ID, 30);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <CodeLabel>Agent runs</CodeLabel>
        <h1
          className="text-[32px] font-normal leading-[1.00] tracking-[-0.015em] mt-2"
          style={{ color: "var(--fg-primary)" }}
        >
          Agent runs
        </h1>
        <p
          className="text-[14px] mt-2 max-w-[64ch]"
          style={{ color: "var(--fg-secondary)" }}
        >
          Every <code className="font-mono">runDag()</code> execution recorded by close runs and
          impact research. Click any row for the per-agent message trace, mock-path flags, and
          token usage.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Recent runs</CardTitle>
          <span
            className="text-[12px] tabular-nums"
            style={{ color: "var(--fg-muted)" }}
          >
            {runs.length} shown
          </span>
        </CardHeader>
        <CardBody className="p-0">
          {runs.length === 0 ? (
            <div className="px-5 py-10 text-center text-sm text-[var(--fg-muted)]">
              No DAG runs yet. Hit <code className="font-mono">POST /api/impacts/research</code> or
              start a monthly close to populate this list.
            </div>
          ) : (
            <div
              className="grid grid-cols-[1fr_auto_auto_auto_auto] gap-x-6 px-4 py-2.5"
              style={{ borderBottom: "1px solid var(--border-faint)" }}
            >
              <CodeLabel>Run</CodeLabel>
              <CodeLabel className="text-right">Month</CodeLabel>
              <CodeLabel className="text-right">Latency</CodeLabel>
              <CodeLabel className="text-right">Mode</CodeLabel>
              <CodeLabel className="text-right" />
            </div>
          )}
          {runs.map((r, i) => (
            <Link
              key={r.id}
              href={`/agents/${r.id}`}
              className="grid grid-cols-[1fr_auto_auto_auto_auto] gap-x-6 px-4 py-3 items-center hover:bg-[var(--bg-translucent)] transition-colors"
              style={{
                borderBottom:
                  i < runs.length - 1 ? "1px solid var(--border-faint)" : "none",
              }}
            >
              <span className="font-mono text-[12px] truncate" style={{ color: "var(--fg-primary)" }}>
                {r.id}
              </span>
              <span
                className="text-[13px] tabular-nums text-right"
                style={{ color: "var(--fg-secondary)" }}
              >
                {r.month}
              </span>
              <span
                className="text-[13px] tabular-nums text-right"
                style={{ color: "var(--fg-secondary)" }}
              >
                {(r.totalLatencyMs / 1000).toFixed(1)}s
              </span>
              <span className="text-right">
                <Badge tone={r.mock ? "warning" : "positive"}>
                  {r.mock ? "mock" : "live"}
                </Badge>
              </span>
              <ArrowUpRight
                className="h-3.5 w-3.5"
                style={{ color: "var(--fg-muted)" }}
                aria-hidden
              />
            </Link>
          ))}
        </CardBody>
      </Card>
    </div>
  );
}
