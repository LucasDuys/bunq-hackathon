import { z } from "zod";

/**
 * CompanyProfile is the shape the interviewer builds up, answer by answer,
 * that the drafter uses to calibrate a Carbo Policy. Every field is optional
 * because the profile is accumulated over turns; the drafter knows how to fall
 * back when something isn't set.
 */
export const sectorOptions = [
  "software_saas",
  "professional_services",
  "retail_ecommerce",
  "manufacturing",
  "hospitality",
  "logistics_transport",
  "construction_real_estate",
  "other",
] as const;

export const headcountOptions = ["1_10", "11_50", "51_250", "250_plus"] as const;
export const geographyOptions = ["eu_only", "eu_uk_eea", "global"] as const;
export const revenueOptions = ["lt_1m", "1_10m", "10_50m", "50m_plus"] as const;
export const footprintOptions = [
  "fully_remote",
  "one_office",
  "multiple_offices",
  "office_plus_warehouse",
] as const;
export const vehicleOptions = ["none", "1_3_cars", "fleet_4_plus", "fleet_plus_trucks"] as const;
export const ambitionOptions = ["starter", "balanced", "aggressive"] as const;
export const travelIntensityOptions = ["rare", "monthly", "weekly", "product"] as const;
export const cloudIntensityOptions = ["light_saas", "standard", "heavy_compute"] as const;
export const creditPrefOptions = ["eu_removals_only", "eu_mix", "global_cheapest"] as const;
export const removalMixOptions = ["high_removal", "balanced", "reduction_heavy"] as const;
export const csrdObligationOptions = [
  "not_in_scope",
  "voluntary",
  "wave_1",
  "wave_2",
  "wave_3",
] as const;

export const companyProfileSchema = z.object({
  sector: z.enum(sectorOptions).optional(),
  headcount: z.enum(headcountOptions).optional(),
  geography: z.enum(geographyOptions).optional(),
  revenueBand: z.enum(revenueOptions).optional(),
  physicalFootprint: z.enum(footprintOptions).optional(),
  ownedVehicles: z.enum(vehicleOptions).optional(),
  ambition: z.enum(ambitionOptions).optional(),
  travelIntensity: z.enum(travelIntensityOptions).optional(),
  cloudIntensity: z.enum(cloudIntensityOptions).optional(),
  creditPreference: z.enum(creditPrefOptions).optional(),
  removalMix: z.enum(removalMixOptions).optional(),
  approvalThresholdEur: z.number().nonnegative().optional(),
  maxReservePerMonthEur: z.number().nonnegative().optional(),
  existingDataNotes: z.string().optional(),
  csrdObligation: z.enum(csrdObligationOptions).optional(),
  companyName: z.string().optional(),
  nace: z.string().optional(),
});

export type CompanyProfile = z.infer<typeof companyProfileSchema>;

export const EMPTY_PROFILE: CompanyProfile = {};

export const MIN_REQUIRED_FIELDS: Array<keyof CompanyProfile> = [
  "sector",
  "geography",
  "physicalFootprint",
  "ambition",
  "creditPreference",
  "approvalThresholdEur",
];

export const profileCoverage = (p: CompanyProfile): number => {
  let hit = 0;
  for (const f of MIN_REQUIRED_FIELDS) {
    if (p[f] !== undefined && p[f] !== null && p[f] !== "") hit += 1;
  }
  return hit / MIN_REQUIRED_FIELDS.length;
};

export const profileMissing = (p: CompanyProfile): Array<keyof CompanyProfile> =>
  MIN_REQUIRED_FIELDS.filter((f) => p[f] === undefined || p[f] === null || p[f] === "");

/** Labels surfaced in UI. Lowercase/sentence case per DESIGN.md voice rules. */
export const LABELS: Record<string, Record<string, string>> = {
  sector: {
    software_saas: "Software / SaaS",
    professional_services: "Professional services",
    retail_ecommerce: "Retail / e-commerce",
    manufacturing: "Manufacturing",
    hospitality: "Hospitality",
    logistics_transport: "Logistics / transport",
    construction_real_estate: "Construction / real estate",
    other: "Other",
  },
  headcount: {
    "1_10": "1–10 people",
    "11_50": "11–50 people",
    "51_250": "51–250 people",
    "250_plus": "250+ people",
  },
  geography: {
    eu_only: "EU only",
    eu_uk_eea: "EU + UK / EEA",
    global: "Global (incl. non-EU)",
  },
  revenueBand: {
    lt_1m: "Under €1M",
    "1_10m": "€1–10M",
    "10_50m": "€10–50M",
    "50m_plus": "€50M+",
  },
  physicalFootprint: {
    fully_remote: "Fully remote, no office",
    one_office: "One office",
    multiple_offices: "Multiple offices",
    office_plus_warehouse: "Office + warehouse / manufacturing",
  },
  ownedVehicles: {
    none: "None",
    "1_3_cars": "1–3 cars",
    fleet_4_plus: "Fleet (4+ vehicles)",
    fleet_plus_trucks: "Fleet + trucks",
  },
  ambition: {
    starter: "Starter — minimal reserve",
    balanced: "Balanced — Carbo default",
    aggressive: "Aggressive — match a net-zero target",
  },
  travelIntensity: {
    rare: "Rare",
    monthly: "Monthly team trips",
    weekly: "Weekly client travel",
    product: "Travel is the product",
  },
  cloudIntensity: {
    light_saas: "Light — SaaS only",
    standard: "Standard cloud usage",
    heavy_compute: "Heavy compute (AI / ML / analytics)",
  },
  creditPreference: {
    eu_removals_only: "EU removals only",
    eu_mix: "EU mix — removals + reduction",
    global_cheapest: "Global, cheapest",
  },
  removalMix: {
    high_removal: "More than 70% removal",
    balanced: "Roughly 50 / 50",
    reduction_heavy: "Reduction-heavy, cheaper",
  },
  csrdObligation: {
    not_in_scope: "Not in scope",
    voluntary: "Voluntary reporter",
    wave_1: "Wave 1 (reporting in 2025)",
    wave_2: "Wave 2 (reporting in 2026)",
    wave_3: "Wave 3 (reporting in 2027+)",
  },
};

export const labelFor = (topic: string, value: string | undefined): string => {
  if (!value) return "—";
  const group = LABELS[topic];
  return group?.[value] ?? value;
};
