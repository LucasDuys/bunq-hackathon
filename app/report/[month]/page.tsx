import {
  DEFAULT_ORG_ID,
  getCategorySpendForMonth,
  getLatestCloseRun,
  getLatestEstimatesForMonth,
} from "@/lib/queries";
import { fmtEur, fmtKg, fmtPct } from "@/lib/utils";
import type { CreditProject } from "@/lib/db/schema";
import { ConfidenceBar } from "@/components/ui";
import { ExplainButton } from "@/components/ExplainButton";
import { ShieldCheck } from "lucide-react";

export const dynamic = "force-dynamic";

/**
 * R008.AC2 / T012 — `lib/agent/narrative.ts` was deleted as part of the
 * close-machine ↔ runDag consolidation. The CSRD narrative has always been a
 * deterministic 4-sentence factual summary in mock mode (the only mode the
 * report page is rendered in for the hackathon demo); we inline that body
 * here so the page keeps producing the same output without owning a separate
 * Sonnet touchpoint. If a future spec needs an LLM-written narrative again,
 * call `runDag` (single LLM entry point) and add a narrative shape to the
 * executive report agent — do not resurrect a per-page Anthropic call.
 */
const buildCsrdNarrative = (params: {
  month: string;
  totalCo2eKg: number;
  confidence: number;
  topCategories: Array<{ category: string; co2eKg: number; spendEur: number }>;
  reserveEur: number;
  creditTonnes: number;
  euPct: number;
}): string => {
  const { month, totalCo2eKg, confidence, topCategories, reserveEur, creditTonnes, euPct } = params;
  return [
    `In ${month}, reported Scope 3 emissions were estimated at ${(totalCo2eKg / 1000).toFixed(2)} tCO₂e with ${(confidence * 100).toFixed(0)}% data-quality confidence (spend-based method, Exiobase/DEFRA 2024 factors).`,
    `Top emission drivers: ${topCategories.slice(0, 3).map((c) => `${c.category} (${(c.co2eKg / 1000).toFixed(2)} tCO₂e)`).join(", ")}.`,
    `A Carbo Reserve of €${reserveEur.toFixed(2)} was allocated, funding ${creditTonnes.toFixed(2)} tCO₂e of carbon credits (${euPct.toFixed(0)}% EU-based, removal-weighted).`,
    `Methodology: GHG Protocol Scope 3 Category 1/6; data-quality Tier 3 unless refined; uncertainty quantified per category. Credit recommendations exclude non-EU offsets per policy.`,
  ].join(" ");
};

function categoryToken(cat: string): string {
  const c = cat.toLowerCase();
  if (c.includes("fuel") || c.includes("scope1")) return "var(--cat-fuel)";
  if (c.includes("electric") || c.includes("energy")) return "var(--cat-electricity)";
  if (c.includes("travel") || c.includes("flight") || c.includes("transport")) return "var(--cat-travel)";
  if (c.includes("digital") || c.includes("saas") || c.includes("software")) return "var(--cat-digital)";
  if (c.includes("food") || c.includes("restaurant") || c.includes("grocer")) return "var(--cat-food)";
  if (c.includes("service")) return "var(--cat-services)";
  if (c.includes("good") || c.includes("procure")) return "var(--cat-goods)";
  return "var(--cat-other)";
}

function formatCategoryName(cat: string): string {
  return cat.replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase());
}

function formatMonthLabel(month: string): string {
  // month is "YYYY-MM"
  const [y, m] = month.split("-");
  if (!y || !m) return month;
  const date = new Date(Number(y), Number(m) - 1, 1);
  return date.toLocaleDateString("en-NL", { year: "numeric", month: "long" });
}

