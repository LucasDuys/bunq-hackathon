import Link from "next/link";
import { ArrowRight, BadgeEuro, Play, Shield, TrendingUp, Zap } from "lucide-react";
import { Badge, Card, CardBody, CardHeader, CardTitle, ConfidenceBar, Stat } from "@/components/ui";
import { StartCloseButton } from "@/components/StartCloseButton";
import { TrendChart } from "@/components/TrendChart";
import {
  DEFAULT_ORG_ID,
  currentMonth,
  getAllTransactions,
  getCategorySpendForMonth,
  getLatestCloseRun,
  getMonthlyTrend,
  getTransactionsForMonth,
  getTaxSavingsForMonth,
} from "@/lib/queries";
import { fmtEur, fmtKg } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function Overview() {
  const month = currentMonth();
  const txs = getTransactionsForMonth(DEFAULT_ORG_ID, month);
  const allTxs = getAllTransactions(DEFAULT_ORG_ID);
  const spendRows = getCategorySpendForMonth(DEFAULT_ORG_ID, month);
  const totalSpend = spendRows.reduce((s, r) => s + (r.spendEur ?? 0), 0);
  const latestRun = getLatestCloseRun(DEFAULT_ORG_ID);
  const trend = getMonthlyTrend(DEFAULT_ORG_ID, 6);

  const taxSavings = getTaxSavingsForMonth(DEFAULT_ORG_ID, month);

  const hasRun = !!latestRun && (latestRun.finalCo2eKg != null || latestRun.initialCo2eKg != null);
  const point = latestRun?.finalCo2eKg ?? latestRun?.initialCo2eKg ?? 0;
  const confidence = latestRun?.finalConfidence ?? latestRun?.initialConfidence ?? 0;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-start justify-between gap-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Monthly Carbon Close</h1>
          <p className="text-sm text-zinc-600 dark:text-zinc-400 mt-1">
            {txs.length} transactions ingested for {month} · {allTxs.length} total on file.
          </p>
        </div>
        <StartCloseButton month={month} latestRunId={latestRun?.id ?? null} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardBody>
            <Stat label="Total spend this month" value={fmtEur(totalSpend, 0)} sub={`${txs.length} transactions`} />
          </CardBody>
        </Card>
        <Card>
          <CardBody>
            <Stat
              label={hasRun ? "Estimated CO₂e" : "CO₂e (pending close)"}
              value={hasRun ? fmtKg(point) : "—"}
              sub={hasRun && latestRun?.initialCo2eKg != null && latestRun?.finalCo2eKg != null ? `${fmtKg(latestRun.initialCo2eKg)} → ${fmtKg(latestRun.finalCo2eKg)}` : undefined}
            />
          </CardBody>
        </Card>
        <Card>
          <CardBody className="space-y-2">
            <Stat label="Confidence" value={hasRun ? `${(confidence * 100).toFixed(0)}%` : "—"} tone={confidence > 0.85 ? "positive" : "warning"} />
            {hasRun && <ConfidenceBar value={confidence} />}
          </CardBody>
        </Card>
        <Card>
          <CardBody>
            <Stat
              label="Reserve allocated"
              value={latestRun?.reserveEur ? fmtEur(latestRun.reserveEur, 0) : "—"}
              sub={latestRun?.approved ? "Approved + transferred" : latestRun?.reserveEur ? "Awaiting approval" : "No close yet"}
              tone={latestRun?.approved ? "positive" : "default"}
            />
          </CardBody>
        </Card>
      </div>

      {taxSavings.totalPotentialSavingsEur > 0 && (
        <Link href="/tax-savings" className="block group">
          <Card className="border-emerald-200 dark:border-emerald-900 bg-emerald-50/50 dark:bg-emerald-950/20">
            <CardBody className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-900">
                  <BadgeEuro className="h-5 w-5 text-emerald-700 dark:text-emerald-300" />
                </div>
                <div>
                  <div className="text-sm font-medium">Potential tax savings identified</div>
                  <div className="text-xs text-zinc-600 dark:text-zinc-400">
                    {taxSavings.byScheme.length} Dutch & EU tax schemes applicable · {taxSavings.byCategory.filter((c) => c.topAlternative).length} green switch opportunities
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <div className="text-right">
                  <div className="text-xl font-semibold tabular-nums text-emerald-700 dark:text-emerald-400">{fmtEur(taxSavings.annualProjection, 0)}</div>
                  <div className="text-xs text-zinc-500">projected annual savings</div>
                </div>
                <ArrowRight className="h-4 w-4 text-zinc-400 group-hover:text-emerald-600 transition-colors" />
              </div>
            </CardBody>
          </Card>
        </Link>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2">
          <CardHeader className="flex items-center justify-between">
            <CardTitle>6-month emissions trend</CardTitle>
            <Badge tone="info">kg CO₂e per month</Badge>
          </CardHeader>
          <CardBody>
            <TrendChart data={trend} />
          </CardBody>
        </Card>
        <Card>
          <CardHeader><CardTitle>How this works</CardTitle></CardHeader>
          <CardBody className="space-y-3 text-sm text-zinc-600 dark:text-zinc-400">
            <div className="flex gap-2 items-start"><Zap className="h-4 w-4 text-emerald-600 mt-0.5 shrink-0" /><span>Webhook ingests every bunq transaction and classifies the merchant.</span></div>
            <div className="flex gap-2 items-start"><TrendingUp className="h-4 w-4 text-emerald-600 mt-0.5 shrink-0" /><span>Monthly close aggregates, estimates CO₂e with a confidence range, and clusters uncertainty.</span></div>
            <div className="flex gap-2 items-start"><Play className="h-4 w-4 text-emerald-600 mt-0.5 shrink-0" /><span>Agent asks 2–3 high-impact questions; confidence lifts.</span></div>
            <div className="flex gap-2 items-start"><Shield className="h-4 w-4 text-emerald-600 mt-0.5 shrink-0" /><span>Policy engine allocates funds to the Carbo Reserve sub-account. Credits are EU-first.</span></div>
          </CardBody>
        </Card>
      </div>

      {latestRun && (
        <Card>
          <CardHeader className="flex items-center justify-between">
            <CardTitle>Latest close run — {latestRun.month}</CardTitle>
            <Link href={`/close/${latestRun.id}`} className="text-sm text-emerald-700 dark:text-emerald-400 flex items-center gap-1 hover:underline">
              Open <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </CardHeader>
          <CardBody className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Stat label="State" value={latestRun.state} />
            <Stat label="Initial" value={latestRun.initialCo2eKg != null ? fmtKg(latestRun.initialCo2eKg) : "—"} />
            <Stat label="Final" value={latestRun.finalCo2eKg != null ? fmtKg(latestRun.finalCo2eKg) : "—"} />
            <Stat label="Started" value={new Date(latestRun.startedAt * 1000).toLocaleString()} />
          </CardBody>
        </Card>
      )}
    </div>
  );
}
