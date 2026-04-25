import { Document, Page, Text, View, StyleSheet, Font, type DocumentProps } from "@react-pdf/renderer";
import type { ReactElement } from "react";
import path from "node:path";
import type { CarbonBriefing } from "./briefing-schema";

/**
 * PDF visual style follows the team's DESIGN.md (bunq Easy Green spec):
 *
 *   - palette: forest-950/-800/-600 + mint-500/-200/-100 + ink + paper
 *   - typography: Montserrat (display, 700-800) + Inter (body, 500/600)
 *     loaded from public/fonts/ as variable TTFs
 *   - sentence case headings, tabular numbers, ring borders only (no shadows)
 *   - mint-500 = "high confidence" / improvement; amber/red for medium/low
 *
 * The fonts are committed as variable TTFs so renderToBuffer never hits
 * the network; if registration fails for any reason, react-pdf falls
 * back to Helvetica.
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
  // Helvetica fallback; render still works.
}

// DESIGN.md §2.1 + §2.2 + §2.3 — Easy Green palette in light-mode tokens.
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
  borderStrong: "rgba(14,15,12,0.24)",
  // §2.4 confidence tiers
  confHigh: "#00ff95",
  confMed: "#f79009",
  confLow: "#f04438",
  // §2.6 status
  good: "#17b26a",
  warn: "#f79009",
  danger: "#f04438",
};

const styles = StyleSheet.create({
  page: {
    padding: 0,
    fontSize: 10,
    color: COLOR.ink,
    fontFamily: "Inter",
    backgroundColor: COLOR.paper,
  },
  pageBody: {
    paddingHorizontal: 40,
    paddingTop: 22,
    paddingBottom: 50,
  },

  // Top header — forest-950 canvas, mint accent on brand mark.
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 40,
    paddingVertical: 14,
    backgroundColor: COLOR.forest950,
  },
  headerBrand: {
    fontFamily: "Montserrat",
    fontWeight: 800,
    fontSize: 14,
    color: COLOR.mint500,
    letterSpacing: -0.3,
  },
  headerOrg: {
    fontFamily: "Inter",
    fontWeight: 500,
    fontSize: 9,
    color: COLOR.mint200,
  },
  headerByline: {
    fontFamily: "Inter",
    fontWeight: 400,
    fontSize: 7,
    color: COLOR.mint200,
    marginTop: 2,
    letterSpacing: 0.2,
  },

  // Hero
  hero: {
    fontFamily: "Montserrat",
    fontWeight: 800,
    fontSize: 30,
    color: COLOR.forest950,
    letterSpacing: -0.6,
    marginTop: 4,
    marginBottom: 6,
  },
  heroSub: {
    fontFamily: "Inter",
    fontWeight: 500,
    fontSize: 9,
    color: COLOR.fgSecondary,
    marginBottom: 14,
  },

  pillRow: { flexDirection: "row", gap: 6, marginBottom: 18, flexWrap: "wrap" },
  pill: {
    fontFamily: "Inter",
    fontWeight: 600,
    fontSize: 8,
    color: COLOR.forest800,
    backgroundColor: COLOR.mint100,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    letterSpacing: 0.4,
  },

  // Hero equivalency (kg = t = EUR triple)
  triple: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 16,
    borderTopWidth: 1,
    borderTopColor: COLOR.borderDefault,
    borderBottomWidth: 1,
    borderBottomColor: COLOR.borderDefault,
    marginBottom: 22,
  },
  tripleNumber: {
    fontFamily: "Montserrat",
    fontWeight: 800,
    fontSize: 18,
    color: COLOR.forest950,
    letterSpacing: -0.5,
  },
  tripleEquals: {
    fontFamily: "Montserrat",
    fontWeight: 700,
    fontSize: 16,
    color: COLOR.forest600,
  },
  tripleLabel: {
    fontFamily: "Inter",
    fontWeight: 600,
    fontSize: 7,
    color: COLOR.fgMuted,
    textTransform: "uppercase",
    letterSpacing: 0.6,
    marginTop: 2,
  },

  // KPIs (Stat tiles per DESIGN.md §4.3)
  kpiRow: { flexDirection: "row", gap: 10, marginBottom: 18 },
  kpiBox: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 12,
    backgroundColor: COLOR.surface,
    borderWidth: 0.6,
    borderColor: COLOR.borderDefault,
    borderRadius: 12,
  },
  kpiBoxAccent: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 12,
    backgroundColor: COLOR.mint100,
    borderWidth: 0.6,
    borderColor: COLOR.mint200,
    borderRadius: 12,
  },
  kpiLabel: {
    fontFamily: "Inter",
    fontWeight: 600,
    fontSize: 7,
    color: COLOR.fgMuted,
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  kpiValue: {
    fontFamily: "Montserrat",
    fontWeight: 700,
    fontSize: 18,
    color: COLOR.forest950,
    marginTop: 4,
    letterSpacing: -0.4,
  },
  kpiSub: {
    fontFamily: "Inter",
    fontWeight: 500,
    fontSize: 8,
    color: COLOR.fgSecondary,
    marginTop: 3,
  },
  kpiSubGood: {
    fontFamily: "Inter",
    fontWeight: 600,
    fontSize: 8,
    color: COLOR.forest600,
    marginTop: 3,
  },
  kpiSubBad: {
    fontFamily: "Inter",
    fontWeight: 600,
    fontSize: 8,
    color: COLOR.warn,
    marginTop: 3,
  },

  section: { marginBottom: 18 },
  sectionTitle: {
    fontFamily: "Montserrat",
    fontWeight: 700,
    fontSize: 12,
    color: COLOR.forest950,
    marginBottom: 8,
    letterSpacing: -0.2,
  },

  // Narrative (mint-100 surface w/ forest left border)
  narrativeBox: {
    padding: 14,
    backgroundColor: COLOR.mint100,
    borderRadius: 12,
    marginBottom: 22,
    borderLeftWidth: 3,
    borderLeftColor: COLOR.forest600,
  },
  narrativeText: {
    fontFamily: "Inter",
    fontWeight: 500,
    fontSize: 10,
    lineHeight: 1.55,
    color: COLOR.forest950,
  },

  // Tables (DESIGN.md §4.7)
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
  th: {
    fontFamily: "Inter",
    fontWeight: 600,
    fontSize: 7,
    textTransform: "uppercase",
    color: COLOR.forest600,
    letterSpacing: 0.7,
  },
  td: {
    fontFamily: "Inter",
    fontWeight: 500,
    fontSize: 9,
    color: COLOR.fgPrimary,
  },
  tdNumeric: {
    fontFamily: "Inter",
    fontWeight: 600,
    fontSize: 9,
    color: COLOR.fgPrimary,
  },
  tdMuted: {
    fontFamily: "Inter",
    fontWeight: 500,
    fontSize: 8,
    color: COLOR.fgSecondary,
  },

  // Anomalies / bullets
  bullet: { flexDirection: "row", marginBottom: 8, alignItems: "flex-start" },
  bulletDot: {
    width: 14,
    fontSize: 11,
    fontFamily: "Montserrat",
    fontWeight: 700,
  },
  bulletBody: { flex: 1 },
  bulletPrimary: {
    fontFamily: "Inter",
    fontWeight: 600,
    fontSize: 10,
    color: COLOR.fgPrimary,
  },
  bulletSecondary: {
    fontFamily: "Inter",
    fontWeight: 500,
    fontSize: 9,
    color: COLOR.fgSecondary,
    marginTop: 2,
  },

  // Swap blocks
  swap: { marginBottom: 14 },
  swapHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "baseline" },
  saveBadge: {
    fontFamily: "Inter",
    fontWeight: 700,
    fontSize: 8,
    color: COLOR.fgOnAccent,
    backgroundColor: COLOR.mint500,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
  },

  // Per-project case-study sidebar
  caseStudy: {
    padding: 12,
    backgroundColor: COLOR.surfaceMuted,
    borderLeftWidth: 3,
    borderLeftColor: COLOR.mint500,
    marginBottom: 8,
    borderRadius: 8,
  },
  caseStudyTitle: {
    fontFamily: "Inter",
    fontWeight: 600,
    fontSize: 10,
    color: COLOR.fgPrimary,
    marginBottom: 4,
  },
  caseStudyMeta: {
    fontFamily: "Inter",
    fontWeight: 500,
    fontSize: 8,
    color: COLOR.fgSecondary,
  },

  meta: {
    fontFamily: "Inter",
    fontWeight: 400,
    fontSize: 7,
    color: COLOR.fgMuted,
    marginTop: 28,
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

  // Section divider — forest canvas with mint pill (DESIGN.md "rainbow"
  // accent translated to forest/mint).
  divider: {
    backgroundColor: COLOR.forest950,
    paddingHorizontal: 40,
    paddingVertical: 30,
    marginHorizontal: -40,
    marginVertical: 6,
    borderRadius: 0,
  },
  dividerPill: {
    alignSelf: "flex-start",
    fontFamily: "Inter",
    fontWeight: 700,
    fontSize: 8,
    color: COLOR.fgOnAccent,
    backgroundColor: COLOR.mint500,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    letterSpacing: 0.8,
    textTransform: "uppercase",
    marginBottom: 10,
  },
  dividerTitle: {
    fontFamily: "Montserrat",
    fontWeight: 700,
    fontSize: 22,
    color: COLOR.paper,
    letterSpacing: -0.3,
  },
  dividerSub: {
    fontFamily: "Inter",
    fontWeight: 500,
    fontSize: 9,
    color: COLOR.mint200,
    marginTop: 4,
  },
});

const fmtKg = (kg: number) => (kg >= 1000 ? `${(kg / 1000).toFixed(2)} t` : `${Math.round(kg)} kg`);
const fmtKgPlain = (kg: number) => Math.round(kg).toLocaleString("en-NL");
const fmtTon = (kg: number) => (kg / 1000).toFixed(2);
const fmtEur = (n: number) => `EUR ${n.toLocaleString("en-NL", { maximumFractionDigits: 0 })}`;
const fmtPct = (n: number, withSign = false) => `${withSign && n >= 0 ? "+" : ""}${n.toFixed(0)}%`;

const Header = ({ orgName, period }: { orgName: string; period: CarbonBriefing["period"] }) => (
  <View style={styles.header} fixed>
    <View>
      <Text style={styles.headerBrand}>Carbo</Text>
      <Text style={styles.headerByline}>Generated by bunq Business</Text>
    </View>
    <Text style={styles.headerOrg}>
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
            {b.period.kind === "month" ? <Text style={styles.pill}>CSRD ESRS E1-7 ready</Text> : null}
            <Text style={styles.pill}>Internal summary</Text>
            <Text style={styles.pill}>{b.summary.txCount} transactions</Text>
            <Text style={styles.pill}>Confidence {(b.summary.confidence * 100).toFixed(0)}%</Text>
          </View>

          <View style={styles.triple}>
            <View>
              <Text style={styles.tripleNumber}>{fmtKgPlain(b.summary.totalCo2eKg)} kg</Text>
              <Text style={styles.tripleLabel}>CO₂e this period</Text>
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
              <Text style={styles.kpiLabel}>Total CO₂e</Text>
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
                {b.summary.deltaCo2ePct === null
                  ? "no prior baseline"
                  : `${fmtPct(b.summary.deltaCo2ePct, true)} vs ${b.period.priorLabel}`}
              </Text>
            </View>
            <View style={styles.kpiBox}>
              <Text style={styles.kpiLabel}>Spend</Text>
              <Text style={styles.kpiValue}>{fmtEur(b.summary.totalSpendEur)}</Text>
              <Text style={styles.kpiSub}>
                {b.summary.deltaSpendPct === null
                  ? `${b.summary.txCount} tx`
                  : `${fmtPct(b.summary.deltaSpendPct, true)} vs ${b.period.priorLabel}`}
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
              <Text style={[styles.th, { flex: 2, textAlign: "right" }]}>CO₂e</Text>
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
              <Text style={[styles.th, { flex: 2, textAlign: "right" }]}>CO₂e</Text>
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
          <View style={styles.divider}>
            <Text style={styles.dividerPill}>Action</Text>
            <Text style={styles.dividerTitle}>What changed and what to do next</Text>
            <Text style={styles.dividerSub}>Anomalies, swap recommendations, and the recommended carbon-credit purchase.</Text>
          </View>

          {b.anomalies.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>What changed</Text>
              {b.anomalies.map((a, i) => (
                <View key={i} style={styles.bullet}>
                  <Text style={[styles.bulletDot, { color: a.deltaPct !== null && a.deltaPct >= 0 ? COLOR.warn : COLOR.forest600 }]}>
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
                    <Text style={[styles.tdMuted, { fontSize: 7, marginTop: 2, color: COLOR.fgMuted }]}>
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
            <Text style={styles.dividerPill}>Reserve</Text>
            <Text style={styles.dividerTitle}>Recommended carbon-credit mix</Text>
            <Text style={styles.dividerSub}>EU-registered, removal-weighted; simulated marketplace for the hackathon.</Text>
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
            Generated by Carbo from bunq Business transaction data. Methodology: spend-based GHG Protocol Scope 3 with category-level emission factors (DEFRA 2024, ADEME Base Carbone, Exiobase v3.8.2). Confidence reflects factor uncertainty x classifier confidence x tier weight. Recommended-credit project mix favours EU-registered removal credits per Oxford Principles 2024 / VCMI guidance. Visual style follows the team DESIGN.md (bunq Easy Green palette, Montserrat + Inter typography). This briefing is an internal advisory artefact, not an audited disclosure under CSRD ESRS E1.
          </Text>
        </View>
        <Text style={styles.pageNumber} render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`} fixed />
      </Page>
    </Document>
  );
};
