import "dotenv/config";
import { appendAudit } from "@/lib/audit/append";
import { CREDIT_PROJECTS } from "@/lib/credits/projects";
import { db, creditProjects, emissionFactors, orgs, policies, transactions } from "@/lib/db/client";
import { FACTORS } from "@/lib/factors";
import { DEFAULT_POLICY } from "@/lib/policy/schema";
import { classifyMerchant } from "@/lib/classify/merchant";
import { normalizeMerchant } from "@/lib/classify/rules";
import { env } from "@/lib/env";

/**
 * Realistic 12-month seed for Acme BV (50-person Dutch software SME).
 * Spec: research/14-realistic-seed-data.md.
 *
 * Deterministic: same --seed flag yields the same dataset.
 *
 * Usage:
 *   npm run seed:realistic
 *   npm run seed:realistic -- --months=12 --seed=42
 *   npm run seed:realistic -- --months=6 --seed=99
 */

// ---------- CLI ----------
const args = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const [k, v] = a.replace(/^--/, "").split("=");
    return [k, v ?? "true"];
  }),
);
const MONTHS = Number(args.months ?? "12");
const SEED = Number(args.seed ?? "42");
const ORG_ID = "org_acme_bv";

// ---------- Deterministic RNG ----------
class RNG {
  private s: number;
  constructor(seed: number) { this.s = seed >>> 0; }
  // mulberry32
  next(): number {
    this.s = (this.s + 0x6D2B79F5) >>> 0;
    let t = this.s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  range(lo: number, hi: number): number { return lo + this.next() * (hi - lo); }
  int(lo: number, hi: number): number { return Math.floor(this.range(lo, hi + 1)); }
  pick<T>(arr: readonly T[]): T { return arr[this.int(0, arr.length - 1)]; }
  bool(p: number): boolean { return this.next() < p; }
  // Lognormal: returns value with median ~= median, sigma in log space.
  lognormal(median: number, sigma = 0.4): number {
    // Box-Muller for normal, then exp.
    const u1 = Math.max(this.next(), 1e-9);
    const u2 = this.next();
    const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
    return Math.exp(Math.log(median) + sigma * z);
  }
}
const rng = new RNG(SEED);

// ---------- Merchant catalogue ----------
type CatItem = {
  base: string;
  variants: string[];
  category: string;
  subCategory: string | null;
  median: number; // EUR
  sigma?: number;
};

// Names match the rule patterns in lib/classify/rules.ts so most route deterministically.
const TRAVEL_AIR: CatItem[] = [
  { base: "KLM Royal Dutch Airlines", variants: ["KLM Royal Dutch Airlines", "KLM 074-5612340987", "KLM ROYAL DUTCH AIRLI"], category: "travel", subCategory: "flight_shorthaul", median: 240, sigma: 0.5 },
  { base: "Transavia", variants: ["Transavia", "TRANSAVIA AIRLINES", "Transavia.com"], category: "travel", subCategory: "flight_shorthaul", median: 175, sigma: 0.4 },
  { base: "Lufthansa", variants: ["Lufthansa", "LUFTHANSA AG FRANKFURT"], category: "travel", subCategory: "flight_shorthaul", median: 220, sigma: 0.5 },
  { base: "EasyJet", variants: ["EasyJet", "EASYJET LUTON GB"], category: "travel", subCategory: "flight_shorthaul", median: 145, sigma: 0.4 },
  { base: "British Airways", variants: ["British Airways", "BRITISH AIRWAYS LON GB"], category: "travel", subCategory: "flight_shorthaul", median: 280, sigma: 0.5 },
];
const TRAVEL_RAIL: CatItem[] = [
  { base: "NS International", variants: ["NS International", "NS INTERNATIONAL UTRECHT"], category: "travel", subCategory: "train", median: 78, sigma: 0.45 },
  { base: "Deutsche Bahn", variants: ["Deutsche Bahn", "DB FERNVERKEHR FRANKFURT"], category: "travel", subCategory: "train", median: 92, sigma: 0.4 },
  { base: "NS Reizigers", variants: ["NS Reizigers", "NS BUSINESS CARD", "NS GROEP UTRECHT"], category: "travel", subCategory: "train", median: 24, sigma: 0.6 },
  { base: "Eurostar", variants: ["Eurostar", "EUROSTAR LONDON GB"], category: "travel", subCategory: "train", median: 130, sigma: 0.4 },
];
const TRAVEL_GROUND: CatItem[] = [
  { base: "Uber BV", variants: ["Uber BV", "UBER *TRIP HELP.UBER.COM", "UBER BV AMSTERDAM NL"], category: "travel", subCategory: "taxi", median: 24, sigma: 0.5 },
  { base: "Bolt Netherlands", variants: ["Bolt Netherlands", "BOLT.EU/O/", "Bolt Operations OU"], category: "travel", subCategory: "taxi", median: 18, sigma: 0.5 },
];
const TRAVEL_LODGING: CatItem[] = [
  { base: "Booking.com", variants: ["Booking.com", "Booking.com B.V.", "BOOKING.COM7654321", "BOOKING.COM AMSTERDAM"], category: "travel", subCategory: "hotel", median: 195, sigma: 0.4 },
  { base: "NH Hotels Amsterdam", variants: ["NH Hotels Amsterdam", "NH HOTEL ZUIDAS", "NH COLLECTION BARBIZON"], category: "travel", subCategory: "hotel", median: 175, sigma: 0.4 },
  { base: "citizenM", variants: ["citizenM", "CITIZENM AMSTERDAM ZUID"], category: "travel", subCategory: "hotel", median: 165, sigma: 0.35 },
];

const SAAS_COLLAB: CatItem[] = [
  { base: "Slack Technologies", variants: ["Slack Technologies", "SLACK TECHNOLOGIES SF"], category: "cloud", subCategory: "saas", median: 700, sigma: 0.1 },
  { base: "Notion Labs", variants: ["Notion Labs", "NOTION LABS INC"], category: "cloud", subCategory: "saas", median: 950, sigma: 0.15 },
  { base: "Linear", variants: ["Linear", "LINEAR ORBIT INC SF"], category: "cloud", subCategory: "saas", median: 480, sigma: 0.15 },
  { base: "Figma Inc", variants: ["Figma Inc", "FIGMA INC SAN FRANCISCO"], category: "cloud", subCategory: "saas", median: 380, sigma: 0.15 },
  { base: "Zoom Video", variants: ["Zoom Video", "ZOOM VIDEO COMM SAN JOSE"], category: "cloud", subCategory: "saas", median: 270, sigma: 0.15 },
];
const SAAS_ENG: CatItem[] = [
  { base: "GitHub", variants: ["GitHub", "GITHUB INC SAN FRANCISCO"], category: "cloud", subCategory: "saas", median: 630, sigma: 0.1 },
  { base: "Sentry", variants: ["Sentry", "FUNCTIONAL SOFTWARE SF"], category: "cloud", subCategory: "saas", median: 240, sigma: 0.2 },
  { base: "Datadog", variants: ["Datadog", "DATADOG INC NEW YORK"], category: "cloud", subCategory: "saas", median: 540, sigma: 0.3 },
  { base: "1Password", variants: ["1Password", "AGILEBITS INC TORONTO"], category: "cloud", subCategory: "saas", median: 400, sigma: 0.1 },
  { base: "Anthropic", variants: ["Anthropic", "ANTHROPIC PBC SAN FRAN"], category: "cloud", subCategory: "saas", median: 520, sigma: 0.5 },
  { base: "OpenAI", variants: ["OpenAI", "OPENAI LLC SAN FRANCISCO"], category: "cloud", subCategory: "saas", median: 380, sigma: 0.5 },
];
const SAAS_BIZ: CatItem[] = [
  { base: "HubSpot", variants: ["HubSpot", "HUBSPOT INC CAMBRIDGE"], category: "cloud", subCategory: "saas", median: 75, sigma: 0.2 },
  { base: "Stripe", variants: ["Stripe", "STRIPE TECHNOLOGY DUBLIN"], category: "services", subCategory: "professional", median: 280, sigma: 0.3 },
  { base: "Moneybird", variants: ["Moneybird", "MONEYBIRD B.V. UTRECHT"], category: "cloud", subCategory: "saas", median: 32, sigma: 0.1 },
];

const CLOUD_INFRA: CatItem[] = [
  { base: "AWS EMEA", variants: ["AWS EMEA", "AMAZON WEB SVCS LU", "AWS EMEA SARL LUXEMBOURG"], category: "cloud", subCategory: "compute_eu", median: 12000, sigma: 0.2 },
  { base: "Google Cloud EMEA", variants: ["Google Cloud EMEA", "GOOGLE CLOUD IRELAND"], category: "cloud", subCategory: "compute_eu", median: 2900, sigma: 0.3 },
  { base: "Cloudflare", variants: ["Cloudflare", "CLOUDFLARE INC SAN FRAN"], category: "cloud", subCategory: "saas", median: 180, sigma: 0.3 },
  { base: "Vercel Inc", variants: ["Vercel Inc", "VERCEL INC SAN FRANCISCO"], category: "cloud", subCategory: "saas", median: 720, sigma: 0.3 },
];

const FOOD_GROC: CatItem[] = [
  { base: "Albert Heijn", variants: ["Albert Heijn 1411", "AH 0019 AMSTERDAM", "AH to go 5402", "AH XL Schiphol", "Albert Heijn 2201", "Albert Heijn 4087"], category: "food", subCategory: "groceries", median: 68, sigma: 0.4 },
  { base: "Jumbo", variants: ["Jumbo", "JUMBO 8723 AMSTERDAM", "Jumbo Supermarkten"], category: "food", subCategory: "groceries", median: 84, sigma: 0.35 },
  { base: "Marqt", variants: ["Marqt", "MARQT B.V. AMSTERDAM"], category: "food", subCategory: "groceries", median: 92, sigma: 0.35 },
];
const FOOD_DELIV: CatItem[] = [
  { base: "Thuisbezorgd", variants: ["Thuisbezorgd", "THUISBEZORGD.NL ENSCHEDE", "Just Eat Takeaway"], category: "food", subCategory: "team_lunch", median: 280, sigma: 0.35 },
  { base: "Uber Eats", variants: ["Uber Eats", "UBER *EATS AMSTERDAM"], category: "food", subCategory: "team_lunch", median: 210, sigma: 0.35 },
];
const FOOD_DINE: CatItem[] = [
  { base: "Loetje Centraal", variants: ["Loetje Centraal", "LOETJE CENTRAAL AMSTERDAM"], category: "food", subCategory: "client_dinner", median: 380, sigma: 0.35 },
  { base: "Restaurant De Kas", variants: ["Restaurant De Kas", "DE KAS AMSTERDAM"], category: "food", subCategory: "client_dinner", median: 580, sigma: 0.3 },
  { base: "Bistrot Neuf", variants: ["Bistrot Neuf", "BISTROT NEUF AMSTERDAM"], category: "food", subCategory: "client_dinner", median: 320, sigma: 0.3 },
  { base: "Starbucks", variants: ["Starbucks Damrak", "STARBUCKS #4567 AMS", "Starbucks Schiphol"], category: "food", subCategory: "coffee", median: 12, sigma: 0.4 },
  { base: "Coffee Company", variants: ["Coffee Company", "COFFEE COMPANY ZUIDAS"], category: "food", subCategory: "coffee", median: 9, sigma: 0.3 },
];

const PROCUREMENT: CatItem[] = [
  { base: "Coolblue", variants: ["Coolblue", "Coolblue Zakelijk", "COOLBLUE B.V. ROTTERDAM"], category: "procurement", subCategory: "electronics", median: 450, sigma: 0.5 },
  { base: "Bol.com", variants: ["Bol.com", "Bol.com Zakelijk", "BOL.COM B.V. UTRECHT"], category: "procurement", subCategory: "office_supplies", median: 70, sigma: 0.6 },
  { base: "Amazon EU", variants: ["Amazon EU", "AMZN Mktp NL", "Amazon EU SARL", "AMAZON EU SARL LUXEMBOURG"], category: "procurement", subCategory: "electronics", median: 110, sigma: 0.7 },
  { base: "MediaMarkt", variants: ["MediaMarkt", "MEDIAMARKT AMSTERDAM"], category: "procurement", subCategory: "electronics", median: 320, sigma: 0.5 },
  { base: "IKEA BV", variants: ["IKEA BV", "IKEA AMSTERDAM ZUIDOOST"], category: "procurement", subCategory: "furniture", median: 240, sigma: 0.5 },
];

const SERVICES: CatItem[] = [
  { base: "KPMG Advisory", variants: ["KPMG Advisory", "KPMG ADVISORY N.V. AMSTELVEEN"], category: "services", subCategory: "professional", median: 1800, sigma: 0.4 },
  { base: "Mazars", variants: ["Mazars", "MAZARS ACCOUNTANTS UTRECHT"], category: "services", subCategory: "professional", median: 1400, sigma: 0.4 },
  { base: "Notary Jansen", variants: ["Notary Jansen", "NOTARIS JANSEN AMSTERDAM"], category: "services", subCategory: "legal", median: 380, sigma: 0.4 },
  { base: "Google Ads", variants: ["Google Ads", "GOOGLE *ADS GOOGLE.COM"], category: "services", subCategory: "marketing", median: 1500, sigma: 0.4 },
  { base: "LinkedIn Ads", variants: ["LinkedIn Ads", "LINKEDIN CORP MOUNTAIN VIEW"], category: "services", subCategory: "marketing", median: 850, sigma: 0.4 },
];

const UTILITIES: CatItem[] = [
  { base: "Eneco", variants: ["Eneco", "ENECO ROTTERDAM"], category: "utilities", subCategory: "electricity", median: 580, sigma: 0.15 },
  { base: "Greenchoice", variants: ["Greenchoice", "GREENCHOICE UTRECHT"], category: "utilities", subCategory: "electricity", median: 290, sigma: 0.15 },
  { base: "KPN Zakelijk", variants: ["KPN Zakelijk", "KPN B.V. DEN HAAG"], category: "utilities", subCategory: "telecom", median: 165, sigma: 0.1 },
  { base: "Waternet", variants: ["Waternet", "WATERNET AMSTERDAM"], category: "utilities", subCategory: "water", median: 95, sigma: 0.1 },
];

const FUEL: CatItem[] = [
  { base: "Shell", variants: ["Shell Station A2", "SHELL 1234 AMSTERDAM", "Shell Recharge"], category: "fuel", subCategory: "diesel", median: 75, sigma: 0.4 },
  { base: "BP", variants: ["BP", "BP NEDERLAND ROTTERDAM"], category: "fuel", subCategory: "diesel", median: 70, sigma: 0.4 },
];

// ---------- Recurring backbone (per-month) ----------
type RecurringSub = {
  merchant: string;
  description: string;
  category: string;
  subCategory: string | null;
  amountMedian: number;
  sigma: number;
  billingDay: number;
  cadence: "monthly" | "annual";
  annualMonth?: number;
};

const RECURRING_BACKBONE: RecurringSub[] = [
  // Cloud (1st of month)
  { merchant: "AWS EMEA", description: "Monthly infra", category: "cloud", subCategory: "compute_eu", amountMedian: 12000, sigma: 0.2, billingDay: 1, cadence: "monthly" },
  { merchant: "Google Cloud EMEA", description: "BigQuery + Vertex", category: "cloud", subCategory: "compute_eu", amountMedian: 2900, sigma: 0.3, billingDay: 1, cadence: "monthly" },
  { merchant: "Vercel Inc", description: "Hosting + edge", category: "cloud", subCategory: "saas", amountMedian: 720, sigma: 0.3, billingDay: 1, cadence: "monthly" },
  { merchant: "Cloudflare", description: "DNS + Workers", category: "cloud", subCategory: "saas", amountMedian: 180, sigma: 0.2, billingDay: 1, cadence: "monthly" },
  // SaaS billed 1st (EU entities)
  { merchant: "Slack Technologies", description: "Pro seats", category: "cloud", subCategory: "saas", amountMedian: 700, sigma: 0.05, billingDay: 1, cadence: "monthly" },
  { merchant: "Google Cloud EMEA", description: "Workspace seats", category: "cloud", subCategory: "saas", amountMedian: 1100, sigma: 0.05, billingDay: 1, cadence: "monthly" },
  { merchant: "Notion Labs", description: "Team workspace", category: "cloud", subCategory: "saas", amountMedian: 950, sigma: 0.05, billingDay: 1, cadence: "monthly" },
  // SaaS billed mid-month (US-billed, post-FX)
  { merchant: "GitHub", description: "Enterprise seats", category: "cloud", subCategory: "saas", amountMedian: 630, sigma: 0.05, billingDay: 5, cadence: "monthly" },
  { merchant: "Linear", description: "Issue tracking", category: "cloud", subCategory: "saas", amountMedian: 480, sigma: 0.05, billingDay: 7, cadence: "monthly" },
  { merchant: "Figma Inc", description: "Design seats", category: "cloud", subCategory: "saas", amountMedian: 380, sigma: 0.05, billingDay: 8, cadence: "monthly" },
  { merchant: "Sentry", description: "Error monitoring", category: "cloud", subCategory: "saas", amountMedian: 240, sigma: 0.15, billingDay: 10, cadence: "monthly" },
  { merchant: "Datadog", description: "Logs + APM", category: "cloud", subCategory: "saas", amountMedian: 540, sigma: 0.2, billingDay: 12, cadence: "monthly" },
  { merchant: "Anthropic", description: "API usage", category: "cloud", subCategory: "saas", amountMedian: 520, sigma: 0.5, billingDay: 14, cadence: "monthly" },
  { merchant: "OpenAI", description: "API usage", category: "cloud", subCategory: "saas", amountMedian: 380, sigma: 0.5, billingDay: 14, cadence: "monthly" },
  { merchant: "Zoom Video", description: "Pro hosts", category: "cloud", subCategory: "saas", amountMedian: 270, sigma: 0.05, billingDay: 9, cadence: "monthly" },
  // Annual subs (January renewal spike)
  { merchant: "1Password", description: "Annual renewal", category: "cloud", subCategory: "saas", amountMedian: 4800, sigma: 0.05, billingDay: 12, cadence: "annual", annualMonth: 1 },
  { merchant: "ASR Verzekeringen", description: "Annual liability insurance", category: "services", subCategory: "professional", amountMedian: 6800, sigma: 0.05, billingDay: 15, cadence: "annual", annualMonth: 1 },
  // Utilities + telco (monthly direct debit)
  { merchant: "Eneco", description: "Office electricity", category: "utilities", subCategory: "electricity", amountMedian: 580, sigma: 0.1, billingDay: 3, cadence: "monthly" },
  { merchant: "Greenchoice", description: "Warehouse electricity", category: "utilities", subCategory: "electricity", amountMedian: 290, sigma: 0.1, billingDay: 4, cadence: "monthly" },
  { merchant: "KPN Zakelijk", description: "Office telecom", category: "utilities", subCategory: "telecom", amountMedian: 165, sigma: 0.05, billingDay: 15, cadence: "monthly" },
  { merchant: "Waternet", description: "Water + sewerage", category: "utilities", subCategory: "water", amountMedian: 95, sigma: 0.05, billingDay: 5, cadence: "monthly" },
];

// ---------- Long-tail card sampling ----------
type Pool = { items: CatItem[]; weight: number };
const LONG_TAIL_POOLS: Pool[] = [
  { items: TRAVEL_AIR, weight: 4 },
  { items: TRAVEL_RAIL, weight: 3 },
  { items: TRAVEL_GROUND, weight: 6 },
  { items: TRAVEL_LODGING, weight: 3 },
  { items: FOOD_GROC, weight: 8 },
  { items: FOOD_DELIV, weight: 6 },
  { items: FOOD_DINE, weight: 5 },
  { items: PROCUREMENT, weight: 7 },
  { items: SERVICES, weight: 2 },
  { items: FUEL, weight: 1 },
];
const TOTAL_WEIGHT = LONG_TAIL_POOLS.reduce((s, p) => s + p.weight, 0);

const pickPool = (): Pool => {
  let r = rng.range(0, TOTAL_WEIGHT);
  for (const p of LONG_TAIL_POOLS) {
    r -= p.weight;
    if (r <= 0) return p;
  }
  return LONG_TAIL_POOLS[0];
};

// ---------- Date helpers ----------
const daysInMonth = (year: number, month: number) => new Date(Date.UTC(year, month, 0)).getUTCDate();

// Weekday-skewed day picker (1.0 weekday, 0.18 weekend so ~85/15 split)
const pickWeekdaySkewed = (year: number, month: number): number => {
  const dim = daysInMonth(year, month);
  while (true) {
    const d = rng.int(1, dim);
    const dow = new Date(Date.UTC(year, month - 1, d)).getUTCDay(); // 0 sun, 6 sat
    const weight = dow === 0 || dow === 6 ? 0.18 : 1;
    if (rng.next() < weight) return d;
  }
};

// ---------- Generation ----------
type Tx = {
  bunqTxId: string;
  merchantRaw: string;
  description: string;
  amountEur: number;
  timestamp: number; // unix
  category: string;
  subCategory: string | null;
};

const seasonMultiplier = (month: number): number => {
  if (month === 12) return 1.15;
  if (month === 1) return 1.25;
  if (month === 7 || month === 8) return 0.80;
  return 1.0;
};

const longTailCountForMonth = (month: number): number => {
  // Aim ~50 tx/month total, of which ~21 are recurring backbone (see RECURRING_BACKBONE).
  // → ~29/month long tail, modulated by seasonality.
  const base = 29;
  return Math.max(8, Math.round(base * seasonMultiplier(month) * rng.range(0.85, 1.15)));
};

const generateTransactions = (months: number): Tx[] => {
  const txs: Tx[] = [];
  const now = new Date();
  const startYear = now.getUTCFullYear();
  const startMonth = now.getUTCMonth() + 1; // 1..12
  let txCounter = 1_000_000; // synthetic bunqTxId base

  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(Date.UTC(startYear, startMonth - 1 - i, 1));
    const year = d.getUTCFullYear();
    const month = d.getUTCMonth() + 1; // 1..12
    const seasonMult = seasonMultiplier(month);

    // Recurring backbone
    for (const sub of RECURRING_BACKBONE) {
      if (sub.cadence === "annual" && sub.annualMonth !== month) continue;
      const variants = ALL_CATALOGUE.find((c) => c.base === sub.merchant)?.variants ?? [sub.merchant];
      const merchantRaw = rng.pick(variants);
      const amountEur = Math.max(1, Math.round(rng.lognormal(sub.amountMedian, sub.sigma) * seasonMult * 100) / 100);
      const day = Math.min(sub.billingDay, daysInMonth(year, month));
      const ts = Math.floor(Date.UTC(year, month - 1, day, 9, rng.int(0, 59), rng.int(0, 59)) / 1000);
      txs.push({
        bunqTxId: `bunq_${txCounter++}`,
        merchantRaw,
        description: sub.description,
        amountEur,
        timestamp: ts,
        category: sub.category,
        subCategory: sub.subCategory,
      });
    }

    // Payroll batch (monthly on 25th)
    const payrollDay = Math.min(25, daysInMonth(year, month));
    const payrollTs = Math.floor(Date.UTC(year, month - 1, payrollDay, 14, 0, 0) / 1000);
    txs.push({
      bunqTxId: `bunq_${txCounter++}`,
      merchantRaw: "Acme BV Payroll Batch",
      description: `Salaries ${year}-${String(month).padStart(2, "0")} (50 employees)`,
      amountEur: Math.round(rng.range(190_000, 200_000) * 100) / 100,
      timestamp: payrollTs,
      category: "other",
      subCategory: "payroll",
    });

    // Holiday allowance (May or June)
    if (month === 5 || month === 6) {
      txs.push({
        bunqTxId: `bunq_${txCounter++}`,
        merchantRaw: "Acme BV Payroll Batch",
        description: "Holiday allowance (8% vakantiegeld)",
        amountEur: Math.round(rng.range(15_200, 16_000) * 100) / 100,
        timestamp: Math.floor(Date.UTC(year, month - 1, 28, 14, 0, 0) / 1000),
        category: "other",
        subCategory: "payroll",
      });
    }

    // Office rent (1st)
    txs.push({
      bunqTxId: `bunq_${txCounter++}`,
      merchantRaw: "Vastgoed Zuidas BV",
      description: "Kantoorruimte huur",
      amountEur: Math.round(rng.range(18_400, 19_200) * 100) / 100,
      timestamp: Math.floor(Date.UTC(year, month - 1, 1, 8, 0, 0) / 1000),
      category: "other",
      subCategory: "rent",
    });

    // Long-tail card transactions
    const tailCount = longTailCountForMonth(month);
    for (let j = 0; j < tailCount; j++) {
      const pool = pickPool();
      const item = rng.pick(pool.items);
      const merchantRaw = rng.pick(item.variants);
      const amountEur = Math.max(1, Math.round(rng.lognormal(item.median, item.sigma ?? 0.4) * 100) / 100);
      const day = pickWeekdaySkewed(year, month);
      const ts = Math.floor(Date.UTC(year, month - 1, day, rng.int(8, 22), rng.int(0, 59), rng.int(0, 59)) / 1000);
      txs.push({
        bunqTxId: `bunq_${txCounter++}`,
        merchantRaw,
        description: descriptionFor(item, merchantRaw),
        amountEur,
        timestamp: ts,
        category: item.category,
        subCategory: item.subCategory,
      });
    }
  }

