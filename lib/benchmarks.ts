/**
 * Industry benchmarks for Dutch/EU SMEs (Exiobase sector averages + CBS/KvK data).
 * Used by the impact analysis agent to compare a company's spending against peers.
 *
 * Values: kg CO₂e per EUR spent (intensity), and typical % of total spend.
 * Source: Exiobase 3.8.2 (2022), adjusted to 2024 price levels.
 */

export type Benchmark = {
  category: string;
  label: string;
  avgIntensity: number;
  topQuartileIntensity: number;
  typicalSpendPct: number;
};

export const BENCHMARKS: Benchmark[] = [
  { category: "travel",      label: "Travel & transport",     avgIntensity: 0.38, topQuartileIntensity: 0.18, typicalSpendPct: 0.08 },
  { category: "food",        label: "Food & hospitality",     avgIntensity: 0.32, topQuartileIntensity: 0.20, typicalSpendPct: 0.05 },
  { category: "procurement", label: "Procurement",            avgIntensity: 0.30, topQuartileIntensity: 0.15, typicalSpendPct: 0.25 },
  { category: "cloud",       label: "Cloud & IT",             avgIntensity: 0.09, topQuartileIntensity: 0.05, typicalSpendPct: 0.12 },
  { category: "services",    label: "Professional services",  avgIntensity: 0.10, topQuartileIntensity: 0.06, typicalSpendPct: 0.20 },
  { category: "utilities",   label: "Utilities",              avgIntensity: 1.80, topQuartileIntensity: 1.00, typicalSpendPct: 0.10 },
  { category: "fuel",        label: "Fuel",                   avgIntensity: 2.55, topQuartileIntensity: 1.20, typicalSpendPct: 0.06 },
  { category: "other",       label: "Other / uncategorised",  avgIntensity: 0.30, topQuartileIntensity: 0.15, typicalSpendPct: 0.14 },
];

export const benchmarkFor = (category: string): Benchmark | undefined =>
  BENCHMARKS.find((b) => b.category === category);