export default async function ReportPage({ params }: { params: Promise<{ month: string }> }) {
  const { month } = await params;
  const latest = getLatestCloseRun(DEFAULT_ORG_ID);
  const run = latest && latest.month === month ? latest : null;
  const spendRows = getCategorySpendForMonth(DEFAULT_ORG_ID, month);
  const estimates = getLatestEstimatesForMonth(DEFAULT_ORG_ID, month);

  const perCat = new Map<string, { spendEur: number; co2eKg: number }>();
  for (const r of spendRows) {
    if (!r.category) continue;
    perCat.set(r.category, { spendEur: Number(r.spendEur ?? 0), co2eKg: 0 });
  }
  for (const e of estimates) {
    const cat = e.category ?? "other";
    const s = perCat.get(cat) ?? { spendEur: 0, co2eKg: 0 };
    s.co2eKg += e.co2eKgPoint;
    perCat.set(cat, s);
  }
  const catRows = Array.from(perCat.entries()).sort((a, b) => b[1].co2eKg - a[1].co2eKg);
  const totalCo2 = catRows.reduce((s, [, v]) => s + v.co2eKg, 0);
  const totalSpend = catRows.reduce((s, [, v]) => s + v.spendEur, 0);

  const mix = run?.creditRecommendation
    ? (JSON.parse(run.creditRecommendation) as Array<{ project: CreditProject; tonnes: number; eur: number }>)
    : [];
  const totalTonnes = mix.reduce((s, m) => s + m.tonnes, 0);
  const euTonnes = mix.filter((m) => m.project.region === "EU").reduce((s, m) => s + m.tonnes, 0);
  const removalTonnes = mix
    .filter((m) => m.project.type !== "reduction")
    .reduce((s, m) => s + m.tonnes, 0);
  const euPct = totalTonnes > 0 ? euTonnes / totalTonnes : 0;
  const removalPct = totalTonnes > 0 ? removalTonnes / totalTonnes : 0;

  const confidence = run?.finalConfidence ?? 0.6;
  const headlineCo2 = run?.finalCo2eKg ?? totalCo2;

  const narrative = buildCsrdNarrative({
    month,
    totalCo2eKg: headlineCo2,
    confidence,
    topCategories: catRows.slice(0, 3).map(([category, v]) => ({ category, ...v })),
    reserveEur: run?.reserveEur ?? 0,
    creditTonnes: totalTonnes,
    euPct: euPct * 100,
  });

  const headlineCo2T = headlineCo2 / 1000;
  const monthLabel = formatMonthLabel(month);

  return (
    <div className="rp-stagger flex flex-col gap-14 print:gap-8">
      {/* ── Hero ─────────────────────────────────────────── */}
      <header className="rp-hero">
        <div className="flex items-start justify-between gap-6 flex-wrap">
          <span className="rp-hero__eyebrow">
            <ShieldCheck className="h-3 w-3" />
            CSRD · ESRS E1 extract
          </span>
          <span className="rp-status-pill rp-status-pill--filled">Audit-ready</span>
          <span className="ml-auto">
            <ExplainButton metric="month-co2e" scope={{ month }} />
          </span>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_auto] gap-10 items-end">
          <div className="flex flex-col gap-5">
            <h1 className="rp-hero__title">
              Monthly carbon report <em>— {monthLabel}</em>
            </h1>
            <p className="rp-hero__lede">
              Voluntary monthly slice. Methodology and uncertainty quantified per the GHG Protocol Scope 3
              guidance. Every CO₂e figure below pairs with a confidence indicator; per-row factor lineage is
              recorded in the audit ledger.
            </p>
          </div>

          {/* Hero number */}
          <div className="flex flex-col gap-4 min-w-[280px]">
            <span
              className="font-mono text-[11px]"
              style={{
                color: "var(--fg-muted)",
                letterSpacing: "1.2px",
                textTransform: "uppercase",
              }}
            >
              Gross emissions
            </span>
            <div className="rp-bignum">
              <span className="rp-bignum__value">
                {headlineCo2T >= 1 ? headlineCo2T.toFixed(2) : headlineCo2.toFixed(0)}
              </span>
              <span className="rp-bignum__unit">{headlineCo2T >= 1 ? "tCO₂e" : "kgCO₂e"}</span>
            </div>
            <div style={{ maxWidth: 280 }}>
              <ConfidenceBar value={confidence} animate />
            </div>
          </div>
        </div>

        <div className="rp-hero__meta">
          <span className="rp-hero__meta-row">
            <span>Period</span>
            <b>{month}</b>
          </span>
          <span className="rp-hero__meta-row">
            <span>Spend analysed</span>
            <b>{fmtEur(totalSpend, 0)}</b>
          </span>
          <span className="rp-hero__meta-row">
            <span>Categories</span>
            <b>{catRows.length}</b>
          </span>
          <span className="rp-hero__meta-row">
            <span>Close run</span>
            <b>{run?.id ? `#${run.id}` : "—"}</b>
          </span>
        </div>
      </header>

      {/* ── KPI strip ─────────────────────────────────────── */}
      <section className="rp-kpis">
        <div className="rp-kpis__cell">
          <span className="rp-kpis__label">Credits retired</span>
          <span className="rp-kpis__value">
            {totalTonnes.toFixed(2)}
            <span className="rp-kpis__value-unit">tCO₂e</span>
          </span>
          <span className="rp-kpis__sub">across {mix.length} project{mix.length === 1 ? "" : "s"}</span>
        </div>
        <div className="rp-kpis__cell">
          <span className="rp-kpis__label">EU registry share</span>
          <span className="rp-kpis__value" style={{ color: euPct >= 0.5 ? "var(--brand-green)" : "var(--fg-primary)" }}>
            {fmtPct(euPct).replace("%", "")}
            <span className="rp-kpis__value-unit">%</span>
          </span>
          <span className="rp-kpis__sub">Gold Standard / Puro.earth EU</span>
        </div>
        <div className="rp-kpis__cell">
          <span className="rp-kpis__label">Removal share</span>
          <span className="rp-kpis__value">
            {(removalPct * 100).toFixed(0)}
            <span className="rp-kpis__value-unit">%</span>
          </span>
          <span className="rp-kpis__sub">{((1 - removalPct) * 100).toFixed(0)}% reduction credits</span>
        </div>
        <div className="rp-kpis__cell">
          <span className="rp-kpis__label">Reserve transferred</span>
          <span className="rp-kpis__value" style={{ color: "var(--brand-green)" }}>
            {fmtEur(run?.reserveEur ?? 0, 0).replace("€", "").trim()}
            <span className="rp-kpis__value-unit">EUR</span>
          </span>
          <span className="rp-kpis__sub">{run ? `Close ${run.id}` : "no close run yet"}</span>
        </div>
      </section>

      {/* ── Narrative ─────────────────────────────────────── */}
      {narrative && (
        <section className="rp-narrative">
          <span className="rp-narrative__eyebrow">Narrative summary · auto-drafted</span>
          <p className="rp-narrative__body">{narrative}</p>
        </section>
      )}

      {/* ── E1-6 emissions table ──────────────────────────── */}
      <section className="rp-section">
        <div className="rp-section__head">
          <span className="rp-section__num">E1-6 · Scope 3 Cat 1 / 6</span>
          <h2 className="rp-section__title">Gross GHG emissions</h2>
          <span className="rp-section__rule" />
        </div>

        <div className="overflow-x-auto">
          <table className="rp-table">
            <thead>
              <tr>
                <th>Category</th>
                <th className="is-num">Spend</th>
                <th className="is-num">CO₂e</th>
                <th className="is-num" style={{ width: 200 }}>Share</th>
              </tr>
            </thead>
            <tbody>
              {catRows.map(([cat, v]) => (
                <tr key={cat}>
                  <td>
                    <span
                      className="rp-cat-dot"
                      style={{ "--cat": categoryToken(cat) } as React.CSSProperties}
                    >
                      {formatCategoryName(cat)}
                    </span>
                  </td>
                  <td className="is-num" style={{ color: "var(--fg-secondary)" }}>
                    {fmtEur(v.spendEur, 0)}
                  </td>
                  <td className="is-num">{fmtKg(v.co2eKg)}</td>
                  <td className="is-num">
                    <div className="rp-share-cell">
                      <div className="rp-share-bar">
                        <div
                          className="rp-share-bar__fill"
                          style={
                            {
                              width: `${totalCo2 ? (v.co2eKg / totalCo2) * 100 : 0}%`,
                              "--fill": categoryToken(cat),
                            } as React.CSSProperties
                          }
                        />
                      </div>
                      <span className="rp-share-pct">
                        {totalCo2 ? `${((v.co2eKg / totalCo2) * 100).toFixed(0)}%` : "—"}
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
                    style={{ letterSpacing: "1.2px", textTransform: "uppercase", color: "var(--fg-muted)" }}
                  >
                    Total
                  </span>
                </td>
                <td className="is-num">{fmtEur(totalSpend, 0)}</td>
                <td className="is-num">{fmtKg(totalCo2)}</td>
                <td className="is-num">100%</td>
              </tr>
            </tfoot>
          </table>
        </div>

        <div
          className="flex items-start justify-between gap-8 flex-wrap pt-2"
        >
          <p
            className="m-0 text-[13px]"
            style={{ color: "var(--fg-muted)", maxWidth: "62ch", lineHeight: 1.55 }}
          >
            <span style={{ color: "var(--fg-secondary)" }}>Method —</span> spend-based using Exiobase, DEFRA 2024
            and ADEME Base Carbone factors. Uncertainty varies by tier and is preserved at row level; aggregate
            confidence is computed via quadrature.
          </p>
          <div className="min-w-[240px]">
            <ConfidenceBar value={confidence} animate />
          </div>
        </div>
      </section>

      {/* ── E1-7 credits ──────────────────────────────────── */}
      <section className="rp-section">
        <div className="rp-section__head">
          <span className="rp-section__num">E1-7 · Post-reduction purchase</span>
          <h2 className="rp-section__title">Carbon removal &amp; credits</h2>
          <span className="rp-section__rule" />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
          <div className="rp-statcard rp-statcard--accent">
            <span className="rp-statcard__label">Total retired</span>
            <span className="rp-statcard__value">
              {totalTonnes.toFixed(2)}
              <span className="rp-statcard__value-unit">tCO₂e</span>
            </span>
            <span className="rp-statcard__sub">cancelled this close</span>
          </div>
          <div className="rp-statcard">
            <span className="rp-statcard__label">EU-based</span>
            <span className="rp-statcard__value" style={{ color: euPct >= 0.5 ? "var(--brand-green)" : "var(--fg-primary)" }}>
              {fmtPct(euPct).replace("%", "")}
              <span className="rp-statcard__value-unit">%</span>
            </span>
            <span className="rp-statcard__sub">Gold Standard · Puro.earth EU</span>
          </div>
          <div className="rp-statcard">
            <span className="rp-statcard__label">Removal vs reduction</span>
            <span className="rp-statcard__value">
              {(removalPct * 100).toFixed(0)}
              <span className="rp-statcard__value-unit">% removal</span>
            </span>
            <span className="rp-statcard__sub">{((1 - removalPct) * 100).toFixed(0)}% reduction</span>
          </div>
        </div>

        {mix.length > 0 ? (
          <div className="overflow-x-auto pt-2">
            <table className="rp-table">
              <thead>
                <tr>
                  <th>Project</th>
                  <th>Type</th>
                  <th>Registry</th>
                  <th className="is-num">Tonnes</th>
                  <th className="is-num">EUR</th>
                </tr>
              </thead>
              <tbody>
                {mix.map((m) => (
                  <tr key={m.project.id}>
                    <td>
                      <div className="flex items-center gap-3">
                        <span
                          className="inline-block w-1.5 h-1.5 rounded-full"
                          style={{ background: "var(--brand-green)" }}
                        />
                        <span style={{ color: "var(--fg-primary)", letterSpacing: "-0.005em" }}>
                          {m.project.name}
                        </span>
                      </div>
                    </td>
                    <td>
                      <span
                        className="rp-cat-pill"
                        style={
                          {
                            "--cat":
                              m.project.type === "reduction"
                                ? "var(--cat-services)"
                                : "var(--brand-green)",
                          } as React.CSSProperties
                        }
                      >
                        {m.project.type.replace("_", " ")}
                      </span>
                    </td>
                    <td>
                      <span
                        style={{
                          fontFamily: "var(--font-mono)",
                          fontSize: 12,
                          color: "var(--fg-muted)",
                          letterSpacing: "0.4px",
                        }}
                      >
                        {m.project.registry}
                      </span>
                    </td>
                    <td className="is-num">{m.tonnes.toFixed(3)}</td>
                    <td className="is-num">{fmtEur(m.eur)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p
            className="text-[14px] m-0 pt-2"
            style={{ color: "var(--fg-muted)" }}
          >
            No credit purchases recorded for {month}.
          </p>
        )}
      </section>

      {/* ── Methodology ───────────────────────────────────── */}
      <section className="rp-section">
        <div className="rp-section__head">
          <span className="rp-section__num">Appendix · Methodology</span>
          <h2 className="rp-section__title">How these numbers were built</h2>
          <span className="rp-section__rule" />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-x-10 gap-y-6">
          <div className="flex flex-col gap-3">
            <span
              className="font-mono text-[11px]"
              style={{ letterSpacing: "1.2px", textTransform: "uppercase", color: "var(--brand-green)" }}
            >
              01 Ingestion
            </span>
            <p
              className="m-0 text-[14px]"
              style={{ color: "var(--fg-secondary)", lineHeight: 1.6 }}
            >
              Transactions arrive via the bunq MUTATION webhook. Each row is hash-chained into the
              append-only audit ledger before classification.
            </p>
          </div>
          <div className="flex flex-col gap-3">
            <span
              className="font-mono text-[11px]"
              style={{ letterSpacing: "1.2px", textTransform: "uppercase", color: "var(--brand-green)" }}
            >
              02 Classification
            </span>
            <p
              className="m-0 text-[14px]"
              style={{ color: "var(--fg-secondary)", lineHeight: 1.6 }}
            >
              Merchant-first regex rules; Claude Haiku 4.5 fallback. Per-transaction CO₂e = spend ×
              factor (DEFRA 2024 · ADEME · Exiobase v3). Each factor row carries an uncertainty %
              following GHG Protocol tier guidance.
            </p>
          </div>
          <div className="flex flex-col gap-3">
            <span
              className="font-mono text-[11px]"
              style={{ letterSpacing: "1.2px", textTransform: "uppercase", color: "var(--brand-green)" }}
            >
              03 Confidence &amp; close
            </span>
            <p
              className="m-0 text-[14px]"
              style={{ color: "var(--fg-secondary)", lineHeight: 1.6 }}
            >
              Confidence = (1 − factor uncertainty) × classifier confidence × tier weight. Uncertainty
              clusters drive ≤3 refine questions per close. Reserve allocation and credit choice follow a
              declarative <code className="font-mono text-[12px] px-1 py-0.5 rounded" style={{ background: "var(--bg-inset)", color: "var(--fg-secondary)" }}>policies</code> row.
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
          Audit ledger · SHA-256 hash-chained · UPDATE/DELETE blocked by trigger · Operational-control boundary
        </p>
      </section>

      {/* Print overrides */}
      <style>{`
        @media print {
          body { background: #fff !important; color: #000 !important; }
          .ca-card { border-color: rgba(0,0,0,0.15) !important; background: #fff !important; }
          .code-label { color: rgba(0,0,0,0.55) !important; }
          .rp-bignum, .rp-hero__title, .rp-section__title { color: #000 !important; }
          .rp-hero__title em { color: #555 !important; }
        }
      `}</style>
    </div>
  );
}
