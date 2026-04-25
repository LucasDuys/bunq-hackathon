import { Document, Page, Text, View, StyleSheet, Font, type DocumentProps } from "@react-pdf/renderer";
import type { ReactElement } from "react";
import path from "node:path";
import type { CarbonReport, Scope3Item } from "./schema";

/**
 * CSRD ESRS E1 - shaped annual report PDF. Same Easy Green design
 * system as the briefing PDF. Each E1 section carries a status badge:
 *
 *   - filled  : reproducible from the ledger
 *   - stub    : Carbo's pre-fill, requires human review
 *   - missing : section the company must author externally
 *
 * Numbers in filled sections never come from Claude - only narratives.
 */

const FONT_DIR = path.join(process.cwd(), "public", "fonts");
try {
  Font.register({
    family: "Inter",
    fonts: [
      { src: path.join(FONT_DIR, "Inter-Variable.ttf"), fontWeight: 400 },
      { src: path.join(FONT_DIR, "Inter-Variable.ttf"), fontWeight: 500 },
      { src: path.join(FONT_DIR, "Inter-Variable.ttf"), fontWeight: 600 },
      { src: path.join(FONT_DIR, "Inter-Variable.ttf"), fontWeight: 700 },
    ],
  });
  Font.register({
    family: "Montserrat",
    fonts: [
      { src: path.join(FONT_DIR, "Montserrat-Variable.ttf"), fontWeight: 600 },
      { src: path.join(FONT_DIR, "Montserrat-Variable.ttf"), fontWeight: 700 },
      { src: path.join(FONT_DIR, "Montserrat-Variable.ttf"), fontWeight: 800 },
    ],
  });
  Font.registerHyphenationCallback((word) => [word]);
} catch {
  // Helvetica fallback.
}

const COLOR = {
  forest950: "#002E1B",
  forest800: "#005d36",
  forest600: "#0e6b40",
  mint500: "#00ff95",
  mint200: "#cdffad",
  mint100: "#e2f6d5",
  ink: "#0e0f0c",
  fgPrimary: "#0e0f0c",
  fgSecondary: "#454745",
  fgMuted: "#737373",
  fgOnAccent: "#002E1B",
  paper: "#fafaf9",
  surface: "#ffffff",
  surfaceMuted: "#f6f6f6",
  borderDefault: "rgba(14,15,12,0.12)",
  // status pill backgrounds
  statusFilledBg: "#e2f6d5",
  statusFilledFg: "#005d36",
  statusStubBg: "#fef3c7",
  statusStubFg: "#92400e",
  statusMissingBg: "#f3f4f6",
  statusMissingFg: "#6b7280",
};

const SCOPE3_LABELS: Record<Scope3Item["category"], string> = {
  cat1_purchased_goods_services: "Cat 1 - Purchased goods & services",
  cat2_capital_goods: "Cat 2 - Capital goods",
  cat3_fuel_energy_related: "Cat 3 - Fuel & energy related",
  cat4_upstream_transportation: "Cat 4 - Upstream transportation",
  cat5_waste_in_operations: "Cat 5 - Waste in operations",
  cat6_business_travel: "Cat 6 - Business travel",
  cat7_employee_commuting: "Cat 7 - Employee commuting",
  cat8_upstream_leased_assets: "Cat 8 - Upstream leased assets",
  cat9_downstream_transportation: "Cat 9 - Downstream transportation",
  cat10_processing_sold_products: "Cat 10 - Processing of sold products",
  cat11_use_of_sold_products: "Cat 11 - Use of sold products",
  cat12_end_of_life: "Cat 12 - End-of-life treatment",
  cat13_downstream_leased_assets: "Cat 13 - Downstream leased assets",
  cat14_franchises: "Cat 14 - Franchises",
  cat15_investments: "Cat 15 - Investments",
};

