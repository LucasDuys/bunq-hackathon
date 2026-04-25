import Link from "next/link";
import { Download, ShieldCheck } from "lucide-react";
import { buildAnnualReport } from "@/lib/reports/annual";
import { enrichWithNarrative } from "@/lib/agent/annual-narrative";
import { fmtEur } from "@/lib/utils";

export const dynamic = "force-dynamic";

const STATUS_LABEL = {
  filled: "Filled",
  stub: "Stub · review",
  missing: "Required",
} as const;

type SectionStatus = "filled" | "stub" | "missing";

function StatusPill({ status }: { status: SectionStatus }) {
  return (
    <span className={`rp-status-pill rp-status-pill--${status}`}>
      {STATUS_LABEL[status]}
    </span>
  );
}

function categoryColor(cat: string): string {
  const c = cat.toLowerCase();
  if (c.includes("scope1") || c.includes("fuel")) return "var(--cat-fuel)";
  if (c.includes("scope2") || c.includes("electric")) return "var(--cat-electricity)";
  if (c.includes("travel") || c.includes("cat6")) return "var(--cat-travel)";
  if (c.includes("digital") || c.includes("saas")) return "var(--cat-digital)";
  if (c.includes("good") || c.includes("cat1")) return "var(--cat-goods)";
  if (c.includes("service")) return "var(--cat-services)";
  return "var(--cat-other)";
}

function formatScopeName(cat: string): string {
  return cat.replace(/^cat\d+_/, "Cat ").replace(/_/g, " ");
}

