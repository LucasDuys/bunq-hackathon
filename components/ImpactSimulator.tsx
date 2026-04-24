"use client";

import { useState, useMemo } from "react";
import { ArrowRight, ToggleLeft, ToggleRight } from "lucide-react";
import { Card, CardBody, CardHeader, CardTitle, Badge } from "@/components/ui";
import { fmtEur, fmtKg } from "@/lib/utils";

type Switch = {
  switchLabel: string;
  co2eReductionPct: number;
  annualCostSavingEur: number;
  annualCo2eSavingKg: number;
  fromFactorId: string;
  toFactorId: string;
};

type CategoryData = {
  category: string;
  label: string;
  spendEur: number;
  co2eKg: number;
  intensity: number;
  switchOpportunities: Switch[];
};

export function ImpactSimulator({
  categories,
  totalCo2eKg,
  totalSpendEur,
}: {
  categories: CategoryData[];
  totalCo2eKg: number;
  totalSpendEur: number;
}) {
  const allSwitches = useMemo(
    () => categories.flatMap((c) => c.switchOpportunities),
    [categories],
  );

  const [enabled, setEnabled] = useState<Set<string>>(new Set());

  const toggle = (fromFactorId: string) => {
    setEnabled((prev) => {
      const next = new Set(prev);
      if (next.has(fromFactorId)) next.delete(fromFactorId);
      else next.add(fromFactorId);
      return next;
    });
  };

  const enableAll = () =>
    setEnabled(new Set(allSwitches.map((s) => s.fromFactorId)));

  const disableAll = () => setEnabled(new Set());

  const projectedSavings = useMemo(() => {
    let costSaving = 0;
    let co2eSaving = 0;
    for (const sw of allSwitches) {
      if (enabled.has(sw.fromFactorId)) {
        costSaving += sw.annualCostSavingEur;
        co2eSaving += sw.annualCo2eSavingKg;
      }
    }
    return { costSaving, co2eSaving };
  }, [allSwitches, enabled]);

  const projectedCo2e = totalCo2eKg * 12 - projectedSavings.co2eSaving;
  const reductionPct =
    totalCo2eKg * 12 > 0
      ? (projectedSavings.co2eSaving / (totalCo2eKg * 12)) * 100
      : 0;

  if (allSwitches.length === 0) return null;

  return (
    <Card>
      <CardHeader className="flex items-center justify-between">
        <CardTitle>What if — spending simulator</CardTitle>
        <div className="flex items-center gap-2">
          <button
            onClick={disableAll}
            className="text-[11px] font-medium px-2.5 py-1 rounded-full transition-colors"
            style={{
              color: "var(--text-mute)",
              background: "var(--bg-inset)",
              border: "1px solid var(--border)",
            }}
          >
            Reset
          </button>
          <button
            onClick={enableAll}
            className="text-[11px] font-medium px-2.5 py-1 rounded-full transition-colors"
            style={{
              color: "var(--green-bright)",
              background: "rgba(48,192,111,0.08)",
              border: "1px solid rgba(48,192,111,0.20)",
            }}
          >
            Enable all
          </button>
        </div>
      </CardHeader>
      <CardBody className="space-y-5">
        {/* Projected totals */}
        <div
          className="grid grid-cols-1 sm:grid-cols-3 gap-4 p-4 rounded-xl"
          style={{
            background: enabled.size > 0 ? "rgba(48,192,111,0.06)" : "var(--bg-inset)",
            border: `1px solid ${enabled.size > 0 ? "rgba(48,192,111,0.15)" : "var(--border-faint)"}`,
            transition: "background 300ms ease, border-color 300ms ease",
          }}
        >
          <div>
            <div
              className="text-[10.5px] uppercase tracking-[0.6px] font-semibold mb-1"
              style={{ color: "var(--text-mute)" }}
            >
              Projected annual CO₂e
            </div>
            <div
              className="text-xl font-semibold tabular-nums"
              style={{
                color: enabled.size > 0 ? "var(--green-bright)" : "var(--text)",
                transition: "color 300ms ease",
              }}
            >
              {fmtKg(Math.max(0, projectedCo2e))}
            </div>
            {enabled.size > 0 && (
              <div
                className="text-xs tabular-nums mt-0.5"
                style={{ color: "var(--green)" }}
              >
                −{reductionPct.toFixed(1)}% reduction
              </div>
            )}
          </div>
          <div>
            <div
              className="text-[10.5px] uppercase tracking-[0.6px] font-semibold mb-1"
              style={{ color: "var(--text-mute)" }}
            >
              Annual cost savings
            </div>
            <div
              className="text-xl font-semibold tabular-nums"
              style={{
                color: enabled.size > 0 ? "var(--green-bright)" : "var(--text-dim)",
                transition: "color 300ms ease",
              }}
            >
              {enabled.size > 0
                ? fmtEur(projectedSavings.costSaving, 0)
                : "€ 0"}
            </div>
          </div>
          <div>
            <div
              className="text-[10.5px] uppercase tracking-[0.6px] font-semibold mb-1"
              style={{ color: "var(--text-mute)" }}
            >
              CO₂e avoided per year
            </div>
            <div
              className="text-xl font-semibold tabular-nums"
              style={{
                color: enabled.size > 0 ? "var(--green-bright)" : "var(--text-dim)",
                transition: "color 300ms ease",
              }}
            >
              {enabled.size > 0
                ? fmtKg(projectedSavings.co2eSaving)
                : "0 kgCO₂e"}
            </div>
          </div>
        </div>

        {/* Switch toggles */}
        <div className="space-y-2">
          {allSwitches.map((sw) => {
            const on = enabled.has(sw.fromFactorId);
            return (
              <button
                key={sw.fromFactorId}
                onClick={() => toggle(sw.fromFactorId)}
                className="w-full flex items-center gap-3 p-3 rounded-xl text-left transition-all duration-150"
                style={{
                  background: on ? "rgba(48,192,111,0.06)" : "var(--bg-card-2)",
                  border: `1px solid ${on ? "rgba(48,192,111,0.20)" : "var(--border-faint)"}`,
                }}
              >
                {on ? (
                  <ToggleRight
                    className="h-5 w-5 shrink-0"
                    style={{ color: "var(--green-bright)" }}
                  />
                ) : (
                  <ToggleLeft
                    className="h-5 w-5 shrink-0"
                    style={{ color: "var(--text-mute)" }}
                  />
                )}
                <div className="flex-1 min-w-0">
                  <div
                    className="text-sm font-medium truncate"
                    style={{ color: on ? "var(--text)" : "var(--text-dim)" }}
                  >
                    {sw.switchLabel}
                  </div>
                  <div
                    className="text-xs tabular-nums mt-0.5"
                    style={{ color: "var(--text-mute)" }}
                  >
                    {sw.co2eReductionPct}% less CO₂e
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <div
                    className="text-sm font-semibold tabular-nums"
                    style={{ color: on ? "var(--green-bright)" : "var(--text-dim)" }}
                  >
                    {fmtEur(sw.annualCostSavingEur, 0)}
                  </div>
                  <div
                    className="text-[11px] tabular-nums"
                    style={{ color: "var(--text-mute)" }}
                  >
                    {fmtKg(sw.annualCo2eSavingKg)}/yr
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </CardBody>
    </Card>
  );
}