const styles = StyleSheet.create({
  page: { padding: 0, fontSize: 10, color: COLOR.ink, fontFamily: "Inter", backgroundColor: COLOR.paper },
  pageBody: { paddingHorizontal: 40, paddingTop: 22, paddingBottom: 50 },

  // Header bar
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 40,
    paddingVertical: 14,
    backgroundColor: COLOR.forest950,
  },
  headerBrand: { fontFamily: "Montserrat", fontWeight: 800, fontSize: 14, color: COLOR.mint500, letterSpacing: -0.3 },
  headerOrg: { fontFamily: "Inter", fontWeight: 500, fontSize: 9, color: COLOR.mint200 },

  // Cover hero
  coverHero: { paddingTop: 80, paddingBottom: 30 },
  coverEyebrow: {
    fontFamily: "Inter",
    fontWeight: 700,
    fontSize: 8,
    color: COLOR.forest600,
    letterSpacing: 1.2,
    textTransform: "uppercase",
    marginBottom: 8,
  },
  coverTitle: {
    fontFamily: "Montserrat",
    fontWeight: 800,
    fontSize: 42,
    color: COLOR.forest950,
    letterSpacing: -1,
    lineHeight: 1.05,
    marginBottom: 6,
  },
  coverSub: {
    fontFamily: "Inter",
    fontWeight: 500,
    fontSize: 11,
    color: COLOR.fgSecondary,
    marginBottom: 24,
  },

  // Hero KPI grid (cover page)
  heroKpis: { flexDirection: "row", gap: 10, marginTop: 18 },
  heroKpi: {
    flex: 1,
    paddingVertical: 14,
    paddingHorizontal: 14,
    backgroundColor: COLOR.surface,
    borderWidth: 0.6,
    borderColor: COLOR.borderDefault,
    borderRadius: 12,
  },
  heroKpiAccent: {
    flex: 1,
    paddingVertical: 14,
    paddingHorizontal: 14,
    backgroundColor: COLOR.mint100,
    borderWidth: 0.6,
    borderColor: COLOR.mint200,
    borderRadius: 12,
  },
  heroKpiLabel: {
    fontFamily: "Inter",
    fontWeight: 600,
    fontSize: 7,
    color: COLOR.fgMuted,
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  heroKpiValue: {
    fontFamily: "Montserrat",
    fontWeight: 800,
    fontSize: 22,
    color: COLOR.forest950,
    marginTop: 6,
    letterSpacing: -0.5,
  },
  heroKpiSub: { fontFamily: "Inter", fontWeight: 500, fontSize: 8, color: COLOR.fgSecondary, marginTop: 3 },

  legend: { marginTop: 30, padding: 14, backgroundColor: COLOR.surfaceMuted, borderRadius: 12 },
  legendTitle: { fontFamily: "Inter", fontWeight: 700, fontSize: 9, color: COLOR.fgPrimary, marginBottom: 8 },
  legendRow: { flexDirection: "row", alignItems: "center", marginBottom: 4 },
  legendBadge: {
    fontFamily: "Inter",
    fontWeight: 700,
    fontSize: 8,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginRight: 8,
    width: 60,
    textAlign: "center",
  },
  legendText: { fontFamily: "Inter", fontWeight: 500, fontSize: 9, color: COLOR.fgSecondary },

  // Section
  sectionPage: { paddingTop: 22 },
  sectionEyebrow: {
    fontFamily: "Inter",
    fontWeight: 700,
    fontSize: 8,
    color: COLOR.forest600,
    letterSpacing: 1.2,
    textTransform: "uppercase",
    marginBottom: 4,
  },
  sectionTitle: {
    fontFamily: "Montserrat",
    fontWeight: 700,
    fontSize: 20,
    color: COLOR.forest950,
    letterSpacing: -0.4,
    marginBottom: 4,
  },
  sectionLead: {
    fontFamily: "Inter",
    fontWeight: 500,
    fontSize: 10,
    color: COLOR.fgSecondary,
    marginBottom: 16,
    lineHeight: 1.45,
  },

  statusBadge: {
    fontFamily: "Inter",
    fontWeight: 700,
    fontSize: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    letterSpacing: 0.4,
    textTransform: "uppercase",
    alignSelf: "flex-start",
    marginBottom: 12,
  },

  // Tables
  tableHeader: {
    flexDirection: "row",
    borderBottomWidth: 1.5,
    borderBottomColor: COLOR.forest600,
    paddingVertical: 6,
  },
  tableRow: {
    flexDirection: "row",
    borderBottomWidth: 0.5,
    borderBottomColor: COLOR.borderDefault,
    paddingVertical: 6,
  },
  tableRowMuted: {
    flexDirection: "row",
    borderBottomWidth: 0.5,
    borderBottomColor: COLOR.borderDefault,
    paddingVertical: 6,
    opacity: 0.55,
  },
  th: {
    fontFamily: "Inter",
    fontWeight: 600,
    fontSize: 7,
    textTransform: "uppercase",
    color: COLOR.forest600,
    letterSpacing: 0.7,
  },
  td: { fontFamily: "Inter", fontWeight: 500, fontSize: 9, color: COLOR.fgPrimary },
  tdNumeric: { fontFamily: "Inter", fontWeight: 600, fontSize: 9, color: COLOR.fgPrimary },
  tdMuted: { fontFamily: "Inter", fontWeight: 500, fontSize: 8, color: COLOR.fgSecondary },

  // Stub / requires-action callout
  stubBox: {
    padding: 12,
    backgroundColor: COLOR.statusStubBg,
    borderRadius: 8,
    borderLeftWidth: 3,
    borderLeftColor: "#92400e",
    marginBottom: 14,
  },
  stubText: { fontFamily: "Inter", fontWeight: 500, fontSize: 9, color: COLOR.statusStubFg, lineHeight: 1.5 },

  missingBox: {
    padding: 12,
    backgroundColor: COLOR.statusMissingBg,
    borderRadius: 8,
    borderLeftWidth: 3,
    borderLeftColor: COLOR.fgMuted,
    marginBottom: 14,
  },
  missingText: { fontFamily: "Inter", fontWeight: 500, fontSize: 9, color: COLOR.statusMissingFg, lineHeight: 1.5 },

  filledBox: {
    padding: 12,
    backgroundColor: COLOR.mint100,
    borderRadius: 8,
    borderLeftWidth: 3,
    borderLeftColor: COLOR.forest600,
    marginBottom: 14,
  },
  filledText: { fontFamily: "Inter", fontWeight: 500, fontSize: 9, color: COLOR.forest950, lineHeight: 1.5 },

  // Methodology footer
  methodGrid: { flexDirection: "row", gap: 10, marginBottom: 14 },
  methodCol: {
    flex: 1,
    padding: 12,
    backgroundColor: COLOR.surface,
    borderWidth: 0.6,
    borderColor: COLOR.borderDefault,
    borderRadius: 12,
  },
  methodLabel: {
    fontFamily: "Inter",
    fontWeight: 700,
    fontSize: 7,
    color: COLOR.fgMuted,
    textTransform: "uppercase",
    letterSpacing: 0.7,
    marginBottom: 6,
  },
  methodValue: { fontFamily: "Inter", fontWeight: 500, fontSize: 9, color: COLOR.fgPrimary, lineHeight: 1.4 },

  meta: {
    fontFamily: "Inter",
    fontWeight: 400,
    fontSize: 7,
    color: COLOR.fgMuted,
    marginTop: 16,
    paddingTop: 8,
    borderTopWidth: 0.5,
    borderTopColor: COLOR.borderDefault,
    lineHeight: 1.4,
  },
  pageNumber: {
    position: "absolute",
    bottom: 18,
    right: 40,
    fontFamily: "Inter",
    fontSize: 7,
    color: COLOR.fgMuted,
  },

  // Project case-study
  caseStudy: {
    padding: 12,
    backgroundColor: COLOR.surfaceMuted,
    borderLeftWidth: 3,
    borderLeftColor: COLOR.mint500,
    marginBottom: 8,
    borderRadius: 8,
  },
  caseStudyTitle: { fontFamily: "Inter", fontWeight: 600, fontSize: 10, color: COLOR.fgPrimary, marginBottom: 4 },
  caseStudyMeta: { fontFamily: "Inter", fontWeight: 500, fontSize: 8, color: COLOR.fgSecondary },
});