  // Sort by timestamp ascending so the audit chain reads chronologically.
  txs.sort((a, b) => a.timestamp - b.timestamp);
  return txs;
};

const descriptionFor = (item: CatItem, _merchantRaw: string): string => {
  const base = item.subCategory ?? item.category;
  switch (base) {
    case "flight_shorthaul": return rng.pick(["AMS-LHR", "AMS-CDG", "AMS-BCN", "AMS-FRA", "AMS-MAD", "AMS-BER", "AMS-LIS"]);
    case "train": return rng.pick(["Thalys to Paris", "ICE to Berlin", "Eurostar London", "NS Business card top-up", "to Utrecht"]);
    case "taxi": return rng.pick(["Airport transfer", "Late night ride", "Client meeting", "to Schiphol"]);
    case "hotel": return rng.pick(["1 night", "2 nights", "Client offsite", "Conference week"]);
    case "groceries": return rng.pick(["Office groceries", "Friday borrel", "Snacks + coffee beans", "Milk + fruit"]);
    case "team_lunch": return rng.pick(["Team lunch", "Friday lunch", "Sprint demo lunch"]);
    case "client_dinner": return rng.pick(["Client dinner", "Board dinner", "Partner dinner"]);
    case "coffee": return "Coffee";
    case "electronics": return rng.pick(["Order ref 111-" + rng.int(1000, 9999), "Monitor", "Laptop", "Keyboard + mouse", "Webcam"]);
    case "office_supplies": return rng.pick(["Office supplies", "Cables", "Paper", "Whiteboard markers"]);
    case "furniture": return rng.pick(["Office chairs", "Standing desk", "Meeting room table"]);
    case "professional": return rng.pick(["Q1 advisory", "Audit prep", "Tax consult", "Q2 review"]);
    case "legal": return rng.pick(["Notarial deed", "Contract review", "Filing"]);
    case "marketing": return rng.pick(["Q1 campaign", "Lead gen", "Brand awareness"]);
    case "diesel": return rng.pick(["Fleet refuel", "Company car"]);
    default: return base;
  }
};

