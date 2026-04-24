import { Badge, Card, CardBody, CardHeader, CardTitle } from "@/components/ui";
import { DEFAULT_ORG_ID, getAllAudit } from "@/lib/queries";
import { verifyChain } from "@/lib/audit/append";

export const dynamic = "force-dynamic";

export default async function LedgerPage() {
  const events = getAllAudit(DEFAULT_ORG_ID, 500);
  const chain = verifyChain(DEFAULT_ORG_ID);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Audit ledger</h1>
          <p className="text-sm text-zinc-600 dark:text-zinc-400 mt-1">
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
                <tr className="text-left border-b border-zinc-200 dark:border-zinc-800">
                  <th className="py-2 pr-3">ID</th>
                  <th className="py-2 pr-3">When</th>
                  <th className="py-2 pr-3">Actor</th>
                  <th className="py-2 pr-3">Type</th>
                  <th className="py-2 pr-3">Payload</th>
                  <th className="py-2 pr-3">Hash</th>
                </tr>
              </thead>
              <tbody>
                {events.map((e) => (
                  <tr key={e.id} className="border-b last:border-0 border-zinc-100 dark:border-zinc-900">
                    <td className="py-2 pr-3 text-zinc-400">{e.id}</td>
                    <td className="py-2 pr-3 text-zinc-500">{new Date(e.createdAt * 1000).toLocaleString()}</td>
                    <td className="py-2 pr-3"><Badge tone={e.actor === "agent" ? "info" : e.actor === "user" ? "positive" : "default"}>{e.actor}</Badge></td>
                    <td className="py-2 pr-3 text-zinc-800 dark:text-zinc-200">{e.type}</td>
                    <td className="py-2 pr-3 text-zinc-500 max-w-md truncate">{e.payload}</td>
                    <td className="py-2 pr-3 text-zinc-400">{e.hash.slice(0, 12)}</td>
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