const fmtKg = (kg: number) => (kg >= 1000 ? `${(kg / 1000).toFixed(2)} t` : `${Math.round(kg)} kg`);
const fmtTon = (t: number) => `${t.toFixed(2)} tCO2e`;
const fmtEur = (n: number) => `EUR ${n.toLocaleString("en-NL", { maximumFractionDigits: 0 })}`;
const fmtPct = (n: number) => `${n.toFixed(0)}%`;

type Status = "filled" | "stub" | "missing";

const StatusBadge = ({ status }: { status: Status }) => {
  const map = {
    filled: { bg: COLOR.statusFilledBg, fg: COLOR.statusFilledFg, label: "Filled" },
    stub: { bg: COLOR.statusStubBg, fg: COLOR.statusStubFg, label: "Stub - review" },
    missing: { bg: COLOR.statusMissingBg, fg: COLOR.statusMissingFg, label: "Required from you" },
  } as const;
  const s = map[status];
  return (
    <Text style={[styles.statusBadge, { backgroundColor: s.bg, color: s.fg }]}>{s.label}</Text>
  );
};

const Header = ({ company, year }: { company: string; year: number }) => (
  <View style={styles.header} fixed>
    <Text style={styles.headerBrand}>Carbo</Text>
    <Text style={styles.headerOrg}>
      {company} · Annual carbon report · {year}
    </Text>
  </View>
);

