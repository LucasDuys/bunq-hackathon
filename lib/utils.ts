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
