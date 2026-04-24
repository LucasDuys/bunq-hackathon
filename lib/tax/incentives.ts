/**
 * Dutch & EU tax incentive schemes relevant to carbon-conscious SMEs.
 * Rates current as of 2024/2025 fiscal year. Sources cited per scheme.
 */

export type TaxScheme = {
  id: string;
  name: string;
  nameNl: string;
  jurisdiction: "NL" | "EU";
  type: "deduction" | "credit" | "subsidy" | "avoided_cost";
  /** How the benefit is calculated */
  method: "pct_of_investment" | "pct_of_deduction" | "eur_per_tonne" | "rate_reduction_bps";
  /** Primary rate (interpretation depends on method) */
  rate: number;
  /** For tiered schemes: possible rates */
  tiers?: { label: string; rate: number }[];
  /** Corporate tax rate used to convert deductions → cash savings */
  corpTaxRate: number;
  /** Minimum qualifying investment (EUR), if any */
  minInvestmentEur: number | null;
  /** Annual cap per entity (EUR), if any */
  annualCapEur: number | null;
  /** Which spending categories this scheme applies to */
  eligibleCategories: string[];
  /** Short description for UI */
  description: string;
  source: string;
};

export const NL_CORP_TAX_RATE = 0.258;
export const NL_CORP_TAX_RATE_SMALL = 0.19; // first €200k profit

export const EU_ETS_PRICE_EUR_PER_TONNE = 70; // ~€65-75 range, mid-2025

export const TAX_SCHEMES: TaxScheme[] = [
  {
    id: "nl_eia",
    name: "Energy Investment Deduction",
    nameNl: "Energie-investeringsaftrek (EIA)",
    jurisdiction: "NL",
    type: "deduction",
    method: "pct_of_deduction",
    rate: 0.455,
    corpTaxRate: NL_CORP_TAX_RATE,
    minInvestmentEur: 2500,
    annualCapEur: 136_000_000,
    eligibleCategories: ["utilities", "fuel", "cloud", "procurement"],
    description:
      "45.5% extra tax deduction on energy-saving investments: LED lighting, heat pumps, solar panels, EVs, energy management systems, efficient servers.",
    source: "RVO Energielijst 2024",
  },
  {
    id: "nl_mia",
    name: "Environmental Investment Deduction",
    nameNl: "Milieu-investeringsaftrek (MIA)",
    jurisdiction: "NL",
    type: "deduction",
    method: "pct_of_deduction",
    rate: 0.36,
    tiers: [
      { label: "MIA I", rate: 0.45 },
      { label: "MIA II", rate: 0.36 },
      { label: "MIA III", rate: 0.27 },
    ],
    corpTaxRate: NL_CORP_TAX_RATE,
    minInvestmentEur: 2500,
    annualCapEur: null,
    eligibleCategories: ["travel", "procurement", "utilities", "fuel"],
    description:
      "27–45% extra tax deduction on qualifying environmental investments from the Milieulijst: clean transport, circular materials, sustainable building.",
    source: "RVO Milieulijst 2024",
  },
  {
    id: "nl_vamil",
    name: "Flexible Environmental Depreciation",
    nameNl: "Willekeurige afschrijving milieu-investeringen (Vamil)",
    jurisdiction: "NL",
    type: "deduction",
    method: "pct_of_investment",
    rate: 0.75,
    corpTaxRate: NL_CORP_TAX_RATE,
    minInvestmentEur: 2500,
    annualCapEur: null,
    eligibleCategories: ["travel", "procurement", "utilities", "fuel"],
    description:
      "Write off up to 75% of qualifying green assets in any chosen year. Stackable with MIA for maximum cash-flow benefit.",
    source: "RVO Milieulijst 2024",
  },
  {
    id: "eu_ets_passthrough",
    name: "EU ETS Cost Avoidance",
    nameNl: "EU ETS kostenbesparing",
    jurisdiction: "EU",
    type: "avoided_cost",
    method: "eur_per_tonne",
    rate: EU_ETS_PRICE_EUR_PER_TONNE,
    corpTaxRate: NL_CORP_TAX_RATE,
    minInvestmentEur: null,
    annualCapEur: null,
    eligibleCategories: ["utilities", "fuel", "travel", "food", "procurement"],
    description:
      "Every tonne of CO₂ your supply chain avoids saves ~€70 in carbon costs passed through by suppliers. ETS2 (2027) will extend this to buildings and road transport.",
    source: "EU ETS market price mid-2025",
  },
  {
    id: "eu_green_financing",
    name: "Green Financing Rate Advantage",
    nameNl: "Groene financieringskorting",
    jurisdiction: "EU",
    type: "avoided_cost",
    method: "rate_reduction_bps",
    rate: 30, // basis points
    corpTaxRate: NL_CORP_TAX_RATE,
    minInvestmentEur: null,
    annualCapEur: null,
    eligibleCategories: [],
    description:
      "Banks (bunq, Triodos, Rabobank) offer 20–50 bps lower interest rates for businesses demonstrating lower emissions. Carbo's tracking is the evidence.",
    source: "Dutch Green Bond Framework / bank product sheets",
  },
];

export const schemeById = (id: string) => TAX_SCHEMES.find((s) => s.id === id);

export const schemesForCategory = (category: string) =>
  TAX_SCHEMES.filter(
    (s) => s.eligibleCategories.length === 0 || s.eligibleCategories.includes(category),
  );