const ReportSection = ({
  id,
  num,
  title,
  status,
  children,
}: {
  id: string;
  num: string;
  title: string;
  status: SectionStatus;
  children: React.ReactNode;
}) => (
  <section id={id} className="rp-section">
    <div className="rp-section__head">
      <span className="rp-section__num">{num}</span>
      <h2 className="rp-section__title">{title}</h2>
      <span className="rp-section__rule" />
      <span className="rp-section__status">
        <StatusPill status={status} />
      </span>
    </div>
    <div className="text-[15px]" style={{ color: "var(--fg-secondary)", lineHeight: 1.6 }}>
      {children}
    </div>
  </section>
);

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
  const creditsT = report.credits?.totalTonnesRetired ?? 0;

  // Build TOC entries with status, ordered by E1-N
  const toc: Array<{ id: string; num: string; title: string; status: SectionStatus }> = [
    { id: "e1-1", num: "E1-1", title: "Transition plan", status: "stub" },
    { id: "e1-2", num: "E1-2", title: "Climate policies", status: "missing" },
    { id: "e1-3", num: "E1-3", title: "Actions & resources", status: "filled" },
    { id: "e1-4", num: "E1-4", title: "Targets", status: "missing" },
    { id: "e1-5", num: "E1-5", title: "Energy mix", status: report.energy ? "filled" : "missing" },
    { id: "e1-6", num: "E1-6", title: "Gross GHG emissions", status: "filled" },
    {
      id: "e1-7",
      num: "E1-7",
      title: "Removals & credits",
      status: creditsT > 0 ? "filled" : "missing",
    },
    {
      id: "e1-8",
      num: "E1-8",
      title: "Internal carbon pricing",
      status: report.internalCarbonPrice ? "filled" : "missing",
    },
    { id: "e1-9", num: "E1-9", title: "Anticipated financial effects", status: "missing" },
    { id: "methodology", num: "Apx.", title: "Methodology", status: "filled" },
  ];

  return (
    <div className="rp-stagger flex flex-col gap-12">
      {/* ── Bookplate cover ─────────────────────────────── */}
      <header className="rp-bookplate">
        <div className="rp-bookplate__cover">
          <span className="rp-bookplate__line">{report.framework} · ESRS E1-aligned</span>
          <span className="rp-bookplate__year">{report.reportingYear}</span>
          <h1 className="rp-bookplate__company">{report.company}</h1>
          <p className="rp-bookplate__tagline">
            Annual carbon &amp; climate disclosure — auto-rolled from the bunq ledger and the close-run audit
            trail. Status badges throughout indicate which sections are auto-filled, which are stubs awaiting
            review, and which require a human contribution.
          </p>
          <div className="flex items-center justify-center gap-3 pt-2 flex-wrap">
            <span className="rp-status-pill rp-status-pill--filled">
              <ShieldCheck className="h-3 w-3" />
              {report.assurance.level === "none" ? "No external assurance" : report.assurance.level}
            </span>
            <Link
              href={`/report/annual/${year}/pdf`}
              target="_blank"
              className="inline-flex items-center gap-2 h-9 px-4 rounded-full text-[13px] font-medium transition-[border-color,background] duration-150 ease-out"
              style={{
                color: "var(--fg-primary)",
                border: "1px solid var(--border-default)",
                background: "var(--bg-button)",
              }}
            >
              <Download className="h-3.5 w-3.5" />
              Download PDF
            </Link>
          </div>
        </div>
      </header>

      {/* ── KPI strip ─────────────────────────────────── */}
      <section className="rp-kpis">
        <div className="rp-kpis__cell">
          <span className="rp-kpis__label">Total CO₂e</span>
          <span className="rp-kpis__value">
            {totalT.toFixed(2)}
            <span className="rp-kpis__value-unit">tCO₂e</span>
          </span>
          <span className="rp-kpis__sub">scope 1 + 2 + 3</span>
        </div>
        <div className="rp-kpis__cell">
          <span className="rp-kpis__label">Scope 1 + 2</span>
          <span className="rp-kpis__value">
            {scope12T.toFixed(2)}
            <span className="rp-kpis__value-unit">tCO₂e</span>
          </span>
          <span className="rp-kpis__sub">direct + purchased energy</span>
        </div>
        <div className="rp-kpis__cell">
          <span className="rp-kpis__label">Credits retired</span>
          <span
            className="rp-kpis__value"
            style={{ color: creditsT > 0 ? "var(--brand-green)" : "var(--fg-primary)" }}
          >
            {creditsT.toFixed(2)}
            <span className="rp-kpis__value-unit">tCO₂e</span>
          </span>
          <span className="rp-kpis__sub">
            {report.credits?.totalSpendEur
              ? fmtEur(report.credits.totalSpendEur)
              : "no purchases this year"}
          </span>
        </div>
        <div className="rp-kpis__cell">
          <span className="rp-kpis__label">Internal carbon price</span>
          <span className="rp-kpis__value">
            {report.internalCarbonPrice
              ? fmtEur(report.internalCarbonPrice.pricePerTco2eEur).replace("€", "").trim()
              : "—"}
            {report.internalCarbonPrice && (
              <span className="rp-kpis__value-unit">€/tCO₂e</span>
            )}
          </span>
          <span className="rp-kpis__sub">policy-implied</span>
        </div>
      </section>

      {/* ── Body: TOC rail + content ───────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-[220px_minmax(0,1fr)] gap-12">
        {/* TOC (sticky on desktop) */}
        <aside className="hidden lg:block">
          <nav className="rp-toc">
            <div className="rp-toc__title">Contents</div>
            {toc.map((t) => (
              <a key={t.id} href={`#${t.id}`} className="rp-toc__link">
                <span className="rp-toc__num">{t.num}</span>
                <span>{t.title}</span>
                <span className={`rp-toc__dot rp-toc__dot--${t.status}`} aria-hidden />
              </a>
            ))}
          </nav>
        </aside>

        {/* Sections */}
        <div className="flex flex-col gap-14 min-w-0">
          <ReportSection id="e1-1" num="E1-1" title="Transition plan for climate change mitigation" status="stub">
            <p className="m-0 max-w-[62ch] whitespace-pre-wrap">
              {report.transitionPlanSummary ?? "—"}
            </p>
          </ReportSection>

          <ReportSection id="e1-2" num="E1-2" title="Policies related to climate change" status="missing">
            <p className="m-0 max-w-[62ch]">
              The company must list climate-related policies (procurement, travel, energy, supplier code).
              Carbo does not infer policies from spend — these are a human contribution.
            </p>
          </ReportSection>

          <ReportSection id="e1-3" num="E1-3" title="Actions and resources allocated" status="filled">
            <p className="m-0 max-w-[62ch]" style={{ color: "var(--fg-primary)" }}>
              {report.actionSummary}
            </p>
          </ReportSection>

          <ReportSection id="e1-4" num="E1-4" title="Targets" status="missing">
            <p className="m-0 max-w-[62ch]">
              No SBTi-validated reduction targets are on file. The company must set short-, medium-, and
              long-term targets covering Scope 1, 2 and material Scope 3 categories before this section can be
              published.
            </p>
          </ReportSection>

          <ReportSection
            id="e1-5"
            num="E1-5"
            title="Energy consumption and mix"
            status={report.energy ? "filled" : "missing"}
          >
            {report.energy ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 max-w-[60ch]">
                <div className="rp-statcard">
                  <span className="rp-statcard__label">Total energy</span>
                  <span className="rp-statcard__value">
                    {report.energy.totalMwh ?? 0}
                    <span className="rp-statcard__value-unit">MWh</span>
                  </span>
                  <span className="rp-statcard__sub">all sources</span>
                </div>
                <div className="rp-statcard">
                  <span className="rp-statcard__label">Renewable share</span>
                  <span className="rp-statcard__value" style={{ color: "var(--brand-green)" }}>
                    {report.energy.renewablePct ?? 0}
                    <span className="rp-statcard__value-unit">%</span>
                  </span>
                  <span className="rp-statcard__sub">of total MWh</span>
                </div>
              </div>
            ) : (
              <p className="m-0 max-w-[62ch]">
                Energy disclosure requires utility meter data not flowing through bunq. Add utility-bill
                ingestion or supply readings to populate this section.
              </p>
            )}
          </ReportSection>

          <ReportSection id="e1-6" num="E1-6" title="Gross Scope 1, 2, 3 and total GHG emissions" status="filled">
            <div className="overflow-x-auto">
              <table className="rp-table">
                <thead>
                  <tr>
                    <th>Scope / category</th>
                    <th className="is-num">tCO₂e</th>
                    <th>Method</th>
                    <th className="is-num" style={{ width: 200 }}>Share</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>
                      <span
                        className="rp-cat-dot"
                        style={{ "--cat": categoryColor("scope1") } as React.CSSProperties}
                      >
                        Scope 1 — direct combustion
                      </span>
                    </td>
                    <td className="is-num">{(report.emissions.scope1.totalTco2e ?? 0).toFixed(2)}</td>
                    <td>
                      <span
                        className="rp-cat-pill"
                        style={{ "--cat": "var(--fg-muted)" } as React.CSSProperties}
                      >
                        activity
                      </span>
                    </td>
                    <td className="is-num">
                      <div className="rp-share-cell">
                        <div className="rp-share-bar">
                          <div
                            className="rp-share-bar__fill"
                            style={
                              {
                                width: `${
                                  totalT > 0 ? ((report.emissions.scope1.totalTco2e ?? 0) / totalT) * 100 : 0
                                }%`,
                                "--fill": categoryColor("scope1"),
                              } as React.CSSProperties
                            }
                          />
                        </div>
                        <span className="rp-share-pct">
                          {totalT > 0
                            ? `${(((report.emissions.scope1.totalTco2e ?? 0) / totalT) * 100).toFixed(0)}%`
                            : "—"}
                        </span>
                      </div>
                    </td>
                  </tr>
                  <tr>
                    <td>
                      <span
                        className="rp-cat-dot"
                        style={{ "--cat": categoryColor("scope2") } as React.CSSProperties}
                      >
                        Scope 2 — purchased electricity
                      </span>
                    </td>
                    <td className="is-num">
                      {(report.emissions.scope2.locationBasedTco2e ?? 0).toFixed(2)}
                    </td>
                    <td>
                      <span
                        className="rp-cat-pill"
                        style={{ "--cat": "var(--fg-muted)" } as React.CSSProperties}
                      >
                        spend-based
                      </span>
                    </td>
                    <td className="is-num">
                      <div className="rp-share-cell">
                        <div className="rp-share-bar">
                          <div
                            className="rp-share-bar__fill"
                            style={
                              {
                                width: `${
                                  totalT > 0
                                    ? ((report.emissions.scope2.locationBasedTco2e ?? 0) / totalT) * 100
                                    : 0
                                }%`,
                                "--fill": categoryColor("scope2"),
                              } as React.CSSProperties
                            }
                          />
                        </div>
                        <span className="rp-share-pct">
                          {totalT > 0
                            ? `${(((report.emissions.scope2.locationBasedTco2e ?? 0) / totalT) * 100).toFixed(0)}%`
                            : "—"}
                        </span>
                      </div>
                    </td>
                  </tr>
                  {reportedScope3.map((s) => (
                    <tr key={s.category}>
                      <td>
                        <span
                          className="rp-cat-dot"
                          style={{ "--cat": categoryColor(s.category) } as React.CSSProperties}
                        >
                          Scope 3 — {formatScopeName(s.category)}
                        </span>
                      </td>
                      <td className="is-num">{(s.tco2e ?? 0).toFixed(2)}</td>
                      <td>
                        <span
                          className="rp-cat-pill"
                          style={{ "--cat": "var(--fg-muted)" } as React.CSSProperties}
                        >
                          {s.method ?? "—"}
                        </span>
                      </td>
                      <td className="is-num">
                        <div className="rp-share-cell">
                          <div className="rp-share-bar">
                            <div
                              className="rp-share-bar__fill"
                              style={
                                {
                                  width: `${totalT > 0 ? ((s.tco2e ?? 0) / totalT) * 100 : 0}%`,
                                  "--fill": categoryColor(s.category),
                                } as React.CSSProperties
                              }
                            />
                          </div>
                          <span className="rp-share-pct">
                            {totalT > 0 ? `${(((s.tco2e ?? 0) / totalT) * 100).toFixed(0)}%` : "—"}
                          </span>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr>
                    <td>
                      <span
                        className="font-mono text-[11px]"
                        style={{
                          letterSpacing: "1.2px",
                          textTransform: "uppercase",
                          color: "var(--fg-muted)",
                        }}
                      >
                        Total
                      </span>
                    </td>
                    <td className="is-num">{totalT.toFixed(2)}</td>
                    <td />
                    <td className="is-num">100%</td>
                  </tr>
                </tfoot>
              </table>
            </div>

            <p
              className="text-[12px] mt-4 m-0"
              style={{
                color: "var(--fg-muted)",
                fontFamily: "var(--font-mono)",
                letterSpacing: "1px",
                textTransform: "uppercase",
              }}
            >
              {immaterialScope3.length} cat. excluded as immaterial · {naScope3.length} cat. not applicable ·
              See PDF for category-level rationale
            </p>
          </ReportSection>

          <ReportSection
            id="e1-7"
            num="E1-7"
            title="GHG removals and carbon credits"
            status={creditsT > 0 ? "filled" : "missing"}
          >
            {creditsT > 0 ? (
              <div className="flex flex-col gap-5">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="rp-statcard rp-statcard--accent">
                    <span className="rp-statcard__label">Retired</span>
                    <span className="rp-statcard__value">
                      {creditsT.toFixed(2)}
                      <span className="rp-statcard__value-unit">tCO₂e</span>
                    </span>
                    <span className="rp-statcard__sub">
                      across {report.credits?.projects.length ?? 0} project
                      {(report.credits?.projects.length ?? 0) === 1 ? "" : "s"}
                    </span>
                  </div>
                  <div className="rp-statcard">
                    <span className="rp-statcard__label">EU registry</span>
                    <span className="rp-statcard__value">
                      {(report.credits?.euBasedPct ?? 0).toFixed(0)}
                      <span className="rp-statcard__value-unit">%</span>
                    </span>
                    <span className="rp-statcard__sub">of retired tonnes</span>
                  </div>
                  <div className="rp-statcard">
                    <span className="rp-statcard__label">Removal share</span>
                    <span className="rp-statcard__value">
                      {(report.credits?.removalPct ?? 0).toFixed(0)}
                      <span className="rp-statcard__value-unit">%</span>
                    </span>
                    <span className="rp-statcard__sub">vs reduction credits</span>
                  </div>
                </div>
                <p
                  className="text-[13px] m-0"
                  style={{ color: "var(--fg-muted)", maxWidth: "62ch" }}
                >
                  Total spend: {fmtEur(report.credits?.totalSpendEur ?? 0)}. Retirements are scoped to close-run
                  end-times; per-project receipts are appended to the audit ledger.
                </p>
              </div>
            ) : (
              <p className="m-0 max-w-[62ch]">
                No carbon credits retired in {year}. The reserve has accumulated funds (see E1-3) but no
                purchases were executed against them this period.
              </p>
            )}
          </ReportSection>

          <ReportSection
            id="e1-8"
            num="E1-8"
            title="Internal carbon pricing"
            status={report.internalCarbonPrice ? "filled" : "missing"}
          >
            {report.internalCarbonPrice ? (
              <div className="flex flex-col gap-4 max-w-[62ch]">
                <div className="rp-bignum">
                  <span className="rp-bignum__value" style={{ fontSize: "clamp(40px, 6vw, 64px)" }}>
                    {fmtEur(report.internalCarbonPrice.pricePerTco2eEur).replace("€", "").trim()}
                  </span>
                  <span className="rp-bignum__unit">€ / tCO₂e · {report.internalCarbonPrice.type}</span>
                </div>
                <p className="m-0">{report.internalCarbonPrice.perimeterDescription}</p>
              </div>
            ) : (
              <p className="m-0 max-w-[62ch]">
                No active reserve policy with{" "}
                <code
                  className="font-mono text-[12px] px-1 py-0.5 rounded"
                  style={{ background: "var(--bg-inset)", color: "var(--fg-secondary)" }}
                >
                  eur_per_kg_co2e
                </code>{" "}
                — no implied internal carbon price.
              </p>
            )}
          </ReportSection>

          <ReportSection id="e1-9" num="E1-9" title="Anticipated financial effects" status="missing">
            <p className="m-0 max-w-[62ch]">
              Quantitative financial-effects assessment requires scenario analysis and risk-management input.
              Out of scope for an automated rollup.
            </p>
          </ReportSection>

          {/* ── Methodology appendix ───────────────────── */}
          <section id="methodology" className="rp-section">
            <div className="rp-section__head">
              <span className="rp-section__num">Appendix</span>
              <h2 className="rp-section__title">Methodology &amp; assurance</h2>
              <span className="rp-section__rule" />
              <span className="rp-section__status">
                <StatusPill status="filled" />
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-10 gap-y-6 text-[14px]" style={{ color: "var(--fg-secondary)" }}>
              <div className="flex flex-col gap-2">
                <span
                  className="font-mono text-[11px]"
                  style={{ letterSpacing: "1.2px", textTransform: "uppercase", color: "var(--brand-green)" }}
                >
                  Standard
                </span>
                <p className="m-0" style={{ lineHeight: 1.6 }}>
                  {report.methodology.ghgProtocolVersion} · GWP IPCC{" "}
                  {report.methodology.gwpAssessmentReport} · Scope 2:{" "}
                  {report.methodology.scope2MethodsUsed.join(" + ")}
                </p>
              </div>
              <div className="flex flex-col gap-2">
                <span
                  className="font-mono text-[11px]"
                  style={{ letterSpacing: "1.2px", textTransform: "uppercase", color: "var(--brand-green)" }}
                >
                  Boundary
                </span>
                <p className="m-0" style={{ lineHeight: 1.6 }}>
                  Operational control. Scope 1 from fuel-category transactions, Scope 2 from utilities, Scope 3
                  Cat 1 from goods/services, Cat 6 from travel.
                </p>
              </div>
              <div className="flex flex-col gap-2 md:col-span-2">
                <span
                  className="font-mono text-[11px]"
                  style={{ letterSpacing: "1.2px", textTransform: "uppercase", color: "var(--brand-green)" }}
                >
                  Factor sources · {report.methodology.factorSources.length}
                </span>
                <p className="m-0" style={{ lineHeight: 1.6 }}>
                  {report.methodology.factorSources.join(" · ")}
                </p>
              </div>
              <div className="flex flex-col gap-2 md:col-span-2">
                <span
                  className="font-mono text-[11px]"
                  style={{ letterSpacing: "1.2px", textTransform: "uppercase", color: "var(--brand-green)" }}
                >
                  Assurance
                </span>
                <p className="m-0" style={{ lineHeight: 1.6 }}>
                  <span style={{ color: "var(--fg-primary)" }}>
                    {report.assurance.level === "none"
                      ? "No external assurance."
                      : report.assurance.level}
                  </span>{" "}
                  {report.assurance.scopeNote}
                </p>
              </div>
            </div>

            <p
              className="m-0 text-[12px] pt-6 mt-2 border-t"
              style={{
                color: "var(--fg-muted)",
                borderColor: "var(--border-faint)",
                fontFamily: "var(--font-mono)",
                letterSpacing: "1px",
                textTransform: "uppercase",
              }}
            >
              Report compiled {new Date().toISOString().slice(0, 10)} · {report.framework} ·{" "}
              {report.company} {report.reportingYear}
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
