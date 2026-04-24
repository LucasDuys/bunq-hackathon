import Link from "next/link";
import { ArrowLeft, ArrowRight, BadgeEuro, Lightbulb, TrendingDown } from "lucide-react";
import { Badge, Card, CardBody, CardHeader, CardTitle, SectionDivider, Stat } from "@/components/ui";
import { DEFAULT_ORG_ID, currentMonth, getTaxSavingsForMonth } from "@/lib/queries";
import { fmtEur, fmtKg } from "@/lib/utils";
import { schemeById } from "@/lib/tax/incentives";

export const dynamic = "force-dynamic";

const categoryLabels: Record<string, string> = {
  travel: "Travel & transport",
  food: "Food & hospitality",
  procurement: "Procurement",
  cloud: "Cloud & IT",
  services: "Professional services",
  utilities: "Utilities",
  fuel: "Fuel",
  other: "Other",
};

export default async function TaxSavingsPage() {
  const month = currentMonth();
  const savings = getTaxSavingsForMonth(DEFAULT_ORG_ID, month);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-start justify-between gap-6">
        <div>
          <Link href="/" className="text-xs flex items-center gap-1 mb-2 transition-colors" style={{ color: "var(--text-mute)" }}>
            <ArrowLeft className="h-3 w-3" /> Back to overview
          </Link>
          <h1 className="text-2xl font-semibold tracking-tight" style={{ color: "var(--text)" }}>Tax savings & incentives</h1>
          <p className="text-sm mt-1" style={{ color: "var(--text-dim)" }}>
            Based on {savings.totalTransactions} transactions in {month} · Dutch & EU schemes
          </p>
        </div>
      </div>

      <SectionDivider />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardBody>
            <Stat
              label="Monthly potential savings"
              value={fmtEur(savings.totalPotentialSavingsEur, 0)}
              sub={`from ${fmtEur(savings.totalSpendEur, 0)} total spend`}
              tone="positive"
              serif
            />
          </CardBody>
        </Card>
        <Card>
          <CardBody>
            <Stat
              label="Annual projection"
              value={fmtEur(savings.annualProjection, 0)}
              sub="if current spending patterns continue"
              tone="positive"
              serif
            />
          </CardBody>
        </Card>
        <Card>
          <CardBody>
            <Stat
              label="Total CO₂e this month"
              value={fmtKg(savings.totalCo2eKg)}
              sub="across all categories"
              serif
            />
          </CardBody>
        </Card>
      </div>

      <SectionDivider label="Schemes" />

      {savings.byScheme.length > 0 && (
        <Card>
          <CardHeader className="flex items-center justify-between">
            <CardTitle>Savings by tax scheme</CardTitle>
            <Badge tone="info">NL & EU incentives</Badge>
          </CardHeader>
          <CardBody className="space-y-3">
            {savings.byScheme.map((s) => {
              const scheme = schemeById(s.schemeId);
              return (
                <div key={s.schemeId} className="flex items-center justify-between py-2.5" style={{ borderBottom: "1px solid var(--border-faint)" }}>
                  <div className="flex-1">
                    <div className="text-sm font-medium" style={{ color: "var(--text)" }}>{s.schemeName}</div>
                    {scheme && (
                      <div className="text-xs mt-0.5" style={{ color: "var(--text-mute)" }}>
                        {scheme.nameNl} · {scheme.jurisdiction === "NL" ? "Netherlands" : "EU-wide"} · {scheme.source}
                      </div>
                    )}
                    {scheme && (
                      <div className="text-xs mt-1" style={{ color: "var(--text-dim)" }}>{scheme.description}</div>
                    )}
                  </div>
                  <div className="text-right ml-4">
                    <div className="text-lg font-semibold tabular-nums" style={{ color: "var(--green-bright)" }}>{fmtEur(s.totalEur, 0)}</div>
                    <div className="text-xs" style={{ color: "var(--text-mute)" }}>per month</div>
                  </div>
                </div>
              );
            })}
          </CardBody>
        </Card>
      )}

      <SectionDivider label="Categories" />

      <Card>
        <CardHeader className="flex items-center justify-between">
          <CardTitle>Savings by spending category</CardTitle>
          <Badge tone="positive">switch & save</Badge>
        </CardHeader>
        <CardBody className="space-y-4">
          {savings.byCategory.map((cat) => (
            <div key={cat.category} className="pb-4" style={{ borderBottom: "1px solid var(--border-faint)" }}>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <div className="text-sm font-medium" style={{ color: "var(--text)" }}>{categoryLabels[cat.category] ?? cat.category}</div>
                  <span className="text-xs tabular-nums" style={{ color: "var(--text-mute)" }}>{fmtEur(cat.spendEur, 0)} spent · {fmtKg(cat.co2eKg)}</span>
                </div>
                <div className="text-sm font-semibold tabular-nums" style={{ color: "var(--green-bright)" }}>
                  {cat.potentialSavingsEur > 0 ? fmtEur(cat.potentialSavingsEur, 0) : "—"}
                </div>
              </div>

              {cat.topAlternative && (
                <div
                  className="flex items-start gap-2 rounded-xl px-3 py-2"
                  style={{ background: "rgba(48,192,111,0.06)", border: "1px solid rgba(48,192,111,0.12)" }}
                >
                  <Lightbulb className="h-4 w-4 mt-0.5 shrink-0" style={{ color: "var(--green)" }} />
                  <div className="text-xs" style={{ color: "var(--text-dim)" }}>
                    <span className="font-medium" style={{ color: "var(--text)" }}>{cat.topAlternative.alternative.switchLabel}</span>
                    <span className="ml-1" style={{ color: "var(--text-mute)" }}>
                      · {cat.topAlternative.co2eReductionPct}% less CO₂e
                      {cat.topAlternative.costDifferenceEur > 0 && (
                        <> · saves {fmtEur(cat.topAlternative.costDifferenceEur, 0)} per transaction</>
                      )}
                    </span>
                  </div>
                </div>
              )}
            </div>
          ))}

          {savings.byCategory.length === 0 && (
            <div className="text-sm text-center py-4" style={{ color: "var(--text-mute)" }}>No transactions classified this month yet. Run a monthly close first.</div>
          )}
        </CardBody>
      </Card>

      <SectionDivider label="Methodology" />

      <Card>
        <CardHeader><CardTitle>How Carbo calculates tax savings</CardTitle></CardHeader>
        <CardBody className="space-y-3 text-sm" style={{ color: "var(--text-dim)" }}>
          <div className="flex gap-2 items-start">
            <BadgeEuro className="h-4 w-4 mt-0.5 shrink-0" style={{ color: "var(--green)" }} />
            <span>Each transaction is matched to Dutch tax schemes (EIA, MIA, Vamil) based on spending category and amount. Deduction rates are applied at the current corporate tax rate (25.8%).</span>
          </div>
          <div className="flex gap-2 items-start">
            <TrendingDown className="h-4 w-4 mt-0.5 shrink-0" style={{ color: "var(--green)" }} />
            <span>EU ETS carbon cost avoidance is calculated at ~€70/tonne CO₂. Lower-emission alternatives are identified per category with realistic price ratios.</span>
          </div>
          <div className="flex gap-2 items-start">
            <ArrowRight className="h-4 w-4 mt-0.5 shrink-0" style={{ color: "var(--green)" }} />
            <span>Annual projections assume current month patterns continue. Actual savings depend on investment timing, qualifying asset lists (Milieulijst / Energielijst), and your specific tax position.</span>
          </div>
        </CardBody>
      </Card>
    </div>
  );
}
