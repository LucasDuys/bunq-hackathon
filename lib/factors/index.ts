/**
 * Spend-based emission factors (kg CO₂e per EUR).
 * Derived from UK DEFRA 2024 GHG factors + ADEME Base Carbone + Exiobase sector averages,
 * coarsened for hackathon use. Uncertainty %s follow GHG Protocol Scope 3 Tier guidance:
 * spend-based factors are typically Tier 3 with 30-60% uncertainty.
 */
export type FactorRow = {
  id: string;
  category: string;
  subCategory: string | null;
  factorKgPerEur: number;
  uncertaintyPct: number;
  region: "EU";
  source: string;
  tier: number;
};

export const FACTORS: FactorRow[] = [
  // Travel
  { id: "travel.flight_shorthaul", category: "travel", subCategory: "flight_shorthaul", factorKgPerEur: 0.65, uncertaintyPct: 0.25, region: "EU", source: "DEFRA 2024 (economy short-haul)", tier: 2 },
  { id: "travel.flight_longhaul",  category: "travel", subCategory: "flight_longhaul",  factorKgPerEur: 0.85, uncertaintyPct: 0.25, region: "EU", source: "DEFRA 2024 (economy long-haul)",  tier: 2 },
  { id: "travel.train",            category: "travel", subCategory: "train",            factorKgPerEur: 0.04, uncertaintyPct: 0.30, region: "EU", source: "DEFRA 2024 (EU electrified rail)", tier: 2 },
  { id: "travel.hotel",            category: "travel", subCategory: "hotel",            factorKgPerEur: 0.15, uncertaintyPct: 0.40, region: "EU", source: "ADEME Base Carbone",            tier: 3 },
  { id: "travel.taxi",             category: "travel", subCategory: "taxi",             factorKgPerEur: 0.22, uncertaintyPct: 0.35, region: "EU", source: "DEFRA 2024",                    tier: 3 },
  { id: "travel.rental_car",       category: "travel", subCategory: "rental_car",       factorKgPerEur: 0.30, uncertaintyPct: 0.35, region: "EU", source: "DEFRA 2024",                    tier: 3 },
  { id: "travel.generic",          category: "travel", subCategory: null,               factorKgPerEur: 0.45, uncertaintyPct: 0.50, region: "EU", source: "Exiobase transport avg",       tier: 3 },

  // Food & hospitality
  { id: "food.restaurant_mixed",   category: "food", subCategory: "restaurant_mixed",   factorKgPerEur: 0.35, uncertaintyPct: 0.40, region: "EU", source: "ADEME + Poore & Nemecek 2018", tier: 3 },
  { id: "food.restaurant_meat",    category: "food", subCategory: "restaurant_meat",    factorKgPerEur: 0.55, uncertaintyPct: 0.40, region: "EU", source: "ADEME (beef-heavy)",           tier: 3 },
  { id: "food.restaurant_plant",   category: "food", subCategory: "restaurant_plant",   factorKgPerEur: 0.18, uncertaintyPct: 0.40, region: "EU", source: "ADEME (plant-forward)",        tier: 3 },
  { id: "food.catering",           category: "food", subCategory: "catering",           factorKgPerEur: 0.45, uncertaintyPct: 0.45, region: "EU", source: "ADEME",                         tier: 3 },
  { id: "food.groceries",          category: "food", subCategory: "groceries",          factorKgPerEur: 0.28, uncertaintyPct: 0.40, region: "EU", source: "Exiobase food sector",         tier: 3 },
  { id: "food.generic",            category: "food", subCategory: null,                 factorKgPerEur: 0.35, uncertaintyPct: 0.50, region: "EU", source: "Exiobase food avg",            tier: 3 },

  // Procurement
  { id: "procurement.electronics",      category: "procurement", subCategory: "electronics",      factorKgPerEur: 0.50, uncertaintyPct: 0.45, region: "EU", source: "Exiobase C26 (computer/electronic)", tier: 3 },
  { id: "procurement.office_supplies",  category: "procurement", subCategory: "office_supplies",  factorKgPerEur: 0.20, uncertaintyPct: 0.50, region: "EU", source: "Exiobase C17/C22",                   tier: 3 },
  { id: "procurement.software",         category: "procurement", subCategory: "software",         factorKgPerEur: 0.05, uncertaintyPct: 0.60, region: "EU", source: "Exiobase J62 (services)",            tier: 3 },
  { id: "procurement.furniture",        category: "procurement", subCategory: "furniture",        factorKgPerEur: 0.35, uncertaintyPct: 0.50, region: "EU", source: "Exiobase C31",                       tier: 3 },
  { id: "procurement.resale_goods",     category: "procurement", subCategory: "resale_goods",     factorKgPerEur: 0.40, uncertaintyPct: 0.55, region: "EU", source: "Exiobase G46",                       tier: 3 },
  { id: "procurement.generic",          category: "procurement", subCategory: null,               factorKgPerEur: 0.35, uncertaintyPct: 0.60, region: "EU", source: "Exiobase manuf. avg",                tier: 3 },

  // Cloud & IT
  { id: "cloud.compute_eu",   category: "cloud", subCategory: "compute_eu",   factorKgPerEur: 0.08, uncertaintyPct: 0.35, region: "EU", source: "AWS/Azure EU region avg + Lancaster 2021", tier: 2 },
  { id: "cloud.compute_high", category: "cloud", subCategory: "compute_high", factorKgPerEur: 0.25, uncertaintyPct: 0.40, region: "EU", source: "Coal-grid region avg",                   tier: 2 },
  { id: "cloud.storage",      category: "cloud", subCategory: "storage",      factorKgPerEur: 0.04, uncertaintyPct: 0.40, region: "EU", source: "Cloud Carbon Footprint",                 tier: 3 },
  { id: "cloud.saas",         category: "cloud", subCategory: "saas",         factorKgPerEur: 0.05, uncertaintyPct: 0.50, region: "EU", source: "Exiobase J62",                          tier: 3 },
  { id: "cloud.generic",      category: "cloud", subCategory: null,           factorKgPerEur: 0.10, uncertaintyPct: 0.50, region: "EU", source: "Cloud weighted avg",                    tier: 3 },

  // Services
  { id: "services.professional", category: "services", subCategory: "professional", factorKgPerEur: 0.08, uncertaintyPct: 0.55, region: "EU", source: "Exiobase M69-M74",   tier: 3 },
  { id: "services.marketing",    category: "services", subCategory: "marketing",    factorKgPerEur: 0.15, uncertaintyPct: 0.55, region: "EU", source: "Exiobase M73",       tier: 3 },
  { id: "services.legal",        category: "services", subCategory: "legal",        factorKgPerEur: 0.07, uncertaintyPct: 0.50, region: "EU", source: "Exiobase M69",       tier: 3 },
  { id: "services.generic",      category: "services", subCategory: null,           factorKgPerEur: 0.12, uncertaintyPct: 0.60, region: "EU", source: "Exiobase services avg", tier: 3 },

  // Utilities & fuel
  { id: "utilities.electricity", category: "utilities", subCategory: "electricity", factorKgPerEur: 1.20, uncertaintyPct: 0.25, region: "EU", source: "EEA 2023 NL grid mix", tier: 2 },
  { id: "utilities.gas",         category: "utilities", subCategory: "gas",         factorKgPerEur: 2.80, uncertaintyPct: 0.20, region: "EU", source: "DEFRA 2024 natural gas", tier: 2 },
  { id: "fuel.petrol",           category: "fuel",      subCategory: "petrol",      factorKgPerEur: 2.50, uncertaintyPct: 0.20, region: "EU", source: "DEFRA 2024",            tier: 2 },
  { id: "fuel.diesel",           category: "fuel",      subCategory: "diesel",      factorKgPerEur: 2.60, uncertaintyPct: 0.20, region: "EU", source: "DEFRA 2024",            tier: 2 },

  // Other / uncategorized
  { id: "other.generic", category: "other", subCategory: null, factorKgPerEur: 0.30, uncertaintyPct: 0.70, region: "EU", source: "Exiobase economy-wide avg", tier: 3 },
];

export const factorById = (id: string) => FACTORS.find((f) => f.id === id);

export const factorFor = (category: string, subCategory: string | null): FactorRow => {
  if (subCategory) {
    const specific = FACTORS.find((f) => f.category === category && f.subCategory === subCategory);
    if (specific) return specific;
  }
  const generic = FACTORS.find((f) => f.category === category && f.subCategory === null);
  return generic ?? FACTORS.find((f) => f.id === "other.generic")!;
};

export const SUB_CATEGORIES_BY_CATEGORY: Record<string, string[]> = FACTORS.reduce((acc, f) => {
  if (!f.subCategory) return acc;
  acc[f.category] = acc[f.category] || [];
  if (!acc[f.category].includes(f.subCategory)) acc[f.category].push(f.subCategory);
  return acc;
}, {} as Record<string, string[]>);

export const ALL_CATEGORIES = Array.from(new Set(FACTORS.map((f) => f.category)));
