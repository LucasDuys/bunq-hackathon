"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  Leaf,
  ShieldCheck,
  TreePine,
  Plane,
  Car,
  Banknote,
  Wallet,
  ArrowRight,
  ChevronDown,
} from "lucide-react";
import type { ProofStats } from "@/lib/audit/proof";

/* ── Helpers ── */

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

function fmtKgShort(kg: number): string {
  if (kg >= 1000) return `${(kg / 1000).toFixed(1)}t`;
  return `${kg.toFixed(0)}kg`;
}

/* ── Animated counter ── */
function Counter({
  to,
  decimals = 0,
  prefix = "",
  suffix = "",
  duration = 1400,
}: {
  to: number;
  decimals?: number;
  prefix?: string;
  suffix?: string;
  duration?: number;
}) {
  const [val, setVal] = useState(0);
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([e]) => {
        if (!e.isIntersecting) return;
        obs.disconnect();
        const start = performance.now();
        const tick = (now: number) => {
          const t = Math.min((now - start) / duration, 1);
          const ease = 1 - Math.pow(1 - t, 3);
          setVal(to * ease);
          if (t < 1) requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
      },
      { threshold: 0.2 },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [to, duration]);

  return (
    <span ref={ref} className="tabular-nums">
      {prefix}
      {val.toFixed(decimals)}
      {suffix}
    </span>
  );
}

/* ── Reveal on scroll ── */
function Reveal({ children, delay = 0 }: { children: ReactNode; delay?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) {
          setVisible(true);
          obs.disconnect();
        }
      },
      { threshold: 0.15 },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      style={{
        opacity: visible ? 1 : 0,
        transform: visible ? "translateY(0)" : "translateY(20px)",
        transition: `opacity 600ms ease ${delay}ms, transform 600ms ease ${delay}ms`,
      }}
    >
      {children}
    </div>
  );
}

/* ── Donut chart ── */
function Donut({
  segments,
  size = 200,
  thickness = 20,
}: {
  segments: { label: string; value: number; color: string }[];
  size?: number;
  thickness?: number;
}) {
  const total = segments.reduce((s, seg) => s + seg.value, 0);
  if (total === 0) return null;
  const r = (size - thickness) / 2;
  const c = size / 2;
  const circumference = 2 * Math.PI * r;

  let offset = 0;
  const arcs = segments.map((seg) => {
    const pct = seg.value / total;
    const dash = pct * circumference;
    const gap = circumference - dash;
    const rotation = offset * 360 - 90;
    offset += pct;
    return { ...seg, dash, gap, rotation, pct };
  });

  return (
    <div className="gd-donut-wrap">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle
          cx={c} cy={c} r={r} fill="none"
          stroke="var(--bg-inset)" strokeWidth={thickness}
        />
        {arcs.map((arc) => (
          <circle
            key={arc.label} cx={c} cy={c} r={r} fill="none"
            stroke={arc.color} strokeWidth={thickness}
            strokeDasharray={`${arc.dash} ${arc.gap}`}
            strokeLinecap="butt"
            transform={`rotate(${arc.rotation} ${c} ${c})`}
            className="gd-donut-arc"
          />
        ))}
      </svg>
      <div className="gd-donut-center">
        <span className="gd-donut-total tabular-nums">
          {total >= 1000 ? `${(total / 1000).toFixed(1)}t` : `${Math.round(total)}kg`}
        </span>
        <span className="gd-donut-label">CO₂e total</span>
      </div>
    </div>
  );
}

