"use client";

import { useState } from "react";
import { ChevronDown, BarChart3, Wallet, Zap } from "lucide-react";
import type { ProofStats } from "@/lib/audit/proof";

const CAT_COLORS: Record<string, string> = {
  fuel: "var(--cat-fuel)",
  electricity: "var(--cat-electricity)",
  goods_and_services: "var(--cat-goods)",
  travel: "var(--cat-travel)",
  digital: "var(--cat-digital)",
  services: "var(--cat-services)",
  food_and_catering: "var(--cat-food)",
  other: "var(--cat-other)",
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
  return `€${n.toFixed(0)}`;
}

function fmtKgShort(kg: number): string {
  if (kg >= 1000) return `${(kg / 1000).toFixed(1)}t`;
  return `${kg.toFixed(0)}kg`;
}

export function ProofDetail({ stats }: { stats: ProofStats }) {
  const [expanded, setExpanded] = useState(false);

  const maxCo2e = Math.max(...stats.categoryBreakdown.map((c) => c.co2eKg), 1);

  return (
    <div className="w-full flex flex-col items-center gap-0 mt-6">
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="proof-detail-toggle"
      >
        <BarChart3
          className="h-4 w-4"
          style={{ color: "var(--brand-green)" }}
        />
        <span>{expanded ? "Hide breakdown" : "View full breakdown"}</span>
        <ChevronDown
          className="h-4 w-4 proof-detail-chevron"
          style={{
            transform: expanded ? "rotate(180deg)" : "rotate(0deg)",
          }}
        />
      </button>

      <div
        className="proof-detail-panel"
        style={{
          maxHeight: expanded ? "2000px" : "0px",
          opacity: expanded ? 1 : 0,
        }}
      >
        <div className="proof-detail-inner">
          {/* ── Overview KPI row ── */}
          <div className="flex gap-3 w-full">
            <div className="proof-detail-kpi flex-1">
              <div className="proof-detail-kpi-icon">
                <Zap className="h-4 w-4" style={{ color: "var(--brand-green)" }} />
              </div>
              <div className="flex flex-col">
                <span className="proof-detail-kpi-value tabular-nums">
                  {stats.totalTxCount}
                </span>
                <span className="proof-detail-kpi-label">Transactions</span>
              </div>
            </div>
            <div className="proof-detail-kpi flex-1">
              <div className="proof-detail-kpi-icon">
                <Wallet className="h-4 w-4" style={{ color: "var(--status-info)" }} />
              </div>
              <div className="flex flex-col">
                <span className="proof-detail-kpi-value tabular-nums">
                  {fmtCompact(stats.totalSpendEur)}
                </span>
                <span className="proof-detail-kpi-label">Total spend</span>
              </div>
            </div>
          </div>

          {/* ── Category breakdown bars ── */}
          <div className="w-full mt-6">
            <span
              className="text-[12px] uppercase tracking-[1.2px] block mb-4"
              style={{
                color: "var(--fg-muted)",
                fontFamily: "var(--font-source-code-pro, monospace)",
              }}
            >
              Emissions by category
            </span>
            <div className="flex flex-col gap-3">
              {stats.categoryBreakdown.slice(0, 6).map((cat) => {
                const pct = (cat.co2eKg / maxCo2e) * 100;
                const color =
                  CAT_COLORS[cat.category] ?? "var(--cat-other)";
                const label =
                  CAT_LABELS[cat.category] ?? cat.category.replace(/_/g, " ");
                return (
                  <div key={cat.category} className="flex flex-col gap-1.5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span
                          className="w-[6px] h-[6px] rounded-full shrink-0"
                          style={{ background: color }}
                        />
                        <span
                          className="text-[13px] capitalize"
                          style={{ color: "var(--fg-secondary)" }}
                        >
                          {label}
                        </span>
                      </div>
                      <span
                        className="text-[13px] tabular-nums"
                        style={{ color: "var(--fg-primary)" }}
                      >
                        {fmtKgShort(cat.co2eKg)}
                      </span>
                    </div>
                    <div
                      className="h-[6px] w-full rounded-full overflow-hidden"
                      style={{ background: "var(--bg-inset)" }}
                    >
                      <div
                        className="h-full rounded-full proof-detail-bar"
                        style={{
                          width: `${pct}%`,
                          background: color,
                        }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* ── Monthly trend ── */}
          {stats.closedMonths.length > 1 && (
            <div className="w-full mt-8">
              <span
                className="text-[12px] uppercase tracking-[1.2px] block mb-4"
                style={{
                  color: "var(--fg-muted)",
                  fontFamily: "var(--font-source-code-pro, monospace)",
                }}
              >
                Monthly trend
              </span>
              <div className="flex items-end gap-3 h-[100px]">
                {stats.closedMonths.map((m) => {
                  const maxMonth = Math.max(
                    ...stats.closedMonths.map((x) => x.co2eKg),
                    1,
                  );
                  const barH = (m.co2eKg / maxMonth) * 100;
                  return (
                    <div
                      key={m.month}
                      className="flex-1 flex flex-col items-center gap-2"
                    >
                      <span
                        className="text-[11px] tabular-nums"
                        style={{ color: "var(--fg-muted)" }}
                      >
                        {fmtKgShort(m.co2eKg)}
                      </span>
                      <div
                        className="w-full rounded-t-[4px] proof-detail-bar"
                        style={{
                          height: `${barH}%`,
                          background: "var(--brand-green)",
                          minHeight: 4,
                        }}
                      />
                      <span
                        className="text-[10px] tabular-nums"
                        style={{
                          color: "var(--fg-faint)",
                          fontFamily:
                            "var(--font-source-code-pro, monospace)",
                        }}
                      >
                        {m.month.slice(5)}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ── Reserve allocation ── */}
          {stats.totalReserveEur > 0 && (
            <div className="w-full mt-8">
              <span
                className="text-[12px] uppercase tracking-[1.2px] block mb-3"
                style={{
                  color: "var(--fg-muted)",
                  fontFamily: "var(--font-source-code-pro, monospace)",
                }}
              >
                Financial commitment
              </span>
              <div
                className="rounded-[12px] px-5 py-4 flex flex-col gap-3"
                style={{ border: "1px solid var(--border-default)" }}
              >
                <div className="flex items-center justify-between">
                  <span
                    className="text-[13px]"
                    style={{ color: "var(--fg-secondary)" }}
                  >
                    Carbon reserve set aside
                  </span>
                  <span
                    className="text-[15px] tabular-nums"
                    style={{ color: "var(--fg-primary)" }}
                  >
                    {fmtCompact(stats.totalReserveEur)}
                  </span>
                </div>
                {stats.totalCreditsEur > 0 && (
                  <div className="flex items-center justify-between">
                    <span
                      className="text-[13px]"
                      style={{ color: "var(--fg-secondary)" }}
                    >
                      Spent on carbon credits
                    </span>
                    <span
                      className="text-[15px] tabular-nums"
                      style={{ color: "var(--brand-green)" }}
                    >
                      {fmtCompact(stats.totalCreditsEur)}
                    </span>
                  </div>
                )}
                {stats.totalSpendEur > 0 && (
                  <div className="flex items-center justify-between">
                    <span
                      className="text-[13px]"
                      style={{ color: "var(--fg-secondary)" }}
                    >
                      Carbon cost ratio
                    </span>
                    <span
                      className="text-[15px] tabular-nums"
                      style={{ color: "var(--fg-primary)" }}
                    >
                      {((stats.totalReserveEur / stats.totalSpendEur) * 100).toFixed(1)}%
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
