import {
  Card,
  CardBody,
  CardHeader,
  CardTitle,
  CodeLabel,
  ConfidenceBar,
  SectionDivider,
  Stat,
} from "@/components/ui";
import { ClusterConstellation } from "@/components/ClusterConstellation";
import {
  DEFAULT_ORG_ID,
  currentMonth,
  getCategorySpendForMonth,
  getClustersForMonth,
  getLatestEstimatesForMonth,
} from "@/lib/queries";
import { fmtEur, fmtKg } from "@/lib/utils";

export const dynamic = "force-dynamic";

/* Category → CSS token from globals.css §2.5 */
const catToken = (cat: string): string => {
  const c = cat.toLowerCase();
  if (c.includes("fuel") || c.includes("scope1") || c.includes("combust")) return "var(--cat-fuel)";
  if (c.includes("electric") || c.includes("energy") || c.includes("power")) return "var(--cat-electricity)";
  if (c.includes("travel") || c.includes("transport") || c.includes("flight") || c.includes("logistic"))
    return "var(--cat-travel)";
  if (c.includes("digital") || c.includes("saas") || c.includes("cloud") || c.includes("software"))
    return "var(--cat-digital)";
  if (c.includes("service") || c.includes("professional")) return "var(--cat-services)";
  if (c.includes("good") || c.includes("procure") || c.includes("supply") || c.includes("food"))
    return "var(--cat-goods)";
  return "var(--cat-other)";
};

type CatRow = {
  category: string;
  spendEur: number;
  co2eKg: number;
  count: number;
  confidence: number; // spend-weighted average of estimate confidence in category
};

