import { MODEL_SONNET, anthropic, withAnthropicFallback } from "@/lib/anthropic/client";
import { carbonReportSchema, type CarbonReport } from "./schema";

const SYSTEM_PROMPT = `You extract structured CSRD ESRS E1-style carbon disclosures from corporate sustainability reports. You return JSON matching the provided schema exactly. Use null for any field the report does not disclose — never guess. Every numeric claim must be grounded in a specific passage. All emissions values are in tCO2e (convert if the source uses kt or Mt). All amounts are in EUR (convert if the source uses USD/GBP using rough period-average rates; note the conversion in the field's nearest string field).

If the report uses GHG Protocol Scope 3 categories by name, map them to the 15 standard categories. If the report uses a bespoke taxonomy (e.g. ENGIE's "activity-based" split), do your best to map to the closest Scope 3 category and note the mapping in that item's 'note' field.

For \`framework\`: pick the single strongest framework cited. Use MIXED only if the report explicitly cites two standards with equal weight.`;

const userPrompt = (opts: {
  company: string;
  year: number;
  country: string;
  sourceFile: string;
  climateSectionText: string;
}) => `Extract a carbon report for ${opts.company} (${opts.country}, ${opts.year}) from the climate-section text below. Return JSON only, no markdown fencing, no prose before or after.

Output shape (TypeScript):

\`\`\`ts
type CarbonReport = {
  company: string; reportingYear: number; country: string;
  industry: string | null; revenueEur: number | null; employees: number | null;
  sourceUrl: string | null; sourceFile: string | null;
  framework: "CSRD_ESRS_E1"|"GRI"|"TCFD"|"IFRS_S2"|"CDP"|"SECR"|"SASB"|"VSME"|"VOLUNTARY"|"MIXED";
  frameworkNotes: string | null;
  assurance: { level: "reasonable"|"limited"|"none"|"partial"; assurer: string | null; scopeNote: string | null };
  emissions: {
    unit: "tCO2e"; baseYear: number | null; reportingPeriod: string;
    scope1: { totalTco2e: number|null; byGas?: Record<"CO2"|"CH4"|"N2O"|"HFC"|"PFC"|"SF6"|"NF3"|"CFC"|"HCFC", number>; methodNote: string|null; uncertaintyPct: number|null; includesBiogenic: boolean|null };
    scope2: { locationBasedTco2e: number|null; marketBasedTco2e: number|null; methodNote: string|null; uncertaintyPct: number|null };
    scope3: Array<{ category: "cat1_purchased_goods_services"|"cat2_capital_goods"|"cat3_fuel_energy_related"|"cat4_upstream_transportation"|"cat5_waste_in_operations"|"cat6_business_travel"|"cat7_employee_commuting"|"cat8_upstream_leased_assets"|"cat9_downstream_transportation"|"cat10_processing_sold_products"|"cat11_use_of_sold_products"|"cat12_end_of_life"|"cat13_downstream_leased_assets"|"cat14_franchises"|"cat15_investments"; tco2e: number|null; method: "spend_based"|"activity_based"|"hybrid"|"supplier_specific"|"average_data"|"other"|null; factorSource: string|null; note: string|null; excludedAsImmaterial: boolean|null; notApplicable: boolean|null }>;
    totalScope1And2Tco2e: number|null; totalTco2e: number|null;
    intensity: Array<{ metric: string; value: number; scopeCoverage: string[]|null }>;
    avoidedEmissionsTco2e: number|null; biogenicEmissionsTco2e: number|null;
    operationalControlBoundary: boolean|null; equityShareBoundary: boolean|null;
  };
  energy: { totalMwh: number|null; renewableMwh: number|null; renewablePct: number|null; byFuel?: Record<string, number>; intensity: {metric: string; value: number}|null; highClimateImpactSectorSharePct: number|null } | null;
  targets: Array<{ name: string; scopeCoverage: string[]; targetYear: number; baseYear: number; baseEmissionsTco2e: number|null; reductionPct: number|null; targetType: "absolute"|"intensity"|"net_zero"|"carbon_neutral"|"other"; sbtiValidated: boolean|null; sbtiClassification: "1.5C"|"well_below_2C"|"2C"|"net_zero"|"flag"|"none"|null; progressPct: number|null }>;
  credits: { totalTonnesRetired: number|null; removalPct: number|null; reductionPct: number|null; euBasedPct: number|null; byStandard?: Record<"Verra_VCS"|"Gold_Standard"|"American_Carbon_Registry"|"Plan_Vivo"|"Climate_Action_Reserve"|"Australian_ACCU"|"EU_CRCF"|"ICROA_endorsed_other"|"other"|"unspecified", number>; correspondingAdjustmentPct: number|null; totalSpendEur: number|null; projects: Array<{ name: string; country: string|null; type: "removal_nature"|"removal_tech"|"reduction"|"avoidance"|"unspecified"; standard: string; vintageYear: number|null; tonnesRetired: number|null; description: string|null }>; usedForNetClaim: boolean|null } | null;
  internalCarbonPrice: { pricePerTco2eEur: number; type: "shadow"|"internal_fee"|"implicit"|"hybrid"; perimeterDescription: string; volumeAtStakeTco2e: number|null; pricingMethodNote: string|null } | null;
  risks: Array<{ kind: "physical_acute"|"physical_chronic"|"transition_policy"|"transition_market"|"transition_technology"|"transition_reputational"|"transition_legal"; timeHorizon: "short"|"medium"|"long"; description: string; likelihoodLabel: string|null; controlEffectivenessLabel: string|null; financialImpactEur: number|null }>;
  governance: { boardOversight: boolean|null; execRemunerationTiedToClimate: boolean|null; execRemunerationClimateSharePct: number|null; climateCommittees?: string[]; transitionPlanPublished: boolean|null; transitionPlanReference: string|null };
  methodology: { ghgProtocolVersion: string|null; scope2MethodsUsed: Array<"location_based"|"market_based">; gwpAssessmentReport: "AR4"|"AR5"|"AR6"|"mixed"|"unspecified"; factorSources: string[]; materialityMethod: string|null; restatedBaseYear: boolean|null; restatementReason: string|null };
  euTaxonomy: { capexAlignedPct: number|null; opexAlignedPct: number|null; revenueAlignedPct: number|null; climateMitigationSharePct: number|null; climateAdaptationSharePct: number|null } | null;
  transitionPlanSummary: string|null; actionSummary: string|null;
};
\`\`\`

Fixed metadata: company="${opts.company}" reportingYear=${opts.year} country="${opts.country}" sourceFile="${opts.sourceFile}". Leave sourceUrl null unless explicitly present.

--- CLIMATE SECTION TEXT ---
${opts.climateSectionText}
--- END ---

Return JSON now.`;

