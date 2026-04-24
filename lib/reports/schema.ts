import { z } from "zod";

/**
 * Canonical shape of an annual corporate carbon report, derived from reading
 * 5 real filings (Philips 2024, ENGIE 2023, Shell 2023, KPN 2024, Nestle 2023).
 * Designed to be both (a) the extraction target when reading published reports
 * and (b) the emission shape Carbo produces at year-end.
 *
 * Nearly every field is nullable — real reports diverge heavily. Fill rates
 * per field are documented in SCHEMA.md.
 */

export const frameworkSchema = z.enum([
  "CSRD_ESRS_E1",
  "GRI",
  "TCFD",
  "IFRS_S2",
  "CDP",
  "SECR",
  "SASB",
  "VSME",
  "VOLUNTARY",
  "MIXED",
]);
export type Framework = z.infer<typeof frameworkSchema>;

export const assuranceSchema = z.object({
  level: z.enum(["reasonable", "limited", "none", "partial"]),
  assurer: z.string().nullable(),
  scopeNote: z.string().nullable(),
});

export const ghgTypeSchema = z.enum([
  "CO2",
  "CH4",
  "N2O",
  "HFC",
  "PFC",
  "SF6",
  "NF3",
  "CFC",
  "HCFC",
]);

export const scope1Schema = z.object({
  totalTco2e: z.number().nullable(),
  byGas: z.record(z.string(), z.number()).optional(),
  methodNote: z.string().nullable(),
  uncertaintyPct: z.number().nullable(),
  includesBiogenic: z.boolean().nullable(),
});

export const scope2Schema = z.object({
  locationBasedTco2e: z.number().nullable(),
  marketBasedTco2e: z.number().nullable(),
  methodNote: z.string().nullable(),
  uncertaintyPct: z.number().nullable(),
});

export const scope3CategorySchema = z.enum([
  "cat1_purchased_goods_services",
  "cat2_capital_goods",
  "cat3_fuel_energy_related",
  "cat4_upstream_transportation",
  "cat5_waste_in_operations",
  "cat6_business_travel",
  "cat7_employee_commuting",
  "cat8_upstream_leased_assets",
  "cat9_downstream_transportation",
  "cat10_processing_sold_products",
  "cat11_use_of_sold_products",
  "cat12_end_of_life",
  "cat13_downstream_leased_assets",
  "cat14_franchises",
  "cat15_investments",
]);

export const scope3ItemSchema = z.object({
  category: scope3CategorySchema,
  tco2e: z.number().nullable(),
  method: z
    .enum([
      "spend_based",
      "activity_based",
      "hybrid",
      "supplier_specific",
      "average_data",
      "other",
    ])
    .nullable(),
  factorSource: z.string().nullable(),
  note: z.string().nullable(),
  excludedAsImmaterial: z.boolean().nullable(),
  notApplicable: z.boolean().nullable(),
});

export const intensitySchema = z.object({
  metric: z.string(),
  value: z.number(),
  scopeCoverage: z.array(z.string()).nullable(),
});

export const emissionsSchema = z.object({
  unit: z.literal("tCO2e"),
  baseYear: z.number().nullable(),
  reportingPeriod: z.string(),
  scope1: scope1Schema,
  scope2: scope2Schema,
  scope3: z.array(scope3ItemSchema),
  totalScope1And2Tco2e: z.number().nullable(),
  totalTco2e: z.number().nullable(),
  intensity: z.array(intensitySchema),
  avoidedEmissionsTco2e: z.number().nullable(),
  biogenicEmissionsTco2e: z.number().nullable(),
  operationalControlBoundary: z.boolean().nullable(),
  equityShareBoundary: z.boolean().nullable(),
});

export const energySchema = z.object({
  totalMwh: z.number().nullable(),
  renewableMwh: z.number().nullable(),
  renewablePct: z.number().nullable(),
  byFuel: z.record(z.string(), z.number()).optional(),
  intensity: z
    .object({ metric: z.string(), value: z.number() })
    .nullable(),
  highClimateImpactSectorSharePct: z.number().nullable(),
});

export const targetSchema = z.object({
  name: z.string(),
  scopeCoverage: z.array(z.string()),
  targetYear: z.number(),
  baseYear: z.number().nullable(),
  baseEmissionsTco2e: z.number().nullable(),
  reductionPct: z.number().nullable(),
  targetType: z.enum([
    "absolute",
    "intensity",
    "net_zero",
    "carbon_neutral",
    "other",
  ]),
  sbtiValidated: z.boolean().nullable(),
  sbtiClassification: z
    .enum(["1.5C", "well_below_2C", "2C", "net_zero", "flag", "none"])
    .nullable(),
  progressPct: z.number().nullable(),
});