const SectionHeading = ({
  eyebrow,
  title,
  lead,
  status,
}: {
  eyebrow: string;
  title: string;
  lead?: string;
  status: Status;
}) => (
  <View>
    <Text style={styles.sectionEyebrow}>{eyebrow}</Text>
    <Text style={styles.sectionTitle}>{title}</Text>
    {lead && <Text style={styles.sectionLead}>{lead}</Text>}
    <StatusBadge status={status} />
  </View>
);

export const annualReportDocument = (r: CarbonReport): ReactElement<DocumentProps> => {
  const generated = new Date(r._extraction?.extractedAt ?? Date.now()).toISOString().slice(0, 16).replace("T", " ");
  const totalT = r.emissions.totalTco2e ?? 0;
  const scope12T = r.emissions.totalScope1And2Tco2e ?? 0;
  const cat1 = r.emissions.scope3.find((s) => s.category === "cat1_purchased_goods_services");
  const cat6 = r.emissions.scope3.find((s) => s.category === "cat6_business_travel");
  const reportedScope3 = r.emissions.scope3.filter((s) => s.tco2e !== null);
  const naScope3 = r.emissions.scope3.filter((s) => s.notApplicable);
  const immaterialScope3 = r.emissions.scope3.filter((s) => s.excludedAsImmaterial);

  return (
    <Document
      title={`${r.company} annual carbon report ${r.reportingYear}`}
      author="Carbo"
      subject={`${r.company} ESRS E1 / VSME ${r.reportingYear}`}
      keywords="annual carbon report CSRD ESRS E1 VSME bunq carbo"
    >
      {/* Cover */}
      <Page size="A4" style={styles.page}>
        <Header company={r.company} year={r.reportingYear} />
        <View style={styles.pageBody}>
          <View style={styles.coverHero}>
            <Text style={styles.coverEyebrow}>{r.framework} · climate disclosure</Text>
            <Text style={styles.coverTitle}>Annual carbon report</Text>
            <Text style={styles.coverSub}>
              {r.company} · reporting year {r.reportingYear} · framework {r.framework}
            </Text>

            <View style={styles.heroKpis}>
              <View style={styles.heroKpiAccent}>
                <Text style={styles.heroKpiLabel}>Total emissions</Text>
                <Text style={styles.heroKpiValue}>{fmtTon(totalT)}</Text>
                <Text style={styles.heroKpiSub}>scope 1, 2 and 3 (cat 1 + cat 6)</Text>
              </View>
              <View style={styles.heroKpi}>
                <Text style={styles.heroKpiLabel}>Scope 1 + 2</Text>
                <Text style={styles.heroKpiValue}>{fmtTon(scope12T)}</Text>
                <Text style={styles.heroKpiSub}>direct + purchased energy</Text>
              </View>
              <View style={styles.heroKpi}>
                <Text style={styles.heroKpiLabel}>Credits retired</Text>
                <Text style={styles.heroKpiValue}>
                  {r.credits ? `${(r.credits.totalTonnesRetired ?? 0).toFixed(2)} t` : "0 t"}
                </Text>
                <Text style={styles.heroKpiSub}>
                  {r.credits?.totalSpendEur ? fmtEur(r.credits.totalSpendEur) : "no purchases this year"}
                </Text>
              </View>
              <View style={styles.heroKpi}>
                <Text style={styles.heroKpiLabel}>Internal carbon price</Text>
                <Text style={styles.heroKpiValue}>
                  {r.internalCarbonPrice ? `${fmtEur(r.internalCarbonPrice.pricePerTco2eEur)}/t` : "n/a"}
                </Text>
                <Text style={styles.heroKpiSub}>policy-implied</Text>
              </View>
            </View>

            <View style={styles.legend}>
              <Text style={styles.legendTitle}>How to read this report</Text>
              <View style={styles.legendRow}>
                <Text style={[styles.legendBadge, { backgroundColor: COLOR.statusFilledBg, color: COLOR.statusFilledFg }]}>Filled</Text>
                <Text style={styles.legendText}>Reproducible from the bunq ledger and emission factor library.</Text>
              </View>
              <View style={styles.legendRow}>
                <Text style={[styles.legendBadge, { backgroundColor: COLOR.statusStubBg, color: COLOR.statusStubFg }]}>Stub</Text>
                <Text style={styles.legendText}>Pre-filled by Carbo - requires human review and approval.</Text>
              </View>
              <View style={styles.legendRow}>
                <Text style={[styles.legendBadge, { backgroundColor: COLOR.statusMissingBg, color: COLOR.statusMissingFg }]}>Required from you</Text>
                <Text style={styles.legendText}>Section the company must author externally (targets, materiality, financials).</Text>
              </View>
            </View>
          </View>
        </View>
        <Text style={styles.pageNumber} render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`} fixed />
      </Page>

      {/* E1-1 Transition plan */}
      <Page size="A4" style={styles.page}>
        <Header company={r.company} year={r.reportingYear} />
        <View style={styles.pageBody}>
          <SectionHeading
            eyebrow="E1-1"
            title="Transition plan for climate change mitigation"
            lead="Pathway, levers, and dependencies for reducing emissions in line with a 1.5°C-aligned trajectory."
            status="stub"
          />
          <View style={styles.stubBox}>
            <Text style={styles.stubText}>
              {r.transitionPlanSummary ?? "Carbo cannot author a transition plan from ledger data alone. The plan must be approved by management."}
            </Text>
          </View>
        </View>
        <Text style={styles.pageNumber} render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`} fixed />
      </Page>

      {/* E1-2 / E1-3 Policies and actions */}
      <Page size="A4" style={styles.page}>
        <Header company={r.company} year={r.reportingYear} />
        <View style={styles.pageBody}>
          <SectionHeading
            eyebrow="E1-2"
            title="Policies related to climate change mitigation and adaptation"
            status="missing"
          />
          <View style={styles.missingBox}>
            <Text style={styles.missingText}>
              The company must list climate-related policies (procurement guidelines, travel policy, energy policy, supplier code of conduct). Carbo does not infer policies from spend.
            </Text>
          </View>

          <SectionHeading
            eyebrow="E1-3"
            title="Actions and resources allocated"
            lead="Concrete actions taken in the reporting year, drawn from the audit chain of executed close runs."
            status="filled"
          />
          <View style={styles.filledBox}>
            <Text style={styles.filledText}>{r.actionSummary ?? "No actions on record."}</Text>
          </View>
        </View>
        <Text style={styles.pageNumber} render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`} fixed />
      </Page>

      {/* E1-4 Targets + E1-5 Energy */}
      <Page size="A4" style={styles.page}>
        <Header company={r.company} year={r.reportingYear} />
        <View style={styles.pageBody}>
          <SectionHeading
            eyebrow="E1-4"
            title="Targets related to climate change mitigation"
            status="missing"
          />
          <View style={styles.missingBox}>
            <Text style={styles.missingText}>
              No SBTi-validated reduction targets are on file for {r.company} in {r.reportingYear}. The company must set short-, medium-, and long-term targets covering Scope 1, 2 and material Scope 3 categories before this section can be published.
            </Text>
          </View>

          <SectionHeading
            eyebrow="E1-5"
            title="Energy consumption and mix"
            status={r.energy ? "filled" : "missing"}
          />
          {r.energy ? (
            <View style={styles.filledBox}>
              <Text style={styles.filledText}>
                Total {r.energy.totalMwh ?? 0} MWh, {r.energy.renewablePct ?? 0}% renewable.
              </Text>
            </View>
          ) : (
            <View style={styles.missingBox}>
              <Text style={styles.missingText}>
                Energy disclosure (consumption + renewable mix) requires utility meter data not currently flowing through bunq. Add utility-bill ingestion or supply meter readings to populate this section.
              </Text>
            </View>
          )}
        </View>
        <Text style={styles.pageNumber} render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`} fixed />
      </Page>

      {/* E1-6 Gross GHG emissions - the main numeric section */}
      <Page size="A4" style={styles.page}>
        <Header company={r.company} year={r.reportingYear} />
        <View style={styles.pageBody}>
          <SectionHeading
            eyebrow="E1-6"
            title="Gross Scope 1, 2, 3 and total GHG emissions"
            lead="Spend-based GHG Protocol Scope 3 with category-level emission factors. Operational control boundary."
            status="filled"
          />
          <View style={styles.tableHeader}>
            <Text style={[styles.th, { flex: 4 }]}>Scope / category</Text>
            <Text style={[styles.th, { flex: 2, textAlign: "right" }]}>tCO2e</Text>
            <Text style={[styles.th, { flex: 2, textAlign: "right" }]}>Method</Text>
            <Text style={[styles.th, { flex: 1, textAlign: "right" }]}>Share</Text>
          </View>
          <View style={styles.tableRow}>
            <Text style={[styles.td, { flex: 4 }]}>Scope 1 - direct combustion</Text>
            <Text style={[styles.tdNumeric, { flex: 2, textAlign: "right" }]}>{(r.emissions.scope1.totalTco2e ?? 0).toFixed(2)}</Text>
            <Text style={[styles.tdMuted, { flex: 2, textAlign: "right" }]}>activity</Text>
            <Text style={[styles.tdNumeric, { flex: 1, textAlign: "right" }]}>
              {totalT > 0 ? fmtPct(((r.emissions.scope1.totalTco2e ?? 0) / totalT) * 100) : "-"}
            </Text>
          </View>
          <View style={styles.tableRow}>
            <Text style={[styles.td, { flex: 4 }]}>Scope 2 - purchased electricity (location-based)</Text>
            <Text style={[styles.tdNumeric, { flex: 2, textAlign: "right" }]}>{(r.emissions.scope2.locationBasedTco2e ?? 0).toFixed(2)}</Text>
            <Text style={[styles.tdMuted, { flex: 2, textAlign: "right" }]}>spend-based</Text>
            <Text style={[styles.tdNumeric, { flex: 1, textAlign: "right" }]}>
              {totalT > 0 ? fmtPct(((r.emissions.scope2.locationBasedTco2e ?? 0) / totalT) * 100) : "-"}
            </Text>
          </View>
          {reportedScope3.map((s) => (
            <View key={s.category} style={styles.tableRow}>
              <Text style={[styles.td, { flex: 4 }]}>Scope 3 - {SCOPE3_LABELS[s.category]}</Text>
              <Text style={[styles.tdNumeric, { flex: 2, textAlign: "right" }]}>{(s.tco2e ?? 0).toFixed(2)}</Text>
              <Text style={[styles.tdMuted, { flex: 2, textAlign: "right" }]}>{s.method ?? "-"}</Text>
              <Text style={[styles.tdNumeric, { flex: 1, textAlign: "right" }]}>
                {totalT > 0 ? fmtPct(((s.tco2e ?? 0) / totalT) * 100) : "-"}
              </Text>
            </View>
          ))}
          <View style={[styles.tableRow, { borderBottomWidth: 1.5, borderBottomColor: COLOR.forest600, marginTop: 2 }]}>
            <Text style={[styles.tdNumeric, { flex: 4, fontFamily: "Montserrat", fontWeight: 700 }]}>Total</Text>
            <Text style={[styles.tdNumeric, { flex: 2, textAlign: "right", fontFamily: "Montserrat", fontWeight: 700 }]}>
              {totalT.toFixed(2)}
            </Text>
            <Text style={[styles.td, { flex: 2 }]}> </Text>
            <Text style={[styles.tdNumeric, { flex: 1, textAlign: "right", fontFamily: "Montserrat", fontWeight: 700 }]}>100%</Text>
          </View>

          {immaterialScope3.length > 0 && (
            <View style={{ marginTop: 18 }}>
              <Text style={[styles.legendTitle, { marginBottom: 6 }]}>Excluded as immaterial ({immaterialScope3.length})</Text>
              {immaterialScope3.map((s) => (
                <View key={s.category} style={styles.tableRowMuted}>
                  <Text style={[styles.tdMuted, { flex: 4 }]}>Scope 3 - {SCOPE3_LABELS[s.category]}</Text>
                  <Text style={[styles.tdMuted, { flex: 4 }]}>{s.note}</Text>
                </View>
              ))}
            </View>
          )}

          {naScope3.length > 0 && (
            <View style={{ marginTop: 14 }}>
              <Text style={[styles.legendTitle, { marginBottom: 6 }]}>Not applicable ({naScope3.length})</Text>
              {naScope3.map((s) => (
                <View key={s.category} style={styles.tableRowMuted}>
                  <Text style={[styles.tdMuted, { flex: 4 }]}>Scope 3 - {SCOPE3_LABELS[s.category]}</Text>
                  <Text style={[styles.tdMuted, { flex: 4 }]}>{s.note}</Text>
                </View>
              ))}
            </View>
          )}

          {r.emissions.intensity.length > 0 && (
            <View style={{ marginTop: 18 }}>
              <Text style={[styles.legendTitle, { marginBottom: 6 }]}>Emissions intensity</Text>
              {r.emissions.intensity.map((i, idx) => (
                <View key={idx} style={styles.tableRow}>
                  <Text style={[styles.td, { flex: 3 }]}>{i.metric}</Text>
                  <Text style={[styles.tdNumeric, { flex: 1, textAlign: "right" }]}>{i.value.toFixed(3)}</Text>
                  <Text style={[styles.tdMuted, { flex: 4 }]}>
                    {i.scopeCoverage?.join(", ") ?? ""}
                  </Text>
                </View>
              ))}
            </View>
          )}
        </View>
        <Text style={styles.pageNumber} render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`} fixed />
      </Page>

      {/* E1-7 Carbon credits */}
      <Page size="A4" style={styles.page}>
        <Header company={r.company} year={r.reportingYear} />
        <View style={styles.pageBody}>
          <SectionHeading
            eyebrow="E1-7"
            title="GHG removals and GHG mitigation projects financed through carbon credits"
            status={r.credits && r.credits.totalTonnesRetired ? "filled" : "missing"}
          />
          {r.credits && r.credits.totalTonnesRetired ? (
            <>
              <View style={styles.heroKpis}>
                <View style={styles.heroKpiAccent}>
                  <Text style={styles.heroKpiLabel}>Tonnes retired</Text>
                  <Text style={styles.heroKpiValue}>{r.credits.totalTonnesRetired.toFixed(2)} t</Text>
                </View>
                <View style={styles.heroKpi}>
                  <Text style={styles.heroKpiLabel}>Cost</Text>
                  <Text style={styles.heroKpiValue}>{fmtEur(r.credits.totalSpendEur ?? 0)}</Text>
                </View>
                <View style={styles.heroKpi}>
                  <Text style={styles.heroKpiLabel}>EU-based</Text>
                  <Text style={styles.heroKpiValue}>{(r.credits.euBasedPct ?? 0).toFixed(0)}%</Text>
                </View>
                <View style={styles.heroKpi}>
                  <Text style={styles.heroKpiLabel}>Removal share</Text>
                  <Text style={styles.heroKpiValue}>{(r.credits.removalPct ?? 0).toFixed(0)}%</Text>
                </View>
              </View>
              <View style={{ marginTop: 16 }}>
                {r.credits.projects.map((p, idx) => (
                  <View key={idx} style={styles.caseStudy}>
                    <Text style={styles.caseStudyTitle}>{p.name}</Text>
                    <Text style={styles.caseStudyMeta}>
                      {p.country ?? "country n/a"} · {p.standard.replace(/_/g, " ")} · {p.tonnesRetired ?? 0} tCO2e
                    </Text>
                  </View>
                ))}
              </View>
            </>
          ) : (
            <View style={styles.missingBox}>
              <Text style={styles.missingText}>
                No carbon credits retired in {r.reportingYear}. Carbo's reserve mechanism has accumulated funds (see E1-3) but no purchases were executed against them this period.
              </Text>
            </View>
          )}
        </View>
        <Text style={styles.pageNumber} render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`} fixed />
      </Page>

      {/* E1-8 Internal carbon pricing + E1-9 Financial effects */}
      <Page size="A4" style={styles.page}>
        <Header company={r.company} year={r.reportingYear} />
        <View style={styles.pageBody}>
          <SectionHeading
            eyebrow="E1-8"
            title="Internal carbon pricing"
            status={r.internalCarbonPrice ? "filled" : "missing"}
          />
          {r.internalCarbonPrice ? (
            <View style={styles.filledBox}>
              <Text style={styles.filledText}>
                {fmtEur(r.internalCarbonPrice.pricePerTco2eEur)} per tCO2e ({r.internalCarbonPrice.type}). {r.internalCarbonPrice.perimeterDescription} {r.internalCarbonPrice.pricingMethodNote ?? ""}
              </Text>
            </View>
          ) : (
            <View style={styles.missingBox}>
              <Text style={styles.missingText}>No active reserve policy with eur_per_kg_co2e — no implied internal carbon price.</Text>
            </View>
          )}

          <SectionHeading
            eyebrow="E1-9"
            title="Anticipated financial effects from material physical and transition risks"
            status="missing"
          />
          <View style={styles.missingBox}>
            <Text style={styles.missingText}>
              Quantitative financial-effects assessment requires scenario analysis (RCP 4.5 / 8.5, IEA NZE / SSP) against owned assets, supplier dependencies, and product mix. Out of scope for an automated rollup; requires risk-management input.
            </Text>
          </View>
        </View>
        <Text style={styles.pageNumber} render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`} fixed />
      </Page>

      {/* Methodology */}
      <Page size="A4" style={styles.page}>
        <Header company={r.company} year={r.reportingYear} />
        <View style={styles.pageBody}>
          <SectionHeading
            eyebrow="Methodology"
            title="How these numbers were produced"
            status="filled"
          />
          <View style={styles.methodGrid}>
            <View style={styles.methodCol}>
              <Text style={styles.methodLabel}>Standard</Text>
              <Text style={styles.methodValue}>{r.methodology.ghgProtocolVersion}</Text>
            </View>
            <View style={styles.methodCol}>
              <Text style={styles.methodLabel}>Scope 2 method(s)</Text>
              <Text style={styles.methodValue}>{r.methodology.scope2MethodsUsed.join(", ")}</Text>
            </View>
            <View style={styles.methodCol}>
              <Text style={styles.methodLabel}>GWP basis</Text>
              <Text style={styles.methodValue}>IPCC {r.methodology.gwpAssessmentReport}</Text>
            </View>
          </View>

          <View style={[styles.methodCol, { marginBottom: 14 }]}>
            <Text style={styles.methodLabel}>Emission factor sources used ({r.methodology.factorSources.length})</Text>
            <Text style={styles.methodValue}>
              {r.methodology.factorSources.length > 0 ? r.methodology.factorSources.join(" · ") : "no factors registered"}
            </Text>
          </View>

          <View style={[styles.methodCol, { marginBottom: 14 }]}>
            <Text style={styles.methodLabel}>Boundary</Text>
            <Text style={styles.methodValue}>
              Operational control. Emissions covered: Scope 1 (direct combustion of fuel from bunq fuel-category transactions), Scope 2 location-based (purchased electricity from utility-category), Scope 3 Cat 1 (purchased goods & services - food / procurement / cloud / services) and Cat 6 (business travel). Categories 2-5, 7-15 marked immaterial or not applicable per the table on the previous page.
            </Text>
          </View>

          <View style={[styles.methodCol, { marginBottom: 14 }]}>
            <Text style={styles.methodLabel}>Assurance</Text>
            <Text style={styles.methodValue}>
              {r.assurance.level === "none" ? "No external assurance." : `${r.assurance.level} - ${r.assurance.assurer ?? "TBD"}`}
              {r.assurance.scopeNote ? ` ${r.assurance.scopeNote}` : ""}
            </Text>
          </View>

          <Text style={styles.meta}>
            Generated by Carbo from bunq Business transaction data on {generated} UTC. Visual style follows the team DESIGN.md (bunq Easy Green palette, Montserrat + Inter typography). This is a {r.framework} report shaped after CSRD ESRS E1 to ease forward compatibility; section status badges (Filled / Stub / Required from you) signal which content the company must review or author before publication.
          </Text>
        </View>
        <Text style={styles.pageNumber} render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`} fixed />
      </Page>
    </Document>
  );
};