const mockExtraction = (opts: {
  company: string;
  year: number;
  country: string;
  sourceFile: string;
}): CarbonReport => ({
  company: opts.company,
  reportingYear: opts.year,
  country: opts.country,
  industry: null,
  revenueEur: null,
  employees: null,
  sourceUrl: null,
  sourceFile: opts.sourceFile,
  framework: "VOLUNTARY",
  frameworkNotes: "mock extraction — no real data",
  assurance: { level: "none", assurer: null, scopeNote: null },
  emissions: {
    unit: "tCO2e",
    baseYear: null,
    reportingPeriod: String(opts.year),
    scope1: { totalTco2e: null, methodNote: null, uncertaintyPct: null, includesBiogenic: null },
    scope2: { locationBasedTco2e: null, marketBasedTco2e: null, methodNote: null, uncertaintyPct: null },
    scope3: [],
    totalScope1And2Tco2e: null,
    totalTco2e: null,
    intensity: [],
    avoidedEmissionsTco2e: null,
    biogenicEmissionsTco2e: null,
    operationalControlBoundary: null,
    equityShareBoundary: null,
  },
  energy: null,
  targets: [],
  credits: null,
  internalCarbonPrice: null,
  risks: [],
  governance: {
    boardOversight: null,
    execRemunerationTiedToClimate: null,
    execRemunerationClimateSharePct: null,
    transitionPlanPublished: null,
    transitionPlanReference: null,
  },
  methodology: {
    ghgProtocolVersion: null,
    scope2MethodsUsed: [],
    gwpAssessmentReport: "unspecified",
    factorSources: [],
    materialityMethod: null,
    restatedBaseYear: null,
    restatementReason: null,
  },
  euTaxonomy: null,
  transitionPlanSummary: null,
  actionSummary: null,
  _extraction: {
    model: "mock",
    extractedAt: new Date().toISOString(),
  },
});

export const extractCarbonReport = async (opts: {
  company: string;
  year: number;
  country: string;
  sourceFile: string;
  climateSectionText: string;
}): Promise<CarbonReport> => {
  return withAnthropicFallback(
    async () => {
      const client = anthropic();
      const msg = await client.messages.create({
        model: MODEL_SONNET,
        max_tokens: 8000,
        system: SYSTEM_PROMPT,
        messages: [{ role: "user", content: userPrompt(opts) }],
      });

      const text = msg.content
        .filter((c) => c.type === "text")
        .map((c) => (c as { text: string }).text)
        .join("");

      const match = text.match(/\{[\s\S]*\}/);
      if (!match) return mockExtraction(opts);

      const raw = JSON.parse(match[0]);
      const parsed = carbonReportSchema.parse({
        ...raw,
        _extraction: {
          model: MODEL_SONNET,
          extractedAt: new Date().toISOString(),
        },
      });
      return parsed;
    },
    () => mockExtraction(opts),
    "reports.extractCarbonReport",
  );
};
