import Link from "next/link";
import { Download } from "lucide-react";
import { Badge, Card, CardBody, CardHeader, CardTitle, Stat } from "@/components/ui";
import { buildAnnualReport } from "@/lib/reports/annual";
import { enrichWithNarrative } from "@/lib/agent/annual-narrative";
import { fmtEur, fmtKg } from "@/lib/utils";

export const dynamic = "force-dynamic";

const STATUS_LABEL = {
  filled: "Filled",
  stub: "Stub — review",
  missing: "Required from you",
} as const;

const SectionCard = ({
  eyebrow,
  title,
  status,
  children,
}: {
  eyebrow: string;
  title: string;
  status: "filled" | "stub" | "missing";
  children: React.ReactNode;
}) => {
  const tone =
    status === "filled" ? "positive" : status === "stub" ? "warning" : "default";
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <div className="text-[10px] uppercase tracking-wide text-zinc-500">{eyebrow}</div>
            <CardTitle>{title}</CardTitle>
          </div>
          <Badge tone={tone}>{STATUS_LABEL[status]}</Badge>
        </div>
      </CardHeader>
      <CardBody>{children}</CardBody>
    </Card>
  );
};

export default async function AnnualReportPage({
  params,
}: {
  params: Promise<{ year: string }>;
}) {
  const { year: yearStr } = await params;
  const year = Number(yearStr);
  const baseReport = await buildAnnualReport({ year });
  const report = await enrichWithNarrative(baseReport);

  const totalT = report.emissions.totalTco2e ?? 0;
  const scope12T = report.emissions.totalScope1And2Tco2e ?? 0;
  const reportedScope3 = report.emissions.scope3.filter((s) => s.tco2e !== null);
  const naScope3 = report.emissions.scope3.filter((s) => s.notApplicable);
  const immaterialScope3 = report.emissions.scope3.filter((s) => s.excludedAsImmaterial);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-start justify-between">
        <div>
          <div className="text-xs uppercase tracking-wide text-zinc-500">Annual carbon report</div>
          <h1 className="text-2xl font-semibold mt-1">
            {report.company} — {report.reportingYear}
          </h1>
          <p className="text-sm text-zinc-600 dark:text-zinc-400 mt-1">
            Framework {report.framework} · status badges show what is auto-filled vs needs human review.
          </p>
        </div>
        <Link
          href={`/report/annual/${year}/pdf`}
          target="_blank"
          className="inline-flex items-center gap-1.5 rounded-md border border-zinc-300 dark:border-zinc-700 px-3 py-1.5 text-sm hover:bg-zinc-50 dark:hover:bg-zinc-900"
        >
          <Download className="h-3.5 w-3.5" />
          <span>PDF</span>
        </Link>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardBody>
            <Stat label="Total CO₂e" value={`${totalT.toFixed(2)} t`} sub="scope 1 + 2 + 3" tone="default" />
          </CardBody>
        </Card>
        <Card>
          <CardBody>
            <Stat label="Scope 1 + 2" value={`${scope12T.toFixed(2)} t`} sub="direct + purchased energy" />
          </CardBody>
        </Card>
        <Card>
          <CardBody>
            <Stat
              label="Credits retired"
              value={report.credits ? `${(report.credits.totalTonnesRetired ?? 0).toFixed(2)} t` : "0 t"}
              sub={report.credits?.totalSpendEur ? fmtEur(report.credits.totalSpendEur) : "no purchases this year"}
              tone="positive"
            />
          </CardBody>
        </Card>
        <Card>
          <CardBody>
            <Stat
              label="Internal carbon price"
              value={report.internalCarbonPrice ? `${fmtEur(report.internalCarbonPrice.pricePerTco2eEur)}/t` : "n/a"}
              sub="policy-implied"
            />
          </CardBody>
        </Card>
      </div>

      <SectionCard eyebrow="E1-1" title="Transition plan for climate change mitigation" status="stub">
        <pre className="text-sm leading-relaxed whitespace-pre-wrap font-sans">{report.transitionPlanSummary ?? "—"}</pre>
      </SectionCard>

      <SectionCard eyebrow="E1-2" title="Policies related to climate change" status="missing">
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Company must list climate-related policies (procurement, travel, energy, supplier code). Carbo does not infer policies from spend.
        </p>
      </SectionCard>

      <SectionCard eyebrow="E1-3" title="Actions and resources allocated" status="filled">
        <p className="text-sm leading-relaxed">{report.actionSummary}</p>
      </SectionCard>

      <SectionCard eyebrow="E1-4" title="Targets" status="missing">
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          No SBTi-validated reduction targets are on file. The company must set short-, medium-, and long-term targets covering Scope 1, 2 and material Scope 3 categories before this section can be published.
        </p>
      </SectionCard>

      <SectionCard eyebrow="E1-5" title="Energy consumption and mix" status={report.energy ? "filled" : "missing"}>
        {report.energy ? (
          <p className="text-sm">Total {report.energy.totalMwh ?? 0} MWh · {report.energy.renewablePct ?? 0}% renewable.</p>
        ) : (
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            Energy disclosure requires utility meter data not flowing through bunq. Add utility-bill ingestion or supply readings.
          </p>
        )}
      </SectionCard>

      <SectionCard eyebrow="E1-6" title="Gross Scope 1, 2, 3 and total GHG emissions" status="filled">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs uppercase text-zinc-500 border-b border-zinc-200 dark:border-zinc-800">
              <th className="py-2 pr-4">Scope / category</th>
              <th className="py-2 pr-4 text-right">tCO₂e</th>
              <th className="py-2 pr-4 text-right">Method</th>
              <th className="py-2 text-right">Share</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-b border-zinc-100 dark:border-zinc-900">
              <td className="py-2 pr-4">Scope 1 — direct combustion</td>
              <td className="py-2 pr-4 text-right tabular-nums">{(report.emissions.scope1.totalTco2e ?? 0).toFixed(2)}</td>
              <td className="py-2 pr-4 text-right text-zinc-500">activity</td>
              <td className="py-2 text-right tabular-nums">
                {totalT > 0 ? `${(((report.emissions.scope1.totalTco2e ?? 0) / totalT) * 100).toFixed(0)}%` : "—"}
              </td>
            </tr>
            <tr className="border-b border-zinc-100 dark:border-zinc-900">
              <td className="py-2 pr-4">Scope 2 — purchased electricity (location-based)</td>
              <td className="py-2 pr-4 text-right tabular-nums">{(report.emissions.scope2.locationBasedTco2e ?? 0).toFixed(2)}</td>
              <td className="py-2 pr-4 text-right text-zinc-500">spend-based</td>
              <td className="py-2 text-right tabular-nums">
                {totalT > 0 ? `${(((report.emissions.scope2.locationBasedTco2e ?? 0) / totalT) * 100).toFixed(0)}%` : "—"}
              </td>
            </tr>
            {reportedScope3.map((s) => (
              <tr key={s.category} className="border-b border-zinc-100 dark:border-zinc-900">
                <td className="py-2 pr-4">Scope 3 — {s.category.replace(/^cat\d+_/, "Cat ").replace(/_/g, " ")}</td>
                <td className="py-2 pr-4 text-right tabular-nums">{(s.tco2e ?? 0).toFixed(2)}</td>
                <td className="py-2 pr-4 text-right text-zinc-500">{s.method ?? "—"}</td>
                <td className="py-2 text-right tabular-nums">
                  {totalT > 0 ? `${(((s.tco2e ?? 0) / totalT) * 100).toFixed(0)}%` : "—"}
                </td>
              </tr>
            ))}
            <tr className="font-medium border-t border-zinc-300 dark:border-zinc-700">
              <td className="py-2 pr-4">Total</td>
              <td className="py-2 pr-4 text-right tabular-nums">{totalT.toFixed(2)}</td>
              <td className="py-2 pr-4"></td>
              <td className="py-2 text-right tabular-nums">100%</td>
            </tr>
          </tbody>
        </table>
        <p className="text-xs text-zinc-500 mt-3">
          {immaterialScope3.length} categories excluded as immaterial · {naScope3.length} categories not applicable · See PDF for category-level rationale.
        </p>
      </SectionCard>

      <SectionCard
        eyebrow="E1-7"
        title="GHG removals and carbon credits"
        status={report.credits && (report.credits.totalTonnesRetired ?? 0) > 0 ? "filled" : "missing"}
      >
        {report.credits && (report.credits.totalTonnesRetired ?? 0) > 0 ? (
          <div>
            <div className="text-sm">
              {report.credits.totalTonnesRetired?.toFixed(2)} t retired across {report.credits.projects.length} projects · {fmtEur(report.credits.totalSpendEur ?? 0)} · EU-based {(report.credits.euBasedPct ?? 0).toFixed(0)}% · Removal share {(report.credits.removalPct ?? 0).toFixed(0)}%
            </div>
          </div>
        ) : (
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            No carbon credits retired in {year}. Reserve has accumulated funds (see E1-3) but no purchases were executed against them this period.
          </p>
        )}
      </SectionCard>

      <SectionCard
        eyebrow="E1-8"
        title="Internal carbon pricing"
        status={report.internalCarbonPrice ? "filled" : "missing"}
      >
        {report.internalCarbonPrice ? (
          <p className="text-sm">
            {fmtEur(report.internalCarbonPrice.pricePerTco2eEur)} per tCO₂e ({report.internalCarbonPrice.type}). {report.internalCarbonPrice.perimeterDescription}
          </p>
        ) : (
          <p className="text-sm text-zinc-600 dark:text-zinc-400">No active reserve policy with eur_per_kg_co2e — no implied internal carbon price.</p>
        )}
      </SectionCard>

      <SectionCard eyebrow="E1-9" title="Anticipated financial effects" status="missing">
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Quantitative financial-effects assessment requires scenario analysis and risk-management input. Out of scope for an automated rollup.
        </p>
      </SectionCard>

      <Card>
        <CardHeader>
          <CardTitle>Methodology</CardTitle>
        </CardHeader>
        <CardBody className="text-sm text-zinc-600 dark:text-zinc-400 space-y-2">
          <p>
            <strong>Standard:</strong> {report.methodology.ghgProtocolVersion} · <strong>Scope 2:</strong> {report.methodology.scope2MethodsUsed.join(", ")} · <strong>GWP:</strong> IPCC {report.methodology.gwpAssessmentReport}
          </p>
          <p><strong>Factor sources ({report.methodology.factorSources.length}):</strong> {report.methodology.factorSources.join(" · ")}</p>
          <p>
            <strong>Boundary:</strong> Operational control. Scope 1 from fuel-category transactions, Scope 2 from utility-category, Scope 3 Cat 1 from food/procurement/cloud/services, Cat 6 from travel.
          </p>
          <p>
            <strong>Assurance:</strong> {report.assurance.level === "none" ? "No external assurance." : report.assurance.level} · {report.assurance.scopeNote}
          </p>
        </CardBody>
      </Card>
    </div>
  );
}
