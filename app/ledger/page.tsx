import {
  Badge,
  Card,
  CardBody,
  CardHeader,
  CardTitle,
  CodeLabel,
  PulseDot,
  SectionDivider,
  Stat,
} from "@/components/ui";
import { ExplainButton } from "@/components/ExplainButton";
import { DEFAULT_ORG_ID, getAllAudit } from "@/lib/queries";
import { verifyChain } from "@/lib/audit/append";

export const dynamic = "force-dynamic";

/* Category dot color keyed on event type prefix — maps to canonical category tokens. */
const dotColorForType = (type: string): string => {
  if (type.startsWith("close") || type.startsWith("approve")) return "var(--cat-electricity)";
  if (type.startsWith("transaction") || type.startsWith("webhook")) return "var(--cat-goods)";
  if (type.startsWith("onboarding")) return "var(--cat-digital)";
  if (type.startsWith("bunq") || type.startsWith("payment")) return "var(--cat-travel)";
  if (type.startsWith("policy") || type.startsWith("override")) return "var(--cat-services)";
  if (type.startsWith("error") || type.startsWith("reject")) return "var(--cat-fuel)";
  return "var(--cat-other)";
};

const actorTone = (actor: string): "positive" | "info" | "warning" | "default" => {
  if (actor === "user") return "positive";
  if (actor === "agent") return "info";
  if (actor === "webhook") return "warning";
  return "default";
};

const fmtRelative = (unix: number): string => {
  const diffSec = Math.floor(Date.now() / 1000 - unix);
  if (diffSec < 60) return `${diffSec}s ago`;
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`;
  if (diffSec < 86_400) return `${Math.floor(diffSec / 3600)}h ago`;
  return `${Math.floor(diffSec / 86_400)}d ago`;
};

const fmtAbsolute = (unix: number): string =>
  new Date(unix * 1000).toLocaleString("en-NL", {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });

export default async function LedgerPage() {
  const events = getAllAudit(DEFAULT_ORG_ID, 500);
  const chain = verifyChain(DEFAULT_ORG_ID);
  const lastEvent = events[0];

  return (
    <div className="relative z-[1] flex flex-col gap-8">
      {/* ── Heading ── */}
      <div className="flex items-start justify-between gap-6">
        <div>
          <CodeLabel>Audit</CodeLabel>
          <h1
            className="text-[36px] font-normal leading-[1.1] mt-2"
            style={{ color: "var(--fg-primary)", letterSpacing: "-0.015em" }}
          >
            Audit ledger
          </h1>
          <p
            className="text-[14px] mt-2 max-w-[66ch]"
            style={{ color: "var(--fg-secondary)" }}
          >
            Append-only SHA-256 hash chain. Every state transition and external call
            is recorded. Tampering breaks the chain on the next verify.
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0 mt-2">
          <PulseDot
            color={chain.valid ? "var(--brand-green)" : "var(--status-danger)"}
          />
          <Badge tone={chain.valid ? "positive" : "danger"}>
            {chain.valid ? "Chain verified" : `Broken at id=${chain.brokenAtId}`}
          </Badge>
          <ExplainButton metric="ledger" />
        </div>
      </div>

      <SectionDivider />

      {/* ── KPI row ── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardBody>
            <Stat
              label="Total events"
              value={events.length.toLocaleString("en-NL")}
              sub={`Showing most recent ${Math.min(events.length, 500)}`}
            />
          </CardBody>
        </Card>
        <Card>
          <CardBody>
            <Stat
              label="Last event"
              value={lastEvent ? fmtRelative(lastEvent.createdAt) : "—"}
              sub={lastEvent ? fmtAbsolute(lastEvent.createdAt) : "No events yet"}
            />
          </CardBody>
        </Card>
        <Card>
          <CardBody>
            <Stat
              label="Integrity"
              value={chain.valid ? "Verified" : "Broken"}
              sub={
                chain.valid
                  ? `${"count" in chain ? chain.count : events.length} events · SHA-256`
                  : chain.reason ?? "hash mismatch"
              }
              tone={chain.valid ? "positive" : "danger"}
            />
          </CardBody>
        </Card>
      </div>

      <SectionDivider label="Events" />

      {/* ── Ledger table ── */}
      <Card>
        <CardHeader>
          <CardTitle>Chain events</CardTitle>
          <div className="flex items-center gap-2">
            <CodeLabel>{events.length} rows</CodeLabel>
            <ExplainButton metric="ledger" />
          </div>
        </CardHeader>
        <CardBody className="!px-0 !py-0">
          <div className="overflow-x-auto">
            <table className="w-full text-[13px]">
              <thead>
                <tr
                  className="text-left"
                  style={{ borderBottom: "1px solid var(--border-faint)" }}
                >
                  <th className="px-4 py-3 w-[60px]">
                    <CodeLabel>ID</CodeLabel>
                  </th>
                  <th className="px-4 py-3 w-[180px]">
                    <CodeLabel>When</CodeLabel>
                  </th>
                  <th className="px-4 py-3 w-[110px]">
                    <CodeLabel>Actor</CodeLabel>
                  </th>
                  <th className="px-4 py-3">
                    <CodeLabel>Type</CodeLabel>
                  </th>
                  <th className="px-4 py-3">
                    <CodeLabel>Payload</CodeLabel>
                  </th>
                  <th className="px-4 py-3 w-[160px]">
                    <CodeLabel>SHA-256</CodeLabel>
                  </th>
                </tr>
              </thead>
              <tbody>
                {events.map((e) => (
                  <tr
                    key={e.id}
                    className="group transition-colors"
                    style={{
                      height: 44,
                      borderBottom: "1px solid var(--border-faint)",
                    }}
                  >
                    <td
                      className="px-4 tabular-nums font-mono text-[12px]"
                      style={{ color: "var(--fg-faint)" }}
                    >
                      {e.id}
                    </td>
                    <td
                      className="px-4 tabular-nums text-[12px]"
                      style={{ color: "var(--fg-muted)" }}
                      title={fmtAbsolute(e.createdAt)}
                    >
                      {fmtAbsolute(e.createdAt)}
                    </td>
                    <td className="px-4">
                      <Badge tone={actorTone(e.actor)}>{e.actor}</Badge>
                    </td>
                    <td className="px-4">
                      <span className="inline-flex items-center gap-2">
                        <span
                          className="inline-block rounded-full shrink-0"
                          style={{
                            width: 6,
                            height: 6,
                            background: dotColorForType(e.type),
                          }}
                        />
                        <span
                          className="font-mono text-[12px]"
                          style={{ color: "var(--fg-primary)" }}
                        >
                          {e.type}
                        </span>
                      </span>
                    </td>
                    <td
                      className="px-4 font-mono text-[12px] max-w-md truncate"
                      style={{ color: "var(--fg-muted)" }}
                      title={e.payload}
                    >
                      {e.payload}
                    </td>
                    <td
                      className="px-4 font-mono text-[12px] tabular-nums truncate"
                      style={{ color: "var(--fg-faint)" }}
                      title={e.hash}
                    >
                      {e.hash.slice(0, 16)}…
                    </td>
                  </tr>
                ))}
                {events.length === 0 && (
                  <tr>
                    <td
                      colSpan={6}
                      className="px-4 py-10 text-center text-[13px]"
                      style={{ color: "var(--fg-muted)" }}
                    >
                      No audit events recorded yet. Run a close to start the chain.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardBody>
      </Card>
    </div>
  );
}
