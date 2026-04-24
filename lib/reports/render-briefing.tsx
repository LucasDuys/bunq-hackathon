import { Document, Page, Text, View, StyleSheet, type DocumentProps } from "@react-pdf/renderer";
import type { ReactElement } from "react";
import type { CarbonBriefing } from "./briefing-schema";

/**
 * Visual style mirrors bunq's actual published ESG reports:
 *
 *   - black + hot magenta pink (NOT the Easy Green forest/mint palette,
 *     which bunq ignores in their public PDFs)
 *   - Helvetica-Bold for display, Helvetica for body (no font registration —
 *     react-pdf's built-in fonts are reliable; live registration via Google
 *     Fonts CDN failed at runtime)
 *   - black full-bleed section dividers with pink pill labels
 *   - 3-column tables with pink header row
 *   - hero number triple ("kg = t = EUR equivalent") on the cover
 *
 * Sources: bunq 2024 ESG Report (https://static.bunq.com/website/documents/
 * bunq-report-esg-2024-en.pdf), bunq Documents index.
 */

// bunq actual report palette
const COLOR = {
  black: "#000000",
  ink: "#0a0a0a",
  paper: "#ffffff",
  cream: "#fafaf7",
  pink: "#e32f94",
  pinkSoft: "#f9d4e8",
  pinkInk: "#5a0e3a",
  muted: "#4b4b4b",
  faint: "#9a9a9a",
  line: "#e5e5e5",
  warn: "#955705",
  good: "#2e7d32",
};