export default async function CategoriesPage() {
  const month = currentMonth();
  const rows = getCategorySpendForMonth(DEFAULT_ORG_ID, month);
  const estimates = getLatestEstimatesForMonth(DEFAULT_ORG_ID, month);
  const clusters = getClustersForMonth(DEFAULT_ORG_ID, month);

  const perCat = new Map<string, CatRow>();
  for (const r of rows) {
    if (!r.category) continue;
    perCat.set(r.category, {
      category: r.category,
      spendEur: Number(r.spendEur ?? 0),
      co2eKg: 0,
      count: Number(r.count ?? 0),
      confidence: 0,
    });
  }

  // Accumulate CO2e and a spend-weighted confidence proxy.
  const confWeight = new Map<string, { num: number; denom: number }>();
  for (const e of estimates) {
    const cat = e.category ?? "other";
    const s =
      perCat.get(cat) ??
      ({
        category: cat,
        spendEur: 0,
        co2eKg: 0,
        count: 0,
        confidence: 0,
      } satisfies CatRow);
    s.co2eKg += e.co2eKgPoint;
    perCat.set(cat, s);
    const cw = confWeight.get(cat) ?? { num: 0, denom: 0 };
    const weight = Math.max(1, e.co2eKgPoint);
    cw.num += (e.confidence ?? 0) * weight;
    cw.denom += weight;
    confWeight.set(cat, cw);
  }
  for (const [cat, v] of perCat) {
    const cw = confWeight.get(cat);
    v.confidence = cw && cw.denom > 0 ? cw.num / cw.denom : 0;
  }

  const catRows = Array.from(perCat.values()).sort((a, b) => b.co2eKg - a.co2eKg);

  const totals = catRows.reduce(
    (acc, r) => {
      acc.spend += r.spendEur;
      acc.co2 += r.co2eKg;
      acc.confNum += r.confidence * Math.max(1, r.co2eKg);
      acc.confDen += Math.max(1, r.co2eKg);
      return acc;
    },
    { spend: 0, co2: 0, confNum: 0, confDen: 0 },
  );
  const avgConf = totals.confDen > 0 ? totals.confNum / totals.confDen : 0;

  return (
    <div className="flex flex-col gap-6">
      {/* ── Page header ── */}
      <div>
        <CodeLabel>Category analysis</CodeLabel>
        <h1
          className="text-[32px] font-normal leading-[1.00] tracking-[-0.015em] mt-2"
          style={{ color: "var(--fg-primary)" }}
        >
          Category breakdown
        </h1>
        <p className="text-[14px] mt-2 max-w-[66ch]" style={{ color: "var(--fg-secondary)" }}>
          Emissions and spend by category for {month}. Every CO₂e figure carries a confidence
          tier based on emission-factor quality and classifier certainty.
        </p>
      </div>

      {/* ── Summary stats ── */}
      <Card>
        <CardBody className="grid grid-cols-1 sm:grid-cols-3 gap-8">
          <Stat label="Total spend" value={fmtEur(totals.spend, 0)} sub={`${catRows.length} categories`} />
          <div className="flex flex-col gap-2">
            <Stat label="Total CO₂e" value={fmtKg(totals.co2)} />
            <ConfidenceBar value={avgConf} />
          </div>
          <Stat
            label="Avg confidence"
            value={`${Math.round(avgConf * 100)}%`}
            sub={avgConf >= 0.85 ? "High across categories" : avgConf >= 0.6 ? "Medium — refine to improve" : "Low — needs refinement"}
            tone={avgConf >= 0.85 ? "positive" : avgConf >= 0.6 ? "warning" : "danger"}
          />
        </CardBody>
      </Card>

      {clusters.length > 0 && (
        <>
          <SectionDivider label="Cluster map" />
          <ClusterConstellation
            clusters={clusters}
            variant="full"
            eyebrow={`Agent clusters · ${month}`}
            title="Every merchant, plotted by spend and uncertainty"
          />
        </>
      )}

      <SectionDivider label="By category" />

      {/* ── Category list ── */}
      <Card>
        <CardHeader>
          <CardTitle>Emissions by category</CardTitle>
          <CodeLabel>{month}</CodeLabel>
        </CardHeader>
        <CardBody className="p-0">
          {catRows.length === 0 ? (
            <div className="px-6 py-10 text-center" style={{ color: "var(--fg-muted)" }}>
              <p className="text-sm">No transactions for {month}.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-[13px]">
                <thead>
                  <tr style={{ borderBottom: "1px solid var(--border-faint)" }}>
                    <th className="text-left px-6 py-3">
                      <CodeLabel>Category</CodeLabel>
                    </th>
                    <th className="text-left px-4 py-3">
                      <CodeLabel>Confidence</CodeLabel>
                    </th>
                    <th className="text-right px-4 py-3">
                      <CodeLabel>CO₂e</CodeLabel>
                    </th>
                    <th className="text-right px-4 py-3">
                      <CodeLabel>Spend</CodeLabel>
                    </th>
                    <th className="text-right px-6 py-3">
                      <CodeLabel>Tx</CodeLabel>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {catRows.map((r) => (
                    <tr
                      key={r.category}
                      style={{ borderBottom: "1px solid var(--border-faint)" }}
                    >
                      <td className="px-6 py-3.5">
                        <div className="flex items-center gap-2.5">
                          <span
                            className="inline-block rounded-full shrink-0"
                            style={{
                              width: 6,
                              height: 6,
                              background: catToken(r.category),
                            }}
                            aria-hidden
                          />
                          <span
                            className="capitalize"
                            style={{ color: "var(--fg-primary)" }}
                          >
                            {r.category.replace(/_/g, " ")}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3.5 w-[240px]">
                        <ConfidenceBar value={r.confidence} />
                      </td>
                      <td
                        className="px-4 py-3.5 text-right tabular-nums"
                        style={{ color: "var(--fg-primary)" }}
                      >
                        {fmtKg(r.co2eKg)}
                      </td>
                      <td
                        className="px-4 py-3.5 text-right tabular-nums"
                        style={{ color: "var(--fg-secondary)" }}
                      >
                        {fmtEur(r.spendEur, 0)}
                      </td>
                      <td
                        className="px-6 py-3.5 text-right tabular-nums"
                        style={{ color: "var(--fg-muted)" }}
                      >
                        {r.count}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
