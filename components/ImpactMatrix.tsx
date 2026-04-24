"use client";

import { fmtEur, fmtKg } from "@/lib/utils";

type MatrixItem = {
  label: string;
  category: string;
  annualCostSavingEur: number;
  annualCo2eSavingKg: number;
  co2eReductionPct: number;
};

const QUADRANT_STYLES: Record<string, { bg: string; border: string; label: string; desc: string; color: string }> = {
  low_cost_low_carbon: {
    bg: "rgba(48,192,111,0.08)",
    border: "rgba(48,192,111,0.20)",
    label: "Quick wins",
    desc: "Saves money and cuts CO₂e",
    color: "var(--green-bright)",
  },
  high_cost_low_carbon: {
    bg: "rgba(107,155,210,0.08)",
    border: "rgba(107,155,210,0.20)",
    label: "Green investments",
    desc: "Higher cost but major CO₂e cuts",
    color: "var(--cat-fuel)",
  },
  low_cost_high_carbon: {
    bg: "rgba(217,164,65,0.08)",
    border: "rgba(217,164,65,0.20)",
    label: "Cost savers",
    desc: "Saves money, minor CO₂e impact",
    color: "var(--amber)",
  },
  high_cost_high_carbon: {
    bg: "rgba(224,111,111,0.08)",
    border: "rgba(224,111,111,0.20)",
    label: "Avoid",
    desc: "Expensive with high emissions",
    color: "var(--red)",
  },
};

function classify(item: MatrixItem, medianCost: number, medianCo2e: number): string {
  const lowCost = item.annualCostSavingEur >= medianCost;
  const lowCarbon = item.annualCo2eSavingKg >= medianCo2e;
  if (lowCost && lowCarbon) return "low_cost_low_carbon";
  if (!lowCost && lowCarbon) return "high_cost_low_carbon";
  if (lowCost && !lowCarbon) return "low_cost_high_carbon";
  return "high_cost_high_carbon";
}

export function ImpactMatrix({ items }: { items: MatrixItem[] }) {
  if (items.length === 0) return null;

  const sortedCost = [...items].sort((a, b) => a.annualCostSavingEur - b.annualCostSavingEur);
  const sortedCo2e = [...items].sort((a, b) => a.annualCo2eSavingKg - b.annualCo2eSavingKg);
  const medianCost = sortedCost[Math.floor(sortedCost.length / 2)].annualCostSavingEur;
  const medianCo2e = sortedCo2e[Math.floor(sortedCo2e.length / 2)].annualCo2eSavingKg;

  const quadrants: Record<string, MatrixItem[]> = {
    low_cost_low_carbon: [],
    high_cost_low_carbon: [],
    low_cost_high_carbon: [],
    high_cost_high_carbon: [],
  };

  for (const item of items) {
    const q = classify(item, medianCost, medianCo2e);
    quadrants[q].push(item);
  }

  const order = ["low_cost_low_carbon", "high_cost_low_carbon", "low_cost_high_carbon", "high_cost_high_carbon"];

  return (
    <div className="grid grid-cols-2 gap-3">
      {order.map((key) => {
        const style = QUADRANT_STYLES[key];
        const qItems = quadrants[key];
        return (
          <div
            key={key}
            className="rounded-xl p-4 min-h-[140px] flex flex-col"
            style={{
              background: style.bg,
              border: `1px solid ${style.border}`,
            }}
          >
            <div className="flex items-center gap-2 mb-2">
              <span
                className="w-2 h-2 rounded-full shrink-0"
                style={{ background: style.color }}
              />
              <span
                className="text-[12px] font-semibold uppercase tracking-[0.5px]"
                style={{ color: style.color }}
              >
                {style.label}
              </span>
            </div>
            <div
              className="text-[10.5px] mb-3"
              style={{ color: "var(--text-mute)" }}
            >
              {style.desc}
            </div>
            <div className="flex-1 space-y-1.5">
              {qItems.length === 0 && (
                <div
                  className="text-[11px] italic"
                  style={{ color: "var(--text-faint)" }}
                >
                  No items
                </div>
              )}
              {qItems.map((item) => (
                <div
                  key={item.label}
                  className="flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg"
                  style={{
                    background: "rgba(0,0,0,0.15)",
                    border: "1px solid rgba(255,255,255,0.03)",
                  }}
                >
                  <span
                    className="text-[12px] font-medium truncate"
                    style={{ color: "var(--text-dim)" }}
                  >
                    {item.label}
                  </span>
                  <div className="flex items-center gap-2 shrink-0">
                    <span
                      className="text-[11px] tabular-nums font-semibold"
                      style={{ color: "var(--green-bright)" }}
                    >
                      {fmtKg(item.annualCo2eSavingKg)}
                    </span>
                    <span
                      className="text-[11px] tabular-nums"
                      style={{ color: "var(--text-mute)" }}
                    >
                      {fmtEur(item.annualCostSavingEur, 0)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
