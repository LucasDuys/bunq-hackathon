"use client";

import { Card, CardBody, CardHeader, CardTitle, Badge } from "@/components/ui";

type CategoryBenchmark = {
  category: string;
  label: string;
  intensity: number;
  benchmarkAvg: number;
  benchmarkTopQuartile: number;
  vsAvgPct: number;
};

export function BenchmarkChart({
  categories,
}: {
  categories: CategoryBenchmark[];
}) {
  const sorted = [...categories].sort((a, b) => b.vsAvgPct - a.vsAvgPct);
  const maxIntensity = Math.max(
    ...sorted.map((c) => Math.max(c.intensity, c.benchmarkAvg, c.benchmarkTopQuartile)),
    0.01,
  );

  return (
    <Card>
      <CardHeader className="flex items-center justify-between">
        <CardTitle>Your intensity vs. industry average</CardTitle>
        <Badge tone="info">kg CO₂e per EUR</Badge>
      </CardHeader>
      <CardBody className="space-y-4">
        <div className="flex items-center gap-4 text-[11px] font-medium mb-2">
          <div className="flex items-center gap-1.5">
            <span
              className="inline-block w-3 h-3 rounded-sm"
              style={{ background: "var(--green-bright)" }}
            />
            <span style={{ color: "var(--text-mute)" }}>You</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span
              className="inline-block w-3 h-3 rounded-sm"
              style={{ background: "var(--text-faint)" }}
            />
            <span style={{ color: "var(--text-mute)" }}>Industry avg</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span
              className="inline-block w-3 h-3 rounded-sm"
              style={{
                background: "transparent",
                border: "1.5px dashed var(--text-mute)",
              }}
            />
            <span style={{ color: "var(--text-mute)" }}>Top 25%</span>
          </div>
        </div>

        {sorted.map((cat) => {
          const yourWidth = (cat.intensity / maxIntensity) * 100;
          const avgWidth = (cat.benchmarkAvg / maxIntensity) * 100;
          const topWidth = (cat.benchmarkTopQuartile / maxIntensity) * 100;
          const isAbove = cat.vsAvgPct > 5;
          const isBelow = cat.vsAvgPct < -5;

          return (
            <div key={cat.category}>
              <div className="flex items-center justify-between mb-1.5">
                <span
                  className="text-[13px] font-medium"
                  style={{ color: "var(--text-dim)" }}
                >
                  {cat.label}
                </span>
                <span
                  className="text-[11px] font-semibold tabular-nums"
                  style={{
                    color: isAbove
                      ? "var(--red)"
                      : isBelow
                        ? "var(--green-bright)"
                        : "var(--text-mute)",
                  }}
                >
                  {isAbove ? "+" : ""}
                  {cat.vsAvgPct.toFixed(0)}%
                </span>
              </div>

              <div className="space-y-1">
                {/* Your intensity */}
                <div className="flex items-center gap-2">
                  <div
                    className="h-[10px] rounded-full relative overflow-hidden"
                    style={{
                      width: `${Math.max(yourWidth, 2)}%`,
                      background: isAbove
                        ? "linear-gradient(90deg, var(--amber), var(--red))"
                        : "linear-gradient(90deg, var(--green), var(--green-bright))",
                      transition: "width 500ms ease-out",
                    }}
                  />
                  <span
                    className="text-[10px] tabular-nums font-medium shrink-0"
                    style={{ color: "var(--text-mute)" }}
                  >
                    {cat.intensity.toFixed(3)}
                  </span>
                </div>

                {/* Industry avg */}
                <div className="flex items-center gap-2">
                  <div
                    className="h-[6px] rounded-full"
                    style={{
                      width: `${Math.max(avgWidth, 2)}%`,
                      background: "var(--text-faint)",
                      transition: "width 500ms ease-out",
                    }}
                  />
                  <span
                    className="text-[10px] tabular-nums shrink-0"
                    style={{ color: "var(--text-faint)" }}
                  >
                    {cat.benchmarkAvg.toFixed(3)}
                  </span>
                </div>
              </div>
            </div>
          );
        })}

        <div
          className="text-[11px] pt-2 mt-2"
          style={{
            color: "var(--text-mute)",
            borderTop: "1px solid var(--border-faint)",
          }}
        >
          Benchmarks from Exiobase 3.8.2 (2022) adjusted to 2024 price levels.
          Intensity = kg CO₂e per EUR spent.
        </div>
      </CardBody>
    </Card>
  );
}