export const creditStandardSchema = z.enum([
  "Verra_VCS",
  "Gold_Standard",
  "American_Carbon_Registry",
  "Plan_Vivo",
  "Climate_Action_Reserve",
  "Australian_ACCU",
  "EU_CRCF",
  "ICROA_endorsed_other",
  "other",
  "unspecified",
]);

export const creditProjectSchema = z.object({
  name: z.string(),
  country: z.string().nullable(),
  type: z.enum([
    "removal_nature",
    "removal_tech",
    "reduction",
    "avoidance",
    "unspecified",
  ]),
  standard: creditStandardSchema,
  vintageYear: z.number().nullable(),
  tonnesRetired: z.number().nullable(),
  description: z.string().nullable(),
});

export const creditsSchema = z.object({
  totalTonnesRetired: z.number().nullable(),
  removalPct: z.number().nullable(),
  reductionPct: z.number().nullable(),
  euBasedPct: z.number().nullable(),
  byStandard: z.record(z.string(), z.number()).optional(),
  correspondingAdjustmentPct: z.number().nullable(),
  totalSpendEur: z.number().nullable(),
  projects: z.array(creditProjectSchema),
  usedForNetClaim: z.boolean().nullable(),
});

export const internalCarbonPriceSchema = z.object({
  pricePerTco2eEur: z.number(),
  type: z.enum(["shadow", "internal_fee", "implicit", "hybrid"]),
  perimeterDescription: z.string(),
  volumeAtStakeTco2e: z.number().nullable(),
  pricingMethodNote: z.string().nullable(),
});

export const climateRiskSchema = z.object({
  kind: z.enum([
    "physical_acute",
    "physical_chronic",
    "transition_policy",
    "transition_market",
    "transition_technology",
    "transition_reputational",
    "transition_legal",
  ]),
  timeHorizon: z.enum(["short", "medium", "long"]),
  description: z.string(),
  likelihoodLabel: z.string().nullable(),
  controlEffectivenessLabel: z.string().nullable(),
  financialImpactEur: z.number().nullable(),
});

export const governanceSchema = z.object({
  boardOversight: z.boolean().nullable(),
  execRemunerationTiedToClimate: z.boolean().nullable(),
  execRemunerationClimateSharePct: z.number().nullable(),
  climateCommittees: z.array(z.string()).optional(),
  transitionPlanPublished: z.boolean().nullable(),
  transitionPlanReference: z.string().nullable(),
});

export const methodologySchema = z.object({
  ghgProtocolVersion: z.string().nullable(),
  scope2MethodsUsed: z.array(z.enum(["location_based", "market_based"])),
  gwpAssessmentReport: z.enum(["AR4", "AR5", "AR6", "mixed", "unspecified"]),
  factorSources: z.array(z.string()),
  materialityMethod: z.string().nullable(),
  restatedBaseYear: z.boolean().nullable(),
  restatementReason: z.string().nullable(),
});

export const euTaxonomySchema = z.object({
  capexAlignedPct: z.number().nullable(),
  opexAlignedPct: z.number().nullable(),
  revenueAlignedPct: z.number().nullable(),
  climateMitigationSharePct: z.number().nullable(),
  climateAdaptationSharePct: z.number().nullable(),
});

export const carbonReportSchema = z.object({
  company: z.string(),
  reportingYear: z.number(),
  country: z.string(),
  industry: z.string().nullable(),
  revenueEur: z.number().nullable(),
  employees: z.number().nullable(),
  sourceUrl: z.string().nullable(),
  sourceFile: z.string().nullable(),

  framework: frameworkSchema,
  frameworkNotes: z.string().nullable(),
  assurance: assuranceSchema,

  emissions: emissionsSchema,
  energy: energySchema.nullable(),
  targets: z.array(targetSchema),
  credits: creditsSchema.nullable(),
  internalCarbonPrice: internalCarbonPriceSchema.nullable(),
  risks: z.array(climateRiskSchema),
  governance: governanceSchema,
  methodology: methodologySchema,
  euTaxonomy: euTaxonomySchema.nullable(),

  transitionPlanSummary: z.string().nullable(),
  actionSummary: z.string().nullable(),

  _extraction: z
    .object({
      model: z.string(),
      extractedAt: z.string(),
      fieldsWithLowConfidence: z.array(z.string()).optional(),
      warnings: z.array(z.string()).optional(),
    })
    .optional(),
});

export type CarbonReport = z.infer<typeof carbonReportSchema>;
export type Assurance = z.infer<typeof assuranceSchema>;
export type Scope3Item = z.infer<typeof scope3ItemSchema>;
export type CarbonTarget = z.infer<typeof targetSchema>;
export type CreditProject = z.infer<typeof creditProjectSchema>;
export type InternalCarbonPrice = z.infer<typeof internalCarbonPriceSchema>;
export type ClimateRisk = z.infer<typeof climateRiskSchema>;