const styles = StyleSheet.create({
  page: {
    padding: 0,
    fontSize: 10,
    color: COLOR.ink,
    fontFamily: "Helvetica",
    backgroundColor: COLOR.paper,
  },
  pageBody: {
    paddingHorizontal: 40,
    paddingTop: 22,
    paddingBottom: 50,
  },

  // top header bar (carries forward on every page)
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 40,
    paddingVertical: 12,
    backgroundColor: COLOR.black,
  },
  headerBrand: {
    fontFamily: "Helvetica-Bold",
    fontSize: 14,
    color: COLOR.paper,
    letterSpacing: 1.5,
  },
  headerPill: {
    fontFamily: "Helvetica-Bold",
    fontSize: 7,
    color: COLOR.paper,
    backgroundColor: COLOR.pink,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  headerMeta: {
    fontFamily: "Helvetica",
    fontSize: 8,
    color: COLOR.faint,
  },

  // hero
  hero: {
    fontFamily: "Helvetica-Bold",
    fontSize: 32,
    color: COLOR.black,
    letterSpacing: -1,
    marginBottom: 6,
  },
  heroSub: {
    fontFamily: "Helvetica",
    fontSize: 9,
    color: COLOR.muted,
    marginBottom: 8,
  },

  // headline equivalency triple ("X kg = Y t = Z EUR offset")
  triple: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: 10,
    paddingVertical: 14,
    borderTopWidth: 2,
    borderTopColor: COLOR.black,
    borderBottomWidth: 2,
    borderBottomColor: COLOR.black,
    marginBottom: 22,
  },
  tripleNumber: {
    fontFamily: "Helvetica-Bold",
    fontSize: 18,
    color: COLOR.black,
    letterSpacing: -0.5,
  },
  tripleEquals: {
    fontFamily: "Helvetica-Bold",
    fontSize: 18,
    color: COLOR.pink,
  },
  tripleLabel: {
    fontFamily: "Helvetica",
    fontSize: 8,
    color: COLOR.muted,
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },

  // KPIs
  kpiRow: { flexDirection: "row", gap: 8, marginBottom: 18 },
  kpiBox: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 10,
    backgroundColor: COLOR.cream,
    borderWidth: 0.5,
    borderColor: COLOR.line,
  },
  kpiBoxAccent: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 10,
    backgroundColor: COLOR.pinkSoft,
    borderWidth: 0.5,
    borderColor: COLOR.pink,
  },
  kpiLabel: {
    fontFamily: "Helvetica-Bold",
    fontSize: 7,
    color: COLOR.muted,
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  kpiValue: {
    fontFamily: "Helvetica-Bold",
    fontSize: 16,
    color: COLOR.black,
    marginTop: 4,
    letterSpacing: -0.4,
  },
  kpiSub: {
    fontFamily: "Helvetica",
    fontSize: 8,
    color: COLOR.faint,
    marginTop: 2,
  },
  kpiSubGood: {
    fontFamily: "Helvetica-Bold",
    fontSize: 8,
    color: COLOR.good,
    marginTop: 2,
  },
  kpiSubBad: {
    fontFamily: "Helvetica-Bold",
    fontSize: 8,
    color: COLOR.warn,
    marginTop: 2,
  },

  // sections
  section: { marginBottom: 18 },
  sectionTitle: {
    fontFamily: "Helvetica-Bold",
    fontSize: 11,
    color: COLOR.black,
    marginBottom: 8,
    textTransform: "uppercase",
    letterSpacing: 1,
  },

  // narrative box (replaces the bunq "letter from CEO" / intro tone)
  narrativeBox: {
    padding: 14,
    backgroundColor: COLOR.cream,
    marginBottom: 22,
    borderLeftWidth: 3,
    borderLeftColor: COLOR.pink,
  },
  narrativeText: {
    fontFamily: "Helvetica",
    fontSize: 10,
    lineHeight: 1.55,
    color: COLOR.ink,
  },

  // tables
  tableHeader: {
    flexDirection: "row",
    backgroundColor: COLOR.pink,
    paddingVertical: 5,
    paddingHorizontal: 4,
    marginBottom: 0,
  },
  tableRow: {
    flexDirection: "row",
    borderBottomWidth: 0.5,
    borderBottomColor: COLOR.line,
    paddingVertical: 5,
    paddingHorizontal: 4,
  },
  th: {
    fontFamily: "Helvetica-Bold",
    fontSize: 7,
    textTransform: "uppercase",
    color: COLOR.paper,
    letterSpacing: 0.6,
  },
  td: { fontFamily: "Helvetica", fontSize: 9, color: COLOR.ink },
  tdNumeric: { fontFamily: "Helvetica-Bold", fontSize: 9, color: COLOR.ink },
  tdMuted: { fontFamily: "Helvetica", fontSize: 8, color: COLOR.muted },

  // bullets / anomalies
  bullet: { flexDirection: "row", marginBottom: 8, alignItems: "flex-start" },
  bulletDot: {
    width: 14,
    fontSize: 11,
    fontFamily: "Helvetica-Bold",
  },
  bulletBody: { flex: 1 },
  bulletPrimary: { fontFamily: "Helvetica-Bold", fontSize: 10, color: COLOR.black },
  bulletSecondary: { fontFamily: "Helvetica", fontSize: 9, color: COLOR.muted, marginTop: 2 },

  // swap blocks
  swap: { marginBottom: 14 },
  swapHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "baseline" },
  saveBadge: {
    fontFamily: "Helvetica-Bold",
    fontSize: 8,
    color: COLOR.paper,
    backgroundColor: COLOR.black,
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 2,
  },

  // project case-study sidebar (mirrors bunq's Kilifi-style call-out)
  caseStudy: {
    padding: 12,
    backgroundColor: COLOR.cream,
    borderLeftWidth: 3,
    borderLeftColor: COLOR.pink,
    marginBottom: 8,
  },
  caseStudyTitle: { fontFamily: "Helvetica-Bold", fontSize: 10, color: COLOR.black, marginBottom: 4 },
  caseStudyMeta: { fontFamily: "Helvetica", fontSize: 8, color: COLOR.muted },

  // pills row
  pillRow: {
    flexDirection: "row",
    gap: 6,
    marginBottom: 18,
    flexWrap: "wrap",
  },
  pill: {
    fontFamily: "Helvetica-Bold",
    fontSize: 8,
    color: COLOR.pinkInk,
    backgroundColor: COLOR.pinkSoft,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },

  // footer / page nav
  meta: {
    fontFamily: "Helvetica",
    fontSize: 7,
    color: COLOR.faint,
    marginTop: 28,
    paddingTop: 8,
    borderTopWidth: 0.5,
    borderTopColor: COLOR.line,
    lineHeight: 1.4,
  },
  pageNumber: {
    position: "absolute",
    bottom: 18,
    right: 40,
    fontFamily: "Helvetica",
    fontSize: 7,
    color: COLOR.faint,
  },

  // section divider (full-bleed black with pink pill — mirrors bunq's
  // ENVIRONMENTAL / SOCIAL / GOVERNANCE chapter pages)
  divider: {
    backgroundColor: COLOR.black,
    paddingHorizontal: 40,
    paddingVertical: 30,
    marginHorizontal: -40,
    marginVertical: 6,
  },
  dividerPill: {
    alignSelf: "flex-start",
    fontFamily: "Helvetica-Bold",
    fontSize: 9,
    color: COLOR.paper,
    backgroundColor: COLOR.pink,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    letterSpacing: 1.2,
    textTransform: "uppercase",
    marginBottom: 8,
  },
  dividerTitle: {
    fontFamily: "Helvetica-Bold",
    fontSize: 22,
    color: COLOR.paper,
    letterSpacing: -0.5,
  },
  dividerSub: {
    fontFamily: "Helvetica",
    fontSize: 9,
    color: COLOR.faint,
    marginTop: 4,
  },
});