/* ── Main dashboard ── */
export function GreenDashboard({ stats: s }: { stats: ProofStats }) {
  const verified = s.chainIntegrity.valid;
  const tonnes = s.totalCo2eKg / 1000;

  const donutSegments = s.categoryBreakdown.slice(0, 7).map((c) => ({
    label: CAT_LABELS[c.category] ?? c.category,
    value: c.co2eKg,
    color: CAT_COLORS[c.category] ?? "#898989",
  }));

  const maxCat = Math.max(...s.categoryBreakdown.map((c) => c.co2eKg), 1);
  const maxMonth = Math.max(...s.closedMonths.map((m) => m.co2eKg), 1);

  return (
    <div className="gd">
      {/* ── Hero (full viewport) ── */}
      <section className="gd-hero">
        <div className="gd-hero-glow" />

        <div className="gd-hero-badge">
          <ShieldCheck className="h-3.5 w-3.5" />
          <span>{verified ? "Verified" : "Unverified"}</span>
        </div>

        <div className="gd-hero-org">{s.org.name}</div>
        <div className="gd-hero-title">Green Impact Report</div>

        {/* Animated ring */}
        <div className="gd-ring-wrap">
          <svg width="240" height="240" viewBox="0 0 240 240">
            <circle
              cx="120" cy="120" r="108" fill="none"
              stroke="var(--border-faint)" strokeWidth="8"
            />
            <circle
              cx="120" cy="120" r="108" fill="none"
              stroke="var(--brand-green)" strokeWidth="8"
              strokeLinecap="round"
              strokeDasharray={`${2 * Math.PI * 108}`}
              strokeDashoffset={`${2 * Math.PI * 108 * 0.22}`}
              transform="rotate(-90 120 120)"
              className="gd-ring-arc"
            />
          </svg>
          <div className="gd-ring-center">
            <Leaf className="h-7 w-7 mb-1" style={{ color: "var(--brand-green)" }} />
            <div className="gd-ring-value tabular-nums">
              <Counter
                to={tonnes >= 1 ? tonnes : s.totalCo2eKg}
                decimals={tonnes >= 1 ? 1 : 0}
                suffix={tonnes >= 1 ? "t" : "kg"}
              />
            </div>
            <div className="gd-ring-label">CO₂e tracked</div>
          </div>
        </div>

        <div className="gd-hero-meta">
          {s.monthsTracked} month{s.monthsTracked !== 1 ? "s" : ""} · {s.totalTxCount} transactions
        </div>

        <div className="gd-scroll-hint">
          <ChevronDown className="h-5 w-5" />
        </div>
      </section>

      {/* ── KPI cards ── */}
      <section className="gd-section">
        <Reveal>
          <div className="gd-kpi-grid">
            <div className="gd-kpi-card gd-kpi-card--accent">
              <Banknote className="h-5 w-5" style={{ color: "var(--brand-green)" }} />
              <div className="gd-kpi-val" style={{ color: "var(--brand-green)" }}>
                <Counter to={s.savings.totalPotentialEur} prefix="€" decimals={0} />
              </div>
              <div className="gd-kpi-sub">Savings identified</div>
            </div>
            <div className="gd-kpi-card">
              <Wallet className="h-5 w-5" style={{ color: "var(--fg-muted)" }} />
              <div className="gd-kpi-val">
                <Counter to={s.totalReserveEur} prefix="€" decimals={0} />
              </div>
              <div className="gd-kpi-sub">Carbon reserve</div>
            </div>
            {s.totalCreditsTonnes > 0 && (
              <div className="gd-kpi-card">
                <Leaf className="h-5 w-5" style={{ color: "var(--brand-green)" }} />
                <div className="gd-kpi-val" style={{ color: "var(--brand-green)" }}>
                  <Counter to={s.totalCreditsTonnes} decimals={1} suffix="t" />
                </div>
                <div className="gd-kpi-sub">Offset via credits</div>
              </div>
            )}
          </div>
        </Reveal>

        {s.savings.annualProjection > 0 && (
          <Reveal delay={200}>
            <div className="gd-projection">
              <ArrowRight className="h-4 w-4" style={{ color: "var(--brand-green)" }} />
              <span>
                Projected annual savings:{" "}
                <span style={{ color: "var(--brand-green)" }}>
                  {fmtCompact(s.savings.annualProjection)}
                </span>
              </span>
            </div>
          </Reveal>
        )}
      </section>

      {/* ── Equivalencies ── */}
      <section className="gd-section">
        <Reveal><div className="gd-eyebrow">That&apos;s equivalent to</div></Reveal>
        <div className="gd-equiv-grid">
          {[
            { icon: TreePine, val: s.treesEquivalent, unit: "trees", sub: "absorbing CO₂ for a year", color: "var(--brand-green)", bg: "rgba(62,207,142,0.06)", border: "rgba(62,207,142,0.15)" },
            { icon: Plane, val: s.flightsEquivalent, unit: "flights", sub: "Amsterdam → New York", color: "#5fb9ff", bg: "rgba(95,185,255,0.06)", border: "rgba(95,185,255,0.15)" },
            { icon: Car, val: s.kmDrivenEquivalent, unit: "km driven", sub: "by an average car", color: "#f7b955", bg: "rgba(247,185,85,0.06)", border: "rgba(247,185,85,0.15)" },
          ].map((eq, i) => (
            <Reveal key={eq.unit} delay={i * 120}>
              <div className="gd-equiv-card">
                <div className="gd-equiv-icon" style={{ background: eq.bg, borderColor: eq.border }}>
                  <eq.icon className="h-5 w-5" style={{ color: eq.color }} />
                </div>
                <div className="gd-equiv-val tabular-nums">
                  <Counter to={eq.val} />
                </div>
                <div className="gd-equiv-unit">{eq.unit}</div>
                <div className="gd-equiv-sub">{eq.sub}</div>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* ── Category donut + legend ── */}
      <section className="gd-section">
        <Reveal><div className="gd-eyebrow">Where your emissions come from</div></Reveal>
        <Reveal delay={100}>
          <div className="gd-cat-split">
            <Donut segments={donutSegments} size={180} thickness={22} />
            <div className="gd-cat-legend">
              {s.categoryBreakdown.slice(0, 6).map((cat) => {
                const pct = s.totalCo2eKg > 0 ? (cat.co2eKg / s.totalCo2eKg) * 100 : 0;
                return (
                  <div key={cat.category} className="gd-cat-row">
                    <span className="gd-cat-dot" style={{ background: CAT_COLORS[cat.category] ?? "#898989" }} />
                    <span className="gd-cat-name">
                      {CAT_LABELS[cat.category] ?? cat.category.replace(/_/g, " ")}
                    </span>
                    <span className="gd-cat-pct tabular-nums">{pct.toFixed(0)}%</span>
                  </div>
                );
              })}
            </div>
          </div>
        </Reveal>

        {/* Horizontal bars */}
        <Reveal delay={200}>
          <div className="gd-bars">
            {s.categoryBreakdown.slice(0, 6).map((cat) => {
              const pct = (cat.co2eKg / maxCat) * 100;
              const color = CAT_COLORS[cat.category] ?? "#898989";
              return (
                <div key={cat.category} className="gd-bar-row">
                  <div className="gd-bar-label">
                    {CAT_LABELS[cat.category] ?? cat.category.replace(/_/g, " ")}
                  </div>
                  <div className="gd-bar-track">
                    <div className="gd-bar-fill" style={{ width: `${pct}%`, background: color }} />
                  </div>
                  <div className="gd-bar-val tabular-nums">{fmtKgShort(cat.co2eKg)}</div>
                </div>
              );
            })}
          </div>
        </Reveal>
      </section>

      {/* ── How you save ── */}
      {s.savings.topSchemes.length > 0 && (
        <section className="gd-section">
          <Reveal><div className="gd-eyebrow">How you save money</div></Reveal>
          <Reveal delay={100}>
            <div className="gd-schemes">
              {s.savings.topSchemes.map((scheme) => (
                <div key={scheme.name} className="gd-scheme">
                  <span className="gd-scheme-name">{scheme.name}</span>
                  <span className="gd-scheme-val tabular-nums">{fmtCompact(scheme.totalEur)}</span>
                </div>
              ))}
            </div>
          </Reveal>
        </section>
      )}

      {/* ── Monthly trend ── */}
      {s.closedMonths.length > 0 && (
        <section className="gd-section">
          <Reveal><div className="gd-eyebrow">Monthly emissions</div></Reveal>
          <Reveal delay={100}>
            <div className="gd-trend">
              {s.closedMonths.map((m) => {
                const h = (m.co2eKg / maxMonth) * 100;
                return (
                  <div key={m.month} className="gd-trend-col">
                    <span className="gd-trend-val tabular-nums">{fmtKgShort(m.co2eKg)}</span>
                    <div className="gd-trend-bar-wrap">
                      <div className="gd-trend-bar" style={{ height: `${h}%` }} />
                    </div>
                    <span className="gd-trend-label tabular-nums">{m.month.slice(5)}</span>
                  </div>
                );
              })}
            </div>
          </Reveal>
        </section>
      )}

      {/* ── bunq subaccounts ── */}
      <section className="gd-section">
        <Reveal><div className="gd-eyebrow">bunq subaccounts</div></Reveal>
        <Reveal delay={100}>
          <div className="gd-accounts">
            <div className="gd-account">
              <div className="gd-account-dot" style={{ background: "var(--brand-green)" }} />
              <div className="gd-account-name">Carbon Reserve</div>
              <div className="gd-account-val tabular-nums">
                <Counter to={s.totalReserveEur} prefix="€" decimals={0} />
              </div>
              <div className="gd-account-sub">
                Auto-transferred from your main bunq account after each monthly carbon close
              </div>
            </div>
            {s.totalCreditsTonnes > 0 && (
              <div className="gd-account">
                <div className="gd-account-dot" style={{ background: "var(--status-info)" }} />
                <div className="gd-account-name">Carbon Credits</div>
                <div className="gd-account-val tabular-nums" style={{ color: "var(--brand-green)" }}>
                  <Counter to={s.totalCreditsTonnes} decimals={2} suffix="t" />
                </div>
                <div className="gd-account-sub">
                  {fmtCompact(s.totalCreditsEur)} invested in verified EU carbon offset projects
                </div>
              </div>
            )}
          </div>
        </Reveal>
      </section>

      {/* ── Verification ── */}
      <section className="gd-section gd-verify-section">
        <Reveal>
          <div className="gd-verify">
            <div className="gd-verify-shield">
              <ShieldCheck className="h-5 w-5" style={{ color: verified ? "var(--brand-green)" : "var(--status-danger)" }} />
            </div>
            <div className="gd-verify-body">
              <div className="gd-verify-title">Cryptographically verified</div>
              <div className="gd-verify-meta">
                {s.chainIntegrity.eventCount} events · SHA-256 chain {verified ? "intact" : "broken"}
              </div>
            </div>
            <div
              className="gd-verify-pill tabular-nums"
              style={{
                color: verified ? "var(--brand-green)" : "var(--status-danger)",
                borderColor: verified ? "var(--brand-green-border)" : "rgba(229,72,77,0.30)",
              }}
            >
              {verified ? "Intact" : "Broken"}
            </div>
          </div>
          <div className="gd-hash tabular-nums">{s.latestHash}</div>
        </Reveal>
      </section>

      {/* ── Footer ── */}
      <footer className="gd-footer">
        <Leaf className="h-3.5 w-3.5" style={{ color: "var(--brand-green)" }} />
        <span>Carbo for bunq Business</span>
      </footer>
    </div>
  );
}
