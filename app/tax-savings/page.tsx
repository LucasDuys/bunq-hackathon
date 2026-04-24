import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import {
  Badge,
  Card,
  CardBody,
  CardHeader,
  CardTitle,
  CodeLabel,
  SectionDivider,
  Stat,
} from "@/components/ui";
import {
  DEFAULT_ORG_ID,
  currentMonth,
  getTaxSavingsForMonth,
} from "@/lib/queries";
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

const categoryColors: Record<string, string> = {
  travel: "var(--cat-travel)",
  food: "var(--cat-services)",
  procurement: "var(--cat-goods)",
  cloud: "var(--cat-digital)",
  services: "var(--cat-services)",
  utilities: "var(--cat-electricity)",
  fuel: "var(--cat-fuel)",
  other: "var(--cat-other)",
};

export default async function TaxSavingsPage() {
  const month = currentMonth();
  const savings = getTaxSavingsForMonth(DEFAULT_ORG_ID, month);

  return (
    <div className="relative z-[1] flex flex-col gap-8">
      {/* ── Heading ── */}
      <div className="flex items-start justify-between gap-6">
        <div>
          <Link
            href="/"
            className="text-[12px] inline-flex items-center gap-1.5 mb-2 transition-colors hover:text-[var(--fg-secondary)]"
            style={{ color: "var(--fg-muted)" }}
          >
            <ArrowLeft className="h-3 w-3" /> Back to overview
          </Link>
          <CodeLabel>Tax &amp; incentives</CodeLabel>
          <h1
            className="text-[36px] font-normal leading-[1.1] mt-2"
            style={{ color: "var(--fg-primary)", letterSpacing: "-0.015em" }}
          >
            Tax savings &amp; incentives
          </h1>
          <p
            className="text-[14px] mt-2 max-w-[66ch]"
            style={{ color: "var(--fg-secondary)" }}
          >
            Based on{" "}
            <span className="tabular-nums">{savings.totalTransactions}</span>{" "}
            transactions in{" "}
            <span className="tabular-nums">{month}</span>. Matched against Dutch
            and EU-wide schemes (EIA, MIA, Vamil, EU ETS).
          </p>
        </div>
      </div>

      <SectionDivider />

      {/* ── KPI scenario cards ── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardBody>
            <Stat
              label="Monthly potential savings"
              value={fmtEur(savings.totalPotentialSavingsEur, 0)}
              sub={`From ${fmtEur(savings.totalSpendEur, 0)} total spend`}
              tone="positive"
            />
          </CardBody>
        </Card>
        <Card>
          <CardBody>
            <Stat
              label="Annual projection"
              value={fmtEur(savings.annualProjection, 0)}
              sub="If current patterns continue"
              tone="positive"
            />
          </CardBody>
        </Card>
        <Card>
          <CardBody>
            <Stat
              label="Total CO₂e this month"
              value={fmtKg(savings.totalCo2eKg)}
              sub={`± ${fmtKg(savings.totalCo2eKg * 0.15)} · estimate`}
            />
          </CardBody>
        </Card>
      </div>

      <SectionDivider label="Schemes" />

      {/* ── Schemes table ── */}
      {savings.byScheme.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Savings by tax scheme</CardTitle>
            <Badge tone="info">NL &amp; EU</Badge>
          </CardHeader>
          <CardBody className="!px-0 !py-0">
            <div className="overflow-x-auto">
              <table className="w-full text-[13px]">
                <thead>
                  <tr
                    className="text-left"
                    style={{ borderBottom: "1px solid var(--border-faint)" }}
                  >
                    <th className="px-4 py-3">
                      <CodeLabel>Scheme</CodeLabel>
                    </th>
                    <th className="px-4 py-3 w-[140px]">
                      <CodeLabel>Jurisdiction</CodeLabel>
                    </th>
                    <th className="px-4 py-3 w-[180px]">
                      <CodeLabel>Source</CodeLabel>
                    </th>
                    <th className="px-4 py-3 w-[160px] text-right">
                      <CodeLabel>Per month</CodeLabel>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {savings.byScheme.map((s) => {
                    const scheme = schemeById(s.schemeId);
                    return (
                      <tr
                        key={s.schemeId}
                        style={{
                          borderBottom: "1px solid var(--border-faint)",
                        }}
                      >
                        <td className="px-4 py-3 align-top">
                          <div style={{ color: "var(--fg-primary)" }}>
                            {s.schemeName}
                          </div>
                          {scheme && (
                            <>
                              <div
                                className="text-[12px] mt-0.5"
                                style={{ color: "var(--fg-muted)" }}
                              >
                                {scheme.nameNl}
                              </div>
                              <div
                                className="text-[12px] mt-1 max-w-[60ch]"
                                style={{ color: "var(--fg-secondary)" }}
                              >
                                {scheme.description}
                              </div>
                            </>
                          )}
                        </td>
                        <td
                          className="px-4 py-3 align-top text-[12px]"
                          style={{ color: "var(--fg-secondary)" }}
                        >
                          {scheme
                            ? scheme.jurisdiction === "NL"
                              ? "Netherlands"
                              : "EU-wide"
                            : "—"}
                        </td>
                        <td
                          className="px-4 py-3 align-top font-mono text-[12px]"
                          style={{ color: "var(--fg-muted)" }}
                        >
                          {scheme?.source ?? "—"}
                        </td>
                        <td
                          className="px-4 py-3 align-top text-right tabular-nums"
                          style={{ color: "var(--brand-green)" }}
                        >
                          {fmtEur(s.totalEur, 0)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </CardBody>
        </Card>
      )}

      <SectionDivider label="Categories" />

      {/* ── Categories table ── */}
      <Card>
        <CardHeader>
          <CardTitle>Savings by spending category</CardTitle>
          <Badge tone="positive">Switch &amp; save</Badge>
        </CardHeader>
        <CardBody className="!px-0 !py-0">
          {savings.byCategory.length === 0 ? (
            <div
              className="px-6 py-10 text-center text-[13px]"
              style={{ color: "var(--fg-muted)" }}
            >
              No transactions classified this month yet. Run a monthly close first.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-[13px]">
                <thead>
                  <tr
                    className="text-left"
                    style={{ borderBottom: "1px solid var(--border-faint)" }}
                  >
                    <th className="px-4 py-3">
                      <CodeLabel>Category</CodeLabel>
                    </th>
                    <th className="px-4 py-3 w-[140px] text-right">
                      <CodeLabel>Spend</CodeLabel>
                    </th>
                    <th className="px-4 py-3 w-[140px] text-right">
                      <CodeLabel>CO₂e</CodeLabel>
                    </th>
                    <th className="px-4 py-3 w-[160px] text-right">
                      <CodeLabel>Savings</CodeLabel>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {savings.byCategory.map((cat) => (
                    <tr
                      key={cat.category}
                      style={{
                        borderBottom: "1px solid var(--border-faint)",
                      }}
                    >
                      <td className="px-4 py-3 align-top">
                        <div className="flex items-center gap-2">
                          <span
                            className="inline-block rounded-full shrink-0"
                            style={{
                              width: 6,
                              height: 6,
                              background:
                                categoryColors[cat.category] ??
                                "var(--cat-other)",
                            }}
                          />
                          <span style={{ color: "var(--fg-primary)" }}>
                            {categoryLabels[cat.category] ?? cat.category}
                          </span>
                        </div>
                        {cat.topAlternative && (
                          <div
                            className="mt-1.5 text-[12px] max-w-[60ch]"
                            style={{ color: "var(--fg-secondary)" }}
                          >
                            <span style={{ color: "var(--brand-green)" }}>
                              {cat.topAlternative.alternative.switchLabel}
                            </span>
                            <span
                              className="ml-1"
                              style={{ color: "var(--fg-muted)" }}
                            >
                              · {cat.topAlternative.co2eReductionPct}% less CO₂e
                              {cat.topAlternative.costDifferenceEur > 0 && (
                                <>
                                  {" · "}
                                  saves{" "}
                                  {fmtEur(
                                    cat.topAlternative.costDifferenceEur,
                                    0,
                                  )}{" "}
                                  per tx
                                </>
                              )}
                            </span>
                          </div>
                        )}
                      </td>
                      <td
                        className="px-4 py-3 align-top text-right tabular-nums"
                        style={{ color: "var(--fg-secondary)" }}
                      >
                        {fmtEur(cat.spendEur, 0)}
                      </td>
                      <td
                        className="px-4 py-3 align-top text-right tabular-nums"
                        style={{ color: "var(--fg-secondary)" }}
                      >
                        {fmtKg(cat.co2eKg)}
                        <div
                          className="text-[11px] tabular-nums"
                          style={{ color: "var(--fg-faint)" }}
                        >
                          ± {fmtKg(cat.co2eKg * 0.15)}
                        </div>
                      </td>
                      <td
                        className="px-4 py-3 align-top text-right tabular-nums"
                        style={{
                          color:
                            cat.potentialSavingsEur > 0
                              ? "var(--brand-green)"
                              : "var(--fg-faint)",
                        }}
                      >
                        {cat.potentialSavingsEur > 0
                          ? fmtEur(cat.potentialSavingsEur, 0)
                          : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardBody>
      </Card>

      <SectionDivider label="Methodology" />

      {/* ── Methodology ── */}
      <Card>
        <CardHeader>
          <CardTitle>How Carbo calculates tax savings</CardTitle>
        </CardHeader>
        <CardBody className="space-y-4">
          <div
            className="text-[14px] leading-[1.6] max-w-[66ch]"
            style={{ color: "var(--fg-secondary)" }}
          >
            Each transaction is matched to Dutch tax schemes (EIA, MIA, Vamil)
            based on spending category and amount. Deduction rates are applied at
            the current corporate tax rate (
            <span className="tabular-nums">25.8%</span>).
          </div>
          <div
            className="text-[14px] leading-[1.6] max-w-[66ch]"
            style={{ color: "var(--fg-secondary)" }}
          >
            EU ETS carbon cost avoidance is calculated at{" "}
            <span className="tabular-nums">~€70/tCO₂e</span>. Lower-emission
            alternatives are identified per category with realistic price ratios.
          </div>
          <div
            className="text-[14px] leading-[1.6] max-w-[66ch]"
            style={{ color: "var(--fg-secondary)" }}
          >
            Annual projections assume current month patterns continue. Actual
            savings depend on investment timing, qualifying asset lists
            (Milieulijst / Energielijst), and your specific tax position.
          </div>
        </CardBody>
      </Card>
    </div>
  );
}
