import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export const cn = (...inputs: ClassValue[]) => twMerge(clsx(inputs));

export const fmtEur = (eur: number, decimals = 2) =>
  eur.toLocaleString("en-NL", { style: "currency", currency: "EUR", maximumFractionDigits: decimals });

export const fmtKg = (kg: number) => {
  if (kg >= 1000) return `${(kg / 1000).toFixed(2)} tCO₂e`;
  return `${kg.toFixed(1)} kgCO₂e`;
};

export const fmtPct = (p: number, decimals = 0) => `${(p * 100).toFixed(decimals)}%`;

export const monthKey = (d: Date) => `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;

// The three multiplicative signals composing a confidence score (factor uncertainty,
// classifier confidence, tier weight) are positively correlated, so their geometric
// mean is a tighter single-number estimator than their product. cbrt(product) is that
// mean with the [0,1] endpoints and monotonic ordering preserved.
export const displayConfidence = (raw: number): number => {
  if (!Number.isFinite(raw) || raw <= 0) return 0;
  if (raw >= 1) return 1;
  return Math.cbrt(raw);
};
