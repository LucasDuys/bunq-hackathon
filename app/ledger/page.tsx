import { Badge, Card, CardBody, CardHeader, CardTitle } from "@/components/ui";
import { DEFAULT_ORG_ID, getAllAudit } from "@/lib/queries";
import { verifyChain } from "@/lib/audit/append";

export const dynamic = "force-dynamic";

export default async function LedgerPage() {
  const events = getAllAudit(DEFAULT_ORG_ID, 500);
  const chain = verifyChain(DEFAULT_ORG_ID);

  return (
    <div className="relative z-[1] flex flex-col gap-6">
      <div className="flex items-start justify-between">
        <div>
          <div className="text-[11px] uppercase tracking-[0.8px] font-semibold" style={{ color: "var(--text-mute)" }}>
            Audit
          </div>
          <h1 className="text-2xl font-semibold tracking-tight mt-1.5" style={{ color: "var(--text)" }}>
            Audit ledger
          </h1>
          <p className="text-[13px] mt-1" style={{ color: "var(--text-dim)" }}>
            Append-only SHA-256 hash chain. Every state transition + external call is recorded.
          </p>
        </div>
        <Badge tone={chain.valid ? "positive" : "warning"}>
          {chain.valid ? "Chain valid" : `Broken at id=${chain.brokenAtId}`}
        </Badge>
      </div>

      <Card>
        <CardHeader><CardTitle>{events.length} events</CardTitle></CardHeader>
        <CardBody>
          <div className="overflow-x-auto">
            <table className="w-full text-xs font-mono">
              <thead>
                <tr className="text-left text-[10px] uppercase tracking-[0.5px] font-semibold" style={{ borderBottom: "1px solid var(--border)", color: "var(--text-faint)" }}>
                  <th className="py-2.5 pr-3">ID</th>
                  <th className="py-2.5 pr-3">When</th>
                  <th className="py-2.5 pr-3">Actor</th>
                  <th className="py-2.5 pr-3">Type</th>
                  <th className="py-2.5 pr-3">Payload</th>
                  <th className="py-2.5 pr-3">Hash</th>
                </tr>
              </thead>
              <tbody>
                {events.map((e) => (
                  <tr key={e.id} style={{ borderBottom: "1px solid var(--border-faint)" }}>
                    <td className="py-2.5 pr-3" style={{ color: "var(--text-faint)" }}>{e.id}</td>
                    <td className="py-2.5 pr-3 tabular-nums" style={{ color: "var(--text-mute)" }}>{new Date(e.createdAt * 1000).toLocaleString()}</td>
                    <td className="py-2.5 pr-3">
                      <Badge tone={e.actor === "agent" ? "info" : e.actor === "user" ? "positive" : "default"}>{e.actor}</Badge>
                    </td>
                    <td className="py-2.5 pr-3" style={{ color: "var(--text)" }}>{e.type}</td>
                    <td className="py-2.5 pr-3 max-w-md truncate" style={{ color: "var(--text-mute)" }}>{e.payload}</td>
                    <td className="py-2.5 pr-3 tabular-nums" style={{ color: "var(--text-faint)" }}>{e.hash.slice(0, 12)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardBody>
      </Card>
    </div>
  );
}
