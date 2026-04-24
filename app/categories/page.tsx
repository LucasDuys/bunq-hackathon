import { Card, CardBody, CardHeader, CardTitle, Badge } from "@/components/ui";
import { DEFAULT_ORG_ID, currentMonth, getCategorySpendForMonth, getLatestEstimatesForMonth } from "@/lib/queries";
import { fmtEur, fmtKg } from "@/lib/utils";

export const dynamic = "force-dynamic";

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
    <div className="relative z-[1] flex flex-col gap-6">
      <div>
        <div className="text-[11px] uppercase tracking-[0.8px] font-semibold" style={{ color: "var(--text-mute)" }}>
          Category analysis
        </div>
        <h1 className="text-2xl font-semibold tracking-tight mt-1.5" style={{ color: "var(--text)" }}>
          Category breakdown
        </h1>
        <p className="text-[13px] mt-1" style={{ color: "var(--text-dim)" }}>
          Emissions and spend by category for {month}.
        </p>
      </div>

      <Card>
        <CardHeader><CardTitle>Emissions by category</CardTitle></CardHeader>
        <CardBody className="flex flex-col gap-3">
          {catRows.map(([cat, v], i) => (
            <div
              key={cat}
              className="flex items-center gap-4"
              style={{ animation: `slide-up-in 500ms ${i * 50}ms both ease-out` }}
            >
              <div className="w-28 text-[13px] font-medium capitalize" style={{ color: "var(--text)" }}>{cat}</div>
              <div className="flex-1 h-[8px] rounded-full relative overflow-hidden" style={{ background: "var(--bg-inset)" }}>
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${(v.co2eKg / maxCo2) * 100}%`,
                    background: "linear-gradient(90deg, var(--green-soft), var(--green))",
                    boxShadow: "0 0 6px rgba(48,192,111,0.3)",
                    animation: "bar-grow 800ms cubic-bezier(.22,.8,.2,1) both",
                    transformOrigin: "left",
                  }}
                />
              </div>
              <div className="w-24 text-right text-[13px] tabular-nums" style={{ color: "var(--text-dim)" }}>
                {fmtKg(v.co2eKg)}
              </div>
              <div className="w-28 text-right text-[13px] tabular-nums" style={{ color: "var(--text-mute)" }}>
                {fmtEur(v.spendEur, 0)}
              </div>
              <div className="w-14 text-right text-xs" style={{ color: "var(--text-faint)" }}>{v.count} tx</div>
            </div>
          ))}
          {catRows.length === 0 && (
            <div className="text-sm" style={{ color: "var(--text-mute)" }}>No transactions for {month}.</div>
          )}
        </CardBody>
      </Card>

      <Card>
        <CardHeader><CardTitle>Impact matrix — price × environmental</CardTitle></CardHeader>
        <CardBody>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[10.5px] uppercase tracking-[0.6px] font-semibold" style={{ borderBottom: "1px solid var(--border)", color: "var(--text-mute)" }}>
                  <th className="py-2.5 pr-4">Category</th>
                  <th className="py-2.5 pr-4" style={{ color: "var(--green)" }}>Low cost / low impact</th>
                  <th className="py-2.5" style={{ color: "var(--amber)" }}>High cost / high impact</th>
                </tr>
              </thead>
              <tbody>
                {IMPACT_MATRIX.map((row) => (
                  <tr key={row.category} style={{ borderBottom: "1px solid var(--border-faint)" }}>
                    <td className="py-3.5 pr-4 font-medium" style={{ color: "var(--text)" }}>{row.category}</td>
                    <td className="py-3.5 pr-4"><Badge tone="positive">{row.low}</Badge></td>
                    <td className="py-3.5"><Badge tone="warning">{row.high}</Badge></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-xs mt-4" style={{ color: "var(--text-mute)" }}>
            Intended as a nudge, not a ranking: sub-categories within each row use the same emission-factor family but
            can differ by 3–10× in kg CO₂e per EUR.
          </p>
        </CardBody>
      </Card>
    </div>
  );
}
