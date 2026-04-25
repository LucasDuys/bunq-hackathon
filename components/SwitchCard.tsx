"use client";

import { ArrowRight } from "lucide-react";
import { fmtEur, fmtKg } from "@/lib/utils";

type SwitchData = {
  switchLabel: string;
  co2eReductionPct: number;
  annualCostSavingEur: number;
  annualCo2eSavingKg: number;
  fromFactorId: string;
  toFactorId: string;
};

export function SwitchCard({
  sw,
  rank,
}: {
  sw: SwitchData;
  rank: number;
}) {
  const [fromLabel, toLabel] = sw.switchLabel.split("→").map((s) => s.trim());
  const barMax = 100;
  const afterWidth = Math.max(barMax - sw.co2eReductionPct, 3);

  return (
    <div
      className="p-4 rounded-xl"
      style={{
        background: "var(--bg-card-2)",
        border: "1px solid var(--border-faint)",
      }}
    >
      <div className="flex items-start gap-3 mb-3">
        <div
          className="w-7 h-7 rounded-lg grid place-items-center text-xs font-medium shrink-0 mt-0.5"
          style={{
            background: "var(--brand-green-soft, rgba(62,207,142,0.10))",
            color: "var(--green-bright)",
            border: "1px solid var(--brand-green-border)",
          }}
        >
          {rank}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span
              className="text-[13px] font-medium"
              style={{ color: "var(--text-dim)" }}
            >
              {fromLabel}
            </span>
            <ArrowRight
              className="h-3 w-3 shrink-0"
              style={{ color: "var(--green)" }}
            />
            <span
              className="text-[13px] font-medium"
              style={{ color: "var(--green-bright)" }}
            >
              {toLabel}
            </span>
          </div>
        </div>
        <div className="text-right shrink-0">
          <div
            className="text-lg font-medium tabular-nums"
            style={{ color: "var(--green-bright)" }}
          >
            −{sw.co2eReductionPct}%
          </div>
        </div>
      </div>

      {/* Before/after bars */}
      <div className="space-y-1.5 mb-3">
        <div className="flex items-center gap-2">
          <span
            className="text-[10px] uppercase tracking-wide w-10 shrink-0"
            style={{ color: "var(--text-faint)" }}
          >
            Now
          </span>
          <div
            className="h-[8px] rounded-full"
            style={{
              width: `${barMax}%`,
              background: "linear-gradient(90deg, var(--amber), var(--red))",
              opacity: 0.6,
            }}
          />
        </div>
        <div className="flex items-center gap-2">
          <span
            className="text-[10px] uppercase tracking-wide w-10 shrink-0"
            style={{ color: "var(--text-faint)" }}
          >
            After
          </span>
          <div
            className="h-[8px] rounded-full"
            style={{
              width: `${afterWidth}%`,
              background: "linear-gradient(90deg, var(--green), var(--green-bright))",
              transition: "width 600ms ease-out",
            }}
          />
        </div>
      </div>

      {/* Stats row */}
      <div
        className="flex items-center gap-4 pt-2.5"
        style={{ borderTop: "1px solid var(--border-faint)" }}
      >
        <div>
          <div
            className="text-[10px] uppercase tracking-wide mb-0.5"
            style={{ color: "var(--text-faint)" }}
          >
            CO₂e avoided
          </div>
          <div
            className="text-sm font-medium tabular-nums"
            style={{ color: "var(--green-bright)" }}
          >
            {fmtKg(sw.annualCo2eSavingKg)}/yr
          </div>
        </div>
        <div
          className="w-px h-7"
          style={{ background: "var(--border-faint)" }}
        />
        <div>
          <div
            className="text-[10px] uppercase tracking-wide mb-0.5"
            style={{ color: "var(--text-faint)" }}
          >
            Cost saved
          </div>
          <div
            className="text-sm font-medium tabular-nums"
            style={{ color: sw.annualCostSavingEur > 0 ? "var(--green-bright)" : "var(--text-dim)" }}
          >
            {sw.annualCostSavingEur > 0 ? fmtEur(sw.annualCostSavingEur, 0) : "€ 0"}/yr
          </div>
        </div>
      </div>
    </div>
  );
}
