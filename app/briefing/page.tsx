import { buildBriefing } from "@/lib/reports/briefing";
import { fmtEur, fmtKg } from "@/lib/utils";
import {
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  Download,
  Lightbulb,
  Sparkles,
  Trees,
} from "lucide-react";
import Link from "next/link";
import { ExplainButton } from "@/components/ExplainButton";

export const dynamic = "force-dynamic";

function categoryToken(cat: string | null | undefined): string {
  const c = (cat ?? "").toLowerCase();
  if (c.includes("fuel") || c.includes("scope1")) return "var(--cat-fuel)";
  if (c.includes("electric") || c.includes("energy")) return "var(--cat-electricity)";
  if (c.includes("travel") || c.includes("flight") || c.includes("transport")) return "var(--cat-travel)";
  if (c.includes("digital") || c.includes("saas") || c.includes("software")) return "var(--cat-digital)";
  if (c.includes("service")) return "var(--cat-services)";
  if (c.includes("good") || c.includes("procure")) return "var(--cat-goods)";
  return "var(--cat-other)";
}

function formatCategoryName(cat: string): string {
  return cat.replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase());
}

function deltaTone(pct: number | null) {
  if (pct === null) return "flat" as const;
  if (pct > 0.5) return "up" as const;
  if (pct < -0.5) return "down" as const;
  return "flat" as const;
}