const ALL_CATALOGUE: CatItem[] = [
  ...TRAVEL_AIR, ...TRAVEL_RAIL, ...TRAVEL_GROUND, ...TRAVEL_LODGING,
  ...SAAS_COLLAB, ...SAAS_ENG, ...SAAS_BIZ, ...CLOUD_INFRA,
  ...FOOD_GROC, ...FOOD_DELIV, ...FOOD_DINE,
  ...PROCUREMENT, ...SERVICES, ...UTILITIES, ...FUEL,
];

// ---------- DB writes ----------
const upsertFactors = () => {
  for (const f of FACTORS) {
    db.insert(emissionFactors).values({
      id: f.id, category: f.category, subCategory: f.subCategory,
      factorKgPerEur: f.factorKgPerEur, uncertaintyPct: f.uncertaintyPct,
      region: f.region, source: f.source, tier: f.tier,
    }).onConflictDoNothing().run();
  }
};
const upsertCredits = () => {
  for (const p of CREDIT_PROJECTS) {
    db.insert(creditProjects).values({
      id: p.id, name: p.name, type: p.type, region: p.region,
      country: p.country, pricePerTonneEur: p.pricePerTonneEur,
      description: p.description, registry: p.registry,
    }).onConflictDoNothing().run();
  }
};

