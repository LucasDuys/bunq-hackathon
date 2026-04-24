import { Card, CardBody, CardHeader, CardTitle, Badge } from "@/components/ui";
import { DEFAULT_ORG_ID, getCategorySpendForMonth, getCloseRun, getLatestCloseRun, getLatestEstimatesForMonth } from "@/lib/queries";
import { fmtEur, fmtKg } from "@/lib/utils";
import { generateCsrdNarrative } from "@/lib/agent/narrative";
import type { CreditProject } from "@/lib/db/schema";

export const dynamic = "force-dynamic";

export default async function ReportPage({ params }: { params: Promise<{ month: string }> }) {
  const { month } = await params;
  const latest = getLatestCloseRun(DEFAULT_ORG_ID);
  const run = latest && latest.month === month ? latest : null;
  const spendRows = getCategorySpendForMonth(DEFAULT_ORG_ID, month);
  const estimates = getLatestEstimatesForMonth(DEFAULT_ORG_ID, month);

  const perCat = new Map<string, { spendEur: number; co2eKg: number }>();
  for (const r of spendRows) {
    if (!r.category) continue;
    perCat.set(r.category, { spendEur: Number(r.spendEur ?? 0), co2eKg: 0 });
  }
  for (const e of estimates) {
    const cat = e.category ?? "other";
    const s = perCat.get(cat) ?? { spendEur: 0, co2eKg: 0 };
    s.co2eKg += e.co2eKgPoint;
    perCat.set(cat, s);
  }
  const catRows = Array.from(perCat.entries()).sort((a, b) => b[1].co2eKg - a[1].co2eKg);
  const totalCo2 = catRows.reduce((s, [, v]) => s + v.co2eKg, 0);

  const mix = run?.creditRecommendation ? (JSON.parse(run.creditRecommendation) as Array<{ project: CreditProject; tonnes: number; eur: number }>) : [];
  const totalTonnes = mix.reduce((s, m) => s + m.tonnes, 0);
  const euTonnes = mix.filter((m) => m.project.region === "EU").reduce((s, m) => s + m.tonnes, 0);
  const removalTonnes = mix.filter((m) => m.project.type !== "reduction").reduce((s, m) => s + m.tonnes, 0);
  const euPct = totalTonnes > 0 ? euTonnes / totalTonnes : 0;
  const removalPct = totalTonnes > 0 ? removalTonnes / totalTonnes : 0;

  const narrative = await generateCsrdNarrative({
    month,
    totalCo2eKg: run?.finalCo2eKg ?? totalCo2,
    confidence: run?.finalConfidence ?? 0.6,
    topCategories: catRows.slice(0, 3).map(([category, v]) => ({ category, ...v })),
    reserveEur: run?.reserveEur ?? 0,
    creditTonnes: totalTonnes,
    euPct: euPct * 100,
  });

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-start justify-between">
        <div>
          <div className="text-xs uppercase tracking-wide text-zinc-500">CSRD ESRS E1 extract</div>
          <h1 className="text-2xl font-semibold mt-1">Monthly carbon report — {month}</h1>
          <p className="text-sm text-zinc-600 dark:text-zinc-400 mt-1">Voluntary monthly slice; methodology and uncertainty quantified per GHG Protocol Scope 3.</p>
        </div>
        <Badge tone="info">Audit-ready</Badge>
      </div>

      <Card>
        <CardHeader><CardTitle>Narrative summary</CardTitle></CardHeader>
        <CardBody><p className="text-sm leading-relaxed">{narrative}</p></CardBody>
      </Card>

      <Card>
        <CardHeader><CardTitle>E1-6 — Gross GHG emissions (approximated)</CardTitle></CardHeader>
        <CardBody>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase text-zinc-500 border-b border-zinc-200 dark:border-zinc-800">
                <th className="py-2 pr-4">Category (Scope 3, Cat 1/6)</th>
                <th className="py-2 pr-4 text-right">Spend</th>
                <th className="py-2 pr-4 text-right">CO₂e</th>
                <th className="py-2 text-right">Share</th>
              </tr>
            </thead>
            <tbody>
              {catRows.map(([cat, v]) => (
                <tr key={cat} className="border-b last:border-0 border-zinc-100 dark:border-zinc-900">
                  <td className="py-2 pr-4 capitalize">{cat}</td>
                  <td className="py-2 pr-4 text-right tabular-nums">{fmtEur(v.spendEur, 0)}</td>
                  <td className="py-2 pr-4 text-right tabular-nums">{fmtKg(v.co2eKg)}</td>
                  <td className="py-2 text-right tabular-nums">{totalCo2 ? `${((v.co2eKg / totalCo2) * 100).toFixed(0)}%` : "—"}</td>
                </tr>
              ))}
              <tr className="font-medium">
                <td className="py-2 pr-4">Total</td>
                <td className="py-2 pr-4 text-right tabular-nums">{fmtEur(catRows.reduce((s, [, v]) => s + v.spendEur, 0), 0)}</td>
                <td className="py-2 pr-4 text-right tabular-nums">{fmtKg(totalCo2)}</td>
                <td className="py-2 text-right">100%</td>
              </tr>
            </tbody>
          </table>
          <p className="text-xs text-zinc-500 mt-3">Method: spend-based (Exiobase / DEFRA 2024 / ADEME Base Carbone). Uncertainty varies by factor (see ledger).</p>
        </CardBody>
      </Card>

      <Card>
        <CardHeader><CardTitle>E1-7 — Carbon removal and carbon credits</CardTitle></CardHeader>
        <CardBody>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            <div><div className="text-xs text-zinc-500 uppercase">Total credits</div><div className="text-xl font-semibold tabular-nums">{totalTonnes.toFixed(2)} t</div></div>
            <div><div className="text-xs text-zinc-500 uppercase">EU-based</div><div className="text-xl font-semibold tabular-nums">{(euPct * 100).toFixed(0)}%</div></div>
            <div><div className="text-xs text-zinc-500 uppercase">Removal vs reduction</div><div className="text-xl font-semibold tabular-nums">{(removalPct * 100).toFixed(0)}% removal</div></div>
          </div>
          {mix.length > 0 && (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase text-zinc-500 border-b border-zinc-200 dark:border-zinc-800">
                  <th className="py-2 pr-4">Project</th>
                  <th className="py-2 pr-4">Type</th>
                  <th className="py-2 pr-4">Registry</th>
                  <th className="py-2 pr-4 text-right">Tonnes</th>
                  <th className="py-2 text-right">EUR</th>
                </tr>
              </thead>
              <tbody>
                {mix.map((m) => (
                  <tr key={m.project.id} className="border-b last:border-0 border-zinc-100 dark:border-zinc-900">
                    <td className="py-2 pr-4">{m.project.name}</td>
                    <td className="py-2 pr-4 capitalize">{m.project.type.replace("_", " ")}</td>
                    <td className="py-2 pr-4 text-zinc-500">{m.project.registry}</td>
                    <td className="py-2 pr-4 text-right tabular-nums">{m.tonnes.toFixed(3)}</td>
                    <td className="py-2 text-right tabular-nums">{fmtEur(m.eur)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardBody>
      </Card>

      <Card>
        <CardHeader><CardTitle>Methodology & data lineage</CardTitle></CardHeader>
        <CardBody className="text-sm text-zinc-600 dark:text-zinc-400 space-y-2">
          <p>Transactions are ingested via bunq MUTATION webhook and classified merchant-first (regex rules) with LLM fallback. Per-transaction CO₂e = spend × factor; factors are sourced from DEFRA 2024, ADEME Base Carbone, and Exiobase v3. Each factor carries an uncertainty % following GHG Protocol Tier guidance.</p>
          <p>Confidence = (1 − factor uncertainty) × classifier confidence × tier weight. Uncertainty is clustered at merchant level; a Claude Sonnet 4.6 agent generates at most three high-impact refinement questions per close to reduce variance.</p>
          <p>Reserve allocation and credit recommendations follow a declarative policy (see <code>policies</code> row). Every state transition is appended to a SHA-256 hash-chained <code>audit_events</code> log — UPDATE and DELETE are blocked by trigger.</p>
        </CardBody>
      </Card>
    </div>
  );
}
