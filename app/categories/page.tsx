import { Card, CardBody, CardHeader, CardTitle, Badge } from "@/components/ui";
import { DEFAULT_ORG_ID, currentMonth, getCategorySpendForMonth, getLatestEstimatesForMonth } from "@/lib/queries";
import { fmtEur, fmtKg } from "@/lib/utils";

export const dynamic = "force-dynamic";

// Impact matrix examples (low-cost/low-impact vs high-cost/high-impact) per category.
const IMPACT_MATRIX = [
  { category: "Food", low: "Plant-based lunches", high: "Beef-heavy catering" },
  { category: "Travel", low: "Intercity rail (NS, Thalys)", high: "Short-haul flights" },
  { category: "Cloud", low: "EU regions (eu-west, eu-central)", high: "Coal-grid regions (us-east, asia)" },
  { category: "Procurement", low: "Office supplies, low-embodied items", high: "New electronics, large hardware" },
  { category: "Services", low: "Digital-only professional services", high: "Physical events, marketing with print" },
];

export default async function CategoriesPage() {
  const month = currentMonth();
  const rows = getCategorySpendForMonth(DEFAULT_ORG_ID, month);
  const estimates = getLatestEstimatesForMonth(DEFAULT_ORG_ID, month);

  const perCat = new Map<string, { spendEur: number; co2eKg: number; count: number }>();
  for (const r of rows) {
    if (!r.category) continue;
    perCat.set(r.category, { spendEur: Number(r.spendEur ?? 0), co2eKg: 0, count: Number(r.count ?? 0) });
  }
  for (const e of estimates) {
    const cat = e.category ?? "other";
    const s = perCat.get(cat) ?? { spendEur: 0, co2eKg: 0, count: 0 };
    s.co2eKg += e.co2eKgPoint;
    perCat.set(cat, s);
  }
  const catRows = Array.from(perCat.entries()).sort((a, b) => b[1].co2eKg - a[1].co2eKg);
  const maxCo2 = Math.max(1, ...catRows.map(([, v]) => v.co2eKg));

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Category breakdown</h1>
        <p className="text-sm text-zinc-600 dark:text-zinc-400 mt-1">Emissions and spend by category for {month}.</p>
      </div>

      <Card>
        <CardHeader><CardTitle>Emissions by category</CardTitle></CardHeader>
        <CardBody className="flex flex-col gap-3">
          {catRows.map(([cat, v]) => (
            <div key={cat} className="flex items-center gap-4">
              <div className="w-32 text-sm capitalize">{cat}</div>
              <div className="flex-1 h-6 bg-zinc-100 dark:bg-zinc-900 rounded relative overflow-hidden">
                <div className="h-full bg-emerald-500/70" style={{ width: `${(v.co2eKg / maxCo2) * 100}%` }} />
                <div className="absolute inset-0 flex items-center justify-end pr-2 text-xs tabular-nums font-medium">{fmtKg(v.co2eKg)}</div>
              </div>
              <div className="w-28 text-right text-sm tabular-nums text-zinc-600 dark:text-zinc-400">{fmtEur(v.spendEur, 0)}</div>
              <div className="w-14 text-right text-xs text-zinc-400">{v.count} tx</div>
            </div>
          ))}
          {catRows.length === 0 && <div className="text-sm text-zinc-500">No transactions for {month}.</div>}
        </CardBody>
      </Card>

      <Card>
        <CardHeader><CardTitle>Impact matrix — price × environmental</CardTitle></CardHeader>
        <CardBody>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wide text-zinc-500 border-b border-zinc-200 dark:border-zinc-800">
                  <th className="py-2 pr-4">Category</th>
                  <th className="py-2 pr-4"><span className="text-emerald-600">Low cost / low impact</span></th>
                  <th className="py-2"><span className="text-rose-600">High cost / high impact</span></th>
                </tr>
              </thead>
              <tbody>
                {IMPACT_MATRIX.map((row) => (
                  <tr key={row.category} className="border-b last:border-0 border-zinc-100 dark:border-zinc-900">
                    <td className="py-3 pr-4 font-medium">{row.category}</td>
                    <td className="py-3 pr-4"><Badge tone="positive">{row.low}</Badge></td>
                    <td className="py-3"><Badge tone="warning">{row.high}</Badge></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-zinc-500 mt-3">
            Intended as a nudge, not a ranking: sub-categories within each row use the same emission-factor family but
            can differ by 3–10× in kg CO₂e per EUR. See <code className="text-xs">research/11-impact-matrix.md</code>.
          </p>
        </CardBody>
      </Card>
    </div>
  );
}