const main = async () => {
  console.log(`Generating realistic seed for ${MONTHS} months, seed=${SEED}…`);

  db.insert(orgs).values({
    id: ORG_ID, name: env.defaultOrgName,
    bunqUserId: "42", reserveAccountId: "reserve_1", creditsAccountId: "credits_1",
  }).onConflictDoNothing().run();
  db.insert(policies).values({
    id: "pol_default", orgId: ORG_ID,
    rules: JSON.stringify(DEFAULT_POLICY), active: true,
  }).onConflictDoNothing().run();
  upsertFactors();
  upsertCredits();
  appendAudit({ orgId: ORG_ID, actor: "system", type: "org.seeded", payload: { name: env.defaultOrgName, profile: "Acme BV (50-person Dutch software SME)" } });

  const txs = generateTransactions(MONTHS);
  console.log(`  ${txs.length} transactions generated.`);

  let inserted = 0;
  for (const t of txs) {
    const merchantNorm = normalizeMerchant(t.merchantRaw);
    const cls = await classifyMerchant(t.merchantRaw, t.description);
    // For payroll/rent we want our hand-set category to win (otherwise the classifier flags them as "other").
    const category = t.subCategory === "payroll" || t.subCategory === "rent" ? t.category : cls.category;
    const subCategory = t.subCategory === "payroll" || t.subCategory === "rent" ? t.subCategory : cls.subCategory;

    db.insert(transactions).values({
      id: `tx_${t.bunqTxId}`,
      orgId: ORG_ID,
      bunqTxId: t.bunqTxId,
      merchantRaw: t.merchantRaw,
      merchantNorm,
      amountCents: Math.round(t.amountEur * 100),
      currency: "EUR",
      timestamp: t.timestamp,
      accountId: "main",
      description: t.description,
      category,
      subCategory,
      categoryConfidence: cls.confidence,
      classifierSource: cls.source,
    }).onConflictDoNothing().run();
    inserted += 1;
  }
  appendAudit({ orgId: ORG_ID, actor: "system", type: "transactions.seeded", payload: { count: inserted, months: MONTHS, seed: SEED, profile: "realistic" } });

  // Summary
  const totalEur = txs.reduce((s, t) => s + t.amountEur, 0);
  console.log(`Seeded ${inserted} transactions across ${MONTHS} months.`);
  console.log(`  total EUR: ${totalEur.toLocaleString("en-NL", { maximumFractionDigits: 0 })}`);
  console.log(`  monthly avg: ${(inserted / MONTHS).toFixed(1)} tx, EUR ${(totalEur / MONTHS).toLocaleString("en-NL", { maximumFractionDigits: 0 })}`);
};

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
