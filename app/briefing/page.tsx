import { Card, CardBody, CardHeader, CardTitle, Badge, Stat } from "@/components/ui";
import { buildBriefing } from "@/lib/reports/briefing";
import { fmtEur, fmtKg } from "@/lib/utils";
import { AlertTriangle, ArrowDownRight, ArrowUpRight, Download, Lightbulb, Trees } from "lucide-react";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function BriefingPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string; kind?: "month" | "week"; label?: string }>;
}) {
  const params = await searchParams;
  const kind = params.kind ?? "month";
  const label = params.label ?? params.month;
  const briefing = await buildBriefing({ kind, label });

  const { period, summary, topCategories, topMerchants, anomalies, swaps, reserve, narrative } = briefing;
  const deltaCo2 = summary.deltaCo2ePct;
  const deltaSpend = summary.deltaSpendPct;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-start justify-between">
        <div>
          <div className="text-xs uppercase tracking-wide text-zinc-500">Carbon briefing</div>
          <h1 className="text-2xl font-semibold mt-1">
            {period.label} — {briefing.orgName}
          </h1>
          <p className="text-sm text-zinc-600 dark:text-zinc-400 mt-1">
            Internal summary. Not a regulatory disclosure.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge tone="info">Auto-generated</Badge>
          <Link
            href={`/briefing/pdf?kind=${kind}&label=${period.label}`}
            target="_blank"
            className="inline-flex items-center gap-1.5 rounded-md border border-zinc-300 dark:border-zinc-700 px-3 py-1.5 text-sm hover:bg-zinc-50 dark:hover:bg-zinc-900"
          >
            <Download className="h-3.5 w-3.5" />
            <span>PDF</span>
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardBody>
            <Stat
              label="Total CO₂e"
              value={fmtKg(summary.totalCo2eKg)}
              sub={
                deltaCo2 === null
                  ? "no prior baseline"
                  : `${deltaCo2 >= 0 ? "+" : ""}${deltaCo2.toFixed(0)}% vs ${period.priorLabel}`
              }
              tone={deltaCo2 !== null && deltaCo2 > 0 ? "warning" : "default"}
            />
          </CardBody>
        </Card>
        <Card>
          <CardBody>
            <Stat
              label="Spend"
              value={fmtEur(summary.totalSpendEur, 0)}
              sub={
                deltaSpend === null
                  ? `${summary.txCount} transactions`
                  : `${deltaSpend >= 0 ? "+" : ""}${deltaSpend.toFixed(0)}% vs ${period.priorLabel}`
              }
            />
          </CardBody>
        </Card>
        <Card>
          <CardBody>
            <Stat
              label="Confidence"
              value={`${(summary.confidence * 100).toFixed(0)}%`}
              sub="spend-weighted"
              tone={summary.confidence >= 0.7 ? "positive" : "warning"}
            />
          </CardBody>
        </Card>
        <Card>
          <CardBody>
            <Stat
              label="Reserve balance"
              value={fmtEur(summary.reserveBalanceEur, 0)}
              sub="last close"
              tone="positive"
            />
          </CardBody>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Summary</CardTitle>
        </CardHeader>
        <CardBody>
          <p className="text-sm leading-relaxed">{narrative}</p>
        </CardBody>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Top categories</CardTitle>
          </CardHeader>
          <CardBody>
            {topCategories.length === 0 ? (
              <p className="text-sm text-zinc-500">No categorised emissions this period.</p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs uppercase text-zinc-500 border-b border-zinc-200 dark:border-zinc-800">
                    <th className="py-2 pr-4">Category</th>
                    <th className="py-2 pr-4 text-right">Spend</th>
                    <th className="py-2 pr-4 text-right">CO₂e</th>
                    <th className="py-2 text-right">Share</th>
                  </tr>
                </thead>
                <tbody>
                  {topCategories.map((c) => (
                    <tr key={c.category} className="border-b last:border-0 border-zinc-100 dark:border-zinc-900">
                      <td className="py-2 pr-4 capitalize">{c.category.replace(/_/g, " ")}</td>
                      <td className="py-2 pr-4 text-right tabular-nums">{fmtEur(c.spendEur, 0)}</td>
                      <td className="py-2 pr-4 text-right tabular-nums">{fmtKg(c.co2eKg)}</td>
                      <td className="py-2 text-right tabular-nums">{c.sharePct.toFixed(0)}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Top emitting merchants</CardTitle>
          </CardHeader>
          <CardBody>
            {topMerchants.length === 0 ? (
              <p className="text-sm text-zinc-500">No transactions this period.</p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs uppercase text-zinc-500 border-b border-zinc-200 dark:border-zinc-800">
                    <th className="py-2 pr-4">Merchant</th>
                    <th className="py-2 pr-4 text-right">Tx</th>
                    <th className="py-2 pr-4 text-right">CO₂e</th>
                    <th className="py-2 text-right">Share</th>
                  </tr>
                </thead>
                <tbody>
                  {topMerchants.map((m) => (
                    <tr key={m.merchantNorm} className="border-b last:border-0 border-zinc-100 dark:border-zinc-900">
                      <td className="py-2 pr-4">
                        <div className="font-medium">{m.merchantRaw}</div>
                        {m.category && <div className="text-xs text-zinc-500 capitalize">{m.category.replace(/_/g, " ")}</div>}
                      </td>
                      <td className="py-2 pr-4 text-right tabular-nums">{m.txCount}</td>
                      <td className="py-2 pr-4 text-right tabular-nums">{fmtKg(m.co2eKg)}</td>
                      <td className="py-2 text-right tabular-nums">{m.sharePct.toFixed(0)}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </CardBody>
        </Card>
      </div>

      {anomalies.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>What changed</CardTitle>
          </CardHeader>
          <CardBody>
            <ul className="space-y-3">
              {anomalies.map((a, i) => (
                <li key={i} className="flex items-start gap-3">
                  <div className="mt-0.5">
                    {a.deltaPct !== null && a.deltaPct >= 0 ? (
                      <ArrowUpRight className="h-4 w-4 text-amber-600" />
                    ) : a.deltaPct !== null ? (
                      <ArrowDownRight className="h-4 w-4 text-emerald-600" />
                    ) : (
                      <AlertTriangle className="h-4 w-4 text-amber-600" />
                    )}
                  </div>
                  <div className="text-sm">
                    <div className="font-medium">{a.subject}</div>
                    <div className="text-zinc-600 dark:text-zinc-400">{a.message}</div>
                  </div>
                </li>
              ))}
            </ul>
          </CardBody>
        </Card>
      )}

      {swaps.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Recommended swaps</CardTitle>
          </CardHeader>
          <CardBody>
            <ul className="space-y-4">
              {swaps.map((s, i) => (
                <li key={i} className="flex items-start gap-3">
                  <Lightbulb className="h-4 w-4 mt-1 text-emerald-600" />
                  <div className="text-sm flex-1">
                    <div className="flex items-baseline justify-between">
                      <div className="font-medium capitalize">{s.from.replace(/_/g, " ")} → {s.to}</div>
                      <div className="text-xs text-zinc-500 tabular-nums">
                        save ~{fmtKg(s.expectedSavingKg)} ({s.expectedSavingPct.toFixed(0)}%)
                      </div>
                    </div>
                    <div className="text-zinc-600 dark:text-zinc-400 mt-1">{s.rationale}</div>
                  </div>
                </li>
              ))}
            </ul>
          </CardBody>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Recommended carbon credits</CardTitle>
        </CardHeader>
        <CardBody>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
            <div>
              <div className="text-xs text-zinc-500 uppercase">Tonnes to offset</div>
              <div className="text-xl font-semibold tabular-nums">{reserve.recommendedTonnes.toFixed(2)} t</div>
            </div>
            <div>
              <div className="text-xs text-zinc-500 uppercase">Estimated cost</div>
              <div className="text-xl font-semibold tabular-nums">{fmtEur(reserve.recommendedSpendEur)}</div>
            </div>
            <div>
              <div className="text-xs text-zinc-500 uppercase">Projects</div>
              <div className="text-xl font-semibold tabular-nums">{reserve.projectMix.length}</div>
            </div>
          </div>
          {reserve.projectMix.length > 0 && (
            <ul className="space-y-2">
              {reserve.projectMix.map((p) => (
                <li key={p.projectId} className="flex items-center gap-3 text-sm">
                  <Trees className="h-4 w-4 text-emerald-600" />
                  <div className="flex-1">{p.projectName}</div>
                  <div className="text-zinc-500 tabular-nums">{p.tonnes.toFixed(2)} t</div>
                  <div className="text-zinc-500 tabular-nums">{fmtEur(p.eur)}</div>
                </li>
              ))}
            </ul>
          )}
        </CardBody>
      </Card>

      <p className="text-xs text-zinc-500">
        Generated {new Date(briefing.generatedAt).toLocaleString("en-NL")}.
        Period: {new Date(period.startTs * 1000).toISOString().slice(0, 10)} → {new Date(period.endTs * 1000).toISOString().slice(0, 10)}.
      </p>
    </div>
  );
}