const fmtKg = (kg: number) => (kg >= 1000 ? `${(kg / 1000).toFixed(2)} t` : `${Math.round(kg)} kg`);
const fmtKgPlain = (kg: number) => Math.round(kg).toString();
const fmtTon = (kg: number) => (kg / 1000).toFixed(2);
const fmtEur = (n: number) => `EUR ${n.toLocaleString("en-NL", { maximumFractionDigits: 0 })}`;
const fmtPct = (n: number, withSign = false) => `${withSign && n >= 0 ? "+" : ""}${n.toFixed(0)}%`;

const Header = ({ orgName, period }: { orgName: string; period: CarbonBriefing["period"] }) => (
  <View style={styles.header} fixed>
    <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
      <Text style={styles.headerBrand}>CARBO</Text>
      <Text style={styles.headerPill}>BUNQ BUSINESS</Text>
    </View>
    <Text style={styles.headerMeta}>
      {orgName} · {period.label}
    </Text>
  </View>
);

export const briefingDocument = (b: CarbonBriefing): ReactElement<DocumentProps> => {
  const startDate = new Date(b.period.startTs * 1000).toISOString().slice(0, 10);
  const endDate = new Date(b.period.endTs * 1000).toISOString().slice(0, 10);
  const generated = new Date(b.generatedAt).toISOString().slice(0, 16).replace("T", " ");
  const co2eDeltaImproved = b.summary.deltaCo2ePct !== null && b.summary.deltaCo2ePct < 0;

  return (
    <Document
      title={`Carbon briefing ${b.period.label}`}
      author="Carbo"
      subject={`${b.orgName} ${b.period.label}`}
      keywords="carbon briefing bunq carbo"
    >
      <Page size="A4" style={styles.page}>
        <Header orgName={b.orgName} period={b.period} />
        <View style={styles.pageBody}>
          <Text style={styles.hero}>Carbon briefing</Text>
          <Text style={styles.heroSub}>
            {b.period.kind} {b.period.label} · {startDate} to {endDate} · generated {generated} UTC
          </Text>

          <View style={styles.pillRow}>
            <Text style={styles.pill}>Internal summary</Text>
            <Text style={styles.pill}>{b.summary.txCount} transactions</Text>
            <Text style={styles.pill}>Confidence {(b.summary.confidence * 100).toFixed(0)}%</Text>
          </View>

          {/* Hero equivalency triple — mirrors bunq's "13M mangroves = 314,000 tCO2" treatment */}
          <View style={styles.triple}>
            <View>
              <Text style={styles.tripleNumber}>{fmtKgPlain(b.summary.totalCo2eKg)} kg</Text>
              <Text style={styles.tripleLabel}>CO2e this period</Text>
            </View>
            <Text style={styles.tripleEquals}>=</Text>
            <View>
              <Text style={styles.tripleNumber}>{fmtTon(b.summary.totalCo2eKg)} t</Text>
              <Text style={styles.tripleLabel}>tonnes equivalent</Text>
            </View>
            <Text style={styles.tripleEquals}>=</Text>
            <View>
              <Text style={styles.tripleNumber}>{fmtEur(b.reserve.recommendedSpendEur)}</Text>
              <Text style={styles.tripleLabel}>to fully offset</Text>
            </View>
          </View>

          <View style={styles.kpiRow}>
            <View style={co2eDeltaImproved ? styles.kpiBoxAccent : styles.kpiBox}>
              <Text style={styles.kpiLabel}>Total CO2e</Text>
              <Text style={styles.kpiValue}>{fmtKg(b.summary.totalCo2eKg)}</Text>
              <Text
                style={
                  b.summary.deltaCo2ePct === null
                    ? styles.kpiSub
                    : b.summary.deltaCo2ePct < 0
                      ? styles.kpiSubGood
                      : styles.kpiSubBad
                }
              >
                {b.summary.deltaCo2ePct === null ? "no prior baseline" : `${fmtPct(b.summary.deltaCo2ePct, true)} vs ${b.period.priorLabel}`}
              </Text>
            </View>
            <View style={styles.kpiBox}>
              <Text style={styles.kpiLabel}>Spend</Text>
              <Text style={styles.kpiValue}>{fmtEur(b.summary.totalSpendEur)}</Text>
              <Text style={styles.kpiSub}>
                {b.summary.deltaSpendPct === null ? `${b.summary.txCount} tx` : `${fmtPct(b.summary.deltaSpendPct, true)} vs ${b.period.priorLabel}`}
              </Text>
            </View>
            <View style={styles.kpiBox}>
              <Text style={styles.kpiLabel}>Confidence</Text>
              <Text style={styles.kpiValue}>{(b.summary.confidence * 100).toFixed(0)}%</Text>
              <Text style={styles.kpiSub}>spend-weighted</Text>
            </View>
            <View style={styles.kpiBox}>
              <Text style={styles.kpiLabel}>Reserve balance</Text>
              <Text style={styles.kpiValue}>{fmtEur(b.summary.reserveBalanceEur)}</Text>
              <Text style={styles.kpiSub}>last close run</Text>
            </View>
          </View>

          {b.narrative && (
            <View style={styles.narrativeBox}>
              <Text style={styles.narrativeText}>{b.narrative}</Text>
            </View>
          )}

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Top categories</Text>
            <View style={styles.tableHeader}>
              <Text style={[styles.th, { flex: 3 }]}>Category</Text>
              <Text style={[styles.th, { flex: 2, textAlign: "right" }]}>Spend</Text>
              <Text style={[styles.th, { flex: 2, textAlign: "right" }]}>CO2e</Text>
              <Text style={[styles.th, { flex: 1, textAlign: "right" }]}>Share</Text>
            </View>
            {b.topCategories.map((c) => (
              <View key={c.category} style={styles.tableRow}>
                <Text style={[styles.td, { flex: 3, textTransform: "capitalize" }]}>{c.category.replace(/_/g, " ")}</Text>
                <Text style={[styles.tdNumeric, { flex: 2, textAlign: "right" }]}>{fmtEur(c.spendEur)}</Text>
                <Text style={[styles.tdNumeric, { flex: 2, textAlign: "right" }]}>{fmtKg(c.co2eKg)}</Text>
                <Text style={[styles.tdNumeric, { flex: 1, textAlign: "right" }]}>{c.sharePct.toFixed(0)}%</Text>
              </View>
            ))}
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Top emitting merchants</Text>
            <View style={styles.tableHeader}>
              <Text style={[styles.th, { flex: 4 }]}>Merchant</Text>
              <Text style={[styles.th, { flex: 1, textAlign: "right" }]}>Tx</Text>
              <Text style={[styles.th, { flex: 2, textAlign: "right" }]}>Spend</Text>
              <Text style={[styles.th, { flex: 2, textAlign: "right" }]}>CO2e</Text>
              <Text style={[styles.th, { flex: 1, textAlign: "right" }]}>Share</Text>
            </View>
            {b.topMerchants.map((m) => (
              <View key={m.merchantNorm} style={styles.tableRow}>
                <View style={{ flex: 4 }}>
                  <Text style={styles.td}>{m.merchantRaw}</Text>
                  {m.category && <Text style={styles.tdMuted}>{m.category.replace(/_/g, " ")}</Text>}
                </View>
                <Text style={[styles.tdNumeric, { flex: 1, textAlign: "right" }]}>{m.txCount}</Text>
                <Text style={[styles.tdNumeric, { flex: 2, textAlign: "right" }]}>{fmtEur(m.spendEur)}</Text>
                <Text style={[styles.tdNumeric, { flex: 2, textAlign: "right" }]}>{fmtKg(m.co2eKg)}</Text>
                <Text style={[styles.tdNumeric, { flex: 1, textAlign: "right" }]}>{m.sharePct.toFixed(0)}%</Text>
              </View>
            ))}
          </View>
        </View>
        <Text style={styles.pageNumber} render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`} fixed />
      </Page>

      <Page size="A4" style={styles.page}>
        <Header orgName={b.orgName} period={b.period} />
        <View style={styles.pageBody}>
          {/* full-bleed black divider with pink pill — bunq motif */}
          <View style={styles.divider}>
            <Text style={styles.dividerPill}>ACTION</Text>
            <Text style={styles.dividerTitle}>What changed and what to do next</Text>
            <Text style={styles.dividerSub}>Anomalies, swap recommendations, and the recommended carbon-credit purchase.</Text>
          </View>

          {b.anomalies.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>What changed</Text>
              {b.anomalies.map((a, i) => (
                <View key={i} style={styles.bullet}>
                  <Text style={[styles.bulletDot, { color: a.deltaPct !== null && a.deltaPct >= 0 ? COLOR.warn : COLOR.good }]}>
                    {a.deltaPct !== null && a.deltaPct >= 0 ? "↑" : a.deltaPct !== null ? "↓" : "•"}
                  </Text>
                  <View style={styles.bulletBody}>
                    <Text style={styles.bulletPrimary}>{a.subject}</Text>
                    <Text style={styles.bulletSecondary}>{a.message}</Text>
                  </View>
                </View>
              ))}
            </View>
          )}

          {b.swaps.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Recommended swaps</Text>
              {b.swaps.map((s, i) => (
                <View key={i} style={styles.swap}>
                  <View style={styles.swapHead}>
                    <Text style={[styles.bulletPrimary, { flex: 1, paddingRight: 10 }]}>
                      {s.from} → {s.to}
                    </Text>
                    <Text style={styles.saveBadge}>save ~{fmtKg(s.expectedSavingKg)} ({s.expectedSavingPct.toFixed(0)}%)</Text>
                  </View>
                  <Text style={styles.bulletSecondary}>{s.rationale}</Text>
                  {s.generatedBy && (
                    <Text style={[styles.tdMuted, { fontSize: 7, marginTop: 2, color: COLOR.faint }]}>
                      source: {s.generatedBy.replace("_", " ")}
                    </Text>
                  )}
                </View>
              ))}
            </View>
          )}
        </View>
        <Text style={styles.pageNumber} render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`} fixed />
      </Page>

      <Page size="A4" style={styles.page}>
        <Header orgName={b.orgName} period={b.period} />
        <View style={styles.pageBody}>
          <View style={styles.divider}>
            <Text style={styles.dividerPill}>RESERVE</Text>
            <Text style={styles.dividerTitle}>Recommended carbon-credit mix</Text>
            <Text style={styles.dividerSub}>EU-registered, removal-weighted, simulated marketplace for the hackathon.</Text>
          </View>

          <View style={styles.section}>
            <View style={styles.kpiRow}>
              <View style={styles.kpiBoxAccent}>
                <Text style={styles.kpiLabel}>Tonnes</Text>
                <Text style={styles.kpiValue}>{b.reserve.recommendedTonnes.toFixed(2)} t</Text>
              </View>
              <View style={styles.kpiBox}>
                <Text style={styles.kpiLabel}>Estimated cost</Text>
                <Text style={styles.kpiValue}>{fmtEur(b.reserve.recommendedSpendEur)}</Text>
              </View>
              <View style={styles.kpiBox}>
                <Text style={styles.kpiLabel}>Projects</Text>
                <Text style={styles.kpiValue}>{b.reserve.projectMix.length}</Text>
              </View>
            </View>

            {/* per-project case-study sidebar — bunq Kilifi pattern */}
            {b.reserve.projectMix.map((p) => (
              <View key={p.projectId} style={styles.caseStudy}>
                <Text style={styles.caseStudyTitle}>{p.projectName}</Text>
                <Text style={styles.caseStudyMeta}>
                  {p.tonnes.toFixed(2)} t at {fmtEur(p.eur)} · share {((p.tonnes / b.reserve.recommendedTonnes) * 100).toFixed(0)}% of recommended mix
                </Text>
              </View>
            ))}
          </View>

          <Text style={styles.meta}>
            Generated by Carbo from bunq Business transaction data. Methodology: spend-based GHG Protocol Scope 3 with category-level emission factors (DEFRA 2024, ADEME Base Carbone, Exiobase v3.8.2). Confidence reflects factor uncertainty x classifier confidence x tier weight. Recommended-credit project mix favours EU-registered removal credits per Oxford Principles 2024 / VCMI guidance. This briefing is an internal advisory artefact, not an audited disclosure under CSRD ESRS E1. Visual style is inspired by bunq's published ESG reports — Carbo and bunq are not affiliated.
          </Text>
        </View>
        <Text style={styles.pageNumber} render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`} fixed />
      </Page>
    </Document>
  );
};
