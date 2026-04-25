import { notFound } from "next/navigation";
import {
  Leaf,
  ShieldCheck,
  TreePine,
  Plane,
  Car,
  TrendingDown,
  Wallet,
  Zap,
  ArrowRight,
  Banknote,
} from "lucide-react";
import { getProofStats } from "@/lib/audit/proof";
import { fmtEur, fmtKg } from "@/lib/utils";

export const dynamic = "force-dynamic";

const CAT_COLORS: Record<string, string> = {
  fuel: "#e5484d",
  electricity: "#3ecf8e",
  goods_and_services: "#9d72ff",
  travel: "#7c66dc",
  digital: "#5fb9ff",
  services: "#f7b955",
  food_and_catering: "#f76b15",
  other: "#898989",
};

const CAT_LABELS: Record<string, string> = {
  fuel: "Fuel & heating",
  electricity: "Electricity",
  goods_and_services: "Goods & services",
  travel: "Travel & transport",
  digital: "Digital & SaaS",
  services: "Professional services",
  food_and_catering: "Food & catering",
  other: "Other",
};

function fmtCompact(n: number): string {
  if (n >= 1_000_000) return `€${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1000) return `€${(n / 1000).toFixed(1)}k`;
  return `€${Math.round(n)}`;
}

export default async function GreenReportPage({
  params,
}: {
  params: Promise<{ orgId: string }>;
}) {
  const { orgId } = await params;
  const s = getProofStats(orgId);
  if (!s) notFound();
  if (s.monthsTracked === 0) notFound();

  const maxCat = Math.max(...s.categoryBreakdown.map((c) => c.co2eKg), 1);
  const verified = s.chainIntegrity.valid;

  return (
    <div className="green-report">
      {/* ── Header ── */}
      <header className="gr-header">
        <div className="gr-header-badge">
          <Leaf className="h-5 w-5" style={{ color: "var(--brand-green)" }} />
          <span>Carbo</span>
        </div>
        <div className="gr-header-title">Green Impact Report</div>
        <div className="gr-header-org">{s.org.name}</div>
        <div className="gr-header-meta">
          {s.monthsTracked} month{s.monthsTracked !== 1 ? "s" : ""} tracked
          · {s.totalTxCount} transactions
        </div>
      </header>

      {/* ── Hero: CO₂ tracked ── */}
      <section className="gr-section">
        <div className="gr-hero-ring-wrap">
          <svg
            width="200"
            height="200"
            viewBox="0 0 200 200"
            className="gr-hero-ring"
          >
            <circle
              cx="100"
              cy="100"
              r="92"
              fill="none"
              stroke="var(--border-faint)"
              strokeWidth="7"
            />
            <circle
              cx="100"
              cy="100"
              r="92"
              fill="none"
              stroke="var(--brand-green)"
              strokeWidth="7"
              strokeLinecap="round"
              strokeDasharray={`${2 * Math.PI * 92 * 0.78} ${2 * Math.PI * 92 * 0.22}`}
              transform="rotate(-90 100 100)"
              className="gr-ring-arc"
            />
          </svg>
          <div className="gr-hero-ring-center">
            <Leaf
              className="h-6 w-6 mb-1"
              style={{ color: "var(--brand-green)" }}
            />
            <div className="gr-hero-value tabular-nums">
              {s.totalCo2eKg >= 1000
                ? `${(s.totalCo2eKg / 1000).toFixed(1)}`
                : `${Math.round(s.totalCo2eKg)}`}
              <span className="gr-hero-unit">
                {s.totalCo2eKg >= 1000 ? "t" : "kg"}
              </span>
            </div>
            <div className="gr-hero-label">CO₂e tracked</div>
          </div>
        </div>
      </section>

      {/* ── Equivalencies ── */}
      <section className="gr-section gr-equivs">
        <div className="gr-equiv">
          <div className="gr-equiv-icon" style={{ borderColor: "rgba(62,207,142,0.20)", background: "rgba(62,207,142,0.06)" }}>
            <TreePine className="h-4 w-4" style={{ color: "var(--brand-green)" }} />
          </div>
          <div>
            <div className="gr-equiv-value tabular-nums">{s.treesEquivalent.toLocaleString()} trees</div>
            <div className="gr-equiv-sub">needed to absorb this for a year</div>
          </div>
        </div>
        <div className="gr-equiv">
          <div className="gr-equiv-icon" style={{ borderColor: "rgba(95,185,255,0.20)", background: "rgba(95,185,255,0.06)" }}>
            <Plane className="h-4 w-4" style={{ color: "#5fb9ff" }} />
          </div>
          <div>
            <div className="gr-equiv-value tabular-nums">{s.flightsEquivalent} flights</div>
            <div className="gr-equiv-sub">Amsterdam → New York</div>
          </div>
        </div>
        <div className="gr-equiv">
          <div className="gr-equiv-icon" style={{ borderColor: "rgba(247,185,85,0.20)", background: "rgba(247,185,85,0.06)" }}>
            <Car className="h-4 w-4" style={{ color: "#f7b955" }} />
          </div>
          <div>
            <div className="gr-equiv-value tabular-nums">{s.kmDrivenEquivalent.toLocaleString()} km</div>
            <div className="gr-equiv-sub">driven by an average car</div>
          </div>
        </div>
      </section>

      {/* ── Financial impact ── */}
      <section className="gr-section">
        <div className="gr-eyebrow">Financial impact</div>
        <div className="gr-kpi-row">
          <div className="gr-kpi">
            <Banknote className="h-5 w-5" style={{ color: "var(--brand-green)" }} />
            <div className="gr-kpi-value tabular-nums" style={{ color: "var(--brand-green)" }}>
              {fmtCompact(s.savings.totalPotentialEur)}
            </div>
            <div className="gr-kpi-label">Potential savings identified</div>
          </div>
          <div className="gr-kpi">
            <Wallet className="h-5 w-5" style={{ color: "var(--fg-muted)" }} />
            <div className="gr-kpi-value tabular-nums">
              {fmtCompact(s.totalReserveEur)}
            </div>
            <div className="gr-kpi-label">Carbon reserve</div>
          </div>
        </div>
        {s.savings.annualProjection > 0 && (
          <div className="gr-projection">
            <ArrowRight className="h-3.5 w-3.5" style={{ color: "var(--brand-green)" }} />
            <span>
              Projected annual savings:{" "}
              <strong style={{ color: "var(--brand-green)" }}>
                {fmtCompact(s.savings.annualProjection)}
              </strong>
            </span>
          </div>
        )}
      </section>

      {/* ── Savings by scheme ── */}
      {s.savings.topSchemes.length > 0 && (
        <section className="gr-section">
          <div className="gr-eyebrow">How you save</div>
          <div className="gr-schemes">
            {s.savings.topSchemes.map((scheme) => (
              <div key={scheme.name} className="gr-scheme-row">
                <span className="gr-scheme-name">{scheme.name}</span>
                <span className="gr-scheme-value tabular-nums">
                  {fmtCompact(scheme.totalEur)}
                </span>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ── Category breakdown ── */}
      <section className="gr-section">
        <div className="gr-eyebrow">Emissions by category</div>
        <div className="gr-categories">
          {s.categoryBreakdown.slice(0, 6).map((cat) => {
            const pct = (cat.co2eKg / maxCat) * 100;
            const color = CAT_COLORS[cat.category] ?? "#898989";
            const label = CAT_LABELS[cat.category] ?? cat.category.replace(/_/g, " ");
            return (
              <div key={cat.category} className="gr-cat">
                <div className="gr-cat-header">
                  <div className="gr-cat-label">
                    <span
                      className="gr-cat-dot"
                      style={{ background: color }}
                    />
                    <span>{label}</span>
                  </div>
                  <span className="gr-cat-value tabular-nums">{fmtKg(cat.co2eKg)}</span>
                </div>
                <div className="gr-cat-track">
                  <div
                    className="gr-cat-bar"
                    style={{ width: `${pct}%`, background: color }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* ── Monthly trend ── */}
      {s.closedMonths.length > 0 && (
        <section className="gr-section">
          <div className="gr-eyebrow">Monthly overview</div>
          <div className="gr-months">
            {s.closedMonths.map((m) => {
              const maxM = Math.max(...s.closedMonths.map((x) => x.co2eKg), 1);
              const h = (m.co2eKg / maxM) * 100;
              return (
                <div key={m.month} className="gr-month-col">
                  <span className="gr-month-val tabular-nums">
                    {fmtKg(m.co2eKg)}
                  </span>
                  <div className="gr-month-bar-wrap">
                    <div
                      className="gr-month-bar"
                      style={{ height: `${h}%` }}
                    />
                  </div>
                  <span className="gr-month-label tabular-nums">
                    {m.month.slice(5)}
                  </span>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* ── Carbon credits + bunq subaccounts ── */}
      {(s.totalCreditsTonnes > 0 || s.totalReserveEur > 0) && (
        <section className="gr-section">
          <div className="gr-eyebrow">bunq subaccounts</div>
          <div className="gr-accounts">
            <div className="gr-account">
              <div className="gr-account-header">
                <div className="gr-account-dot" style={{ background: "var(--brand-green)" }} />
                <span>Carbon Reserve</span>
              </div>
              <div className="gr-account-value tabular-nums">
                {fmtEur(s.totalReserveEur, 0)}
              </div>
              <div className="gr-account-sub">
                Auto-transferred from main account after each monthly close
              </div>
            </div>
            {s.totalCreditsTonnes > 0 && (
              <div className="gr-account">
                <div className="gr-account-header">
                  <div className="gr-account-dot" style={{ background: "var(--status-info)" }} />
                  <span>Carbon Credits</span>
                </div>
                <div className="gr-account-value tabular-nums" style={{ color: "var(--brand-green)" }}>
                  {s.totalCreditsTonnes.toFixed(2)}t offset
                </div>
                <div className="gr-account-sub">
                  {fmtEur(s.totalCreditsEur, 0)} spent on verified EU carbon credit projects
                </div>
              </div>
            )}
          </div>
        </section>
      )}

      {/* ── Verification ── */}
      <section className="gr-section gr-verify">
        <div className="gr-verify-row">
          <div className="gr-verify-icon">
            <ShieldCheck
              className="h-4 w-4"
              style={{ color: verified ? "var(--brand-green)" : "var(--status-danger)" }}
            />
          </div>
          <div className="gr-verify-text">
            <span>Cryptographically verified</span>
            <span className="gr-verify-sub">
              {s.chainIntegrity.eventCount} events · SHA-256 chain{" "}
              {verified ? "intact" : "broken"}
            </span>
          </div>
          <span
            className="gr-verify-badge tabular-nums"
            style={{
              color: verified ? "var(--brand-green)" : "var(--status-danger)",
              borderColor: verified ? "var(--brand-green-border)" : "rgba(229,72,77,0.30)",
            }}
          >
            {verified ? "Verified" : "Failed"}
          </span>
        </div>
        <div className="gr-hash tabular-nums">{s.latestHash}</div>
      </section>

      {/* ── Footer ── */}
      <footer className="gr-footer">
        <Leaf className="h-3.5 w-3.5" style={{ color: "var(--brand-green)" }} />
        <span>Carbo for bunq Business</span>
      </footer>
    </div>
  );
}