export default async function BriefingPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string; kind?: "month" | "week"; label?: string }>;
}) {
  const params = await searchParams;
  const kind = params.kind ?? "month";
  const label = params.label ?? params.month;
  const briefing = await buildBriefing({ kind, label });

  const { period, summary, topCategories, topMerchants, anomalies, swaps, reserve, narrative } = briefing;
  const deltaCo2 = summary.deltaCo2ePct;
  const deltaSpend = summary.deltaSpendPct;
  const confPct = Math.round(summary.confidence * 100);

  const startDate = new Date(period.startTs * 1000).toISOString().slice(0, 10);
  const endDate = new Date(period.endTs * 1000).toISOString().slice(0, 10);

  return (
    <div className="rp-stagger flex flex-col gap-14">
      {/* ── Hero ─────────────────────────────────────────── */}
      <header className="rp-hero">
        <div className="flex items-start justify-between gap-6 flex-wrap">
          <span className="rp-hero__eyebrow">
            <Sparkles className="h-3 w-3" />
            {kind === "week" ? "Weekly briefing" : "Monthly briefing"} · {period.label}
          </span>
          <div className="flex items-center gap-2">
            <ExplainButton
              metric={kind === "month" ? "month-co2e" : "trend"}
              scope={kind === "month" && period.label ? { month: period.label } : {}}
            />
            <Link
              href={`/briefing/pdf?kind=${kind}&label=${period.label}`}
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

        <h1 className="rp-hero__title">
          A clear-eyed read on <em>{briefing.orgName}</em>'s carbon position.
        </h1>

        <p className="rp-hero__lede">
          {kind === "week" ? "Weekly" : "Monthly"} internal summary — not a regulatory disclosure. Every CO₂e
          number ships with a confidence band; the swaps below are the highest-leverage adjustments we found in
          this period's spend.
        </p>

        <div className="rp-hero__meta">
          <span className="rp-hero__meta-row">
            <span>Period</span>
            <b>{startDate} → {endDate}</b>
          </span>
          <span className="rp-hero__meta-row">
            <span>Transactions</span>
            <b>{summary.txCount}</b>
          </span>
          <span className="rp-hero__meta-row">
            <span>Confidence</span>
            <b>{confPct}%</b>
          </span>
          <span className="rp-hero__meta-row">
            <span>Generated</span>
            <b>{new Date(briefing.generatedAt).toLocaleString("en-NL", { dateStyle: "short", timeStyle: "short" })}</b>
          </span>
        </div>
      </header>

      {/* ── KPI strip ────────────────────────────────────── */}
      <section className="rp-kpis">
        <div className="rp-kpis__cell">
          <span className="rp-kpis__label">Total CO₂e</span>
          <span className="rp-kpis__value">
            {fmtKg(summary.totalCo2eKg).replace(/\s?(kg|t)CO₂e/, "")}
            <span className="rp-kpis__value-unit">{summary.totalCo2eKg >= 1000 ? "tCO₂e" : "kgCO₂e"}</span>
          </span>
          <span className="rp-kpis__sub">
            {deltaCo2 === null ? (
              "no prior baseline"
            ) : (
              <span className={`rp-kpis__delta rp-kpis__delta--${deltaTone(deltaCo2)}`}>
                {deltaCo2 > 0 ? <ArrowUpRight className="h-3.5 w-3.5" /> : <ArrowDownRight className="h-3.5 w-3.5" />}
                {deltaCo2 >= 0 ? "+" : ""}{deltaCo2.toFixed(0)}% vs {period.priorLabel}
              </span>
            )}
          </span>
        </div>

        <div className="rp-kpis__cell">
          <span className="rp-kpis__label">Spend analysed</span>
          <span className="rp-kpis__value">
            {fmtEur(summary.totalSpendEur, 0).replace("€", "").trim()}
            <span className="rp-kpis__value-unit">EUR</span>
          </span>
          <span className="rp-kpis__sub">
            {deltaSpend === null ? (
              `${summary.txCount} transactions`
            ) : (
              <span className={`rp-kpis__delta rp-kpis__delta--${deltaTone(deltaSpend)}`}>
                {deltaSpend > 0 ? <ArrowUpRight className="h-3.5 w-3.5" /> : <ArrowDownRight className="h-3.5 w-3.5" />}
                {deltaSpend >= 0 ? "+" : ""}{deltaSpend.toFixed(0)}% vs {period.priorLabel}
              </span>
            )}
          </span>
        </div>

        <div className="rp-kpis__cell">
          <span className="rp-kpis__label">Confidence</span>
          <span className="rp-kpis__value" style={{ color: confPct >= 70 ? "var(--brand-green)" : "var(--status-warning)" }}>
            {confPct}<span className="rp-kpis__value-unit">%</span>
          </span>
          <div className="mt-1">
            <div className="rp-share-bar" style={{ maxWidth: "none", height: 4 }}>
              <div
                className="rp-share-bar__fill"
                style={
                  {
                    width: `${confPct}%`,
                    "--fill":
                      confPct >= 85
                        ? "var(--confidence-high)"
                        : confPct >= 60
                          ? "var(--confidence-medium)"
                          : "var(--confidence-low)",
                  } as React.CSSProperties
                }
              />
            </div>
            <span className="text-[12px] mt-1.5 block" style={{ color: "var(--fg-muted)" }}>
              spend-weighted
            </span>
          </div>
        </div>

        <div className="rp-kpis__cell">
          <span className="rp-kpis__label">Reserve balance</span>
          <span className="rp-kpis__value" style={{ color: "var(--brand-green)" }}>
            {fmtEur(summary.reserveBalanceEur, 0).replace("€", "").trim()}
            <span className="rp-kpis__value-unit">EUR</span>
          </span>
          <span className="rp-kpis__sub">last close</span>
        </div>
      </section>

      {/* ── Narrative pull-quote ─────────────────────────── */}
      {narrative && (
        <section className="rp-narrative">
          <span className="rp-narrative__eyebrow">Executive read</span>
          <p className="rp-narrative__body">{narrative}</p>
        </section>
      )}

      {/* ── Categories + Merchants two-column ────────────── */}
      <section className="grid grid-cols-1 xl:grid-cols-2 gap-10">
        <div className="rp-section">
          <div className="rp-section__head">
            <span className="rp-section__num">01 · By category</span>
            <h2 className="rp-section__title">Where the carbon went</h2>
            <span className="rp-section__rule" />
          </div>

          {topCategories.length === 0 ? (
            <p className="text-sm" style={{ color: "var(--fg-muted)" }}>
              No categorised emissions in this period.
            </p>
          ) : (
            <table className="rp-table">
              <thead>
                <tr>
                  <th>Category</th>
                  <th className="is-num">Spend</th>
                  <th className="is-num">CO₂e</th>
                  <th className="is-num" style={{ width: 180 }}>Share</th>
                </tr>
              </thead>
              <tbody>
                {topCategories.map((c) => (
                  <tr key={c.category}>
                    <td>
                      <span
                        className="rp-cat-dot"
                        style={{ "--cat": categoryToken(c.category) } as React.CSSProperties}
                      >
                        {formatCategoryName(c.category)}
                      </span>
                    </td>
                    <td className="is-num" style={{ color: "var(--fg-secondary)" }}>
                      {fmtEur(c.spendEur, 0)}
                    </td>
                    <td className="is-num">{fmtKg(c.co2eKg)}</td>
                    <td className="is-num">
                      <div className="rp-share-cell">
                        <div className="rp-share-bar">
                          <div
                            className="rp-share-bar__fill"
                            style={
                              {
                                width: `${c.sharePct}%`,
                                "--fill": categoryToken(c.category),
                              } as React.CSSProperties
                            }
                          />
                        </div>
                        <span className="rp-share-pct">{c.sharePct.toFixed(0)}%</span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="rp-section">
          <div className="rp-section__head">
            <span className="rp-section__num">02 · By merchant</span>
            <h2 className="rp-section__title">Top emitting suppliers</h2>
            <span className="rp-section__rule" />
          </div>

          {topMerchants.length === 0 ? (
            <p className="text-sm" style={{ color: "var(--fg-muted)" }}>
              No transactions in this period.
            </p>
          ) : (
            <table className="rp-table">
              <thead>
                <tr>
                  <th>Merchant</th>
                  <th className="is-num">Tx</th>
                  <th className="is-num">CO₂e</th>
                  <th className="is-num" style={{ width: 180 }}>Share</th>
                </tr>
              </thead>
              <tbody>
                {topMerchants.map((m) => (
                  <tr key={m.merchantNorm}>
                    <td>
                      <div className="flex flex-col gap-1">
                        <span style={{ color: "var(--fg-primary)", letterSpacing: "-0.005em" }}>
                          {m.merchantRaw}
                        </span>
                        {m.category && (
                          <span
                            className="rp-cat-pill"
                            style={{ "--cat": categoryToken(m.category) } as React.CSSProperties}
                          >
                            {formatCategoryName(m.category)}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="is-num" style={{ color: "var(--fg-secondary)" }}>
                      {m.txCount}
                    </td>
                    <td className="is-num">{fmtKg(m.co2eKg)}</td>
                    <td className="is-num">
                      <div className="rp-share-cell">
                        <div className="rp-share-bar">
                          <div
                            className="rp-share-bar__fill"
                            style={
                              {
                                width: `${m.sharePct}%`,
                                "--fill": categoryToken(m.category),
                              } as React.CSSProperties
                            }
                          />
                        </div>
                        <span className="rp-share-pct">{m.sharePct.toFixed(0)}%</span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </section>

      {/* ── What changed ─────────────────────────────────── */}
      {anomalies.length > 0 && (
        <section className="rp-section">
          <div className="rp-section__head">
            <span className="rp-section__num">03 · Movement</span>
            <h2 className="rp-section__title">What changed since {period.priorLabel}</h2>
            <span className="rp-section__rule" />
          </div>

          <div>
            {anomalies.map((a, i) => {
              const variant =
                a.deltaPct === null ? "alert" : a.deltaPct >= 0 ? "up" : "down";
              return (
                <div key={i} className="rp-row">
                  <div className={`rp-row__icon rp-row__icon--${variant}`}>
                    {variant === "up" ? (
                      <ArrowUpRight className="h-3.5 w-3.5" />
                    ) : variant === "down" ? (
                      <ArrowDownRight className="h-3.5 w-3.5" />
                    ) : (
                      <AlertTriangle className="h-3.5 w-3.5" />
                    )}
                  </div>
                  <div>
                    <p className="rp-row__title">{a.subject}</p>
                    <p className="rp-row__body">{a.message}</p>
                  </div>
                  {a.deltaPct !== null && (
                    <div className="rp-row__meta">
                      {a.deltaPct >= 0 ? "+" : ""}
                      {a.deltaPct.toFixed(0)}%
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* ── Recommended swaps ────────────────────────────── */}
      {swaps.length > 0 && (
        <section className="rp-section">
          <div className="rp-section__head">
            <span className="rp-section__num">04 · Levers</span>
            <h2 className="rp-section__title">Highest-leverage swaps</h2>
            <span className="rp-section__rule" />
          </div>

          <div>
            {swaps.map((s, i) => (
              <div key={i} className="rp-row">
                <div className="rp-row__icon rp-row__icon--swap">
                  <Lightbulb className="h-3.5 w-3.5" />
                </div>
                <div>
                  <p className="rp-row__title">
                    <span style={{ color: "var(--fg-muted)", textTransform: "capitalize" }}>
                      {formatCategoryName(s.from)}
                    </span>
                    <span style={{ margin: "0 8px", color: "var(--fg-faint)" }}>→</span>
                    <span style={{ color: "var(--brand-green)" }}>{s.to}</span>
                  </p>
                  <p className="rp-row__body">{s.rationale}</p>
                </div>
                <div className="rp-row__meta">
                  <div>−{fmtKg(s.expectedSavingKg)}</div>
                  <div style={{ color: "var(--fg-muted)", marginTop: 2 }}>
                    {s.expectedSavingPct.toFixed(0)}% saved
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ── Credit recommendations ───────────────────────── */}
      <section className="rp-section">
        <div className="rp-section__head">
          <span className="rp-section__num">05 · Reserve</span>
          <h2 className="rp-section__title">Recommended carbon credits</h2>
          <span className="rp-section__rule" />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
          <div className="rp-statcard rp-statcard--accent">
            <span className="rp-statcard__label">Tonnes to retire</span>
            <span className="rp-statcard__value">
              {reserve.recommendedTonnes.toFixed(2)}
              <span className="rp-statcard__value-unit">tCO₂e</span>
            </span>
            <span className="rp-statcard__sub">post-reduction balance</span>
          </div>
          <div className="rp-statcard">
            <span className="rp-statcard__label">Estimated cost</span>
            <span className="rp-statcard__value">
              {fmtEur(reserve.recommendedSpendEur, 0).replace("€", "").trim()}
              <span className="rp-statcard__value-unit">EUR</span>
            </span>
            <span className="rp-statcard__sub">at policy ceiling</span>
          </div>
          <div className="rp-statcard">
            <span className="rp-statcard__label">Project mix</span>
            <span className="rp-statcard__value">
              {reserve.projectMix.length}
              <span className="rp-statcard__value-unit">projects</span>
            </span>
            <span className="rp-statcard__sub">EU registry preferred</span>
          </div>
        </div>

        {reserve.projectMix.length > 0 && (
          <div className="mt-2">
            {reserve.projectMix.map((p) => (
              <div key={p.projectId} className="rp-project">
                <div className="rp-project__icon">
                  <Trees className="h-4 w-4" />
                </div>
                <div className="min-w-0">
                  <div className="rp-project__name truncate">{p.projectName}</div>
                  <div className="rp-project__sub">
                    <span>Project</span>
                    <span style={{ color: "var(--fg-faint)" }}>·</span>
                    <span style={{ fontFamily: "var(--font-mono)" }}>{p.projectId.slice(0, 12)}</span>
                  </div>
                </div>
                <div className="rp-project__num">
                  {p.tonnes.toFixed(2)} t
                  <small>retire</small>
                </div>
                <div className="rp-project__num">
                  {fmtEur(p.eur)}
                  <small>cost</small>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <p
        className="text-[11px] pt-6 border-t"
        style={{
          color: "var(--fg-muted)",
          borderColor: "var(--border-faint)",
          fontFamily: "var(--font-mono)",
          letterSpacing: "1px",
          textTransform: "uppercase",
        }}
      >
        Auto-generated · Carbo · Internal use · Not for regulatory submission
      </p>
    </div>
  );
}
