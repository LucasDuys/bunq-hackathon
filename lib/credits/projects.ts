/**
 * Seeded EU carbon credit projects (synthetic but plausible).
 * Types: "removal" (biochar, DACCS, reforestation) vs "reduction".
 * Regions: all EU-based. Registries: CRCF (future), Puro.earth, Gold Standard.
 */
export type CreditType = "removal_technical" | "removal_nature" | "reduction";

export type CreditProjectSeed = {
  id: string;
  name: string;
  type: CreditType;
  region: "EU";
  country: string;
  pricePerTonneEur: number;
  description: string;
  registry: string;
};

export const CREDIT_PROJECTS: CreditProjectSeed[] = [
  {
    id: "biochar-nl-gelderland",
    name: "Gelderland Biochar Initiative",
    type: "removal_technical",
    region: "EU",
    country: "NL",
    pricePerTonneEur: 145,
    description:
      "Pyrolysis of Dutch agricultural residues into stable biochar, applied to farmland. Permanence >100 years. Puro.earth verified methodology.",
    registry: "Puro.earth",
  },
  {
    id: "reforestation-ee-baltic",
    name: "Baltic Forest Restoration",
    type: "removal_nature",
    region: "EU",
    country: "EE",
    pricePerTonneEur: 38,
    description:
      "Native mixed-species reforestation on degraded Estonian forest land. 30-year crediting. Gold Standard for Global Goals.",
    registry: "Gold Standard",
  },
  {
    id: "peatland-ie-midlands",
    name: "Irish Midlands Peatland Restoration",
    type: "removal_nature",
    region: "EU",
    country: "IE",
    pricePerTonneEur: 62,
    description:
      "Rewetting of drained peatlands in Bord na Móna lands. High co-benefits for biodiversity. EU LIFE peatlands methodology.",
    registry: "Peatland Code (IE)",
  },
];

export const totalBudgetMix = (
  tonnes: number,
  preference: { preferTypes?: CreditType[]; maxAvgPriceEur?: number } = {},
) => {
  // Simple weighting: 50% biochar (high-permanence), 30% peatland, 20% reforestation.
  // Caller can override.
  const weights: Record<string, number> = {
    "biochar-nl-gelderland": 0.5,
    "peatland-ie-midlands": 0.3,
    "reforestation-ee-baltic": 0.2,
  };
  return CREDIT_PROJECTS.map((p) => {
    const share = weights[p.id] ?? 0;
    const t = tonnes * share;
    return { project: p, tonnes: Number(t.toFixed(3)), eur: Number((t * p.pricePerTonneEur).toFixed(2)) };
  }).filter((r) => r.tonnes > 0);
};
